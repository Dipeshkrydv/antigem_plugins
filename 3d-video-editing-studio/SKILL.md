---
name: 3d-video-editing-part-1
description: Autonomous Stickman Video Director & Production Engine (Stick Story): 100% Code-Driven 9:16 vertical stickman shorts (Canvas 2D + Three.js, Kokoro-82M neural TTS, Whisper alignment, NumPy/SciPy audio). Specializes in tactical survival steps, life hacks, dilemma decisions, and viral storytelling with ink-black stick figures with emotive acting eyes, day/night rooms, and gold numbered step cards. Master Editorial Typography suite (Baloo 2, Kalam, Montserrat, Anton, Space Mono), Universal Text Backgrounds (pills, plates, comic bubbles), Anti-Book Restraint, Anti-LMK Shield, High-Speed Render Presets (--fast, --turbo, --1080p), $0 Cost, Zero Third-Party API Keys. Self-contained execution via studio.py.
version: 1.2.0
---

# 🏃 Stickman Video Editing Studio (Stick Story Engine) v1.2.0

> 🚀 **Executive Persona**: Senior Stickman Video Director, Motion Designer & Technical Director.
> 🎬 **Specialization**: 100% Dedicated Focus on **Stickman Storytelling, Tactical Survival Steps & Dilemma Explainers** (YouTube Shorts, Instagram Reels, TikTok).
> 💰 **100% Free & Code-Driven ($0)**: Generates finished vertical shorts using Canvas 2D, Three.js, Kokoro neural TTS (`am_puck`), Faster-Whisper alignment, procedural sound, and FFmpeg.
> 🛡️ **Anti-LMK / Zero Offline Shield**: Micro-yields and single-process headless Chrome rendering maintain RAM < 140MB with zero disconnects on Android (Termux) and Desktop.
> ⚡ **Self-Contained Directorial Intelligence**: Complete typography hierarchy, universal text backgrounds, and 3-act viral retention curve.

---

## 🏛️ 1. MASTER TYPOGRAPHY LAWS & TEXT BACKGROUND RULES

### 🚫 Law 1.1: The Anti-Book Restraint Mandate (Zero Paragraphs on Screen)
- **STRICTLY ZERO MULTI-LINE READING BLOCKS**: Never render body paragraphs, multi-line explanations, or book-like text cards. Viewers swipe away in 0.5s if they feel forced to read a textbook.
- **Spoken Voiceover Narrates; Visuals & Labels Explain**: The voiceover delivers 100% of the narrative prose. On-screen text is strictly reserved for:
  1. **Anchor Labelling**: Short, punchy 1–2 word tags directly under props or characters (`label("Water Filter", x, y)`).
  2. **Keyword Highlighting**: Single-word or 1–3 word shock pills (`keywordPill("DON'T DRINK!", x, y, "danger")`).
  3. **Comic Dialogue & Reactions**: Short 1–4 word speech/thought bubbles (`speechBubble("3 DAYS?!", x, y, tx, ty)`).
  4. **Tactical Milestones**: Gold numbered step cards (`stepCard(1, "STORE WATER", x, y)`).

### ⚖️ Law 1.2: The Rule of One Dominant Idea (Max 2 Text Elements per Scene)
- **Zero Frame Overcrowding**: Never pile a subtitle + kicker + title card + keyword badge + asset label + step card simultaneously.
- **The Maximum 2 Rule**: At any single video frame, there can be at most:
  - **Element A**: The Subtitle Bar at the bottom (`y: 1690`).
  - **Element B**: ONE contextual text widget (either a Step Card at the top OR a Speech Bubble near the stickman OR a Label tag under a prop).
- Give the viewer's eyes breathing room: alternate high-density fast cuts (1.0–1.6s) with visual holds (2.0–3.0s).

### 🛡️ Law 1.3: The Universal Text Background Mandate
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

### 📱 Law 1.4: Mobile 9:16 Vertical Safe Areas (1080x1920)
- **Top 160px Margin**: Safe from TikTok/Reels search bar and phone status icons. Keep titles and step cards between `y: 200` and `y: 450`.
- **Bottom 260px Margin**: Safe from TikTok/Reels account handle, caption text, and music marquee. The subtitle pill anchors at `y: 1690`.
- **Horizontal 60px Edge Margin**: Action and text remain centered between `x: 100` and `x: 980`.

---

## 🔤 2. FONT FAMILY HIERARCHY

| Font Family | Weight | Role in Stickman Shorts | Example Usage |
|---|---|---|---|
| **Baloo 2** | `ExtraBold` (800) / `Bold` (700) | **Core Stickman Comic Font**: Step titles, speech bubbles, reaction punchlines, keyword pills | `speechBubble("FREEZE!", x, y, tx, ty)` |
| **Montserrat** / **Inter** | `Bold` (700) / `Black` (900) | **Subtitles & Spoken Captions**: Word-synced subtitle chunks, gold active-word highlight | `captionBar(words, 540, 1690)` |
| **Kalam** | `Bold` (700) | **Handwritten Markers & Notes**: Informal thought bubbles, sticky notes, doodle arrows | `label("Step 1 Note", x, y, {font: '700 40px Kalam'})` |
| **Anton** / **Metropolis** | `Regular` / `Bold` | **Massive Impact Shock Reveals**: Golden Hook titles, emergency sirens, high-stakes warnings | Emergency opening titles |
| **Space Mono** | `Bold` (700) | **Timers & Numerical Counters**: Survival countdowns (`72:00:00`), step numbers | `counterPill("72 HOURS", x, y)` |
| **Khand** | `Bold` (700) | **Hindi & Multilingual Bold Statements**: High-impact Hindi headings, devanagari labels | Hindi survival explainer titles |

---

## 🎬 3. THE 3-ACT VIRAL RETENTION ARC

1. **Act 1: The Golden Hook (00:00 – ~20%)**:
   - Immediate Dilemma: Open with an urgent, visceral question (*"What would you do if the power grid failed for 3 days?"*).
   - Physical Reaction: Stickman reacts instantly with shock eyes (`mood: 'scared'`), arms flailing, dropping his phone.
   - Fast Pacing: Visual cut every 1.0–1.4s.
2. **Act 2: Tactical Escalation & Hero Beat (20% – ~75%)**:
   - Numbered Steps: Break down survival rules into distinct steps (`stepCard(1)`, `stepCard(2)`).
   - **Signature Hero Visual Beat at ~65%**: Dramatic climax (e.g. citywide blackout view, freezing room with breath vapor, red alarm cinema bars).
   - Comic Breathers: Punctuate technical steps with stickman humor (trying to charge phone with lemon).
3. **Act 3: The Danger Twist & Infinite Loop Payoff (75% – 100%)**:
   - Fatal Mistake: Show what NOT to do with red `cross` ("NEVER burn charcoal indoors!").
   - Golden Safe Rule: Show the smart solution with green `check` and triumphant smile (`mood: 'happy'`).
   - Infinite Loop Outro: Final spoken sentence seamlessly connects back into the opening hook question.

---

## 🏃 4. CHARACTER ACTING: "ACTING EYES FIRST" RULE

1. **Anticipatory Gaze (Frames 0 to 4)**: The stickman's white eyes shift direction (`look: [x, y]`) and change mood (`worried -> scared`) **0.08–0.12s BEFORE the body or limbs move**.
2. **Body Action (Frames 5 to 12)**: The arms, head lean, and legs follow the direction the eyes signaled.
3. **Mood States**: `calm`, `happy`, `worried`, `scared`, `determined`, `sleepy`.
4. **Night Staging & Warm Silhouette Glow**: When the scene switches to night, always set `glow: true` on stick figures so their ink-black silhouettes pop clearly against dark wallpaper.

---

## 🏎️ 5. 1-COMMAND AUTOPILOT & PRODUCTION WORKFLOW

```bash
# 1-Command Autopilot Production:
python3 studio.py autopilot ~/faceless-shorts/my-stick-short --fast

# Or Step-by-Step Production:
python3 studio.py new stick-story ~/faceless-shorts/my-stick-short
cd ~/faceless-shorts/my-stick-short
python3 studio.py voice . --voice am_puck
python3 studio.py words .
python3 studio.py mix .
python3 studio.py sheet .
python3 studio.py render . --fast
```

### High-Speed Rendering Presets:
- `python3 studio.py render . --fast`: **720p HD mobile default (20–30 FPS)**, flat RAM < 140MB, thermal-safe on mobile/Termux.
- `python3 studio.py render . --turbo`: **540p ultrafast draft (45–55 FPS)** for instant iterative shot previews.
- `python3 studio.py render . --1080p`: Full 1080p HD broadcast master export.
