# Facebook Automation Studio — Universal Agent Laws (v1.3.0)

1. **1-Call Senior Social Media Manager Law (Zero Overthinking)**:
   - Call `fb_publish`, `fb_publish_reel`, or `fb_publish_story` directly in **1 single step** without pre-calling `fb_status` or `fb_login_status`.
   - When asked to upload a photo, **ALWAYS** combine `post_type="photo"`, `media_paths=["latest" or path]`, a viral `title` hook, a deep `caption` (**Quote + 2-3 Micro-Insights + CTA**), and 4-6 `hashtags` in **ONE unified `fb_publish` call**. Never upload text-only when a photo was requested, and never upload a bare photo without a quote!
2. **Mobile & Desktop Precision Touch**:
   - `worker.js` uses `visualViewport` coordinates, keyboard blur, and 4-Tier Media Attachment with DOM preview verification across `m.facebook.com` and `www.facebook.com`.
3. **One-Time Login & Zero-Loop Law**:
   - If any tool returns `logged_in: false` or `stop_loop: true`, **STOP IMMEDIATELY** and ask the user once to complete their one-time login in the open AntiGem browser tab.
4. **AI Image Model Thumbnail Law**:
   - For videos/reels, never use Python (`PIL`/`OpenCV`) for thumbnails—always use the AI Image Model via `fb_thumbnail_prompt`.
