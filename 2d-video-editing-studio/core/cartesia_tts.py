#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""core/cartesia_tts.py — Direct High-Speed Cartesia Sonic Voiceover Engine.
Generates broadcast-quality voiceover audio (WAV 44.1kHz) with ~1s latency,
full emotion styling (Neutral, Calm, Content, Excited, Sad, Angry), and
curated top-tier voices (Rohan, Dev, Neha, Anuj, Skylar, Mariana).
"""

import os
import sys
import json
import time
import argparse
import urllib.request
import urllib.error
import subprocess

DEFAULT_API_KEY = os.environ.get("CARTESIA_API_KEY", "")
API_VERSION = "2024-06-10"
BASE_URL = "https://api.cartesia.ai"

# Top Recommended Standard Public Voice Characters
POPULAR_VOICES = {
    # Recommended Primary Voices (Public Cartesia Library)
    "rohan": "4877b818-c7fe-4c89-b1cf-eadf8e23da72",    # Rohan - Steady Communicator (Hindi Male)
    "dev": "910fb75e-1d20-4840-ac63-ac6b26a71bdc",      # Dev - Friendly Host (Hindi Male)
    "neha": "47f3bbb1-e98f-4e0c-92c5-5f0325e1e206",     # Neha - Virtual Assistant (Hindi Female)
    "anuj": "7e8cb11d-37af-476b-ab8f-25da99b18644",     # Anuj - Engaging Narrator (Hindi Male)
    "skylar": "db6b0ed5-d5d3-463d-ae85-518a07d3c2b4",   # Skylar - Friendly Guide (English Female)
    "mariana": "ae823354-f9be-4aef-8543-f569644136b4",  # Mariana - Nurturing Guide (Multilingual)
    
    # Secondary Voices
    "siya": "4459a9a5-69d6-4680-b970-e13dc51845b6",     # Siya - Bright Conversationalist
    "sana": "e6b71342-48f1-4c70-a13a-d197b176ff24",     # Sana - Friendly Concierge
    "varun": "4cd9f881-58f7-4969-876a-00983214c362",    # Varun - Query Resolver
    "sneha": "6b02ffe5-e3cb-48c0-a023-c72f85953375",    # Sneha - Empathetic Voice
    "kavya": "ce45ddca-5f4b-4047-ada3-3fce2bc78acd",    # Kavya - Clear Briefing
    "barbershop": "a0e99841-438c-4a64-b679-ae501e7d6091",# Barbershop Man (English)
    "british": "79a125e8-cd45-4c13-8a67-188112f4dd22"   # British Narrator
}

# Optional user-configured cloned voice loaded securely from environment variable
if os.environ.get("CARTESIA_CUSTOM_VOICE_ID"):
    POPULAR_VOICES["custom"] = os.environ.get("CARTESIA_CUSTOM_VOICE_ID").strip()

# Emotion Mappings to Cartesia Canonical Controls
EMOTION_MAP = {
    "neutral": [],
    "calm": ["curiosity:low", "positivity:low"],
    "content": ["positivity:high"],
    "excited": ["surprise:high", "positivity:high"],
    "sad": ["sadness:high"],
    "angry": ["anger:high"],
    "curious": ["curiosity:high"],
    "dramatic": ["surprise:high"],
    "urgent": ["anger:medium", "surprise:medium"]
}

def resolve_voice_id(name_or_id: str, api_key: str = None) -> str:
    key = name_or_id.strip().lower()
    if key in POPULAR_VOICES:
        return POPULAR_VOICES[key]
    if len(name_or_id) == 36 and name_or_id.count("-") == 4:
        return name_or_id
    
    api_key = api_key or DEFAULT_API_KEY
    try:
        req = urllib.request.Request(f"{BASE_URL}/voices", headers={
            "X-API-Key": api_key,
            "Cartesia-Version": API_VERSION
        })
        with urllib.request.urlopen(req, timeout=5) as resp:
            voices = json.loads(resp.read().decode())
            for v in voices:
                if key in v.get("name", "").lower():
                    return v.get("id")
    except Exception:
        pass
    return POPULAR_VOICES["rohan"]

def resolve_emotions(emotion: str):
    if not emotion:
        return []
    em_clean = emotion.strip().lower()
    if em_clean in EMOTION_MAP:
        return EMOTION_MAP[em_clean]
    # Check if raw Cartesia format like "positivity:high" or "anger:low"
    if ":" in em_clean:
        return [em_clean]
    return []

def generate_voiceover(
    transcript: str,
    voice: str = "rohan",
    language: str = "hi",
    emotion: str = "neutral",
    output_path: str = "VO.wav",
    model: str = "sonic-3.6",
    sample_rate: int = 44100,
    api_key: str = None
) -> dict:
    api_key = api_key or DEFAULT_API_KEY
    if not api_key:
        raise ValueError("Missing Cartesia API Key. Please provide api_key or set CARTESIA_API_KEY.")
    
    voice_id = resolve_voice_id(voice, api_key=api_key)
    emotion_tags = resolve_emotions(emotion)
    
    voice_dict = {
        "mode": "id",
        "id": voice_id
    }
    if emotion_tags:
        voice_dict["__experimental_controls"] = {
            "emotion": emotion_tags
        }
        
    payload = {
        "model_id": model,
        "transcript": transcript.strip(),
        "voice": voice_dict,
        "output_format": {
            "container": "wav",
            "encoding": "pcm_s16le",
            "sample_rate": sample_rate
        }
    }
    if language:
        payload["language"] = language
    
    t0 = time.time()
    req = urllib.request.Request(
        f"{BASE_URL}/tts/bytes",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "X-API-Key": api_key,
            "Cartesia-Version": API_VERSION,
            "Content-Type": "application/json"
        }
    )
    
    with urllib.request.urlopen(req, timeout=45) as resp:
        audio_bytes = resp.read()
    
    gen_time = time.time() - t0
    
    out_dir = os.path.dirname(output_path)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
    with open(output_path, "wb") as f:
        f.write(audio_bytes)
    
    duration = 0.0
    try:
        dur_out = subprocess.run([
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", output_path
        ], capture_output=True, text=True).stdout.strip()
        duration = float(dur_out)
    except Exception:
        pass
    
    return {
        "status": "success",
        "output_path": os.path.abspath(output_path),
        "duration_seconds": round(duration, 2),
        "generation_time_seconds": round(gen_time, 2),
        "voice_id": voice_id,
        "voice_name": voice,
        "emotion": emotion,
        "applied_emotion_tags": emotion_tags,
        "model": model,
        "bytes": len(audio_bytes)
    }

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Cartesia TTS CLI with Emotion Control")
    parser.add_argument("--text", type=str, help="Text to speak")
    parser.add_argument("--file", type=str, help="Script text file")
    parser.add_argument("--out", type=str, default="VO.wav", help="Output WAV path (default: VO.wav)")
    parser.add_argument("--voice", type=str, default="rohan", help="Voice: rohan, dev, neha, anuj, skylar, mariana (default: rohan)")
    parser.add_argument("--lang", type=str, default="hi", help="Language code (default: hi)")
    parser.add_argument("--emotion", type=str, default="neutral", choices=["neutral", "calm", "content", "excited", "sad", "angry", "curious", "dramatic"], help="Emotion control")
    parser.add_argument("--model", type=str, default="sonic-3.6", help="Model ID (default: sonic-3.6)")
    
    args = parser.parse_args()
    
    text = args.text
    if args.file and os.path.exists(args.file):
        with open(args.file, "r", encoding="utf-8") as f:
            text = f.read()
    
    if not text:
        print("Error: Please provide --text \"...\" or --file script.txt")
        sys.exit(1)
    
    print(f"Generating voiceover via Cartesia ({args.voice}, emotion={args.emotion}, lang={args.lang})...")
    res = generate_voiceover(text, voice=args.voice, language=args.lang, emotion=args.emotion, output_path=args.out, model=args.model)
    print(f"✓ Saved: {res['output_path']}")
    print(f"✓ Audio Duration: {res['duration_seconds']}s (Generated in {res['generation_time_seconds']}s | Emotion: {args.emotion})")
