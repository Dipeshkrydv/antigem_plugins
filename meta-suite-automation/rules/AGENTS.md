# Meta Business Suite Page Management Operational Rules

## 0. Zero Setup Overhead & Background Bridge (CRITICAL)
- **Bridge & Scheduler Pre-Configured**:
  - The MCP server `meta-scheduler-mcp` connects to the browser extension via WebSocket at `ws://127.0.0.1:8765`.
  - The SQLite APScheduler daemon actively ticks and processes queued page posts.
  - **ONE-TIME CONNECTION CHECK**: Call `bridge_status_and_sync` at most ONCE per session. Never poll status in loops.
  - **ZERO RAW CONNECTION JSON DUMPS**: Never dump raw JSON blocks (`{"status":"connected", ...}`) into chat. Simply declare: *"Connected! Meta Business Suite Page Management is ready."*
  - **ZERO MANUAL PROMPTS**: Never ask the user to manually open `business.facebook.com` or switch tabs.

---

## 1. Focused Page Management & Routing (STRICT SOURCE OF TRUTH)
- **Strict Scope**: Meta Suite Automation is **dedicated 100% to Facebook Page Management via Meta Business Suite**.
- **Managed Page Routing**:
  - Target: Dynamic discovery of connected Facebook Pages via Meta Business Suite session (`business.facebook.com`).
  - Routing: `target_type: "page"`, `target_id: "<page_id>"` (or `"me"` to target the currently selected managed page).
  - Multi-Page Support: Pass explicit `page_id` when targeting specific assets; otherwise defaults to active managed page.

---

## 2. Fast Copy-Paste Method & Anti-Lag Protocol (CRITICAL)
- **INSTANT 2-STEP PIPELINE (< 2s Reasoning)**:
  - Step 1: Craft the high-impact visual design / prompt / viral copy.
  - Step 2: Call `publish_or_schedule_facebook` (with `target_type: "page"`) directly.
  - **STRICT BAN ON EXPLORATORY PROBING**: Never read controller source code, SQLite databases, or internal logs before posting.
- **COPY-PASTE FOR ALL UPLOADS (BAN SLOW TYPING)**:
  - Text is pasted directly into the page composer via synthetic clipboard `<100ms` events to preserve paragraphs (`\n\n`) and avoid slow typing timeouts.
- **STRICT ANTI-COMMENT-BOX LOCK**:
  - Exclusively target the Page Create Post Composer dialog. Strictly never paste or type into feed comment boxes or reply threads.

---

## 3. Human-Grade In-Memory Media & Thumbnail Law
- **Single-Shot In-Memory Media Attachment**:
  - Attach images and videos via browser `DataTransfer` buffers directly in RAM. Never trigger operating system file dialogs.
- **Real Video & Reel Thumbnail Engine**:
  - Custom thumbnails and Reel covers must be uploaded inside **Edit Video -> Thumbnail** or **Reel Cover -> Upload cover**, never attached as duplicate feed photos.
- **Mandatory Title & Hashtags**:
  - Every page post, reel, and video must have a punchy viral **Title** and **3 to 6 targeted `#Hashtags`**.
- **AI Image Model ONLY for Thumbnails**:
  - Never render thumbnails with Python `PIL`/`OpenCV`. Use DeepX Google Flow / AI Image Model with 3D gradient text, volumetric lighting, and translucent glass cards.

---

## 4. DeepX Google Flow Integration (100% Script Fidelity)
- **DeepX Bridge Active on `ws://127.0.0.1:8792/ws`**:
  - When image design or video generation is needed, route through DeepX Google Flow (`deepx-flow`).
  - Strict fidelity to user story, characters, and data. Maintain protagonist reference cards across all scenes.

---

## 5. Anti-Ad Organic Shield & Anti-Duplicate Protection
- **Pure Organic Placement**: In Meta Business Suite, ensure the "Make this an ad post" switch is strictly OFF.
- **Anti-Duplicate Shield**: Automatically check SHA-256 hash and recent posts to prevent duplicate uploads on managed pages.

---

## 6. Mandatory Sequential Execution Order Rule (STRICT WORKFLOW PIPELINE)
Every upload, publication, or scheduling action on Meta Business Suite MUST execute in this exact, immutable order:

1. **Step 1: Meta Business Suite Login & Session Verification (FIRST STEP)**:
   - Check and verify active login session on `business.facebook.com`.
   - If not logged in, trigger one-time browser login, prompt the user once to sign in inside the open tab, and halt further posting actions until verified. Never loop login checks.
2. **Step 2: Managed Facebook Page Target Selection**:
   - Confirm target routing: `target_type: "page"`, `target_id: "me"` (or explicit Page ID).
   - Ensure the automation targets the managed Page's composer dialog, never a personal feed.
3. **Step 3: Content Preparation & Anti-Duplicate Check**:
   - Format viral SEO package: punchy Title, formatted multiline description (`\n\n` linebreaks preserved), and 3 to 6 targeted `#Hashtags`.
   - Compute SHA-256 hash of media and text; verify against recent posts to guarantee zero duplicate submissions.
4. **Step 4: In-Memory Asset & Custom Thumbnail / Cover Injection**:
   - Ingest media files via in-memory `DataTransfer` buffer directly in RAM (<400ms), suppressing OS file dialogs.
   - For Video/Reel: Open **Edit Video -> Thumbnail** or **Reel Cover -> Upload cover** and upload custom thumbnail (strictly never attach as a second post photo).
5. **Step 5: Anti-Ad Organic Shield Verification**:
   - Inspect and confirm that the "Make this an ad post" switch is strictly **OFF** for 100% organic algorithmic distribution.
6. **Step 6: Synthetic Paste & Final Publish or Schedule**:
   - Paste formatted text into the Page Create Post dialog using synthetic clipboard paste (<100ms). Strictly avoid feed comment boxes.
   - **Immediate Post**: Click the native **"Publish"** button.
   - **Scheduled Post**: Toggle the native **"Set date and time"** switch, configure the scheduled date/time, and click **"Schedule"**.
