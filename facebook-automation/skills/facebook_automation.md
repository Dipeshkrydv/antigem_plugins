---
name: Facebook Automation
description: Autonomous Facebook post, photo, video, reel, and story publishing in AntiGem Browser with one-time login persistence and zero loop errors.
version: 1.1.0
---

# Facebook Automation Skill (v1.1.0)

## Core Operational Flow on Mobile (AntiGem Browser)
1. **Task Given $\to$ Auto-Open Facebook**: Calling `fb_publish`, `fb_publish_reel`, `fb_publish_story`, or `fb_login_status` automatically opens `https://www.facebook.com/` in the AntiGem browser.
2. **One-Time Login Check (Zero Loop Mandate)**:
   - If `logged_in: false` (`action_required: "ONE_TIME_LOGIN_REQUIRED"`, `stop_loop: true`):
     - The Facebook login screen is open and active in the AntiGem browser, and the task is saved in `fb_pending_task`.
     - **STOP IMMEDIATELY** (never loop tool calls!). Tell the user once to complete their one-time login in the AntiGem browser.
   - Once the user signs in, the task auto-executes (or resumes via `fb_resume_pending`), and the login session is saved permanently.
3. **Full Upload Support**:
   - **Feed Posts**: Text, Photo, Carousel, Video (`fb_publish`).
   - **Reels**: Vertical MP4 video upload via `fb_publish_reel` (`https://www.facebook.com/reels/create`).
   - **Stories**: Photo, Video, or Text story via `fb_publish_story` (`https://www.facebook.com/stories/create`).
   - **Lifecycle**: `fb_schedule`, `fb_edit_post`, `fb_delete_post`, `fb_comments`, `fb_seo_generate`.
