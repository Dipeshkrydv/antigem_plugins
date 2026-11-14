# Deepesh Studio Engine v2 — reference (with v3 additions)

> **v3 additions** (details: CREATIVE_DIRECTOR.md)
> * `stamp` has 5 designs: `rubber` `seal` `tape` `scrawl` `tab` (`"design"`); the variety pass allows ≤ 2 rubber stamps per
>   video and re-designs the rest; EDIT.json `"variety": {"auto": true, "budget": {...}, "rubber_gap": 3}`
> * `kicker` renders at 46 px (`"size"`) in 5 designs: `bar` `chip` `bracket` `rule` `index` (`"design"`, `"number"`)
> * all shadows are natural (two-tier, warm, padded so they never clip); new `kit.ground_shadow`
> * scene transitions without an explicit `transition` rotate through the style's vocabulary

v2 replaces the v1 shot renderer (`core/render.py` + `SCENES.tsv`, still present for old projects).
What changed and why:

| v1 problem | v2 fix |
|---|---|
| Flow "unusual activity" after big batches | one prompt at a time, 1.3 s after Flow accepts each, stop on the first flag (`core/flow_guard.py`, Claude Code hook, `studio.py generate`) |
| Stamp drawn over the sticker, burst lines over the art | Slot layouts: named, non-overlapping rectangles; accents drawn outside the asset |
| Captions half-clipped / unreadable | Captions rendered in Pillow with raqm Devanagari shaping, measured bounds, reserved band, contrast plate/stroke |
| One lonely sticker per scene | Scenes are compositions: title + visuals + labels + stamps + callouts + strings |
| Plain slideshow | Camera moves, scrims, per-line title reveals, karaoke captions, transitions, letterbox, grade/vignette/grain |
| Slow render, re-encode for subtitles | Parallel chunks, grade/grain inside ffmpeg, chunks joined without re-encode |
| One-line image prompts | `core/prompt_engine.py`: structured shots, validated, style-pack defaults |

## Project files

| file | made by | purpose |
|---|---|---|
| `LINES.tsv` | you | `id`, `text`, `gap` — spoken lines |
| `VO.wav`, `VO.tsv`, `WORDS.tsv` | `studio.py voice` | audio + line/word timings |
| `SHOTS.json` | you | structured image/video shot list |
| `ELEMENTS.tsv`, `PROMPTS.md` | `studio.py prompts` | final prompts (review PROMPTS.md) |
| `elements/raw/`, `elements/cut/` | `generate`, `key` | images; transparent cut-outs |
| `EDIT.json` | you | the edit |
| `cues.tsv` → `mix.wav` | you / `studio.py mix` | music + SFX (optional; else VO.wav is used) |

## EDIT.json

```json
{
  "style": "noir",            // noir | cinematic | documentary | sticker | box
  "aspect": "16:9",           // or "9:16"
  "fps": 24,
  "captions": "auto",         // auto (style default) | cinema | box | pop | off
  "scenes": [
    {"at": "@01", "bg": "bg_kot_night", "layout": "hero", "camera": "push_in", "transition": "dip",
     "captions": true,
     "items": [ {"type": "title", "text": "14 सितंबर *1846*", "at": "चौदह"} ]}
  ]
}
```

**Cues** (`at`, `until`, list/timeline points): `12.4` seconds · `@05` start of line 05 · `राणा` first spoken word
containing it, searched forward from the scene start · `राणा+0.3` shifted · `w:1906` a number word.
Items without `at` enter just after the scene starts. Items without `until` stay to the end of the scene.

**Scene fields:** `bg` = image name in `elements/` or `paper` / `dark` / `grid` / `auto` ·
`camera` = `push_in` `pull_out` `pan_left` `pan_right` `rise` `drift` `still` ·
`transition` (into this scene) = `dip` `fade` `flash` `slide` `whip` `cut` · `captions: false` hides captions in that scene.

### Layouts and their slots

| layout | slots | use for |
|---|---|---|
| `hero` | tag, title, label, stamp, lower, **right** | text column left + main visual right (default) |
| `hero_r` | tag, title, label, stamp, lower, **left** | mirror of hero |
| `duo` | tag, title, left, right, label | compare two things |
| `trio` | tag, title, a, b, c, la, lb, lc | three items / steps |
| `board` | tag, a, b, c, d, e, stamp | evidence board: pinned photos + red `string`s |
| `focus` | tag, center, l1, l2, r1, r2, stamp | one object explained by callouts |
| `quote` | tag, title, label | big statement |
| `split` | tag, title, list, left | picture + bullet list |
| `timeline` | tag, title, band | dates on an animated line |
| `clean` | tag, stamp | let a strong picture breathe |
| `presenter` | tag, title, left, **cast** | picture + the character host explaining it (v3) |
| `presenter_l` | cast, tag, title, right | mirror of presenter (v3) |
| `stage` | tag, label, **cast** | full character scene in a parallax world (v3, scene field `stage`) |

If two items use the same slot, the later one replaces the earlier (it exits as the new one enters).
`python core/engine/layouts.py` proves no layout has overlapping slots (16:9 and 9:16).

### Item types

| type | fields | notes |
|---|---|---|
| `kicker` | text, design, size, number | case-file tag at 46 px; designs `bar` `chip` `bracket` `rule` `index` (rotated per scene) |
| `title` / `quote` | text, lines | `*word*` = accent colour; balanced line breaks; per-line mask reveal |
| `keyword` | text | marker-sweep pill |
| `asset` | name, label, frame, accent, tilt, enter | cut-out from `elements/cut`; frame `clean` `sticker` `paper` `card` `polaroid`; accent `burst` `circle` `underline` |
| `photo` | src, crop [x0,y0,x1,y1], caption, frame, aspect | any image as `polaroid` / `print` / `card` / `sticker` |
| `stamp` | text, color, design | emphasis mark: `rubber` (slam + shake, max 2/video), `seal`, `tape`, `scrawl`, `tab`; no design = the variety pass picks |
| `character` | cast, enter, from, x, height, talk, exit, actions | animated cartoon host (CHARACTER_MODE.md) in a `cast` slot |
| `callout` | text, point [x,y] (0–1 of frame) | leader line draws from the point to the label |
| `counter` | from, to, prefix, suffix, dur | rolling number |
| `lower_third` | text, sub | name + role bar |
| `list` | items [{text, at}] | bullets appear on their cues |
| `timeline` | points [{label, text, at}] | progress line + dots |
| `string` | from (slot), to (slot) | red string between two board items |
| `redact` | text, reveal (cue) | black bar slides away at the reveal cue |

`enter` overrides the entrance: `rise` `pop` `drop` `slide` `slide_l` `fade` `wipe` `type` `slam`.

## Style packs (`core/engine/styles.py`)

One file defines both the on-screen look and the prompt defaults, so images and edit match.

| style | look | captions | asset frame |
|---|---|---|---|
| `noir` | dark, letterbox, teal/amber grade, grain, red emphasis marks | cinema (karaoke) | clean shadow; photos polaroid |
| `cinematic` | wide letterbox, warm grade | cinema | clean; photos print |
| `documentary` | cream paper (Vox), red/yellow accents | box | paper cut-out |
| `sticker` | dotted paper, bold stickers, doodle accents | pop (big, outlined) | sticker |
| `box` | dark editorial cards, indigo/yellow | box | card |

## Prompt engine (`SHOTS.json` → `ELEMENTS.tsv`)

Required per kind — **scene**: subject, location, time, camera, lighting, palette, mood, composition ·
**asset**: subject, material, view · **video**: + action, beats [{t, action, camera}], optional sound, duration.
`world.characters` holds character sheets; list them in a shot's `cast` so every image describes them identically.
Rejected: subjects under 4 words, vague words (nice/beautiful/cool…), compositions that don't say where text goes.

## Speed

Measured on this phone (8 cores): 540p preview ≈ 110 fps; 1080p final with grade + grain ≈ 20 fps (a 6-minute video ≈ 5 min).
`pip install opencv-python-headless` (if available) speeds up camera moves further. Workers are picked from free RAM;
override with `--workers N`. Partial renders: `--from 30 --to 60`.


## Voice ↔ visual sync (exact)

`studio.py voice` synthesises every line through Cartesia's SSE endpoint with `add_timestamps`, so `WORDS.tsv` holds
the **true** start/end of every spoken word (column `src = cartesia`). The old method estimated word times from syllable
counts and drifted up to **0.41 s (10 frames)**. Verified on the Rana voiceover: median loudness inside words 0.125,
inside the pauses between them 0.0006, so the timestamps sit on the audio.

* Visuals fire `cue_lead` seconds (default 0.08 = 2 frames) **before** their word, as editors cut, so eye and ear land together.
* Captions highlight each word exactly while it is spoken.
* `studio.py check` reports: sync source (exact / estimated lines), **every VO line that has no visual while spoken**,
  visual density (target: a new beat every ≤ 3 s) and the longest gap.
* Recorded (non-Cartesia) voice: provide `WORDS.tsv` from a real aligner; `check` warns while timings are estimated.

## Asset quantity: one dedicated image per beat

`python studio.py plan [--pace fast|normal|calm]` derives the target from the voiceover: a new visual every 2.5 s
(normal) and **one purpose-made image per beat, each with its own master prompt**. A 6-minute voiceover needs ~145
images (~55% full-frame scenes: wide / medium / close-up / insert detail; ~45% cut-outs: props, documents, portraits,
symbols). `PLAN.md` lists how many images each line needs.

Extras that add motion on top (they never replace dedicated images):

| extra | what it adds |
|---|---|
| scene `cuts` in EDIT.json | camera re-framings of a scene image: `{"at": "word", "frame": "close" \| "medium" \| "extreme" \| "wide" \| [x0,y0,x1,y1], "focus": [x, y]}` |
| `photo` items with `crop` | an image reused as polaroid / print / evidence-board pin |
| `kind: "sheet"` in SHOTS.json | 2–6 small objects from one prompt, split by `studio.py key` (exact count or it refuses) |
| text beats | keywords, stamps, counters, callouts, lists, timelines |

### Master prompts that grab attention

Every shot states subject, action, location, era, time, camera (shot / lens / angle / movement), lighting, palette,
mood + theme, composition and details, and the engine adds the style pack's **clarity rules**: one dominant focal
subject, minimal uncluttered background, strong silhouette and contrast, one bold colour accent, clean negative space
where the Hindi headline will sit. Use `focal` (what the eye must hit first) and `hook` (the visual surprise that makes
someone stop scrolling) on every shot.

## Creative typography

Inline markup in any title / keyword / list text (spans can cover several words):

| markup | effect |
|---|---|
| `*word*` | accent colour |
| `^word^` | second accent colour |
| `_word_` | highlighter box behind the word (text auto black/white for contrast) |
| `[word]` | outlined box |
| `~word~` | hand-drawn underline |

* **Keyword treatments** (`"box"`): `pill`, `tag`, `sticky`, `torn`, `neon`, `label`, `marker`, `outline`. Without `box`
  the engine rotates through the style pack's list so consecutive keywords never look the same; a treatment that
  doesn't fit its slot falls back to one that does.
* **Fonts** (`"font"` on title/quote): `display`, `headline`, `body`, `serif`, `vintage`, `round`, `impact`, `hand`
  (Kalam handwriting, Hindi + Latin), `mono`.
* **Colour:** `"fill": "gradient"` (+ optional `"from"`, `"to"`) on titles; per-scene `"accent"`, `"accent2"`, `"accent3"`
  (hex) to colour-code chapters; top-level `"highlight_words": [...]` keeps key terms coloured in captions.
* Symbols the Hindi fonts lack (→ ✓ …) are substituted automatically, so no empty-box glyphs.


## Style engines (styles/*.py)

Each file in `styles/` is a self-contained creative engine for one visual style: on-screen
look, image-prompt defaults, style-specific layouts, idiomatic scene recipes, and design notes.
Drop a new `styles/<name>.py` with the same shape as the existing files and the engine picks
it up automatically — no code changes to the renderer.

| style file | canonical | aliases | signature move |
|---|---|---|---|
| `styles/box.py` | `box` | card, editorial, premium | ONE giant stat on a dark card, indigo + yellow accents |
| `styles/suspense_crime.py` | `noir` | crime, suspense, truecrime | cinema letterbox + evidence board + CLASSIFIED stamp |
| `styles/stickman_hybrid.py` | `sticker` | stickman, doodle, whiteboard | hand-drawn character + scribble annotation + sticky note |
| `styles/vox_documentary.py` | `documentary` | vox, paper, explainer | paper cut-out photo + numbered red pins + map route |
| `styles/kinetic_typography.py` | `kinetic` | typography, lyric, motion_type | ONE word fills the frame, swap-colour backgrounds |

Each engine registers:
* **5-6 style-specific layouts** (available by bare name OR as `<style>.<layout>`):
  box → `stat_hero`, `kpi_row`, `compare`, `product_card`, `numbered_list`
  noir → `evidence_board`, `interrogation`, `cctv_grid`, `dossier`, `cold_open`
  sticker → `character_focus`, `duo_dialogue`, `scribble_steps`, `prop_table`, `big_question`
  documentary → `cutout_pin`, `map_pin`, `timeline_paper`, `annotated`, `split_fact`
  kinetic → `mega_word`, `word_stack`, `split_type`, `manifesto`, `marquee`
* **4-5 scene recipes** (`python studio.py recipes <style>` prints them, paste into EDIT.json)
* **Design notes** (`python studio.py styles` shows the catalogue)

Rules each engine enforces (see each file's docstring for the full list):
* `box`: no polaroids / grain / letterbox / red stamps; one accent per card; big numbers
* `noir`: no stickers / neon pills / soft captions; always polaroid photos; stamps SLAM
* `sticker`: no photos / cinematic grading / dark bg; three signature colours; characters act
* `documentary`: paper frames only (no sticker); red + yellow accents; cut-outs tilt
* `kinetic`: no cinematic look; text IS the content; one word per card; colour-swap backgrounds

## Asset planning, lint and generation (v2.3)

**How many images?** `python studio.py plan [--style S] [--pace fast|normal|calm]` decides it from the STYLE, the voiceover
length and the SCRIPT (each style file declares `BEAT_S`, `MIX`, `MENU`):

| style | beat | scene | cut-out | reuse | text (no image) | images for 6 min |
|---|---|---|---|---|---|---|
| noir | 2.5 s | 50% | 30% | 10% | 10% | ~110 |
| documentary (Vox) | 2.5 s | 25% | 45% | 10% | 20% | ~91 |
| sticker | 3.0 s | 0% | 62% | 8% | 30% | ~69 |
| box | 3.0 s | 22% | 26% | 7% | 45% | ~57 |
| kinetic | 2.0 s | 5% | 3% | 0% | 92% | ~36 |

Lines that state a number or date get a text/number beat instead of a picture. Every beat gets a type, a shot size that never
repeats back-to-back, and an archetype from the style menu (portrait, map, document, tool, symbol ...). Output: `PLAN.md`
(the brief) and `PLAN.json`.

**Write SHOTS.json from PLAN.md.** Each image shot carries `line`, `cue` (a word spoken in that line), `archetype`,
and for scenes `size` (wide / medium / close / detail). `camera` and `composition` may be `"auto"` or omitted: the engine
then rotates shot size, lens, angle and text-space layout by position so neighbours never look alike.

**`python studio.py lint`** (runs automatically before `prompts` and `generate`) REFUSES: duplicate names, identical prompts,
two shots describing the same picture (>= 85% wording overlap), a `cue` not spoken in its `line`, far fewer images than the
plan. It WARNS about near-duplicates, too many wide shots (> 40%), too few close-ups (< 25%), same framing back-to-back,
the same archetype 3 times, drift from the style's mix.

**Generation never repeats an image** (`flow_manifest.json`): every prompt is recorded with its hash and Flow job id before it
is sent. A resumed run first collects jobs still open from the earlier run, never regenerates an existing file, generates two
identical prompts once (the second is a copy), and only submits what has no job or a failed/lost job. `--status` shows
done / in flight / failed; `--regen NAME` forces one image again. Prompts are sent one by one, **1.3 s apart**, and Flow
generates them in parallel; the first "unusual activity" stops the run.

## High-Speed Rendering & Anti-Offline Heartbeat Shield (v3.2)

### The Offline Server & Slow Rendering Fix
On mobile Android/Termux environments, multiprocessing (`mp.Pool(workers)`) and 1080p full-rasterization previously caused two critical issues:
1. **Low Memory Killer (LMK) Terminations**: RAM spiking above 1.5 GB caused Android kernel `lmkd` to terminate background server processes (`SIGKILL`), showing "Server Offline" in the UI.
2. **WebSocket Heartbeat Starvation**: CPU-bound frame rendering loops held the Python GIL without yielding, preventing the background server from sending/receiving ping/pong heartbeat packets within timeout limits.

### The Direct Streaming Solution
The updated rendering engine (`core/engine/render.py`) incorporates:
* **Single-Process In-Memory Streaming**: Bypasses multiprocessing overhead and disk chunk files (`_chunks/*.mp4`), streaming directly into a single FFmpeg pipe. Peak RAM remains flat **under 140 MB** across 10,000+ frames.
* **Anti-Offline Micro-Yield**: Releases the Python GIL every 10 frames (`time.sleep(0.001)`) and runs garbage collection every 25 frames, completely preserving WebSocket server responsiveness and preventing "Server Offline" disconnections.
* **High-Speed Rendering Presets**:
  | Flag | Preset | Resolution | Speed | Purpose |
  |---|---|---|---|---|
  | `--fast` | Fast HD | 720p (720x1280 / 1280x720) | ~20–30 fps | **Default on mobile**: sharp HD, 4x faster, battery/thermal safe |
  | `--turbo` | Turbo | 540p (540x960 / 960x540) | ~40–55 fps | 10x faster than 1080p; real-time previewing of long videos |
  | `--draft` | Draft | 540p (ultrafast, crf 28) | ~50+ fps | Instant review of shot pacing and typography |
  | `--1080p` | Quality | 1080p (1080x1920) | ~10–14 fps | Desktop full-res broadcast master export |

Usage:
```bash
python studio.py render --fast      # Recommended mobile export (crisp 720p HD, < 140MB RAM)
python studio.py render --turbo     # 10x faster export for rapid iterative review
python studio.py render --1080p     # Full 1080p export
```

Built from reference frames: halftone B&W cut-outs with ONE spot colour (auto-levelled so any photo prints), torn-paper
prints with a fibre rim, giant numerals / colour blocks / circles BEHIND cut-outs (`bigtext`, `block`, slots named `back*`),
highlighter-strip titles with a serif sub-line (`title` + `box:"strip"` + `sub`), thin paper notes (`note`), hand-drawn dashed
arrows and pen loops (`arrow`, `loops`), UI badges (`badge`), ransom-note letters (`ransom`), textured bar charts (`chart`),
gilt picture frames, and real surfaces (`bg`: paper, grid, crumple/white, kraft, mat, chalk). Captions in these styles are a
solid mustard plate. Sticker = flat illustrations with PLAIN labels beneath (`label_style: plain`), warm vignetted paper, retro
white-border stickers (`frame:"retro"`), colour-block titles (`box:"block"`) and a desk flat-lay. `python studio.py recipes
documentary|sticker` prints ready scene templates. Bundled fonts: Noto Serif Devanagari (variable) and Noto Serif (OFL).

## Speed, portability and the self-test (v2.4)

**Run `python studio.py selftest` on every new machine** (phone or laptop; `--quick` skips the 1080p render, mix and
benchmark). It builds a throw-away project with synthetic voice/images (no network, no Flow, no credits) and checks:
environment (Python, Pillow + **raqm**, numpy, scipy, ffmpeg), layouts, all style engines, plan -> lint -> prompts, the Flow
generator against a FAKE bridge (flag half-way, resume, nothing sent twice, identical-prompt twin copied, a third run sends
nothing), every style and item type, the frame caches (pixel-identical to a full render), key + sheet split, cues, the
Claude Code hook, the audio mix. All 14 pass on the Android/Termux phone it was built on.

**What was made faster**
| change | effect |
|---|---|
| *settled-scene cache*: a scene whose items have finished animating is composed once | box / kinetic styles 2-3x |
| *layered cache*: finished items are cached, only animating items are redrawn (exact: falls back to a full render whenever draw order could change) | paper styles (Vox, sticker) ~1.2-1.3x per frame |
| *identical-frame reuse*: frames whose visible state is unchanged are not re-rendered, just re-sent to the encoder | static stretches cost ~0 |
| camera moves update at 12 fps and the warped frame is reused (the move is < 0.5 px/frame; `DEEPESH_CAM_FPS` to change) | camera scenes ~1.2x |
| voice synthesis runs 2 requests in parallel (`--jobs`) with back-off | ~2x faster |
| renders use all cores (chunks, workers picked from free RAM; `--workers N`) | unchanged |
`DEEPESH_NOCACHE=1` disables every cache (the self-test uses it to prove the caches are pixel-exact).

**Camera-heavy styles (noir, cinematic) are bound by one operation: a 1080p resize per camera frame (~27 ms on a phone).**
`pip install opencv-python-headless` makes it ~5x faster; the engine uses OpenCV automatically when present (usually not
installable on Termux, normally easy on a laptop). Otherwise use `camera: "still"` or `drift` for long scenes.

**Laptop setup:** Python 3.9+, `pip install pillow numpy scipy soundfile`, ffmpeg on PATH. Hindi needs Pillow built with
RAQM (pip wheels include it on Linux/macOS/Windows; Linux may need `apt install libraqm0`). The selftest checks this first and
says exactly what is missing. Windows: no symlink rights needed (`studio.py new` copies instead), multiprocessing uses
`spawn`, the Flow lock uses `msvcrt`, and `python hooks/install_guard.py` installs the Claude Code hook with this Python's path.
Only Linux/Android were run in testing: the Windows and macOS branches are written to the standard APIs but untested.
