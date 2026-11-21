---
name: meta-autopilot
description: >-
  Autonomous Meta Business Suite Page Management Autopilot. Use when the user requests to post, publish, or schedule anything (photos, reels, videos, stories, announcements, text posts) to managed Facebook Pages via Meta Business Suite, or mentions 'manage page', 'page scheduler', 'meta suite', 'schedule post to page', 'meta bridge', 'page automation', or 'handle my facebook page'. Enforces permanent one-time setup, zero-tab prompts (never ask the user to open tabs, switch windows, or click UI buttons), automatic media generation for zero-friction posts, authentic page grounding via Meta Business Suite (target_type: "page", target_id: "me" or explicit page ID), viral SEO hooks and hashtags, and continuous background dispatch via SQLite WAL and WebSocket bridge.
---

# Meta Business Suite Page Autopilot (v2.4.1)

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
