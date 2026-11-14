# 🎬 Deepesh Autonomous Studios & AntiGem Plugins Repository

[![AntiGem Compatible](https://img.shields.io/badge/AntiGem-Plugins_Ready-brightgreen.svg)](https://github.com/Dipeshkrydv/2d-video-editing-skill)
[![2D Engine](https://img.shields.io/badge/2D_Video_Studio-v3.2_(Anti--Offline_Shield)-blue.svg)](./2d-video-editing-studio)
[![Facebook Engine](https://img.shields.io/badge/Facebook_Automation-v1.5.0-blue.svg)](./facebook-automation)
[![3D Engine](https://img.shields.io/badge/3D_Video_Part_1-v1.0.0-orange.svg)](./3d-video-editing-studio)
[![Platform](https://img.shields.io/badge/Platform-Android_(Termux)_%7C_Linux_%7C_macOS_%7C_Windows-purple.svg)]()

> Official production-grade plugin suite for **AntiGem**, **Android (Termux)**, and **Desktop**. Includes the **2D Video Editing Studio (v3.2 Anti-Offline Server Shield)**, **Facebook Automation & SEO Studio (v1.5.0)**, and **3D Video Editing Part 1 (v1.0.0)**.

---

## 🚀 What's New in v3.2: Anti-Offline Server Shield & High-Speed Rendering

In version 3.2, the 2D Video Editing Studio permanently resolves the mobile "Server Offline" disconnection issue:

- 🛡️ **Anti-Offline Server Shield**: Micro-yields the Python GIL every 10 frames (`time.sleep(0.001)`) to maintain background WebSocket and Node.js ping/pong heartbeats, completely eliminating "Server Offline" errors during long renders on Android/Termux!
- ⚡ **Direct In-Memory FFmpeg Streaming**: Renders RGB24 frames directly into an FFmpeg stdin pipe with scheduled `gc.collect()` cycles, keeping RAM usage flat **under 140 MB** across 10,000+ frames with zero intermediate chunk files.
- 🏎️ **Hardcoded High-Speed Presets**:
  - `python studio.py render --fast` : **720p HD mobile default (20–30 FPS)**, 4x faster, thermal & battery safe.
  - `python studio.py render --turbo`: **540p ultrafast draft (45–55 FPS)**, 10x faster (5s of video in ~2.7s!).
  - `python studio.py render --1080p`: Full 1080p broadcast master quality.
- 📦 **Step 0 Mandatory Pre-Flight Installation**: Enforced via `setup_mobile.sh` and built-in auto-installer in `studio.py`.

---

## 🧩 Plugins in this Repository

| Order | Plugin Name | Directory | Version | Core Capabilities |
|:---:|---|---|:---:|---|
| **1** | **2D Video Editing Studio** | [`2d-video-editing-studio/`](./2d-video-editing-studio) | `3.2.0` | **Anti-Offline Server Shield**, Direct In-Memory Streaming, High-Speed Render Presets (`--fast`, `--turbo`, `--1080p`), Vox Documentary, Stickman Storytelling, Die-Cut Pop-Art Stickers, Crime Noir, 8-Bit Arcade, 25 fonts, and Google Flow rapid parallel dispatch. |
| **2** | **Facebook Automation & SEO Studio** | [`facebook-automation/`](./facebook-automation) | `1.5.0` | Dedicated Feed Posts (Photo/Carousel/Video), Reels (`/reels/create` + mobile fallback), Stories (`/stories/create` Photo/Video), Real Thumbnail/Cover Uploader, and Multiline Formatted Captions (Title + Bullets + CTA + 3-6 #Hashtags). |
| **3** | **3D Video Editing Part 1** | [`3d-video-editing-studio/`](./3d-video-editing-studio) | `1.0.0` | 100% Code-Driven 3D & 2D Faceless Shorts (Three.js, SDF raymarching, Kokoro-82M neural voiceover, Whisper alignment). 6 Styles: Deep Dive 3D (Zack D. Films style), Night File 3D (mystery), Inside Out, Stick Story, Paper Atlas, Tall Tale 3D. $0 Cost, Zero AI Morphing. |

---

## 📲 How to Install in AntiGem

1. Open **AntiGem**.
2. Go to **Settings → Custom AntiGem Plugins → Repositories**.
3. Add this repository URL:
   ```
   https://github.com/Dipeshkrydv/2d-video-editing-skill
   ```
   *(or `Dipeshkrydv/2d-video-editing-skill`)*
4. Browse the repository plugins and click **Install** on any or all plugins:
   - ✅ **2D Video Editing Studio**
   - ✅ **Facebook Automation & SEO Studio**
   - ✅ **3D Video Editing Part 1**
5. All skills, models, tools, and background workers will be registered instantly!

---

## ⚡ 2D Video Editing Studio Quickstart

```bash
# Navigate to the 2D studio directory:
cd 2d-video-editing-studio

# Step 0: Ensure dependencies are installed (Anti-LMK & Audio/Video tools)
sh setup_mobile.sh

# 1-Command Autopilot Build & Render:
CARTESIA_API_KEY=... python3 studio.py autopilot --voice anuj --lang hi --fast

# Or Step-by-Step Production:
python studio.py new ~/videos/my_video && cd ~/videos/my_video
python studio.py voice && python studio.py plan && python studio.py prompts && python studio.py generate && python studio.py key
python studio.py check && python studio.py sheet && python studio.py render --fast
```

---

## ⚡ 3D Video Editing Part 1 Quickstart

```bash
# Navigate to the 3D studio directory:
cd 3d-video-editing-studio

# Quick draft render:
python3 studio.py render --turbo

# Recommended mobile render (720p HD, flat RAM < 140MB):
python3 studio.py render --fast
```

---

## 📄 License & Attribution
Created with ❤️ by **Dipesh Kr Yadav** for high-retention video creators and automated social workflows. Free and open for personal and commercial production.
