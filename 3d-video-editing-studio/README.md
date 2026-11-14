# Faceless Shorts 3D — Autonomous Video Director & Production Engine

> 🎬 **Deepesh 3D Studio**: 100% Code-Driven 3D & 2D Vertical Explainer Videos (Zack D. Films style, True Crime Noir, Quirky Storytime, Flat Vector X-Ray, Survival Steps, Cut-Paper History).
> 💰 **100% Free ($0)**: Local Kokoro Neural TTS, Local Whisper Alignment, Three.js 3D Engine, Headless Chrome Capture, FFmpeg. Zero API keys, zero cloud credits.

---

## 🌟 The 6 Flagship Styles

| Style | Aesthetic & Concept | Default Runtime & Ratio |
|---|---|---|
| **Deep Dive 3D** (`deep-dive`) | **The Flagship (Zack D. Films style)**: Sculpted 3D people in warm sunlit sets, glowing cyan x-ray anatomy, macro blood vessel journeys, shallow focus, continuous camera movement. | 30–45 s · 9:16 |
| **Night File 3D** (`night-file`) | **Unsolved Mysteries & True Crime Noir**: Single-light chiaroscuro, glowing red subject spotlight, typewriter evidence dates, case files, retro polaroids. | 30–45 s · 9:16 |
| **Tall Tale 3D** (`tall-tale`) | **Humorous & Quirky True Stories**: Expressive 2D cartoon characters emoting on every beat inside a warm, sunlit 3D miniature town, rapid 1-word captions. | 40–60 s · 9:16 |
| **Inside Out** (`inside-out`) | **Flat 2D Vector X-Ray**: Clean minimalist anatomy, bold 1-3 word captions, punchy cuts every 1.5–3s. | 25–40 s · 9:16 |
| **Stick Story** (`stick-story`) | **Tactical Survival & Life Hacks**: Ink-black stick figures with emotive eyes, day/night rooms, gold numbered step cards. | 30–45 s · 9:16 |
| **Paper Atlas** (`paper-atlas`) | **Grand History in Cut Paper**: Tactile parchment maps, crimson routes, wax seals, gold ribbons, historical figures. | 30–45 s · 9:16 |

---

## 🚀 Quickstart

1. **One-Time Environment Setup**:
   ```bash
   bash skills/faceless-shorts/scripts/setup.sh
   ```
2. **Verify Setup**:
   ```bash
   bash skills/faceless-shorts/scripts/selftest.sh
   ```
3. **Scaffold a New Video**:
   ```bash
   bash skills/faceless-shorts/scripts/new_video.sh deep-dive ~/faceless-shorts/my-first-short
   cd ~/faceless-shorts/my-first-short
   ```
4. **Synthesize Voice & Align Words**:
   ```bash
   skills/faceless-shorts/scripts/py skills/faceless-shorts/scripts/voice.py . --voice am_michael
   skills/faceless-shorts/scripts/py skills/faceless-shorts/scripts/words.py .
   ```
5. **QA & Render Master MP4**:
   ```bash
   node tools/capture.mjs check
   node tools/capture.mjs cues
   skills/faceless-shorts/scripts/py tools/mix.py .
   node tools/capture.mjs sheet review/all.jpg 0.5 10
   node tools/capture.mjs video renders/master.mp4
   ```

---

## 📱 Hardcoded Mobile & Anti-LMK Protection

`tools/capture.mjs` and `core/engine.js` feature a **built-in, hardcoded Anti-LMK shield** that automatically activates on Android (Termux), mobile devices, and low-RAM systems (<= 6GB RAM):
- **Single-process Chrome & `/dev/shm` bypass**: Prevents shared memory overflow and Termux permission faults (`--disable-dev-shm-usage`, `--no-sandbox`, `--single-process`).
- **Active V8 garbage collection purge**: Periodically triggers `window.gc()`, keeping memory flat **< 150 MB** throughout the entire 1,000+ frame render.
- **Adaptive resolution + Lanczos 1080p upscaling**: Renders WebGL at `res=0.55`, `aa=0`, `shadow=1024` (cutting WebGL memory by 75%) and upscales to pristine 1080x1920 Full HD via FFmpeg.
- **Zero crash guarantee**: Completely prevents the "offline server" disconnection error on AntiGem mobile.

---

## 📖 Directorial & Agent Laws

Read [AGENTS.md](file:///home/cat/Downloads/faceless-shorts-plugin/AGENTS.md) for the universal agent laws, the strict 7-step intake protocol, camera mathematics, optical depth of field guidelines, and the compulsory QA contact sheet protocol.
