---
name: 3d-video-editing-part-1
description: Autonomous 3D Video Director & Production Engine (Part 1 - Faceless Shorts): 100% Code-Driven 3D & 2D (Three.js, SDF raymarching, Kokoro-82M neural TTS, Whisper alignment, NumPy/SciPy audio). 6 Styles: Deep Dive 3D (Zack D. Films style), Night File 3D (unsolved mystery), Inside Out, Stick Story, Paper Atlas, Tall Tale 3D. Anti-LMK Shield, High-Speed Render Presets (--fast, --turbo, --1080p), $0 Cost, Zero Generative AI Morphing, Zero Third-Party API Keys. No need to look up or request external main.js files; everything is fully self-contained.
version: 1.1.0
---

# 🎬 3D Video Editing Studio (Part 1 — Faceless Shorts Engine) v1.1.0

> 🚀 **Executive Director**: Senior 3D Motion Designer, Technical Director & Animation Engineer.
> 💰 **100% Free & Code-Driven ($0)**: Generates complete vertical YouTube Shorts, Instagram Reels, and TikToks using Three.js, WebGL, Kokoro neural TTS, and Faster-Whisper.
> 🛡️ **Anti-LMK / Zero Offline Shield**: Micro-yields and single-process headless Chrome rendering maintain RAM < 140MB with zero disconnects on Android (Termux) and Desktop.
> ⚡ **Zero External Dependency Law**: Everything is self-contained. The agent NEVER asks the user for `@skills/faceless-shorts/styles/.../main.js`. The template provides `main.js` automatically.

---

## 🌟 The 6 Flagship Visual Styles

| Style | Aesthetic & Visual Language | Narrative Genre | Default Duration & Aspect |
|---|---|---|---|
| **Deep Dive 3D** (`deep-dive`) | **The Flagship (Zack D. Films style)**: Sculpted 3D people in warm sunlit sets, glowing cyan x-ray anatomy, macro blood vessel journeys, shallow focus, continuous camera movement. | Biology, medical, physiology, bodily "what happens if" | 30–45 s · 9:16 |
| **Night File 3D** (`night-file`) | **Unsolved Mysteries & True Crime Noir**: Single-light chiaroscuro, glowing red subject spotlight, typewriter evidence dates, case files, retro polaroids. | True crime, unsolved mysteries, cold cases | 30–45 s · 9:16 |
| **Tall Tale 3D** (`tall-tale`) | **Humorous & Quirky True Stories**: Expressive 2D cartoon characters emoting on every beat inside a warm, sunlit 3D miniature town, rapid 1-word captions. | Funny true stories, loopholes, bizarre cons | 40–60 s · 9:16 |
| **Inside Out** (`inside-out`) | **Flat 2D Vector X-Ray**: Clean minimalist anatomy, bold 1-3 word captions, punchy cuts every 1.5–3s. | Fast 2D bodily & scientific explainers | 25–40 s · 9:16 |
| **Stick Story** (`stick-story`) | **Tactical Survival & Life Hacks**: Ink-black stick figures with emotive eyes, day/night rooms, gold numbered step cards. | Survival protocols, emergency hacks | 30–45 s · 9:16 |
| **Paper Atlas** (`paper-atlas`) | **Grand History in Cut Paper**: Tactile parchment maps, crimson routes, wax seals, gold ribbons, historical figures. | Historical events, battles, expeditions | 30–45 s · 9:16 |

---

## 🏎️ 1-Command Autopilot & High-Speed Presets

```bash
# 1-Command Autopilot Production:
python3 studio.py autopilot ~/faceless-shorts/my-short --fast

# Or Step-by-Step Production:
python3 studio.py new tall-tale ~/faceless-shorts/my-tall-tale
cd ~/faceless-shorts/my-tall-tale
python3 studio.py voice . --voice am_michael
python3 studio.py words .
python3 studio.py mix .
python3 studio.py sheet .
python3 studio.py render . --fast
```

### Rendering Presets:
- `python3 studio.py render . --fast`: **720p HD mobile default (20–30 FPS)**, flat RAM < 140MB, zero offline server disconnection error.
- `python3 studio.py render . --turbo`: **540p ultrafast draft (45–55 FPS)** for instant iterative previews.
- `python3 studio.py render . --1080p`: Full 1080p HD broadcast master export.
