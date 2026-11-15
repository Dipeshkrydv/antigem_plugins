---
name: stick-story
description: Make narrated stick figure and survival/life-hack YouTube Shorts / TikToks / Reels fully in code on the user's computer, with a free local AI voice and word-synced captions, $0. Stick Story (stick-figure "what would you do if" survival steps, dilemmas, and life hacks with acting eyes, day/night rooms, and gold step cards). Use whenever someone wants a stick-figure story, survival short, dilemma video, or life-hack explainer.
version: 1.2.0
---

# Stick Story — Autonomous Stickman Video Director

You make a finished vertical short from a topic: script, voice, word-synced captions, animated stick figure shots, sound and
music, rendered to MP4. **Everything is code**: canvas drawing, headless Chrome capture, ffmpeg, a local Kokoro voice,
local Whisper word timing, numpy sound. No AI images or video, no API keys, no credits.
`SKILL` = the folder this file is in. Projects live in `~/faceless-shorts/<short-name>/`.

| style | what it makes | length · aspect |
|---|---|---|
| **Stick Story** `stick-story` | "What would you do if…?" tactical survival & life hacks: ink-black stick people with acting eyes, flat rooms day/night, gold step cards | 30-45 s · 9:16 |

Style = `styles/stick-story/style-sheet.png` + `styles/stick-story/STYLE.md` + `styles/stick-story/example/` (a complete project that renders as-is).

## 0. Mandatory Pre-Flight Auto-Installation
**Before starting to use this skill, EVERYTHING needed must be verified and installed.**
Run:
`bash SKILL/scripts/doctor.sh` (or `bash SKILL/scripts/setup.sh`).
It automatically checks and non-interactively installs all required tools:
1. System Binaries: Node.js 20+, ffmpeg, Chromium / Google Chrome.
2. Private Python 3.10+ virtualenv (`~/.faceless-shorts/venv`) with `numpy`, `scipy`, `kokoro-onnx`, `faster-whisper`, `soundfile`.
3. Neural Kokoro TTS model weights (~340 MB) in `~/.faceless-shorts/kokoro/`.
4. Faster-Whisper `small.en` model cached locally.

## 1. Directorial Rules for Stick Story
- **People are always ink black**: Color lives in the environment. At night, people get a soft warm glow (`glow: true`) so they read against dark walls.
- **Gold = Steps**: Every step gets a gold numbered card (`K.stepCard(n, 'LABEL', 540, 300, scale)`) popping in on "Step one". Red = danger (cross, warnings), green = safe (check).
- **One picture per clause**: Cut every 1.5-3s; the eyes react first (look, then mood: calm, happy, worried, scared, determined, sleepy), then the body.
- **The same rooms all video**: Night versions for the problem, daylight for the solution/happy ending.
- **Captions**: Sentence case on a dark rounded bar, 2-4 words, one gold word, y 1690.
- **Audio Engine (2D Stickman Standard)**:
  - Music: `"bed"` / `"acoustic"` (warm acoustic guitar), `"bounce"` / `"viral"` (808 viral beat), `"action"` / `"drums"` (adrenaline percussion). Ducks smoothly by $-18\text{ dB}$ under vocal consonants. Output normalized to $-14\text{ LUFS}$ with $-1.5\text{ dBTP}$ ceiling.
  - SFX Foley: `pop` on step cards/badges, `whoosh` on scene cuts, `ding` on green safe checkmarks, `buzzer`/`sub_drop` on red fatal crosses, `click` on flashlights/switches, `marker` on doodle circle highlights, `counter` on timer reels, `shimmer` on comedic eye darts.

## 2. Quickstart Workflow
```bash
# 1. Scaffold a project from the stick-story example:
python3 studio.py new stick-story ~/faceless-shorts/my-stick-short
cd ~/faceless-shorts/my-stick-short

# 2. Synthesize voice and align words:
python3 studio.py voice . --voice am_puck
python3 studio.py words .

# 3. Sound mix:
python3 studio.py mix .

# 4. Contact sheet QA:
python3 studio.py sheet .

# 5. Render video:
python3 studio.py render . --fast
```
