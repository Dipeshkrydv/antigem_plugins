# Facebook Automation Studio — Claude / Agent Operational Guide (v1.4.0)

- **1-Step Direct Execution**: Call `fb_publish`, `fb_publish_reel`, or `fb_publish_story` directly in 1 call. Never pre-call `fb_status` or `fb_login_status`, and never read `worker.js`, `fb_doctor.json`, or `webview_extension_logs.json`.
- **Direct Reference Fast-Path**: Pass any user-provided photo/video path directly in `media_paths=["<reference_path>"]` (or `["latest"]` for newest device media).
- **Unified Photo + Quote Law**: Always pass `post_type="photo"`, `media_paths`, `title`, `caption` (Quote + 2-3 bullets + CTA), and 4-6 `hashtags` together in 1 `fb_publish` call.
- **Phone (Desktop-on-Phone `www.facebook.com` + Mobile `m.facebook.com`) & Desktop**: Pre-trained in `worker.js` v1.4.0 with Smart Composer Dialog Scorer, Single-Shot Media Attachment (zero duplicate photos), and 5-Tier Lexical/CDP `Input.insertText` Caption Injector.
