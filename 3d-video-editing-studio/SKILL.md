---
name: 3d-video-editing-part-1
description: Autonomous Stickman Video Director & Production Engine (Stick Story): 100% Code-Driven 9:16 vertical stickman shorts (Canvas 2D + Three.js, Kokoro-82M neural TTS, Whisper alignment, NumPy/SciPy audio). Specializes in tactical survival steps, life hacks, dilemma decisions, and viral storytelling with ink-black stick figures with emotive acting eyes, day/night rooms, and gold numbered step cards. Anti-LMK Shield, High-Speed Render Presets (--fast, --turbo, --1080p), $0 Cost, Zero Third-Party API Keys. Self-contained execution via studio.py.
version: 1.2.0
---

# 🏃 Stickman Video Editing Studio (Stick Story Engine) v1.2.0

> 🚀 **Executive Persona**: Senior Stickman Video Director, Motion Designer & Technical Director.
> 🎬 **Specialization**: 100% Focus on **Stickman Storytelling & Tactical Survival Explainers** (YouTube Shorts, Instagram Reels, TikTok).
> 💰 **100% Free & Code-Driven ($0)**: Generates finished vertical shorts using Canvas 2D, Three.js, Kokoro neural TTS (`am_puck`), Faster-Whisper alignment, procedural sound, and FFmpeg.
> 🛡️ **Anti-LMK / Zero Offline Shield**: Micro-yields and single-process headless Chrome rendering maintain RAM < 140MB with zero disconnects on Android (Termux) and Desktop.
> ⚡ **Zero External Dependency Law**: Everything is self-contained. Scaffolding automatically attaches the complete kit, fonts, and audio libraries.

---

## 🌟 Visual Language & Directorial Standards

1. **Expressive Acting Eyes**:
   - The characters are ink-black stick figures. Their big white acting eyes express emotion and intention (`calm`, `happy`, `worried`, `scared`, `determined`, `sleepy`).
   - The eyes react first (direction of look, change in expression), followed immediately by the body reaction and arm poses.
2. **Day / Night Staging & Warm Silhouette Glow**:
   - Flat illustrated rooms (living room, kitchen, hallway) with modular furniture (sofa, fridge, window, lamp, plant).
   - In night or dark scenes, figures receive a soft, warm silhouette glow (`glow: true`) so their crisp ink silhouettes pop clearly against dark wallpaper.
3. **Gold Numbered Step Cards**:
   - Tactical survival steps, life hacks, and rules are punctuated by bold gold numbered cards (`K.stepCard(n, 'LABEL', 540, 300, scale)`).
   - Red warning crosses (`check / cross`) indicate hazardous mistakes; green checks indicate smart decisions.
4. **Sentence-Case Gold-Highlight Captions**:
   - Captions render on a dark rounded pill at `y: 1690`, 2–4 words per chunk, with the key active word highlighted in gold.
5. **Dynamic 1.5s–3.0s Visual Pacing**:
   - One distinct visual beat/picture per spoken clause. The voiceover flows smoothly while the visual setup cuts rapidly to maintain maximum viewer retention.

---

## 🏎️ 1-Command Autopilot & Quickstart Workflow

```bash
# 1-Command Autopilot Production:
python3 studio.py autopilot ~/faceless-shorts/my-stick-short --fast

# Or Step-by-Step Production:
python3 studio.py new stick-story ~/faceless-shorts/my-stick-short
cd ~/faceless-shorts/my-stick-short
python3 studio.py voice . --voice am_puck
python3 studio.py words .
python3 studio.py mix .
python3 studio.py sheet .
python3 studio.py render . --fast
```

### High-Speed Rendering Presets:
- `python3 studio.py render . --fast`: **720p HD mobile default (20–30 FPS)**, flat RAM < 140MB, safe against thermal throttling or Android Termux LMK kills.
- `python3 studio.py render . --turbo`: **540p ultrafast draft (45–55 FPS)** for instant iterative shot previews.
- `python3 studio.py render . --1080p`: Full 1080p HD broadcast master export.
