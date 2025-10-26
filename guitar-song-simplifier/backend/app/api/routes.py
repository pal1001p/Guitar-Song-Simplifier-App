from fastapi import APIRouter, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from loaded_song_combo import get_beats, get_chords
import librosa

router = APIRouter()

@router.get("/")
async def root():
    return {"Guitar Song Simplifier API is running!"}

@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "guitar-song-simplifier"}

@router.post("/upload_file")
async def upload_file():
    return {"file uploaded!"}
