---
name: Stick Story Stickman Explainer
description: Tactical survival, life hacks, dilemma decisions, and storytelling shorts featuring expressive stick figures with acting eyes, flat illustrated rooms (day/night), gold numbered step cards, and word-synced captions.
version: 1.2.0
---

# Stick Story: Stickman Survival & Storytelling Explainer

> 🏃 **Genre**: Tactical survival steps, life hacks, "What would you do if...?", psychological dilemmas, and clever storytelling shorts.
> ⏱️ **Default Timing**: 30–45 seconds · 9:16 vertical shorts (TikTok, Reels, YouTube Shorts).
> 💰 **100% Free & Code-Driven ($0)**: Canvas 2D + WebGL, local Kokoro neural voiceover, local Whisper word alignment, procedural sound and music.

## Visual Language & Directorial Rules
- **Ink-Black Stick Figures**: Bold black ink stick people whose large white acting eyes do the acting (`mood`: 'calm', 'happy', 'worried', 'scared', 'determined', 'sleepy').
- **Soft Warm Glow at Night**: Figures receive a soft warm outline glow (`glow: true`) to pop against dark night backgrounds.
- **Flat Illustrated Rooms**: Stylized day and night environments (living room, kitchen, hallway) with clean furniture (couch, lamp, fridge, plant, window).
- **Gold Numbered Step Cards**: High-impact gold cards (`K.stepCard(n, 'LABEL', x, y, scale)`) popping in on each step.
- **Red Danger & Green Safe Cues**: Red warning crosses for bad choices, green checks for smart solutions.
- **Word-Synced Captions**: Centered sentence-case captions on dark rounded plates with gold highlighted keywords (`y: 1690`).
- **One Picture Per Clause**: Dynamic visual cuts every 1.5–3 seconds; eyes react first, then body action follows.

## Direct CLI Production
```bash
python3 studio.py new stick-story ~/faceless-shorts/my-stick-short
cd ~/faceless-shorts/my-stick-short
python3 studio.py voice . --voice am_puck
python3 studio.py words .
python3 studio.py mix .
python3 studio.py sheet .
python3 studio.py render . --fast
```
