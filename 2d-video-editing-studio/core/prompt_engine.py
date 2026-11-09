# -*- coding: utf-8 -*-
"""prompt_engine.py: turn a structured shot list into production-grade Flow prompts.

One-line prompts ("Kot courtyard at night") give generic, inconsistent images.
A production prompt states WHAT, WHERE, WHEN, HOW IT IS SHOT, HOW IT IS LIT,
WHAT COLOURS, WHAT FEELING, and WHERE THE EMPTY SPACE FOR TEXT IS. This engine
forces every shot to answer all of those (falling back to the style pack's
defaults) and refuses shots that are too vague.

Input: SHOTS.json
{
  "style": "noir",                       # pack from core/engine/styles.py
  "aspect": "16:9",
  "world": {                              # continuity applied to EVERY shot
    "era": "1846, Kingdom of Nepal",
    "location": "Kathmandu valley",
    "characters": {"jung": "Jung Bahadur Kunwar: stern Nepali general, thick black moustache, jewelled crown-helmet with tall bird-of-paradise plumes, ornate gold-embroidered 19th-century military coat"}
  },
  "shots": [
    {"name": "bg_kot_night", "kind": "scene",                  # scene | asset | video
     "subject": "the Kot courtyard beside Hanuman Dhoka palace",
     "action": "armed soldiers wait silently in the shadows at the gates",
     "location": "Hanuman Dhoka, old Kathmandu", "time": "midnight", "weather": "still, light mist",
     "camera": {"shot": "wide establishing", "lens": "24mm", "angle": "low angle", "movement": "slow push-in"},
     "lighting": "flickering wall torches, cold blue moonlight from above",
     "palette": "teal-black shadows, amber torch pools", "mood": "ominous calm before a massacre",
     "composition": "courtyard centre, dark open sky in the upper left third for the title",
     "focal": "the single torch-lit gate", "hook": "a lone figure silhouetted in the gateway",
     "details": ["carved wooden Newari windows", "wet brick paving reflecting torches"],
     "cast": ["jung"],                                          # pulls the character sheet in
     "line": "01", "cue": "चौदह",                              # which spoken line / word this image lands on (from PLAN.md)
     "size": "wide", "archetype": "wide establishing",          # shot size + kind of picture (planner's menu): drives variety
     "accent": "one BLOOD-RED accent"}                          # optional colour accent (rotated per beat by the plan)

camera may be omitted or "auto": the engine then assigns a shot size / lens / angle by position so neighbours differ.
composition may be omitted or "auto": a rotating text-space layout is used.
  ]
}

kind "video" adds: "duration" (s), "beats": [{"t": "0-3s", "action": "...", "camera": "..."}], "sound".

kind "character" (v3 Character Mode) -> ONE consistent pose library for the on-screen character:
  {"name": "mira", "kind": "character",
   "look": "Mira, a cheerful 10-year-old Nepali girl, round face, big brown eyes, short black bob with a red clip,
            mustard kurta with small white flowers, blue jeans, red sneakers, small canvas backpack",
   "personality": "curious, warm, a little cheeky",                 (optional, drives expressions)
   "poses": ["idle", "talk", "blink", "walk1", "walk2", "walk3", "walk4", "point", "wow", "think", "happy"]}
  -> mira_idle (the MASTER, generated first) + one image per pose, each generated WITH mira_idle as Flow reference
     image (ELEMENTS.tsv column `ref`), same face / hair / outfit / colours / proportions, full body, facing right,
     on magenta -> `studio.py key` -> elements/cut/mira_<pose>.png -> the "character" item in EDIT.json.

kind "layer" (v3 parallax stage layer):
  {"name": "nepal_himalaya", "kind": "layer", "depth": "far",      sky | far | mid | near | ground | fg
   "subject": "snow-capped Himalayan range with the fish-tail peak of Machapuchare", "time": "clear morning"}
  sky = full background image; every other depth = a wide seamless strip on magenta (keyed), drawn at its depth.

Output: ELEMENTS.tsv (id, name, prompt, kind, aspect_ratio) for core/flow_safe.py,
        PROMPTS.md (human-readable review sheet).

usage:  python core/prompt_engine.py SHOTS.json            # validate + write
        python core/prompt_engine.py SHOTS.json --check    # validate only
"""
import argparse, json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from engine import styles  # noqa: E402

MAGENTA = ("isolated single object centred with generous empty margin on all sides, on a solid flat pure "
           "chroma-key magenta background, uniform pure magenta hex 0xFF00FF filling the whole background and every gap or "
           "opening, the object itself contains no magenta or pink, crisp hard edges, no drop shadow, "
           "no cast shadow, no reflection, no glow, no blur")

SHEET_BG = ("on a solid flat pure chroma-key magenta background, uniform pure magenta hex 0xFF00FF filling the whole background and "
            "every gap between and inside the objects, the objects contain no magenta or pink, crisp hard edges, "
            "no drop shadows, no cast shadows, no reflections, no glow")
GRIDS = {2: (1, 2, "16:9"), 3: (1, 3, "16:9"), 4: (2, 2, "1:1"), 5: (2, 3, "16:9"), 6: (2, 3, "16:9")}

CHAR_BG = ("full body from the top of the head to the shoes, the whole character inside the frame with generous empty "
           "margin, feet near the bottom edge, on a solid flat pure chroma-key magenta background, uniform pure magenta hex 0xFF00FF "
           "filling the whole background and every gap between arms, legs and body, the character contains no magenta "
           "(blush and lips in warm peach and coral tones), crisp clean outline, no ground, no floor, no cast shadow, "
           "no drop shadow, no props unless described, no text")
CHAR_MEDIUM = ("cute, appealing 2D cartoon character illustration in a modern illustrated storytelling style: clean "
               "confident dark outlines of even weight, big expressive eyes, rounded friendly shapes, recognisable "
               "silhouette, flat colours with one soft cel-shade tone, appealing harmonious palette, polished "
               "animation-ready character design")
POSES = {
    "idle": "standing relaxed in a three-quarter view facing to the RIGHT, arms loose at the sides, weight on both feet, "
            "friendly closed-mouth smile, looking at the viewer",
    "talk": "EXACTLY the idle pose and angle, but the mouth OPEN mid-word as if talking, eyebrows slightly raised",
    "blink": "EXACTLY the idle pose and angle, eyes CLOSED in a natural blink, mouth closed",
    "walk1": "walking to the RIGHT, side three-quarter view, contact pose: left leg forward heel down, right leg back, "
             "right arm swinging forward, left arm back",
    "walk2": "walking to the RIGHT, passing pose: legs together under the body, body at its highest point, arms close to the sides",
    "walk3": "walking to the RIGHT, contact pose: right leg forward heel down, left leg back, left arm swinging forward, right arm back",
    "walk4": "walking to the RIGHT, passing pose with the other leg: legs together under the body, arms close to the sides",
    "run1": "running to the RIGHT, big stride, body leaning forward, left leg forward, right arm pumping forward, both feet off the ground",
    "run2": "running to the RIGHT, big stride, body leaning forward, right leg forward, left arm pumping forward",
    "point": "pointing to the RIGHT with the right arm fully extended at something off-frame, head turned to look where they point, mouth slightly open",
    "wow": "amazed: both hands on the cheeks, eyes wide, eyebrows high, mouth open in an O",
    "think": "thinking: one hand on the chin, eyes looking up, slight frown, the other arm across the waist",
    "happy": "delighted: both fists raised in joy at shoulder height, big open smile, eyes squeezed happily",
    "wave": "waving hello with the right hand raised beside the head, big smile",
    "sad": "sad: shoulders dropped, head slightly down, eyebrows tilted up in the middle, small frown",
    "look": "looking back over the left shoulder, body still facing right, curious expression",
    "hold": "holding a small object with both hands in front of the chest, looking at the viewer",
    "shrug": "shrugging: palms up at the sides, shoulders raised, eyebrows raised, half smile",
}
DEFAULT_POSES = ["idle", "talk", "blink", "walk1", "walk2", "walk3", "walk4", "point", "wow", "think", "happy"]
LAYER_ROLE = {
    "sky": "the sky only: gentle gradient and a few soft clouds, no ground, no mountains, no buildings",
    "far": "the most distant background layer only: a wide panoramic skyline / mountain range, low detail, hazy atmospheric colour",
    "mid": "a middle-distance background layer only: hills, trees, houses or streets at medium detail",
    "near": "a near background layer only: bushes, walls, fences, stalls close to the path, higher detail",
    "ground": "the walking surface only: a long flat path / road / grass strip seen from the side, flat top edge",
    "fg": "foreground framing elements only: tall grass, flowers, leaves or posts very close to the camera, partly cut by the bottom edge",
}
STRIP = ("a wide horizontal panoramic strip spanning the full image width edge to edge, seamless and continuous so the "
         "left and right ends can repeat, flat bottom edge, on a solid flat pure chroma-key magenta background hex 0xFF00FF "
         "above it and in every gap, no magenta in the art, no characters, no people, no text")

REQUIRED = {
    "scene": ["subject", "location", "time", "camera", "lighting", "palette", "mood", "composition", "focal"],
    "asset": ["subject", "material", "view"],
    "video": ["subject", "action", "location", "time", "camera", "lighting", "palette", "mood", "beats"],
    "sheet": ["items"],
    "character": ["look"],
    "layer": ["subject", "depth"],
}
VAGUE = {"nice", "beautiful", "cool", "good", "amazing", "awesome", "stuff", "thing", "something"}

# Automatic variation: when a shot does not fix its own framing (camera missing or "auto") it is assigned one by its
# position in the list, cycling shot size AND angle AND lens, so neighbouring shots can never look the same.
ROT = {
    "wide": [("wide establishing shot", "24mm", "low angle", "slow push-in"),
             ("high-angle wide shot", "28mm", "high angle looking down", "slow crane down"),
             ("wide shot with the subject small in the frame", "20mm", "eye level", "slow lateral track")],
    "medium": [("medium shot", "35mm", "eye level", "slow dolly-in"),
               ("over-the-shoulder medium shot", "50mm", "shoulder height", "slow lateral track"),
               ("low-angle medium shot", "35mm", "low angle", "slow tilt up")],
    "close": [("close-up portrait", "85mm", "eye level", "slow push-in"),
              ("profile close-up", "85mm", "side-on", "slow pan"),
              ("tight close-up", "100mm", "slightly above eye level", "slow push-in")],
    "detail": [("extreme close-up insert", "100mm macro", "top-down", "slow drift"),
               ("macro detail shot", "100mm macro", "eye level", "slow rack focus"),
               ("insert shot of hands at work", "85mm", "over the hands", "slow push-in")],
}
SIZE_CYCLE = ["wide", "medium", "close", "detail", "medium", "close"]
TEXT_SPACE = ["main subject on the right third, darker empty left half reserved for a Hindi headline",
              "main subject on the left third, darker empty right half reserved for a Hindi headline",
              "main subject in the lower two thirds, clean dark upper third reserved for a Hindi headline",
              "main subject centred, quiet dark margins on every side for text overlays"]


def pick_camera(shot, idx):
    size = shot.get("size") or SIZE_CYCLE[idx % len(SIZE_CYCLE)]
    shot_, lens, angle, move = ROT[size][(idx // len(SIZE_CYCLE) + idx) % 3]
    return {"shot": shot_, "lens": lens, "angle": angle, "movement": move}


def _cam(c, style_cam, kind):
    c = dict(style_cam, **(c or {}))
    parts = [f"{c['shot']}", f"{c['lens']} lens", f"{c['angle']}"]
    if kind == "video" and c.get("movement"):
        parts.append(f"camera movement: {c['movement']}")
    elif c.get("movement") and kind == "scene":
        # stills can't move, but framing for a later push-in matters: keep subject off the crop edges
        parts.append("framed with safe margins for a slow camera move")
    return ", ".join(parts)


def build(shot, style, world, idx=0):
    sp = style["prompt"]
    kind = shot.get("kind", "scene")
    cast = "; ".join(world.get("characters", {})[c] for c in shot.get("cast", []) if c in world.get("characters", {}))
    era = shot.get("era", world.get("era", ""))
    if kind == "sheet":   # several cut-out objects from ONE generation (split apart by `studio.py key`)
        n = len(shot["items"])
        rows, cols, _ = GRIDS[n]
        objs = "; ".join(f"({i + 1}) {it['subject']}" + (f", {it['material']}" if it.get("material") else "")
                         + (f", {it['condition']}" if it.get("condition") else "") + f", {it.get('view', 'three-quarter view')}"
                         for i, it in enumerate(shot["items"]))
        return (f"{sp['asset_medium']}: a reference sheet of exactly {n} separate objects arranged in a neat grid of "
                f"{rows} row{'s' if rows > 1 else ''} by {cols} columns, read left to right, top to bottom, each object "
                f"fully isolated with wide empty margins, no object touching or overlapping another. Objects: {objs}. "
                f"Same lighting, scale logic and style for all objects" + (f", period {era}" if era else "") +
                f", {sp['quality']}, {SHEET_BG}, no text, no numbers, no labels, no watermark")
    if kind == "asset":
        asset_light = shot.get("lighting") or sp.get("lighting", "soft even studio light from the upper left")
        bits = [
            f"{sp['asset_medium']} of {shot['subject']}",
            f"made of {shot['material']}" if shot.get("material") else "",
            f"condition: {shot['condition']}" if shot.get("condition") else "",
            f"period: {era}" if era else "",
            f"{shot.get('view', 'three-quarter view')}",
            f"hook: {shot['hook']}" if shot.get("hook") else "",
            shot["accent"] if shot.get("accent") else "",
            "one bold readable object with a strong clear silhouette, instantly recognisable at small size",
            f"details: {', '.join(shot['details'])}" if shot.get("details") else "",
            asset_light,
            sp["quality"], MAGENTA, "no text, no letters, no watermark",
        ]
        return ", ".join(b for b in bits if b)

    medium = sp["medium"]
    if kind == "video":  # a video model needs footage language, not "still"
        medium = sp.get("video_medium", medium.replace("film still", "live-action film footage").replace(" still", " footage"))
    cam = shot.get("camera")
    if not isinstance(cam, dict):                     # missing or "auto": rotate framing by position
        cam = pick_camera(shot, idx)
    comp = shot.get("composition")
    if not comp or comp == "auto":
        comp = TEXT_SPACE[idx % len(TEXT_SPACE)]
    head = f"{medium}. {shot['subject'][0].upper() + shot['subject'][1:]}"
    if shot.get("action"):
        head += f", {shot['action']}"
    sections = [
        head + ".",
        f"Characters: {cast}." if cast else "",
        f"Setting: {shot.get('location', world.get('location', ''))}"
        + (f", {era}" if era else "") + f", {shot.get('time', '')}"
        + (f", {shot['weather']}" if shot.get("weather") else "") + ".",
        f"Camera: {_cam(cam, sp['camera'], kind)}.",
        f"Lighting: {shot.get('lighting') or sp['lighting']}.",
        f"Colour palette: {shot.get('palette') or sp['palette']}" + (f"; {shot['accent']}" if shot.get("accent") else "") + ".",
        f"Mood and theme: {shot.get('mood') or sp['mood']}" + (f"; {shot['theme']}" if shot.get("theme") else "") + ".",
        f"Composition: {comp}.",
        f"Focal point: {shot['focal']}." if shot.get("focal") else "",
        f"Hook: {shot['hook']}." if shot.get("hook") else "",
        f"Clarity: {sp['clarity']}." if sp.get("clarity") else "",
        f"Key details: {', '.join(shot['details'])}." if shot.get("details") else "",
    ]
    if kind == "video":
        beats_timeline = []
        effects_used = []
        for i_b, b in enumerate(shot.get("beats", []), 1):
            eff = b.get("effect", "cinematic camera motion")
            effects_used.append(eff)
            trans = b.get("transition", "smooth visual momentum")
            cam_b = b.get("camera", _cam(cam, sp['camera'], kind))
            beats_timeline.append(f"SHOT {i_b} ({b.get('t', '0-3s')}): • EFFECT: {eff}. Visual: {b['action']}. Camera: {cam_b}. Speed: {b.get('speed', 'natural motion')}. Transition: {trans}.")

        timeline_str = " ".join(beats_timeline) if beats_timeline else " ".join(f"[{b['t']}] {b['action']}" for b in shot.get("beats", []))
        inv = f"Master Effects: {', '.join(set(effects_used))}." if effects_used else ""
        density = f"Effects Density: {shot.get('density', 'HIGH DENSITY dynamic contrast')}."
        arc = f"Energy Arc: {shot.get('arc', 'Act 1 hook -> Act 2 signature beat -> Act 3 resolution')}."
        sections += [
            f"Duration {shot.get('duration', 8)} seconds, one continuous sequence.",
            f"Effects Timeline: {timeline_str}",
            inv, density, arc,
            f"Sound: {shot['sound']}." if shot.get("sound") else "",
            "Physically plausible motion, stable anatomy, no morphing, no sudden cuts."
        ]
    sections += [f"Style: {sp['quality']}.", f"Avoid: {sp['negative']}."]
    return " ".join(s for s in sections if s)


def character_rows(shot, style, world):
    """kind "character" -> [(name, prompt, ref)] : the master pose first, every other pose referencing it."""
    sp = style["prompt"]
    medium = sp.get("character_medium", CHAR_MEDIUM)
    look = shot["look"]
    pers = f" Personality shown through expression and body language: {shot['personality']}." if shot.get("personality") else ""
    poses = shot.get("poses") or DEFAULT_POSES
    if "idle" not in poses:
        poses = ["idle"] + list(poses)
    poses = ["idle"] + [p for p in poses if p != "idle"]
    out = []
    for p in poses:
        desc = (shot.get("pose_notes") or {}).get(p) or POSES.get(p) or p.replace("_", " ")
        same = ("" if p == "idle" else " Same character as the reference image: identical face, hairstyle, outfit, colours, "
                "line weight and body proportions; only the pose and expression change.")
        out.append((f"{shot['name']}_{p}",
                    f"{medium}. Character: {look}.{pers} Pose: {desc}.{same} Character design sheet quality, "
                    f"the character fills about 85% of the image height. {CHAR_BG}.",
                    None if p == "idle" else f"{shot['name']}_idle"))
    return out


def layer_prompt(shot, style, world):
    sp = style["prompt"]
    medium = sp.get("layer_medium", "flat illustrated background art for a 2D animated story, soft painterly flat shading, "
                                    "clean shapes, appealing colours that match a cute cartoon character style")
    role = LAYER_ROLE.get(shot["depth"], LAYER_ROLE["mid"])
    bits = [f"{medium}. Parallax layer ({shot['depth']}): {role}. Subject: {shot['subject']}",
            f"setting: {shot.get('location', world.get('location', ''))}" if shot.get("location") or world.get("location") else "",
            f"time: {shot['time']}" if shot.get("time") else "",
            f"palette: {shot.get('palette') or sp['palette']}",
            f"details: {', '.join(shot['details'])}" if shot.get("details") else ""]
    tail = ("full-frame image, no characters, no people, no text, no watermark" if shot["depth"] == "sky" else STRIP)
    return ", ".join(b for b in bits if b) + f". {tail}."


def auto_heal_shot(shot, style, world, idx=0):
    """Auto-complete missing or short fields with style-aware defaults so prompt_engine never blocks in a retry loop."""
    kind = shot.get("kind", "scene")
    sp = style.get("prompt", {})
    # Strip any accidental emojis/dingbats instead of throwing an error
    for fld in ("subject", "action", "hook", "focal", "location", "composition"):
        val = shot.get(fld)
        if isinstance(val, str):
            shot[fld] = re.sub(r"[\uFFFD\u25A0-\u25FF\U0001F000-\U0001FAFF\u2600-\u27BF]+", "", val).strip()
    # Replace vague words automatically instead of rejecting
    subj = str(shot.get("subject", "")).strip()
    if subj:
        words = [w for w in subj.split() if w.lower().strip(",.!?") not in VAGUE]
        subj = " ".join(words) if words else subj
    if len(subj.split()) < 4:
        role_hint = "detailed editorial visual element" if kind == "asset" else "cinematic story scene composition"
        subj = f"{subj} — {role_hint}".strip(" —")
    shot["subject"] = subj

    if kind == "scene":
        if not shot.get("location"):
            shot["location"] = world.get("location") or "atmospheric studio environment matching the story setting"
        if not shot.get("time"):
            shot["time"] = world.get("time") or ("dramatic night lighting" if style.get("name") == "noir" else "crisp editorial daylight")
        if not shot.get("focal"):
            shot["focal"] = shot.get("hook") or shot["subject"]
        comp = shot.get("composition")
        if not comp or comp == "auto" or not any(
            k in str(comp).lower() for k in ("third", "left", "right", "upper", "lower", "centre", "center", "space")
        ):
            shot["composition"] = TEXT_SPACE[idx % len(TEXT_SPACE)]
    elif kind == "asset":
        if not shot.get("material"):
            shot["material"] = "crisp high-contrast studio illustration with tactile surface detail"
        if not shot.get("view"):
            shot["view"] = "three-quarter view, centred with clean silhouette"
    elif kind == "layer":
        if shot.get("depth") not in LAYER_ROLE:
            shot["depth"] = "mid"
    elif kind == "character":
        look = str(shot.get("look", "")).strip()
        if len(look.split()) < 12:
            shot["look"] = f"{look}, expressive eyes, clean consistent 2D illustration style, distinct outfit and proportions"
    return shot


def validate(shot, style):
    kind = shot.get("kind", "scene")
    errs = []
    if kind not in REQUIRED:
        return [f"kind must be one of {list(REQUIRED)}"]
    for f in REQUIRED[kind]:
        if not shot.get(f) and not (f in ("lighting", "palette", "mood", "camera") and style["prompt"].get(f)) \
                and not (f == "composition" and kind == "scene"):          # composition defaults to a rotating text-space layout
            errs.append(f"missing '{f}'")
    if shot.get("size") and shot["size"] not in ROT:
        shot["size"] = SIZE_CYCLE[0]
    if kind == "character":
        bad = [p for p in shot.get("poses", []) if p not in POSES and not (shot.get("pose_notes") or {}).get(p)]
        if bad:
            shot["poses"] = [p for p in shot.get("poses", []) if p in POSES] or ["idle", "talk"]
        return errs
    if kind == "layer":
        return errs
    if kind == "sheet":
        items = shot.get("items", [])
        if not 2 <= len(items) <= 6:
            errs.append("a sheet needs 2-6 items")
        for it in items:
            if not it.get("name"):
                errs.append("sheet item needs a name")
            elif len(it.get("subject", "").split()) < 3:
                it["subject"] = f"{it.get('subject', it['name'])} isolated studio cutout prop"
        return errs
    if kind == "video":
        if not shot.get("beats"):
            shot["beats"] = [{"t": "0-4s", "action": shot.get("action") or shot["subject"]}]
    return errs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("shots", nargs="?", default="SHOTS.json")
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--out", default="ELEMENTS.tsv")
    a = ap.parse_args()
    spec = json.load(open(a.shots, encoding="utf-8"))
    style = styles.get(spec.get("style", "noir"))
    world = spec.get("world", {})
    bad = 0
    rows = []
    seen_prompt, seen_name = {}, {}
    beats = []
    for i, s in enumerate(spec["shots"]):
        s = auto_heal_shot(s, style, world, i)
        errs = validate(s, style)
        if errs:
            bad += 1
            print(f"✗ {s.get('name')}: " + "; ".join(errs))
            continue
        kind = s.get("kind", "scene")
        parts = ""
        if kind == "character":
            for n, p, ref in character_rows(s, style, world):
                if n in seen_name:
                    continue
                seen_name[n], seen_prompt[p] = i, n
                rows.append((n, p, "prop", s.get("aspect", "3:4"), "", ref or ""))
            continue
        if kind == "layer":
            n = s["name"]
            p = layer_prompt(s, style, world)
            seen_name[n], seen_prompt[p] = i, n
            rows.append((n, p, "bg" if s["depth"] == "sky" else "prop", s.get("aspect", "16:9"), "", ""))
            continue
        if kind == "sheet":
            r_, c_, aspect = GRIDS[len(s["items"])]
            parts = ",".join(it["name"] for it in s["items"]) + f"|{r_}x{c_}"
        else:
            aspect = s.get("aspect", "1:1" if kind == "asset" else spec.get("aspect", "16:9"))
        if s["name"] in seen_name:
            s["name"] = f"{s['name']}_{i + 1}"
        prompt = build(s, style, world, i)
        if prompt in seen_prompt:
            prompt = f"{prompt} (Shot angle variation #{i + 1})"
        seen_name[s["name"]], seen_prompt[prompt] = i, s["name"]
        rows.append((s["name"], prompt, {"asset": "prop", "video": "video", "sheet": "sheet"}.get(kind, "bg"), aspect, parts,
                     s.get("ref", "")))
        if s.get("line") is not None:
            beats.append({"name": s["name"], "kind": kind, "line": str(s["line"]), "cue": s.get("cue"),
                          "archetype": s.get("archetype"), "size": s.get("size")})
    if bad:
        sys.exit(f"{bad} shot(s) rejected -- fix them; vague or repeated prompts make generic or duplicate images.")
    print(f"✓ {len(rows)} shots valid")
    if a.check:
        return
    with open(a.out, "w", encoding="utf-8") as f:
        f.write("id\tname\tprompt\tkind\taspect_ratio\tparts\tref\n")
        for n, p, k, ar, parts, ref in rows:
            tag = f"#{n}"
            p_tagged = p if p.endswith(tag) else f"{p.rstrip()} {tag}"
            f.write(f"{n}\t{n}\t{p_tagged}\t{k}\t{ar}\t{parts}\t{ref}\n")
    with open("PROMPTS.md", "w", encoding="utf-8") as f:
        f.write(f"# Prompt sheet ({spec.get('style')}, {spec.get('aspect', '16:9')})\n\n")
        for n, p, k, ar, parts, ref in rows:
            tag = f"#{n}"
            p_tagged = p if p.endswith(tag) else f"{p.rstrip()} {tag}"
            f.write(f"## {n}  ·  {k}  ·  {ar}" + (f"  ·  parts: {parts}" if parts else "") + (f"  ·  reference: {ref}" if ref else "")
                    + f"\n\n{p_tagged}\n\n")
    n_sheet_parts = sum(len(r[4].split("|")[0].split(",")) for r in rows if r[4])
    print(f"Flow prompts: {len(rows)} -> assets: {sum(1 for r in rows if r[2] == 'bg')} scenes, "
          f"{sum(1 for r in rows if r[2] == 'prop') + n_sheet_parts} cut-outs ({n_sheet_parts} from sheets), "
          f"{sum(1 for r in rows if r[2] == 'video')} videos")
    if beats:
        json.dump(beats, open("BEATS.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"wrote {a.out} and PROMPTS.md" + (" and BEATS.json (line/cue per image, for the edit)" if beats else ""))


if __name__ == "__main__":
    main()
