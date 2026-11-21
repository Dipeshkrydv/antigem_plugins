# 🎬 Deepesh Autonomous Studios & AntiGem Plugins Repository

[![AntiGem Compatible](https://img.shields.io/badge/AntiGem-Plugins_Ready-brightgreen.svg)](https://github.com/Dipeshkrydv/2d-video-editing-skill)
[![2D Engine](https://img.shields.io/badge/2D_Video_Studio-v3.5.3_(6_Styles_%26_Voice_Sync)-blue.svg)](./2d-video-editing-studio)
[![Facebook Engine](https://img.shields.io/badge/Facebook_Automation-v1.8.3-blue.svg)](./facebook-automation)
[![Meta Suite](https://img.shields.io/badge/Meta_Suite_Page_Management-v2.7.1-purple.svg)](./meta-suite-automation)
[![DeepX Flow](https://img.shields.io/badge/DeepX_Google_Flow_Studio-v1.2.3_(Spark_Agent_%26_Semantic_Search)-orange.svg)](./deepx-google-flow)
[![Platform](https://img.shields.io/badge/Platform-Android_(Termux)_%7C_Linux_%7C_macOS_%7C_Windows-purple.svg)]()

> Official production-grade plugin suite for **AntiGem**, **Android (Termux)**, and **Desktop**. Includes the **2D Video Editing Studio (v3.4.0: 6 Official Styles & Voice-Synced Assets)**, **Facebook Automation & SEO Studio (v1.7.0)**, **Meta Suite Page Management (v2.4.1)**, and **DeepX Google Flow Studio (v1.0.0)**.

---

## 🚀 What's New in This Universal Update

### 0. Meta Suite v2.7.0: Meta's own scheduler (Business Suite Planner)
- **`fb_meta_connect`** (one-time, official Graph API): scheduled Page posts are created in Meta's own scheduler and **Meta publishes them**: they show in Business Suite > Planner, no browser automation runs at posting time, and the device can be off.
- **`fb_schedule_bulk {publish_first_now:true}`**: post #1 goes out immediately, the rest are scheduled by the Page Safety Governor (up to 30/day, warm-up, even spacing) and handed to Meta about 3 per minute, up to 28 days ahead (later ones are handed over automatically).
- Pause or any Meta warning **pulls future posts back from Meta**; cancel/reschedule also update Meta. Reels, stories, profiles and groups keep posting from the device.

### 0. Meta Suite v2.6.0: 30 Page posts/day, ban-safe
- **Pages: up to 30 posts/day**, spread evenly (about 30 min apart over 07:00-23:00), never back-to-back. A 4-week warm-up (6 → 14 → 22 → 30) raises volume gradually; raising the limit later warms up again from today's level.
- **Personal profiles: max 3 posts/day**, 2 h apart. High volume is for Pages only.
- **Step-down after a warning:** resuming after a Meta warning halves the daily volume and restarts the warm-up.

### 0. Meta Suite v2.5.0: Bulk Safe Scheduler + Page Safety Governor
- **`fb_schedule_bulk`** schedules 1-500 posts in one call (a week or a month of content) and spreads them out automatically: 100 posts at the default 3/day = about 34 days.
- **Page Safety Governor** (always on): default 3 posts/day, up to **15/day** for photo Pages with an automatic weekly warm-up (6 → 9 → 12 → 15), 2 reels/day, 3 stories/day, 2 h between posts (auto-fits at high volume, never under 45 min), posting only 08:00-22:00, random ±10 min timing, duplicate captions, repeated images (even renamed) and missing files rejected up front. Change it with `fb_safety_settings` (it can only be made stricter than the hard limits).
- **No catch-up bursts:** if AntiGem was closed, overdue posts move to the next safe slots instead of posting back-to-back. At most one post per scheduler tick.
- **Auto-pause on any Meta warning** (temporarily blocked, "we limit how often", checkpoint, community standards, restricted): the queue *and* manual posting stop until the user resumes with `fb_manage_queue {action:"resume"}`. 3 failures in a row pause for 6 h. Interrupted posts are never re-posted blindly.
- Fixed: `fb_schedule` with `schedule_time_iso` (the documented argument) saved an invalid time and never published.

### 0. Shared Flow tab fix: no more "Another extension is attached to this tab" (Flow Studio v1.2.1 · 2D Studio v3.5.2 · Facebook v1.8.2 · Meta Suite v2.5.0)
- The DeepX engine used to attach the browser debugger to the Google Flow tab and **never release it**, so whichever plugin reached Flow second failed. The debugger is now only held for the few seconds a file upload needs it and is always released afterwards.
- If another plugin or extension still holds the tab, uploads fall back to AntiGem's native `uploadFiles` (no debugger) and then to a private Flow tab of the same project. Generation itself never needs the debugger.
- Each plugin also releases debugger locks left by its older versions, and a tab-lock error is retried once automatically before anything is reported.
- Facebook Automation and Meta Suite lease the Facebook tab's debugger per operation the same way, so they no longer block each other.

### 0. DeepX engine now built into 2D Studio (v3.5.1) & Facebook Automation (v1.8.1)
- The old Google Flow paths (`flow-auto`, the 8792 DeepX Chrome bridge, external image tools) are replaced by the built-in **DeepX Google Flow engine**.
- **2D Video Editing Studio:** `studio_generate_assets` checks the Google login, asks the last question (*with Agent Mode or without*), then generates every ELEMENTS.tsv asset on autopilot into `elements/raw/<name>`.
- **Facebook Automation:** AI thumbnails, Reel covers and post designs through `deepx_generate` with the same login check, mode question and automatic Agent fallback.
- **Meta Suite Page Management (v2.4.1):** repaired. Its worker was a copy of the Facebook worker, so 8 tools had no code and every "page" post went to the personal profile. It now posts AS the managed Page (auto Page discovery + Page switch), has a working queue manager, viral SEO, algorithm audit and live trend radar, and generates designs, thumbnails and videos with the built-in DeepX engine.

### 00. Google Flow November 2026 update (all DeepX-powered plugins)
- **Agent spark switch**: Flow moved the Agent into a spark switch inside the prompt box, next to the generate button. The shared DeepX engine (Flow Studio v1.2.0, 2D Studio v3.5.1, Facebook v1.8.1, Meta Suite v2.4.1) now finds and flips it; the old Agent pill still works.
- **Quick answers above the prompt box**: when an approval or question waits in the compact reply, DeepX opens **Use side panel** once and keeps autopilot running. New tool `deepx_flow_agent_open_chat`.
- **Semantic project search**: new `deepx_search_assets` tool returns exact matches (name / prompt) first, then Flow's **Similar results** from the image or video content (color, subject, mood).
- Flow's faster Agent model and improved Tool Builder are documented in the skills; the 24-items-per-request split is unchanged.

### 0b. DeepX Google Flow Studio (v1.2.0)
- The DeepX Google Flow Chrome extension, rebuilt as an AntiGem plugin: every feature is an MCP tool and a skill, with no side panel, bridge or setup.
- **Mode question first:** before any generation the assistant asks *Agent Mode or Standard mode (without Agent)?*, then calls `deepx_generate` instantly.
- **Agent Mode 24-per-part queue:** 25 to 5000 prompts are split into parts of ≤24 and pasted back-to-back into Google Flow Agent, with auto-approvals and auto-answered Agent questions.
- **Unusual-activity fallback:** when Google blocks standard generation ("unusual activity", extension, captcha), the blocked prompts are re-sent through Agent Mode automatically.

### 1. Meta Suite Page Management (v2.1.0)
- 📌 **100% Focused on Facebook Page Management**: Dedicated to managed Facebook Pages via Meta Business Suite (`business.facebook.com`), keeping personal profile workflows strictly isolated in Facebook Automation.
- 📋 **Strict 6-Step Sequential Order Execution Rule**:
  1. *Step 1*: Meta Business Suite Login & Session Verification (`business.facebook.com`).
  2. *Step 2*: Managed Facebook Page Target Selection (`target_type="page"`, `target_id="me"` or explicit ID).
  3. *Step 3*: Content Preparation & Anti-Duplicate Check (Title, formatting, 3–6 hashtags, SHA-256).
  4. *Step 4*: In-Memory Asset & Custom Thumbnail / Cover Injection (DataTransfer RAM, Video/Reel panel).
  5. *Step 5*: Anti-Ad Organic Shield Verification ("Make this an ad post" strictly OFF).
  6. *Step 6*: Synthetic Paste & Final Publish or Schedule (<100ms clipboard paste).
- 🎨 **Official Brand Logo & Extension Icons**: Properly tracked brand icon and extension assets for crystal-clear visual identity in AntiGem.
- 🔒 **Zero Data Leakage**: Complete production privacy sanitization across all skills, rules, and scripts.

### 2. Facebook Automation & SEO Studio (v1.7.0)
- 🚫 **Anti-Comment Firewall**: Strict multi-attribute selector protection prevents accidental post caption injection into feed comments.
- 🎬 **Reel Auto-Wizard & Video Event Dispatch**: Dispatches native `input`/`change` events on `/reels/create` file inputs so React initiates upload processing immediately, keeping the wizard active and unblocking "Next" and "Publish" buttons.
- 🖼️ **Thumbnail & Cover Uploader**: Direct upload for custom Reel and Video thumbnails via Video Options / Cover panel with active click event delegation.
- 🏷️ **Viral SEO Engine**: Pre-trained viral hooks, micro-bullets, and retention-focused hashtags.

### 3. 2D Video Editing Studio (v3.4.0)
- 🎨 **NEW in v3.4.0: 6 Official, Fully-Specified Styles**: Vox/Box Paper Collage, Stickman Storytelling, Sticker Hybrid, Suspense Noir, Hand-Drawn Doodle (new engine) and Retro Arcade (16-bit, crisp pixel scaling). Each style defines its palette hex, fonts, motion, a prompt "style lock" added to every Flow image, and 9–12 scene recipes. Spec: [`STYLES.md`](./2d-video-editing-studio/STYLES.md) (generated by `studio.py styles --doc`, checked by `studio.py styles --lint`).
- 🎬 **NEW in v3.4.0: Recipe-Driven Autopilot Edit**: `auto_edit` picks a style recipe per voice line (hook / number / compare / list / person / place / quote / outro) and fills it only with that line's own images, words and numbers. No more fake `METRIC 24%` / `PART 01` filler.
- 🎯 **FIXED in v3.4.0: Assets match the voice-over**: shot `line` ids normalised (`1` = `"01"` = `"L01"`), every asset lands on its own cue word, dash/short-word cue bug fixed, Flow downloads mapped by stable index + freshness (no stale images from older projects), and a guard stops the sample template's dummy assets leaking into real videos.
- 🤖 **Google Flow Agent Mode & Batch Prompt Dispatch**: New batch prompt dispatcher (`core/flow_agent_dispatch.py`, `studio.py generate --agent`, `studio.py autopilot --agent`) and MCP tools (`flow_agent_dispatch`, `flow_agent_status`, `flow_agent_toggle`) to paste entire multi-scene storyboards in one shot.
- 🌐 **Multi-Domain Google Flow Bridge**: Native detection and resilience across both `flow.google.com` and `labs.google/fx/tools/flow`, with automatic project canvas creation when `project_id` is null (eliminating 30s timeouts).
- 📏 **Strict 15-Minute Timeline Scaling Laws**: Mathematically verified duration scaling (1,950–2,300 spoken words, 420–600+ visual assets for 15-min videos) with the "Never Use Less Assets" mandate.
- ⚡ **Zero-Latency CLI & Auto Project Detection**: Instant `studio.py --help` (0.02s) on Termux, and automatic project folder argument ingestion (`studio.py check templates/v2`, `studio.py render my_video --turbo`).
- 🛡️ **Anti-Offline Server Shield**: In-memory single-process FFmpeg direct streaming with 1 reserved CPU core and 5ms GIL heartbeats every 8 frames, guaranteeing WebSocket connections never drop during exports.
- 🏎️ **Hardcoded High-Speed Presets**:
  - `python studio.py render --fast` : **720p HD mobile default (20–30 FPS)**, 4x faster, thermal & battery safe.
  - `python studio.py render --turbo`: **540p ultrafast draft (45–55 FPS)**, 10x faster (5s of video in ~2.7s!).
  - `python studio.py render --1080p`: Full 1080p broadcast master quality.

---

## 🧩 Plugins in this Repository

| Order | Plugin Name | Directory | Version | Core Capabilities |
|:---:|---|---|:---:|---|
| **1** | **2D Video Editing Studio** | [`2d-video-editing-studio/`](./2d-video-editing-studio) | `3.5.2` | **Anti-Offline Server Shield**, Direct In-Memory Streaming, High-Speed Render Presets (`--fast`, `--turbo`, `--1080p`), Vox Documentary, Stickman Storytelling, Die-Cut Pop-Art Stickers, Crime Noir, 8-Bit Arcade, 25 fonts, and Google Flow rapid parallel dispatch. |
| **2** | **Facebook Automation & SEO Studio** | [`facebook-automation/`](./facebook-automation) | `1.8.2` | Dedicated Feed Posts (Photo/Carousel/Video), Anti-Comment Firewall, Reels (`/reels/create` + mobile fallback + event dispatch), Stories, Real Thumbnail/Cover Uploader, and Multiline Formatted Captions. |
| **3** | **Meta Suite Page Management** | [`meta-suite-automation/`](./meta-suite-automation) | `2.7.0` | Enterprise Meta Business Suite Facebook Page management, 6-Step Sequential Order Execution Rule, dual-mode native & local queue scheduler, custom Reel covers & video thumbnails, DeepX Google Flow AI bridge, and anti-ad organic shield. |
| **4** | **DeepX Google Flow Studio** | [`deepx-google-flow/`](./deepx-google-flow) | `1.2.0` | The full DeepX Google Flow extension as an MCP plugin (no side panel): **Google Flow Nov 2026 ready** (Agent spark switch, quick answers + auto side panel, semantic asset search `deepx_search_assets`), **asks Agent Mode vs Standard mode before every generation**, Agent Mode **auto-splits >24 prompts into ≤24-item parts pasted back-to-back** with 100% autopilot approvals, Standard mode **auto-switches to Agent Mode on Google "unusual activity / extension" blocks**, Nano Banana 2.1/Pro, Omni Flash 1.2, Veo 3.1, storyboard analyzer, characters, references, scene chaining, upscale, 89 tools. |

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
   - ✅ **2D Video Editing Studio (v3.4.0)**
   - ✅ **Facebook Automation & SEO Studio (v1.7.0)**
   - ✅ **Meta Suite Page Management (v2.7.0)**
5. All skills, models, tools, and background workers will be registered instantly!
