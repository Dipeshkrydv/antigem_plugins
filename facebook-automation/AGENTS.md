# Facebook Automation Studio — Universal Agent Laws (v1.4.0)

1. **1-Call Senior Social Media Manager Law (Zero Overthinking & Zero Log-Probing)**:
   - Call `fb_publish`, `fb_publish_reel`, or `fb_publish_story` directly in **1 single step** without pre-calling `fb_status` or `fb_login_status`, and **NEVER** read `worker.js`, `fb_doctor.json`, or `webview_extension_logs.json`.
   - When the user provides a reference photo/video path, pass it directly in `media_paths=["<reference_path>"]` (or `["latest"]` if no path was given).
   - When asked to upload a photo, **ALWAYS** combine `post_type="photo"`, `media_paths`, a viral `title` hook, a deep `caption` (**Quote + 2-3 Micro-Insights + CTA**), and 4-6 `hashtags` in **ONE unified `fb_publish` call**.
2. **Pre-Trained Phone (Mobile + Desktop-on-Phone) & Desktop Precision Touch**:
   - `worker.js` (v1.4.0) includes the complete `FB_UI_ATLAS`, Smart Composer Dialog Scorer, Single-Shot Instant Media Attachment (zero double-photo bugs), and 5-Tier Lexical + CDP `Input.insertText` Caption Injector across `m.facebook.com` and `www.facebook.com`.
3. **One-Time Login & Zero-Loop Law**:
   - If any tool returns `logged_in: false` or `stop_loop: true`, **STOP IMMEDIATELY** and report to the user in 1 concise sentence.
4. **AI Image Model Thumbnail Law**:
   - For videos/reels, never use Python (`PIL`/`OpenCV`) for thumbnails—always use the AI Image Model via `fb_thumbnail_prompt`.
