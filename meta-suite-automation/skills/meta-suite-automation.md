---
name: meta-suite-automation
description: "Master Autonomous Meta Suite Production Engine (v2.0.0). Direct Meta Business Suite scheduler for Motivational Docqueen (Asset ID: 1409644015561854), Facebook Personal Profile (Renuka Yadav: 61592442011195), and Instagram (@renukayadav: 43599208749). Enforces 1-click publishing & scheduling of Reels (9:16), Long Videos (16:9), Photos, Stories, and Text with custom video thumbnails/covers, in-memory DataTransfer injection, <100ms synthetic clipboard paste, anti-ad organic shield, anti-comment box firewall, and 100% script-fidelity DeepX Google Flow AI media generation."
---

# Master Meta Suite Automation Skill (v2.0.0)

The definitive autonomous production, publishing, and scheduling engine for Meta Business Suite, Facebook Personal Profile, Instagram, and connected creator platforms.

---

## 0. Instant Architecture & Zero Overhead (CRITICAL)

- **WebSocket Bridge**: Active and listening at `ws://127.0.0.1:8765` (connecting the Python FastMCP server to the Chrome Extension).
- **DeepX Google Flow Bridge**: Active and listening at `ws://127.0.0.1:8792/ws` (generating high-impact post visuals, viral thumbnails, and Veo 3.1 video reels with 100% script and prompt fidelity).
- **Background Scheduler Daemon**: Running via SQLite WAL (`meta_suite.db`) and APScheduler with automatic 30-second execution ticks.
- **ZERO Manual Interruption**: Never prompt the user to open Facebook, Meta Business Suite, or Chrome tabs manually. All operations run directly in the background.

---

## 1. Grounded Accounts & Destination Routing

| Target Platform | Identity / Handle | Asset / Profile ID | Routing Parameters |
| :--- | :--- | :--- | :--- |
| **Meta Business Suite Page** | **Motivational Docqueen** | **`1409644015561854`** | `target_type: "page"`, `target_id: "1409644015561854"` |
| **Facebook Personal Profile** | **Renuka Yadav** | **`61592442011195`** | `target_type: "profile"`, `target_id: "61592442011195"` |
| **Instagram Account** | **@renukayadav** (`renukaydv624`) | **`43599208749`** | `target_type: "instagram"`, `target_id: "43599208749"` |

---

## 2. Multi-Format Production Matrix

1. **Reels (9:16 Vertical)**:
   - Dedicated Reels composer (`/reels/create` or Meta Business Suite Reel drawer).
   - Custom cover image uploaded inside the native Reel Cover dialog.
   - 1-line hook + formatted multiline caption + 3–6 diamond hashtags.
2. **Long-Form Videos (16:9 Landscape)**:
   - Landscape video streaming via in-memory `DataTransfer`.
   - Custom thumbnail uploaded inside **Edit Video $\to$ Thumbnail** (strictly never attached as a second post photo).
3. **High-CTR Photo Posts**:
   - Single-image integrity: automatically verifies and purges stale draft photos before attaching.
   - Formatted description preserving blank lines (`\n\n`) between title, quote, bullets, and CTA.
4. **Stories (Photo, Video, or Text)**:
   - Direct dispatch to `/stories/create` with optional `story_text` overlay (up to 120 characters).
5. **Text Only**:
   - High-impact quote and philosophy posts with synthetic `<100ms` paste injection.

---

## 3. The Killer Scheduling Engine

- **Quick-Schedule Offsets**:
  - `+15 min`: Immediate next-slot broadcast.
  - `+1 hr`: Primary focus window.
  - `+3 hr`: Peak evening engagement slot.
  - `Tomorrow 9:00 AM`: Next morning wake-up rush.
- **Time Zone Engine**:
  - Automatically calculates local machine time and converts to UTC Unix epoch timestamp (`run_at_timestamp`).
  - Persisted in SQLite WAL table `scheduled_jobs`.
  - APScheduler executes jobs automatically without requiring open browser windows.

---

## 4. Human-Grade Anti-Ban Execution Law

- **In-Memory File Input Interceptor**:
  - Intercepts dynamic in-memory `HTMLInputElement.prototype.click` calls from Meta Business Suite composer, attaching binary blobs via `DataTransfer` in `<400ms`.
- **Anti-Ad Organic Shield**:
  - Automatically verifies that the "Make this an ad post" switch is **OFF**, ensuring 100% organic algorithmic distribution.
- **Synthetic Clipboard Paste (<100ms)**:
  - Text is pasted directly into `div[contenteditable="true"]` via synthetic `ClipboardEvent("paste")` to preserve multiline paragraph formatting and avoid robotic character-by-character typing detection.
- **Anti-Comment Box Firewall**:
  - The automation strictly targets the Create Post Composer dialog and is firewalled from ever typing or pasting into feed comments or reply threads.

---

## 5. 1-Call Autonomous Dispatch Protocol

Keep reasoning under 2 seconds and dispatch directly:
1. **Publish to Motivational Docqueen Page**:
   ```python
   fb_publish(
       target_type="page",
       target_id="1409644015561854",
       post_type="photo",
       media_paths=["latest"],
       title="The Power of Relentless Focus",
       caption="🔥 The 1% Rule\n\nSuccess isn't about giant leaps...",
       hashtags=["#Mindset", "#Motivation", "#Success"]
   )
   ```
2. **Schedule Reel with Custom Cover**:
   ```python
   fb_schedule(
       target_type="page",
       target_id="1409644015561854",
       post_type="reel",
       media_paths=["/path/to/reel_video.mp4"],
       thumbnail_path="/path/to/cover_image.png",
       run_at_timestamp=1732000000,
       title="Stop Waiting for Perfection",
       caption="⚡ Action creates clarity...",
       hashtags=["#ReelsViral", "#Focus", "#Discipline"]
   )
   ```
