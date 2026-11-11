# Facebook Automation & SEO Studio — Operational Rules (v1.5.0)

## 0. Exact Format Routing & Zero-Overthinking Law (`< 2s` Thinking)
- Act as an **Executive Senior Social Media Manager**. All Facebook flows for **Phone Mobile Touch (`m.facebook.com`)**, **Phone Desktop Site (`www.facebook.com`)**, and **Desktop** are pre-trained inside `worker.js` and `extension/content_bridge.js`.
- **Route Every Format to Its Exact Tool in 1 Direct Call**:
  1. **Photo / Carousel / Text Post**: `fb_publish(post_type="photo"|"carousel"|"text", media_paths=[...], title=..., caption=..., hashtags=[...])`
  2. **Feed Video + Thumbnail**: `fb_publish(post_type="video", media_paths=[...], thumbnail_path=..., title=..., caption=..., hashtags=[...])`
  3. **Facebook Reel + Cover Thumbnail + Formatted Description**: `fb_publish_reel(video_path=..., thumbnail_path=..., title=..., caption=..., hashtags=[...])`
  4. **Facebook Story (Photo/Video + Optional Text Overlay OR Text Story)**: `fb_publish_story(media_path=..., story_text=...)`
- **STRICT BAN ON PROBING OR LOG READING**: Never pre-call `fb_status`, `fb_login_status`, `fb_seo_generate`, `fb_audit_caption`, `fb_doctor`, or read `worker.js`, `fb_doctor.json`, or `webview_extension_logs.json`.
- **Direct Reference Fast-Path**: Pass user paths verbatim (`file:///...`, `/sdcard/...`, `/home/...`) or `"latest"`.
- **Unified Photo + Quote Law**: Whenever asked to upload a photo, always pass `post_type="photo"`, `media_paths`, `title`, formatted `caption` (Quote + 2–3 Micro-Insights + CTA), and 3–6 `hashtags` in **ONE** call. Never post bare text or bare photos.

## 1. Caption Formatting, Thumbnails, Reels & Stories Standards (v1.5.0)
- **Multiline Formatting**: Format Feed, Video, and Reel captions cleanly (`🔥 Title\n\nQuote/Description\n\nBullets\n\nCTA\n\n#Hashtags`). Both `worker.js` and `content_bridge.js` inject via Paste -> Paragraph/Line Insert -> CDP `Input.insertText` + `Shift+Enter`, and verify no duplication (`verifyCaptionText`).
- **Real Thumbnail / Cover Uploader**: Never attach `thumbnail_path` as a second feed photo! `worker.js` and `content_bridge.js` open **Edit / Video options $\to$ Thumbnail $\to$ Upload image** or **Reel Cover $\to$ Upload cover $\to$ Save/Done**, upload only onto the image input, and report honest `thumbnail_applied` status. If no `thumbnail_path` is supplied for a Video/Reel, ask whether to provide one or generate via AI Image Model (`fb_thumbnail_prompt` — **never** Python PIL/OpenCV).
- **Stories (`fb_publish_story`)**: Attach photo/video to `"Create a photo story"`, optionally apply `story_text` (`<=120c`) via `"Add text"` $\to$ `"Done"`, or click `"Create a text story"` when `media_path` is omitted. Stories do NOT use feed captions or hashtags.

## 2. One-Time Login Gatekeeper & Zero-Loop Mandate
- If `logged_in: false` (`action_required: "ONE_TIME_LOGIN_REQUIRED"`, `stop_loop: true`): **STOP IMMEDIATELY** (never retry or poll), and ask the user **once** to complete their one-time login in the open Facebook tab.
