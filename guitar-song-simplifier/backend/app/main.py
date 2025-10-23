from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from app.api import routes


app = FastAPI(title="Guitar Song Simplifier API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Configure this w/ front-end domain for prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(routes.router)


# @app.post("/analyze-audio/")
# async def analyze_audio(file: UploadFile = File(...)):
#     """
#     Analyze uploaded audio file fo beats and chords
#     """
#     try:
#         # Validate file type (more flexible for curl)
#         if file.content_type and not file.content_type.startswith('audio/'):
#             # Check file extension as fallback
#             if not file.filename.lower().endswith(('.wav', '.mp3', '.flac', '.m4a', '.ogg')):
#                 raise HTTPException(status_code=400, detail="File must be an audio file")
        
#         # Save uploaded file to temporary location
#         with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
#             content = await file.read()
#             tmp.write(content)
#             tmp_path = tmp.name
        
#         try:
#             # Get beats using your existing function (which uses librosa)
#             beat_times_dict = get_beats(tmp_path)
#             beat_times_librosa = list(beat_times_dict.values())
            
            
#             # Prepare response
#             result = {
#                 "beats": beat_times_librosa,
#                 "beat_count": len(beat_times_librosa),
#                 "file_info": {
#                     "filename": file.filename,
#                     "content_type": file.content_type,
#                     "size_bytes": len(content)
#                 }
#             }
            
#             return JSONResponse(content=result)
            
#         finally:
#             # Clean up temporary file
#             if os.path.exists(tmp_path):
#                 os.unlink(tmp_path)
                
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Error processing audio: {str(e)}")

# @app.post("/analyze-chords/")
# async def analyze_chords(file: UploadFile = File(...)):
#     """
#     Analyze uploaded audio file for chord detection using both MADMOM and Chordino
#     """
#     try:
#         # Validate file type (more flexible for curl)
#         if file.content_type and not file.content_type.startswith('audio/'):
#             # Check file extension as fallback
#             if not file.filename.lower().endswith(('.wav', '.mp3', '.flac', '.m4a', '.ogg')):
#                 raise HTTPException(status_code=400, detail="File must be an audio file")
        
#         # Save uploaded file to temporary location
#         with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
#             content = await file.read()
#             tmp.write(content)
#             tmp_path = tmp.name
        
#         try:
#             # Get chords using your existing function
#             unique_chords, chord_sequence = get_chords(tmp_path)
            
#             # Convert chord_sequence (dict) to list format for API response
#             chord_list = [
#                 {"start": float(start), "chord": chord}
#                 for start, chord in chord_sequence.items()
#             ]
            
#             # Prepare response
#             result = {
#                 "chords": chord_list,
#                 "unique_chords": unique_chords,
#                 "chord_count": len(chord_sequence),
#                 "unique_chord_count": len(unique_chords),
#                 "file_info": {
#                     "filename": file.filename,
#                     "content_type": file.content_type,
#                     "size_bytes": len(content)
#                 }
#             }
            
#             return JSONResponse(content=result)
            
#         finally:
#             # Clean up temporary file
#             if os.path.exists(tmp_path):
#                 os.unlink(tmp_path)
                
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Error processing chords: {str(e)}")



# if __name__ == "__main__":
#     uvicorn.run(app, host="0.0.0.0", port=8000) 