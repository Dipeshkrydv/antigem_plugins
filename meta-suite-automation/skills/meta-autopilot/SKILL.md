---
name: meta-autopilot
description: >-
  Autonomous Meta Business Suite Page Management Autopilot. Use when the user requests to post, publish, or schedule anything (photos, reels, videos, stories, announcements, text posts) to managed Facebook Pages via Meta Business Suite, or mentions 'manage page', 'page scheduler', 'meta suite', 'schedule post to page', 'meta bridge', 'page automation', or 'handle my facebook page'. Enforces permanent one-time setup, zero-tab prompts (never ask the user to open tabs, switch windows, or click UI buttons), automatic media generation for zero-friction posts, authentic page grounding via Meta Business Suite (target_type: "page", target_id: "me" or explicit page ID), viral SEO hooks and hashtags, and continuous background dispatch via SQLite WAL and WebSocket bridge.
---

# Meta Business Suite Page Autopilot (v2.9.0)

## ⚡ v2.9.0 — META BUSINESS SUITE ENGINE (overrides anything below that disagrees)

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

This skill governs the high-speed, zero-interruption execution pipeline of the Meta Suite AntiGem plugin (its MCP tools drive the AntiGem browser directly; scheduled posts are stored in the plugin and published by its built-in 1-minute scheduler) to manage connected **Facebook Pages via Meta Business Suite** autonomously in the background.

---

## 0. CRITICAL BOOT MANDATE — `fb_status` IS ALWAYS LITERAL FIRST TOOL CALL

**No pre-flight questions. No status checks in prose. No "let me verify connection" text. Just call `fb_status()` immediately.**

```python
result = fb_status()   # <-- first tool call, every time, no exceptions
```

**Result routing:**
- `logged_in: true` → Say: *"Meta Suite ready. What would you like to post today?"* → proceed instantly
- `logged_in: false` → Call `fb_open_browser()` once → ask user to sign in once → wait, do not loop

**NEVER ask "are you logged in?", "want me to check?", or "should I connect first?" — `fb_status` answers all of that in <100ms.**

---

## 1. Zero Setup Overhead & Autonomous Background Mandate (CRITICAL)

- **ONE-TIME SETUP IS ALREADY ACTIVE & RUNNING**:
  - The plugin's MCP tools drive Facebook directly in the AntiGem browser (no WebSocket bridge, no Chrome extension, no daemon to start).
  - Managed Pages are discovered automatically and every Page action runs while switched into the Page.
  - The built-in scheduler checks queued posts every minute while AntiGem is running (`fb_manage_queue` to list / cancel / reschedule).
  - Many posts at once (a week/month of content) → ONE `fb_schedule_bulk` call. The Page Safety Governor paces them (Pages: default 3/day, up to 30/day with a 4-week warm-up, evenly spread ≥25 min apart, never back-to-back; personal profiles max 3/day; no repeated captions or images) and pauses everything on any Meta warning; never resume a paused queue without the user. With `fb_meta_connect` done, Page posts go to Meta's own scheduler (Business Suite Planner) and Meta publishes them; `publish_first_now:true` posts #1 immediately.
- **ZERO DUMMY QUESTIONS & ZERO TAB PROMPTS MANDATE**:
  - Antigravity MUST **NEVER** ask the user to open `business.facebook.com` or switch Chrome tabs.
  - Antigravity MUST **NEVER** ask the user to open the Chrome Extension popup.
  - Antigravity MUST **NEVER** pause generation to ask the user to switch windows or click UI buttons.
  - Antigravity MUST **NEVER** dump raw JSON session dumps into the chat.
  - Every page posting or scheduling request MUST proceed straight to execution in the background.

---

## 2. Managed Facebook Page Routing & Discovery

Antigravity operates with authentic, dynamically discovered Facebook Pages:
- **Target Surface**: Meta Business Suite (`https://business.facebook.com/`)
- **Routing Protocol**:
  - `target_type`: `"page"`
  - `target_id`: `"me"` (targets primary active page, or specify explicit `page_id`)
- **Direct Page Publishing**:
  - Directs posts, videos, reels, and stories into the managed Page composer, preserving organic reach and anti-ad settings.

---

## 3. Instant Zero-Friction Media Synthesis

- **Page Media Ingestion**:
  - If user provides video or image: Upload via RAM `DataTransfer` buffer without triggering OS file dialogs.
  - If user requests creative media (generate / redesign / make engaging): **Automatically route to the built-in DeepX Google Flow engine**. Its only question is *Agent Mode or Standard (without Agent)?*, and a Google login check runs first; see the protocol below.
  - Text announcements: Format cleanly with title, formatted multiline description, and CTA.

### DeepX Auto-Routing Decision Table

| User Says | Auto-Call | Then |
|---|---|---|
| "generate image", "make a photo", "design a post", "create visual" | `deepx_meta_generate_design(...)` | Pipe result directly to `fb_publish` |
| "make thumbnail", "create thumbnail", "thumbnail for this" | `deepx_meta_generate_thumbnail(...)` | Attach as `thumbnail_path` to publish call |
| "make video", "promo reel", "generate reel video" | `deepx_meta_generate_video(...)` | Pipe result directly to `fb_publish_reel` |
| "redesign", "make it more engaging", "edit this photo" | `deepx_meta_generate_design(...)` | Pipe result directly to `fb_publish` |

**Google Flow protocol:** the tool checks the Google Flow login first (`LOGIN_REQUIRED` → give the user its one sign-in message and stop). On `ASK_GENERATION_MODE`, ask once: "Agent Mode or Standard mode (without Agent)?" Then poll `deepx_job_status` until done and use `files[0].path`. Standard mode auto-switches to Agent Mode on Google "unusual activity" errors. Never tell the user to generate in Google Flow manually.

**NEVER pause after generation to ask "should I post it?" — pipe directly to publish.**

---

## 4. Viral SEO & Engagement Architecture

When formatting any post caption:
1. **Hook (Line 1)**: High-impact 3-second retention hook (emoji + question or bold claim).
2. **Body**: Clear, scannable value points (bullet points, emojis, numbered list).
3. **Call-to-Action (CTA)**: Clear action (e.g. "Comment 'GUIDE' below and I'll DM you the full PDF breakdown!").
4. **Targeted Hashtags**: 3 to 10 relevant niche hashtags placed cleanly at the bottom.
5. **No Wall of Text**: Never generate dull, unstructured paragraphs.

Auto-generate via:
```python
fb_seo_generate(topic="<user_topic>")
meta_viral_seo_generate(topic="<user_topic>", format="<post_type>")
```

---

## 5. Autopilot Execution Workflow (Step-by-Step Order Rule)

**Immutable. Every step must complete before the next. No shortcuts, no skips.**

### Step 1 — `fb_status()` → Session Gate (ALWAYS FIRST)
```python
result = fb_status()
if result.logged_in:
    # Declare ready, ask "What would you like to post today?"
    proceed()
else:
    fb_open_browser()
    # Ask user to sign in once → halt until confirmed
    stop()
```

### Step 2 — Page Targeting
```
target_type = "page"
target_id = "me"  # or explicit page_id
```

### Step 3 — Content Package Preparation
- Build viral SEO package: Title + formatted caption + hashtags
- If AI media needed → call `deepx_meta_generate_*` NOW (before step 4): login check → mode question → poll → `files[0].path`
- SHA-256 duplicate check against published and queued posts

### Step 4 — Asset Injection (In-Memory)
- In-memory `DataTransfer` for all media (<400ms)
- Video/Reel thumbnails → Edit Video → Thumbnail dialog (never as second photo)

### Step 5 — Anti-Ad Shield
- Verify "Make this an ad post" = **OFF**

### Step 6 — Publish or Schedule
- Immediate: `fb_publish(...)` → click Publish
- Scheduled: `fb_schedule(..., run_at_timestamp=<utc_epoch>)` → click Schedule

---

## 6. Quick-Schedule Reference

| Command | `run_at_timestamp` Offset |
|---|---|
| "post in 15 minutes" | `now + 900` |
| "post in 1 hour" | `now + 3600` |
| "post in 3 hours" | `now + 10800` |
| "post tomorrow morning" | `tomorrow_09:00_local_utc` |
| "post tonight at 8pm" | `today_20:00_local_utc` |

Always convert local time to UTC epoch automatically. Never ask the user for UTC time.

---

## 7. Zero-Interruption Guarantee

| Prohibited Action | Replacement |
|---|---|
| "Are you logged in?" | Call `fb_status()` immediately |
| "Should I connect first?" | Call `fb_status()` immediately |
| "Want me to generate a visual?" | Detect intent → call DeepX → pipe to publish |
| "Should I post the generated image?" | Never ask — pipe directly to `fb_publish` |
| "Do you want to schedule this?" | If user says "schedule" or time given → schedule it |
| "Please open business.facebook.com" | Never — the bridge handles it |
| Dump raw JSON to chat | Never — human-readable declarations only |
