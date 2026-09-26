import io
import base64
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image
import numpy as np

app = FastAPI(
    title="Emotion Recognition AI Microservice",
    description="FastAPI service for facial emotion detection using MobileNet",
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

class Base64ImageRequest(BaseModel):
    image_base64: str

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "Emotion Recognition AI Service",
        "model": "MobileNetV3 / Custom PyTorch Model",
        "version": "1.0.0"
    }

@app.post("/api/v1/predict")
async def predict_emotion(file: UploadFile = File(...)):
    """Accepts image file upload and predicts emotion"""
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
        
        # Mock / Placeholder inference for fast startup setup
        # Later connected to PyTorch / MobileNet model weights
        mock_probabilities = {
            "Happy": 0.85,
            "Neutral": 0.08,
            "Surprise": 0.04,
            "Sad": 0.01,
            "Angry": 0.01,
            "Fear": 0.005,
            "Disgust": 0.005
        }
        predicted_emotion = "Happy"

        return {
            "success": True,
            "emotion": predicted_emotion,
            "emoji": EMOTION_EMOJIS[predicted_emotion],
            "confidence": mock_probabilities[predicted_emotion],
            "probabilities": mock_probabilities
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Image processing failed: {str(e)}")

@app.post("/api/v1/predict-base64")
async def predict_emotion_base64(data: Base64ImageRequest):
    """Accepts base64 encoded string from React canvas/webcam"""
    try:
        # Strip header if present (e.g. data:image/jpeg;base64,)
        base64_str = data.image_base64
        if "," in base64_str:
            base64_str = base64_str.split(",")[1]
            
        image_bytes = base64.b64decode(base64_str)
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        
        mock_probabilities = {
            "Happy": 0.87,
            "Neutral": 0.07,
            "Surprise": 0.03,
            "Sad": 0.01,
            "Angry": 0.01,
            "Fear": 0.005,
            "Disgust": 0.005
        }
        predicted_emotion = "Happy"

        return {
            "success": True,
            "emotion": predicted_emotion,
            "emoji": EMOTION_EMOJIS[predicted_emotion],
            "confidence": mock_probabilities[predicted_emotion],
            "probabilities": mock_probabilities
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Base64 image decoding failed: {str(e)}")
