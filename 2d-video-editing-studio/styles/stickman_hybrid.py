# -*- coding: utf-8 -*-
"""Stickman Storytelling: an expressive comic stickman explainer with selective colour.

IDENTITY
  A funny, sharp storyteller. A simple stick figure with a clean white round head acts out the idea in hand-drawn
  scenes: reacting, pointing, falling, climbing, arguing with itself. The comedy is in the POSE and the FACE, the
  clarity is in the staging. It reads like a modern comic strip that moves.

CANVAS
  Warm paper #F5F1E6 for diagram beats, or a full hand-drawn 2D scene (cliff, desk, road, cave, city) drawn in muted
  slate / ink cross-hatching so the coloured hero pops. Never a photograph.

PALETTE (selective colour)
  Scenes stay muted (slate, warm grey, paper). Only the stickman's outfit and the ONE hero prop carry saturated colour:
  cobalt #2A6BD1, marker red #D63C28 or warm amber #F0AF0F. One saturated colour per scene, plus ink black and white.

CHARACTER
  White round head, black ink contour 3 to 5 px, dot or oval eyes, expressive eyebrows, simple mouth (smirk, shock,
  grin, frown). Limbs are clean lines with readable hands. Outfit comes from the story: the cast in SHOTS.json
  `world.characters`, or clothing that fits the era and job (caveman tunic, Roman soldier, office shirt, lab coat).
  Same face, line weight and proportions in every shot.

TYPOGRAPHY
  Handwritten Kalam for titles (2 to 5 words). Labels 1 to 3 words in plain dark ink under the drawing.
  Emphasis: doodle circle, marker underline, one sticky note. At most ONE speech bubble per scene, 1 to 4 words.

COMPOSITION
  Rule of thirds: the character on one third, the thing it reacts to on the other. Big empty paper for text.
  Rows of 2 to 4 labelled drawings for lists and comparisons.

MOTION
  Snappy but clean: pop with settle, slide in, quick whip transitions between story beats, gentle drift on scenes.
  No continuous wobble or shaking.

SIGNATURE MOVES
  whiteboard hero (character + circled keyword) · reaction beat (character + big prop) · labelled row · napkin math
  (two sides of a comparison) · pop title for questions and punchlines

AVOID
  photoreal people or places, 3D renders, glossy gradients, more than one saturated colour per scene, speech-bubble
  clutter, the same outfit for every era, paragraphs of text.
"""

NAME = "stickman"
LABEL = "Stickman Storytelling"
ALIASES = ["stickman_hybrid", "explainer", "stick_figure"]

PALETTE = {
    "canvas":  {"hex": "#F5F1E6", "use": "paper for diagram beats"},
    "ink":     {"hex": "#181614", "use": "all contours and handwriting"},
    "muted":   {"hex": "#6E665C", "use": "scenery tone, secondary text"},
    "accent1": {"hex": "#D63C28", "use": "marker red: problem, danger, emphasis"},
    "accent2": {"hex": "#F0AF0F", "use": "warm amber: idea, highlight"},
    "accent3": {"hex": "#2A6BD1", "use": "cobalt: the hero colour, calm facts"},
    "stamp":   {"hex": "#D63C28", "use": "emphasis marks"},
    "string":  {"hex": "#181614", "use": "arrows"},
    "panel":   {"hex": "#FFFCF4", "alpha": 240, "use": "notes and bubbles"},
    "rule":    "scenes muted; ONE saturated colour per scene on the character or hero prop",
}

TYPE = {
    "title": "hand", "label": "body", "number": "hand", "caption": "caption",
    "max_words": {"title": 5, "label": 3, "keyword": 3, "speech_bubble": 4},
    "boxes": ["doodle_circle", "marker", "note", "tag", "pill"],
}

MOTION = {
    "entrances": ["pop", "slide", "rise", "draw"],
    "camera": ["drift", "push_in", "pan_right", "pan_left"],
    "transitions": ["whip", "slide", "smooth_zoom", "cut"],
    "never": ["shake", "jitter"],
}

_NEG = ("no photorealism, no live-action photo, no 3D CGI render, no photographic skin, no glossy gradients, "
        "no text, no letters, no captions, no watermark, no logo, no UI, no frame, no border, no messy scribble, no blur")

STYLE = {
    "look": {
        "bg_kind": "paper", "vig": 0.18, "vig_tint": (1.0, 0.94, 0.86),
        "caption": "pill",
        "asset_frame": "clean", "photo_frame": "flat",
        "label_style": "plain",
        "halftone": False, "photo_halftone": False, "dot": 7,
        "title_font": "hand", "big_font": "hand",
        "doodles": True, "jitter": False, "ground": False,
        "letterbox": 0.0, "grade": "eq=saturation=1.05", "grain": 0, "vignette": False,
        "transition": "slide", "camera": "drift", "paper": True,
        "kicker_prefix": "",
        "blocks": [((42, 107, 209), (255, 255, 255)), ((240, 175, 15), (24, 22, 20)),
                   ((214, 60, 40), (255, 255, 255)), ((255, 255, 255), (42, 107, 209))],
        "boxes": ["pill", "marker", "doodle_circle", "note", "tag"],
    },
    "prompt": {
        "lock": ("modern 2D comic stickman illustration: clean white round head, black ink contours 3 to 5 px, expressive "
                 "eyebrows, simple readable limbs, flat cel shading; muted slate and paper-toned scenery with ONE saturated "
                 "colour on the character or hero prop; identical character design and line weight in every image"),
        "clarity": ("ONE expressive stickman moment that reads in one second: a clear pose and facial expression, the object "
                    "or place it reacts to, empty paper-toned space for a headline"),
        "medium": "modern 2D digital comic illustration with an expressive stickman character, clean vector ink lines",
        "lighting": "simple directional light with soft cel shadows, no realistic lighting",
        "palette": "ink black contours, white head, muted slate and warm paper scenery, one saturated accent (cobalt, marker red or amber)",
        "camera": {"shot": "medium shot", "lens": "flat 2D comic framing", "angle": "eye level", "movement": "none"},
        "mood": "funny, curious, sharp, storytelling",
        "quality": "crisp ink lines, bold silhouette, clean edges, instant readability",
        "negative": _NEG,
        "asset_medium": ("isolated 2D comic stickman character or single prop with crisp black ink outline and flat cel shading, "
                         "outfit and props that fit the story's era"),
    },
}

CENTERED = {"row2", "row3", "row4", "flatlay", "pop_title"}

LAYOUTS_16_9 = {
    # the Hindi explainer: illustrations in a row, label beneath each (asset `label`)
    "row2": {
        "tag": (0.06, 0.07, 0.88, 0.04), "title": (0.06, 0.11, 0.88, 0.12),
        "a": (0.12, 0.26, 0.34, 0.49), "b": (0.54, 0.26, 0.34, 0.49),
    },
    "row3": {
        "tag": (0.06, 0.07, 0.88, 0.04), "title": (0.06, 0.11, 0.88, 0.12),
        "a": (0.05, 0.26, 0.28, 0.49), "b": (0.36, 0.26, 0.28, 0.49), "c": (0.67, 0.26, 0.28, 0.49),
    },
    "row4": {
        "tag": (0.06, 0.07, 0.88, 0.04), "title": (0.06, 0.11, 0.88, 0.12),
        "a": (0.03, 0.26, 0.21, 0.49), "b": (0.27, 0.26, 0.21, 0.49),
        "c": (0.51, 0.26, 0.21, 0.49), "d": (0.75, 0.26, 0.21, 0.49),
    },
    # retro cut-out: text block left, big sticker right
    "retro_hero": {
        "tag": (0.06, 0.09, 0.30, 0.04), "title": (0.06, 0.15, 0.36, 0.30),
        "label": (0.06, 0.48, 0.36, 0.08),
        "center": (0.46, 0.06, 0.50, 0.70),
    },
    # desk flat-lay (bg "mat"): colour-block titles centre, objects in the corners, tiny badges
    "flatlay": {
        "a": (0.03, 0.05, 0.19, 0.31), "b": (0.78, 0.05, 0.19, 0.31),
        "c": (0.03, 0.42, 0.19, 0.31), "d": (0.78, 0.42, 0.19, 0.31),
        "title": (0.25, 0.10, 0.50, 0.20), "l1": (0.25, 0.34, 0.50, 0.12), "r1": (0.25, 0.49, 0.50, 0.12),
        "e": (0.24, 0.64, 0.09, 0.10), "f": (0.67, 0.64, 0.09, 0.10),
    },
    "pop_title": {
        "tag": (0.12, 0.20, 0.76, 0.04), "title": (0.12, 0.26, 0.76, 0.26), "l1": (0.12, 0.56, 0.76, 0.14),
    },
    # Whiteboard Hero: Stickman character on one side, clean doodle annotation/arrow on the other
    "whiteboard_hero": {
        "tag": (0.06, 0.07, 0.45, 0.04), "title": (0.06, 0.12, 0.45, 0.22),
        "center": (0.08, 0.36, 0.42, 0.40), "r1": (0.55, 0.22, 0.38, 0.46),
    },
    "napkin_math": {
        "tag": (0.06, 0.07, 0.88, 0.04), "title": (0.06, 0.12, 0.88, 0.12),
        "left": (0.08, 0.28, 0.40, 0.48), "right": (0.52, 0.28, 0.40, 0.48),
    },
}
LAYOUTS_9_16 = {
    "whiteboard_hero": {
        "tag": (0.07, 0.07, 0.86, 0.03), "title": (0.07, 0.105, 0.86, 0.12),
        "center": (0.12, 0.24, 0.76, 0.26), "r1": (0.12, 0.52, 0.76, 0.16),
    },
    "napkin_math": {
        "tag": (0.07, 0.07, 0.86, 0.03), "title": (0.07, 0.105, 0.86, 0.12),
        "left": (0.10, 0.24, 0.80, 0.22), "right": (0.10, 0.48, 0.80, 0.22),
    },
    "row2": {
        "tag": (0.07, 0.07, 0.86, 0.03), "title": (0.07, 0.105, 0.86, 0.10),
        "a": (0.10, 0.23, 0.80, 0.21), "b": (0.10, 0.46, 0.80, 0.21),
    },
    "row3": {
        "tag": (0.07, 0.07, 0.86, 0.03), "title": (0.07, 0.105, 0.86, 0.10),
        "a": (0.18, 0.21, 0.64, 0.145), "b": (0.18, 0.37, 0.64, 0.145), "c": (0.18, 0.53, 0.64, 0.145),
    },
    "row4": {
        "tag": (0.07, 0.07, 0.86, 0.03), "title": (0.07, 0.105, 0.86, 0.09),
        "a": (0.04, 0.22, 0.44, 0.20), "b": (0.52, 0.22, 0.44, 0.20),
        "c": (0.04, 0.44, 0.44, 0.20), "d": (0.52, 0.44, 0.44, 0.20),
    },
    "retro_hero": {
        "tag": (0.07, 0.08, 0.86, 0.03), "title": (0.07, 0.12, 0.86, 0.12),
        "label": (0.07, 0.25, 0.86, 0.04), "center": (0.10, 0.31, 0.80, 0.37),
    },
    "flatlay": {
        "a": (0.03, 0.07, 0.34, 0.17), "b": (0.63, 0.07, 0.34, 0.17),
        "title": (0.08, 0.28, 0.84, 0.13), "l1": (0.08, 0.43, 0.84, 0.10),
        "c": (0.03, 0.56, 0.30, 0.12), "d": (0.67, 0.56, 0.30, 0.12),
    },
    "pop_title": {
        "tag": (0.08, 0.22, 0.84, 0.03), "title": (0.08, 0.27, 0.84, 0.20), "l1": (0.08, 0.50, 0.84, 0.10),
    },
}

# Recipes are TEMPLATES: core/auto_edit.py fills every name / text / cue from the voice line it is used for.
RECIPES = {
    "whiteboard_hero": {
        "use_for": ["hook", "person", "reveal"], "layout": "whiteboard_hero", "bg": "paper",
        "items": [
            {"type": "title", "text": "तनाव का *असर*", "at": "WORD"},
            {"type": "asset", "name": "st_stickman_stressed", "slot": "center", "at": "WORD", "enter": "pop"},
            {"type": "keyword", "text": "दबाव", "box": "doodle_circle", "slot": "r1", "at": "WORD"},
        ],
    },
    "story_scene": {
        "use_for": ["place", "person", "hook"], "layout": "retro_hero", "bg": "SCENE_BG",
        "items": [
            {"type": "title", "text": "मंज़िल की *तलाश*", "at": "WORD"},
            {"type": "asset", "name": "st_stickman_explorer", "slot": "center", "at": "WORD"},
            {"type": "keyword", "text": "सही रास्ता", "box": "note", "slot": "label", "at": "WORD"},
        ],
    },
    "reaction_bubble": {
        "use_for": ["person", "quote", "reveal"], "layout": "whiteboard_hero", "bg": "paper",
        "items": [
            {"type": "asset", "name": "st_stickman_reacting", "slot": "center", "at": "WORD", "enter": "pop"},
            {"type": "speech_bubble", "text": "सच में?", "slot": "r1", "at": "WORD"},
        ],
    },
    "napkin_compare": {
        "use_for": ["compare"], "layout": "napkin_math", "bg": "paper",
        "items": [
            {"type": "title", "text": "यह *या* वह", "at": "WORD"},
            {"type": "asset", "name": "st_side_a", "slot": "left", "label": "पहला", "at": "WORD"},
            {"type": "asset", "name": "st_side_b", "slot": "right", "label": "दूसरा", "at": "WORD"},
        ],
    },
    "row3_labels": {
        "use_for": ["list", "object"], "layout": "stickman.row3", "bg": "paper",
        "items": [
            {"type": "title", "text": "तीन *चीज़ें*", "at": "WORD"},
            {"type": "asset", "name": "st_item_1", "slot": "a", "label": "एक", "at": "WORD"},
            {"type": "asset", "name": "st_item_2", "slot": "b", "label": "दो", "at": "WORD"},
            {"type": "asset", "name": "st_item_3", "slot": "c", "label": "तीन", "at": "WORD"},
        ],
    },
    "row2_labels": {
        "use_for": ["compare", "object"], "layout": "stickman.row2", "bg": "paper",
        "items": [
            {"type": "asset", "name": "st_item_a", "slot": "a", "label": "पहले", "at": "WORD"},
            {"type": "asset", "name": "st_item_b", "slot": "b", "label": "अब", "at": "WORD"},
        ],
    },
    "number_hero": {
        "use_for": ["number"], "layout": "whiteboard_hero", "bg": "paper",
        "items": [
            {"type": "counter", "to": 35000, "slot": "title", "at": "WORD"},
            {"type": "asset", "name": "st_stickman_shocked", "slot": "center", "at": "WORD", "enter": "pop"},
            {"type": "keyword", "text": "हर दिन", "box": "marker", "slot": "r1", "at": "WORD"},
        ],
    },
    "pop_question": {
        "use_for": ["hook", "outro", "quote"], "layout": "stickman.pop_title", "bg": "paper", "camera": "still",
        "items": [
            {"type": "keyword", "text": "चाय का रहस्य", "box": "doodle_circle", "slot": "title", "at": "WORD"},
            {"type": "keyword", "text": "आगे देखो", "box": "note", "slot": "l1", "at": "WORD"},
        ],
    },
    "desk_moment": {
        "use_for": ["place", "object", "outro"], "layout": "retro_hero", "bg": "SCENE_BG",
        "items": [
            {"type": "title", "text": "रात भर *पढ़ाई*", "at": "WORD"},
            {"type": "asset", "name": "st_stickman_desk_study", "slot": "center", "at": "WORD"},
        ],
    },
}

EXAMPLES = [f"{k}: RECIPES['{k}'] ({', '.join(v['use_for'])})" for k, v in RECIPES.items()]

# ---- asset plan: 35% hand-drawn 2D scenes, 55% expressive stickman / prop cut-outs ---------------------
BEAT_S = 1.1
MIX = {"scene": 0.35, "asset": 0.55, "reuse": 0.02, "text": 0.08}

MENU = {
    "scene": ["hand-drawn 2D landscape (cliff over mountains, river rapids, desert path)",
              "muted indoor room (desk with notebooks, sunlit window, library, office)",
              "fork in the road with a wooden signpost", "historical setting drawn in cross-hatched ink (cave, fort, market)",
              "city street in muted slate tones", "a stage or podium the stickman stands on"],
    "asset": ["stickman showing an emotion (confused, stressed, triumphant, shocked, smirking)",
              "stickman doing one clear action (running, pointing, climbing, carrying, falling)",
              "stickman in era-appropriate clothing from world.characters",
              "stickman holding the hero prop of this line", "a single hero prop drawn in the same ink style",
              "symbol prop (lightbulb, clock, money stack, warning sign, question mark)",
              "doodle diagram (arrow, rising graph, scale, ladder)"],
}
ACCENTS = ["cobalt-blue hero colour", "marker-red hero colour", "amber hero colour"]

DESIGN = __doc__
