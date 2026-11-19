---
name: meta-suite-automation
description: "Master Autonomous Meta Suite Production Engine (v2.0.0). Enterprise Meta Business Suite Facebook Page management and scheduling engine. Enforces 1-click publishing & scheduling of Page Reels (9:16), Long Videos (16:9), Photos, Stories, and Announcements with custom video thumbnails/covers, in-memory DataTransfer injection, <100ms synthetic clipboard paste, anti-ad organic shield, anti-comment box firewall, and 100% script-fidelity DeepX Google Flow AI media generation."
---

# Master Meta Suite Page Management Engine (v2.0.0)

The definitive autonomous production, publishing, and scheduling engine dedicated 100% to **Facebook Page Management via Meta Business Suite**.

---

## 0. Instant Architecture & Zero Overhead (CRITICAL)

- **WebSocket Bridge**: Active and listening at `ws://127.0.0.1:8765` (connecting the Python FastMCP server to the Chrome Extension).
- **DeepX Google Flow Bridge**: Active and listening at `ws://127.0.0.1:8792/ws` (generating high-impact page visuals, viral thumbnails, and Veo 3.1 video reels with 100% script and prompt fidelity).
- **Background Scheduler Daemon**: Running via SQLite WAL (`meta_suite.db`) and APScheduler with automatic 30-second execution ticks.
- **ZERO Manual Interruption**: Never prompt the user to open Meta Business Suite or Chrome tabs manually. All operations run directly in the background.

---

## 1. Managed Facebook Page Routing & Asset Discovery

| Target Surface | Destination | Routing Parameters | Capabilities |
| :--- | :--- | :--- | :--- |
| **Meta Business Suite Page** | Managed Facebook Page | `target_type: "page"`, `target_id: "me"` (or `<page_id>`) | Dedicated Page composer, organic reach, multi-page selection |

- **Dynamic Page Discovery**: Automatically detects connected Facebook Pages from the active Meta Business Suite session (`business.facebook.com`).
- **Target Selection**: Use `target_id="me"` for the primary/currently active page, or specify the numerical `page_id` when managing multiple business pages.

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
1. **Publish to Facebook Page Page**:
   ```python
   fb_publish(
       target_type="page",
       target_id="me",
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
       target_id="me",
       post_type="reel",
       media_paths=["/path/to/reel_video.mp4"],
       thumbnail_path="/path/to/cover_image.png",
       run_at_timestamp=1732000000,
       title="Stop Waiting for Perfection",
       caption="⚡ Action creates clarity...",
       hashtags=["#ReelsViral", "#Focus", "#Discipline"]
   )
   ```

---

## 6. Mandatory Sequential Execution Order Rule (STRICT WORKFLOW PIPELINE)

Every publication or scheduling action on Meta Business Suite MUST execute in this exact, immutable order:

1. **Step 1: Meta Business Suite Login & Session Verification (FIRST STEP)**
   - Check and verify active login session on `business.facebook.com`.
   - If unauthenticated, open browser for one-time login verification and wait for user completion. Never spam login checks.
2. **Step 2: Managed Facebook Page Target Selection**
   - Confirm routing: `target_type="page"`, `target_id="me"` (or numerical Page ID).
   - Direct all actions strictly to the managed Page composer in Meta Business Suite.
3. **Step 3: Content Preparation & Anti-Duplicate Check**
   - Structure viral SEO package: Title + multiline description (`\n\n` preserved) + 3 to 6 targeted `#Hashtags`.
   - Verify SHA-256 hash against published content and queued jobs to prevent duplicate uploads.
4. **Step 4: In-Memory Asset & Custom Thumbnail / Cover Injection**
   - Ingest media files via in-memory `DataTransfer` buffer directly in RAM (<400ms).
   - For Video/Reel: Open **Edit Video -> Thumbnail** or **Reel Cover -> Upload cover** and upload custom thumbnail (strictly never attach as a second post photo).
5. **Step 5: Anti-Ad Organic Shield Verification**
   - Inspect and confirm that the "Make this an ad post" switch is strictly **OFF** for 100% organic algorithmic distribution.
6. **Step 6: Synthetic Paste & Final Publish or Schedule**
   - Paste formatted text into the Page Create Post dialog using synthetic clipboard paste (<100ms). Strictly avoid feed comment boxes.
   - **Immediate Post**: Click the native **"Publish"** button.
   - **Scheduled Post**: Toggle the native **"Set date and time"** switch, configure the scheduled date/time, and click **"Schedule"**.
