---
name: meta-suite-automation
description: "Master Autonomous Meta Suite Production Engine (v2.8.0). Enterprise Meta Business Suite Facebook Page management and scheduling engine. Enforces 1-click publishing & scheduling of Page Reels (9:16), Long Videos (16:9), Photos, Stories, and Announcements with custom video thumbnails/covers, in-memory DataTransfer injection, <100ms synthetic clipboard paste, anti-ad organic shield, anti-comment box firewall, and 100% script-fidelity DeepX Google Flow AI media generation."
---

# Master Meta Suite Page Management Engine (v2.8.0)

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


**✍️ RULE 4: CAPTION PERMISSION BEFORE POSTING**
Before any post, show the user the **exact final caption** (title + text + hashtags; every caption for a batch) in the same single question round:
"Use this caption? Yes / Edit it / Write a new one / Post without caption."
Send `caption_approved: true` only after a "Yes" (or after applying the user's edits). The tools refuse to post an unapproved caption.

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

The definitive autonomous production, publishing, and scheduling engine dedicated 100% to **Facebook Page Management via Meta Business Suite**. Zero delays. Zero questions. Zero friction.

---

## 0. INSTANT BOOT — Call `fb_status` AS LITERAL FIRST TOOL CALL (CRITICAL MANDATE)

**On ANY meta suite task, page post, reel, story, or publish request, the FIRST tool call is ALWAYS `fb_status`. No exceptions.**

```python
# ALWAYS FIRST — no questions before this
result = fb_status()
```

**Decision tree after `fb_status`:**

| `result.logged_in` | Action |
|---|---|
| `true` | Move immediately to the next step. Ask ONE clean, grammatical one-line question: *"What would you like to create or schedule today for your Facebook Page?"* |
| `false` | Call `fb_open_browser()` once → tell user to sign in to Meta Business Suite once → STOP until confirmed |

**EXECUTION RULES ACCORDING TO USER'S RESPONSE:**
1. **Asset Generation**: ALWAYS use the plugin's **built-in DeepX Google Flow engine** (`deepx_meta_generate_design` / `deepx_meta_generate_thumbnail` / `deepx_meta_generate_video`): Google login check → one question *Agent Mode or Standard (without Agent)?* → autopilot (§3).
2. **New Trend & Topic Search**: ALWAYS call **`fb_trend_search(keywords=..., sources="all", limit=5)`**. It scans Google/YouTube Trends, Reddit and X live inside the plugin and returns virality scores (0-100) and 5-stage blueprints. No Python needed.
3. **Dispatch & Autopilot**: Once generated, pipe assets directly into `fb_publish`, `fb_publish_reel`, `fb_publish_story`, or `fb_schedule` with zero intermediate confirmation pauses.

---

## 1. Managed Facebook Page Routing & Asset Discovery

| Target Surface | Destination | Routing Parameters | Capabilities |
| :--- | :--- | :--- | :--- |
| **Meta Business Suite Page** | Managed Facebook Page | `target_type: "page"`, `target_id: "me"` (or `<page_id>`) | Dedicated Page composer, organic reach, multi-page selection |

- **Dynamic Page Discovery & Acting as the Page**: Managed Pages are discovered automatically (`meta_list_pages`; cached). Before every Page post, Reel or Story the engine opens the Page and **publishes through Meta Business Suite for that Page (no profile switch needed).
- **Target Selection**: `target_id="me"` = default Page (first managed Page, or the one set with `meta_set_default_page`). Use a Page URL, username or numeric ID when managing several Pages.

---

## 2. Autopilot Intent → Dispatch Pipeline (ZERO ALIGNMENT QUESTIONS)

Once the user describes what to post, **proceed immediately** with no confirmation rounds:

### 2A. Photo / Image Post
```python
fb_publish(
    target_type="page", target_id="me",
    post_type="photo",
    media_paths=["<path_or_latest>"],
    title="<viral_title>",
    caption="<hook>\n\n<body>\n\n<CTA>",
    hashtags=["#tag1", "#tag2", "#tag3"]
)
```

### 2B. Reel (9:16 Vertical)
```python
fb_publish_reel(
    target_type="page", target_id="me",
    media_path="<reel_video.mp4>",
    thumbnail_path="<cover.png>",
    title="<viral_title>",
    caption="<hook>\n\n<body>\n\n<CTA>",
    hashtags=["#tag1", "#tag2", "#tag3"]
)
```

### 2C. Scheduled Post (any format)
```python
fb_schedule(
    target_type="page", target_id="me",
    post_type="photo",   # or reel / video / story
    media_paths=["<path>"],
    run_at_timestamp=<utc_epoch>,
    title="<title>",
    caption="<caption>",
    hashtags=["#tag1", "#tag2"]
)
```

### 2D. Story
```python
fb_publish_story(
    target_type="page", target_id="me",
    media_path="<story_media>",
    story_text="<overlay_text_max_120_chars>"
)
```

### 2E. Long-Form Video (16:9)
```python
fb_publish(
    target_type="page", target_id="me",
    post_type="video",
    media_paths=["<video.mp4>"],
    thumbnail_path="<thumbnail.png>",
    title="<title>",
    caption="<caption>",
    hashtags=["#tag1", "#tag2"]
)
```

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

**ALWAYS USE PYTHON TREND ENGINE FOR TREND & TOPIC SEARCH:**
When the user asks to "find trends", "what's trending", "search topics", "viral ideas", or "what should I post about":
- **Multi-Source Real-Time Scan**: Automatically scans YouTube / Google Trends, Twitter/X breaking trends, and Reddit (r/todayilearned, r/explainlikeimfive, r/Damnthatsinteresting, r/science, r/technology).
- **Virality Scoring Algorithm**: Calculates velocity, freshness, and curiosity trigger keywords (0-100).
- **5-Stage Blueprint Generator**: Automatically structures findings into a high-retention video/post script (Golden Hook → Disrupt Assumptions → Unveil Insider Secrets → Ultimate Truth → Elevation & Discussion).
- **Execution**: `fb_trend_search(keywords="<topic>", sources="all", limit=5)` (MCP tool, live, no Python). Desktop CLI alternative: `python cli.py trends --keywords "<topic>"`.

---

## 4. Multi-Format Production Matrix

1. **Reels (9:16 Vertical)**:
   - Dedicated Reels composer (`/reels/create` or Meta Business Suite Reel drawer).
   - Custom cover image uploaded inside the native Reel Cover dialog.
   - 1-line hook + formatted multiline caption + 3–6 diamond hashtags.
2. **Long-Form Videos (16:9 Landscape)**:
   - Landscape video streaming via in-memory `DataTransfer`.
   - Custom thumbnail uploaded inside **Edit Video → Thumbnail** (strictly never attached as a second post photo).
3. **High-CTR Photo Posts**:
   - Single-image integrity: automatically verifies and purges stale draft photos before attaching.
   - Formatted description preserving blank lines (`\n\n`) between title, quote, bullets, and CTA.
4. **Stories (Photo, Video, or Text)**:
   - Direct dispatch to `/stories/create` with optional `story_text` overlay (up to 120 characters).
5. **Text Only**:
   - High-impact quote and philosophy posts with synthetic `<100ms` paste injection.

---

## 5. The Killer Scheduling Engine

- **Quick-Schedule Offsets**:
  - `+15 min`: Immediate next-slot broadcast.
  - `+1 hr`: Primary focus window.
  - `+3 hr`: Peak evening engagement slot.
  - `Tomorrow 9:00 AM`: Next morning wake-up rush.
- **Time Zone Engine**:
  - Automatically calculates local machine time and converts to UTC Unix epoch timestamp (`run_at_timestamp`).
  - Persisted in the plugin's storage (`fb_scheduled_jobs`); list / cancel / reschedule with `fb_manage_queue`.
  - The built-in 1-minute scheduler publishes due posts automatically while AntiGem is running. Missed slots are MOVED to the next safe slot, never posted in a burst.

### 5-0. Meta's own scheduler (recommended for every Page)
- `fb_meta_connect` once: scheduled Page posts are then created in **Meta's own scheduler** (official Graph API, the system behind Business Suite > Planner). Meta publishes them itself: no browser automation at posting time, and this device may be off.
- If `fb_meta_status` shows not connected, show the user the setup steps it returns (Meta developer app → Graph API Explorer token with pages_show_list, pages_read_engagement, pages_manage_posts → App ID + App Secret) and ask them to save them in a local JSON file and give you only the path (`credentials_file`). Never ask them to paste tokens into chat if a file is possible; never repeat a token.
- Meta takes scheduled posts up to ~30 days ahead: the plugin hands posts over automatically when they are within 28 days (about 3 per minute), so for a 2-month plan AntiGem only needs to be opened once every few weeks.
- Reels, stories, personal profiles and groups are not scheduled through the API: they post from this device at their time (AntiGem open).

### 5-1. "Generate everything, post 1 now, schedule the rest" (daily 25-30 Page posts)
1. Generate the designs with DeepX in Agent Mode bulk (`deepx_flow_agent_batch_queue`), poll until done, collect the file paths.
2. Write a different caption (3-6 hashtags) for every design.
3. ONE call: `fb_schedule_bulk {posts:[{caption, media_paths:[path], post_type:"photo"}, ...], posts_per_day: 30, publish_first_now: true}`.
4. Report: post #1 published (or why not), how many went to Meta's scheduler vs device, date range, warm-up, rejected items.
- The warm-up (6 → 14 → 22 → 30 over 4 weeks) is on by default. Only if the user confirms the Page ALREADY posts 25-30 times a day may they turn it off with `fb_safety_settings {action:"set", warmup:false}`.

### 5A. Bulk scheduling: a week or a month of content in one call
- For more than 3 posts use **`fb_schedule_bulk {posts:[...], start_date_iso, posts_per_day?, preferred_times?}`** (1-500 posts per call; call again for the next batch). Never loop `fb_schedule`.
- Every post must have its own caption AND its own photo/video: repeated captions and repeated images (even renamed copies) are rejected.
- **Pages: up to 30 posts/day.** Above 6/day a 4-week warm-up applies automatically (30/day: 6 → 14 → 22 → 30; 15/day: 6 → 9 → 12 → 15). Raising the limit later warms up again from today's level. Pages that already posted 8+/day on 5 of the last 14 days skip the warm-up.
- Above 20/day the posting hours widen to 07:00-23:00 and posts are spread evenly (~30 min apart at 30/day). Posts are NEVER fired back-to-back: bursts trigger Meta's "temporarily blocked / we limit how often you can post".
- **Personal profiles: max 3 posts/day, 2 h apart.** High volume is for Pages only. If the user asks for more on a profile, explain why and suggest a Page.
- More than 30/day is refused: offer 30/day.
- After the call, report: scheduled count, date range, posts per day (and the warm-up), rejected items and why. Do not call it again for the same posts.

### 5B. Page Safety Governor (always on, cannot be switched off)
| Rule | Default | Hard limit |
| --- | --- | --- |
| Page feed posts + reels per day | 3 | 30 (4-week warm-up above 6) |
| Reels per day | 2 | 4 |
| Stories per day | 3 | 10 |
| Personal profile posts per day | 3 | 3 (2 h apart) |
| Gap between Page posts | 120 min (auto-fits the day at high volume) | ≥ 25 min |
| Gap between stories | 60 min | ≥ 20 min |
| Posting hours (device time) | 08:00-22:00 (07:00-23:00 above 20/day) | ≥ 4 h window |
| Random timing offset | ±10 min (smaller when posts are dense) | ±20 min |
| Duplicate caption / duplicate image | rejected | rejected |
- Change limits with `fb_safety_settings {action:"set", ...}` (e.g. `max_posts_per_day: 20`). Values are clamped to the hard limits.
- Manual `fb_publish` also counts toward today's limit, and is refused within 10 min of the last post.
- **Auto-pause on any Meta warning** ("temporarily blocked", "we limit how often", checkpoint/security check, "community standards", "restricted"): the whole queue and manual posting stop. Tell the user to solve any check themselves in the AntiGem browser, wait 24-48 h, look at Page Quality / Account Status in Meta Business Suite, then `fb_manage_queue {action:"resume"}`. **Resuming after a warning automatically halves the daily volume and restarts the warm-up.** Never resume, retry, or work around a warning on your own.
- 3 failures in a row pause the queue for 6 hours. An interrupted post becomes `needs_review` and is never re-posted blindly.
- At high volume, content quality decides reach: original photos only (no reposted/watermarked images), no engagement bait ("like if…", "share to win"), varied captions, 3-6 relevant hashtags.

---

## 6. Viral SEO Caption Architecture

Every caption MUST follow this structure — no wall-of-text:

```
🔥 <Hook — bold 1-line claim or question>

<Body — 3-5 bullet points with emojis, scannable value>

<CTA — "Comment 'WORD' below" or "Save this post if...">

#hashtag1 #hashtag2 #hashtag3 #hashtag4 #hashtag5
```

Use `fb_seo_generate(topic=<user_topic>)` to auto-generate viral SEO packages when the user provides a topic.
Use `meta_viral_seo_generate(topic=<topic>, format=<post_type>)` for advanced format-specific viral copy.

---

## 7. Human-Grade Anti-Ban Execution Law

- **In-Memory File Input Interceptor**:
  - Intercepts dynamic in-memory `HTMLInputElement.prototype.click` calls from Meta Business Suite composer, attaching binary blobs via `DataTransfer` in `<400ms`.
- **Anti-Ad Organic Shield**:
  - Automatically verifies that the "Make this an ad post" switch is **OFF**, ensuring 100% organic algorithmic distribution.
- **Synthetic Clipboard Paste (<100ms)**:
  - Text is pasted directly into `div[contenteditable="true"]` via synthetic `ClipboardEvent("paste")` to preserve multiline paragraph formatting and avoid robotic character-by-character typing detection.
- **Anti-Comment Box Firewall**:
  - The automation strictly targets the Create Post Composer dialog and is firewalled from ever typing or pasting into feed comments or reply threads.

---

## 8. Mandatory Sequential Execution Order Rule (STRICT WORKFLOW PIPELINE)

Every publication or scheduling action on Meta Business Suite MUST execute in this exact, immutable order:

1. **Step 1 — Instant `fb_status` Check (ALWAYS FIRST, NO EXCEPTIONS)**
   - Call `fb_status()` immediately as the literal first tool call (<100ms).
   - If `logged_in: true` → confirm connected, move to the next step, and ask ONE clean, grammatical one-line question: *"What would you like to create or schedule today for your Facebook Page?"*.
   - If `logged_in: false` → call `fb_open_browser()` once → tell user to log in to Meta Business Suite once → STOP.
   - **NEVER ask status before calling `fb_status`.** The check is instant (<100ms).

2. **Step 2 — Managed Facebook Page Target Selection**
   - Confirm routing: `target_type="page"`, `target_id="me"` (or numerical Page ID).
   - Direct all actions strictly to the managed Page composer in Meta Business Suite.

3. **Step 3 — Content Preparation, Google Flow Media Generation, Python Trend Radar & Anti-Duplicate Check**
   - Structure viral SEO package: Title + multiline description (`\n\n` preserved) + 3 to 6 targeted `#Hashtags`.
   - Verify SHA-256 hash against published content and queued jobs to prevent duplicate uploads.
   - **For all visual design and video generation, ALWAYS invoke Google Flow** (`deepx_meta_generate_design` / `deepx_meta_generate_thumbnail` / `deepx_meta_generate_video`; Google login check → *Agent Mode or Standard?* → poll `deepx_job_status` → `files[0].path`).
   - **For new trend discovery, ALWAYS call `fb_trend_search`** (live, inside the plugin).

4. **Step 4 — In-Memory Asset & Custom Thumbnail / Cover Injection**
   - Ingest media files via in-memory `DataTransfer` buffer directly in RAM (<400ms).
   - For Video/Reel: Open **Edit Video → Thumbnail** or **Reel Cover → Upload cover** and upload custom thumbnail (strictly never attach as a second post photo).

5. **Step 5 — Anti-Ad Organic Shield Verification**
   - Inspect and confirm that the "Make this an ad post" switch is strictly **OFF** for 100% organic algorithmic distribution.

6. **Step 6 — Synthetic Paste & Final Publish or Schedule**
   - Paste formatted text into the Page Create Post dialog using synthetic clipboard paste (<100ms). Strictly avoid feed comment boxes.
   - **Immediate Post**: Click the native **"Publish"** button.
   - **Scheduled Post**: Toggle the native **"Set date and time"** switch, configure the scheduled date/time, and click **"Schedule"**.

## Shared browser tab (never blame other plugins)

Several AntiGem plugins share the Google Flow and Facebook tabs. Since this version the tab debugger is only held for a few seconds per upload and released, with automatic fallbacks, so "Another extension is attached to this tab" should no longer appear. If a tool error ever mentions a tab lock or another extension being attached, call the same tool again once with the same arguments. Do not ask the user to close tabs, disable other plugins, or restart AntiGem for this.
