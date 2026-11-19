# Meta Business Suite Page Management Operational Rules

## 0. Zero Setup Overhead & Background Bridge (CRITICAL)
- **Bridge & Scheduler Pre-Configured**:
  - The MCP server `meta-scheduler-mcp` connects to the browser extension via WebSocket at `ws://127.0.0.1:8765`.
  - The SQLite APScheduler daemon actively ticks and processes queued page posts.
  - **ZERO RAW CONNECTION JSON DUMPS**: Never dump raw JSON blocks (`{"status":"connected", ...}`) into chat.
  - **ZERO MANUAL PROMPTS**: Never ask the user to manually open `business.facebook.com` or switch tabs.

---

## 0.1 INSTANT `fb_status` MANDATE & INTERACTION PROTOCOL (CRITICAL)
- **`fb_status()` is ALWAYS the first MCP tool call on ANY meta suite task.**
  - No pre-flight questioning. No "let me check". No "should I verify?". Just call it.
  - The call takes <100ms. It answers everything.
- **If `logged_in: true`**:
  - Skip ALL login prompts entirely.
  - Confirm connection and authentication cleanly.
  - **STRICT BAN ON POST OR REEL QUESTIONS**: NEVER ask "What would you like to post today?", "Do you want to create a post or reel?", or ask content format questions.
  - **ONLY ASK**: *"Do you want to use Agent Mode for asset generation, or not?"*
- **If `logged_in: false`**:
  - Call `fb_open_browser()` once.
  - Ask the user to sign in one time.
  - Stop and wait — never loop, never ask again.
- **NEVER ask "are you logged in?", "should I check the bridge?", or "want me to connect?" before calling `fb_status`.**

---

## 1. Focused Page Management & Routing (STRICT SOURCE OF TRUTH)
- **Strict Scope**: Meta Suite Automation is **dedicated 100% to Facebook Page Management via Meta Business Suite**.
- **Managed Page Routing**:
  - Target: Dynamic discovery of connected Facebook Pages via Meta Business Suite session (`business.facebook.com`).
  - Routing: `target_type: "page"`, `target_id: "<page_id>"` (or `"me"` to target the currently selected managed page).
  - Multi-Page Support: Pass explicit `page_id` when targeting specific assets; otherwise defaults to active managed page.

---

## 2. Full Autopilot Mode — Zero Alignment Questions (CRITICAL)
- **Once the user describes what to post → dispatch immediately. No confirmation round.**
- **PROHIBITED questions**:
  - "What would you like to post today?"
  - "Do you want a post or reel?"
  - "Should I post this?"
  - "Do you want me to publish it now?"
  - "Shall I proceed?"
  - "Do you want a custom caption?"
  - "Should I schedule or post immediately?"
- **ALLOWED questions**:
  - Only ask login if `logged_in: false`.
  - Only ask: *"Do you want to use Agent Mode for asset generation, or not?"*
  - If user explicitly says "schedule it" but gives no time → "What time should I schedule it?"
- **When user says "post it", "publish", "share this", "upload this" → call `fb_publish` or `fb_publish_reel` immediately.**

---

## 3. DeepX Auto-Routing for AI Media (COMPULSORY — ZERO PERMISSION NEEDED)
- **When Agent Mode is selected or user requests AI media**:
  - Automatically call DeepX tools without asking.
  - Design / photo post → `deepx_meta_generate_design(prompt=<desc>)`
  - Thumbnail → `deepx_meta_generate_thumbnail(prompt=<desc>)`
  - Reel / promo video → `deepx_meta_generate_video(prompt=<desc>)`
- **After generation completes → pipe result DIRECTLY to `fb_publish` / `fb_publish_reel`. NEVER ask "should I post the generated image?"**
- **Full pipeline is atomic: generate → pipe → publish. Zero interruptions between steps.**

---

## 4. Fast Copy-Paste Method & Anti-Lag Protocol (CRITICAL)
- **INSTANT PIPELINE (< 2s Reasoning)**:
  - Detect intent → craft SEO package → call MCP tool → done.
  - **STRICT BAN ON EXPLORATORY PROBING**: Never read controller source code, SQLite databases, or internal logs before posting.
- **COPY-PASTE FOR ALL UPLOADS (BAN SLOW TYPING)**:
  - Text is pasted directly into the page composer via synthetic clipboard `<100ms` events to preserve paragraphs (`\n\n`) and avoid slow typing timeouts.
- **STRICT ANTI-COMMENT-BOX LOCK**:
  - Exclusively target the Page Create Post Composer dialog. Strictly never paste or type into feed comment boxes or reply threads.

---

## 5. Human-Grade In-Memory Media & Thumbnail Law
- **Single-Shot In-Memory Media Attachment**:
  - Attach images and videos via browser `DataTransfer` buffers directly in RAM. Never trigger operating system file dialogs.
- **Real Video & Reel Thumbnail Engine**:
  - Custom thumbnails and Reel covers must be uploaded inside **Edit Video → Thumbnail** or **Reel Cover → Upload cover**, never attached as duplicate feed photos.
- **Mandatory Title & Hashtags**:
  - Every page post, reel, and video must have a punchy viral **Title** and **3 to 6 targeted `#Hashtags`**.
- **AI Image Model ONLY for Thumbnails**:
  - Never render thumbnails with Python `PIL`/`OpenCV`. Use `deepx_meta_generate_thumbnail` with 3D gradient text, volumetric lighting, and translucent glass cards.

---

## 6. Anti-Ad Organic Shield & Anti-Duplicate Protection
- **Pure Organic Placement**: In Meta Business Suite, ensure the "Make this an ad post" switch is strictly OFF.
- **Anti-Duplicate Shield**: Automatically check SHA-256 hash and recent posts to prevent duplicate uploads on managed pages.

---

## 7. Mandatory Sequential Execution Order Rule (STRICT WORKFLOW PIPELINE)
Every upload, publication, or scheduling action on Meta Business Suite MUST execute in this exact, immutable order:

1. **Step 1 — Instant `fb_status()` Check (ALWAYS FIRST, ZERO EXCEPTIONS)**:
   - Call `fb_status()` immediately as the literal first MCP tool call.
   - `logged_in: true` → confirm connected, ask ONLY: *"Do you want to use Agent Mode for asset generation, or not?"*, and proceed.
   - `logged_in: false` → call `fb_open_browser()` once → ask user to sign in once → STOP.
   - Never ask post or reel questions.

2. **Step 2 — Managed Facebook Page Target Selection**:
   - Confirm target routing: `target_type: "page"`, `target_id: "me"` (or explicit Page ID).
   - Ensure the automation targets the managed Page's composer dialog, never a personal feed.

3. **Step 3 — Content Preparation, AI Media Generation & Anti-Duplicate Check**:
   - Format viral SEO package: punchy Title, formatted multiline description (`\n\n` linebreaks preserved), and 3 to 6 targeted `#Hashtags`.
   - **If Agent Mode / AI media requested → call `deepx_meta_generate_design` / `deepx_meta_generate_thumbnail` / `deepx_meta_generate_video` HERE, before proceeding.**
   - Compute SHA-256 hash of media and text; verify against recent posts to guarantee zero duplicate submissions.

4. **Step 4 — In-Memory Asset & Custom Thumbnail / Cover Injection**:
   - Ingest media files via in-memory `DataTransfer` buffer directly in RAM (<400ms), suppressing OS file dialogs.
   - For Video/Reel: Open **Edit Video → Thumbnail** or **Reel Cover → Upload cover** and upload custom thumbnail (strictly never attach as a second post photo).

5. **Step 5 — Anti-Ad Organic Shield Verification**:
   - Inspect and confirm that the "Make this an ad post" switch is strictly **OFF** for 100% organic algorithmic distribution.

6. **Step 6 — Synthetic Paste & Final Publish or Schedule**:
   - Paste formatted text into the Page Create Post dialog using synthetic clipboard paste (<100ms). Strictly avoid feed comment boxes.
   - **Immediate Post**: Click the native **"Publish"** button.
   - **Scheduled Post**: Toggle the native **"Set date and time"** switch, configure the scheduled date/time, and click **"Schedule"**.
