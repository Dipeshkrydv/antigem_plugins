---
name: meta-suite-automation
description: "Meta Suite Page Management (v2.9.1): post, schedule and batch-publish photos, carousels, Reels (9:16), long videos (16:9) and Stories to the Facebook Page THROUGH META BUSINESS SUITE (business.facebook.com), with custom Reel/video thumbnails, native Business Suite scheduling, and assets from the built-in DeepX Google Flow engine. Before any upload, ask in ONE instant question round: timing (now / exact time / start + gap), thumbnail for videos (Google Flow / user image / none), and caption approval. Batches never stop until every post is done."
---

# Meta Suite Page Management (v2.9.1): Meta Business Suite engine

This plugin posts to the user's Facebook Page **only through Meta Business Suite** (`business.facebook.com`).
The plugin drives Business Suite itself and **locks the screen** while it works ("AI is working").
It never uses the facebook.com composer, never switches profile, and needs no screen taps.

---

## 0. Hard rules

1. **Never use browser MCP tools (`browser_*`)** to post, schedule, or tap anything for the Page. Use this plugin's tools only.
2. **Never upload to the Page through www.facebook.com.** All upload tools already go to Business Suite.
3. **Assets come from the built-in DeepX Google Flow engine**, immediately:
   `deepx_meta_generate_design` (post images), `deepx_meta_generate_thumbnail` (thumbnails/covers), `deepx_meta_generate_video` (clips).
   Poll `deepx_job_status`, then use `files[0].path`.
4. **Be fast.** Don't deliberate or probe the page; call the tools directly. A photo post takes about 17 s and a Reel about 45–50 s.

---

## 1. Permission round: ask instantly, all in ONE question call

Before **any** upload, ask the user everything that is missing, together, in **one** AskUserQuestion call, with no long thinking:

| # | Ask | Options |
|---|---|---|
| 1 | **Timing** | Publish now · Exact date & time (one per post) · Start time + gap between posts |
| 2 | **Thumbnail**, for every Reel/video | Generate with Google Flow (DeepX) · I'll provide the image · No custom thumbnail |
| 3 | **Caption**: show the EXACT final caption (title + text + hashtags; every caption for a batch) | Yes, use it · Edit it · Write a new one · Post without caption |

The tools enforce this. If something is missing they return `needs_user_input` with an `ask_user` list (the caption question includes `show_user`, the full caption text to display). Ask those questions as-is, then call the tool again with:
- timing: `publish_now: true` or `schedule_time_iso` (single post), or `timing` (batch);
- thumbnail: `thumbnail_path`, or `thumbnail_choice: "none"`. For `"flow"`, first run `deepx_meta_generate_thumbnail` (9:16 for Reels, 16:9 for long videos) and pass its file as `thumbnail_path`;
- caption: `caption_approved: true` (after a Yes, or after applying the user's edits).

---

## 2. Tools

| Need | Call |
|---|---|
| Text / photo / carousel (1-10 images) | `fb_publish {post_type, media_paths, title, caption, hashtags, publish_now \| schedule_time_iso, caption_approved}` |
| Reel 9:16 or long video 16:9 | `fb_publish_reel {video_path, thumbnail_path \| thumbnail_choice, title, caption, hashtags, publish_now \| schedule_time_iso, caption_approved}` |
| Story | `fb_publish_story {media_path, publish_now \| schedule_time_iso}` |
| **2 or more posts (a project)** | `fb_publish_batch {items:[...], timing}` with timing `{mode:"now"}`, `{mode:"exact", times:[ISO per item]}` or `{mode:"gap", start_time_iso, gap_minutes}` |
| Progress of any long job | `fb_publish_status {job_id, wait_seconds: 50}` |
| Schedule a single post | `fb_schedule` (or add `schedule_time_iso` to `fb_publish*`) |
| Other options | `share_to_story: true` · `save_draft: true` (Reels) · `dry_run: true` (fill everything, don't press the final button) |
| Caption help | `fb_seo_generate`, `meta_viral_seo_generate`, `fb_audit_caption` |
| Trends | `fb_trend_search {keywords, sources: "all", limit: 5}` |
| Diagnostics, only after a failure | `meta_bs_inspect`, `meta_bs_eval` |

**What happens in Business Suite**
- **Post:** Home → Create post → Add photo/video → caption (verified in the live Feed preview) → "Make this an ad post" OFF → Publish, or Set date and time → Schedule.
- **Reel / long video:** Home → Create reel (Meta publishes every video as a reel; the 16:9 ratio is kept) → Add Video → description (written into the composer's own state, so it really saves) → Thumbnail → Upload image → Next → Next → Share now / Schedule / Save as draft → Share.
- **Story:** Home → Create story → Add photo/video → Share now / Schedule → Share.
- **Scheduling** uses Business Suite's native scheduler, 15 minutes to 29 days ahead, and shows in **Planner** (AntiGem does not need to stay open). The date and time fields are read back and verified.
- **Big videos** (over 80 MB) are streamed through AntiGem's file chooser.
- **"Publish now" batches** with more than 3 posts pause 120 s between posts (anti-spam).

---

## 3. Never stop before the project is complete

- A batch works through every item, with 3 tries each **before** the final button press, and it never retries after the press (no double posts).
- While a job returns `finished: false`, keep calling `fb_publish_status {job_id, wait_seconds: 50}`. **Never end your turn, summarize, or ask anything mid-project.**
- When `finished: true`, report each post: published / scheduled (with time) / failed (with the reason).
- If a result says `may_have_posted: true`, **never retry**. Tell the user to check Business Suite → Content / Planner.
- If assets must be generated first, generate **all** of them, then start the batch, in the same turn.

---

## 4. Standard recipes

**Photo / poster post**
1. `deepx_meta_generate_design` ×N, then poll `deepx_job_status`.
2. Write the caption, then `fb_audit_caption`.
3. Run the permission round (timing + caption).
4. `fb_publish` for 1 post, or `fb_publish_batch` for several.

**Reel / long video**
1. Get the video (the user's file or `deepx_meta_generate_video`).
2. Run the permission round (timing + thumbnail + caption).
3. If the user chose Flow: `deepx_meta_generate_thumbnail` (9:16 or 16:9).
4. `fb_publish_reel` with `thumbnail_path`.

**Google Flow generation mode:** the DeepX tools ask "Agent Mode or Standard?" once (`ASK_GENERATION_MODE`). Standard mode switches to Agent Mode by itself if Google shows an unusual-activity block. If Standard fails with "Flow settings button was not found", the Flow Agent pill is on: run `deepx_flow_agent_toggle {active:false}` and retry.

---

## 5. Caption format (viral SEO)

```
🔥 <Hook: bold 1-line claim or question>

<Body: 3-5 short emoji bullets, scannable value>

<CTA: "Comment 'WORD' below" / "Save this for later" / "Share with someone who needs it">

#hashtag1 #hashtag2 #hashtag3 #hashtag4 #hashtag5   (3-6 hashtags, no outbound links in the caption)
```

---

## 6. Page

- `target_id: "me"` = the default Page. Business Suite uses its own Page `asset_id`; it is discovered automatically and cached.
- For several Pages, pass the Page URL / ID / name as `target_id`, or use `meta_list_pages` / `meta_set_default_page`.
