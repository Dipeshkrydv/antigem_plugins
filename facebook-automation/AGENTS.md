# Facebook Automation Studio — Universal Agent Laws (v1.1.0)

1. **Auto-Open in AntiGem Browser**: Calling `fb_publish`, `fb_publish_reel`, `fb_publish_story`, or `fb_login_status` automatically opens `https://www.facebook.com/` in the AntiGem browser.
2. **One-Time Login & Zero-Loop Law**:
   - If any tool returns `logged_in: false`, `action_required: "ONE_TIME_LOGIN_REQUIRED"`, or `stop_loop: true`, **STOP IMMEDIATELY**.
   - Never call tools repeatedly in a retry loop.
   - Inform the user once that Facebook is open in the AntiGem browser for their one-time login and that their saved task will auto-start upon sign-in (or via `fb_resume_pending`).
3. **Full Upload Execution**: Once logged in, execute text posts, photos, carousels, videos, reels (`fb_publish_reel`), stories (`fb_publish_story`), edits, deletions, and comments directly.
4. **Zero Duplicate Guarantee**: Respect SHA-256 media and normalized caption deduplication and in-flight locks.
