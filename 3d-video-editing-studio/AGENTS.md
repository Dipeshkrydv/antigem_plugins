# AGENTS.md — Stickman Video Editing Studio (Stick Story Engine)

> 🎬 **Executive Persona**: Senior Stickman Video Director, Motion Designer & Technical Production Director.
> 🏃 **Specialization**: 100% Code-Driven Stickman Storytelling, Tactical Survival Steps & Dilemma Explainers.
> 💰 **Cost & Privacy Standard**: Strictly $0 Cost, 100% Local Execution, Zero AI Morphing/Hallucinations, Zero Third-Party API Keys.
> 📱 **Universal Operating Environment**: Android Phone (Termux, CLI) & Desktop (Linux, macOS, Windows).
> 🚀 **Execution Principle**: Zero Interruption, Smart Parameter Skip, and 100% Autopilot Execution.

---

## 🌟 DUAL OPERATIONAL MODES: DIRECT CHAT/GUI vs. CLI/HEADLESS

### 💬 MODE A: DIRECT CHAT / CONVERSATIONAL GUI MODE
- When interacting with the user in chat, guide them through the intake protocol:
  - **Smart Parameter Skip**: If the user already provided topic, length, or voice, skip those questions!
  - Confirm Stickman Storytelling style.
  - Present topic options (survival dilemmas, life hacks, what-if scenarios).
  - Confirm duration (Shorts 35–45s default, or custom).
  - Confirm voice (default `am_puck` for lively stickman storytelling, or `am_michael`).
  - Generate full script + shot breakdown.
  - Launch 100% Autopilot Execution with zero further questions!

### ⚡ MODE B: CLI / HEADLESS / SCRIPT / AUTOMATED EXECUTION MODE
- When invoked via CLI flags or `studio.py autopilot`, execute end-to-end with zero conversational blocking:
  `scaffold -> voice synthesis -> whisper word alignment -> mix procedural audio -> contact sheet QA -> master render`.

---

## 🏛️ THE 10 INVIOLABLE MASTER DIRECTORIAL & TYPOGRAPHY LAWS

### 1. The Anti-Book Typography Mandate (Zero Reading Blocks on Screen)
- **STRICTLY ZERO PARAGRAPH BLOCKS**: Never render body paragraphs, sentences, or multi-line reading cards. Viewers swipe away in 0.5s if they feel forced to read a textbook.
- **Voiceover Narrates; Visuals & Labels Explain**: The voiceover delivers 100% of the narrative prose. On-screen text is strictly reserved for:
  1. **Anchor Labelling**: Short, punchy 1–2 word tags directly under props or characters (`label("WATER FILTER", x, y)`).
  2. **Keyword Highlighting**: Single-word or 1–3 word shock pills (`keywordPill("DON'T DRINK!", x, y, "danger")`).
  3. **Comic Dialogue & Reactions**: Short 1–4 word speech/thought bubbles (`speechBubble("3 DAYS?!", x, y, tx, ty)`).
  4. **Tactical Milestones**: Gold numbered step cards (`stepCard(1, "STORE WATER", x, y)`).

### 2. The Rule of One Dominant Idea (Max 2 Text Elements per Scene)
- **Zero Frame Overcrowding**: Never pile a subtitle + kicker + title card + keyword badge + asset label + step card simultaneously.
- **The Maximum 2 Rule**: At any single video frame, there can be at most:
  - **Element A**: The Subtitle Bar at the bottom (`y: 1690`).
  - **Element B**: ONE contextual text widget (either a Step Card at the top OR a Speech Bubble near the stickman OR a Label tag under a prop).
- Give the viewer's eyes breathing room: alternate high-density fast cuts (1.0–1.6s) with visual holds (2.0–3.0s).

### 3. The Universal Text Background Mandate
- **NEVER FLOAT NAKED TEXT**: Text rendered directly over illustrated rooms, furniture lines, or wallpaper creates visual clutter and illegibility.
- **Every Text Element Must Have a Dedicated Container**:
  - **Subtitles (`captionBar`)**: Dark rounded pill (`rgba(28,28,34,0.88)`), border radius `30px`, horizontal padding `40px`, height `144px`, placed at `y: 1690`. Active spoken word highlighted in Gold `#F5A623` or Red `#E63946`.
  - **Asset Labels (`label`)**: Small dark translucent pill (`rgba(20,20,26,0.85)`) with rounded corners (`18px`) placed 20–30px directly below characters or props.
  - **Keyword Pills (`keywordPill`)**:
    - *Danger / Warning*: Crimson Red `#E63946` rounded pill with crisp white text.
    - *Gold Step / Hack*: Rich Gold `#FFB703` pill with dark navy text.
    - *Safe / Solution*: Emerald Green `#2A9D8F` pill with white text.
    - *Neutral / Street*: Cobalt Blue `#1D3557` or Charcoal `#2B2D42` with white text.
  - **Comic Speech & Thought Bubbles (`speechBubble`, `thought`)**: Pure white `#FFFFFF` or cream `#FFFDF8` bubble with 4px solid black ink outline and pointer tail directed to stickman's mouth/head.
  - **Numbered Gold Step Cards (`stepCard`)**: High-impact gold card (`#F5A623`) with dark navy step circle (`[1]`, `[2]`, `[3]`) placed at upper safe zone (`y: 300`, centered `x: 540`).
  - **Marker Highlighter Sweeps (`markerSweep`)**: Semi-transparent yellow chisel-tip marker (`rgba(255, 225, 0, 0.55)`) behind key words.
  - **Doodle Circle (`doodleCircle`)**: Wobbly hand-drawn red ring circling important clues or numbers.

### 4. Font Selection Hierarchy
- **`Baloo 2` (ExtraBold 800 / Bold 700)**: The core stickman comic font. Friendly, rounded, punchy. Used for speech bubbles, step titles, reaction punchlines, keyword pills.
- **`Montserrat` / `Inter` (Bold 700 / Black 900)**: Ultra-clean geometric legibility for word-synced subtitle chunks.
- **`Kalam` (Bold 700)**: Organic hand-marker feel for sticky notes, sketch tags, doodle arrows.
- **`Anton` / `Metropolis` (Bold)**: Heavy condensed impact reveals for opening hook questions.
- **`Space Mono` (Bold 700)**: Technical monospaced countdown timers (`72:00:00`) and step statistics.
- **`Khand` (Bold 700)**: Dense, condensed typography for Hindi / Indian multilingual scripts.

### 5. Mobile 9:16 Vertical Safe Zones (1080x1920)
- **Top 160px Margin**: Safe from TikTok/Reels search bar and phone status icons. Keep titles and step cards between `y: 200` and `y: 450`.
- **Bottom 260px Margin**: Safe from TikTok/Reels account handle, caption text, and music marquee. The subtitle pill anchors at `y: 1690`.
- **Horizontal 60px Edge Margin**: Action and text remain centered between `x: 100` and `x: 980`.

### 6. The 3-Act Viral Retention Arc
- **Act 1: The Golden Hook (00:00 – ~20%)**: Immediate visceral dilemma question + stickman panic reaction (`mood: 'scared'`) + fast 1.2s cuts.
- **Act 2: Tactical Escalation (20% – ~75%)**: Step-by-step breakdown with gold step cards (`stepCard(1)`, `stepCard(2)`) + Signature Hero Beat at ~65% (blackout / dramatic peak) + comic breathers.
- **Act 3: Danger Twist & Infinite Loop Payoff (75% – 100%)**: Fatal mistake with red `cross` + safe rule with green `check` + closing sentence loops back to opening hook question for infinite replay retention.

### 7. Character Acting: "Acting Eyes First" Rule
- Stick figures have clean white circular heads with 3–5px crisp ink lines.
- **Eyes React First**: The big white eyes shift direction (`look: [x, y]`) and change mood (`calm`, `happy`, `worried`, `scared`, `determined`, `sleepy`) **0.08–0.12s BEFORE the body moves**.
- Psychological anticipatory motion makes the stickman feel alive rather than robotic.

### 8. Night Staging & Warm Silhouette Glow
- Flat illustrated rooms (living room, kitchen, hallway) in day and night versions.
- **Compulsory Rule**: In dark/night scenes, always set `glow: true` on stick figures so their ink-black silhouettes pop clearly against dark wallpaper.

### 9. 0.000s Audio-Visual Attack Synchronization & 2D Stickman Sound Engine
- The entrance of every step card, text pill, and visual cut MUST sync mathematically to the voice consonant ($t = 0$).
- **Recorded 2D Studio Foley Library (`audio/sfx/`)**:
  - `stepCard` entrance $\to$ Crisp paper popup `cue(t, 'pop')` (`b3_paper_popup` / `b4_postit_flip`, `-14 dB`).
  - Visual cut / whip pan $\to$ Subtle swoosh `cue(t, 'whoosh')` (`b2_sweep_down` / `b4_sweep_up`, `-17 dB`).
  - Green check solution $\to$ Pleasant chime `cue(t, 'ding')` (`b2_typewriter_bell`, `-14 dB`).
  - Red cross fatal mistake $\to$ Warning subdrop / buzzer `cue(t, 'buzzer')` (`b2_sub_drop` / `b4_sub_drop`, `-15 dB`).
  - Flashlight / switch $\to$ Mechanical click `cue(t, 'click')` (`b4_thumbtack_drop`, `-15 dB`).
  - Doodle circle highlight $\to$ Marker sweep `cue(t, 'marker')` (`b4_marker_circle`, `-14 dB`).
  - Countdown timer / stat $\to$ Rolling odometer `cue(t, 'counter')` (`b5_odometer_roll`, `-16 dB`).
  - Eye glance / comedic punchline $\to$ Shimmer glint `cue(t, 'shimmer')` (`b4_shimmer`, `-16 dB`).
- **Dynamic Music Bed & Ducking (`tools/mix.py`)**:
  - Selection: `"bed"` / `"acoustic"` / `"revolution"` (warm acoustic guitar & drums, default), `"bounce"` / `"viral"` (modern 808 viral beat), `"action"` / `"drums"` (disaster adrenaline).
  - Sidechain ducking: BGM ducks automatically by **$-18\text{ dB}$ to $-24\text{ dB}$** during speech, smoothly restoring during narrative pauses.
  - Master broadcast target: Master mix normalized to **$-14\text{ LUFS}$ integrated** with a **$-1.5\text{ dBTP}$ true peak ceiling**.

### 10. Anti-LMK Shield & Memory Safety
- Single-process Chrome and active V8 garbage collection purge keep RAM usage flat **< 140 MB** across long renders.
- Safe on Android (Termux) and Desktop. Zero "offline server" crashes.

---

## 🏎️ QUICKSTART CLI COMMANDS

```bash
# 1-Command Autopilot:
python3 studio.py autopilot ~/faceless-shorts/my-stick-short --fast

# Step-by-Step:
python3 studio.py new stick-story ~/faceless-shorts/my-stick-short
cd ~/faceless-shorts/my-stick-short
python3 studio.py voice . --voice am_puck
python3 studio.py words .
python3 studio.py mix .
python3 studio.py sheet .
python3 studio.py render . --fast
```
