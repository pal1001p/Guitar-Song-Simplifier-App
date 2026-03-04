from fastapi import APIRouter, File, UploadFile, HTTPException, WebSocket, WebSocketDisconnect, Query
from fastapi.responses import JSONResponse, Response
from loaded_song_combo import get_beats, get_chords
from realtime_combo import get_chords_complex
import os
import requests
from bs4 import BeautifulSoup, Comment
import tempfile
from urllib.parse import quote
import numpy as np
import torch
import time
import json
from collections import Counter
from pathlib import Path

from complex_realtime_chords.models import LSTMClassifier
from complex_realtime_chords.preprocess.chords import ind_to_chord_names
from complex_realtime_chords.utils.utils import get_params_by_category
from complex_realtime_chords.realtime import (
    process_audio_chunk,
    find_closest_match_for_sequence,
    get_weights_path_absolute,
)

# Backend directory for resolving model paths
BACKEND_DIR = Path(__file__).parent.parent.parent.resolve()


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
        unique_chords, chord_sequence = get_chords(tmp_path)
        
        result = {
            "unique_chords": unique_chords,
            "chord_sequence": chord_sequence
            }
        
        os.remove(tmp_path)
        return JSONResponse(content=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail = f"Analysis failed: {str(e)}")

@router.get("/load_unique_chord_url")
async def load_unique_chord(chord: str = Query(..., description="Chord name to fetch URL for")):
    """URL fetch for each chord endpoint"""
    try:
        # proxy to scrape
        # URL-encode the chord for the external API (for example, C# becomes C%23)
        encoded_chord = quote(chord, safe='')
        url = f"https://www.scales-chords.com/chord/guitar/{encoded_chord}"
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
            raise HTTPException(status_code=500, detail = f"[PRE-CACHE] URL fetch failed: status code {res.status_code}")
        soup = BeautifulSoup(res.text, "html.parser")

        comment = soup.find(string = lambda target: isinstance(target,Comment) and "main chord image" in target.lower())
        if not comment:
            raise HTTPException(status_code=500, detail = "Comment fetch failed: main chord image comment not found")
        div = comment.find_next("div")
        if not div:
            raise HTTPException(status_code=500, detail = "Div fetch failed: div element not found")
        img = div.find("img")
        if not img:
            raise HTTPException(status_code=500, detail = "Chord image URL fetch failed: img element not found")
        img_url = img.get("src")
        if not img_url:
            raise HTTPException(status_code=500, detail = "Chord image URL fetch failed: img src attribute not found")
        if img_url.startswith("/"):
            img_url = "https://www.scales-chords.com" + img_url
        
        return {
            "chord" : chord,
            "img_url": img_url}

    except Exception as e:
        raise HTTPException(status_code=500, detail = f"Chord URL fetch failed: {str(e)}")

@router.get("/load_chord_image_bytes")
async def load_chord_images(url: str = Query(..., description="URL of the chord image to fetch")):
    """Image bytes fetch for each chord endpoint"""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
        }
        res = requests.get(url, headers=headers, timeout=10)
        if res.status_code != 200:
            raise HTTPException(status_code=500, detail=f"[CACHE] Url fetch failed: status code {res.status_code}")
        
        content_type = res.headers.get("content-type", "image/png")
        print("Fetched content-type:", content_type)
        return Response(
            content=res.content,
            media_type=content_type
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chord image bytes for cache failed: {str(e)}")

# Global state for WebSocket connections
active_connections: dict = {}

@router.websocket("/ws/record")
async def websocket_record(websocket: WebSocket):
    """WebSocket endpoint for real-time audio recording and chord detection"""
    try:
        print(f"WebSocket connection attempt from {websocket.client}")
        await websocket.accept()
        print("WebSocket connection accepted")
    except Exception as e:
        print(f"Error accepting WebSocket connection: {e}")
        import traceback
        traceback.print_exc()
        return
    
    connection_id = id(websocket)
    
    try:
        # Initialize connection state
        active_connections[connection_id] = {
            'start_time': None,
            'prev_chord': '',
            'chord_sequence': None,
            'unique_chords': None,
            'model': None,
            'category': 'MirexMajMin',  # Default category
            'device': torch.device('cuda' if torch.cuda.is_available() else 'cpu'),
            'sample_rate': 44100,  # Default, will be updated from client
            'chunk_count': 0,
        }
        
        conn_state = active_connections[connection_id]
        
        # Wait for initialization message with chord sequence
        init_message = await websocket.receive_text()
        init_data = json.loads(init_message)
        
        if init_data.get('type') == 'init':
            try:
                conn_state['chord_sequence'] = init_data.get('chord_sequence', {})
                conn_state['unique_chords'] = init_data.get('unique_chords', [])
                conn_state['category'] = init_data.get('category', 'MirexMajMin')

                print("chord seq",conn_state['chord_sequence'] )
                print("unique", conn_state['unique_chords'])
                print("category", conn_state['category'])
                # Store sample rate if provided (may come later)
                if 'sample_rate' in init_data:
                    conn_state['sample_rate'] = init_data.get('sample_rate', 44100)
                    print("sample rate provided", conn_state['sample_rate'] )
                # print("sample rate not provided")
                # Load model (use realtime module for path and logic)
                weights_path = get_weights_path_absolute(conn_state['category'], BACKEND_DIR)
                if not weights_path:
                    await websocket.send_json({
                        'type': 'error',
                        'message': f'Invalid category: {conn_state["category"]}'
                    })
                    return
                
                # Check if model file exists
                if not os.path.exists(weights_path):
                    await websocket.send_json({
                        'type': 'error',
                        'message': f'Model file not found at: {weights_path}. Please check the model path.'
                    })
                    return
                
                params, y_size, y_ind = get_params_by_category(conn_state['category'])
                print(f"{params}, {y_size}, {y_ind}")

                model = LSTMClassifier(
                    input_size=84,
                    hidden_dim=128,
                    output_size=y_size,
                    num_layers=3,
                    use_gpu=torch.cuda.is_available(),
                    bidirectional=True,
                    dropout=[0.4, 0.0, 0.0]
                )
                
                model = model.to(conn_state['device'])
                try:
                    if conn_state['device'].type == 'cuda':
                        model.load_state_dict(torch.load(weights_path))
                    else:
                        model.load_state_dict(torch.load(weights_path, map_location='cpu'))
                    model.eval()
                except Exception as e:
                    await websocket.send_json({
                        'type': 'error',
                        'message': f'Failed to load model: {str(e)}'
                    })
                    return
                
                conn_state['model'] = model
                conn_state['start_time'] = time.time()

                print(f"{conn_state['model']}, { conn_state['start_time']}")
                
                await websocket.send_json({
                    'type': 'ready',
                    'message': 'Ready to process audio'
                })
            except Exception as e:
                await websocket.send_json({
                    'type': 'error',
                    'message': f'Initialization error: {str(e)}'
                })
                return
        else:
            await websocket.send_json({
                'type': 'error',
                'message': 'Invalid initialization message. Expected type: init'
            })
            return
        
        # Process audio chunks
        while True:
            message = await websocket.receive()
            
            if 'text' in message:
                # Handle control messages (like sample_rate update)
                try:
                    data = json.loads(message['text'])
                    if data.get('type') == 'sample_rate':
                        conn_state['sample_rate'] = data.get('sample_rate', 44100)
                        print(f"Updated sample rate to {conn_state['sample_rate']}Hz for connection {connection_id}")
                    elif data.get('type') == 'stop':
                        break
                except:
                    pass
                continue
            
            if 'bytes' in message:
                # Receive audio data as bytes
                audio_bytes = message['bytes']
                conn_state['chunk_count'] += 1
                
                # Convert bytes to numpy array (int16 PCM)
                audio_data = np.frombuffer(audio_bytes, dtype=np.int16)
                rms = float(np.sqrt(np.mean(audio_data.astype(np.float32) ** 2)))
                print(f"[ws {connection_id}] audio rms={rms}")
                
                if len(audio_data) == 0:
                    continue
                
                try:
                    # Process audio chunk with the actual sample rate from client
                    sample_rate = conn_state.get('sample_rate', 44100)
                    X = process_audio_chunk(audio_data, sr=sample_rate)
                    
                    print("sample rate in try", sample_rate)
                    with torch.no_grad():
                        X_tensor = torch.tensor(X, dtype=torch.float64).to(conn_state['device'])
                        X_tensor = X_tensor.unsqueeze(0)
                        
                        # Get prediction
                        pred = conn_state['model'](X_tensor)
                        y = pred.topk(1, dim=2)[1].squeeze().view(-1)
                        
                        # Get most common chord
                        counter = Counter(ind_to_chord_names(y.cpu().numpy(), conn_state['category']))
                        current_chord = counter.most_common(1)[0][0]
                        # print("current chord", current_chord)
                        if '#:min' in current_chord:
                            current_chord = current_chord[:1] + '#m'
                        elif '#:maj' in current_chord:
                            current_chord = current_chord[:1] + '#'
                        elif ':maj' in current_chord:
                            current_chord = current_chord[:1]
                        elif ':min' in current_chord:
                            current_chord = current_chord[:1] + 'm'

                        # Debug: confirm audio is arriving + what model predicts (even if it's "N")
                        if conn_state['chunk_count'] % 25 == 0:
                            print(
                                f"[ws {connection_id}] "
                                f"chunks={conn_state['chunk_count']} "
                                f"bytes={len(audio_bytes)} "
                                f"sr={sample_rate} "
                                f"pred={current_chord}"
                            )
                        
                        timestamp = time.time() - conn_state['start_time']
                        # print("previous chord", conn_state['prev_chord'])
                        # Only send update if chord changed and is not "N" (no chord)
                        if conn_state['prev_chord'] != current_chord and current_chord != "N":
                            conn_state['prev_chord'] = current_chord
                            
                            # Find closest match in expected sequence
                            feedback = {
                                'type': 'chord_detected',
                                'chord': current_chord,
                                'timestamp': timestamp,
                                'status': 'unknown'
                            }
                            
                            if conn_state['chord_sequence']:
                                closest_timestamp, expected_chord = find_closest_match_for_sequence(
                                    timestamp,
                                    conn_state['chord_sequence'],
                                )
                                
                                if closest_timestamp is not None:
                                    time_diff = abs(closest_timestamp - timestamp)
                                    
                                    if time_diff <= 1.0:
                                        if expected_chord == current_chord:
                                            feedback['status'] = 'good'
                                            feedback['message'] = 'GOOD! Correct chord at correct time'
                                        else:
                                            feedback['status'] = 'wrong_chord'
                                            feedback['message'] = f'BAD! You played {current_chord} instead of {expected_chord}'
                                            feedback['expected_chord'] = expected_chord
                                    else:
                                        if expected_chord == current_chord:
                                            if closest_timestamp > timestamp:
                                                feedback['status'] = 'too_early'
                                                feedback['message'] = f'BAD! Too early! Expected at {closest_timestamp:.2f}'
                                            else:
                                                feedback['status'] = 'too_late'
                                                feedback['message'] = f'BAD! Too late! Expected at {closest_timestamp:.2f}'
                                        else:
                                            feedback['status'] = 'wrong'
                                            feedback['message'] = f'BAD! Wrong chord {current_chord} instead of {expected_chord}'
                                            feedback['expected_chord'] = expected_chord
                                    
                                    feedback['expected_time'] = closest_timestamp
                            
                            await websocket.send_json(feedback)
                
                except Exception as e:
                    await websocket.send_json({
                        'type': 'error',
                        'message': f'Error processing audio: {str(e)}'
                    })
            
            elif 'text' in message:
                # Handle control messages
                data = json.loads(message['text'])
                if data.get('type') == 'stop':
                    break
    
    except WebSocketDisconnect:
        print(f"WebSocket disconnected normally for connection {connection_id}")
    except Exception as e:
        print(f"WebSocket error: {e}")
        import traceback
        traceback.print_exc()
        try:
            await websocket.send_json({
                'type': 'error',
                'message': f'WebSocket error: {str(e)}'
            })
        except:
            pass
    finally:
        # Cleanup
        if connection_id in active_connections:
            del active_connections[connection_id]
            print(f"Cleaned up connection {connection_id}")

