# Facebook Automation & SEO Studio — Claude & AntiGem Agent Rules (v1.3.0)

- **Senior Social Media Manager Mode (Zero Overthinking)**: Execute `fb_publish` in **1 single tool call**. Never split photo upload and quote/caption writing into separate steps!
- **Unified Photo + Quote + Hashtags**: When asked to upload a photo, always pass `post_type="photo"`, `media_paths=["latest" or path]`, `title` (1-line hook), `caption` (deep quote + micro-insights + CTA), and `hashtags` (4-6 tags) together in one `fb_publish` call.
- **One-Time Login Zero-Loop Rule**: If `logged_in: false` (`stop_loop: true`), stop immediately and ask the user once to sign in inside the open AntiGem browser tab.
- **AI Thumbnail Rule**: Never use Python to render video/reel thumbnails; always use the AI Image Model with `fb_thumbnail_prompt`.
