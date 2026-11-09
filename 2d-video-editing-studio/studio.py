def _cues_is_stub(path="cues.tsv"):
    if not os.path.exists(path):
        return True
    try:
        with open(path, encoding="utf-8") as f:
            lines = [l for l in f if l.strip()]
        return len(lines) <= 5  # Template stub (<= 5 rows)
    except Exception:
        return True

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""studio.py -- Deepesh Studio v2: one command line for the whole production.

Run every step from inside a PROJECT folder (create one with `new`):

  python studio.py new  ~/videos/my_video          make a project (links engine, fonts, sounds; copies templates)
  python studio.py voice   [--voice anuj]          LINES.tsv  -> VO.wav, VO.tsv, WORDS.tsv   (Cartesia, per line)
  python studio.py plan    [--style S] [--pace]    how many images, of what kind, for which line (style + script aware) -> PLAN.md
  python studio.py lint                            reject duplicate / repetitive / under-covered shot lists BEFORE Flow
  python studio.py prompts                         SHOTS.json -> ELEMENTS.tsv + PROMPTS.md   (lints first, then writes prompts)
  python studio.py harvest [folder]         autonomously ingest & map downloaded assets into elements/raw/
  python studio.py generate [--status|--regen N]   ELEMENTS.tsv -> elements/raw/   (parallel, 1.3 s apart, never twice, stops on a flag)
  python studio.py key                             cut-outs + asset sheets (split into objects) -> elements/cut
  python studio.py mix                             cues.tsv + VO.wav -> mix.wav               (music bed + SFX, optional)
  python studio.py check                           validate EDIT.json (cues, slots, missing images, dead air)
  python studio.py sheet   [--every 6]             contact sheet of the whole edit -> _stills/sheet.jpg
  python studio.py still 12.5 40                   exact frames -> _stills/
  python studio.py preview                         fast 960x540 draft -> preview.mp4
  python studio.py render                          final 1080p -> master.mp4
  python studio.py styles                          list the creative style engines (box / noir / sticker / vox / kinetic / cinematic)
  python studio.py recipes <style> [recipe]        show scene templates from a style's engine (paste into EDIT.json)
  python studio.py selftest [--quick]              test every feature on THIS machine (phone or laptop) and report timings
  python studio.py guard [reset]                   Flow pacing status / clear the pause after an unusual-activity stop
"""
import csv, os, shutil, subprocess, sys

ROOT = os.path.dirname(os.path.realpath(__file__))
CORE = os.path.join(ROOT, "core")
PY = sys.executable


def run(*args):
    r = subprocess.run([PY, *args])
    if r.returncode:
        sys.exit(r.returncode)


def new(path):
    path = os.path.abspath(os.path.expanduser(path))
    os.makedirs(os.path.join(path, "elements", "raw"), exist_ok=True)
    os.makedirs(os.path.join(path, "elements", "cut"), exist_ok=True)
    for name in ("core", "fonts", "audio", "styles", "skills", "hooks", "studio.py",
                 "GEMINI.md", "AGENTS.md", "AGENT.md", "SKILL.md", "CLAUDE.md",
                 "CREATIVE_DIRECTOR.md", "CHARACTER_MODE.md"):
        dst, src = os.path.join(path, name), os.path.join(ROOT, name)
        if os.path.lexists(dst) or not os.path.exists(src):
            continue
        try:
            os.symlink(src, dst)
        except (OSError, NotImplementedError):          # Windows without symlink rights: copy instead
            shutil.copytree(src, dst) if os.path.isdir(src) else shutil.copy2(src, dst)
    gemini_dir = os.path.join(path, ".gemini")
    os.makedirs(gemini_dir, exist_ok=True)
    g_dst = os.path.join(gemini_dir, "GEMINI.md")
    g_src = os.path.join(ROOT, "GEMINI.md")
    if os.path.exists(g_src) and not os.path.exists(g_dst):
        try:
            os.symlink(g_src, g_dst)
        except Exception:
            shutil.copy2(g_src, g_dst)
    claude_dir = os.path.join(path, ".claude")
    os.makedirs(claude_dir, exist_ok=True)
    c_dst = os.path.join(claude_dir, "settings.json")
    c_src = os.path.join(ROOT, ".claude", "settings.json")
    if os.path.exists(c_src) and not os.path.exists(c_dst):
        shutil.copy2(c_src, c_dst)
    tpl = os.path.join(ROOT, "templates", "v2")
    if os.path.exists(tpl):
        for f in os.listdir(tpl):
            dst = os.path.join(path, f)
            if not os.path.exists(dst):
                with open(os.path.join(tpl, f), encoding="utf-8") as a, open(dst, "w", encoding="utf-8") as b:
                    b.write(a.read())
    print(f"✓ project ready: {path}\n  rules & 7-step conversational protocol registered in project.\n  next: follow the 7-Step Protocol or write LINES.tsv, then `python studio.py voice` from inside it")


def split_sheet(img, names, grid):
    """Split one keyed multi-object sheet into separate cut-outs, in grid reading order."""
    import numpy as np
    from scipy import ndimage
    from PIL import Image
    rows, cols = (int(v) for v in grid.split("x"))
    a = np.asarray(img)[..., 3] > 100
    merged = ndimage.binary_dilation(a, iterations=max(4, img.width // 55))   # join fragments of one object
    lab, n = ndimage.label(merged)
    if n == 0:
        return []
    areas = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
    keep = [i + 1 for i in np.argsort(areas)[::-1][:len(names)] if areas[i] > 0.004 * a.size]
    if len(keep) < len(names):      # objects touched / one missing: refuse rather than mislabel
        return []
    boxes = ndimage.find_objects(lab)
    H, W = a.shape
    def order(i):
        sl = boxes[i - 1]
        cy, cx = (sl[0].start + sl[0].stop) / 2, (sl[1].start + sl[1].stop) / 2
        return (int(cy / (H / rows)), cx)
    keep.sort(key=order)
    arr = np.asarray(img)
    out = []
    for name, i in zip(names, keep):
        sl = boxes[i - 1]
        piece = arr[sl].copy()
        piece[..., 3] = np.where(lab[sl] == i, piece[..., 3], 0)
        out.append((name, Image.fromarray(piece)))
    return out


def key_props():
    sys.path.insert(0, CORE)
    from key import extract
    rows = list(csv.DictReader(open("ELEMENTS.tsv", encoding="utf-8"), delimiter="\t"))
    os.makedirs("elements/cut", exist_ok=True)
    for r in rows:
        if r.get("kind") not in ("prop", "sheet"):
            continue
        n = r["name"]
        src = next((f"elements/raw/{n}{e}" for e in (".jpg", ".png", ".jpeg", ".webp") if os.path.exists(f"elements/raw/{n}{e}")), None)
        if not src:
            print(f"  · {n}: not generated yet")
            continue
        img, how = extract(src)
        if r["kind"] == "prop":
            img.save(f"elements/cut/{n}.png")
            print(f"  ✓ {n} ({how})")
            continue
        names, grid = r["parts"].split("|")
        names = names.split(",")
        pieces = split_sheet(img, names, grid)
        for name, piece in pieces:
            piece.save(f"elements/cut/{name}.png")
        got = [p[0] for p in pieces]
        miss = [x for x in names if x not in got]
        print(f"  ✓ sheet {n}: {len(got)}/{len(names)} objects -> {' '.join(got)}"
              + (f"   ⚠ not separated: {' '.join(miss)} (regenerate the sheet: python studio.py generate --only {n})" if miss else ""))


def _ensure_edit_ready():
    sys.path.insert(0, CORE)
    import auto_edit
    if auto_edit.is_edit_stub("EDIT.json", "SHOTS.json") and os.path.exists("SHOTS.json"):
        print("EDIT.json is unpopulated or template stub -> auto-choreographing from SHOTS.json + VO...")
        auto_edit.build_auto_edit("SHOTS.json", "EDIT.json")


def run_autopilot(args):
    """Execute the full v3.2 production pipeline in ONE single command with zero loop/deliberation."""
    import argparse
    ap = argparse.ArgumentParser(description="1-Step Autopilot Production Pipeline")
    ap.add_argument("--voice", default="anuj")
    ap.add_argument("--lang", default="hi")
    ap.add_argument("--parallel", type=int, default=2)
    ap.add_argument("--preview-only", action="store_true")
    a, _ = ap.parse_known_args(args)

    eng = os.path.join(CORE, "engine", "render.py")
    print("▶ [1/6] Voiceover synthesis (LINES.tsv -> VO.wav + WORDS.tsv)...", flush=True)
    if os.path.exists("LINES.tsv") and (not os.path.exists("VO.wav") or not os.path.exists("WORDS.tsv")):
        run(os.path.join(CORE, "voice.py"), "--voice", a.voice, "--lang", a.lang)
    else:
        print("  ✓ VO.wav & WORDS.tsv already present")

    print("▶ [2/6] Building & auto-healing Google Flow prompts (SHOTS.json -> ELEMENTS.tsv)...", flush=True)
    run(os.path.join(CORE, "prompt_engine.py"), "SHOTS.json")

    print(f"▶ [3/6] Generating visual assets via 3-Tier Flow Engine (--parallel {a.parallel})...", flush=True)
    run(os.path.join(CORE, "flow_safe.py"), "--parallel", str(a.parallel))

    print("▶ [4/6] Keying transparent cutouts (elements/raw -> elements/cut)...", flush=True)
    key_props()

    print("▶ [5/6] Verifying / auto-choreographing EDIT.json...", flush=True)
    _ensure_edit_ready()
    run(eng, "check")

    print("▶ [6/6] Mixing broadcast audio (-14 LUFS) & rendering final video...", flush=True)
    if os.path.exists("VO.wav") and (not os.path.exists("mix.wav") or _cues_is_stub("cues.tsv")):
        if _cues_is_stub("cues.tsv"):
            run(os.path.join(CORE, "mix.py"), "--autocues", *(["--lines", "VO.tsv"] if os.path.exists("VO.tsv") else []))
        run(os.path.join(CORE, "mix.py"), "cues.tsv", "--vo", "VO.wav",
            *(["--lines", "VO.tsv"] if os.path.exists("VO.tsv") else []),
            *(["--words", "WORDS.tsv"] if os.path.exists("WORDS.tsv") else []),
            "--out", "mix.wav")
    run(eng, "preview" if a.preview_only else "video")


def main():
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help", "help"):
        sys.exit(__doc__)
    cmd, rest = sys.argv[1], sys.argv[2:]
    eng = os.path.join(CORE, "engine", "render.py")
    if cmd == "new":
        new(rest[0] if rest else "my_video")
    elif cmd in ("autopilot", "run", "build"):
        run_autopilot(rest)
    elif cmd in ("auto-edit", "auto_edit"):
        run(os.path.join(CORE, "auto_edit.py"), *rest)
    elif cmd == "voice":
        run(os.path.join(CORE, "voice.py"), *rest)
    elif cmd == "plan":
        run(os.path.join(CORE, "asset_planner.py"), *rest)
    elif cmd == "lint":
        run(os.path.join(CORE, "shot_lint.py"), *rest)
    elif cmd == "prompts":
        if "--no-lint" in rest:
            rest = [x for x in rest if x != "--no-lint"]
        elif os.path.exists(rest[0] if rest and not rest[0].startswith("-") else "SHOTS.json"):
            run(os.path.join(CORE, "shot_lint.py"), *(rest[:1] if rest and not rest[0].startswith("-") else []), "--warn-only")
        run(os.path.join(CORE, "prompt_engine.py"), *(rest or ["SHOTS.json"]))
    elif cmd == "generate":
        if os.path.exists("SHOTS.json") and "--status" not in rest and "--no-lint" not in rest:
            run(os.path.join(CORE, "shot_lint.py"), "--warn-only")
        run(os.path.join(CORE, "flow_safe.py"), *[x for x in rest if x != "--no-lint"])
    elif cmd == "key":
        key_props()
    elif cmd == "mix":
        if not os.path.exists("VO.wav"):
            sys.exit("mix needs VO.wav -- run `python studio.py voice` first")
        if _cues_is_stub("cues.tsv") or "--autocues" in rest:
            print("cues.tsv unpopulated or missing -> auto-generating rich sound design cues (BGM + Foley SFX)...")
            run(os.path.join(CORE, "mix.py"), "--autocues", *(["--lines", "VO.tsv"] if os.path.exists("VO.tsv") else []))
        run(os.path.join(CORE, "mix.py"), "cues.tsv", "--vo", "VO.wav",
            *(["--lines", "VO.tsv"] if os.path.exists("VO.tsv") else []),
            *(["--words", "WORDS.tsv"] if os.path.exists("WORDS.tsv") else []),
            "--out", "mix.wav", *rest)
    elif cmd in ("check", "sheet", "still"):
        _ensure_edit_ready()
        run(eng, cmd, *rest)
    elif cmd in ("preview", "render"):
        _ensure_edit_ready()
        # Auto-mix sound if VO.wav exists and mix.wav is missing
        if os.path.exists("VO.wav") and (not os.path.exists("mix.wav") or _cues_is_stub("cues.tsv")):
            print("Auto-mixing compulsory broadcast background music and Foley SFX (-14 LUFS)...")
            if _cues_is_stub("cues.tsv"):
                run(os.path.join(CORE, "mix.py"), "--autocues", *(["--lines", "VO.tsv"] if os.path.exists("VO.tsv") else []))
            run(os.path.join(CORE, "mix.py"), "cues.tsv", "--vo", "VO.wav",
                *(["--lines", "VO.tsv"] if os.path.exists("VO.tsv") else []),
                *(["--words", "WORDS.tsv"] if os.path.exists("WORDS.tsv") else []),
                "--out", "mix.wav")
        run(eng, "video" if cmd == "render" else cmd, *rest)
    elif cmd in ("harvest", "collect"):
        run(os.path.join(CORE, "flow_harvest.py"), *rest)
    elif cmd == "guard":
        run(os.path.join(CORE, "flow_guard.py"), *(rest or ["status"]))
    elif cmd == "selftest":
        run(os.path.join(CORE, "selftest.py"), *rest)
    elif cmd == "styles":
        _list_styles()
    elif cmd == "recipes":
        _show_recipes(*rest)
    else:
        sys.exit(f"unknown command {cmd!r}\n" + __doc__)


def _load_engine():
    sys.path.insert(0, os.path.join(CORE, "engine"))
    import layouts, styles      # order matters: layouts first so styles can register into it
    return styles


def _list_styles():
    s = _load_engine()
    print("Creative style engines (edit EDIT.json's \"style\" field):\n")
    for name, aliases in s.list_styles():
        rec = list(s.RECIPES.get(name, {}))
        head = s.DESIGN.get(name, "").split("\n")[0].strip() if s.DESIGN.get(name) else ""
        print(f"  {name:12}  aliases: {', '.join(aliases) or '—'}")
        if head:
            print(f"               {head}")
        if rec:
            print(f"               recipes: {', '.join(rec)}  (see `studio.py recipes {name}`)")
        print()


def _show_recipes(style=None, recipe=None):
    if not style:
        _list_styles(); sys.exit("\npick a style: python studio.py recipes <name> [recipe]")
    import json
    s = _load_engine()
    recs = s.RECIPES.get(style)
    if not recs:
        sys.exit(f"style {style!r} has no recipes (or unknown style)")
    if recipe:
        if recipe not in recs:
            sys.exit(f"recipe {recipe!r} not in {style!r}; have: {', '.join(recs)}")
        print(f"# {style}: {recipe}\n")
        print(json.dumps(recs[recipe], ensure_ascii=False, indent=2))
        return
    print(f"# recipes in style {style!r}:\n")
    for name, body in recs.items():
        print(f"## {name}\n")
        print(json.dumps(body, ensure_ascii=False, indent=2))
        print()


if __name__ == "__main__":
    main()
