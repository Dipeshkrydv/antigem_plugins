# 🎬 Deepesh Autonomous Studios & AntiGem Plugins Repository

[![AntiGem Compatible](https://img.shields.io/badge/AntiGem-Plugins_Ready-brightgreen.svg)](https://github.com/Dipeshkrydv/2d-video-editing-skill)
[![2D Engine](https://img.shields.io/badge/2D_Video_Studio-v3.3.1_(Flow_Agent_%26_Anti--Offline)-blue.svg)](./2d-video-editing-studio)
[![Facebook Engine](https://img.shields.io/badge/Facebook_Automation-v1.6.0-blue.svg)](./facebook-automation)
[![Platform](https://img.shields.io/badge/Platform-Android_(Termux)_%7C_Linux_%7C_macOS_%7C_Windows-purple.svg)]()

> Official production-grade plugin suite for **AntiGem**, **Android (Termux)**, and **Desktop**. Includes the **2D Video Editing Studio (v3.3.1 Flow Agent & Anti-Offline Shield)** and **Facebook Automation & SEO Studio (v1.6.0)**.

---

## 🚀 What's New in This Universal Update (v3.3.1)

### 1. 2D Video Editing Studio (v3.3.1)
- 🤖 **Google Flow Agent Mode & Batch Prompt Dispatch**: New batch prompt dispatcher (`core/flow_agent_dispatch.py`, `studio.py generate --agent`, `studio.py autopilot --agent`) and MCP tools (`flow_agent_dispatch`, `flow_agent_status`, `flow_agent_toggle`) to paste entire multi-scene storyboards in one shot.
- 🌐 **Multi-Domain Google Flow Bridge**: Native detection and resilience across both `flow.google.com` and `labs.google/fx/tools/flow`, with automatic project canvas creation when `project_id` is null (eliminating 30s timeouts).
- 📏 **Strict 15-Minute Timeline Scaling Laws**: Mathematically verified duration scaling (1,950–2,300 spoken words, 420–600+ visual assets for 15-min videos) with the "Never Use Less Assets" mandate.
- ⚡ **Zero-Latency CLI & Auto Project Detection**: Instant `studio.py --help` (0.02s) on Termux, and automatic project folder argument ingestion (`studio.py check templates/v2`, `studio.py render my_video --turbo`).
- 🛡️ **Anti-Offline Server Shield**: In-memory single-process FFmpeg direct streaming with 1 reserved CPU core and 5ms GIL heartbeats every 8 frames, guaranteeing WebSocket connections never drop during exports.
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
| **1** | **2D Video Editing Studio** | [`2d-video-editing-studio/`](./2d-video-editing-studio) | `3.3.1` | **Anti-Offline Server Shield**, Direct In-Memory Streaming, High-Speed Render Presets (`--fast`, `--turbo`, `--1080p`), Vox Documentary, Stickman Storytelling, Die-Cut Pop-Art Stickers, Crime Noir, 8-Bit Arcade, 25 fonts, and Google Flow rapid parallel dispatch. |
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
   - ✅ **2D Video Editing Studio (v3.3.1)**
   - ✅ **Facebook Automation & SEO Studio (v1.6.0)**
5. All skills, models, tools, and background workers will be registered instantly!
