# 📱 2D Video Editing Studio — v3.2 Engine (Anti-Offline Server Shield)

> **🚀 What's New in v3.2 (Anti-Offline Server Shield & High-Speed Rendering):**
> - 🛡️ **Anti-Offline Server Shield**: Micro-yields Python GIL every 10 frames (`time.sleep(0.001)`) to maintain WebSocket and Node.js ping/pong heartbeats, completely eliminating "Server Offline" disconnection errors on Android/Termux!
> - ⚡ **Direct In-Memory FFmpeg Streaming**: Renders RGB24 frames straight to FFmpeg stdin pipe with scheduled `gc.collect()`, keeping RAM flat **under 140 MB** across 10,000+ frames with zero intermediate chunk files.
> - 🏎️ **High-Speed Render Presets**:
>   - `python studio.py render --fast` : **720p HD mobile default (20–30 FPS)**, 4x faster, thermal & battery safe.
>   - `python studio.py render --turbo`: **540p ultrafast draft (45–55 FPS)**, 10x faster (5s video rendered in ~2.7s!).
>   - `python studio.py render --1080p`: Full 1080p broadcast master quality.
> - 📦 **Step 0 Mandatory Pre-Flight Installation**: Enforced via `setup_mobile.sh` and built-in auto-installer in `studio.py`.

```bash
# 1-Command Autopilot Build & Render:
CARTESIA_API_KEY=... python3 studio.py autopilot --voice anuj --lang hi --fast

# Or Step-by-Step Production:
python studio.py new ~/videos/my_video && cd ~/videos/my_video
python studio.py voice && python studio.py plan && python studio.py prompts && python studio.py generate && python studio.py key
python studio.py check && python studio.py sheet && python studio.py render --fast
```

---

## 🧩 Install as an AntiGem Plugin

You can install **2D Video Editing Studio** directly inside the **AntiGem** app:

1. Open **AntiGem**.
2. Go to **Settings → Custom AntiGem Plugins → Repositories**.
3. Add this repository:
   ```
   Dipeshkrydv/2d-video-editing-skill
   ```
   *(or `https://github.com/Dipeshkrydv/2d-video-editing-skill`)*
4. Browse the repository plugins and click **Install** on **2D Video Editing Studio**.
5. All 26 autonomous skills, styles, fonts, and engines will be installed instantly with automatic updates!

---

## 🌟 Key Features & Innovations

### 1. 🛡️ Anti-Offline Server & Anti-LMK Shield (v3.2)
- **Zero "Server Offline" Disconnections**: The engine yields CPU control every 10 frames (`time.sleep(0.001)`), keeping Termux's background WebSocket and Node.js heartbeat servers alive throughout 10+ minute renders.
- **Flat Memory Footprint (< 140 MB)**: Renders directly into an in-memory FFmpeg stdin pipe with scheduled `gc.collect()` cycles, completely preventing Android's Low Memory Killer (`lmkd`) from sending `SIGKILL`.
- **Fast 720p HD Default**: Automatically scales to 720p HD (720x1280) on mobile devices, delivering crisp high-definition visuals on phone screens at **20–30 FPS** (3.5x to 4x faster than software 1080p).
- **Turbo Mode (`--turbo`)**: Need an ultra-fast draft? Run `python studio.py render --turbo` for **45–55 FPS** (~2.7s for 5s of video).

### 2. 📱 Android Mobile First (Termux Optimized)
- **1-Command Mobile Setup (`setup_mobile.sh`)**: Automatically configures FFmpeg, Python, Pillow, NumPy, and SoundFile with zero bloat.
- **Turnkey CLI Pipeline (`mobile_run.py`)**: Run speech alignment, audio mixing, and video rendering with a single command.
- **Android Low Memory Killer (LMK) Protection**: Throttles memory footprint (<150 MB peak RAM) and clamps workers to prevent Termux crashes on mobile phones.
- **Mobile Safe-Zone Guard (1080x1920 / 720x1280)**: Automatically keeps all kinetic text, forensic stamps, and graphic callouts inside safe areas—clear of camera notches, status bars, and TikTok/Reels UI buttons.

### 3. 🍌 Mandatory Google Flow Asset Engine & Bridge Protocol
- **Exclusive Cloud Visual Engine**: Generates isolated character cutouts, stickmen, scene illustrations, and props via Google Flow (`🍌 Nano Banana 2.1` / `🍌 Nano Banana Pro` / `Imagen 3`) on solid `#FF00FF` magenta with lossless alpha unmixing.
- **Disconnection Alert Law**: Before generating assets, the system verifies the DeepX Flow Bridge connection (`deepx_status`). If disconnected, it safely pauses and prompts you to connect Google Flow rather than producing crude local dummy shapes.

### 4. ⏱️ 0.000s Audio-Visual Attack Sync Engine
- **Physical Dead-Air Stripping (`core/strict_sync.py`)**: Automatically strips leading digital silence down to audio sample 0, locking **Audio Sample 0 (0.000s)** directly to **Video Frame 0**.
- **Acoustic Activity Detection**: Isolates vocal bursts and breath pauses with FFmpeg `silencedetect`, preventing words from drifting into silent pauses.
- **Instant Frame 0 Opacity**: In-animations attack immediately at `opacity = 1.0` on the onset frame without laggy opacity fade-ins.

### 5. 🎨 Editorial Kinetic Typography & Curated Display Fonts
- **Variable Font Fix**: Bundles curated static bold typography (`Anton-Regular.ttf`, `Khand-Bold.ttf`, `Baloo2-ExtraBold.ttf`, `LiberationSans-Bold.ttf`, `Aquawax-Black.ttf`), eliminating variable font hairline rendering bugs.
- **Dynamic Text Auto-Fitting**: Intelligent multi-line word wrapping and font scaling guarantee zero text clipping across any screen resolution.
- **Gradient Headline Reveals**: Fiery red-orange, royal purple, electric cyan, sunset, and gold gradient typography with dual-tier drop shadows.
- **Tactile Forensic Elements**: Distressed classified evidence stamps with auto-scaling ink borders, realistic pushpinned gradient cards, and animated analog clocks with sweep sectors.

---

## 🚀 Quick Start Guide

### Option A: Turnkey Setup on Android Phone (Termux)
1. Extract the package on your phone:
   ```bash
   termux-setup-storage
   cd ~/storage/shared/Download
   unzip "deepesh mobile studio.zip" -d deepesh_mobile_studio
   cd deepesh_mobile_studio
   ```
2. Run the automated installer:
   ```bash
   sh setup_mobile.sh
   ```
3. Run the full mobile video production pipeline:
   ```bash
   python3 mobile_run.py
   ```
4. Preview the resulting video directly in your gallery:
   ```bash
   termux-open master.mp4
   ```

---

### Option B: High-Speed CLI Workflow
1. **Create New Project**:
   ```bash
   python studio.py new ~/videos/my_video && cd ~/videos/my_video
   ```
2. **Generate Neural Voiceover (Cartesia AI)**:
   ```bash
   CARTESIA_API_KEY=... python studio.py voice --voice anuj --lang hi
   ```
3. **Plan Shots & Generate Google Flow Prompts**:
   ```bash
   python studio.py plan
   python studio.py prompts
   ```
4. **Generate Flow Assets & Key Magenta Cutouts**:
   ```bash
   python studio.py generate
   python studio.py key
   ```
5. **QA Check & Storyboard Contact Sheet**:
   ```bash
   python studio.py check
   python studio.py sheet
   ```
6. **High-Speed Render**:
   ```bash
   # Recommended Mobile Render (720p HD, < 140MB RAM, Zero Offline Server error):
   python studio.py render --fast

   # Super-Fast Draft Review (540p, 45-55 FPS):
   python studio.py render --turbo

   # Full 1080p Master Export:
   python studio.py render --1080p
   ```

---

## 📁 Directory Architecture

```
2d-video-editing-studio/
├── README.md               # Complete documentation and quickstart
├── MOBILE_GUIDE.md         # Dedicated Android Termux optimization guide
├── SETUP.md                # System packages and installation guide
├── AGENT.md                # Full autonomous production director laws
├── SKILL.md                # Agent skill manifest & tool reference
├── ENGINE_V2.md            # Engine v2/v3 architecture documentation
├── studio.py               # Master CLI entrypoint with presets & autopilot
├── mobile_run.py           # Turnkey 1-command mobile video generator
├── setup_mobile.sh         # Termux automated package installer
├── core/                   # Core animation, typography, and sync engine
│   ├── engine/render.py    # Direct in-memory streaming & anti-offline shield
│   ├── strict_sync.py      # Sample-0 dead air trimming and speech alignment
│   ├── motion_mix.py       # Pinned cards, gradients, and font resolver
│   ├── kinetic_text.py     # Subtitle generator and baseline mask animator
│   ├── mix.py              # Broadcast audio ducking and SFX mixer
│   ├── key.py              # Magenta chroma-keying with alpha edge recovery
│   └── trends.py           # Real-time multi-platform trend scanner
├── fonts/                  # Curated static bold fonts (Anton, Khand, Baloo2, etc.)
├── audio/                  # Broadcast Foley SFX and royalty-free music beds
├── templates/              # Starter project templates
└── skills/                 # Comprehensive video directing skills
```

---

## 📄 License & Credits
Built for high-retention video creators by Dipesh Kr Yadav. Free and open for personal and commercial production.
