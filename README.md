# 🎬 Deepesh Autonomous Studios & AntiGem Plugins Repository

[![AntiGem Compatible](https://img.shields.io/badge/AntiGem-Plugins_Ready-brightgreen.svg)](https://github.com/Dipeshkrydv/2d-video-editing-skill)
[![2D Engine](https://img.shields.io/badge/2D_Video_Studio-v3.3_(Anti--Offline_Shield)-blue.svg)](./2d-video-editing-studio)
[![Facebook Engine](https://img.shields.io/badge/Facebook_Automation-v1.6.0-blue.svg)](./facebook-automation)
[![3D Engine](https://img.shields.io/badge/3D_Video_Part_1-v1.1.0-orange.svg)](./3d-video-editing-studio)
[![Platform](https://img.shields.io/badge/Platform-Android_(Termux)_%7C_Linux_%7C_macOS_%7C_Windows-purple.svg)]()

> Official production-grade plugin suite for **AntiGem**, **Android (Termux)**, and **Desktop**. Includes the **2D Video Editing Studio (v3.3.0 Anti-Offline Server Shield)**, **Facebook Automation & SEO Studio (v1.6.0)**, and **3D Video Editing Part 1 (v1.1.0 Standalone Engine)**.

---

## 🚀 What's New in This Universal Update

### 1. 2D Video Editing Studio (v3.3.0)
- 🛡️ **Anti-Offline Server Shield**: Micro-yields the Python GIL every 10 frames (`time.sleep(0.001)`) to maintain background WebSocket and Node.js ping/pong heartbeats, permanently eliminating "Server Offline" errors during long renders on Android/Termux!
- ⚡ **Direct In-Memory FFmpeg Streaming**: Renders RGB24 frames directly into an FFmpeg stdin pipe with scheduled `gc.collect()` cycles, keeping RAM usage flat **under 140 MB** across 10,000+ frames with zero intermediate chunk files.
- 🏎️ **Hardcoded High-Speed Presets**:
  - `python studio.py render --fast` : **720p HD mobile default (20–30 FPS)**, 4x faster, thermal & battery safe.
  - `python studio.py render --turbo`: **540p ultrafast draft (45–55 FPS)**, 10x faster (5s of video in ~2.7s!).
  - `python studio.py render --1080p`: Full 1080p broadcast master quality.

### 2. Facebook Automation & SEO Studio (v1.6.0)
- 🚫 **Anti-Comment Firewall**: Strict multi-attribute selector protection prevents accidental post caption injection into feed comments.
- 🎬 **Reel Auto-Wizard & Video Event Dispatch**: Dispatches native `input`/`change` events on `/reels/create` file inputs so React initiates upload processing immediately, keeping the wizard active and unblocking "Next" and "Publish" buttons.
- 🖼️ **Thumbnail & Cover Uploader**: Direct upload for custom Reel and Video thumbnails via Video Options / Cover panel with active click event delegation.

### 3. Stickman Video Editing Studio — Stick Story (v1.2.0)
- 🏃 **Dedicated Stickman Focus**: 100% focused on Stick Story & Stickman tactical survival, life-hack, and dilemma shorts.
- ⚡ **Zero External Template Prompts**: Everything is self-contained. The agent and user run `python3 studio.py new stick-story <name>` with zero need to locate external files.
- 🛡️ **Anti-LMK Shield**: Built-in micro-yields and single-process headless Chromium keep RAM flat **< 140 MB** during 1,000+ frame renders.
- 🎨 **Stick Story Visual Language**: Ink-black stick figures with emotive acting eyes, day/night illustrated rooms, warm silhouette glows, gold step cards, and word-synced captions.

---

## 🧩 Plugins in this Repository

| Order | Plugin Name | Directory | Version | Core Capabilities |
|:---:|---|---|:---:|---|
| **1** | **2D Video Editing Studio** | [`2d-video-editing-studio/`](./2d-video-editing-studio) | `3.3.0` | **Anti-Offline Server Shield**, Direct In-Memory Streaming, High-Speed Render Presets (`--fast`, `--turbo`, `--1080p`), Vox Documentary, Stickman Storytelling, Die-Cut Pop-Art Stickers, Crime Noir, 8-Bit Arcade, 25 fonts, and Google Flow rapid parallel dispatch. |
| **2** | **Facebook Automation & SEO Studio** | [`facebook-automation/`](./facebook-automation) | `1.6.0` | Dedicated Feed Posts (Photo/Carousel/Video), Anti-Comment Firewall, Reels (`/reels/create` + mobile fallback + event dispatch), Stories, Real Thumbnail/Cover Uploader, and Multiline Formatted Captions. |
| **3** | **Stickman Video Editing Studio** | [`3d-video-editing-studio/`](./3d-video-editing-studio) | `1.2.0` | Dedicated Stickman & Stick Story Video Engine (`studio.py`), 100% Code-Driven vertical shorts (Canvas 2D + Three.js, Kokoro neural TTS, Whisper alignment, gold step cards, acting eyes). Anti-LMK Shield. $0 Cost. |

---

## 📲 How to Install in AntiGem

1. Open **AntiGem**.
2. Go to **Settings → Custom AntiGem Plugins → Repositories**.
3. Add this repository URL:
   ```
   https://github.com/Dipeshkrydv/2d-video-editing-skill
   ```
   *(or `https://github.com/Dipeshkrydv/antigem_plugins`)*
4. Browse the repository plugins and click **Install** or **Update** on any or all plugins:
   - ✅ **2D Video Editing Studio (v3.3.0)**
   - ✅ **Facebook Automation & SEO Studio (v1.6.0)**
   - ✅ **3D Video Editing Part 1 (v1.1.0)**
5. All skills, models, tools, and background workers will be registered instantly!
