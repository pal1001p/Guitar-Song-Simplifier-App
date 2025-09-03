#!/usr/bin/env python3
"""
Test script for the Guitar Song Simplifier API
"""
import requests
import json
import sys
import os

# API base URL
BASE_URL = "http://localhost:8000"

def test_health():
    """Test the health check endpoint"""
    try:
        response = requests.get(f"{BASE_URL}/health")
        print(f"Health check: {response.status_code}")
        print(f"Response: {response.json()}")
        return response.status_code == 200
    except Exception as e:
        print(f"Health check failed: {e}")
        return False

def test_root():
    """Test the root endpoint"""
    try:
        response = requests.get(f"{BASE_URL}/")
        print(f"Root endpoint: {response.status_code}")
        print(f"Response: {response.json()}")
        return response.status_code == 200
    except Exception as e:
        print(f"Root endpoint failed: {e}")
        return False

def test_audio_analysis(audio_file_path):
    """Test the audio analysis endpoint"""
    try:
        with open(audio_file_path, 'rb') as f:
            files = {'file': (os.path.basename(audio_file_path), f, 'audio/wav')}
            response = requests.post(f"{BASE_URL}/analyze-audio/", files=files)
        
        print(f"Audio analysis: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print(f"Tempo: {result.get('tempo', 'N/A')} BPM")
            print(f"Duration: {result.get('audio_duration', 'N/A')} seconds")
            print(f"Beats: {result.get('beat_count', 0)} beats detected")
            return True
        else:
            print(f"Error: {response.text}")
            return False
    except Exception as e:
        print(f"Audio analysis failed: {e}")
        return False

def test_chord_analysis(audio_file_path):
    """Test the chord analysis endpoint"""
    try:
        with open(audio_file_path, 'rb') as f:
            files = {'file': (os.path.basename(audio_file_path), f, 'audio/wav')}
            response = requests.post(f"{BASE_URL}/analyze-chords/", files=files)
        
        print(f"Chord analysis: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print(f"Chords: {result.get('chord_count', 0)} detected")
            print(f"Unique chords: {result.get('unique_chords', [])}")
            return True
        else:
            print(f"Error: {response.text}")
            return False
    except Exception as e:
        print(f"Chord analysis failed: {e}")
        return False

def main():
    print("Testing Guitar Song Simplifier API...")
    print("=" * 50)
    
    # Test basic endpoints
    health_ok = test_health()
    root_ok = test_root()
    
    print("\n" + "=" * 50)
    
    # Test audio analysis if file provided
    if len(sys.argv) > 1:
        audio_file = sys.argv[1]
        print(f"Testing audio analysis with file: {audio_file}")
        audio_ok = test_audio_analysis(audio_file)
        
        print("\n" + "=" * 50)
        print(f"Testing chord analysis with file: {audio_file}")
        chord_ok = test_chord_analysis(audio_file)
    else:
        print("No audio file provided. Skipping audio and chord analysis tests.")
        print("Usage: python test_api.py <path_to_audio_file>")
        audio_ok = True
        chord_ok = True
    
    print("\n" + "=" * 50)
    print("Test Summary:")
    print(f"Health check: {'✓' if health_ok else '✗'}")
    print(f"Root endpoint: {'✓' if root_ok else '✗'}")
    print(f"Audio analysis: {'✓' if audio_ok else '✗'}")
    print(f"Chord analysis: {'✓' if chord_ok else '✗'}")

if __name__ == "__main__":
    main() 