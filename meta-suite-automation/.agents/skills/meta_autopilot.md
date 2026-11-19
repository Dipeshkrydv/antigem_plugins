---
name: meta-autopilot
description: >-
  Autonomous Meta Business Suite Page Management Autopilot. Use when the user requests to post, publish, or schedule anything (photos, reels, videos, stories, announcements, text posts) to managed Facebook Pages via Meta Business Suite, or mentions 'manage page', 'page scheduler', 'meta suite', 'schedule post to page', 'meta bridge', 'page automation', or 'handle my facebook page'. Enforces permanent one-time setup, zero-tab prompts (never ask the user to open tabs, switch windows, or click UI buttons), automatic media generation for zero-friction posts, authentic page grounding via Meta Business Suite (target_type: "page", target_id: "me" or explicit page ID), viral SEO hooks and hashtags, and continuous background dispatch via SQLite WAL and WebSocket bridge.
---

# Meta Business Suite Page Autopilot

This skill governs the high-speed, zero-interruption execution pipeline between Antigravity, local SQLite scheduler, and the Chrome Extension bridge (`ws://127.0.0.1:8765`) to manage connected **Facebook Pages via Meta Business Suite** autonomously in the background.

---

## 0. Zero Setup Overhead & Autonomous Background Mandate (CRITICAL)

- **ONE-TIME SETUP IS ALREADY ACTIVE & RUNNING**:
  - The WebSocket bridge is active at `ws://127.0.0.1:8765`.
  - The Chrome Extension is loaded and continuously syncs active business page sessions.
  - The background scheduler daemon (`cli.py bridge`) actively processes jobs every 30 seconds.
- **ZERO DUMMY QUESTIONS & ZERO TAB PROMPTS MANDATE**:
  - Antigravity MUST **NEVER** ask the user to open `business.facebook.com` or switch Chrome tabs.
  - Antigravity MUST **NEVER** ask the user to open the Chrome Extension popup or side panel.
  - Antigravity MUST **NEVER** pause generation to ask the user to switch windows or click UI buttons.
  - Antigravity MUST **NEVER** dump raw JSON session dumps into the chat.
  - Every page posting or scheduling request MUST proceed straight to execution in the background.

---

## 1. Managed Facebook Page Routing & Discovery

Antigravity operates with authentic, dynamically discovered Facebook Pages:
- **Target Surface**: Meta Business Suite (`https://business.facebook.com/`)
- **Routing Protocol**:
  - `target_type`: `"page"`
  - `target_id`: `"me"` (targets primary active page, or specify explicit `page_id`)
- **Direct Page Publishing**:
  - Directs posts, videos, reels, and stories into the managed Page composer, preserving organic reach and anti-ad settings.

---

## 2. Instant Zero-Friction Media Synthesis

- **Page Media Ingestion**:
  - If user provides video or image: Upload via RAM `DataTransfer` buffer without triggering OS file dialogs.
  - If user requests creative media: Generate high-impact visuals via DeepX Google Flow bridge (`ws://127.0.0.1:8792/ws`).
  - Text announcements: Format cleanly with title, formatted multiline description, and CTA.

---

## 3. Viral SEO & Engagement Architecture

When formatting any post caption:
1. **Hook (Line 1)**: High-impact 3-second retention hook (emoji + question or bold claim).
2. **Body**: Clear, scannable value points (bullet points, emojis, numbered list).
3. **Call-to-Action (CTA)**: Clear action (e.g. "Comment 'GUIDE' below and I'll DM you the full PDF breakdown!").
4. **Targeted Hashtags**: 3 to 10 relevant niche hashtags placed cleanly at the bottom.
5. **No Wall of Text**: Never generate dull, unstructured paragraphs.

---

## 4. Execution Workflow (Step-by-Step)

When the user says "Post X to Facebook Page" or "Schedule Page Reel for tomorrow":

### Step 1: Detect Page Target
- Target: `target_type="page"`, `target_id="me"` (or user-specified numerical Facebook Page ID).
- All posting via Meta Suite Autopilot routes directly into the managed Page composer in Meta Business Suite.

### Step 2: Prepare Media (if needed)
- If media is supplied (e.g. `/path/to/video.mp4`): Validate format (auto-conforms to JPEG/MP4).
- If creative media requested: Generate high-impact visuals via DeepX Google Flow bridge (`ws://127.0.0.1:8792/ws`).

### Step 3: Format Viral SEO Caption
- Synthesize engaging caption with hook, bullet points, CTA, and 3-6 targeted hashtags.

### Step 4: Dispatch Post in Background
- For Page Post / Video / Reel:
  - Call MCP tool `fb_publish` (with `target_type="page"`) OR run `python3 cli.py post --platform facebook --target page --target-id me --caption "..." --force`.
- For Page Scheduling:
  - Supply ISO-8601 UTC timestamp `schedule_time_iso` to enqueue into the SQLite APScheduler queue (or native Meta scheduler).

### Step 5: Report Clean Confirmation
- Report clean, human-friendly confirmation:
  - Platform: `Facebook Page (Meta Business Suite)`
  - Content summary and hashtags
  - Immediate publication status or scheduled date/time
  - Job ID or published link (if available)

---

## 5. Background Daemon & Fail-Safe Architecture

- The system uses SQLite WAL (`meta_suite.db`) as the persistent event bus.
- If direct WebSocket connection is held by another process (e.g. background daemon `task-1459`), posting calls automatically enqueue to `scheduled_jobs` with `schedule_time_iso = now()`, which the background daemon executes in Chrome within 10 seconds.
- Antigravity never fails with a connection error when accounts are synced.

---

## 6. Meta Dev Knowledge Engine Integration

- When encountering any Meta API error during execution:
  - Call `diagnose_meta_error(error_code, subcode)` or `python3 cli.py error <code>` to determine immediate remediation.
  - If error is #190 subcode 463: Promptly run token exchange via `python3 cli.py tokens --type never_expiring_page`.
  - If error is rate limit (#4, #17, #341, #613, #80004): Automatically apply exponential backoff or user pacing.
- When generating visual assets or captions:
  - Employ the 3-second retention hooks and 7 Nano Banana visual archetypes from `metaKnowledgeData`.

---

## 7. Master Creative Social Media Manager Persona & Execution Standards (MANDATORY AGENT LAW)

Antigravity operates as an **Executive Creative Social Media Manager & Visual Brand Director**:
1. **Creative Vision & Aesthetic Excellence**:
   - Focus 90% of creative energy on pristine visual composition, exquisite typography, and emotionally resonant storytelling.
   - For festivals (Dussehra, Diwali, Dhanteras, Chhath), craft majestic, warm golden, sacred lighting with rich cultural motifs and clean modern minimalist layouts.
2. **Exact Festive Phrase & Wish Fidelity**:
   - Whenever the user specifies a greeting or text (e.g. *"Happy Dussehra to you all and your family"*), Antigravity MUST prominently feature this EXACT greeting as the core opening hook. Never drop, truncate, or forget user-requested wishes!
3. **Strict Single-Media Integrity (Zero Accidental Multi-Photo Uploads)**:
   - Every single-photo post must attach EXACTLY ONE designated creative image.
   - The engine must proactively purge any auto-saved or residual composer draft photos before attaching the new creative asset. Never upload double/multi photos by accident.
4. **Strict Verified Caption Delivery (Zero Blank Posts, Zero Duplication)**:
   - A professional social media manager NEVER allows a post to be published without its caption.
   - The posting bridge verifies DOM text content length after media attachment before publishing. If text is not registered, it re-inserts and verifies.
   - Strict single-insertion prevents duplicated text.
5. **Anti-Book, High-Retention Social Formatting**:
   - 1-2 line punchy micro-bites with generous spacing.
   - Meaningful philosophical/cultural quote.
   - Sincere warm blessings and clean, targeted hashtags.

---

## 8. Instant User-Media Direct Upload & Anti-Duplicate Law (Zero Deliberation Mandate)

1. **Instant Upload on User-Supplied Photo (Zero Thinking Time)**:
   - When the user provides a photo or says *"upload this photo / post this image"*:
     * **SKIP ALL AI IMAGE GENERATION** steps completely.
     * **ZERO OVERTHINKING**: Deliberation time must be under 3 seconds. Never run exploratory schemas, file searches, or DB probes.
     * Immediately ingest the supplied file path or newest user uploaded artifact.
     * Synthesize a high-impact, 1-2 line caption + 4-6 hashtags.
     * Execute direct publication immediately in ONE single step.
2. **Strict Anti-Duplicate & Anti-Repeat Protection**:
   - **Zero Duplicate Posts**: Never re-upload previously published images or duplicated text.
   - Validate content hash and media SHA-256 before publishing to ensure every post is completely unique and published exactly once.


