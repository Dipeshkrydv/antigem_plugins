---
name: 2D Video Editing Studio
description: Master Autonomous Video Director & Production Engine (v3.2) for broadcast-quality 2D explainers, documentaries, and animations with Anti-Offline Server Shield, direct in-memory FFmpeg streaming, and high-speed render presets.
version: 3.5.0
---

# 2D Video Editing Studio — Master Video Director (v3.2)

Transform ideas, scripts, and concepts into broadcast-grade 2D video explainers across 5 core genres:
1. **Vox Documentary Explainer** (Tactile paper, halftone dot screens, giant stats, Polaroids with pushpins)
2. **Stickman / Modern Storytelling** (YouTuber comic stickman in streetwear, selective color environments)
3. **Sticker / Pop-Art Cutouts** (Die-cut white vinyl contours, 2-tier soft ambient shadows, satirical parodies)
4. **Suspense Noir / True Crime** (Chiaroscuro lighting, redaction bars, CCTV timestamps, evidence boards)
5. **Retro 8-Bit Arcade** (Pixel-art backdrops, RPG double-border dialogue boxes, HP bars)

## 🛡️ Anti-Offline Server Shield & High-Speed Rendering (v3.2)
- **Zero "Server Offline" Disconnections**: The engine yields CPU control every 10 frames (`time.sleep(0.001)`), keeping WebSocket and Node.js ping/pong heartbeats alive during long renders on mobile/Termux.
- **Flat Memory Footprint (< 140 MB)**: Renders directly into an in-memory FFmpeg stdin pipe with scheduled `gc.collect()` cycles, completely preventing Android Low Memory Killer (`lmkd`) crashes.
- **Hardcoded High-Speed Presets**:
  - `python studio.py render --fast` : **720p HD mobile default (20–30 FPS)**, 4x faster, thermal & battery safe.
  - `python studio.py render --turbo`: **540p ultrafast draft (45–55 FPS)**, 10x faster (5s of video in ~2.7s!).
  - `python studio.py render --1080p`: Full 1080p broadcast master quality.

## Step 0: Mandatory Pre-Flight Installation
Before planning or rendering, verify all dependencies are installed:
```bash
sh setup_mobile.sh
python studio.py selftest --quick
```

## Production Commands
- **New Project**: `python studio.py new projects/<name>`
- **Voiceover**: `CARTESIA_API_KEY=... python studio.py voice --voice anuj`
- **Shot Planning**: `python studio.py plan`
- **Prompt Validation**: `python studio.py prompts`
- **Asset Generation**: MCP `studio_generate_assets {project_dir}` (built-in DeepX Google Flow engine; terminal: `python studio.py generate --mode agent|standard`). See the Asset Generation section below.
- **Cutout Keying**: `python studio.py key` (Die-cut contours + warm shadows)
- **Edit Validation & Sheet**: `python studio.py check && python studio.py sheet`
- **Audio Mix**: `python studio.py mix` (Voice + ducked music + SFX hits at -14 LUFS)
- **Render Master**:
  ```bash
  python studio.py render --fast   # Mobile 720p HD (Default)
  python studio.py render --turbo  # Ultrafast 540p draft (45-55 FPS)
  python studio.py render --1080p  # Full 1080p HD
  ```
- **1-Command Autopilot**:
  ```bash
  CARTESIA_API_KEY=... python3 studio.py autopilot --voice anuj --lang hi --fast --mode agent   # --mode = user's last answer
  ```

## Google Flow Asset Generation (built-in DeepX engine, ONLY path)
Never use any other Google Flow extension, `flow-auto`, or the old `ws://127.0.0.1:8792` bridge. Never tell the user to paste prompts, generate or download in Google Flow by hand.
1. **Login check:** `deepx_check_login`. If it returns `LOGIN_REQUIRED`, tell the user its one message (sign in to Google in the Flow tab of the AntiGem browser) and stop until they reply. If logged in, continue silently.
2. **Last question:** after the script and voice setup, ask one multiple-choice question: **"Generate the visual assets with Agent Mode or without Agent Mode?"** No questions after this; the rest is autopilot.
3. After `python studio.py prompts` has written ELEMENTS.tsv, call **`studio_generate_assets {project_dir, generation_mode}`** (`agent` = with Agent Mode, `standard` = without). Poll `deepx_job_status {job_id, wait_seconds:30}` until done. Files land in `elements/raw/<name>.<ext>`.
   - Agent Mode: prompts are pasted into Google Flow Agent, ≤24 per part, back-to-back, auto-approved.
   - Without Agent: exact per-asset generation. On a Google "unusual activity" / extension error it switches to Agent Mode automatically. Do not cancel or stop.
   - `missing` not empty → call it again (only missing assets are generated). `all_done` → continue.
4. Continue: `python studio.py key` → `check` → `mix` → `render`. (CLI autopilot: `python studio.py autopilot ... --mode agent|standard`.)

## Exact Timeline Script & Duration Calibration Protocol

The agent MUST generate the full, unabridged spoken script matching the user's requested duration with mathematical precision. Spoken narration pace standard: **130–150 words per minute (WPM)** (~2.2–2.5 words per second).

### Mandatory Duration & Word Count Standards
| Requested Duration | Minimum Spoken Word Count | Minimum Spoken Lines in `LINES.tsv` | Narrative Architecture |
|---|---|---|---|
| **Short-Form (45–60s)** | **130–160 words** | **12–16 lines** | Rapid hook, 3 key beats, CTA |
| **Full 2-Minute Explainer** | **260–300 words** | **25–35 lines** | 3-Act arc, deep proof, resolution |
| **Full 3-Minute Explainer** | **400–450 words** | **40–55 lines** | Case setup, 4 evidence beats, climax |
| **Full 5-Minute Documentary** | **650–750+ words** | **65–90+ lines** | Full 5-stage suspense or investigative breakdown |

### Strict Script Generation Laws
1. **Zero-Abbreviation / Zero-Summarization Law**: NEVER generate a 30-second teaser or 1-minute placeholder script when 2, 3, or 5 minutes is requested. The script must contain every single spoken sentence and word needed to fill the entire timeline.
2. **Explicit Timeline Timestamps**: Format each line with its projected timestamp interval:
   ```text
   [00:00 - 00:04] Line 01: Spoken narration hook goes here...
   [00:04 - 00:08] Line 02: Next evidence sentence...
   ...
   [04:55 - 05:00] Line 78: Concluding revelation and thought-provoking outro.
   ```
3. **Word Count Verification Pre-Flight Check**: Always print the total word count and line count. If the word count is below the minimum required for the requested duration, the agent MUST expand the story, examples, forensic details, and technical depth before presenting it.

## Mandatory High-Density Word-to-Word Asset Generation Standard

Sparse visual assets (e.g. 4–7 images for 1 minute, or 50–60 images for 5 minutes) are strictly classified as **Visual Starvation Failures**. High-retention video requires continuous, rapid visual progression with at least one fresh visual entrance every **1.0 to 1.5 seconds**.

### Compulsory Minimum Asset Floors
Every video project MUST generate visual assets matching or exceeding these floors:
- **1-Minute Video (~60s)**: **28 to 40+ distinct visual assets** (at least 20–25 generated Flow images + keyed props).
- **2-Minute Video (~120s)**: **55 to 80+ distinct visual assets** (at least 45–60 generated Flow images).
- **3-Minute Video (~180s)**: **85 to 120+ distinct visual assets** (at least 70–95 generated Flow images).
- **5-Minute Video (~300s)**: **140 to 200+ distinct visual assets** (at least 120–160 generated Flow images).

### Word-by-Word Script Directorial Breakdown
The director agent MUST analyze the script **word-for-word**:
1. **Every Key Concept Gets a Visual Twin**: Every character, location, weapon, evidence item, statistic, date, action verb, and emotional shift mentioned in narration must have a dedicated image or cutout prop.
2. **Dual-Mode Visual Allocation**:
   - **Mode A (Full-Bleed Photographic Backdrops)**: Edge-to-edge environment, historical scene, dark interrogation room, atmospheric alley (no magenta, no cutout).
   - **Mode B (Cutout Props & Forensic Evidence)**: Isolated subject, character, weapon, document, cassette tape, fingerprint card, or sticker on `#FF00FF` magenta background, keyed via `studio.py key` with 2-tier natural shadows and die-cut contour.
3. **Multi-Asset Layered Composition**: A scene is NEVER a lone sticker on a blank canvas. Every scene MUST stack:
   - Layer 1: Ambient living canvas / photographic backdrop (Mode A).
   - Layer 2: Primary subject or hero character (Mode B).
   - Layer 3: Reinforcing contextual props, evidence markers, documents (Mode B).
   - Layer 4: Procedural instruments, clocks, stamps (max 2/video), seals, or ASS kinetic typography tags.

## Video Preview (Post-Render Playback)

After video generation is complete, the agent MUST present the rendered video(s) directly in the chat for instant in-place preview — both single video and multiple video outputs.

### Single Video Preview
When a single `master.mp4` is rendered, display it immediately:
```html
<video src="/path/to/project/master.mp4" controls width="100%"></video>
```

### Multiple Video / Multi-Format Preview
When multiple videos are rendered (e.g. preview + master, or multiple cuts/segments), display each with format fallbacks:
```html
<video controls poster="thumb.jpg">
  <source src="clip.webm" type="video/webm">
  <source src="clip.mp4" type="video/mp4">
</video>
```

### Playback Rules
- **Always present the video inline** after `python studio.py render` or `python studio.py preview` completes successfully.
- Use the **actual absolute path** to the rendered file (e.g. `/data/user/0/com.termux/files/home/videos/my_video/master.mp4`).
- For preview renders (540p draft), show with a note: `📺 Preview (540p draft)`.
- For final renders (1080p master), show with: `🎬 Final Master (1080p)`.
- If both `.webm` and `.mp4` exist, include both as `<source>` tags for maximum compatibility.
- For multi-segment or multi-cut projects, present each video in order with a labeled heading.
