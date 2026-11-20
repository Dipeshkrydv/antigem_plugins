# -*- coding: utf-8 -*-
"""Hand-Drawn Doodle: a warm sketchbook explainer drawn in crayon and felt-tip ink.

IDENTITY
  A smart friend explains the idea by drawing it on good paper while talking. Every frame is one clear
  visual metaphor drawn with thick, slightly imperfect black crayon lines, and coloured with only three
  crayons. It feels handmade, warm and calm. Nothing is photographic and nothing is glossy.

CANVAS
  Warm off-white fine-tooth paper #F8F6EF, always. No pure #FFFFFF, no dark pages, no gradients, no vignette.
  Occasional notebook margin rule (the `margin_notes` layout). Bottom 15% of every frame stays EMPTY: captions live there.

PALETTE (strict 3-crayon rule)
  ink black for every line · sunflower yellow · cobalt blue · tomato red.
  One crayon colour carries the meaning in each scene (yellow = idea/insight, blue = fact/calm, red = problem/warning).
  Never a fourth colour, never saturated fills over whole areas: crayon colour is scribble-shaded INSIDE lines.

TYPOGRAPHY
  Handwriting (Kalam, Latin + Devanagari) for everything. Titles 2 to 5 words, labels 1 to 3 words.
  Emphasis is drawn: a doodle circle around a word, a marker underline, a yellow highlighter swipe.
  No paragraphs, no serif, no all-caps blocks.

IMAGE LANGUAGE (what Flow must draw)
  Crayon doodle illustrations of ONE metaphor: a lightbulb with legs, a brain on a treadmill, money as leaves on a tree,
  a tiny person pushing a huge boulder labelled with nothing. Simple round-headed doodle people (dot eyes, expressive
  brows, natural proportions), never bug-eyed, never realistic. Props are drawn the same way.
  Scenes: the metaphor drawn on the paper with lots of empty paper around it. Cut-outs: the same drawing on magenta.

COMPOSITION
  One idea per frame, centred or on the left/right third, 40%+ empty paper. Arrows connect cause to effect.
  Labels sit right next to what they name. Sequences build: draw A, then draw the arrow, then draw B.

MOTION
  Things are DRAWN on, not flown in: wipe/draw reveals, gentle rise, small pop with settle. Arrows draw along
  their path. Camera: slow drift or a gentle push toward the punchline. Transitions: paper slide or a clean cut.
  No shake, no whip pans, no flashing.

SIGNATURE MOVES
  * metaphor_center: one big drawn metaphor with a circled keyword
  * cause -> effect: two drawings joined by a hand-drawn arrow
  * margin notes: a notebook page with the key point written in the margin
  * counting row: 2 to 4 small drawings in a row, each labelled
  * the "aha": the final drawing appears and the key word gets a yellow highlighter swipe

AVOID
  photos, 3D, gloss, gradients, drop-shadow heavy stickers, neon, more than 3 colours, speech-bubble clutter,
  text inside the generated image, dense frames, anything in the bottom 15%.
"""

NAME = "doodle"
LABEL = "Hand-Drawn Doodle"
ALIASES = ["hand_drawn", "hand_drawn_doodle", "crayon", "sketchbook", "whiteboard"]

PALETTE = {
    "canvas":  {"hex": "#F8F6EF", "use": "the paper; every frame"},
    "ink":     {"hex": "#1F1C18", "use": "every line and all handwriting"},
    "muted":   {"hex": "#8A8378", "use": "secondary handwriting, faint guide lines"},
    "accent1": {"hex": "#E5482F", "use": "tomato red: problem, warning, the wrong way"},
    "accent2": {"hex": "#F6BE1A", "use": "sunflower yellow: idea, insight, highlighter swipe"},
    "accent3": {"hex": "#2A5BD7", "use": "cobalt blue: fact, calm, the right way"},
    "stamp":   {"hex": "#E5482F", "use": "drawn emphasis marks"},
    "string":  {"hex": "#1F1C18", "use": "hand-drawn arrows"},
    "panel":   {"hex": "#FFFDF6", "alpha": 235, "use": "sticky notes"},
    "rule":    "ONE crayon colour carries the meaning per scene; never a fourth colour",
}

TYPE = {
    "title": "hand", "label": "hand", "number": "hand", "caption": "hand",
    "max_words": {"title": 5, "label": 3, "keyword": 3},
    "boxes": ["doodle_circle", "marker", "highlighter", "note", "sticky"],
}

MOTION = {
    "entrances": ["draw", "wipe", "rise", "pop"],
    "camera": ["drift", "push_in", "still"],
    "transitions": ["slide", "paper_slide", "cut", "fade"],
    "never": ["shake", "whip", "flash", "jitter"],
}

_NEG = ("no photograph, no photorealism, no 3D render, no CGI, no glossy vector gradients, no neon, "
        "no text, no letters, no numbers, no captions, no watermark, no logo, no UI, no frame, no border, "
        "no colours other than black, sunflower yellow, cobalt blue and tomato red, nothing in the bottom 15 percent")

STYLE = {
    "look": {
        "bg_kind": "paper", "vig": 0.0, "paper": True, "doodles": True, "dots": False, "grid": False,
        "caption": "box",
        "asset_frame": "clean", "photo_frame": "flat", "label_style": "plain",
        "halftone": False, "photo_halftone": False,
        "title_font": "hand", "big_font": "hand", "number_font": "hand",
        "ground": False, "jitter": False,
        "letterbox": 0.0, "grade": "", "grain": 1, "vignette": False,
        "transition": "slide", "camera": "drift",
        "kicker_prefix": "",
        "highlighter_color": (246, 190, 26),
        "boxes": ["doodle_circle", "marker", "highlighter", "note", "sticky"],
        "blocks": [((246, 190, 26), (31, 28, 24)), ((42, 91, 215), (255, 253, 246)), ((229, 72, 47), (255, 253, 246))],
    },
    "prompt": {
        "lock": ("hand-drawn crayon doodle on warm off-white fine-tooth paper #F8F6EF, thick slightly imperfect black "
                 "crayon outlines of even weight, colour only from three crayons (sunflower yellow, cobalt blue, tomato red) "
                 "scribble-shaded inside the lines, same simple round-headed doodle people and the same line weight in every image"),
        "clarity": ("ONE clear visual metaphor drawn in crayon, generous empty paper around it (at least 40 percent), "
                    "readable at thumbnail size, the bottom 15 percent of the frame left completely empty"),
        "medium": "modern minimalist hand-drawn crayon doodle illustration on paper",
        "lighting": "no lighting effects: flat paper, no cast shadows, no gradients",
        "palette": "black crayon line art, sunflower yellow, cobalt blue and tomato red crayon accents on warm off-white paper",
        "camera": {"shot": "centred illustration", "lens": "flat 2D drawing, no perspective distortion",
                   "angle": "straight-on, paper flat to camera", "movement": "none"},
        "mood": "warm, clear, curious, friendly",
        "quality": "crisp crayon texture, confident hand-drawn lines, clean composition, high legibility",
        "negative": _NEG,
        "asset_medium": ("isolated hand-drawn crayon doodle of a single object or doodle person, thick black crayon outline, "
                         "yellow / blue / red crayon shading only"),
    },
}

CENTERED = {"metaphor_center", "notebook_hero"}

LAYOUTS_16_9 = {
    # one big drawn metaphor in the middle, circled keyword above, short note beside it
    "metaphor_center": {
        "title": (0.20, 0.06, 0.60, 0.12),
        "center": (0.30, 0.20, 0.40, 0.54),
        "l1": (0.05, 0.36, 0.22, 0.12), "r1": (0.73, 0.36, 0.22, 0.12),
    },
    # drawing on the left two thirds, handwritten title + keyword on the right third
    "notebook_hero": {
        "left": (0.05, 0.08, 0.54, 0.66),
        "title": (0.63, 0.14, 0.32, 0.22), "label": (0.63, 0.40, 0.32, 0.10), "l2": (0.63, 0.54, 0.32, 0.10),
    },
    # notebook page: drawing centre-right, the key point handwritten in the left margin
    "margin_notes": {
        "l1": (0.04, 0.12, 0.20, 0.14), "l2": (0.04, 0.32, 0.20, 0.14),
        "title": (0.30, 0.06, 0.64, 0.10), "right": (0.30, 0.18, 0.64, 0.56),
    },
}
LAYOUTS_9_16 = {
    "metaphor_center": {
        "title": (0.08, 0.08, 0.84, 0.10),
        "center": (0.10, 0.20, 0.80, 0.36),
        "l1": (0.06, 0.58, 0.42, 0.07), "r1": (0.52, 0.58, 0.42, 0.07),
    },
    "notebook_hero": {
        "title": (0.07, 0.08, 0.86, 0.10), "left": (0.08, 0.20, 0.84, 0.36),
        "label": (0.07, 0.58, 0.86, 0.05), "l2": (0.07, 0.64, 0.86, 0.05),
    },
    "margin_notes": {
        "title": (0.07, 0.08, 0.86, 0.09), "right": (0.08, 0.19, 0.84, 0.34),
        "l1": (0.07, 0.55, 0.42, 0.08), "l2": (0.51, 0.55, 0.42, 0.08),
    },
}

# Recipes are TEMPLATES: core/auto_edit.py fills every name / text / cue from the voice line it is used for.
RECIPES = {
    "hook_metaphor": {
        "use_for": ["hook", "object", "reveal"], "layout": "metaphor_center", "bg": "paper", "camera": "push_in",
        "items": [
            {"type": "title", "text": "बड़ा *सवाल*", "at": "WORD"},
            {"type": "asset", "name": "DOODLE_HERO", "slot": "center", "at": "WORD", "enter": "draw"},
            {"type": "keyword", "text": "क्यों?", "box": "doodle_circle", "slot": "r1", "at": "WORD"},
        ],
    },
    "cause_effect": {
        "use_for": ["compare", "reveal"], "layout": "duo", "bg": "paper",
        "items": [
            {"type": "title", "text": "एक से *दूसरा*", "at": "WORD"},
            {"type": "asset", "name": "DOODLE_CAUSE", "slot": "left", "at": "WORD", "enter": "draw"},
            {"type": "asset", "name": "DOODLE_EFFECT", "slot": "right", "at": "WORD", "enter": "draw"},
            {"type": "arrow", "from": "left", "to": "right", "at": "WORD", "color": "ink"},
        ],
    },
    "margin_point": {
        "use_for": ["object", "place", "quote"], "layout": "margin_notes", "bg": "paper",
        "items": [
            {"type": "asset", "name": "DOODLE_SCENE", "slot": "right", "at": "WORD", "enter": "draw"},
            {"type": "note", "text": "याद रखो", "slot": "l1", "at": "WORD"},
        ],
    },
    "notebook_person": {
        "use_for": ["person", "object"], "layout": "notebook_hero", "bg": "paper",
        "items": [
            {"type": "asset", "name": "DOODLE_PERSON", "slot": "left", "at": "WORD", "enter": "draw"},
            {"type": "title", "text": "यह *कौन* है", "at": "WORD"},
            {"type": "keyword", "text": "नाम", "box": "marker", "slot": "label", "at": "WORD"},
        ],
    },
    "count_row": {
        "use_for": ["list", "number"], "layout": "stickman.row3", "bg": "paper",
        "items": [
            {"type": "asset", "name": "DOODLE_1", "slot": "a", "label": "एक", "at": "WORD"},
            {"type": "asset", "name": "DOODLE_2", "slot": "b", "label": "दो", "at": "WORD"},
            {"type": "asset", "name": "DOODLE_3", "slot": "c", "label": "तीन", "at": "WORD"},
        ],
    },
    "big_number": {
        "use_for": ["number"], "layout": "metaphor_center", "bg": "paper",
        "items": [
            {"type": "counter", "to": 70, "suffix": "%", "slot": "title", "at": "WORD"},
            {"type": "asset", "name": "DOODLE_HERO", "slot": "center", "at": "WORD", "enter": "draw"},
        ],
    },
    "two_ways": {
        "use_for": ["compare"], "layout": "stickman.row2", "bg": "paper",
        "items": [
            {"type": "asset", "name": "DOODLE_WRONG", "slot": "a", "label": "ग़लत", "at": "WORD"},
            {"type": "asset", "name": "DOODLE_RIGHT", "slot": "b", "label": "सही", "at": "WORD"},
        ],
    },
    "aha_outro": {
        "use_for": ["outro", "reveal", "quote"], "layout": "stickman.pop_title", "bg": "paper", "camera": "still",
        "items": [
            {"type": "keyword", "text": "असली बात", "box": "highlighter", "slot": "title", "at": "WORD"},
            {"type": "keyword", "text": "सोचो", "box": "doodle_circle", "slot": "l1", "at": "WORD"},
        ],
    },
    "steps_timeline": {
        "use_for": ["list", "number"], "layout": "timeline", "bg": "paper",
        "items": [
            {"type": "title", "text": "कदम *दर* कदम", "at": "WORD"},
            {"type": "timeline", "points": [{"label": "1", "text": "शुरू", "at": "WORD_1"},
                                            {"label": "2", "text": "बीच", "at": "WORD_2"},
                                            {"label": "3", "text": "अंत", "at": "WORD_3"}]},
        ],
    },
}

EXAMPLES = [f"{k}: RECIPES['{k}'] ({', '.join(v['use_for'])})" for k, v in RECIPES.items()]

BEAT_S = 1.4
MIX = {"scene": 0.30, "asset": 0.55, "reuse": 0.05, "text": 0.10}
MENU = {
    "scene": ["one big visual metaphor drawn in the middle of the page", "cause and effect: two drawings and an arrow",
              "a tiny doodle person facing a huge problem object", "a simple doodle map with a dotted route",
              "a doodle diagram (cycle, ladder, scale, funnel)", "a before / after pair of drawings",
              "a doodle crowd of small round-headed people", "a notebook page with a drawing and margin arrows"],
    "asset": ["doodle person showing an emotion (curious, stuck, surprised, proud)", "doodle person doing one action",
              "everyday object drawn in crayon (phone, clock, coin, book, lightbulb)", "symbol doodle (heart, star, warning, question mark)",
              "doodle arrow or path", "doodle chart (rising line, bar, pie)", "doodle building or landmark", "doodle animal or plant"],
}
ACCENTS = ["sunflower-yellow crayon accent", "cobalt-blue crayon accent", "tomato-red crayon accent"]

DESIGN = __doc__
