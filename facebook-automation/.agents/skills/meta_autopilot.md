---
name: meta-autopilot
description: >-
  Autonomous Meta (Instagram & Facebook) Production Autopilot. Use when the user requests to post, publish, or schedule anything (photos, reels, videos, stories, study routines, text posts) to Facebook, Instagram, or Meta Business Suite, or mentions 'post to facebook', 'post to insta', 'schedule post', 'manage social', 'renuka yadav', 'meta bridge', 'social automation', or 'handle my facebook/instagram'. Enforces permanent one-time setup, zero-tab prompts (never ask the user to open tabs, switch windows, or click UI buttons), automatic media generation for zero-friction posts, authentic account grounding (Renuka Yadav ID: 61592442011195 for Facebook personal feed, @renukayadav ID: 43599208749 for Instagram), viral SEO hooks and hashtags, and continuous background dispatch via SQLite WAL and WebSocket bridge.
---

# Meta Autonomous Social Autopilot (Instagram & Facebook)

This skill governs the high-speed, zero-interruption execution pipeline between Antigravity, local SQLite scheduler, and the Chrome Extension bridge (`ws://127.0.0.1:8765`) to manage Facebook and Instagram autonomously in the background.

---

## 0. Zero Setup Overhead & Autonomous Background Mandate (CRITICAL)

- **ONE-TIME SETUP IS ALREADY ACTIVE & RUNNING**:
  - The WebSocket bridge is active at `ws://127.0.0.1:8765`.
  - The Chrome Extension (`meta-bridge-ext`) is loaded and continuously syncs cookies and tokens.
  - The background scheduler daemon (`cli.py bridge`) actively processes jobs every 10 seconds.
- **ZERO DUMMY QUESTIONS & ZERO TAB PROMPTS MANDATE**:
  - Antigravity MUST **NEVER** ask the user to open `facebook.com`, `instagram.com`, or `business.facebook.com`.
  - Antigravity MUST **NEVER** ask the user to open the Chrome Extension popup or side panel.
  - Antigravity MUST **NEVER** pause generation to ask the user to switch windows or click UI buttons.
  - Antigravity MUST **NEVER** dump raw JSON session dumps into the chat.
  - Every posting or scheduling request MUST proceed straight to execution in the background.

---

## 1. Grounded User Credentials & Account Routing (STRICT TRUTH)

Antigravity operates with authentic, strictly grounded account data:
- **Facebook Personal Profile**:
  - Name: **`Renuka Yadav`**
  - Profile ID: **`61592442011195`**
  - Status: Active & healthy.
- **Instagram Account**:
  - Handle: **`@renukayadav`** (`renukaydv624`)
  - User ID: **`43599208749`**
  - Status: Synced.
- **Meta Business Suite Status**:
  - Status: **`No Pages Linked`** (Personal account only).
  - **CRITICAL ROUTING RULE**: Because Renuka Yadav does not have a linked Facebook Page in Business Suite, all Facebook posting commands MUST route to:
    `target_type: "profile"` and `target_id: "61592442011195"` (or `"me"`).
    This posts directly to Renuka Yadav's personal feed, preventing Business Suite redirect failures.

---

## 2. Instant Zero-Friction Media Synthesis

- **Instagram Rule**: Instagram requires a media file (JPEG photo or MP4 video) for all feed posts and reels.
  - If the user asks to post a text idea, study routine, quote, or plan to Instagram without providing a media file:
    1. Call `render_free_media_asset(asset_type="image", overlay_title="...", aspect_ratio="4:5")` or generate a visual with Nano Banana.
    2. Immediately proceed to publish or schedule to Instagram with the generated media asset.
- **Facebook Rule**: Facebook natively supports direct text posts as well as photo, album, video, and reel posts.
  - If media is provided or requested: Attach media.
  - If text-only: Post directly as `content_type: "text"`.

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

When the user says "Post X to Facebook" or "Post this to Instagram" or "Schedule routine for tomorrow":

### Step 1: Detect Platform & Target
- If user mentions **Facebook**:
  - Target: `target_type="profile"`, `target_id="61592442011195"`.
- If user mentions **Instagram**:
  - Target: Instagram feed or reel (`@renukayadav`).
- If user says **"Both"** or doesn't specify:
  - Dispatch to Facebook Personal Profile AND Instagram.

### Step 2: Prepare Media (if needed)
- If media is supplied (e.g. `/path/to/image.jpg`): Validate format (auto-conforms to JPEG/MP4).
- If Instagram post requested without media: Call `render_free_media_asset` to generate a 4:5 JPEG graphic.

### Step 3: Format Viral SEO Caption
- Synthesize engaging caption with hook, bullet points, and 3-8 viral hashtags.

### Step 4: Dispatch Post in Background
- For Facebook:
  - Call MCP tool `publish_or_schedule_facebook` OR run `python3 cli.py post --platform facebook --target profile --target-id 61592442011195 --caption "..." --force`.
- For Instagram:
  - Call MCP tool `publish_or_schedule_instagram` OR run `python3 cli.py post --platform instagram --type photo --media "..." --caption "..." --force`.
- For Scheduling:
  - Supply ISO-8601 UTC timestamp `schedule_time_iso` to enqueue into the SQLite APScheduler queue.

### Step 5: Report Clean Confirmation
- Report clean, human-friendly confirmation:
  - Platform (`Facebook (Renuka Yadav)` / `Instagram (@renukayadav)`)
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


