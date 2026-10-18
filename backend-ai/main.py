import base64
import binascii
import io
import os
import shutil
import tempfile
import threading
from functools import lru_cache
from pathlib import Path

import cv2
import numpy as np
import torch
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel

app = FastAPI(
    title="Emotion Recognition AI Microservice",
    description="FastAPI service for facial emotion classification using PyTorch models",
    version="1.0.0"
)

# Allow CORS for React Frontend & Spring Boot Backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

EMOTIONS = ["Angry", "Disgust", "Fear", "Happy", "Sad", "Surprise", "Neutral"]
EMOTION_EMOJIS = {
    "Happy": "😊",
    "Neutral": "😐",
    "Surprise": "😮",
    "Sad": "😢",
    "Angry": "😡",
    "Fear": "😨",
    "Disgust": "🤢"
}
MODEL_PATH = Path(os.getenv(
    "EMOTION_MODEL_PATH",
    Path(__file__).resolve().parent / "models" / "mobilenetv3_large_emotion.pth",
))

_model = None
_preprocess = None
_model_labels = EMOTIONS
_model_name_display = "EfficientNet-B0"
_model_lock = threading.Lock()

class Base64ImageRequest(BaseModel):
    image_base64: str


@lru_cache(maxsize=1)
def get_face_detector():
    cascade_path = Path(cv2.data.haarcascades) / "haarcascade_frontalface_default.xml"
    detector = cv2.CascadeClassifier(str(cascade_path))
    if detector.empty():
        raise RuntimeError(f"Could not load face detector: {cascade_path}")
    return detector


def crop_largest_face(image: Image.Image) -> Image.Image:
    try:
        if not hasattr(cv2, "CascadeClassifier"):
            return image
        grayscale = cv2.cvtColor(np.asarray(image), cv2.COLOR_RGB2GRAY)
        # Apply histogram equalization to normalize brightness/contrast
        grayscale = cv2.equalizeHist(grayscale)

        faces = get_face_detector().detectMultiScale(
            grayscale,
            scaleFactor=1.1,
            minNeighbors=4,
            minSize=(32, 32),
        )
        if len(faces) == 0:
            return image

        x, y, width, height = max(faces, key=lambda face: face[2] * face[3])

        # Extra margins: forehead (top: 25%), chin (bottom: 20%), sides: 15%
        # This captures eye-brow wrinkles (Angry/Surprise) and mouth curvature (Sad/Disgust)
        top_margin = int(height * 0.25)
        bottom_margin = int(height * 0.18)
        side_margin = int(width * 0.15)

        left = max(0, x - side_margin)
        top = max(0, y - top_margin)
        right = min(image.width, x + width + side_margin)
        bottom = min(image.height, y + height + bottom_margin)

        cropped = image.crop((left, top, right, bottom))
        return cropped
    except Exception:
        return image


def load_model():
    global _model, _preprocess, _model_labels, _model_name_display

    if _model is not None:
        return _model

    with _model_lock:
        if _model is not None:
            return _model
        try:
            from torchvision import transforms
            from torchvision.models import efficientnet_b0, mobilenet_v3_large

            if not MODEL_PATH.is_file():
                raise FileNotFoundError(
                    f"Emotion checkpoint not found: {MODEL_PATH}. "
                    "Set EMOTION_MODEL_PATH or place the trained .pth file there."
                )

            checkpoint = torch.load(MODEL_PATH, map_location="cpu", weights_only=True)
            labels = EMOTIONS
            image_size = 224
            model_name = "efficientnet_b0"
            if isinstance(checkpoint, dict):
                labels = checkpoint.get("labels", EMOTIONS)
                image_size = checkpoint.get("image_size", image_size)
                model_name = checkpoint.get("model_name", model_name)
                state_dict = checkpoint.get(
                    "state_dict",
                    checkpoint.get("model_state_dict", checkpoint.get("model", checkpoint)),
                )
            else:
                state_dict = checkpoint

            normalized_labels = [str(label).strip().lower() for label in labels]
            if len(normalized_labels) != len(EMOTIONS) or set(normalized_labels) != {
                emotion.lower() for emotion in EMOTIONS
            }:
                raise ValueError(f"Checkpoint has an unexpected emotion label set: {labels}")

            is_efficientnet = model_name == "efficientnet_b0" or any(k.startswith("features.0.0") for k in state_dict.keys())
            if is_efficientnet:
                network = efficientnet_b0(weights=None)
                network.classifier[1] = torch.nn.Linear(
                    network.classifier[1].in_features,
                    len(normalized_labels),
                )
                _model_name_display = "EfficientNet-B0"
            else:
                network = mobilenet_v3_large(weights=None)
                network.classifier[-1] = torch.nn.Linear(
                    network.classifier[-1].in_features,
                    len(normalized_labels),
                )
                _model_name_display = "MobileNetV3-Large"

            network.load_state_dict(state_dict)
            _model_labels = [next(
                emotion for emotion in EMOTIONS if emotion.lower() == label
            ) for label in normalized_labels]

            network.to("cpu")
            network.eval()
            _preprocess = transforms.Compose([
                transforms.Resize((image_size, image_size)),
                transforms.ToTensor(),
                transforms.Normalize(
                    mean=(0.485, 0.456, 0.406),
                    std=(0.229, 0.224, 0.225),
                ),
            ])
            _model = network
            return _model
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=503,
                detail=f"Could not load emotion model: {exc}",
            ) from exc


def decode_image(image_bytes: bytes) -> Image.Image:
    try:
        return Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Request does not contain a valid image") from exc


# Sensitivity calibrators: Boost hard-to-detect subtle emotions (Angry, Sad, Surprise, Fear)
# and reduce slight over-confidence of Happy & Neutral caused by dataset bias.
EMOTION_SENSITIVITY = {
    "Angry": 1.25,
    "Disgust": 1.30,
    "Fear": 1.25,
    "Happy": 0.90,
    "Neutral": 0.90,
    "Sad": 1.20,
    "Surprise": 1.15,
}

def run_inference(image: Image.Image):
    network = load_model()
    face_image = crop_largest_face(image)

    try:
        with torch.inference_mode():
            model_input = _preprocess(face_image).unsqueeze(0)
            logits = network(model_input)[0]

            # Rebalance logits with calibrated sensitivity
            calibrated_logits = logits.clone()
            for i, label in enumerate(_model_labels):
                factor = EMOTION_SENSITIVITY.get(label, 1.0)
                calibrated_logits[i] *= factor

            scores = torch.softmax(calibrated_logits, dim=0)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Emotion inference failed: {exc}") from exc

    probabilities = {
        emotion: float(scores[_model_labels.index(emotion)].item())
        for emotion in EMOTIONS
    }
    predicted_emotion = max(probabilities, key=probabilities.get)
    return {
        "success": True,
        "emotion": predicted_emotion,
        "emoji": EMOTION_EMOJIS[predicted_emotion],
        "confidence": probabilities[predicted_emotion],
        "model": _model_name_display,
        "probabilities": probabilities,
    }

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "Emotion Recognition AI Service",
        "model": _model_name_display if _model is not None else "EfficientNet-B0 (Default)",
        "modelLoaded": _model is not None,
        "version": "1.0.0"
    }

@app.post("/api/v1/predict")
def predict_emotion(file: UploadFile = File(...)):
    """Accepts image file upload and predicts emotion"""
    try:
        contents = file.file.read()
        return run_inference(decode_image(contents))
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Image processing failed: {exc}") from exc

@app.post("/api/v1/predict-base64")
def predict_emotion_base64(data: Base64ImageRequest):
    """Accepts base64 encoded string from React canvas/webcam"""
    try:
        base64_str = data.image_base64
        if "," in base64_str:
            base64_str = base64_str.split(",", 1)[1]
        image_bytes = base64.b64decode(base64_str, validate=True)
        return run_inference(decode_image(image_bytes))
    except HTTPException:
        raise
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Invalid Base64 image data") from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Base64 image processing failed: {exc}") from exc


@app.post("/api/v1/predict-video")
def predict_video(file: UploadFile = File(...)):
    """Processes uploaded video file and extracts emotion timeline and summary"""
    suffix = Path(file.filename or "video.mp4").suffix or ".mp4"
    temp_video = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        shutil.copyfileobj(file.file, temp_video)
        temp_video.close()

        cap = cv2.VideoCapture(temp_video.name)
        if not cap.isOpened():
            raise HTTPException(status_code=400, detail="Cannot read uploaded video file.")

        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        duration_seconds = total_frames / fps if fps > 0 else 0

        # Sample at 1 frame per second (step = round(fps))
        sample_step = max(1, int(round(fps)))
        # Limit max analysis points to 180 seconds (3 mins) to keep inference fast
        max_samples = 180

        timeline = []
        emotion_counts = {emotion: 0 for emotion in EMOTIONS}
        frame_idx = 0
        analyzed_count = 0

        while cap.isOpened() and analyzed_count < max_samples:
            ret, frame = cap.read()
            if not ret:
                break

            if frame_idx % sample_step == 0:
                current_sec = int(round(frame_idx / fps))
                mins = current_sec // 60
                secs = current_sec % 60
                timestamp_str = f"{mins:02d}:{secs:02d}"

                # OpenCV frame is BGR -> convert to RGB PIL Image
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                pil_image = Image.fromarray(rgb_frame)

                try:
                    res = run_inference(pil_image)
                    pred_emotion = res["emotion"]
                    emotion_counts[pred_emotion] += 1
                    timeline.append({
                        "second": current_sec,
                        "timestamp": timestamp_str,
                        "emotion": pred_emotion,
                        "emoji": res["emoji"],
                        "confidence": round(res["confidence"], 4),
                        "probabilities": {k: round(v, 4) for k, v in res["probabilities"].items()}
                    })
                    analyzed_count += 1
                except Exception:
                    pass

            frame_idx += 1

        cap.release()

        if not timeline:
            raise HTTPException(status_code=400, detail="No valid frames could be analyzed in the video.")

        # Aggregate summary percentages
        total_analyzed = len(timeline)
        distribution = {
            emotion: round((count / total_analyzed) * 100, 1)
            for emotion, count in emotion_counts.items()
        }
        dominant_emotion = max(emotion_counts, key=emotion_counts.get)

        return {
            "success": True,
            "filename": file.filename,
            "durationSeconds": round(duration_seconds, 1),
            "sampledFrames": total_analyzed,
            "dominantEmotion": dominant_emotion,
            "emoji": EMOTION_EMOJIS[dominant_emotion],
            "distribution": distribution,
            "timeline": timeline,
            "model": _model_name_display
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Video processing failed: {exc}") from exc
    finally:
        if os.path.exists(temp_video.name):
            try:
                os.remove(temp_video.name)
            except OSError:
                pass

