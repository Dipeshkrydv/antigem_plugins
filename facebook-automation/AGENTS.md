# Facebook Automation Studio — Universal Agent Laws (v1.5.0)

1. **Exact 1-Call Routing (Zero Overthinking & Zero Log-Probing)**:
   - Call the right tool directly as your first step (never pre-call `fb_status` or `fb_login_status`, and never read `worker.js`, `fb_doctor.json`, or `webview_extension_logs.json`):
     - **Feed Photo / Carousel / Text**: `fb_publish`
     - **Feed Video + Custom Thumbnail**: `fb_publish(..., post_type="video", thumbnail_path=...)`
     - **Facebook Reel + Cover Thumbnail + Description**: `fb_publish_reel(video_path=..., thumbnail_path=..., title=..., caption=..., hashtags=[...])`
     - **Facebook Story (Photo/Video Overlay or Text)**: `fb_publish_story(media_path=..., story_text=...)`
2. **Unified Quote + Formatted Description + 3–6 Hashtags**:
   - Posts, Photos, Videos, and Reels require `title`, formatted multiline `caption` (`\n\n` separating Hook, Description/Quote, Bullets, CTA), and 3–6 `hashtags`.
   - Stories have no caption/hashtag box—pass short overlay text in `story_text` (`<=120c`) instead.
3. **Real Custom Thumbnail Flow & AI Image Model Law**:
   - `thumbnail_path` is uploaded inside Facebook's Thumbnail/Cover panel (`Edit video -> Thumbnail` or `Reel Cover`)—never attached as a duplicate feed item.
   - If Video/Reel lacks `thumbnail_path`, ask the user to supply one or generate via **AI Image Model ONLY** (`fb_thumbnail_prompt` — strictly zero Python PIL/OpenCV).
4. **One-Time Login & Zero-Loop Law**:
   - If `logged_in: false` or `stop_loop: true`, **STOP IMMEDIATELY** and inform the user once.
