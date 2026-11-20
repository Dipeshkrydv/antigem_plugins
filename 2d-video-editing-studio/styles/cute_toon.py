# -*- coding: utf-8 -*-
"""[DEPRECATED / REMOVED] Cute toon storytelling (Discontinued to prevent AI multi-pose illusion and uncanny distortion).
Use the 5 core broadcast styles: vox_documentary, stickman_hybrid, suspense_crime, arcade, box.
or keep your documentary style and drop "character" items / "stage" scenes into chosen segments (the character
works in every style -- see CHARACTER_MODE.md).

WHAT MAKES IT WORK
  * ONE consistent character: a master image + pose library generated with the master as reference
  * the character ACTS on the words: lip-flaps on every spoken word, a gesture on the key word, a reaction on
    the surprise, a walk when the story moves to a new place
  * parallax stages (sky / far / mid / ground / foreground) with a camera that tracks the walk -- the world
    moves, not just a zoom on a still picture
  * soft natural contact shadows under feet and props; never hard-edged cut-out shadows
  * friendly rounded type, warm bright palette, captions on a solid plate

ESSENTIAL ELEMENTS
  character     the host (walk_in, talk, point, react, say -> speech bubble)
  stage         parallax world for travel / story beats
  keyword       sticky / tag / marker labels next to the character
  asset         flat illustrated props the character points at (soft shadow, pop entrance)

AVOID
  * the character in EVERY scene: give it ~20-35% of the runtime (intro, key explanations, reactions, outro)
  * talking-head-only scenes: when the host explains, show the thing too (presenter layout)
  * rubber stamps (the variety engine already prefers scrawl / tape / seal here)
"""

NAME = "toon"
ALIASES = ["cute", "cartoon", "character", "story", "cute_toon"]

_NEG = ("no text, no letters, no captions, no watermark, no logo, no signature, no UI, no borders, no frames, "
        "no split screen, no photorealism, no 3D render")

STYLE = {
    "look": {
        "bg": (250, 244, 232), "ink": (36, 32, 40), "muted": (124, 116, 120),
        "accent": (236, 92, 70), "accent2": (255, 196, 46), "accent3": (64, 140, 230),
        "panel": (255, 255, 255, 245),
        "stamp_color": (236, 92, 70), "string_color": (36, 32, 40),
        "caption": "plate", "asset_frame": "flat", "photo_frame": "retro",
        "label_style": "plain", "title_font": "round", "big_font": "round",
        "letterbox": 0.0, "grade": "eq=saturation=1.05", "grain": 0, "vignette": False,
        "transition": "whip", "camera": "drift", "paper": True,
        "kicker_prefix": "", "kicker_size": 48,
        "boxes": ["sticky", "tag", "marker", "pill", "note"],
        "variety_style": "toon",
    },
    "prompt": {
        "clarity": ("one clear readable subject, appealing rounded shapes, clean outline, warm bright harmonious colours, "
                    "soft simple background with clean negative space for a headline"),
        "medium": "cute 2D illustrated storybook scene, modern animated-series background art, soft cel shading",
        "lighting": "soft warm daylight, gentle shading, no harsh shadows",
        "palette": "warm cream, coral red, sunflower yellow, sky blue, leafy green",
        "camera": {"shot": "medium wide shot", "lens": "flat 2D illustration", "angle": "eye level", "movement": "slow pan"},
        "mood": "warm, curious, playful",
        "quality": "clean shapes, crisp outlines, appealing design, high detail where it matters",
        "negative": _NEG,
        "asset_medium": "cute flat 2D cartoon prop illustration with a clean dark outline and soft cel shading",
        "character_medium": ("cute, appealing 2D cartoon character illustration in a modern illustrated storytelling "
                             "style: clean confident dark outlines, big expressive eyes, rounded friendly shapes, "
                             "recognisable silhouette, flat colours with one soft cel-shade tone, appealing palette"),
    },
}

RECIPES = {
    # the host explains a fact beside the picture of it (the "Nepal is beautiful" beat)
    "presenter_explain": {
        "layout": "presenter", "bg": "SCENE_BG", "camera": "drift",
        "items": [
            {"type": "kicker", "text": "NEPAL // DID YOU KNOW"},
            {"type": "title", "text": "दुनिया की *8* सबसे ऊँची चोटियाँ"},
            {"type": "asset", "name": "ASSET", "slot": "left"},
            {"type": "character", "cast": "HOST", "enter": "walk_in",
             "actions": [{"at": "WORD_POINT", "do": "point"}, {"at": "WORD_WOW", "do": "react", "pose": "wow"}]},
        ],
    },
    # travel beat: the host walks through a parallax world, camera tracking
    "stage_walk": {
        "layout": "stage", "transition": "whip",
        "stage": {"layers": [{"src": "SKY", "depth": 0.04, "drift": 8}, {"src": "FAR", "depth": 0.18},
                             {"src": "MID", "depth": 0.55}, {"src": "GROUND", "depth": 1.0}],
                  "fg": [{"src": "FG", "depth": 1.45}], "track": "HOST", "particles": "petals"},
        "items": [
            {"type": "kicker", "text": "CHAPTER // THE JOURNEY"},
            {"type": "character", "cast": "HOST", "x": 0.25, "enter": "walk_in", "from": "left",
             "actions": [{"at": "WORD_GO", "do": "walk", "to": 1.6},
                         {"at": "WORD_STOP", "do": "look", "dir": "right"},
                         {"at": "WORD_LINE", "do": "say", "text": "BUBBLE TEXT", "until": "WORD_END"}]},
        ],
    },
    # reaction beat: big number + the host reacts to it
    "react_reveal": {
        "layout": "presenter_l", "bg": "paper",
        "items": [
            {"type": "kicker", "text": "THE NUMBER"},
            {"type": "counter", "from": 0, "to": 8848, "suffix": " m", "slot": "title"},
            {"type": "keyword", "text": "_सबसे ऊँचा_", "slot": "right"},
            {"type": "character", "cast": "HOST", "enter": "pop",
             "actions": [{"at": "WORD_NUMBER", "do": "react", "pose": "wow"}, {"at": "WORD_THINK", "do": "think"}]},
        ],
    },
}

EXAMPLES = [
    "host explains beside a picture: RECIPES['presenter_explain']",
    "walk through a parallax world: RECIPES['stage_walk']",
    "number reveal + reaction: RECIPES['react_reveal']",
]

BEAT_S = 1.2
MIX = {"scene": 0.25, "asset": 0.60, "reuse": 0.05, "text": 0.10}
MENU = {
    "scene": ["wide establishing world", "street / village scene", "landscape vista", "interior room", "close detail"],
    "asset": ["prop the host holds", "landmark", "food / object", "animal", "symbol / flag", "map piece", "tool"],
}
ACCENTS = ["one CORAL accent", "one SUNFLOWER-YELLOW accent", "one SKY-BLUE accent"]

DESIGN = __doc__
