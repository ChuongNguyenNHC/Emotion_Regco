import asyncio
import base64
import binascii
from collections import deque
from datetime import datetime, timezone
import io
import json
import os
import random
import re
import shutil
import tempfile
import threading
import time
from functools import lru_cache
from pathlib import Path

import cv2
import numpy as np
import torch
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel

app = FastAPI(
    title="Emotion Recognition AI Microservice",
    description="FastAPI service for facial emotion classification using PyTorch models",
    version="1.0.0"
)

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
_model_mtime = 0.0
_model_lock = threading.Lock()

LOG_MAX_HISTORY = 1000
_system_logs = deque(maxlen=LOG_MAX_HISTORY)
_log_id_counter = 0
_log_subscribers: set[tuple[asyncio.Queue, asyncio.AbstractEventLoop]] = set()
_log_lock = threading.Lock()
_start_time = time.time()
_stats_lock = threading.Lock()
_system_stats = {
    "total_requests": 0,
    "total_errors": 0,
    "latencies_ms": deque(maxlen=100),
    "emotion_counts": {e: 0 for e in EMOTIONS},
}


def emit_system_log(
    level: str,
    module: str,
    message: str,
    details: dict | None = None,
) -> dict:
    """Record a system log entry and safely broadcast it to all active SSE subscribers."""
    global _log_id_counter
    with _log_lock:
        _log_id_counter += 1
        entry = {
            "id": _log_id_counter,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": level.upper(),
            "module": module.upper(),
            "message": message,
            "details": details or {},
        }
        _system_logs.append(entry)

    print(f"[{entry['level']}][{entry['module']}] {message}")

    dead = []
    for item in list(_log_subscribers):
        try:
            q, q_loop = item
            if q_loop and q_loop.is_running():
                q_loop.call_soon_threadsafe(q.put_nowait, entry)
            else:
                q.put_nowait(entry)
        except Exception:
            dead.append(item)
    for d in dead:
        _log_subscribers.discard(d)

    return entry


def get_system_stats() -> dict:
    """Compile aggregated runtime performance metrics and hardware info."""
    uptime = round(time.time() - _start_time, 1)
    with _stats_lock:
        reqs = _system_stats["total_requests"]
        errs = _system_stats["total_errors"]
        latencies = list(_system_stats["latencies_ms"])
        emotion_counts = dict(_system_stats["emotion_counts"])

    avg_latency = round(sum(latencies) / len(latencies), 1) if latencies else 0.0
    p95_latency = round(float(np.percentile(latencies, 95)), 1) if latencies else 0.0
    error_rate = round((errs / reqs * 100), 2) if reqs > 0 else 0.0

    return {
        "uptimeSeconds": uptime,
        "totalRequests": reqs,
        "totalErrors": errs,
        "errorRatePct": error_rate,
        "avgLatencyMs": avg_latency,
        "p95LatencyMs": p95_latency,
        "activeSubscribers": len(_log_subscribers),
        "bufferedLogCount": len(_system_logs),
        "modelLoaded": _model is not None,
        "modelName": _model_name_display,
        "device": "cuda" if torch.cuda.is_available() else "cpu",
        "emotionCounts": emotion_counts,
    }


@app.on_event("startup")
def on_startup():
    emit_system_log("INFO", "SYSTEM", "EmotionAI Microservice engine initialized successfully on port 8000.")
    emit_system_log("INFO", "MODEL", f"Configured model target: {_model_name_display} | Checkpoint: {MODEL_PATH.name}")
    try:
        load_model()
    except Exception as exc:
        emit_system_log("WARN", "MODEL", f"Initial model load deferred: {exc}")


class Base64ImageRequest(BaseModel):
    image_base64: str


@lru_cache(maxsize=1)
def get_face_detector():
    cascade_path = Path(cv2.data.haarcascades) / "haarcascade_frontalface_default.xml"
    detector = cv2.CascadeClassifier(str(cascade_path))
    if detector.empty():
        raise RuntimeError(f"Could not load face detector: {cascade_path}")
    return detector


def crop_largest_face(image: Image.Image, emit_log: bool = True) -> Image.Image:
    try:
        if not hasattr(cv2, "CascadeClassifier"):
            return image
        grayscale = cv2.cvtColor(np.asarray(image), cv2.COLOR_RGB2GRAY)
        grayscale = cv2.equalizeHist(grayscale)

        faces = get_face_detector().detectMultiScale(
            grayscale,
            scaleFactor=1.1,
            minNeighbors=4,
            minSize=(32, 32),
        )
        if len(faces) == 0:
            if emit_log:
                emit_system_log("WARN", "DETECTION", "No face detected by Haar cascade; using uncropped frame")
            return image

        x, y, width, height = max(faces, key=lambda face: face[2] * face[3])

        top_margin = int(height * 0.25)
        bottom_margin = int(height * 0.18)
        side_margin = int(width * 0.15)

        left = max(0, x - side_margin)
        top = max(0, y - top_margin)
        right = min(image.width, x + width + side_margin)
        bottom = min(image.height, y + height + bottom_margin)

        cropped = image.crop((left, top, right, bottom))
        if emit_log:
            emit_system_log(
                "INFO",
                "DETECTION",
                f"Face detected ({width}x{height} at x:{x}, y:{y}); cropped to {cropped.width}x{cropped.height}",
                {"bbox": [int(x), int(y), int(width), int(height)], "croppedSize": [cropped.width, cropped.height]}
            )
        return cropped
    except Exception as exc:
        if emit_log:
            emit_system_log("WARN", "DETECTION", f"Face detection exception: {exc}; using full frame")
        return image


def load_model(force_reload: bool = False):
    global _model, _preprocess, _model_labels, _model_name_display, _model_mtime

    current_mtime = MODEL_PATH.stat().st_mtime if MODEL_PATH.is_file() else 0.0
    if _model is not None and not force_reload and current_mtime <= _model_mtime:
        return _model

    with _model_lock:
        current_mtime = MODEL_PATH.stat().st_mtime if MODEL_PATH.is_file() else 0.0
        if _model is not None and not force_reload and current_mtime <= _model_mtime:
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
            _model_mtime = current_mtime
            emit_system_log(
                "SUCCESS",
                "MODEL",
                f"Model weights loaded into memory ({_model_name_display}, input size: {image_size}x{image_size})",
                {"model": _model_name_display, "classes": len(normalized_labels), "device": "cpu"}
            )
            return _model
        except HTTPException:
            raise
        except Exception as exc:
            emit_system_log("ERROR", "MODEL", f"Model loading failed: {exc}")
            raise HTTPException(
                status_code=503,
                detail=f"Could not load emotion model: {exc}",
            ) from exc


def decode_image(image_bytes: bytes) -> Image.Image:
    try:
        return Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Request does not contain a valid image") from exc


EMOTION_SENSITIVITY = {
    "Angry": 1.25,
    "Disgust": 1.30,
    "Fear": 1.25,
    "Happy": 0.90,
    "Neutral": 0.90,
    "Sad": 1.20,
    "Surprise": 1.15,
}

def run_inference(image: Image.Image, emit_log: bool = True):
    start_time_perf = time.perf_counter()
    network = load_model()
    face_image = crop_largest_face(image, emit_log=emit_log)

    try:
        with torch.inference_mode():
            model_input = _preprocess(face_image).unsqueeze(0)
            logits = network(model_input)[0]

            calibrated_logits = logits.clone()
            for i, label in enumerate(_model_labels):
                factor = EMOTION_SENSITIVITY.get(label, 1.0)
                calibrated_logits[i] *= factor

            scores = torch.softmax(calibrated_logits, dim=0)
    except Exception as exc:
        with _stats_lock:
            _system_stats["total_errors"] += 1
        if emit_log:
            emit_system_log("ERROR", "INFERENCE", f"Emotion inference computation failed: {exc}")
        raise HTTPException(status_code=500, detail=f"Emotion inference failed: {exc}") from exc

    probabilities = {
        emotion: float(scores[_model_labels.index(emotion)].item())
        for emotion in EMOTIONS
    }
    predicted_emotion = max(probabilities, key=probabilities.get)
    latency_ms = round((time.perf_counter() - start_time_perf) * 1000, 2)

    with _stats_lock:
        _system_stats["total_requests"] += 1
        _system_stats["latencies_ms"].append(latency_ms)
        _system_stats["emotion_counts"][predicted_emotion] += 1

    if emit_log:
        emit_system_log(
            "SUCCESS",
            "INFERENCE",
            f"Classified '{predicted_emotion}' ({probabilities[predicted_emotion] * 100:.1f}%) in {latency_ms}ms",
            {
                "emotion": predicted_emotion,
                "confidence": round(probabilities[predicted_emotion], 4),
                "latency_ms": latency_ms,
                "model": _model_name_display,
            }
        )

    return {
        "success": True,
        "emotion": predicted_emotion,
        "emoji": EMOTION_EMOJIS[predicted_emotion],
        "confidence": probabilities[predicted_emotion],
        "model": _model_name_display,
        "latency_ms": latency_ms,
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
    start_video_perf = time.perf_counter()
    try:
        shutil.copyfileobj(file.file, temp_video)
        temp_video.close()

        cap = cv2.VideoCapture(temp_video.name)
        if not cap.isOpened():
            emit_system_log("ERROR", "VIDEO", f"Cannot read uploaded video: {file.filename}")
            raise HTTPException(status_code=400, detail="Cannot read uploaded video file.")

        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        duration_seconds = total_frames / fps if fps > 0 else 0

        emit_system_log(
            "INFO",
            "VIDEO",
            f"Received video '{file.filename}' ({duration_seconds:.1f}s, {total_frames} frames @ {fps:.1f}fps)",
            {"filename": file.filename, "durationSeconds": round(duration_seconds, 1), "totalFrames": total_frames, "fps": round(fps, 1)}
        )

        sample_step = max(1, int(round(fps)))
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

                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                pil_image = Image.fromarray(rgb_frame)

                try:
                    res = run_inference(pil_image, emit_log=False)
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
            emit_system_log("WARN", "VIDEO", f"No valid faces or frames analyzed in video {file.filename}")
            raise HTTPException(status_code=400, detail="No valid frames could be analyzed in the video.")

        total_analyzed = len(timeline)
        distribution = {
            emotion: round((count / total_analyzed) * 100, 1)
            for emotion, count in emotion_counts.items()
        }
        dominant_emotion = max(emotion_counts, key=emotion_counts.get)
        elapsed_video_ms = round((time.perf_counter() - start_video_perf) * 1000, 1)

        emit_system_log(
            "SUCCESS",
            "VIDEO",
            f"Video analysis completed in {elapsed_video_ms}ms: {total_analyzed} sampled points. Dominant emotion: '{dominant_emotion}' ({distribution[dominant_emotion]}%)",
            {
                "dominantEmotion": dominant_emotion,
                "sampledFrames": total_analyzed,
                "elapsedMs": elapsed_video_ms,
                "distribution": distribution,
            }
        )

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
        with _stats_lock:
            _system_stats["total_errors"] += 1
        emit_system_log("ERROR", "VIDEO", f"Video processing failed: {exc}")
        raise HTTPException(status_code=500, detail=f"Video processing failed: {exc}") from exc
    finally:
        if os.path.exists(temp_video.name):
            try:
                os.remove(temp_video.name)
            except OSError:
                pass

METRICS_FILE = Path(__file__).resolve().parent / "models" / "metrics.json"

DEFAULT_CLASSIFICATION_REPORT = {
    "classes": [
        {"emotion": "Angry",    "emoji": "😠", "precision": 0.2495, "recall": 0.1284, "f1": 0.1695, "support": 958},
        {"emotion": "Disgust",  "emoji": "🤢", "precision": 0.0000, "recall": 0.0000, "f1": 0.0000, "support": 111},
        {"emotion": "Fear",     "emoji": "😨", "precision": 0.0000, "recall": 0.0000, "f1": 0.0000, "support": 1024},
        {"emotion": "Happy",    "emoji": "😊", "precision": 0.3133, "recall": 0.6685, "f1": 0.4267, "support": 1774},
        {"emotion": "Neutral",  "emoji": "😐", "precision": 0.2419, "recall": 0.2725, "f1": 0.2563, "support": 1233},
        {"emotion": "Sad",      "emoji": "😢", "precision": 0.2620, "recall": 0.1748, "f1": 0.2097, "support": 1247},
        {"emotion": "Surprise", "emoji": "😮", "precision": 0.3423, "recall": 0.2756, "f1": 0.3053, "support": 831},
    ],
    "accuracy": 0.2914,
    "macro_avg":    {"precision": 0.2013, "recall": 0.2171, "f1": 0.1954},
    "weighted_avg": {"precision": 0.2374, "recall": 0.2914, "f1": 0.2439},
    "total_support": 7178,
}


def load_classification_report() -> dict:
    """Load latest metrics from metrics.json generated automatically by train.py, fallback to default."""
    if METRICS_FILE.exists():
        try:
            with open(METRICS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict) and "classes" in data and "accuracy" in data:
                    return data
        except Exception as exc:
            emit_system_log("WARN", "MODEL", f"Failed reading dynamic metrics.json: {exc}")
    return DEFAULT_CLASSIFICATION_REPORT


def _parse_training_log() -> list[dict]:
    """Parse train.log and return epoch history as list of dicts."""
    log_path = Path(__file__).resolve().parent / "train.log"
    if not log_path.exists():
        return []

    pattern = re.compile(
        r'(?:warm-up|fine-tune)\s+(\d+)/\d+\s*\|\s*train loss ([\d.]+),\s*accuracy ([\d.]+)%\s*\|\s*val loss ([\d.]+),\s*accuracy ([\d.]+)%'
    )

    epochs = []
    epoch_idx = 1
    try:
        content = log_path.read_text(encoding="utf-8", errors="replace")
        for m in pattern.finditer(content):
            epochs.append({
                "epoch": epoch_idx,
                "trainLoss": float(m.group(2)),
                "trainAcc": float(m.group(3)),
                "valLoss": float(m.group(4)),
                "valAcc": float(m.group(5)),
            })
            epoch_idx += 1
    except Exception:
        pass
    return epochs


@app.get("/api/v1/model-metrics")
def get_model_metrics():
    """Return classification report metrics and training epoch history."""
    training_history = _parse_training_log()
    report = load_classification_report()
    return {
        "success": True,
        "model": _model_name_display,
        "classificationReport": report,
        "trainingHistory": training_history,
        "bestValAccuracy": max((e["valAcc"] for e in training_history), default=None),
        "isDynamic": METRICS_FILE.exists(),
    }

@app.get("/api/v1/system-logs")
def get_system_logs(limit: int = 150, level: str | None = None, module: str | None = None):
    """Retrieve recent buffered system logs and runtime telemetry."""
    with _log_lock:
        logs = list(_system_logs)
    if level and level.upper() != "ALL":
        logs = [l for l in logs if l["level"] == level.upper()]
    if module and module.upper() != "ALL":
        logs = [l for l in logs if l["module"] == module.upper()]
    if limit > 0:
        logs = logs[-limit:]
    return {
        "success": True,
        "logs": logs,
        "stats": get_system_stats(),
    }


@app.get("/api/v1/system-logs/stream")
async def stream_system_logs():
    """Server-Sent Events (SSE) stream for real-time system logs and health heartbeats."""
    queue = asyncio.Queue(maxsize=300)
    loop = asyncio.get_running_loop()
    sub_item = (queue, loop)
    _log_subscribers.add(sub_item)

    async def event_generator():
        try:
            welcome_data = json.dumps({
                "type": "handshake",
                "message": "Connected to EmotionAI System Log Stream",
                "stats": get_system_stats(),
            })
            yield f"event: connected\ndata: {welcome_data}\n\n"

            while True:
                try:
                    entry = await asyncio.wait_for(queue.get(), timeout=12.0)
                    yield f"event: log\ndata: {json.dumps(entry)}\n\n"
                except asyncio.TimeoutError:
                    yield f": heartbeat {time.time()}\n\n"
        except (asyncio.CancelledError, GeneratorExit):
            pass
        finally:
            _log_subscribers.discard(sub_item)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/api/v1/system-logs/clear")
def clear_system_logs():
    """Clear in-memory system log history."""
    with _log_lock:
        _system_logs.clear()
    emit_system_log("INFO", "SYSTEM", "System log buffer has been cleared by operator.")
    return {"success": True, "message": "Log buffer cleared", "stats": get_system_stats()}


@app.post("/api/v1/system-logs/test")
def test_system_logs():
    """Generate sample logs for testing the live streaming UI."""
    sample_emotions = ["Happy", "Surprise", "Neutral", "Sad", "Angry"]
    emo = random.choice(sample_emotions)
    lat = round(random.uniform(22.0, 58.0), 1)

    emit_system_log("INFO", "DETECTION", "Frontal face detected: 142x142 px, confidence=0.98", {"bbox": [120, 80, 142, 142]})
    emit_system_log("SUCCESS", "INFERENCE", f"Inference completed in {lat}ms: {emo} ({random.randint(82, 98)}%)", {"emotion": emo, "latency_ms": lat})
    if random.random() < 0.35:
        emit_system_log("WARN", "SYSTEM", "Frame buffer running slightly behind real-time (dropped 1 frame)", {"dropped": 1})
    return {"success": True, "message": "Test logs emitted", "stats": get_system_stats()}

