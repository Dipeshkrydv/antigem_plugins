---
name: facebook-automation
description: "Pre-Trained Phone (Desktop-on-Phone www.facebook.com & Mobile Touch m.facebook.com) and Desktop Facebook Automation Engine (v1.4.0). Executes in 1 single tool call with ZERO overthinking: Smart Composer Dialog Scorer, Single-Shot Instant Media Attachment (zero double-photo bugs), 5-Tier Lexical/CDP Input.insertText Caption Injector, Direct Reference File Fast-Path, Reels & Stories wizards, and Unified Photo + Deep Quote + Hook + 3-6 #Hashtags in ONE post."
---

# Facebook Automation & SEO Studio — Phone (Mobile + Desktop-on-Phone) & Desktop Precision Engine (v1.4.0)

## ⚡ 0. ZERO OVERTHINKING, ZERO FILE-PROBING & 1-CALL EXECUTION LAW (CRITICAL MANDATE)

When this skill opens, you are acting as an **Executive Senior Social Media Manager**. Everything about Facebook's Mobile Touch UI (`m.facebook.com`), Phone Desktop Mode UI (`www.facebook.com` on Android WebView), and Desktop UI is **already pre-trained inside `worker.js`**. Follow these 4 ironclad laws with **under 2 seconds of internal thinking**:

1. **ONE SINGLE TOOL CALL (`fb_publish` / `fb_publish_reel` / `fb_publish_story`) — ZERO PREAMBLE**:
   - **NEVER** call `fb_status`, `fb_login_status`, `fb_seo_generate`, `fb_audit_caption`, `fb_doctor`, or run bash `find`/`ls` commands before calling `fb_publish`!
   - **NEVER** read `worker.js`, `fb_doctor.json`, `webview_extension_logs.json`, or any source/log files before or after calling a tool!
   - `fb_publish` **already** handles browser auto-open, one-time login verification, direct reference path resolution, latest-media auto-discovery (`media_paths=["latest"]`), quote/hashtag enrichment, single-shot media attachment, 5-tier Lexical/CDP caption injection, and precision-touch publishing in **1 single step**.

2. **DIRECT REFERENCE FILE FAST-PATH (INSTANT PUSH WHEN USER GIVES A PHOTO/VIDEO)**:
   - If the user provides a reference image/video path (e.g. an uploaded chat image, `/sdcard/...`, `/storage/emulated/0/...`, `/home/...`, `~/...`, or `file:///...`), pass that exact path directly in `media_paths=["<reference_path>"]` (or `video_path="<reference_path>"` / `media_path="<reference_path>"`).
   - If the user says *"upload a photo"* / *"upload my latest photo"* without a path, pass `media_paths=["latest"]`.

3. **UNIFIED PHOTO + DEEP QUOTE LAW (NEVER UPLOAD TEXT-ONLY OR BARE PHOTO)**:
   - When the user says *"upload a photo"*, *"upload this photo"*, or gives an image reference:
     - **NEVER upload only text!** Always set `post_type="photo"` and pass `media_paths=["<reference_path>" or "latest"]`.
     - **NEVER upload a raw photo without a caption/quote, and NEVER wait for a second prompt asking you to write a quote!**
     - Immediately craft and pass all 4 in **ONE `fb_publish` call**:
       1. `title`: A bold, scroll-stopping 1-line Headline / Hook.
       2. `caption`: A deep, sharp **Quote (`"..."`)** + 2–3 crisp micro-insights (1–2 lines each, blank line between thoughts) + an engaging question CTA.
       3. `hashtags`: 4 to 6 targeted `#Hashtags`.
       4. `media_paths`: `["<reference_path>"]` or `["latest"]`, with `post_type="photo"`.

4. **PRE-TRAINED PHONE & DESKTOP UI ATLAS (`FB_UI_ATLAS` IN `worker.js` v1.4.0)**:
   - **Smart Composer Dialog Scorer**: Distinguishes the real `"Create post"` modal from Notification, Messenger, Account, and `[Friends v]` / `[AI label off v]` sub-popovers on both Phone Desktop Mode (`www.facebook.com`) and Mobile Mode (`m.facebook.com`).
   - **Single-Shot Media Attachment (Zero Double-Photo Bugs)**: Purges any leftover draft media in an already-open modal, binds directly to the DOM `<input type="file">` via CDP `DOM.setFileInputFiles` in `<150ms` without duplicate `change` events, and deduplicates previews if needed.
   - **5-Tier Lexical & CDP `Input.insertText` Caption Injector**: Populates the caption before and after media attachment, clicks collapsed `"What's on your mind..."` placeholders above large photo previews on phone screens, and uses Chromium native `Input.insertText` so Lexical/React state updates 100% of the time.

---

## 📱 1. Pre-Trained Facebook Features Across Phone (Mobile + Desktop-on-Phone) & Desktop

| Feature / Surface | Instant 1-Step Tool Call | Pre-Trained Phone & Desktop UI Flow in `worker.js` |
| :--- | :--- | :--- |
| **Photo + Quote Post** | `fb_publish(title=..., caption=..., hashtags=[...], media_paths=["<ref>" or "latest"], post_type="photo")` | Detects/opens `"Create post"` modal (`www.facebook.com` or `m.facebook.com`), inserts Quote + Hook + Hashtags, attaches 1 clean photo (zero duplicates), verifies DOM preview + caption, blurs keyboard, and precision-taps **Post**. |
| **Carousel (Multi-Photo)** | `fb_publish(title=..., caption=..., hashtags=[...], media_paths=["<p1>", "<p2>"], post_type="carousel")` | Attaches all specified photos in a single batch, populates caption + hashtags, and taps **Post**. |
| **Text / Quote Post** | `fb_publish(title=..., caption=..., hashtags=[...], post_type="text")` | Opens composer, inserts Title + Quote + Micro-Insights + Hashtags via 5-Tier Lexical/CDP Injector, and taps **Post**. |
| **Video Post** | `fb_publish(title=..., caption=..., hashtags=[...], media_paths=["<video>"], thumbnail_path=..., post_type="video")` | Attaches `.mp4`/`.mov`, attaches AI `thumbnail_path`, populates Title + Caption + Hashtags, and taps **Post**. |
| **Facebook Reel** | `fb_publish_reel(video_path="<ref>" or "latest", title=..., caption=..., hashtags=[...], thumbnail_path=...)` | Opens `/reels/create` (or auto-falls back to Feed Video/Reel composer on mobile `m.facebook.com`), attaches vertical `.mp4`, taps **Next $\to$ Next**, attaches cover thumbnail, inserts Title + Caption + Hashtags, and taps **Publish**. |
| **Facebook Story** | `fb_publish_story(media_path="<ref>" or "latest", caption=...)` | Opens `/stories/create`, binds photo/video to **"Create a photo story"** (or clicks **"Create a text story"** for text stories), and precision-taps **Share to story**. |
| **Managed Page Post** | `fb_publish(..., target_type="page", target_id="1409644015561854")` | Navigates to the Pagecomposer or Business Suite and publishes directly. |
| **Resume After Login** | `fb_resume_pending()` | Immediately executes the saved task after one-time login. |
| **Schedule Post** | `fb_schedule(title=..., caption=..., hashtags=[...], run_at_timestamp=..., media_paths=..., post_type=...)` | Schedules post via `chrome.alarms` + local queue. |
| **Edit / Delete / Comment** | `fb_edit_post` / `fb_delete_post` / `fb_comments` | Full post lifecycle management and first-comment link placement. |

---

## 🔑 2. Mobile AntiGem Browser Auto-Open & One-Time Login Protocol

1. **Auto-Open & Session Check**:
   - Every tool (`fb_publish`, `fb_publish_reel`, `fb_publish_story`, `fb_login_status`) automatically opens `https://www.facebook.com/` inside the AntiGem WebView browser if not already open.
2. **One-Time Login Gatekeeper (STRICT ZERO-LOOP LAW)**:
   - If the response contains `logged_in: false` (`action_required: "ONE_TIME_LOGIN_REQUIRED"`, `stop_loop: true`):
     - Your upload is already saved in `fb_pending_task` (`chrome.storage.local`) and the Facebook login tab is focused.
     - **STOP IMMEDIATELY (ZERO RETRY LOOPS)**. Never call `fb_login_status` or `fb_publish` again in a loop.
     - Tell the user **ONCE**:
       > *"I have opened Facebook in your AntiGem browser. Please complete the **one-time login** in the open browser tab—your task is saved and will publish automatically as soon as you sign in (or reply **'continue'** once logged in)!"*

---

## 🎨 3. Mandatory Title, Hashtags & AI Image Model Thumbnail Law

- **Rule A — Never Forget Title, Deep Quote & Hashtags**:
   - Every Facebook post, photo, carousel, video, or reel MUST include `title` (headline hook), `caption` (deep quote + micro-insights + CTA), and `hashtags` (3–6 `#Hashtags`).
- **Rule B — Always Ask for Thumbnail on Videos & Reels**:
  - When uploading a **Video** or **Facebook Reel** without a `thumbnail_path`, ask:
    > *"Would you like to provide a custom thumbnail image for this video/reel, or should I generate a high-CTR thumbnail for you using the AI Image Model?"*
- **Rule C — AI Image Model ONLY for Thumbnails (STRICTLY ZERO PYTHON)**:
  - **NEVER** use Python (`PIL`, `Pillow`, `OpenCV`, `matplotlib`, `ThumbnailEngine`, or `FreeMediaEngine`) to generate thumbnails!
  - Call `fb_thumbnail_prompt(topic=..., title_hook=..., subtitle=..., archetype=..., aspect_ratio=...)` and pass `ai_image_model_prompt` to the **AI Image Model** (`image-generator` subagent, Google Flow Nano Banana Pro `flow_generate_image` / `deepx_generate_image`, or `meigen` `generate_image`), then pass the saved image as `thumbnail_path`.
