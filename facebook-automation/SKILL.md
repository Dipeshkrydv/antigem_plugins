---
name: facebook-automation-studio
description: "Master autonomous Facebook automation director and execution engine for mobile and desktop."
---

# Facebook Automation Studio Master Skill

## 1. Zero Duplicate Upload Law
- Always check SHA-256 file checksums before publishing media.
- Always check normalized text hash for captions.
- Reject duplicates within 48 hours.

## 2. Dynamic Identity Law
- Never hardcode user profiles or page names.
- Always query session dynamically via `fb_login_status`.

## 3. Algorithmic Reach Protection
- Never insert external links in main post bodies.
- Place outbound links in the first comment via `fb_comments`.
