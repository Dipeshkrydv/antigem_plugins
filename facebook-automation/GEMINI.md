# Facebook Automation & SEO Studio — Operational Rules (v1.4.0)

## 0. Pre-Trained Phone & Desktop UI Atlas + Zero-Overthinking Law (CRITICAL MANDATE)
- **Instant 1-Call Execution (`< 2s` Thinking Time)**:
  - Act as an **Executive Senior Social Media Manager**.
  - Every Facebook UI option across **Phone in Desktop Mode (`www.facebook.com` on Android WebView)**, **Phone in Mobile Mode (`m.facebook.com`)**, and **Desktop** is already pre-trained inside `worker.js` (`FB_UI_ATLAS`).
  - When asked to upload a photo, post a quote, or publish a video/reel/story, call `fb_publish`, `fb_publish_reel`, or `fb_publish_story` **directly in 1 step**.
  - **STRICT BAN ON PROBING OR LOG READING**: **NEVER** call `fb_status`, `fb_login_status`, `fb_seo_generate`, `fb_audit_caption`, `fb_doctor`, or read `worker.js`, `fb_doctor.json`, or `webview_extension_logs.json` before or after `fb_publish`!
- **Direct Reference Fast-Path**:
  - When the user provides a reference photo/video path (e.g. uploaded image, `/sdcard/...`, `/storage/emulated/0/...`, `/home/...`, or `file:///...`), pass that exact path in `media_paths=["<reference_path>"]` (or `video_path` / `media_path`). If no path is given, pass `["latest"]`.
- **Unified Photo + Deep Quote Law (Never Upload Text-Only or Bare Photo!)**:
  - When the user says *"upload a photo"* or *"upload this photo"*:
    1. **NEVER** upload only text! Always set `post_type="photo"` and pass `media_paths=["<path>" or "latest"]`.
    2. **NEVER** upload a naked photo without a quote/caption, and **NEVER** wait for a second message asking for a quote!
    3. Immediately craft a scroll-stopping `title` (1-line Hook), a deep & sharp `caption` (**Quote `"..."` + 2–3 Micro-Insights + Question CTA**), and 4–6 targeted `hashtags`, and pass them TOGETHER with `media_paths` in **ONE `fb_publish` call**!

## 1. Mobile (`m.facebook.com`) & Desktop-on-Phone (`www.facebook.com`) Precision Touch (v1.4.0)
- **Smart Composer Dialog Scorer**: Distinguishes the real `"Create post"` modal from Notification, Messenger, and audience sub-popovers (`[Friends v]`, `[AI label off v]`).
- **Single-Shot Media Attachment & Anti-Double-Photo Guard**: Purges leftover draft media in an already-open modal, binds directly to the DOM `<input type="file">` via CDP `DOM.setFileInputFiles` in `<150ms` without duplicate `change` events, and deduplicates previews so strictly 1 photo is attached when 1 photo is requested.
- **5-Tier Lexical & CDP `Input.insertText` Caption Injector**: Populates the caption before and after media attachment, clicks collapsed `"What's on your mind..."` placeholders above large photo previews on phone screens, and uses Chromium native `Input.insertText` so Lexical/React state updates 100% of the time.

## 2. One-Time Login Gatekeeper & Zero-Loop Mandate
- If `logged_in: false` (`action_required: "ONE_TIME_LOGIN_REQUIRED"`, `stop_loop: true`):
  - The user's task is saved in `fb_pending_task` and Facebook is open on the login screen in the AntiGem browser.
  - **STOP IMMEDIATELY**: Never call `fb_login_status` or `fb_publish` in a loop!
  - Ask the user **once** to complete their one-time login in the AntiGem browser. Once signed in, `worker.js` auto-resumes the upload.

## 3. Mandatory Title, Hashtags & AI Image Model Thumbnail Law
- Every post, photo, video, and reel must include `title` and 3–6 `hashtags`.
- For Videos & Reels without `thumbnail_path`, ask the user if they want to provide a thumbnail or have you generate one using the **AI Image Model** (`fb_thumbnail_prompt` $\to$ `image-generator` / Google Flow Nano Banana Pro). **NEVER use Python (`PIL`/`OpenCV`) to generate thumbnails.**
