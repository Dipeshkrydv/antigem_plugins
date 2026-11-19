---
name: meta-suite-automation
description: "Master Autonomous Meta Suite Production Engine (v2.1.0). Enterprise Meta Business Suite Facebook Page management and scheduling engine. Enforces 1-click publishing & scheduling of Page Reels (9:16), Long Videos (16:9), Photos, Stories, and Announcements with custom video thumbnails/covers, in-memory DataTransfer injection, <100ms synthetic clipboard paste, anti-ad organic shield, anti-comment box firewall, and 100% script-fidelity DeepX Google Flow AI media generation."
---

# Master Meta Suite Page Management Engine (v2.1.0)

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
| `true` | Confirm connection cleanly. STRICTLY DO NOT ask post or reel questions. ONLY ASK: *"Do you want to use Agent Mode for asset generation, or not?"* |
| `false` | Call `fb_open_browser()` once → ask user to sign in once → STOP until confirmed |

**ZERO post/reel questioning.** NEVER ask "What would you like to post today?" or "Do you want a post or reel?". ONLY verify login, and ask if the user wants Agent Mode for asset generation.

---

## 1. Managed Facebook Page Routing & Asset Discovery

| Target Surface | Destination | Routing Parameters | Capabilities |
| :--- | :--- | :--- | :--- |
| **Meta Business Suite Page** | Managed Facebook Page | `target_type: "page"`, `target_id: "me"` (or `<page_id>`) | Dedicated Page composer, organic reach, multi-page selection |

- **Dynamic Page Discovery**: Automatically detects connected Facebook Pages from the active Meta Business Suite session (`business.facebook.com`).
- **Target Selection**: Use `target_id="me"` for the primary/currently active page, or specify the numerical `page_id` when managing multiple business pages.

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

## 3. DeepX Auto-Routing (AI Media Generation → Publish Pipeline)

**Trigger detection (ANY of these phrases → auto-route to DeepX):**
- "generate image", "make a photo", "create visual", "design a post", "redesign", "make it engaging", "edit this photo", "create thumbnail", "make thumbnail", "AI image", "generate thumbnail", "create a reel visual", "make video", "create promo video"

**Auto-routing decision:**

| Intent | Tool | Then |
|---|---|---|
| Design / photo post | `deepx_meta_generate_design(prompt=<desc>, aspect_ratio="1:1" or "9:16")` | Auto-attach result to `fb_publish` |
| Thumbnail for video/reel | `deepx_meta_generate_thumbnail(prompt=<desc>, format="16:9" or "9:16")` | Auto-attach to `fb_publish` / `fb_publish_reel` as `thumbnail_path` |
| Promo / reel video | `deepx_meta_generate_video(prompt=<desc>, aspect_ratio="9:16", duration=10)` | Auto-attach to `fb_publish_reel` |

**Pipeline — zero pauses between generation and publishing:**
```
User: "generate a motivational post about focus and post it"
  → deepx_meta_generate_design(prompt="motivational focus visual, bold typography")
  → [wait for render complete]
  → fb_publish(target_type="page", target_id="me", post_type="photo",
               media_paths=[<generated_image_path>], ...)
```

**NEVER ask "should I post the generated image?" — pipe it directly.**

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
  - Persisted in SQLite WAL table `scheduled_jobs`.
  - APScheduler executes jobs automatically without requiring open browser windows.

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
   - Call `fb_status()` immediately as the literal first tool call.
   - If `logged_in: true` → confirm connected, ask ONLY: *"Do you want to use Agent Mode for asset generation, or not?"*, and proceed. Never ask post or reel questions.
   - If `logged_in: false` → call `fb_open_browser()` once, ask user to sign in once, STOP.
   - **NEVER ask status before calling `fb_status`.** The check is instant (<100ms).

2. **Step 2 — Managed Facebook Page Target Selection**
   - Confirm routing: `target_type="page"`, `target_id="me"` (or numerical Page ID).
   - Direct all actions strictly to the managed Page composer in Meta Business Suite.

3. **Step 3 — Content Preparation & Anti-Duplicate Check**
   - Structure viral SEO package: Title + multiline description (`\n\n` preserved) + 3 to 6 targeted `#Hashtags`.
   - Verify SHA-256 hash against published content and queued jobs to prevent duplicate uploads.
   - If user requests AI content → call DeepX tools NOW before step 4.

4. **Step 4 — In-Memory Asset & Custom Thumbnail / Cover Injection**
   - Ingest media files via in-memory `DataTransfer` buffer directly in RAM (<400ms).
   - For Video/Reel: Open **Edit Video → Thumbnail** or **Reel Cover → Upload cover** and upload custom thumbnail (strictly never attach as a second post photo).

5. **Step 5 — Anti-Ad Organic Shield Verification**
   - Inspect and confirm that the "Make this an ad post" switch is strictly **OFF** for 100% organic algorithmic distribution.

6. **Step 6 — Synthetic Paste & Final Publish or Schedule**
   - Paste formatted text into the Page Create Post dialog using synthetic clipboard paste (<100ms). Strictly avoid feed comment boxes.
   - **Immediate Post**: Click the native **"Publish"** button.
   - **Scheduled Post**: Toggle the native **"Set date and time"** switch, configure the scheduled date/time, and click **"Schedule"**.
