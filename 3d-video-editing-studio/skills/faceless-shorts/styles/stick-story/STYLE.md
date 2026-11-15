# Stick Story: "What would you do if…?" survival steps, 9:16

Tense, clever, a little funny. Black stick people whose big white eyes do the acting, flat illustrated rooms in day and
night versions, gold numbered step cards, one picture per clause.
Example: `example/` = **WHAT IF THE POWER WENT OUT FOR 3 DAYS?** (34 s, 12 shots). Sheet: `style-sheet.png`.

## 1. Rules
- People are always ink black; colour lives in the room. At night, people get a soft warm glow (`glow: true`) so they
  read against dark walls.
- **Gold = steps.** Every step gets a gold numbered card (`K.stepCard(n, 'LABEL', 540, 300, scale)`) popping in on
  "Step one". Red = danger (cross, warnings), green = safe (check).
- One picture per clause: cut every 1.5-3 s; the eyes react first (look, then mood), then the body.
- The same rooms all video; night versions for the problem, daylight for the happy ending.
- Captions: sentence case on a dark rounded bar, 2-4 words, one gold word, y 1690 (they auto-shrink to fit).
- Audio Engine (2D Stickman Standard):
  - Music: `"bed"` / `"acoustic"` (warm acoustic guitar), `"bounce"` / `"viral"` (808 viral beat), `"action"` / `"drums"` (adrenaline percussion). Ducks smoothly by $-18\text{ dB}$ under vocal consonants. Master mixed to $-14\text{ LUFS}$ with $-1.5\text{ dBTP}$ ceiling.
  - SFX Foley: `pop` on step cards/badges, `whoosh` on scene cuts, `ding` on green safe checkmarks, `buzzer`/`sub_drop` on red fatal crosses, `click` on flashlights/switches, `marker` on doodle circle highlights, `counter` on timer reels, `shimmer` on comedic eye darts.
- Safety advice is checked against official sources (Red Cross, Ready.gov, CDC) and listed in `script.json`.

## 2. Kit (`example/src/core/kit.js`, `import * as K`)
- `K.person({ x, y: K.GROUND, h (≈840), dir, walk, arms: { L: [shoulder, elbow], R }, legs, look: [x, y], mood:
  'calm'│'happy'│'worried'│'scared'│'determined'│'sleepy', lean, hold: (x, y) => drawProp, blink, cap, glow })`
- `K.bigHead(x, y, r, { mood, look })` close-ups.
- Rooms: `K.livingRoom({ night, lampOn })`, `K.kitchen({ night })`, `K.hallway({ night, a, b, openA, openB })`;
  pieces: `windowPane, couch, lamp, frameArt, plant, door, fridge, counter`.
- Props: `phone(x, y, s, msg)`, `bottle`, `can`, `flashlight(x, y, s, on, angle)`, `backpack`.
- Graphics: `stepCard`, `check`, `cross`, `counterPill(text, x, y, s)`, `thought(x, y, s, inner, tailX, tailY)`,
  `cinemaBars(a)` (only on the scary beat), `captionBar`.
- New set pieces go in `shots.js` (see `tv`, `plug`, `candle`, `bolt` in the example) or the kit if reusable.

## 3. QA pitfalls we've hit
- Black figures vanish on night walls → `glow: true` in every night shot.
- Figures too small in the room → h ≈ 840 for full-body shots.
- Long captions running off screen → keep chunks short; the bar auto-shrinks but small text is hard to read.
