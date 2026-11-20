# -*- coding: utf-8 -*-
"""Retro 8-Bit Arcade: the story told as a 16-bit console game.

IDENTITY
  The topic becomes a video game: chapters are STAGES, people are SPRITES, problems are BOSSES, numbers are SCORES
  and HP bars, decisions are dialogue boxes. Everything is authentic 16-bit era pixel art (the console generation
  after 8-bit): a visible pixel grid, a limited palette, dithered shading. The name says "8-bit" because that is
  what viewers call the look; the art standard is 16-bit so it stays rich and readable.

CANVAS
  Deep navy night #10101C behind full-frame pixel stages (side-scrolling levels, top-down maps, boss arenas).
  CRT finishing: soft scanlines and a slight vignette (the renderer's grade + vignette).

PALETTE (limited, like a real console)
  navy #10101C base · arcade gold #FFD700 (score, coins, titles) · retro cyan #00E1FF (UI, player) ·
  arcade crimson #FF325F (danger, boss, damage). At most these three accents plus the sprites' own palette.

TYPOGRAPHY
  Monospaced bold (Space Mono) in UPPERCASE for HUD text: "STAGE 2", "HP", "SCORE 35000", "GAME OVER".
  Dialogue in the double-bordered RPG box (`rpg` keyword treatment), max 6 words. Titles 1 to 4 words.

IMAGE LANGUAGE (what Flow must draw)
  16-bit pixel art with a consistent pixel size, hard pixel edges, no anti-aliasing, dithered shadows.
  Scenes: side-scrolling level backdrops or 3/4 top-down maps of the story's place and era.
  Cut-outs: one character sprite or one item sprite (coin, chest, potion, sword, key, flag) on magenta.

COMPOSITION
  HUD discipline: title / stage name top-left, score or counter top-right, the sprite in the middle third,
  the dialogue box across the lower-middle (always above the caption band).

MOTION
  Game feel: pop with a hard settle, slide in from the side like a scrolling level, whip transitions between
  stages, snap cuts. Camera: horizontal drift (side-scroll) or still. Never smooth cinematic zooms on sprites.

SIGNATURE MOVES
  title screen · stage card · boss reveal · RPG dialogue · loot / item card · score counter · level map · game over / continue

AVOID
  smooth digital painting, 3D, photographs, blurry upscaled pixels, mixed pixel sizes, neon gradients, more than
  three UI accent colours, real game characters, logos or trademarks.
"""

NAME = "arcade"
LABEL = "Retro 8-Bit Arcade"
ALIASES = ["8bit", "retro", "pixel", "retro_arcade", "retro_8bit", "arcade_8bit"]

PALETTE = {
    "canvas":  {"hex": "#10101C", "use": "night-navy base behind stages"},
    "ink":     {"hex": "#F5F5FA", "use": "HUD text"},
    "muted":   {"hex": "#8C8CAA", "use": "secondary HUD text"},
    "accent1": {"hex": "#FFD700", "use": "arcade gold: titles, score, coins"},
    "accent2": {"hex": "#00E1FF", "use": "retro cyan: UI frames, the player"},
    "accent3": {"hex": "#FF325F", "use": "arcade crimson: danger, boss, damage"},
    "stamp":   {"hex": "#FF325F", "use": "GAME OVER / BOSS stamps"},
    "string":  {"hex": "#FFD700", "use": "paths on the level map"},
    "panel":   {"hex": "#18142A", "alpha": 235, "use": "dialogue boxes"},
    "rule":    "max three UI accents (gold, cyan, crimson); the sprites keep their own palette",
}

TYPE = {
    "title": "mono", "label": "mono", "number": "mono", "caption": "mono",
    "max_words": {"title": 4, "label": 3, "keyword": 6},
    "boxes": ["rpg", "neon", "label", "outline"],
    "case": "upper",
}

MOTION = {
    "entrances": ["pop", "slide", "snap", "drop"],
    "camera": ["drift", "pan_right", "still"],
    "transitions": ["whip", "cut", "flash"],
    "never": ["smooth_zoom on sprites", "blur", "shake loops"],
}

_NEG = ("no photograph, no photorealism, no 3D render, no smooth digital painting, no soft brush strokes, "
        "no anti-aliased edges, no blur, no mixed pixel sizes, no text, no letters, no numbers, no captions, "
        "no watermark, no logo, no trademarked game characters, no UI")

STYLE = {
    "look": {
        "caption": "box", "asset_frame": "clean", "photo_frame": "card",
        "pixel": True,                      # renderer scales sprites with nearest-neighbour (crisp pixels)
        "letterbox": 0.0, "grade": "eq=contrast=1.12:saturation=1.15",
        "grain": 0, "vignette": True, "transition": "whip", "camera": "drift",
        "kicker_prefix": "STAGE", "title_font": "mono", "big_font": "mono", "number_font": "mono",
        "label_style": "pill",
        "boxes": ["rpg", "neon", "label", "outline"],
    },
    "prompt": {
        "lock": ("authentic 16-bit console era pixel art, one consistent pixel size across the whole image, hard pixel edges, "
                 "no anti-aliasing, dithered shading, limited palette of deep navy, arcade gold, retro cyan and crimson "
                 "plus the subject's own colours, same sprite proportions and pixel scale in every image"),
        "clarity": ("ONE readable game moment: a clear sprite silhouette or a clear level backdrop, the story's subject turned "
                    "into a game element, dark empty sky area for a HUD title"),
        "medium": "16-bit retro video game pixel art",
        "lighting": "pixel-art lighting: flat colour bands with dithered shadows and a bright rim on the sprite",
        "palette": "deep navy background, arcade gold, retro cyan and crimson accents, rich but limited 16-bit palette",
        "camera": {"shot": "side-scrolling level view", "lens": "orthographic 2D game camera", "angle": "straight side view",
                   "movement": "horizontal side-scroll"},
        "mood": "adventurous, playful, nostalgic, a challenge to beat",
        "quality": "crisp pixel grid, clean dithering, consistent pixel scale, high legibility",
        "negative": _NEG,
        "asset_medium": ("isolated 16-bit pixel art sprite of a single character or item, hard pixel edges, "
                         "consistent pixel size, no anti-aliasing"),
    },
}

CENTERED = {"title_screen", "game_over"}

LAYOUTS_16_9 = {
    "boss_stage": {
        "tag": (0.06, 0.07, 0.44, 0.05), "title": (0.06, 0.14, 0.44, 0.28),
        "label": (0.06, 0.46, 0.40, 0.08), "center": (0.52, 0.10, 0.44, 0.65),
    },
    "rpg_dialogue": {
        "tag": (0.06, 0.07, 0.20, 0.04),
        "center": (0.28, 0.10, 0.44, 0.44),
        "label": (0.10, 0.56, 0.80, 0.19),
    },
    "loot_card": {
        "tag": (0.06, 0.07, 0.88, 0.05), "title": (0.06, 0.13, 0.88, 0.14),
        "a": (0.10, 0.30, 0.35, 0.44), "b": (0.55, 0.30, 0.35, 0.44),
    },
    # big centred title, PRESS START line under it
    "title_screen": {
        "tag": (0.20, 0.12, 0.60, 0.05), "title": (0.12, 0.20, 0.76, 0.30),
        "label": (0.30, 0.56, 0.40, 0.08),
    },
    # HUD: stage name top-left, big score top-right, sprite in the middle
    "hud_score": {
        "tag": (0.05, 0.06, 0.40, 0.05), "stamp": (0.62, 0.05, 0.33, 0.12),
        "center": (0.30, 0.20, 0.40, 0.54), "l1": (0.05, 0.40, 0.22, 0.10),
    },
    # level map: wide map with a path, stage label
    "level_map": {
        "tag": (0.05, 0.06, 0.40, 0.05), "center": (0.08, 0.13, 0.84, 0.60),
    },
    "game_over": {
        "title": (0.12, 0.22, 0.76, 0.28), "label": (0.25, 0.54, 0.50, 0.09),
    },
}

LAYOUTS_9_16 = {
    "boss_stage": {
        "tag": (0.08, 0.08, 0.84, 0.04), "title": (0.08, 0.13, 0.84, 0.12),
        "center": (0.10, 0.26, 0.80, 0.36), "label": (0.08, 0.63, 0.84, 0.05),
    },
    "rpg_dialogue": {
        "tag": (0.08, 0.08, 0.84, 0.04),
        "center": (0.15, 0.14, 0.70, 0.34),
        "label": (0.08, 0.50, 0.84, 0.18),
    },
    "loot_card": {
        "tag": (0.08, 0.08, 0.84, 0.04), "title": (0.08, 0.13, 0.84, 0.12),
        "a": (0.12, 0.26, 0.76, 0.20), "b": (0.12, 0.48, 0.76, 0.20),
    },
    "title_screen": {
        "tag": (0.10, 0.20, 0.80, 0.04), "title": (0.08, 0.25, 0.84, 0.22), "label": (0.20, 0.50, 0.60, 0.06),
    },
    "hud_score": {
        "tag": (0.07, 0.07, 0.86, 0.03), "stamp": (0.20, 0.11, 0.60, 0.07),
        "center": (0.12, 0.20, 0.76, 0.38), "l1": (0.07, 0.60, 0.86, 0.06),
    },
    "level_map": {
        "tag": (0.07, 0.07, 0.86, 0.03), "center": (0.05, 0.12, 0.90, 0.54),
    },
    "game_over": {
        "title": (0.08, 0.26, 0.84, 0.20), "label": (0.15, 0.50, 0.70, 0.07),
    },
}

# Recipes are TEMPLATES: core/auto_edit.py fills every name / text / cue from the voice line it is used for.
RECIPES = {
    "title_screen": {
        "use_for": ["hook"], "layout": "title_screen", "bg": "SCENE_BG", "camera": "still", "transition": "cut",
        "items": [
            {"type": "title", "text": "THE *QUEST*", "at": "WORD"},
            {"type": "keyword", "text": "PRESS START", "box": "neon", "slot": "label", "at": "WORD"},
        ],
    },
    "stage_card": {
        "use_for": ["place", "hook"], "layout": "boss_stage", "bg": "SCENE_BG",
        "items": [
            {"type": "title", "text": "STAGE *1*", "at": "WORD"},
            {"type": "asset", "name": "SPRITE_HERO", "slot": "center", "at": "WORD", "enter": "slide"},
        ],
    },
    "boss_reveal": {
        "use_for": ["reveal", "person", "object"], "layout": "boss_stage", "bg": "SCENE_BG",
        "items": [
            {"type": "title", "text": "*BOSS* FIGHT", "at": "WORD"},
            {"type": "asset", "name": "SPRITE_BOSS", "slot": "center", "at": "WORD", "enter": "drop"},
            {"type": "keyword", "text": "HP 999", "box": "label", "slot": "label", "at": "WORD"},
        ],
    },
    "rpg_dialogue": {
        "use_for": ["quote", "person"], "layout": "rpg_dialogue", "bg": "SCENE_BG",
        "items": [
            {"type": "asset", "name": "SPRITE_SPEAKER", "slot": "center", "at": "WORD", "enter": "pop"},
            {"type": "keyword", "text": "WHO GOES THERE?", "box": "rpg", "slot": "label", "at": "WORD"},
        ],
    },
    "loot_compare": {
        "use_for": ["compare", "object"], "layout": "loot_card", "bg": "SCENE_BG",
        "items": [
            {"type": "title", "text": "CHOOSE *ONE*", "at": "WORD"},
            {"type": "asset", "name": "ITEM_A", "slot": "a", "label": "ITEM A", "at": "WORD", "enter": "pop"},
            {"type": "asset", "name": "ITEM_B", "slot": "b", "label": "ITEM B", "at": "WORD", "enter": "pop"},
        ],
    },
    "score_counter": {
        "use_for": ["number"], "layout": "hud_score", "bg": "SCENE_BG",
        "items": [
            {"type": "counter", "to": 35000, "prefix": "SCORE ", "slot": "stamp", "at": "WORD"},
            {"type": "asset", "name": "SPRITE_HERO", "slot": "center", "at": "WORD", "enter": "pop"},
        ],
    },
    "level_map": {
        "use_for": ["place", "list"], "layout": "level_map", "bg": "SCENE_BG",
        "items": [
            {"type": "kicker", "text": "WORLD MAP"},
            {"type": "photo", "src": "MAP_SCENE", "slot": "center", "frame": "card", "at": "WORD"},
        ],
    },
    "power_up": {
        "use_for": ["object", "list"], "layout": "boss_stage", "bg": "SCENE_BG",
        "items": [
            {"type": "title", "text": "POWER *UP*", "at": "WORD"},
            {"type": "asset", "name": "ITEM_POWER", "slot": "center", "at": "WORD", "enter": "pop"},
        ],
    },
    "game_over": {
        "use_for": ["outro"], "layout": "game_over", "bg": "SCENE_BG", "camera": "still",
        "items": [
            {"type": "title", "text": "GAME *OVER*", "at": "WORD"},
            {"type": "keyword", "text": "CONTINUE?", "box": "neon", "slot": "label", "at": "WORD"},
        ],
    },
}

EXAMPLES = [f"{k}: RECIPES['{k}'] ({', '.join(v['use_for'])})" for k, v in RECIPES.items()]

BEAT_S = 1.2
MIX = {"scene": 0.55, "asset": 0.35, "reuse": 0.05, "text": 0.05}
MENU = {
    "scene": ["side-scrolling level backdrop of the story's place", "top-down 3/4 world map with a path",
              "boss arena", "dungeon or cave level", "pixel city street level", "pixel interior room (throne room, lab, office)",
              "title-screen sky with a distant landmark"],
    "asset": ["hero sprite (the main person as a game character)", "boss sprite (the problem / rival)", "NPC sprite (a witness, a helper)",
              "item sprite: coin / chest / key / potion", "weapon or tool sprite", "vehicle sprite", "flag / emblem sprite"],
}
ACCENTS = ["arcade-gold accent", "retro-cyan accent", "arcade-crimson accent"]

DESIGN = __doc__
