from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import whisper
import tensorflow as tf
import tensorflow_hub as hub
import torch
import torch.nn as nn
import numpy as np
import uuid
import os
import subprocess

app = FastAPI()

# CORS setup for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # adjust if needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load Whisper
print("🔊 Loading Whisper model...")
whisper_model = whisper.load_model("base")

# Load TRILL2 model
print("🔗 Loading TRILL2 embedding model...")
trill_model = hub.load("https://tfhub.dev/google/trillsson2/1")

# Load classifier (just the head)
print("🧠 Loading classifier head...")
model = nn.Sequential(
    nn.Linear(1024, 256),
    nn.ReLU(),
    nn.Dropout(0.3),
    nn.Linear(256, 6)  # Adjust this if your num_classes != 6
)
model.load_state_dict(torch.load("models/classifier_only.pth", map_location=torch.device("cpu")))
model.eval()

# Label mapping (adjust if different)
LABELS = ["Anger", "Disgust", "Fear", "Happiness", "Neutral", "Sadness"]

# Ensure temp folder exists
os.makedirs("temp", exist_ok=True)

def convert_webm_to_wav(input_path, output_path):
    subprocess.run([
        "ffmpeg", "-i", input_path,
        "-ac", "1", "-ar", "16000",
        output_path, "-y"
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def load_audio_tensor(wav_path):
    audio_binary = tf.io.read_file(wav_path)
    audio, _ = tf.audio.decode_wav(audio_binary)
    audio = tf.squeeze(audio, axis=-1)
    return tf.expand_dims(audio, 0)

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    uid = str(uuid.uuid4())
    webm_path = f"temp/{uid}.webm"
    wav_path = f"temp/{uid}.wav"

    # Save upload
    with open(webm_path, "wb") as f:
        f.write(await file.read())

    # Convert to WAV
    convert_webm_to_wav(webm_path, wav_path)

    # Transcribe
    transcription = whisper_model.transcribe(wav_path)["text"].strip()

    # Embed
    audio_tensor = load_audio_tensor(wav_path)
    embedding = trill_model(audio_tensor)
    mean_embedding = embedding['embedding'].numpy()[0]

    print("🔍 Embedding shape:", mean_embedding.shape) 

    # Predict

    input_tensor = torch.from_numpy(mean_embedding).unsqueeze(0).float()
    with torch.no_grad():
        logits = model(input_tensor)
        pred_index = torch.argmax(logits, dim=1).item()
        predicted_label = LABELS[pred_index]

    # Clean up
    os.remove(webm_path)
    os.remove(wav_path)

    return {
        "label": predicted_label,
        "transcription": transcription
    }






