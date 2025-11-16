from fastapi import APIRouter, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from loaded_song_combo import get_beats, get_chords
import librosa
import os
import requests
from bs4 import BeautifulSoup, Comment
import tempfile


router = APIRouter()

@router.get("/")
async def root():
    """Root endpoint"""
    return {"message": "Guitar Song Simplifier API is running!"}

@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "guitar-song-simplifier"}

@router.post("/upload_file")
async def upload_file(file: UploadFile = File(...)):
    """File upload endpoint"""
    try:
        content = await file.read()
        result = {
            "filename": file.filename,
            "content_type": file.content_type,
            "size_bytes": len(content)
        }
        return JSONResponse(content=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@router.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    """File analysis endpoint"""
    try:
        ext = file.filename.split('.')[-1]
        if ext not in ['wav','mp3','m4a']:
            raise HTTPException(status_code=400, detail="Unsupported file type. Must be .wav,.mp3 or .m4a")
        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{ext}") as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name
        # beats = get_beats(tmp_path)
        unique_chords, chord_sequence = get_chords(tmp_path)
        
        result = {
            # "beats": beats,
            "unique_chords": unique_chords,
            "chord_sequence": chord_sequence
            }
        
        os.remove(tmp_path)
        return JSONResponse(content=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail = f"Analysis failed: {str(e)}")

@router.get("/load_unique_chord")
async def load_unique_chord(chord):
    try:
        # proxy to scrape
        url = f"https://www.scales-chords.com/chord/guitar/{chord}"
        print(url)
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
        }
        res = requests.get(url, headers=headers, timeout=10)
        if res.status_code != 200:
            raise HTTPException(status_code=500, detail = f"Url fetch failed: status code {res.status_code}")
        soup = BeautifulSoup(res.text, "html.parser")

        comment = soup.find(string = lambda target: isinstance(target,Comment) and "main chord image" in target.lower())
        if not comment:
            raise HTTPException(status_code=500, detail = "Comment fetch failed: main chord image comment not found")
        div = comment.find_next("div")
        if not div:
            raise HTTPException(status_code=500, detail = "Div fetch failed: div element not found")
        img = div.find("img")
        if not img:
            raise HTTPException(status_code=500, detail = "Chord image url fetch failed: img element not found")
        img_url = img.get("src")
        if not img_url:
            raise HTTPException(status_code=500, detail = "Chord image url fetch failed: img src attribute not found")
        if img_url.startswith("/"):
            img_url = "https://www.scales-chords.com" + img_url
        
        return {
            "chord" : chord,
            "img_url": img_url}

    except Exception as e:
        raise HTTPException(status_code=500, detail = f"Chord fetch failed: {str(e)}")

