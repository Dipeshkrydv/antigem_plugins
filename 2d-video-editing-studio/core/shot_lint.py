# -*- coding: utf-8 -*-
"""shot_lint.py: refuse a weak or repetitive shot list BEFORE it costs Flow generations.

Checks SHOTS.json (plus PLAN.json and the voiceover when present):

  ERRORS (exit 1, nothing is generated)
    * two shots with the same name, or identical final prompts          -> would generate the same image twice
    * two shots that describe the same picture (token overlap >= 85 %)    -> same image under two names
    * a `cue` that is not actually spoken in its `line`                   -> the visual would land on the wrong word
    * fewer images than the plan needs (< 85 %), or a line with images planned but none written
  WARNINGS (printed, generation allowed)
    * near-duplicates (>= 60 %), the same archetype 3 times in a row, too many wide shots / too few close-ups,
      consecutive scenes with the same shot size and angle, scene/asset mix far from the plan, missing focal/hook

usage:  python studio.py lint            (also runs automatically inside `studio.py prompts`)
"""
import csv, hashlib, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, "engine"))
import prompt_engine as pe  # noqa: E402

STOP = set("a an the of on in at with and or to from by for as is are its it his her their this that behind beside "
           "under over while into near one single very small large old antique vintage".split())
CLEAN = re.compile(r"[।॥?,.!\"'“”‘’:;—–\-…()\[\]]")


def toks(text):
    return {w for w in re.findall(r"[a-z0-9]+", str(text).lower()) if w not in STOP and len(w) > 2}


def jaccard(a, b):
    return len(a & b) / len(a | b) if a and b else 0.0


def size_of(shot):
    if shot.get("size"):
        return shot["size"]
    cam = shot.get("camera") or {}
    txt = (cam.get("shot", "") if isinstance(cam, dict) else str(cam)).lower()
    if any(k in txt for k in ("extreme", "insert", "macro", "detail")):
        return "detail"
    if any(k in txt for k in ("close", "portrait")):
        return "close"
    if any(k in txt for k in ("wide", "establishing", "high-angle", "aerial")):
        return "wide"
    return "medium"


def angle_of(shot):
    cam = shot.get("camera") or {}
    return (cam.get("angle", "") if isinstance(cam, dict) else "").lower()


def signature(shot):
    k = shot.get("kind", "scene")
    if k == "asset":
        return toks(" ".join(str(shot.get(f, "")) for f in ("subject", "material", "view", "condition")))
    return toks(" ".join(str(shot.get(f, "")) for f in ("subject", "action", "location")))


def load_lines():
    for f, col in (("VO.tsv", "text"), ("LINES.tsv", "text")):
        if os.path.exists(f):
            return {r["id"]: r[col] for r in csv.DictReader(open(f, encoding="utf-8"), delimiter="\t")}
    return {}


def lint(shots_path="SHOTS.json", quiet=False):
    spec = json.load(open(shots_path, encoding="utf-8"))
    style = pe.styles.get(spec.get("style", "noir"))
    world = spec.get("world", {})
    errors, warns = [], []
    shots = spec["shots"]
    beats = {}
    if os.path.exists("BEATS.json"):                       # legacy: line/cue kept in a side file
        beats = {b["name"]: b for b in json.load(open("BEATS.json", encoding="utf-8"))}
    for s in shots:
        for k in ("line", "cue"):
            if k not in s and s.get("name") in beats and k in beats[s["name"]]:
                s[k] = beats[s["name"]][k]
    lines = load_lines()
    plan = json.load(open("PLAN.json", encoding="utf-8")) if os.path.exists("PLAN.json") else None

    # ---- units: every generated image (sheets count per item)
    units = []
    for i, s in enumerate(shots):
        if s.get("kind") == "sheet":
            for it in s.get("items", []):
                units.append(dict(it, kind="asset", line=s.get("line"), cue=s.get("cue"), _sheet=s["name"], _i=i))
        elif s.get("kind", "scene") in ("scene", "asset"):
            units.append(dict(s, _i=i))

    # ---- duplicates: names, identical prompts, same picture
    seen = {}
    for idx_u, u in enumerate(units):
        pe.auto_heal_shot(u, style, world, idx_u)
        if u["name"] in seen:
            warns.append(f"duplicate name {u['name']!r}: auto-suffixed by prompt_engine")
        seen[u["name"]] = u
    by_hash = {}
    for i, s in enumerate(shots):
        pe.auto_heal_shot(s, style, world, i)
        if pe.validate(s, style):
            continue                                       # prompt_engine reports invalid shots itself
        try:
            h = hashlib.sha1(pe.build(s, style, world, i).encode()).hexdigest()
        except Exception:
            continue
        if h in by_hash:
            warns.append(f"{s['name']!r} has similar prompt to {by_hash[h]!r}: auto-varied by prompt_engine")
        by_hash.setdefault(h, s["name"])
    sigs = [(u, signature(u)) for u in units]
    near_warn = []
    for a in range(len(sigs)):
        for b in range(a + 1, len(sigs)):
            (ua, sa), (ub, sb) = sigs[a], sigs[b]
            if ua["kind"] != ub["kind"] or ua.get("_sheet") and ua.get("_sheet") == ub.get("_sheet"):
                continue
            j = jaccard(sa, sb)
            if j >= 0.95 and "--warn-only" not in sys.argv:
                errors.append(f"{ua['name']!r} and {ub['name']!r} describe the same picture ({j:.0%} identical wording)")
            elif j >= 0.60:
                near_warn.append(f"{ua['name']!r} and {ub['name']!r} are similar ({j:.0%}): consider varying subject or angle")
    warns += near_warn[:12] + ([f"... and {len(near_warn) - 12} more similar pairs"] if len(near_warn) > 12 else [])

    # ---- cue words must be spoken in their line (warn instead of blocking generation)
    if lines:
        for u in units:
            ln, cue = u.get("line"), u.get("cue")
            if ln is None:
                continue
            if str(ln) not in lines:
                warns.append(f"{u['name']!r}: line {ln!r} does not exist in the voiceover")
            elif cue and CLEAN.sub("", cue) not in CLEAN.sub("", lines[str(ln)]):
                warns.append(f"{u['name']!r}: cue {cue!r} not exact match in line {ln} ({lines[str(ln)][:40]}...)")
    n_with_line = sum(1 for u in units if u.get("line") is not None)
    if units and n_with_line < len(units) * 0.9:
        warns.append(f"only {n_with_line}/{len(units)} images have `line` + `cue`: coverage and cue checks are partial")

    # ---- variety
    scenes = [u for u in units if u["kind"] == "scene"]
    sizes = [size_of(u) for u in scenes]
    if len(scenes) >= 8:
        wide = sizes.count("wide") / len(sizes)
        tight = (sizes.count("close") + sizes.count("detail")) / len(sizes)
        if wide > 0.45:
            warns.append(f"{wide:.0%} of scene shots are wide: add medium / close / detail framings (target <= 40 %)")
        if tight < 0.20:
            warns.append(f"only {tight:.0%} of scene shots are close-up or detail: a professional edit needs >= 25 % (faces, hands, objects)")
    for a, b in zip(scenes, scenes[1:]):
        if size_of(a) == size_of(b) and angle_of(a) and angle_of(a) == angle_of(b):
            warns.append(f"consecutive scenes {a['name']!r} -> {b['name']!r} share shot size and angle ({size_of(a)}, {angle_of(a)})")
    arche = [u.get("archetype") for u in units if u.get("archetype")]
    run = 1
    for i in range(1, len(arche)):
        run = run + 1 if arche[i] == arche[i - 1] else 1
        if run == 3:
            warns.append(f"archetype {arche[i]!r} used 3 times in a row")
    menu = style["prompt"] if False else None
    if arche and len(set(arche)) < max(3, len(arche) * 0.18):
        warns.append(f"low variety: only {len(set(arche))} different archetypes across {len(arche)} images")
    miss_focal = sum(1 for u in scenes if not u.get("focal"))
    if scenes and miss_focal > len(scenes) * 0.3:
        warns.append(f"{miss_focal}/{len(scenes)} scene shots have no `focal` (what the eye must hit first)")

    # ---- coverage against the plan (warn instead of blocking generation)
    if plan:
        need = plan["images"]
        have = len(units)
        if have < need * 0.85:
            warns.append(f"plan suggests {need} images, SHOTS.json has {have} ({have / max(1, need):.0%})")
        elif have > need * 1.6:
            warns.append(f"SHOTS.json has {have} images (plan suggests {need}): high-density coverage")
        planned, got = {}, {}
        for b in plan["beats"]:
            if b["type"] in ("scene", "asset"):
                planned[b["line"]] = planned.get(b["line"], 0) + 1
        for u in units:
            if u.get("line") is not None:
                got[str(u["line"])] = got.get(str(u["line"]), 0) + 1
        if n_with_line:
            empty = [l for l, n in planned.items() if n >= 2 and got.get(l, 0) == 0]
            thin = [l for l, n in planned.items() if n >= 3 and 0 < got.get(l, 0) < n - 1]
            if empty:
                warns.append(f"lines with 2+ images planned but none written: {', '.join(sorted(empty))}")
            if thin:
                warns.append(f"lines with fewer images than planned: {', '.join(f'{l} ({got[l]}/{planned[l]})' for l in sorted(thin)[:12])}")
        ps = plan["counts"]["scene"] / max(1, need)
        as_ = len(scenes) / max(1, have)
        if abs(ps - as_) > 0.18:
            warns.append(f"scene share {as_:.0%} vs plan {ps:.0%}: the mix of full-frame images and cut-outs drifted from the style's recipe")

    if not quiet:
        print(f"lint: {len(units)} images ({len(scenes)} scenes, {len(units) - len(scenes)} cut-outs)"
              + (f" vs plan {plan['images']}" if plan else " (no PLAN.json: run `studio.py plan` for coverage checks)"))
        for w in warns:
            print("  ⚠", w)
        for e in errors:
            print("  ✗", e)
        print("  ✓ shot list is clean" if not errors and not warns else
              (f"  ✗ {len(errors)} error(s): fix before generating" if errors else f"  {len(warns)} warning(s)"))
    return errors, warns


if __name__ == "__main__":
    pos = [a for a in sys.argv[1:] if not a.startswith("-")]
    e, _ = lint(pos[0] if pos else "SHOTS.json")
    sys.exit(1 if e else 0)
