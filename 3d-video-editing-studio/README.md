# Stickman Video Editing Studio (Stick Story Engine)

> 🏃 **Deepesh Stickman Studio**: 100% Code-Driven 9:16 Vertical Stickman Explainer Videos (Tactical Survival, Life Hacks, Dilemmas, Storytelling).
> 💰 **100% Free ($0)**: Local Kokoro Neural TTS, Local Whisper Alignment, Canvas & Three.js Engine, Headless Chrome Capture, FFmpeg. Zero API keys, zero cloud credits.
> 🛡️ **Anti-LMK Shield**: Micro-yields and single-process headless Chrome rendering maintain RAM < 140MB with zero disconnects on Android (Termux) and Desktop.

---

## 🌟 Visual Style: Stick Story

- **Aesthetic**: Ink-black stick figures whose large white acting eyes do the acting (`calm`, `happy`, `worried`, `scared`, `determined`, `sleepy`).
- **Atmosphere**: Flat illustrated rooms (living room, kitchen, hallway) in both day and night versions.
- **Night Glow**: Figures receive a soft warm silhouette glow (`glow: true`) to pop against dark backgrounds.
- **Gold Step Cards**: Bold gold numbered cards (`K.stepCard(n, 'LABEL')`) popping in on each step.
- **Visual Cues**: Red warning crosses for bad choices, green checks for smart solutions.
- **Word-Synced Captions**: Centered sentence-case captions on dark rounded plates with gold highlighted keywords (`y: 1690`).
- **Timing & Ratio**: 30–45 seconds · 9:16 vertical widescreen (Shorts, Reels, TikTok).

---

## 🚀 Quickstart

1. **Scaffold a New Stickman Video**:
   ```bash
   python3 studio.py new stick-story ~/faceless-shorts/my-stick-short
   cd ~/faceless-shorts/my-stick-short
   ```
2. **Synthesize Voice & Align Words**:
   ```bash
   python3 studio.py voice . --voice am_puck
   python3 studio.py words .
   ```
3. **Sound Mix & Foley**:
   ```bash
   python3 studio.py mix .
   ```
4. **Visual Contact Sheet QA**:
   ```bash
   python3 studio.py sheet .
   ```
5. **Render Master MP4**:
   ```bash
   python3 studio.py render . --fast
   ```

### 🏎️ 1-Command Autopilot:
```bash
python3 studio.py autopilot ~/faceless-shorts/my-stick-short --fast
```

---

## 📱 Hardcoded Mobile & Anti-LMK Protection

`tools/capture.mjs` and `core/engine.js` feature a **built-in, hardcoded Anti-LMK shield** that automatically activates on Android (Termux) and low-RAM systems:
- **Single-process Chrome & `/dev/shm` bypass**: Prevents shared memory overflow and Termux permission faults (`--disable-dev-shm-usage`, `--no-sandbox`, `--single-process`).
- **Active V8 garbage collection purge**: Keeps memory flat **< 140 MB** throughout long renders.
- **Adaptive resolution + Lanczos upscaling**: Renders smoothly and upscales to pristine 1080x1920 Full HD via FFmpeg.
- **Zero crash guarantee**: Completely prevents the "offline server" disconnection error on AntiGem mobile.
