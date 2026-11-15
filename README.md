# 🎬 Deepesh Autonomous Studios & AntiGem Plugins Repository

[![AntiGem Compatible](https://img.shields.io/badge/AntiGem-Plugins_Ready-brightgreen.svg)](https://github.com/Dipeshkrydv/2d-video-editing-skill)
[![2D Engine](https://img.shields.io/badge/2D_Video_Studio-v3.3_(Anti--Offline_Shield)-blue.svg)](./2d-video-editing-studio)
[![Facebook Engine](https://img.shields.io/badge/Facebook_Automation-v1.6.0-blue.svg)](./facebook-automation)
[![Platform](https://img.shields.io/badge/Platform-Android_(Termux)_%7C_Linux_%7C_macOS_%7C_Windows-purple.svg)]()

> Official production-grade plugin suite for **AntiGem**, **Android (Termux)**, and **Desktop**. Includes the **2D Video Editing Studio (v3.3.0 Anti-Offline Server Shield)** and **Facebook Automation & SEO Studio (v1.6.0)**.

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

---

## 🧩 Plugins in this Repository

| Order | Plugin Name | Directory | Version | Core Capabilities |
|:---:|---|---|:---:|---|
| **1** | **2D Video Editing Studio** | [`2d-video-editing-studio/`](./2d-video-editing-studio) | `3.3.0` | **Anti-Offline Server Shield**, Direct In-Memory Streaming, High-Speed Render Presets (`--fast`, `--turbo`, `--1080p`), Vox Documentary, Stickman Storytelling, Die-Cut Pop-Art Stickers, Crime Noir, 8-Bit Arcade, 25 fonts, and Google Flow rapid parallel dispatch. |
| **2** | **Facebook Automation & SEO Studio** | [`facebook-automation/`](./facebook-automation) | `1.6.0` | Dedicated Feed Posts (Photo/Carousel/Video), Anti-Comment Firewall, Reels (`/reels/create` + mobile fallback + event dispatch), Stories, Real Thumbnail/Cover Uploader, and Multiline Formatted Captions. |

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
5. All skills, models, tools, and background workers will be registered instantly!
