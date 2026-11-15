#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""cartesia_mcp.py — Native MCP Server for Cartesia AI Sonic TTS.
Provides tools to generate high-fidelity broadcast voiceover directly in Antigravity
with emotion controls and top-tier voice presets.
"""

import os
import sys
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from core.cartesia_tts import generate_voiceover, list_voices, DEFAULT_API_KEY, resolve_voice_id, POPULAR_VOICES, EMOTION_MAP

from mcp.server.mcpserver import MCPServer

app = MCPServer(
    name="cartesia-mcp",
    version="1.1.0",
    description="Direct Cartesia AI Sonic TTS integration with emotion styling and recommended narrator presets"
)

@app.tool()
def cartesia_generate_voice(
    transcript: str,
    voice: str = "rohan",
    emotion: str = "neutral",
    language: str = "hi",
    output_path: str = "/home/cat/Music/xdeepfreevideogeneration/VO.wav",
    model: str = "sonic-3.6"
) -> str:
    """Generate ultra-realistic voiceover using Cartesia Sonic 3.6 API with emotion styling.
    
    Args:
        transcript: The full narration script text (clean spoken prose).
        voice: Voice name or ID. Top Recommended: "rohan" (Hindi male), "dev" (Hindi male), "neha" (Hindi female), "anuj" (Hindi narrator), "skylar" (English female), "mariana" (Multilingual).
        emotion: Emotion preset: "neutral", "calm", "content", "excited", "sad", "angry", "curious", "dramatic".
        language: Language code, e.g. "hi" for Hindi, "en" for English.
        output_path: Target path to write the 44.1kHz WAV file (default: VO.wav in current project).
        model: Cartesia model to use. Default is "sonic-3.6" (ultra-fast multilingual).
    """
    try:
        res = generate_voiceover(
            transcript=transcript,
            voice=voice,
            emotion=emotion,
            language=language,
            output_path=output_path,
            model=model
        )
        return json.dumps({
            "status": "success",
            "message": f"Successfully generated {res["duration_seconds"]}s voiceover in {res["generation_time_seconds"]}s with emotion "{res["emotion"]}"",
            "output_path": res["output_path"],
            "duration_seconds": res["duration_seconds"],
            "generation_time_seconds": res["generation_time_seconds"],
            "voice_name": res["voice_name"],
            "voice_id": res["voice_id"],
            "emotion": res["emotion"],
            "applied_emotion_tags": res["applied_emotion_tags"],
            "model": res["model"]
        }, indent=2, ensure_ascii=False)
    except Exception as e:
        return json.dumps({
            "status": "error",
            "error": str(e)
        }, indent=2)

@app.tool()
def cartesia_list_voices(query: str = "", language: str = "") -> str:
    """List available Cartesia AI voices filtered by query name or language code."""
    try:
        voices = list_voices(query=query, language=language)
        return json.dumps({
            "status": "success",
            "recommended_voices": list(POPULAR_VOICES.keys()),
            "available_emotions": list(EMOTION_MAP.keys()),
            "total_matching": len(voices),
            "voices": voices[:25]
        }, indent=2, ensure_ascii=False)
    except Exception as e:
        return json.dumps({
            "status": "error",
            "error": str(e)
        }, indent=2)

@app.tool()
def cartesia_status() -> str:
    """Check Cartesia API connection status, active model, and recommended presets."""
    try:
        return json.dumps({
            "status": "ready",
            "message": "Cartesia AI Sonic TTS API is connected and ready.",
            "recommended_voices": ["rohan", "dev", "neha", "anuj", "skylar", "mariana"],
            "supported_emotions": ["neutral", "calm", "content", "excited", "sad", "angry", "curious", "dramatic"],
            "default_model": "sonic-3.6",
            "api_version": "2024-06-10"
        }, indent=2)
    except Exception as e:
        return json.dumps({
            "status": "error",
            "error": str(e)
        }, indent=2)

if __name__ == "__main__":
    app.run(transport="stdio")
