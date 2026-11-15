# 🎨 STICKMAN MASTER EDITORIAL & TYPOGRAPHY BIBLE
## Autonomous Directorial Rules for High-Retention Stickman Explainer Shorts (Stick Story)
### Reverse-Engineered from Production Standards (Typography, Fonts, Text Backgrounds & Viral Pacing)

---

## 🏛️ 1. THE 4 INVIOLABLE LAWS OF STICKMAN TYPOGRAPHY

### 🚫 Law 1.1: The Anti-Book Typography Mandate (Zero Paragraphs on Screen)
- **STRICTLY ZERO MULTI-LINE READING BLOCKS**: Never render body paragraphs, long sentences, or book-like text cards. Viewers swipe away in 0.5s if they feel forced to read a textbook.
- **Spoken Voiceover Narrates; Visuals & Labels Explain**: The voiceover delivers 100% of the narrative prose. On-screen text is strictly reserved for:
  1. **Anchor Labelling**: Short, punchy 1–2 word tags directly under props or characters (`label("Water Filter", x, y)`).
  2. **Keyword Highlighting**: Single-word or 1–3 word shock pills (`keywordPill("DON'T DRINK!", x, y, "danger")`).
  3. **Comic Punchlines & Reactions**: Short 1–4 word speech/thought bubbles (`speechBubble("3 DAYS?!", x, y, tx, ty)`).
  4. **Tactical Milestones**: Gold numbered step cards (`stepCard(1, "STORE WATER", x, y)`).

### ⚖️ Law 1.2: The Rule of One Dominant Idea (Max 2 Text Elements per Scene)
- **Zero Frame Overcrowding**: Never pile a subtitle + kicker + title card + keyword badge + asset label + step card simultaneously.
- **The Maximum 2 Rule**: At any single video frame, there can be at most:
  - **Element A**: The Subtitle Bar at the bottom (`y: 1690`).
  - **Element B**: ONE contextual text widget (either a Step Card at the top OR a Speech Bubble near the stickman OR a Label tag under a prop).
- Give the viewer's eyes breathing room. Pacing contrast is king: alternate high-density fast cuts (1.0–1.6s) with visual holds (2.0–3.0s).

### 🛡️ Law 1.3: The Universal Text Background Mandate
- **NEVER FLOAT NAKED TEXT**: Text rendered directly over illustrated rooms, furniture lines, couch textures, or wallpaper creates visual clutter and illegibility.
- **Every Text Element Must Have a Dedicated Container**:
  - Subtitles $\to$ Rounded dark plate (`rgba(28,28,34,0.88)`).
  - Asset Labels $\to$ Translucent dark pill (`rgba(20,20,26,0.85)`).
  - Keyword Pills $\to$ Saturated colored pill (`red`, `green`, `gold`, `navy`).
  - Comic Dialogue $\to$ Crisp white bubble with 3px black ink border and pointer tail.
  - Step Cards $\to$ Beveled gold card with dark navy number circle.

### 📱 Law 1.4: Mobile 9:16 Vertical Safe Zones (1080x1920)
- **Top 160px Margin**: Safe from TikTok/Reels search bar, notch, and status icons. Keep titles and step cards between `y: 200` and `y: 450`.
- **Bottom 260px Margin**: Safe from TikTok/Reels account handle, caption text, and music marquee. The subtitle pill anchors at `y: 1690`.
- **Horizontal 60px Edge Margin**: Action and text remain centered between `x: 100` and `x: 980`.

---

## 🔤 2. FONT FAMILY HIERARCHY: WHICH FONT TO USE & WHY

The Stickman Video Editing Studio bundles a complete multi-font typography suite. Never use default fallback system fonts.

| Font Family | Weight & Style | Best Used For | Psychological / Aesthetic Role |
|---|---|---|---|
| **Baloo 2** | `ExtraBold` (800) / `Bold` (700) | **Core Stickman Comic Font**: Step titles, speech bubbles, reaction punchlines, keyword pills | Friendly, rounded, punchy, high-energy comic warmth. The signature stickman typeface. |
| **Montserrat** / **Inter** | `Bold` (700) / `Black` (900) | **Subtitles & Spoken Captions**: Word-synced subtitle chunks, gold highlighted active words | Ultra-clean, geometric legibility on small mobile phone screens. |
| **Kalam** | `Bold` (700) | **Handwritten Markers & Notes**: Informal thought bubbles, sticky notes, doodle arrows, sketch tags | Organic, authentic human hand-marker ink feel. |
| **Anton** / **Metropolis** | `Regular` (400) / `Bold` (700) | **Massive Impact Shock Reveals**: Golden Hook titles, emergency sirens, high-stakes warnings | Condensed, heavy, dramatic vertical impact for viral hooks. |
| **Space Mono** | `Bold` (700) | **Timers & Numerical Counters**: Survival countdowns (`72:00:00`), step statistics, coordinates | Technical typewriter precision. |
| **Khand** | `Bold` (700) | **Hindi & Multilingual Bold Statements**: High-impact Hindi headings, devanagari labels | Dense, condensed, razor-sharp devanagari readability. |

---

## 📦 3. TEXT BACKGROUNDS & WIDGET RECIPES (CODE-READY)

### 3.1 Subtitle Bar (`captionBar`)
- **Position**: `x: 540`, `y: 1690`, width dynamic up to `920px`.
- **Background**: `rgba(28, 28, 34, 0.88)` dark slate pill with `border-radius: 30px`.
- **Text**: `800 92px "Baloo 2", Inter`, 2–4 words per chunk.
- **Highlight**: Active spoken word pops in vibrant gold (`#F5A623`) or alarm red (`#E63946`).
- **Code**:
  ```javascript
  captionBar(words, 540, 1690, popScale);
  ```

### 3.2 Asset Label (`label`)
- **Position**: Centered 20–30px directly below the hero prop or stick figure.
- **Background**: Translucent dark pill `rgba(20, 20, 26, 0.85)` with `border-radius: 18px`.
- **Text**: `700 40px "Baloo 2", Inter`, uppercase or title case.
- **Code**:
  ```javascript
  label("WATER FILTER", 540, 880);
  label("BREAKER BOX", 280, 720, { bg: 'rgba(214, 60, 40, 0.85)' });
  ```

### 3.3 Keyword Pills (`keywordPill`)
- **Styles**:
  - `danger`: Crimson Red (`#E63946`) background, white text (`#FFFFFF`).
  - `safe`: Emerald Green (`#2A9D8F`) background, white text (`#FFFFFF`).
  - `gold`: Rich Gold (`#FFB703`) background, dark navy text (`#101828`).
  - `dark`: Navy Slate (`#1D3557`) background, white text (`#FFFFFF`).
- **Code**:
  ```javascript
  keywordPill("DON'T DRINK!", 540, 320, 'danger', popScale);
  keywordPill("BOIL 1 MINUTE", 540, 320, 'safe', popScale);
  ```

### 3.4 Comic Speech & Thought Bubbles (`speechBubble`, `thought`)
- **Speech Bubble**: Crisp white bubble with 4px solid black ink border, rounded corners, and a sharp pointer tail directed to `(tx, ty)` (stickman's mouth).
  ```javascript
  speechBubble("3 DAYS?!", 380, 680, 540, 780, popScale);
  ```
- **Thought Bubble**: 3 floating circles trailing from stickman's head to a cloud bubble containing an icon or short phrase.
  ```javascript
  thought(540, 520, scale, (x, y) => { bottle(x, y, 0.8); }, 540, 780);
  ```

### 3.5 Gold Numbered Step Card (`stepCard`)
- **Position**: `x: 540`, `y: 300`, scale animated spring entrance `0.88 -> 1.0`.
- **Background**: Gold gradient (`#F5A623`) rectangular plate with rounded corners (`34px`) and soft contact shadow.
- **Left Badge**: Dark circular medallion with bold gold numeral (`[1]`, `[2]`, `[3]`).
- **Right Label**: Bold navy title (`"STORE 1 GALLON/DAY"`).
  ```javascript
  stepCard(1, "STORE WATER", 540, 300, popScale);
  ```

### 3.6 Hand-Drawn Marker Sweep & Doodle Circle
- **Marker Sweep**: Chisel-tip yellow highlighter sweep (`rgba(255, 225, 0, 0.55)`) behind important words.
  ```javascript
  markerSweep("72 HOURS", 540, 320, popScale);
  ```
- **Doodle Circle**: Organic wobbly red circle drawing around a clue or date.
  ```javascript
  doodleCircle(540, 750, 110, 60, '#E63946');
  ```

---

## 🎬 4. THE 3-ACT VIRAL RETENTION ARC FOR STICKMAN SHORTS

To achieve >95% completion rates on YouTube Shorts, Instagram Reels, and TikTok, every stickman short must follow this 3-Act structure:

```
00:00                ~20%                            ~75%                100%
  ┌────────────────────┬───────────────────────────────┬───────────────────┐
  │ Act 1: Golden Hook │  Act 2: Tactical Escalation   │   Act 3: Twist    │
  │ • Shock question   │ • Step 1, Step 2, Step 3      │ • Fatal mistake   │
  │ • Stickman panic   │ • Signature Hero Beat (~65%)  │ • Green safe fix  │
  │ • Fast cut (1.2s)  │ • Comic reaction bubbles      │ • Infinite loop   │
  └────────────────────┴───────────────────────────────┴───────────────────┘
```

### Act 1: The Golden Hook (00:00 – ~20% of runtime)
- **Immediate Dilemma**: Open with an urgent, visceral question (*"What would you do if the power grid collapsed for 3 days?"*).
- **Physical Reaction**: Stickman reacts instantly with shock eyes (`mood: 'scared'`), arms flailing, dropping his phone.
- **Hook Headline**: Bold shock title or high-contrast warning pill.

### Act 2: Tactical Escalation & Hero Beat (20% – ~75% of runtime)
- **Numbered Steps**: Break down survival rules or psychological mechanisms into distinct steps (`stepCard(1)`, `stepCard(2)`).
- **Signature Hero Beat (~65% runtime)**: The dramatic climax of the breakdown (e.g. citywide blackout with red alarm cinema bars, stickman turning on a flashlight in complete darkness).
- **Comic Breathers**: Punctuate technical steps with stickman humor (e.g. stickman trying to charge his phone with a lemon and getting shocked).

### Act 3: The Danger Twist & Infinite Loop Payoff (75% – 100% of runtime)
- **The Dangerous Myth / Fatal Mistake**: Show what NOT to do, accompanied by a big red `cross` and alarm sound (*"Whatever you do, NEVER burn charcoal indoors!"*).
- **The Golden Safe Rule**: Show the smart solution with a green `check` and triumphant stickman smile (`mood: 'happy'`).
- **The Infinite Loop Outro**: The final spoken sentence seamlessly leads back into the opening hook question so the short replays endlessly on social algorithms.

---

## 🏃 5. CHARACTER ACTING & PSYCHOLOGICAL ANTICIPATION

### The "Acting Eyes First" Rule
In high-retention 2D animation (Casually Explained / Alan Becker standard), movement is never robotic:
1. **Anticipation (Frames 0 to 4)**: The stickman's white eyes shift direction (`look: [x, y]`) and change mood (`worried -> scared`) **0.08–0.12s BEFORE the body or limbs move**.
2. **Body Action (Frames 5 to 12)**: The arms, head lean, and legs follow the direction the eyes signaled.
3. **Settle (Frames 13 to 18)**: Gentle spring overshoot settle.

### Mood Expression Chart
- `calm`: Centered relaxed pupils, flat brows.
- `happy`: High crescent pupils, raised arched brows, broad smile.
- `worried`: Slightly furrowed angled brows, dilated pupils glancing sideways.
- `scared`: Wide shock pupils with white clearance, trembling high brows, open mouth.
- `determined`: Sharp downward-slanted V-brows, forward-focused squint.
- `sleepy`: Heavy eyelids, lower-half pupils, tilted head.

### Night Staging & Warm Silhouette Glow
- When the scene switches to night (blackouts, nighttime dilemmas), black stick figures will vanish into dark backgrounds without proper lighting.
- **Compulsory Rule**: Always set `glow: true` on stick figures in dark rooms! This renders a soft, warm amber/white silhouette outline (`ctx.shadowBlur = 24`, `ctx.shadowColor = '#FFD54F'`) ensuring the character pops with maximum clarity.

---

## 🔊 6. AUDIO-VISUAL ATTACK SYNCHRONIZATION

- **0.000s Attack**: The entrance of every step card, text pill, and visual cut MUST sync mathematically to the voice consonant ($t = 0$).
- **Foley Audio Counterparts**:
  - `stepCard` entrance $\to$ Crisp punchy `pop.wav` or `snap.wav`.
  - Visual cut $\to$ Subtle paper swoosh `whoosh.wav`.
  - Green `check` $\to$ Pleasant high chime `ding.wav`.
  - Red `cross` $\to$ Low friction buzz or thud `buzzer.wav`.
  - Flashlight switch $\to$ Mechanical analog `click.wav`.
- **Music Ducking**: Background music stays ducked to $-18\text{dB}$ while the voice is active, maintaining pristine vocal clarity.
