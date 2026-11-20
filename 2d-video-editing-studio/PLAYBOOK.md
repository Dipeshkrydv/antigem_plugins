# Vox-style documentary playbook (any topic)

How to make a 1-3 minute Vox-style explainer that **people actually understand**:
narration on top, and on screen at every moment **exactly the thing being said**,
built from cut-out PNG art, code-drawn data graphics, maps with pins, and a label
on everything. This playbook is the method that produced a clear, well-received
Hindi explainer ("एक देश, एक घड़ी": why India has one time zone). The same method
works for any topic, in any language.

Read the whole file before starting. The rules in **Part 1** decide whether the
video makes sense. Everything else is mechanics.

---

## Part 1: the rules that make it understandable

These came from failures. The first two versions of the same film looked fine
shot by shot, and viewers said "kuch samajh nahi aa raha" (I can't follow it).
These rules fixed that.

1. **Plan scenes from the narration, never from a shot list.** Write the
   script, record the voice, time every word, and only then decide what is on
   screen. Ask of every line: *what must the viewer see to understand this
   sentence?*
2. **Every visual enters on the word that names it.** When the voice says
   "Gujarat", the Gujarat pin pops at that frame. When it says "four o'clock",
   the clock reads 4:00 at that frame. Use word-level timing (`WORDS.tsv`), not
   line timing.
3. **Make a bespoke picture for each spoken noun.** Do not reuse a small
   generic library. One identical clock in 15 scenes, always at 10:10, was the
   main reason the failed version said nothing. "Delhi" means India Gate.
   "Bombay" means the Victoria Terminus building. "Tea garden" means a woman
   plucking tea.
4. **Draw anything that carries data in code, not with AI.** AI draws clock
   hands, numbers, bars and axes wrong. Draw them in code so they show the exact
   value spoken: a clock at 4:00, hands sweeping from 7:00 to 8:00 on "one hour
   ahead", rows of clocks for "Russia has 11 time zones", bars, counters,
   meridian lines.
5. **Put a label on everything.** Every picture gets a short caption beneath
   it, and key facts get a highlighted box ("सूरज निकलने के 6 घंटे बाद"). Use big
   numbers for figures ("30°", "1906 → 1948"). The viewer reads, hears and sees
   the same idea at once.
6. **Show the place on a map whenever a place is named.** Use a rough AI
   silhouette of the country, a code-drawn pin on the place, and a dotted line
   to a small state or region inset with its name. **Do not drop a map because
   it is not exact.** The viewer only needs to see roughly where. Dropping the
   maps made the earlier version incomprehensible. Mention once that rough
   borders on a national map can draw complaints on some platforms, then keep
   the map.
7. **Let every change land.** After a clock sweeps, a number pops or a pin
   drops, hold at least 0.7 s before the cut. A sweep that finished 0.07 s
   before the cut read as "nothing happened".
8. **Keep the facts that are spoken or written exact:** numbers, years, times.
   Pictures may be approximate. Words on screen may not.
9. **Make the picture tell the story too.** Paper background by day,
   crossfading to night on "darkness"; red cross-outs on "not"; a red line
   splitting a crowd on "divide". Literal beats read best.
10. **QC by looking.** After rendering, make a contact sheet of the last frame
    of every scene and check: does each frame show what that line says? Are any
    labels cut off or overlapping? Fix, then re-render only those scenes.

---

## Part 2: the pipeline

```
SCRIPT.md ─► VO (takes) ─► VO.wav + VO.tsv ─► align.py ─► WORDS.tsv
                                                   │
SCENES.tsv (planned FROM the words) ◄──────────────┘
   │  ELEMENTS.tsv (one bespoke PNG per spoken noun)
   │       │
   │   elements.py (Google Flow / Nano Banana on magenta) ─► key.py ─► elements/cut/*.png
   ▼
render.py shots ─► shots/NN.mp4 + labels.ass   (PIL frames; clocks/pins/lines drawn in code)
render.py master ─► + Hindi/any labels burned with ass:shaping=complex + mix.wav ─► FILM.mp4
```

Sound design and the final mix come from the companion skill **vox-doc-sound**:
music, ambience and SFX placed on words, mixed to -14 LUFS.

### Tools
- Python 3.11+ with numpy, pillow, scipy, soundfile, faster-whisper; ffmpeg
  with libass
- **Google Flow** (Nano Banana) for the PNG art, through the plugin's built-in
  DeepX Google Flow engine (`studio_generate_assets`: login check, Agent Mode or
  Standard mode, automatic Agent fallback). No extension or manual steps.
- Voice: Kokoro (English and others, local), Indic Parler-TTS on Kaggle
  (Hindi and Indian languages), or ElevenLabs. See vox-doc-sound.

---

## Part 3: step by step

### 1. Script (`SCRIPT.md`)
- Length: 2 minutes is about 30 lines. Use one sentence per line, spoken
  rhythm, short words.
- Structure: **hook** (a surprising concrete fact) → **facts** → **history** →
  **the cost / problem** → **the world** (how others do it) → **the question**
  → **the twist** (it reframes everything) → **closing line**.
- Pick lines that can be *shown*: places, objects, numbers, times, years,
  comparisons. Abstract lines need a concrete picture or they are lost.
- Fact-check every number and date. Say "estimates vary" rather than invent a
  figure.

### 2. Voice → `VO.wav` + `VO.tsv` (`id, start, dur, text`)
Record each line as its own take, trim the silence, and join with planned
gaps: 0.3-0.6 s within an act, about 1 s before a twist (vox-doc-sound
`vo_join.py`). Listen to the takes before going on.

### 3. Word timing → `WORDS.tsv`
`python scripts/align.py` (faster-whisper, one line at a time, with the script
line as the prompt). Output columns: `line, i, start, end, word`. This file
drives every cue.

### 4. Scene plan → `SCENES.tsv` (the heart of it)
One row per element. Columns:

| column | meaning |
|---|---|
| `scene` | scene number. A new scene starts at its first row's cue |
| `cue` | `@NN` = start of VO line NN; `-` = scene start; otherwise **a spoken word** (searched forward through the script) |
| `kind` | `img` (a PNG from ELEMENTS.tsv), `clock` ("4:00" or "6:00>7:00" sweep), `clocks` (a row of N clocks), `pin` (place on the last map), `vline` (dashed meridian through a place, or at x,y), `rule` ("a>b" red line between two pins, or "place>x,y" dotted link to an inset), `cross` (red ✕), `text` (KEY / NUM / TAG / LBL), `bg` (paper / night) |
| `what` | the image name, the time, the place name, or the text style |
| `x y size` | centre (0-1 of the frame) and height (0-1 of the frame) |
| `motion` | `pop`, `slideL`, `slideR`, `rise`, `hold` (present from scene start; then the cue only triggers a clock sweep) |
| `out` | a word on which the element leaves (optional) |
| `label` | caption under the element (or the text itself for `text`) |

A real example (the hook, line 01: "In Arunachal Pradesh the summer sun rises
at four in the morning"):

```
01  @01       bg     paper        -    -    -    -      -  -
01  अरुणाचल   img    india_map    .24  .55  .80  pop    -  -
01  अरुणाचल   pin    arunachal    -    -    -    -      -  -
01  प्रदेश    img    arunachal_map .58 .24  .26  pop    -  अरुणाचल प्रदेश
01  प्रदेश    rule   arunachal>.50,.30 -  -  -    -      -  -
01  सूरज      img    sunrise_hills .64 .74 .38  rise   -  -
01  चार       clock  4:00         .87  .30  .28  pop    -  सुबह 4 बजे
```

So: the map pops on "Arunachal", the state inset on "Pradesh", the sunrise on
"sun", and a clock reading 4:00 on "four", labelled "4 in the morning". The full
2-minute plan is in `example/SCENES.tsv`.

Planning tips:
- Name places → map + pin (+ state inset). Name a number → big NUM text or a
  code graphic. Name an object → its own PNG. Say "not / no / never" → a red
  cross. A comparison → two things side by side with labels.
- Each line usually needs 2-4 elements, not 1 and not 7.
- Layout: keep important things inside 10-90 % of the frame. Leave the bottom
  12 % for KEY text. Give labels room below their pictures.
- Cue rows must stay in script order. The renderer refuses a cue that lands
  after the cut, which catches a word matched in the wrong line.

### 5. Picture list → `ELEMENTS.tsv` (`id, name, object`)
One line per bespoke picture, described as a single object
("the Victoria Terminus railway station in old Bombay, colonial gothic stone
building with a central dome"). Maps: "a simple flat map of X as one single
solid shape silhouette, no internal borders".

### 6. Generate and cut out the PNGs
`python scripts/elements.py` sends each object to Flow with this style:
*"bold flat vector illustration with a thin dark outline, Vox editorial
explainer style, warm muted vintage colours, one single isolated object …
on a solid flat pure magenta background #FF00FF … no shadow, no text"*.
Then `key.py` removes the magenta (it unmixes the edge colour, so outlines stay
clean).

Flow lessons, each of which cost a re-run:
- At maximum speed (delay 0) Flow can pair outputs with the wrong prompt. Use
  `--batch 4-8 --delay 5-12`.
- Images added later to an existing Flow project can come back as **old images
  from that project's grid**, byte for byte. Submit late additions with
  `--new-project`. `elements.py` md5-checks the raw files before keying.
- Always look at a contact sheet of the generated images before building on
  them.

### 7. Render
- `python scripts/render.py plan` prints every element's resolved time. Check it.
- `python scripts/render.py shots` → `shots/NN.mp4` plus `labels.ass`.
- `python scripts/render.py master` → the film, with labels burned in using
  `ass=labels.ass:shaping=complex`. Without `shaping=complex`, Devanagari and
  other complex scripts break their conjuncts. Font: Nirmala UI on Windows,
  Noto Sans <script> elsewhere.
- Map pins: after the map PNG exists, measure the places once on a gridded copy
  of the map and enter their (u, v) positions in `PLACES` in render.py.
- Look: 1920×1080, 24 fps, cream paper texture with a vignette and fine grain;
  night = dark navy. Text styles: LBL 56 (labels), PIN 48, KEY 62 (yellow box),
  TAG 54 (dark box), NUM 120 (red figures).
- Voice variants: `--vo <name>` renders a second version (for example, a
  different narrator) from `WORDS_<name>.tsv` and `mix_<name>.wav`, re-timing
  every visual to that voice.

### 8. QC (do not skip)
- Make a contact sheet: last frame of each scene, 4 per row. Check
  word ↔ picture, overlaps, cut-off labels, and that clocks show the right time.
- Check that every clock sweep or reveal holds at least 0.7 s before the cut.
- Watch the whole film once with sound.

### 9. Sound
Use the **vox-doc-sound** skill. Cues go on words (a map pin on the place name,
a click on numbers, a whoosh only on act changes). Every voice is levelled to
-22 LUFS before the mix, and the mix ends at -14 LUFS.

---

## Part 4: checklist

- [ ] The script has a concrete hook, a twist, and exact facts
- [ ] The voice is QC'd; `VO.tsv` holds real timings
- [ ] `WORDS.tsv` is aligned
- [ ] Every line in `SCENES.tsv` has visuals cued on its words
- [ ] Every named place has a map with a pin (and a region inset)
- [ ] Every number, time or year is shown as a code graphic or big text
- [ ] Every picture is bespoke, from its own ELEMENTS.tsv row
- [ ] Every element has a label
- [ ] The contact sheet is clean: no overlap, no cut-off labels
- [ ] Every reveal holds at least 0.7 s
- [ ] Sound is on words, the mix is -14 LUFS, the voice is clearly on top
