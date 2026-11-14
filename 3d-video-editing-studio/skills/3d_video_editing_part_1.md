---
name: 3D Video Editing Part 1
description: Master Autonomous 3D Video Director & Production Engine (Part 1 - Faceless Shorts): 100% Code-Driven 3D & 2D (Three.js, SDF raymarching, Kokoro-82M neural TTS, Whisper alignment). 6 Styles: Deep Dive 3D (Zack D. Films style), Night File 3D (unsolved mystery), Inside Out, Stick Story, Paper Atlas, Tall Tale 3D. Anti-LMK Shield, High-Speed Render Presets (--fast, --turbo, --1080p), $0 Cost, Zero Generative AI Morphing.
version: 1.0.0
---

# 3D Video Editing Part 1 (Faceless Shorts Engine)

> 🎬 **Executive Role**: Senior 3D Video Editor, Motion Designer & Technical Production Director.
> 💰 **100% Free ($0)**: 100% Code-driven 3D & 2D vertical explainer videos. Zero AI image/video generation, zero third-party API keys, zero cloud credits.

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

## 🛡️ Anti-Offline Server & Anti-LMK Shield

`tools/capture.mjs` and `core/engine.js` feature a **built-in, hardcoded Anti-LMK shield** that automatically activates on Android (Termux), mobile devices, and low-RAM systems (<= 6GB RAM):
- **Single-Process Chrome & `/dev/shm` Bypass**: Prevents shared memory overflow and Termux permission faults (`--disable-dev-shm-usage`, `--no-sandbox`, `--single-process`).
- **Active V8 Garbage Collection Purge**: Periodically triggers `window.gc()`, keeping memory flat **< 150 MB** throughout the entire 1,000+ frame render.
- **Adaptive Resolution + Lanczos Upscaling**: Renders WebGL at `res=0.55`, `aa=0`, `shadow=1024` (cutting WebGL memory by 75%) and upscales to pristine 1080x1920 Full HD via FFmpeg.
- **Zero Crash Guarantee**: Completely prevents the "offline server" disconnection error on AntiGem mobile.

---

## 🏎️ High-Speed Rendering Presets

```bash
# Recommended Mobile Render (720p HD, < 140MB RAM, zero offline error):
node tools/capture.mjs video renders/master.mp4 --fast

# Super-Fast Draft Mode (45-55 FPS — rapid iterative review):
node tools/capture.mjs video renders/master.mp4 --turbo

# Full 1080p Master Export:
node tools/capture.mjs video renders/master.mp4 --1080p
```

---

## 🛠️ Step 0: Mandatory Pre-Flight Setup

Verify all prerequisites (Node.js, FFmpeg, Python virtualenv with Kokoro & Whisper, neural weights):
```bash
bash skills/faceless-shorts/scripts/setup.sh
bash skills/faceless-shorts/scripts/selftest.sh
```

---

## 🚀 Complete Step-by-Step Production Workflow

1. **Scaffold Project**:
   ```bash
   bash skills/faceless-shorts/scripts/new_video.sh deep-dive ~/faceless-shorts/my-first-short
   cd ~/faceless-shorts/my-first-short
   ```
2. **Synthesize Voice & Align Words**:
   ```bash
   skills/faceless-shorts/scripts/py skills/faceless-shorts/scripts/voice.py . --voice am_michael
   skills/faceless-shorts/scripts/py skills/faceless-shorts/scripts/words.py .
   ```
3. **Storyboard QA Contact Sheet**:
   ```bash
   node tools/capture.mjs check
   node tools/capture.mjs cues
   skills/faceless-shorts/scripts/py tools/mix.py .
   node tools/capture.mjs sheet review/all.jpg 0.5 10
   ```
4. **Render Master Video**:
   ```bash
   node tools/capture.mjs video renders/master.mp4 --fast
   ```
