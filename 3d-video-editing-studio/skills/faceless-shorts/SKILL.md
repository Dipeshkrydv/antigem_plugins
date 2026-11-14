---
name: faceless-shorts
description: Make narrated faceless YouTube Shorts / TikToks / Reels fully in code on the user's computer, with a free local AI voice and word-synced captions, $0. Six styles - Deep Dive 3D (Zack D. Films-like 3D "what happens if" body/science explainers), Night File 3D (unsolved mysteries, true crime), Inside Out (flat 2D x-ray explainers), Stick Story (stick-figure "what would you do if" survival steps), Paper Atlas (history in cut paper with maps), Tall Tale 3D (funny true stories with flat 2D cartoon people in a sunny 3D world, one-word captions). Use whenever someone wants a faceless short, a what-if or what-happens-if explainer, a Zack D. Films style video, a mystery or true-crime short, a stick-figure story, a history short, a funny true story or storytime cartoon short, or a video in one of these styles, even from just a topic.
---

# Faceless Shorts

You make a finished vertical short from a topic: script, voice, word-synced captions, animated shots, sound and
music, rendered to MP4. **Everything is code**: canvas drawing, headless Chrome capture, ffmpeg, a local Kokoro voice,
local Whisper word timing, numpy sound. No AI images or video, no API keys, no credits.
`SKILL` = the folder this file is in. Projects live in `~/faceless-shorts/<short-name>/`.

| style | what it makes | length · aspect |
|---|---|---|
| **Deep Dive 3D** `deep-dive` | the flagship, Zack D. Films-like: sculpted 3D people in sunlit sets, glowing x-ray bodies, camera journeys through blood vessels, shallow focus. "What happens if…?" body and science | 30-45 s · 9:16 |
| **Night File 3D** `night-file` | unsolved mysteries / true crime: dark 3D places with one light, faceless people (the subject glows red), typewriter dates, case-file inserts | 30-45 s · 9:16 |
| **Inside Out** `inside-out` | flat 2D "What happens if…?" explainer: a simple hero, x-ray cutaways, bold 1-3 word captions, punchy cuts | 25-40 s · 9:16 |
| **Stick Story** `stick-story` | "What would you do if…?" survival steps: stick people with acting eyes, flat rooms day/night, gold step cards | 30-45 s · 9:16 |
| **Paper Atlas** `paper-atlas` | history in cut paper: parchment maps, crimson routes, gold date ribbons, period figures | 30-45 s · 9:16 |
| **Tall Tale 3D** `tall-tale` | funny true stories: flat 2D cartoon people (big round heads, ink outlines) acting in a sunny 3D small-town world, camera always moving, one-word captions | 40-60 s · 9:16 |

Lengths above are each style's **default**. A custom length from intake overrides them: aim within ~±20% of what the
user asked for, and never pad or truncate the story to hit a number — more content, not slower talking, for longer.

Which style: body / health / science "what happens if" → **Deep Dive 3D** (or **Inside Out** for a lighter, faster 2D
look) · creepy, unexplained, true crime, "this happened in 1971" → **Night File 3D** · survival, life hacks, "here's what
you do" → **Stick Story** · a historical event, "how X happened" → **Paper Atlas** · a funny or clever true story, a con, a loophole, "this guy did X" → **Tall Tale 3D**. If it isn't obvious, ask once.

Each style = `styles/<style>/style-sheet.png` (the look in one image, drawn by the style's own code) + `STYLE.md` (the rules + the engine manual) +
`example/` (a complete project that renders as-is). **Read the style's STYLE.md in full before planning.**

## 0. Mandatory Pre-Flight Auto-Installation (Zero Missing Prerequisite Law)
**Before starting to use this skill, EVERYTHING needed must be verified and installed.**
Run:
`bash SKILL/scripts/doctor.sh` (or `bash SKILL/scripts/setup.sh`).
It automatically checks and non-interactively installs all required tools:
1. System Binaries: Node.js 20+, ffmpeg, Chromium / Google Chrome (on Termux: `pkg install nodejs-lts ffmpeg chromium`).
2. Private Python 3.10+ virtualenv (`~/.faceless-shorts/venv`) with `numpy`, `scipy`, `kokoro-onnx`, `faster-whisper`, `soundfile`.
3. Neural Kokoro TTS model weights (~340 MB) in `~/.faceless-shorts/kokoro/`.
4. Faster-Whisper `small.en` model (~500 MB) cached locally.
5. Auto-registers skill symlink into AntiGem / Gemini IDE (`~/.gemini/config/skills/faceless-shorts`).

*Hardcoded Pre-Flight Guard:* Every script (`new_video.sh`, `scripts/py`, `tools/capture.mjs`) automatically invokes `setup.sh` if any dependency is absent, ensuring 100% autonomous operation without manual user setup friction.

## 1. Intake (ONE message, defaults filled in)
Ask only what's unknown, all at once: topic (or "you pick 3 ideas"), a link to a short whose format they like (optional),
length (default ~30 s · **any custom length the user asks for is fine**, from a ~10 s teaser to ~3 min —
scripts scale to it, the style's typical range is only a default), voice
(`SKILL/scripts/py SKILL/scripts/voice.py --list`; default `am_michael`), voiceover mode:
**AI voice** (default) · **their own recording** (they record after seeing the script; `words.py --audio`) ·
**captions-only** (no voice yet; `estimate.py`), music (built-in bed · none · their own royalty-free file), end line / handle.
"Just go" = the defaults.

## 2. The plan (ONE screen, then wait)
Show: title · **the target length in seconds** · the full narration, one line per cut, with its caption chunks (`WHAT IF *YOU | SWALLOW *GUM?`) · the shot list,
one line each (what we see, what moves, which word it lands on) · new components you'll add to the kit, if any · facts and
their sources. Ask **"Build it?"** and wait.

**Script rules.** Write it the way a person actually talks to a friend: full, flowing sentences with connecting words
("Well,", "where", "but", "so", "which means"), not a list of short caption-like statements. **Script to the target
length at ~3 words per second of voice** (≈90–110 words for the default 35 s; for a custom length, scale the word count:
~20 s → ~60 words, ~60 s → ~180 words, ~3 min → ~540 words — and check it with a dry `estimate.py` run before recording).
**A line is a CUT, not a sentence**: split each sentence into 1-3 lines at natural pauses (commas, "and", "where"), so
the picture changes every 1.5-3.5 s while the voice keeps flowing (voice.py speaks each whole sentence in one pass).
Shape: hook question, then escalation, a myth or surprise, a twist ("but if you…"), a punchy last line that loops.
Write numbers as they're said ("seven"). Read it out loud in your head: if it sounds like captions, rewrite it.
Original writing only: take a format you like, never another creator's script or shots. Every fact is checked against a
reliable source (list them in `script.json` "sources"). Health topics: accurate, no gore, no scary misinformation.

## 3. Build
1. `bash SKILL/scripts/new_video.sh <style> <short-name>` copies the example into `~/faceless-shorts/<short-name>/`.
2. Write `script.json` (lines + caps + gaps; see STYLE.md).
3. Timing: `SKILL/scripts/py SKILL/scripts/voice.py <proj>` then `SKILL/scripts/py SKILL/scripts/words.py <proj>`
   (own recording: `words.py <proj> --audio their.m4a`; captions-only: `estimate.py <proj>`).
4. Rewrite `src/shots.js`: one shot per line (or two for long lines), each placed with `cut(i)` and its key moments on
   words with `Wd('word', line)`. Reuse the kit (`src/core/kit.js`); add new components there, in the style's look.
5. In the project: `node tools/capture.mjs check` (must say CHECK OK) → `node tools/capture.mjs cues` →
   `SKILL/scripts/py tools/mix.py .` → QA (section 4) → `node tools/capture.mjs video renders/<name>.mp4`.
   Iterating on one shot: `node tools/capture.mjs frames review/f "4.2,4.6"` and look.

## 4. QA: never show a frame you haven't looked at
`node tools/capture.mjs sheet review/all.jpg 0.5 10` (a frame every 0.5 s, time-stamped) and read the whole sheet, then key
frames full size. For every frame ask:
- **Does it make sense?** One visual mode per shot: if the body is x-ray, ALL of it is x-ray (no shirt sleeves on an x-ray
  body). Props move with whatever holds them (gum stays in the hand until the hand reaches the mouth). Nothing appears before
  its cause.
- **Does it match the narration at that moment?** The picture changes just before its line; reveals land on their word.
- **Is anything colliding?** Moving things never cross labels, pills, the caption zone (y 1250-1550) or each other by accident.
- **Captions:** 1-3 words, exactly one yellow word, spelled right, on the word being said, readable on a phone.
- **Style sheet:** only the palette, flat shapes, x-ray views in cyan, danger in red.
- **Sound:** voice clear over the music; effects soft (no harsh ticks or beeps).
Fix, re-render the sheet, re-check. Tell the user what you caught and fixed.

## 5. Deliver
Open the MP4 for the user. Also give: a share copy if > 35 MB (`ffmpeg -i in.mp4 -c:v libx264 -crf 21 -preset slow -c:a aac
-b:a 160k -movflags +faststart share.mp4`), the best cover frame (`capture.mjs frames`), a title, a caption and 5-8 hashtags.
For own-recording mode, also give them the script with each line's timing to read against. Offer one round of precise changes
and re-render only what changed.

## Adding a new style (when the user asks)
Make `styles/<new-style>/` with `style-sheet.png`, `STYLE.md` (same sections as Inside Out: look rules, palette, format,
engine/kit map, components, shot anatomy, cue types, QA pitfalls) and a complete `example/`. Copy Inside Out's
`tools/`, `index.html`, `src/main.js`, `src/core/{lib,timing,captions}.js`, then build the new look's kit and shots. The
shared scripts (voice, words, estimate, new_video, selftest) work unchanged. Add a row to the table above and run
`selftest.sh` until every style passes.

## 2D Studio Audio (Music & SFX) and Font Assets Integration
All styles natively integrate authentic, broadcast-grade audio and font assets from the 2D Animation Studio library, completely replacing robotic procedural audio with rich recorded sound:
1. **Studio Background Music (`audio/music`)**:
   - `lifestyle_and_acoustic` (Revolution acoustic cover): `"music": "bed"` or `"acoustic"` (best for Stick Story, Tall Tale)
   - `crime_and_suspense` (Tension Build & Mystery Ambient): `"music": "tension"` or `"mystery"` or `"suspense"` (best for Night File, Deep Dive)
   - `documentary_and_history` (History Serious & Desert Whispers): `"music": "documentary"` or `"history"` (best for Paper Atlas)
   - `tech_and_corporate` (Tech Modern & Dark Synthwave): `"music": "tech"` or `"synthwave"` (best for Inside Out, Deep Dive)
   - `epic_and_action` (Action Drums): `"music": "action"` or `"epic"`
   - `viral_and_hiphop` (Tommy Richman - Million Dollar Baby instrumental): `"music": "viral"` or `"hiphop"` or `"bounce"`
   - Automatic seamless looping for any duration, smooth fade-in/fade-out, and -24 dB voice ducking mixed to -14 LUFS standard.
2. **Studio Foley SFX Suite (`audio/sfx`)**:
   - Over 190 real recorded sound effects categorized into `paper/`, `transition/`, `ui/`, `conflict/`, and `map/`.
   - Automatic cue mapping: `whoosh`, `slide`, `pop`, `plop`, `slam`, `thud`, `stamp`, `marker`, `circle`, `underline`, `typewriter`, `tock`, `paper`, `fold`, `pin`, `tape`, `riser`, `swell`, `shimmer`, `scoreboard`, `split_flap`.
3. **Studio Multi-Language Font Suite (`fonts/`)**:
   - 25 authentic typography fonts:
     - **Hindi & Indic**: `Baloo 2` (ExtraBold/Bold), `Khand`, `Kalam`, `Noto Sans Devanagari`, `Noto Serif Devanagari`, `Yatra One`, `Kruti Dev`.
     - **English & Latin**: `Anton`, `Montserrat`, `Playfair Display`, `Space Mono`, `Lora`, `Aquawax`, `Liberation Sans`, `Inter`.
     - **Nepali**: `ams.aaditya`, `Aakriti`, `0001 ARAP BK`.
   - Automatic Devanagari Unicode glyph fallback (`Baloo 2` + `Noto Sans Devanagari`), so Hindi and Nepali captions render with round, bold, viral styling instead of generic system fallbacks.

## 3D & 2D High-Speed Accelerated Render Engine & Mobile Shield
All styles render frame-exact through headless Chrome and FFmpeg with $0 API cost and zero generative AI lag.
**High-Speed Accelerated Architecture (v2.0)**:
1. **Pipelined Double-Buffering**: Headless Chrome renders and extracts frame `i+1` asynchronously in parallel while Node.js and multi-threaded FFmpeg ingest and compress frame `i`. Eliminates sequential blocking and boosts frame throughput by **25% to 35%**.
2. **Dynamic Affine Canvas Scaling**: Both 2D Canvas and 3D WebGL render targets dynamically adapt to target resolution (`720x1280` or `540x960`) via native Skia matrix transform `ctx.setTransform(scale, 0, 0, scale, 0, 0)`, cutting raw software libjpeg encoding time from 235ms down to 76ms (3.1x faster!).
3. **Optimized Multi-Threaded FFmpeg Pipeline**: Employs dynamic thread scaling (`-threads Math.min(os.cpus().length, 8)`) and high-efficiency SIMD bicubic filtering (`scale=1080:1920:flags=bicubic`), replacing heavy sinc/lanczos filters.
4. **Instant Shot-Based Validation (`check`)**: Replaces heavy 200+ frame sampling with keyframe verification across every unique shot in `OP.shots()`. Full project check finishes in 1–3 seconds with live progress indicators.
5. **Production Speed Presets**:
   - `node tools/capture.mjs video renders/out.mp4 --turbo` : 720x1280 @ 24fps, x264 `ultrafast` (CRF 24). **4x to 5x faster overall**, high-retention vertical Shorts.
   - `node tools/capture.mjs video renders/out.mp4 --fast`  : 720x1280 @ 24/30fps, x264 `veryfast`/`ultrafast` (CRF 22). **3x to 4x faster**, crisp HD master (default on mobile / Termux).
   - `node tools/capture.mjs video renders/out.mp4 --draft` : 540x960 @ 24fps, x264 `ultrafast` (CRF 28), bloom/bokeh bypassed. **6x to 8x faster** (~15 fps) for instant rapid preview.
   - `node tools/capture.mjs video renders/out.mp4 --1080p` : 1080x1920 @ 30fps with pipelined double-buffering. Full broadcast master.
   - `node tools/capture.mjs video renders/out.mp4 --fps 24` : Custom framerate override.

**Hardcoded Anti-LMK Protection**: On Android (Termux) and mobile devices (ARM/ARM64 / <=6GB RAM):
- `--disable-dev-shm-usage`, `--no-sandbox`, and single-renderer process limits prevent /dev/shm starvation and OS memory panics.
- Periodic V8 GC purge (`window.gc()`) every 25 frames keeps RAM flat **under 150 MB**, completely preventing "offline server" socket drops.
- Clean shutdown with `srv.closeAllConnections?.()` and `process.exit(0)` prevents hanging background ports.

## Never
Generate images or video with AI; spend the user's money or credits; copy another creator's script, shots or frames;
overwrite a user's project without asking; ship a frame you haven't looked at.
