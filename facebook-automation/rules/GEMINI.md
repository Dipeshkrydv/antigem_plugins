# Facebook Automation & SEO Studio Operational Rules

## 0. Zero Setup Overhead & Background Bridge (CRITICAL)
- **Bridge & Scheduler Pre-Configured**:
  - The MCP server `meta-scheduler-mcp` connects to the browser extension via WebSocket at `ws://127.0.0.1:8765`.
  - The SQLite APScheduler daemon actively ticks and processes queued posts.
  - **ONE-TIME CONNECTION CHECK**: Call `bridge_status_and_sync` at most ONCE per session. Never poll status in loops.
  - **ZERO RAW CONNECTION JSON DUMPS**: Never dump raw JSON blocks (`{"status":"connected", ...}`) into chat. Simply declare: *"Connected! Facebook Automation & SEO Studio are ready."*
  - **ZERO MANUAL PROMPTS**: Never ask the user to manually open `facebook.com` or switch tabs.

---

## 1. Account Routing & Profile Grounding
- **Dynamic Profile Routing**:
  - Automatically identifies the authenticated Facebook profile via active browser session (`facebook.com`).
  - Routing: `target_type: "profile"`, `target_id: "me"` (or user-specified profile/page ID).
  - Zero hardcoded personal profile IDs: Dynamically anchored to the logged-in user session.

---

## 2. Fast Copy-Paste Method & Anti-Lag Protocol (CRITICAL)
- **INSTANT 2-STEP PIPELINE (< 2s Reasoning)**:
  - Step 1: Craft the high-impact visual design / prompt / viral copy.
  - Step 2: Call `publish_or_schedule_facebook` directly.
  - **STRICT BAN ON EXPLORATORY PROBING**: Never read controller source code, SQLite databases, or internal logs before posting.
- **COPY-PASTE FOR ALL UPLOADS (BAN SLOW TYPING)**:
  - Text is pasted directly into the composer via synthetic clipboard `<100ms` events to preserve paragraphs (`\n\n`) and avoid slow typing timeouts.
- **STRICT ANTI-COMMENT-BOX LOCK**:
  - Exclusively target the Create Post Composer dialog. Strictly never paste or type into feed comment boxes or reply threads.

---

## 3. Human-Grade In-Memory Media & Thumbnail Law
- **Single-Shot In-Memory Media Attachment**:
  - Attach images and videos via browser `DataTransfer` buffers directly in RAM. Never trigger operating system file dialogs.
- **Real Video & Reel Thumbnail Engine**:
  - Custom thumbnails and Reel covers must be uploaded inside **Edit Video -> Thumbnail** or **Reel Cover -> Upload cover**, never attached as duplicate feed photos.
- **Mandatory Title & Hashtags**:
  - Every post, reel, and video must have a punchy viral **Title** and **3 to 6 targeted `#Hashtags`**.
- **AI Image Model ONLY for Thumbnails**:
  - Never render thumbnails with Python `PIL`/`OpenCV`. Use DeepX Google Flow / AI Image Model with 3D gradient text, volumetric lighting, and translucent glass cards.

---

## 4. DeepX Google Flow Integration (100% Script Fidelity)
- **DeepX Bridge Active on `ws://127.0.0.1:8792/ws`**:
  - When image design or video generation is needed, route through DeepX Google Flow (`deepx-flow`).
  - Strict fidelity to user story, characters, and data. Maintain protagonist reference cards across all scenes.

---

## 5. Anti-Duplicate Protection & Sentinel Guard
- **Anti-Duplicate Shield**: Automatically check SHA-256 hash and recent posts to prevent duplicate uploads.
