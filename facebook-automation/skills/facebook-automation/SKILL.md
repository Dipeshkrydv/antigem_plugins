---
name: facebook-automation
description: "Pre-Trained Phone (Desktop-on-Phone www.facebook.com & Mobile Touch m.facebook.com) and Desktop Facebook Automation Engine (v1.5.0). Executes in 1 single tool call with ZERO overthinking: Dedicated Feed Posts (Text/Photo/Carousel/Video), Reels (/reels/create + mobile fallback), Stories (/stories/create Photo/Video with overlay story_text & Text Story), Real Thumbnail/Cover Uploader (Edit Video -> Thumbnail & Reel Cover panel), Multiline Formatted Caption Engine (Title + Description + Bullets + CTA + 3-6 #Hashtags), Smart Composer Dialog Scorer, and Anti-Double-Photo Guard."
---

# Facebook Automation & SEO Studio — Phone (Mobile + Desktop-on-Phone) & Desktop Precision Engine (v1.5.0)

## ⚡ 0. ZERO OVERTHINKING, ZERO FILE-PROBING & EXACT 1-CALL ROUTING LAW

When this skill opens, act as an **Executive Senior Social Media Manager**. Every UI surface across **Phone Mobile Touch (`m.facebook.com`)**, **Phone Desktop Site Mode (`www.facebook.com` on Android WebView)**, and **Desktop** is already pre-trained inside `worker.js` and `extension/content_bridge.js`.

### Strictly Pick the Exact Tool for the Format (Under 2 Seconds Thinking):
1. **Feed Photo / Carousel / Text Post $\to$ `fb_publish`** (`post_type="photo" | "carousel" | "text"`)
2. **Feed Video Post $\to$ `fb_publish`** (`post_type="video"`, `thumbnail_path=...`)
3. **Facebook Reel $\to$ `fb_publish_reel`** (`video_path=...`, `thumbnail_path=...`, `title=...`, `caption=...`, `hashtags=[...]`)
4. **Facebook Story $\to$ `fb_publish_story`** (`media_path=...` or omitted for text story, `story_text=...`)

### Ironclad Operational Rules:
- **NEVER** call `fb_status`, `fb_login_status`, `fb_seo_generate`, `fb_audit_caption`, `fb_doctor`, or bash `find`/`ls` before dispatching!
- **NEVER** read `worker.js`, `fb_doctor.json`, `webview_extension_logs.json`, or source/log files!
- **Direct Reference Fast-Path**: Pass user-supplied media or thumbnail paths verbatim (`file:///...`, `/sdcard/...`, `/storage/emulated/0/...`, `/home/...`, `~/...`), or `"latest"` when no path is given.
- **Unified Photo + Quote in 1 Call**: Whenever the user asks to *"upload a photo"*, **NEVER** upload text-only and **NEVER** upload a bare photo without a quote! Pass `post_type="photo"`, `media_paths=["<ref>" or "latest"]`, `title`, formatted `caption`, and 3–6 `hashtags` in ONE call.

---

## 🎯 1. Complete Feature & Option Training Matrix (Phone + Desktop)

| User Wants To Publish | Exact 1-Step Tool Call & Required Fields | Exact Pre-Trained Browser Flow (`worker.js` v1.5.0) |
| :--- | :--- | :--- |
| **Photo + Deep Quote** | `fb_publish(post_type="photo", media_paths=["<ref>" or "latest"], title=..., caption=..., hashtags=[...])` | Opens/scores `"Create post"` dialog, formats Title + Quote + Bullets + CTA + Hashtags via Paste/Paragraph/CDP injector, attaches 1 clean photo (zero duplicates), verifies caption, blurs keyboard, precision-taps **Post**. |
| **Carousel (Multi-Photo)** | `fb_publish(post_type="carousel", media_paths=["<p1>", "<p2>", ...], title=..., caption=..., hashtags=[...])` | Attaches multiple photos in 1 batch, verifies formatted caption & previews, taps **Post**. |
| **Text / Quote Post** | `fb_publish(post_type="text", title=..., caption=..., hashtags=[...])` | Opens composer, inserts formatted multiline Title + Quote + CTA + Hashtags, verifies no duplication, taps **Post**. |
| **Feed Video + Custom Thumbnail** | `fb_publish(post_type="video", media_paths=["<vid>" or "latest"], thumbnail_path="<img_path>", title=..., caption=..., hashtags=[...])` | Attaches video, opens **Edit / Edit video / Video options $\to$ Thumbnail $\to$ Upload image**, uploads `thumbnail_path` ONLY to the thumbnail input and saves (never attaches as a 2nd feed item!), populates Title field + formatted Description + Hashtags, verifies caption, waits for enabled **Post**. |
| **Facebook Reel + Cover Thumbnail + Description** | `fb_publish_reel(video_path="<vid>" or "latest", thumbnail_path="<img_path>", title=..., caption=..., hashtags=[...])` | Opens `/reels/create` (or auto-falls back to Feed Video composer on pure mobile views, reporting `fallback_used`), uploads video, walks **Next** wizard steps, uploads `thumbnail_path` into **Cover / Upload cover** panel, inserts Title + formatted Description + 3–6 Hashtags into **"Describe your reel"** (verifying head/tail & no duplication), waits up to 90s for active **Publish**, confirms completion. |
| **Photo / Video Story (with Optional Text Overlay)** | `fb_publish_story(media_path="<ref>" or "latest", story_text="<short <=120c overlay>")` | Opens `/stories/create` (or Feed **"Create story"** card), attaches photo/video via **"Create a photo story"**, optionally clicks **"Add text" / "Aa"**, inserts `story_text` and taps **"Done"**, then taps **"Share to story"** and confirms completion. **Stories have NO caption or hashtag box.** |
| **Text-Only Story** | `fb_publish_story(story_text="<message <=250c>")` *(omit `media_path`)* | Opens `/stories/create`, clicks **"Create a text story"**, types `story_text` into the Story card textbox, and taps **"Share to story"**. |
| **Managed Page Post** | Any publish tool with `target_type="page", target_id="1409644015561854"` | Navigates directly to the Page composer (`Motivational Docqueen`) and executes cleanly. |
| **Schedule Any Format** | `fb_schedule(run_at_timestamp=..., post_type=..., title=..., caption=..., hashtags=[...], thumbnail_path=..., story_text=..., media_paths=[...])` | Queues Feed, Video, Reel, or Story with full SEO/Story formatting. |
| **Edit / Delete / Comment / Resume** | `fb_edit_post` / `fb_delete_post` / `fb_comments` / `fb_resume_pending` | Manages published posts, first-comment links, and post-login resume. |

---

## 📝 2. Strict Caption Formatting & Hashtag Standard (Posts, Photos, Videos & Reels)

Every Feed Post, Photo, Carousel, Feed Video, and Reel caption MUST preserve clean vertical whitespace (`\n\n`) so it never renders as a flat block of text:

```text
🔥 <Bold 1-Line Viral Title / Hook>

“<Sharp Quote or Core Value Statement>”

🔹 <Micro-Insight #1 — 1 punchy line>
🔹 <Micro-Insight #2 — 1 punchy line>

👇 <Clear Question CTA inviting comments>

#TargetedTag1 #TargetedTag2 #TargetedTag3 #TargetedTag4 #TargetedTag5
```

- **How formatting sticks on Facebook**: `worker.js` and `content_bridge.js` inject via synthetic `ClipboardEvent("paste")` first (so Lexical creates native paragraph nodes), then line-by-line `execCommand("insertText")` + `insertParagraph`, then CDP `Input.insertText` + `Shift+Enter`, and verify head + tail + single occurrence (`caption_verified`, `formatting_preserved`).
- **Stories Exception**: Facebook Stories only support media and an optional short canvas overlay (`story_text`); never attempt to push long multi-paragraph captions or `#Hashtag` blocks into a Story.

---

## 🖼️ 3. Custom Thumbnail & AI Image Model Protocol (Videos & Reels)

1. **When User Supplies a Thumbnail**: Pass its path in `thumbnail_path` to `fb_publish(post_type="video", ...)` or `fb_publish_reel(...)`.
   - Automation uploads it exclusively via **Edit Video $\to$ Thumbnail $\to$ Upload image** or **Reel Edit $\to$ Cover $\to$ Upload cover $\to$ Save/Done**.
   - Responses include honest `thumbnail_applied` (`true`/`false`) and `thumbnail_note` telemetry — never fake success if Facebook didn't offer the thumbnail panel on that screen.
2. **When User Does NOT Supply a Thumbnail on a Video or Reel**:
   - Ask ONCE:
     > *"Would you like to provide a custom thumbnail image for this video/reel, or should I generate a high-CTR thumbnail for you using the AI Image Model?"*
3. **AI Image Model ONLY (STRICTLY ZERO PYTHON)**:
   - **NEVER** use Python (`PIL`, `Pillow`, `OpenCV`, `matplotlib`, `ThumbnailEngine`, or `FreeMediaEngine`)!
   - Call `fb_thumbnail_prompt(topic=..., title_hook=..., subtitle=..., archetype=..., aspect_ratio=...)` and generate using the AI Image Model (`image-generator` subagent, `flow_generate_image`, `deepx_generate_image`, or `meigen` `generate_image`), then pass the resulting image path as `thumbnail_path`.

---

## 🔑 4. One-Time Login Gatekeeper & Zero-Loop Law

- If any tool returns `logged_in: false` (`action_required: "ONE_TIME_LOGIN_REQUIRED"`, `stop_loop: true`):
  - Your exact post, Reel (including `thumbnail_path`), or Story (`story_text`) is saved in `fb_pending_task`, and Facebook is open in the AntiGem browser.
  - **STOP IMMEDIATELY (ZERO RETRY LOOPS)** — never re-call `fb_login_status` or `fb_publish`.
  - Tell the user **ONCE**:
    > *"I have opened Facebook in your AntiGem browser. Please complete your one-time login in the open browser tab—your upload is saved and will publish automatically once you sign in (or reply **'continue'**)."*
