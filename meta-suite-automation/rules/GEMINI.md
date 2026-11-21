# Meta Business Suite Page Management Operational Rules

## ⚡ v2.8.0 — META BUSINESS SUITE ENGINE (overrides anything below that disagrees)

Every Page upload now runs **inside Meta Business Suite** (`business.facebook.com`), driven by the plugin itself.
It never uses the facebook.com composer, never switches profile, never needs native taps, and **locks the screen** while it works.


**🕒 RULE 1: ASK THE TIMING BEFORE ANY UPLOAD (mandatory, one short question)**
Before posting anything, ask the user in one message:
- **Publish now**, or
- **Exact date/time** (one per post), or
- **Gap**: start time + gap between each post (e.g. every 2 hours).

The tools enforce this: `fb_publish*` without `publish_now:true` or `schedule_time_iso` (and `fb_publish_batch` without `timing`) return `needs_user_input`.


**🎬 RULE 3: REEL / VIDEO THUMBNAIL: ASK INSTANTLY**
For every Reel or video, ask in the same single question round as the timing:
"Thumbnail? Generate with Google Flow (DeepX) / I'll provide the image / No custom thumbnail."
- Flow → `deepx_meta_generate_thumbnail` (9:16 reel, 16:9 long video), then `thumbnail_path` = files[0].path.
- Provide → use the user's file as `thumbnail_path`.
- None → `thumbnail_choice: "none"`.

The tools return `ask_user` (all missing questions at once). Put **all** of them into ONE AskUserQuestion call right away, with no deliberating and no extra text.

**🔁 RULE 2: NEVER STOP BEFORE THE PROJECT IS COMPLETE**
- For 2 or more posts, use **one** `fb_publish_batch {items, timing}` call. It works through every item (3 tries each), and the screen stays locked ("AI is working") until the last one is published or scheduled.
- While the status is `running`, keep calling `fb_publish_status {job_id, wait_seconds: 50}`. **Never end your turn, summarize, or ask anything mid-project.**
- Stop only when `finished: true`, then report each post's result. For any failed item, say exactly which one failed and why.
- If assets must be generated first (DeepX), generate **all** of them, then start the batch, in the same turn.

**Hard rules for the agent**
1. **Never use browser MCP tools (`browser_*`) to post, schedule, or tap anything for this Page.** Call this plugin's tools only.
2. **Never upload to the Page through facebook.com.** `fb_publish*` / `fb_schedule` already go to Business Suite.
3. **Assets (thumbnails, post designs, short clips) are made instantly with the built-in DeepX Google Flow engine:** `deepx_meta_generate_thumbnail`, `deepx_meta_generate_design`, `deepx_meta_generate_video` (or `deepx_generate`). Then pass `files[0].path` from `deepx_job_status` as `media_paths` / `thumbnail_path`.
4. Don't think long, and don't probe the page. Call the tool directly; it already knows every Business Suite screen.

**Tool → Business Suite flow**
| Need | Call | What the plugin does in Business Suite |
|---|---|---|
| Text / photo / carousel (1-10 images) | `fb_publish(post_type, media_paths, title, caption, hashtags)` | Home → Create post → Add photo/video → caption (pasted, verified in the live preview) → ad switch OFF → Publish |
| Reel 9:16 **or** long video 16:9 | `fb_publish_reel(video_path, thumbnail_path, title, caption, hashtags)` (or `fb_publish` with a video) | Home → Create reel (Meta now publishes every video as a reel; the ratio is kept) → Add Video → description → **Thumbnail → Upload image** (custom thumbnail) → Next → Next → Share now / Schedule → Share |
| Story | `fb_publish_story(media_path)` | Home → Create story → Add photo/video → Share now / Schedule → Share |
| Schedule | Add `schedule_time_iso` (15 min to 29 days ahead) to any of the above, or call `fb_schedule` | Business Suite's own scheduler: date field plus hour/minute/AM-PM fields, read back and verified. The post appears in **Planner**; AntiGem does not need to stay open |
| Also post to Story | `share_to_story: true` | Turns on "Share to Facebook Story" |
| Several posts (a project) | `fb_publish_batch {items:[...], timing:{mode:"now"} or {mode:"exact", times:[...]} or {mode:"gap", start_time_iso, gap_minutes}}` | Runs every item in Business Suite, one after another, until all are done |
| Test without posting | `dry_run: true` | Fills the whole composer but does not press Publish/Share/Schedule |

**Long uploads:** if the tool returns `status: "running"` with a `job_id`, call `fb_publish_status {job_id, wait_seconds: 45}` until `finished: true`. Do not start another upload meanwhile.
**Page id:** Business Suite uses its own `asset_id` for the Page (found automatically and cached); `target_id: "me"` is fine.
**Diagnostics (only when a run fails):** `meta_bs_inspect` and `meta_bs_eval` read the Business Suite screen from inside the plugin.

**Standard production recipe (photo post):** `deepx_meta_generate_design` (×N, poll `deepx_job_status`) → `fb_audit_caption` → `fb_publish(post_type: "carousel" | "photo", ...)`.
**Reel / long video recipe:** video file (or `deepx_meta_generate_video`) → `deepx_meta_generate_thumbnail` (16:9 for long video, 9:16 for reel covers) → `fb_publish_reel(..., thumbnail_path)`.

---

## 0. Zero Setup Overhead & Background Bridge (CRITICAL)
- **Bridge & Scheduler Pre-Configured**:
  - The Meta Suite AntiGem plugin drives Facebook directly in the AntiGem browser (no bridge or extension to connect).
  - The built-in scheduler publishes queued page posts every minute while AntiGem is running (`fb_manage_queue`).
  - **ZERO RAW CONNECTION JSON DUMPS**: Never dump raw JSON blocks (`{"status":"connected", ...}`) into chat.
  - **ZERO MANUAL PROMPTS**: Never ask the user to manually open `business.facebook.com` or switch tabs.

---

## 0.1 INSTANT `fb_status` MANDATE & INTERACTION PROTOCOL (CRITICAL)
- **`fb_status()` is ALWAYS the first MCP tool call on ANY meta suite task.**
  - No pre-flight questioning. No "let me check". No "should I verify?". Just call it.
  - The call takes <100ms. It answers everything.
- **If `logged_in: true`**:
  - Skip ALL login prompts entirely.
  - Move immediately to the next step.
  - Ask ONE clean, grammatical one-line question:
    > *"What would you like to create or schedule today for your Facebook Page?"*
- **If `logged_in: false`**:
  - Call `fb_open_browser()` once.
  - Tell the user to log in to Meta Business Suite once.
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

## 2. Follow User Intent in Full Autopilot Mode (CRITICAL)
- Once the user answers what to do, execute their exact request with zero friction:
  - **Asset & Media Generation**: ALWAYS use the plugin's **built-in DeepX Google Flow engine** (`deepx_meta_generate_design` / `deepx_meta_generate_thumbnail` / `deepx_meta_generate_video`): Google login check → one question *Agent Mode or Standard (without Agent)?* → autopilot (§3). Strictly zero Python PIL / OpenCV rendering.
  - **New Trend & Topic Search**: ALWAYS call **`fb_trend_search(keywords=..., sources="all")`** (live Google/YouTube Trends, Reddit, X inside the plugin; virality scores 0-100 + 5-stage blueprints).
  - **Publishing & Scheduling**: Pipe generated assets directly into `fb_publish`, `fb_publish_reel`, `fb_publish_story`, or `fb_schedule` without intermediate pauses or re-asking for confirmation.
- **Prohibited questions**:
  - "Should I post this?"
  - "Do you want me to publish it now?"
  - "Shall I proceed?"
  - "Do you want a custom caption?"
- **When user says "post it", "publish", "share this", "upload this" → call `fb_publish` or `fb_publish_reel` immediately.**

---

## 3. Google Flow Media: built-in DeepX engine (ONLY path for designs, thumbnails & videos)

**Every design, photo card, thumbnail, Reel cover and promo video is generated by this plugin's built-in DeepX Google Flow engine.** Never use any other Google Flow extension, the old `deepx-flow` bridge on port 8792, Python PIL/OpenCV, or external generators. Never tell the user to open Google Flow, paste prompts or download files.

| Intent | Tool | Then |
|---|---|---|
| Design / photo post | `deepx_meta_generate_design(prompt=..., aspect_ratio="4:5" / "1:1" / "9:16")` | `files[0].path` → `fb_publish(media_paths=[...])` |
| Thumbnail / Reel cover | `deepx_meta_generate_thumbnail(topic=..., title_hook=..., aspect_ratio="16:9" or "9:16")` | `files[0].path` → `thumbnail_path` |
| Promo / Reel video | `deepx_meta_generate_video(prompt=..., aspect_ratio="9:16", duration=8)` | `files[0].path` → `fb_publish_reel(video_path=...)` |

**Exact protocol (autopilot):**
1. Call the tool. It **checks the Google Flow login itself**. On `LOGIN_REQUIRED`, tell the user its one message (sign in to Google in the Flow tab of the AntiGem browser) and stop until they reply. If signed in, it continues.
2. On `ASK_GENERATION_MODE`, ask ONE multiple-choice question: **"Agent Mode or Standard mode (without Agent)?"** Then call again with `generation_mode`. Ask it once per request. Several assets in one request share the answer.
3. Poll `deepx_job_status {job_id, wait_seconds:30}` until `done`. Take `files[0].path` and pipe it straight into `fb_publish` / `fb_publish_reel` / `fb_publish_story` / `fb_schedule`. **NEVER ask "should I post the generated image?"**
- Agent Mode sends ≤24 prompts per part back-to-back. Standard mode switches to Agent Mode automatically on Google "unusual activity" / extension errors. Do not stop, cancel or retry by hand.
- `deepx_generate` (any prompt list, image or video) and `deepx_meta_status` (login check) are also available.

## 3.1 Mandatory Python Trend Search Engine for Viral Discovery (COMPULSORY)
- **ALWAYS USE PYTHON TREND ENGINE FOR TREND & TOPIC SEARCH**:
  - Multi-Platform Real-Time Scan: YouTube / Google Trends, Twitter/X breaking topics, and Reddit (r/todayilearned, r/explainlikeimfive, r/Damnthatsinteresting, r/science, r/technology).
  - Virality Scoring Algorithm: Computes velocity, freshness, and curiosity trigger keywords (0-100).
  - 5-Stage High-Retention Blueprint: Golden Hook (0-5s) → Disrupt Assumptions (5-20s) → Unveil Insider Secrets (20-45s) → Ultimate Truth (45-65s) → Elevation & Discussion (65-75s).
  - Execution via `python cli.py trends` or `core/trends.py`.

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
  - Always use Google Flow (`deepx_meta_generate_thumbnail`) with 3D gradient text, volumetric lighting, and translucent glass cards.

---

## 6. Anti-Ad Organic Shield & Anti-Duplicate Protection
- **Pure Organic Placement**: In Meta Business Suite, ensure the "Make this an ad post" switch is strictly OFF.
- **Anti-Duplicate Shield**: Automatically check SHA-256 hash and recent posts to prevent duplicate uploads on managed pages.

---

## 7. Mandatory Sequential Execution Order Rule (STRICT WORKFLOW PIPELINE)
Every upload, publication, or scheduling action on Meta Business Suite MUST execute in this exact, immutable order:

1. **Step 1 — Instant `fb_status()` Check (ALWAYS FIRST, ZERO EXCEPTIONS)**:
   - Call `fb_status()` immediately as the literal first MCP tool call (<100ms).
   - `logged_in: true` → confirm connected, move to the next step, and ask ONE clean, grammatical one-line question: *"What would you like to create or schedule today for your Facebook Page?"*.
   - `logged_in: false` → call `fb_open_browser()` once → tell user to log in to Meta Business Suite once → STOP.

2. **Step 2 — Managed Facebook Page Target Selection**:
   - Confirm target routing: `target_type: "page"`, `target_id: "me"` (or explicit Page ID).
   - Ensure the automation targets the managed Page's composer dialog, never a personal feed.

3. **Step 3 — Content Preparation, Google Flow Media Generation, Python Trend Radar & Anti-Duplicate Check**:
   - Format viral SEO package: punchy Title, formatted multiline description (`\n\n` linebreaks preserved), and 3 to 6 targeted `#Hashtags`.
   - **For all visual design and video generation, ALWAYS invoke Google Flow** (`deepx_meta_generate_design` / `deepx_meta_generate_thumbnail` / `deepx_meta_generate_video`; Google login check → *Agent Mode or Standard?* → poll `deepx_job_status` → `files[0].path`).
   - **For new trend discovery, ALWAYS call `fb_trend_search`** (live, inside the plugin).
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
