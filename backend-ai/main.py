import base64
import binascii
import io
import os
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
        faces = get_face_detector().detectMultiScale(
            grayscale,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(24, 24),
        )
        if len(faces) == 0:
            return image

        x, y, width, height = max(faces, key=lambda face: face[2] * face[3])
        margin = int(max(width, height) * 0.2)
        left = max(0, x - margin)
        top = max(0, y - margin)
        right = min(image.width, x + width + margin)
        bottom = min(image.height, y + height + margin)
        return image.crop((left, top, right, bottom))
    except Exception:
        return image


def load_model():
    global _model, _preprocess, _model_labels

    if _model is not None:
        return _model

    with _model_lock:
        if _model is not None:
            return _model
        try:
            from torchvision import transforms
            from torchvision.models import mobilenet_v3_large

            if not MODEL_PATH.is_file():
                raise FileNotFoundError(
                    f"MobileNetV3-Large emotion checkpoint not found: {MODEL_PATH}. "
                    "Set EMOTION_MODEL_PATH or place the trained .pth file there."
                )

            checkpoint = torch.load(MODEL_PATH, map_location="cpu", weights_only=True)
            labels = EMOTIONS
            image_size = 224
            if isinstance(checkpoint, dict):
                labels = checkpoint.get("labels", EMOTIONS)
                image_size = checkpoint.get("image_size", image_size)
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

            network = mobilenet_v3_large(weights=None)
            network.classifier[-1] = torch.nn.Linear(
                network.classifier[-1].in_features,
                len(normalized_labels),
            )
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


def run_inference(image: Image.Image):
    network = load_model()
    face_image = crop_largest_face(image)

    try:
        with torch.inference_mode():
            model_input = _preprocess(face_image).unsqueeze(0)
            logits = network(model_input)[0]
            scores = torch.softmax(logits, dim=0)
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
        "probabilities": probabilities,
    }

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "Emotion Recognition AI Service",
        "model": "MobileNetV3-Large",
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
