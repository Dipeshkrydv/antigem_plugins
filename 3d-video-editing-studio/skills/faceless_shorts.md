---
name: faceless-shorts
description: Make narrated faceless YouTube Shorts / TikToks / Reels fully in code on the user's computer, with a free local AI voice and word-synced captions, $0. Six styles - Deep Dive 3D (Zack D. Films-like 3D "what happens if" body/science explainers), Night File 3D (unsolved mysteries, true crime), Inside Out (flat 2D x-ray explainers), Stick Story (stick-figure "what would you do if" survival steps), Paper Atlas (history in cut paper with maps), Tall Tale 3D (funny true stories with flat 2D cartoon people in a sunny 3D world, one-word captions).
version: 1.0.0
---

# Faceless Shorts Production Skill

Turn any topic, question, or script into a finished vertical 9:16 short using 100% deterministic code:
- **Zero API Cost**: Local neural Kokoro TTS, local Whisper word-sync, Three.js 3D/2D animation, procedural SciPy/NumPy audio mix.
- **6 Flagship Styles**: Deep Dive 3D, Night File 3D, Inside Out, Stick Story, Paper Atlas, Tall Tale 3D.
- **Direct Directorial Framework**: 3-Act Energy Arc with Signature Hero Visual Beat at ~65%.
- **Anti-LMK & Anti-Offline Server Shield**: Flat RAM < 140MB, single-process Chrome capture, scheduled V8 garbage collection.

## Commands
```bash
# Setup:
bash skills/faceless-shorts/scripts/setup.sh

# New Project:
bash skills/faceless-shorts/scripts/new_video.sh <style> ~/faceless-shorts/<name>

# Voice & Timing:
skills/faceless-shorts/scripts/py skills/faceless-shorts/scripts/voice.py . --voice am_michael
skills/faceless-shorts/scripts/py skills/faceless-shorts/scripts/words.py .

# QA & Render:
node tools/capture.mjs sheet review/all.jpg 0.5 10
node tools/capture.mjs video renders/master.mp4 --fast
```
