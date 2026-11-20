# -*- coding: utf-8 -*-
"""Suspense Noir / Crime Thriller — true-crime noir engine.

IDENTITY
  A prestige true-crime documentary. Full-bleed cinematic chiaroscuro photography carries most beats; the case
  is assembled on top of it with case-file tags, redaction bars that slide away on the reveal word, polaroids on
  a red-string board and forensic cut-outs. Slow, tense, investigative; every frame feels like evidence.

The visual language of prestige true-crime documentary series and investigative podcasts turned into video:
cold opens, case files, deep noir photography, red-string evidence boards,
polaroid portraits pinned to cork, redaction bars that slide to reveal, CCTV framing with
timestamps, forensic callouts tagged like exhibits, cinema letterbox and 35mm grain.

WHAT MAKES IT WORK
  * cinema-wide letterbox (7.5%) so every frame reads as "footage, not image"
  * cold cyan shadows + warm amber highlights, with blood-red used ONLY on stamps/strings
  * never leave the frame bare -- a photo, a pin, a label, a timestamp, something
  * redactions and reveals are the signature move: hide a name until the beat it drops
  * the rubber stamp SLAMS with screen shake and sub-bass -- but only TWICE per video (the reveal, the verdict);
    other emphasis beats are tabs, tape, seals, scrawls, redactions (core/engine/variety.py enforces it)
  * every photo is a polaroid with hand-written caption and a red/amber pushpin
  * evidence boards (`board` layout) connect photos with red string on named cues
  * CCTV-framed photos get a timestamp overlay like "03:14:22 // CAM 04"

ESSENTIAL ELEMENTS
  kicker        case-file tag: "CASE FILE #4092-A // EVIDENCE 03"
  title         bold claim with one *word* in blood-red
  redact        black bar that slides away on a named cue (prime suspect reveal)
  stamp         CLASSIFIED / COLD CASE / PRIME SUSPECT -- design rubber (max 2) | tab | tape | seal | scrawl
  photo         polaroid frame with handwritten caption (default)
  callout       forensic tag "EXHIBIT A -- 9mm shell" pointing to a detail
  string        red yarn connecting two board items (evidence connections)
  lower_third   witness statement with role under the name
  timeline      case chronology with timestamps

LAYOUTS unique to this style
  evidence_board     cork-pin photos + central stamp + strings between slots
  interrogation      centred face, left/right call-outs
  cctv_grid          four CCTV photo panels with timestamps
  dossier            open folder spread: documents left, photos right
  cold_open          giant redacted title + case kicker + ticking clock

AVOID
  * stickers, doodle accents, bright primary colours, speech bubbles
  * clean/soft caption plates (use `cinema` with amber highlight)
  * fast whip transitions (dip-to-black and slow fades sell the genre)

IMAGE PROMPTS come out as low-key chiaroscuro cinema photography:
hard practical light sources (single desk lamp, interrogation bulb, headlights, torch),
desaturated teal shadows, one warm amber highlight, deep crushed shadows, volumetric haze,
heavy 35mm grain, matte-painting detail.
"""

NAME = "noir"
LABEL = "Suspense Noir / Crime Thriller"
ALIASES = ["crime", "suspense", "truecrime", "suspense_crime", "thriller"]

PALETTE = {
    "canvas":  {"hex": "#0A0B0E", "use": "near-black cinema base"},
    "ink":     {"hex": "#ECE8DE", "use": "warm off-white type"},
    "muted":   {"hex": "#8A8C94", "use": "case-file grey"},
    "accent1": {"hex": "#D7263D", "use": "evidence blood-red: stamps, strings, one word in a title"},
    "accent2": {"hex": "#F2A541", "use": "amber: timestamps, reveals, practical light"},
    "accent3": {"hex": "#78AAD2", "use": "cold cyan rim light"},
    "stamp":   {"hex": "#CD2630", "use": "heavy ink red stamps (max 2 per video)"},
    "string":  {"hex": "#C41E2D", "use": "evidence string"},
    "panel":   {"hex": "#0E1016", "alpha": 225, "use": "dossier cards"},
    "rule":    "cold cyan shadows + warm amber highlights; blood-red ONLY on stamps, strings and one title word",
}

TYPE = {
    "title": "vintage", "label": "mono", "number": "display", "caption": "caption",
    "max_words": {"title": 6, "label": 4, "keyword": 3},
    "boxes": ["cctv", "timestamp", "redact_bar", "label", "torn"],
    "case": "upper",
}

MOTION = {
    "entrances": ["fade", "rise", "slam", "wipe"],
    "camera": ["push_in", "drift", "still"],
    "transitions": ["dip", "fade", "luma_wipe"],
    "never": ["whip", "bouncy pop", "sticker wobble"],
}

_NEG = ("no text, no letters, no captions, no watermark, no logo, no signature, no UI, "
        "no borders, no frames, no split screen, no collage, no cartoon, no illustration, "
        "no neon colours")

STYLE = {
    "look": {
        "bg": (10, 11, 14),              # near-black cinema
        "ink": (236, 232, 222),          # warm paper off-white
        "muted": (138, 140, 148),        # case-file muted grey
        "accent": (215, 38, 61),         # evidence-tag blood red
        "accent2": (242, 165, 65),       # amber reveal / timestamp
        "accent3": (120, 170, 210),      # cold cyan rim light
        "panel": (14, 16, 22, 225),      # dossier card fill
        "stamp_color": (205, 38, 48),    # heavy ink red
        "string_color": (196, 30, 45),   # evidence string
        "caption": "cinema",             # letterboxed caption with amber current-word
        "asset_frame": "clean",          # props sit on dark backdrop
        "photo_frame": "polaroid",       # ALWAYS polaroid for crime photos
        "letterbox": 0.075,              # cinema bars
        "grade": "eq=contrast=1.09:saturation=0.80:gamma=0.96",
        "grain": 5,                      # noticeable but not noisy
        "vignette": True,
        "transition": "dip",             # dip-to-black between beats
        "camera": "push_in",             # relentless investigator move
        "kicker_prefix": "CASE FILE",
        "title_font": "vintage",
        # keyword rotation: forensic and investigative treatments
        "boxes": ["cctv", "timestamp", "redact_bar", "label", "torn"],
    },
    "prompt": {
        "lock": ("cinematic photoreal true-crime documentary still on 35mm anamorphic film, low-key chiaroscuro from a single hard "
                 "practical light, desaturated teal shadows and warm amber highlights, heavy film grain, the same grade in every image"),
        "clarity": (
            "ONE dominant focal subject, pitch-black negative space on one side, "
            "a single hard practical light source (desk lamp / interrogation bulb / torch / headlights), "
            "cold teal shadows with warm amber highlights, one BLOOD-RED accent only, "
            "crushed shadows, heavy atmosphere, the headline area kept pitch dark"
        ),
        "medium": "cinematic photoreal true-crime documentary still, 35mm anamorphic film, matte-painting background depth",
        "lighting": "low-key chiaroscuro, SINGLE hard practical light source, deep crushed shadows, volumetric smoke/dust haze",
        "palette": "near-black foundations, desaturated teal-blue shadows, warm amber practical highlights, ONE accent of blood red",
        "camera": {"shot": "wide establishing shot", "lens": "35mm anamorphic", "angle": "slight low-angle, eye level",
                   "movement": "slow relentless dolly push-in"},
        "mood": "tense, ominous, investigative, suspenseful, dread-filled",
        "quality": "35mm film grain, deep contrast, moody atmosphere, sharp focus on the subject, soft bokeh falloff",
        "negative": _NEG,
        "asset_medium": "photoreal museum-archive evidence photograph, forensic documentation lighting",
    },
}

# ---- Crime-only layouts ---------------------------------------------------
LAYOUTS_16_9 = {
    # Cork-pin board with 5 pinnable slots and a central stamp zone
    "evidence_board": {
        "tag": (0.06, 0.06, 0.30, 0.04),
        "a": (0.04, 0.11, 0.26, 0.36),
        "b": (0.37, 0.09, 0.26, 0.34),
        "c": (0.70, 0.11, 0.26, 0.36),
        "d": (0.21, 0.49, 0.24, 0.26),
        "e": (0.55, 0.50, 0.24, 0.25),
        "stamp": (0.80, 0.55, 0.16, 0.14),
        "label": (0.04, 0.49, 0.15, 0.04),
    },
    # Centred suspect face with call-outs on either side
    "interrogation": {
        "tag": (0.06, 0.07, 0.88, 0.04),
        "center": (0.34, 0.12, 0.32, 0.60),
        "l1": (0.04, 0.18, 0.26, 0.08),
        "l2": (0.04, 0.40, 0.26, 0.08),
        "r1": (0.70, 0.18, 0.26, 0.08),
        "r2": (0.70, 0.40, 0.26, 0.08),
        "stamp": (0.70, 0.56, 0.26, 0.14),
    },
    # 2x2 CCTV grid of time-stamped frames
    "cctv_grid": {
        "tag": (0.06, 0.06, 0.60, 0.04),
        "a": (0.05, 0.12, 0.43, 0.30),
        "b": (0.52, 0.12, 0.43, 0.30),
        "c": (0.05, 0.44, 0.43, 0.30),
        "d": (0.52, 0.44, 0.43, 0.30),
    },
    # Open dossier: documents left, photo stack right, redacted title
    "dossier": {
        "tag": (0.06, 0.07, 0.44, 0.04),
        "title": (0.06, 0.12, 0.44, 0.18),
        "list": (0.06, 0.32, 0.44, 0.40),
        "right": (0.54, 0.11, 0.42, 0.62),
        "stamp": (0.62, 0.01, 0.30, 0.09),
    },
    # Giant redacted title with ticking clock lower-right
    "cold_open": {
        "tag": (0.08, 0.14, 0.84, 0.05),
        "title": (0.08, 0.21, 0.84, 0.38),
        "label": (0.08, 0.61, 0.84, 0.05),
        "stamp": (0.72, 0.67, 0.22, 0.08),
    },
    # Full cinematic shot: edge-to-edge photography, single discreet timestamp or case tag
    "cinematic_full": {
        "tag": (0.06, 0.08, 0.45, 0.04),
        "stamp": (0.76, 0.08, 0.18, 0.10),
    },
    "redacted_statement": {
        "tag": (0.08, 0.20, 0.84, 0.05),
        "title": (0.08, 0.27, 0.84, 0.32),
        "label": (0.08, 0.62, 0.84, 0.06),
    },
}
LAYOUTS_9_16 = {
    "cctv_grid": {
        "tag": (0.07, 0.07, 0.86, 0.03),
        "a": (0.04, 0.11, 0.45, 0.27), "b": (0.51, 0.11, 0.45, 0.27),
        "c": (0.04, 0.40, 0.45, 0.27), "d": (0.51, 0.40, 0.45, 0.27),
    },
    "cinematic_full": {
        "tag": (0.07, 0.08, 0.86, 0.03),
        "stamp": (0.50, 0.60, 0.42, 0.08),
    },
    "redacted_statement": {
        "tag": (0.08, 0.24, 0.84, 0.04),
        "title": (0.08, 0.29, 0.84, 0.26),
        "label": (0.08, 0.58, 0.84, 0.06),
    },
    "evidence_board": {
        "tag": (0.07, 0.07, 0.86, 0.03),
        "a": (0.04, 0.10, 0.44, 0.22),
        "b": (0.52, 0.13, 0.44, 0.22),
        "c": (0.04, 0.35, 0.44, 0.20),
        "d": (0.52, 0.37, 0.44, 0.20),
        "stamp": (0.30, 0.59, 0.40, 0.08),
    },
    "interrogation": {
        "tag": (0.07, 0.07, 0.86, 0.03),
        "center": (0.14, 0.19, 0.72, 0.36),
        "l1": (0.04, 0.11, 0.42, 0.06),
        "r1": (0.54, 0.11, 0.42, 0.06),
        "l2": (0.04, 0.56, 0.42, 0.06),
        "r2": (0.54, 0.56, 0.42, 0.06),
        "stamp": (0.30, 0.63, 0.40, 0.065),
    },
    "cold_open": {
        "tag": (0.08, 0.26, 0.84, 0.04),
        "title": (0.08, 0.30, 0.84, 0.26),
        "label": (0.08, 0.57, 0.84, 0.05),
        "stamp": (0.30, 0.63, 0.40, 0.065),
    },
}

# Recipes are TEMPLATES: core/auto_edit.py fills every name / text / cue from the voice line it is used for.
RECIPES = {
    # Cold open: giant redacted title + ticking case file + stamp
    "cold_open": {
        "use_for": ["hook", "reveal"], "layout": "cold_open", "bg": "SCENE_BG", "camera": "push_in", "transition": "dip",
        "items": [
            {"type": "kicker", "text": "CASE FILE #NEP-1903 // SEALED"},
            {"type": "redact", "text": "WHO ORDERED THE MASSACRE?", "reveal": "WORD"},
            {"type": "stamp", "text": "CLASSIFIED", "at": "WORD"},
        ],
    },
    # Evidence board: 4 polaroids + red strings + CONSPIRACY stamp
    "evidence_board": {
        "use_for": ["list", "person"], "layout": "evidence_board", "bg": "SCENE_BG", "camera": "drift", "transition": "dip",
        "items": [
            {"type": "kicker", "text": "EVIDENCE // SUSPECTS"},
            {"type": "photo", "src": "SRC_A", "caption": "SUSPECT A", "slot": "a", "frame": "polaroid"},
            {"type": "photo", "src": "SRC_B", "caption": "SUSPECT B", "slot": "b", "frame": "polaroid"},
            {"type": "photo", "src": "SRC_C", "caption": "SUSPECT C", "slot": "c", "frame": "polaroid"},
            {"type": "photo", "src": "SRC_D", "caption": "SUSPECT D", "slot": "d", "frame": "polaroid"},
            {"type": "string", "from": "a", "to": "d", "at": "WORD_1"},
            {"type": "string", "from": "b", "to": "d", "at": "WORD_2"},
            {"type": "string", "from": "c", "to": "d", "at": "WORD_3"},
            {"type": "stamp", "text": "CONSPIRACY", "at": "WORD_LAST", "design": "scrawl"},
        ],
    },
    # Prime suspect face: centred portrait + two forensic callouts + PRIME SUSPECT stamp
    "prime_suspect": {
        "use_for": ["person", "reveal"], "layout": "interrogation", "bg": "SCENE_BG", "camera": "push_in", "transition": "dip",
        "items": [
            {"type": "kicker", "text": "PRIME SUSPECT"},
            {"type": "photo", "src": "SRC_FACE", "frame": "polaroid", "slot": "center",
             "caption": "SUSPECT NAME"},
            {"type": "callout", "text": "AGE 29", "point": [0.45, 0.30], "slot": "l1"},
            {"type": "callout", "text": "RANK: GENERAL", "point": [0.5, 0.40], "slot": "r1"},
            {"type": "callout", "text": "MOTIVE: POWER", "point": [0.45, 0.55], "slot": "l2"},
            {"type": "stamp", "text": "PRIME SUSPECT", "at": "WORD", "design": "tab"},
        ],
    },
    # Witness quote (lower third slab + italic quote)
    "witness_quote": {
        "use_for": ["quote"], "layout": "quote", "bg": "SCENE_BG", "camera": "still", "transition": "fade",
        "items": [
            {"type": "kicker", "text": "WITNESS STATEMENT // 1947 BS"},
            {"type": "title", "text": "\"QUOTE *HERE*\"", "font": "serif"},
            {"type": "lower_third", "text": "WITNESS NAME", "sub": "role, date"},
        ],
    },
    # Full-bleed cinematic scene: the photograph carries the beat, one discreet case tag
    "cinematic_scene": {
        "use_for": ["place", "hook", "object"], "layout": "cinematic_full", "bg": "SCENE_BG", "camera": "push_in", "transition": "dip",
        "items": [
            {"type": "keyword", "text": "LOCATION", "box": "cctv", "slot": "tag", "at": "WORD"},
        ],
    },
    # CCTV grid: four time-stamped frames of the same night
    "cctv_grid": {
        "use_for": ["list", "place"], "layout": "cctv_grid", "bg": "dark", "camera": "still", "transition": "dip",
        "items": [
            {"type": "photo", "src": "SRC_A", "slot": "a", "frame": "card", "at": "WORD"},
            {"type": "photo", "src": "SRC_B", "slot": "b", "frame": "card", "at": "WORD"},
            {"type": "photo", "src": "SRC_C", "slot": "c", "frame": "card", "at": "WORD"},
            {"type": "photo", "src": "SRC_D", "slot": "d", "frame": "card", "at": "WORD"},
        ],
    },
    # Two sides of the case facing each other
    "two_suspects": {
        "use_for": ["compare"], "layout": "duo", "bg": "SCENE_BG", "camera": "drift", "transition": "dip",
        "items": [
            {"type": "title", "text": "*WHO* LIED?", "at": "WORD"},
            {"type": "photo", "src": "SRC_A", "slot": "left", "frame": "polaroid", "caption": "A", "at": "WORD"},
            {"type": "photo", "src": "SRC_B", "slot": "right", "frame": "polaroid", "caption": "B", "at": "WORD"},
        ],
    },
    # The number that matters: a single counter over a dark scene
    "case_number": {
        "use_for": ["number"], "layout": "focus", "bg": "SCENE_BG", "camera": "push_in", "transition": "dip",
        "items": [
            {"type": "counter", "to": 1846, "plain": True, "slot": "stamp", "at": "WORD"},
            {"type": "photo", "src": "SRC_DETAIL", "slot": "center", "frame": "polaroid", "at": "WORD"},
        ],
    },
    # Verdict / outro: a redacted statement that resolves
    "verdict": {
        "use_for": ["outro", "reveal", "quote"], "layout": "redacted_statement", "bg": "SCENE_BG", "camera": "still", "transition": "fade",
        "items": [
            {"type": "redact", "text": "THE CASE IS STILL OPEN", "reveal": "WORD"},
        ],
    },
}

EXAMPLES = [
    "cold open: RECIPES['cold_open'] — redacted title + CLASSIFIED stamp",
    "4-suspect board: RECIPES['evidence_board'] — polaroids + red strings",
    "prime suspect reveal: RECIPES['prime_suspect']",
    "witness statement: RECIPES['witness_quote']",
]

# ---- asset plan: true-crime noir is cinema-led: atmospheric edge-to-edge shots with slow push-ins
BEAT_S = 1.2
MIX = {"scene": 0.50, "asset": 0.40, "reuse": 0.05, "text": 0.05}
MENU = {
    "scene": ["wide establishing shot of the location at night", "medium shot of the key person in shadow",
              "extreme close-up of eyes / hands / a detail", "over-the-shoulder looking at evidence",
              "high-angle surveillance view", "low-angle looming figure", "silhouette against a light source",
              "empty room after the event", "reflection in glass / water / metal", "through a keyhole / doorway / window"],
    "asset": ["evidence photograph (polaroid portrait)", "weapon / tool", "document / letter / report page",
              "newspaper clipping", "map with a marked location", "key / lock / seal", "clock / calendar page",
              "personal item (watch, ring, shoe)", "recording device (tape, radio, camera)", "coin / money / jewel",
              "emblem / insignia / flag", "vehicle"],
}
ACCENTS = ["one BLOOD-RED accent", "one warm AMBER accent", "one cold CYAN accent"]

DESIGN = __doc__
