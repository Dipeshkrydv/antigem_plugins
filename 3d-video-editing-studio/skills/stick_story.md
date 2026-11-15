---
name: Stick Story Stickman Explainer
description: Tactical survival, life hacks, dilemma decisions, and storytelling shorts featuring expressive stick figures with acting eyes, flat illustrated rooms (day/night), gold numbered step cards, master typography (Baloo 2, Kalam, Montserrat), universal text backgrounds, and word-synced captions.
version: 1.2.0
---

# Stick Story: Stickman Survival & Storytelling Explainer

> 🏃 **Genre**: Tactical survival steps, life hacks, "What would you do if...?", psychological dilemmas, and clever storytelling shorts.
> ⏱️ **Default Timing**: 30–45 seconds · 9:16 vertical shorts (TikTok, Reels, YouTube Shorts).
> 💰 **100% Free & Code-Driven ($0)**: Canvas 2D + WebGL, local Kokoro neural voiceover (`am_puck`), local Whisper word alignment, procedural sound and music.

---

## 🔤 Master Typography & Text Background Rules

### 1. The Anti-Book Typography Mandate
- **Zero Explanatory Paragraphs**: Never render sentences or body text blocks on screen. The voiceover narrates; text is for:
  - 1–2 word asset labels (`label("WATER FILTER", x, y)`).
  - 1–3 word keyword highlight pills (`keywordPill("DON'T DRINK!", x, y, "danger")`).
  - 1–4 word comic dialogue bubbles (`speechBubble("3 DAYS?!", x, y, tx, ty)`).
  - Numbered step cards (`stepCard(1, "STORE WATER", x, y)`).
- **Max 2 Text Elements per Scene**: Subtitle bar at bottom (`y: 1690`) + at most ONE contextual text widget (Step Card at top OR Speech Bubble near stickman OR Label tag under prop).

### 2. Font Selection Hierarchy
- **`Baloo 2` (ExtraBold / Bold)**: The core stickman comic font. Friendly, rounded, punchy. Used for speech bubbles, step titles, reaction punchlines, keyword pills.
- **`Montserrat` / `Inter` (Bold / Black)**: Ultra-clean geometric legibility for word-synced subtitle chunks.
- **`Kalam` (Bold)**: Organic hand-marker feel for sticky notes, sketch tags, doodle arrows.
- **`Anton` / `Metropolis` (Bold)**: Heavy condensed impact reveals for opening hook questions.
- **`Space Mono` (Bold)**: Technical monospaced countdown timers (`72:00:00`) and step statistics.

### 3. Compulsory Text Backgrounds
- **Subtitles (`captionBar`)**: Dark rounded pill (`rgba(28,28,34,0.88)`), border radius `30px`, placed at `y: 1690`. Active spoken word highlighted in Gold `#F5A623`.
- **Asset Labels (`label`)**: Translucent dark pill (`rgba(20,20,26,0.85)`) placed 20–30px directly below hero props or stick figures.
- **Keyword Pills (`keywordPill`)**:
  - Danger: Crimson Red (`#E63946`) background, white text.
  - Safe: Emerald Green (`#2A9D8F`) background, white text.
  - Gold Step: Rich Gold (`#FFB703`) background, dark navy text.
- **Comic Speech Bubbles (`speechBubble`)**: Crisp white bubble with 4px solid black ink border and pointer tail to stickman's mouth.
- **Gold Step Cards (`stepCard`)**: High-impact gold card (`#F5A623`) with dark navy number circle (`[1]`, `[2]`, `[3]`) placed at `y: 300`, `x: 540`.
- **Marker Highlighter Sweep (`markerSweep`)**: Chisel-tip yellow highlighter sweep (`rgba(255, 225, 0, 0.55)`) behind key words.
- **Doodle Circle (`doodleCircle`)**: Wobbly hand-drawn red circle around key clues or numbers.

---

## 🎬 Directorial Rules & Retention Architecture

- **Acting Eyes First**: White circle head, simple ink body. The large white eyes shift direction (`look: [x, y]`) and change mood (`calm`, `happy`, `worried`, `scared`, `determined`, `sleepy`) **0.08–0.12s BEFORE the body moves**.
- **Night Glow**: In dark/night scenes, stick figures must receive `glow: true` (warm amber silhouette outline) so they pop against dark wallpaper.
- **3-Act Arc**:
  - *Act 1 (0–20%)*: Golden Hook question + stickman panic reaction + fast 1.2s cuts.
  - *Act 2 (20–75%)*: Step cards + Hero Beat at ~65% (blackout climax) + comic breather.
  - *Act 3 (75–100%)*: Fatal mistake red `cross` + safe tip green `check` + infinite loop outro.

---

## 🎵 2D Stickman SFX & BGM Audio Engine

- **Music Beds (`script.json` `"music"`)**:
  - `"bed"` / `"acoustic"` / `"revolution"` *(Default)*: Acoustic guitar & rhythm for narrative explainers.
  - `"bounce"` / `"viral"`: Modern 808 viral bounce for high-energy shorts.
  - `"action"` / `"drums"`: Cinematic percussion for emergency dilemmas and countdowns.
  - Sidechain ducking: BGM ducks by **$-18\text{ dB}$ to $-24\text{ dB}$** during speech.
  - Master target: **$-14\text{ LUFS}$ integrated** with a **$-1.5\text{ dBTP}$ ceiling**.
- **Tactile Foley SFX Cues (`shots.js` `cue(t, 'type')`)**:
  - `cue(t, 'pop')` / `'step'` / `'card'`: Step card entrance (`b3_paper_popup_a.mp3`, `-14 dB`)
  - `cue(t, 'whoosh')` / `'cut'`: Scene cut / whip pan (`b2_sweep_down_a.mp3`, `-17 dB`)
  - `cue(t, 'ding')` / `'chime'` / `'check'`: Green checkmark / safe rule (`b2_typewriter_bell_a.mp3`, `-14 dB`)
  - `cue(t, 'buzzer')` / `'cross'` / `'danger'`: Red cross / fatal mistake (`b2_sub_drop_a.mp3`, `-15 dB`)
  - `cue(t, 'click')` / `'switch'`: Flashlight toggle / wall plug (`b4_thumbtack_drop_a.mp3`, `-15 dB`)
  - `cue(t, 'marker')` / `'circle'`: Doodle circle / highlight (`b4_marker_circle_a.mp3`, `-14 dB`)
  - `cue(t, 'counter')` / `'timer'`: Countdown timer / odometer (`b5_odometer_roll_a.mp3`, `-16 dB`)
  - `cue(t, 'shimmer')` / `'sparkle'`: Eye dart / smirking punchline (`b4_shimmer_g.mp3`, `-16 dB`)

---

## Direct CLI Production
```bash
python3 studio.py new stick-story ~/faceless-shorts/my-stick-short
cd ~/faceless-shorts/my-stick-short
python3 studio.py voice . --voice am_puck
python3 studio.py words .
python3 studio.py mix .
python3 studio.py sheet .
python3 studio.py render . --fast
```
