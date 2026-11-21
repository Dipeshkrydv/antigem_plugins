"""SCENES.tsv + WORDS.tsv + elements/cut -> shots/NN.mp4 + labels.ass -> master

    python render.py shots [01 05 ...]   सारे scene, या सिर्फ़ ये
    python render.py master              जोड़ो + labels जलाओ + mix.wav
    python render.py plan                हर cue का असली समय छापो
    python render.py selfcheck

पिछली बार की ग़लती: scene line पर कटते थे पर तस्वीरें generic थीं, और एक ही घड़ी
हर जगह 10:10 दिखाती थी। अब हर element **उसी शब्द पर** आता है जो उसे नाम देता है
(SCENES.tsv का `cue`, WORDS.tsv से समय), घड़ियाँ code से बनती हैं ताकि जो समय बोला
गया वही दिखे, और हर चीज़ के नीचे हिंदी label है।

SCENES.tsv: scene cue kind what x y size motion out label
  cue   "@NN" = line NN की शुरुआत, "-" = scene की शुरुआत, वरना script का शब्द
        (scene के अंदर आगे की ओर खोजा जाता है)
  kind  img (ELEMENTS.tsv name) | clock ("4:00" या "6:00>7:00") | clocks (गिनती)
        | pin (नक्शे पर जगह) | vline | rule ("a>b" दो pins के बीच) | cross | text | bg
  motion pop slideL slideR rise hold   (hold = scene की शुरुआत से मौजूद; cue तब
        सिर्फ़ घड़ी की सुई घुमाने का समय है)
"""
import csv, math, os, re, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw

W, H, FPS = 1920, 1080, 24
CUT = "elements/cut"
# python render.py shots --vo aman  -> WORDS_aman.tsv, mix_aman.wav, shots_aman/, ..._aman.mp4
VO = sys.argv.pop(sys.argv.index("--vo") + 1) if "--vo" in sys.argv else ""
if VO:
    sys.argv.remove("--vo")
SUF = f"_{VO}" if VO else ""
WORDS_TSV, MIX, SHOTS, ASS = f"WORDS{SUF}.tsv", f"mix{SUF}.wav", f"shots{SUF}", f"labels{SUF}.ass"
OUT = f"{os.path.basename(os.getcwd()).replace(' ', '_')}{SUF}.mp4"   # named after the project folder
PAPER, NIGHT = (241, 233, 216), (26, 33, 58)
INK, RED, YEL, CREAM = (42, 36, 32), (217, 69, 43), (242, 183, 5), (250, 246, 236)
# a font with Devanagari + Latin; override with VOX_FONT (e.g. "Noto Sans" for other scripts)
FONT = os.environ.get("VOX_FONT") or {"win32": "Nirmala UI", "darwin": "Kohinoor Devanagari"}.get(sys.platform, "Noto Sans Devanagari")

# Places on a map: PLACES.tsv (map, place, u, v), u/v = 0..1 inside the cut-out map PNG,
# measured once on a gridded copy of the generated map. Rough is fine: the viewer only
# needs to see roughly where.
PLACES = {}
if os.path.exists("PLACES.tsv"):
    with open("PLACES.tsv", encoding="utf-8") as _f:
        for _r in csv.DictReader(_f, delimiter="\t"):
            PLACES.setdefault(_r["map"], {})[_r["place"]] = (float(_r["u"]), float(_r["v"]))


# ---------------------------------------------------------------- data
def tsv(name):
    with open(name, encoding="utf-8") as f:
        return list(csv.DictReader(f, delimiter="\t"))


WORDS = [(r["line"], float(r["start"]), float(r["end"]), re.sub(r"[।?,.!]", "", r["word"]))
         for r in tsv(WORDS_TSV)] if os.path.exists(WORDS_TSV) else []
NAMES = {r["name"]: r["id"] for r in tsv("ELEMENTS.tsv")} if os.path.exists("ELEMENTS.tsv") else {}
# film length = the mix's length; before the mix exists, the last word + 1.5 s
DUR = (float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", MIX],
                            capture_output=True, text=True).stdout) if os.path.exists(MIX)
       else (WORDS[-1][2] + 1.5 if WORDS else 0.0))


def find(cue, frm):
    if cue.startswith("@"):
        for k, w in enumerate(WORDS):
            if w[0] == cue[1:]:
                return k
    else:
        for k in range(frm, len(WORDS)):
            if cue in WORDS[k][3]:
                return k
    raise SystemExit(f"cue not found after word {frm}: {cue!r}")


def num(v, d=0.0):
    return d if v in ("-", "") else float(v)


def plan():
    """SCENES.tsv -> [{id, t0, t1, els, bgs}] -- सब समय WORDS.tsv से।"""
    groups = {}
    for r in tsv("SCENES.tsv"):
        groups.setdefault(r["scene"], []).append(r)
    scenes, p = [], 0
    for sid, rows in groups.items():
        k = find(rows[0]["cue"], p)
        p = k
        t0 = 0.0 if not scenes else WORDS[k][1] - 0.12
        sc = {"id": sid, "t0": t0, "els": [], "bgs": [(t0, "paper")]}
        for r in rows:
            if r["cue"] == "-" or r["cue"].startswith("@"):
                t = t0 if r["cue"] == "-" else max(t0, WORDS[find(r["cue"], p)][1] - 0.06)
            else:
                p = find(r["cue"], p)
                t = WORDS[p][1] - 0.06
            if r["kind"] == "bg":
                sc["bgs"].append((t, r["what"]))
                continue
            hold = r["motion"] == "hold"
            e = dict(kind=r["kind"], what=r["what"], x=num(r["x"]), y=num(r["y"]),
                     size=num(r["size"]), motion=r["motion"], label=r["label"],
                     t_in=t0 if hold else t, anim=t if hold else t + 0.35,
                     t_out=WORDS[find(r["out"], p)][1] - 0.06 if r["out"] != "-" else None)
            sc["els"].append(e)
        scenes.append(sc)
    for a, b in zip(scenes, scenes[1:]):
        a["t1"] = b["t0"]
    scenes[-1]["t1"] = DUR
    for s in scenes:
        assert s["t1"] - s["t0"] > 0.5, f"scene {s['id']} too short"
        s["bgs"].sort(key=lambda b: b[0])
        for e in s["els"]:
            e["t_out"] = e["t_out"] or s["t1"]
            # cue ग़लती से अगली line के शब्द पर न जा बैठे
            assert e["t_in"] < s["t1"] - 0.2, f"scene {s['id']}: {e['kind']} {e['what']} cue lands after the cut"
    geometry(scenes)
    return scenes


# ---------------------------------------------------------------- art
_img = {}


def load(name):
    if name not in _img:
        p = f"{CUT}/{NAMES[name]}.png"
        assert os.path.exists(p), f"element missing: {name} ({p})"
        im = Image.open(p).convert("RGBA")
        _img[name] = im.crop(im.getbbox())
    return _img[name]


def fit(name, size):
    h = int(H * size)
    if not os.path.exists(f"{CUT}/{NAMES[name]}.png"):     # अभी बना नहीं -- plan फिर भी छपे
        return h, h
    im = load(name)
    w = round(im.width * h / im.height)
    if w > 0.92 * W:
        w, h = int(0.92 * W), round(im.height * 0.92 * W / im.width)
    return w, h


def geometry(scenes):
    """हर element का अंतिम box (cx, cy, w, h) -- pins/lines नक्शे से जगह लेते हैं।"""
    for s in scenes:
        last_map = None
        for e in s["els"]:
            k = e["kind"]
            if k == "img":
                w, h = fit(e["what"], e["size"]) if NAMES else (100, 100)
                e["box"] = (e["x"] * W, e["y"] * H, w, h)
                if e["what"] in PLACES:               # pins वाले नक्शे; state inset नहीं
                    last_map = e
            elif k in ("clock",):
                d = int(e["size"] * H)
                e["box"] = (e["x"] * W, e["y"] * H, d, d)
            elif k == "clocks":
                d, n = int(e["size"] * H), int(e["what"])
                e["box"] = (e["x"] * W, e["y"] * H, int(n * d * 1.18), d)
            elif k in ("pin", "vline", "rule"):
                if k == "vline" and e["what"] == "-":
                    e["box"] = (e["x"] * W, e["y"] * H, 8, e["size"] * H)
                    continue
                assert last_map, f"scene {s['id']}: {k} {e['what']} needs a map before it"
                cx, cy, w, h = last_map["box"]
                spots = PLACES[last_map["what"]]

                def at(place):
                    u, v = spots[place]
                    return cx - w / 2 + u * w, cy - h / 2 + v * h
                if k == "pin":
                    px, py = at(e["what"])
                    e["box"] = (px, py, 28, 28)
                elif k == "vline":
                    px, _ = at(e["what"])
                    e["box"] = (px, cy, 8, h * 1.04)
                else:
                    a, b = e["what"].split(">")
                    if "," in b:                       # pin -> inset map: पतली कड़ी
                        bx, by = (float(v) for v in b.split(","))
                        e["ends"], e["link"] = (at(a), (bx * W, by * H)), True
                    else:
                        e["ends"] = (at(a), at(b))
                    e["box"] = (0, 0, 0, 0)
            elif k == "cross":
                d = e["size"] * H
                e["box"] = (e["x"] * W, e["y"] * H, d, d)
            else:
                e["box"] = (e["x"] * W, e["y"] * H, 0, 0)


_vec = {}


def ss(key, w, h, draw):
    """2x पर बनाओ, नीचे करो -- PIL की रेखाएँ antialias नहीं होतीं।"""
    if key not in _vec:
        im = Image.new("RGBA", (max(1, int(w * 2)), max(1, int(h * 2))), (0, 0, 0, 0))
        draw(ImageDraw.Draw(im), 2)
        _vec[key] = im.resize((max(1, int(w)), max(1, int(h))), Image.LANCZOS)
        if len(_vec) > 4000:
            _vec.clear()
    return _vec[key]


def clock_img(d, minutes):
    minutes = round(minutes * 2) / 2

    def draw(g, k):
        D = d * k
        r = D / 2
        lw = max(2, D * 0.045)
        g.ellipse([lw / 2, lw / 2, D - lw / 2, D - lw / 2], fill=CREAM + (255,), outline=INK + (255,), width=int(lw))
        for i in range(12):
            a = i * math.pi / 6
            big = i % 3 == 0
            r0, r1 = r * (0.70 if big else 0.78), r * 0.86
            g.line([r + r0 * math.sin(a), r - r0 * math.cos(a), r + r1 * math.sin(a), r - r1 * math.cos(a)],
                   fill=INK + (255,), width=int(D * (0.03 if big else 0.015)))
        ha = (minutes / 60 % 12) * math.pi / 6
        ma = (minutes % 60) * math.pi / 30
        g.line([r, r, r + r * 0.48 * math.sin(ha), r - r * 0.48 * math.cos(ha)], fill=INK + (255,), width=int(D * 0.055))
        g.line([r, r, r + r * 0.72 * math.sin(ma), r - r * 0.72 * math.cos(ma)], fill=INK + (255,), width=int(D * 0.035))
        c = D * 0.05
        g.ellipse([r - c, r - c, r + c, r + c], fill=RED + (255,))
    return ss(("clock", d, minutes), d, d, draw)


def hm(s):
    h, m = s.split(":")
    return int(h) % 12 * 60 + int(m)


# ---------------------------------------------------------------- motion
def ease_out(e):
    return 1 - (1 - e) ** 3


def back_out(e):
    c = 1.9
    return 1 + (c + 1) * (e - 1) ** 3 + c * (e - 1) ** 2


def clamp(v):
    return max(0.0, min(1.0, v))


def transform(e, t):
    """-> (scale, dx, dy) या None अगर अभी/अब दिखना नहीं।"""
    if t < e["t_in"]:
        return None
    a = clamp((t - e["t_in"]) / 0.42)
    s, dx, dy = 1.0, 0.0, 0.0
    m = e["motion"]
    if m == "pop" or m in ("-", ""):
        s = max(0.0, back_out(a)) if a < 1 else 1.0
    elif m == "slideL":
        dx = -(1 - ease_out(a)) * 0.6 * W
    elif m == "slideR":
        dx = (1 - ease_out(a)) * 0.6 * W
    elif m == "rise":
        dy, s = (1 - ease_out(a)) * 0.12 * H, 0.9 + 0.1 * ease_out(a)
    if t >= e["t_out"]:
        f = clamp((t - e["t_out"]) / 0.2)
        if f >= 1:
            return None
        s *= 1 - f
    dy += 4 * math.sin(t * 1.6 + e["box"][0] * 0.01)          # ज़रा सी जान
    return s, dx, dy


def paste(cv, im, cx, cy, s):
    if s <= 0.02:
        return
    if abs(s - 1) > 1e-3:
        im = im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))), Image.BILINEAR)
    cv.paste(im, (int(cx - im.width / 2), int(cy - im.height / 2)), im)


def draw_el(cv, e, t):
    tr = transform(e, t)
    if not tr:
        return
    s, dx, dy = tr
    cx, cy, w, h = e["box"]
    cx, cy = cx + dx, cy + dy
    k = e["kind"]
    if k == "img":
        key = ("img", e["what"], w, h)
        if key not in _vec:
            _vec[key] = load(e["what"]).resize((w, h), Image.LANCZOS)
        paste(cv, _vec[key], cx, cy, s)
    elif k == "clock":
        a, _, b = e["what"].partition(">")
        m = hm(a)
        if b:
            f = clamp((t - e["anim"]) / 0.8)
            f = f * f * (3 - 2 * f)
            m = m + (hm(b) - m) * f
        paste(cv, clock_img(int(w), m), cx, cy, s)
    elif k == "clocks":
        n, d = int(e["what"]), int(h)
        for i in range(n):
            sub = dict(e, t_in=e["t_in"] + i * 0.04)
            tr2 = transform(sub, t)
            if tr2:
                x = cx - w / 2 + d * 1.18 * (i + 0.5)
                paste(cv, clock_img(d, ((i * 1) % 12 + 1) * 60), x, cy, tr2[0])
    elif k == "pin":
        f = clamp((t - e["t_in"]) / 0.7)

        def draw(g, kk, f=round(f, 2)):
            R = 70 * kk
            if f < 1:
                rr = (14 + 50 * f) * kk
                g.ellipse([R - rr, R - rr, R + rr, R + rr], outline=RED + (int(255 * (1 - f)),), width=int(4 * kk))
            g.ellipse([R - 17 * kk, R - 17 * kk, R + 17 * kk, R + 17 * kk], fill=CREAM + (255,))
            g.ellipse([R - 12 * kk, R - 12 * kk, R + 12 * kk, R + 12 * kk], fill=RED + (255,))
        paste(cv, ss(("pin", round(f, 2)), 140, 140, draw), e["box"][0], e["box"][1], 1.0)
    elif k == "vline":
        f = round(ease_out(clamp((t - e["t_in"]) / 0.6)), 2) if e["motion"] != "hold" else 1.0
        L = int(h)

        def draw(g, kk, f=f):
            y, end = 0, L * f * kk
            while y < end:
                g.line([4 * kk, y, 4 * kk, min(end, y + 22 * kk)], fill=RED + (255,), width=int(6 * kk))
                y += 34 * kk
        paste(cv, ss(("vline", L, f), 8, L, draw), e["box"][0], e["box"][1], 1.0)
    elif k == "rule":
        (ax, ay), (bx, by) = e["ends"]
        f = ease_out(clamp((t - e["t_in"]) / 0.7))
        g = ImageDraw.Draw(cv)
        ex, ey = ax + (bx - ax) * f, ay + (by - ay) * f
        if e.get("link"):                      # dotted, ताकि नक्शे की सीमा जैसी न लगे
            n = max(1, int(math.hypot(ex - ax, ey - ay) / 18))
            for i in range(0, n, 2):
                g.line([ax + (ex - ax) * i / n, ay + (ey - ay) * i / n,
                        ax + (ex - ax) * (i + 1) / n, ay + (ey - ay) * (i + 1) / n], fill=INK, width=3)
        else:
            g.line([ax, ay, ex, ey], fill=RED, width=7)
    elif k == "cross":
        f = round(clamp((t - e["t_in"]) / 0.3), 2)
        D = int(w)

        def draw(g, kk, f=f):
            p, q = 0.08 * D * kk, 0.92 * D * kk
            lw = int(D * 0.07 * kk)
            f1, f2 = clamp(f * 2), clamp(f * 2 - 1)
            if f1:
                g.line([p, p, p + (q - p) * f1, p + (q - p) * f1], fill=RED + (255,), width=lw)
            if f2:
                g.line([q, p, q - (q - p) * f2, p + (q - p) * f2], fill=RED + (255,), width=lw)
        paste(cv, ss(("cross", D, f), D, D, draw), cx, cy, s if t >= e["t_out"] else 1.0)


_bg = {}


def background(name):
    if name not in _bg:
        rng = np.random.default_rng(7 if name == "paper" else 9)
        base = np.array(PAPER if name == "paper" else NIGHT, np.float32)
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        r = np.hypot((xx - W / 2) / (W / 2), (yy - H / 2) / (H / 2))
        shade = 1 - 0.10 * np.clip(r - 0.4, 0, None)                  # हल्का vignette
        fib = rng.normal(0, 3.0, (H // 4, W // 4)).repeat(4, 0).repeat(4, 1)   # कागज़ का रेशा
        _bg[name] = np.clip(base * shade[..., None] + fib[..., None], 0, 255).astype(np.uint8)
    return _bg[name]


def bg_at(bgs, t):
    cur = bgs[0][1]
    prev, since = cur, -99
    for bt, name in bgs:
        if bt <= t and name != cur:
            prev, cur, since = cur, name, bt
    f = clamp((t - since) / 0.5)
    if f >= 1 or prev == cur:
        return background(cur), cur
    a = background(prev).astype(np.float32) * (1 - f) + background(cur).astype(np.float32) * f
    return a.astype(np.uint8), cur


def render_scene(sc):
    f0, f1 = round(sc["t0"] * FPS), round(sc["t1"] * FPS)
    out = os.path.abspath(f"{SHOTS}/{sc['id']}.mp4")
    os.makedirs(SHOTS, exist_ok=True)
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pixel_format", "rgb24",
           "-video_size", f"{W}x{H}", "-framerate", str(FPS), "-i", "-",
           "-vf", "noise=alls=3:allf=t", "-c:v", "libx264", "-preset", "medium", "-crf", "18",
           "-pix_fmt", "yuv420p", "-threads", "3", out]
    pr = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for fr in range(f0, f1):
        t = fr / FPS
        arr, _ = bg_at(sc["bgs"], t)
        cv = Image.fromarray(arr)
        for e in sc["els"]:
            draw_el(cv, e, t)
        pr.stdin.write(cv.tobytes())
    pr.stdin.close()
    assert pr.wait() == 0, f"ffmpeg failed on scene {sc['id']}"
    print(f"scene {sc['id']}: {(f1 - f0) / FPS:.2f}s, {len(sc['els'])} elements", flush=True)


# ---------------------------------------------------------------- labels (ASS)
def col(c):
    return f"&H00{c[2]:02X}{c[1]:02X}{c[0]:02X}"


def ts(sec):
    sec = max(0.0, sec)
    h, rem = divmod(sec, 3600)
    m, s = divmod(rem, 60)
    return f"{int(h)}:{int(m):02d}:{s:05.2f}"


def write_ass(scenes):
    st = [  # name size primary outline/box borderstyle outline
        ("LBL", 56, INK, PAPER, 1, 3), ("LBLN", 56, CREAM, NIGHT, 1, 3),
        ("PIN", 48, INK, CREAM, 1, 4), ("PINN", 48, CREAM, NIGHT, 1, 4),
        ("KEY", 62, INK, YEL, 3, 14), ("TAG", 54, CREAM, INK, 3, 12),
        ("NUM", 120, RED, CREAM, 1, 5)]
    head = ["[Script Info]", "ScriptType: v4.00+", f"PlayResX: {W}", f"PlayResY: {H}",
            "WrapStyle: 2", "ScaledBorderAndShadow: yes", "", "[V4+ Styles]",
            "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, "
            "BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, "
            "BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding"]
    for n, sz, p, o, bs, ol in st:
        head.append(f"Style: {n},{FONT},{sz},{col(p)},{col(p)},{col(o)},{col(o)},1,0,0,0,100,100,0,0,{bs},{ol},0,5,0,0,0,1")
    head += ["", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"]
    ev = []
    for sc in scenes:
        for e in sc["els"]:
            if e["label"] in ("-", ""):
                continue
            night = bg_at(sc["bgs"], e["t_in"] + 0.5)[1] == "night"
            cx, cy, w, h = e["box"]
            k = e["kind"]
            if k == "text":
                style, an, x, y = e["what"], 5, cx, cy
                if style == "LBL" and night:
                    style = "LBLN"
            elif k == "pin":
                right = cx < 0.72 * W
                style, an, x, y = ("PINN" if night else "PIN"), (4 if right else 6), cx + (28 if right else -28), cy
            else:
                style, an, x, y = ("LBLN" if night else "LBL"), 8, cx, cy + h / 2 + 12
            pop = r"\fscx70\fscy70\t(0,220,\fscx100\fscy100)" if e["motion"] != "hold" else ""
            t_in = e["t_in"] + (0.12 if k in ("img", "clock", "clocks") and e["motion"] != "hold" else 0)
            ev.append(f"Dialogue: 0,{ts(t_in)},{ts(e['t_out'])},{style},,0,0,0,,"
                      f"{{\\an{an}\\pos({int(x)},{int(y)})\\fad(120,100){pop}}}{e['label']}")
    with open(ASS, "w", encoding="utf-8") as f:
        f.write("\n".join(head + ev) + "\n")
    print(f"{ASS}: {len(ev)} labels")


# ---------------------------------------------------------------- master
def master(scenes):
    with open("_concat.txt", "w", encoding="utf-8") as f:
        for s in scenes:
            shot_file = os.path.abspath(f"{SHOTS}/{s['id']}.mp4").replace("\\", "/")
            f.write(f"file '{shot_file}'\n")
    run = lambda c: subprocess.run(c, check=True)
    run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", "_concat.txt",
         "-c", "copy", "_silent.mp4"])
    # shaping=complex के बिना हिंदी के conjunct टूटते हैं
    run(["ffmpeg", "-y", "-loglevel", "error", "-i", "_silent.mp4", "-i", MIX,
         "-vf", f"ass={ASS}:shaping=complex,vignette=PI/6",
         "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-threads", "3",
         "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", OUT])
    os.remove("_concat.txt")
    os.remove("_silent.mp4")
    d = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                              "-of", "csv=p=0", OUT], capture_output=True, text=True).stdout)
    assert abs(d - DUR) < 0.3, f"master {d:.2f}s, expected {DUR}"
    print(f"{OUT} ok -- {d:.2f}s")


def selfcheck():
    global WORDS
    keep = WORDS
    WORDS = [("01", 0.0, 0.5, "क"), ("01", 0.5, 1.0, "ख"), ("02", 1.2, 1.6, "क")]
    assert find("@02", 0) == 2 and find("क", 1) == 2 and find("ख", 0) == 1
    WORDS = keep
    assert abs(back_out(1) - 1) < 1e-9 and back_out(0) == 0
    e = dict(t_in=1.0, t_out=3.0, motion="slideL", box=(500, 500, 10, 10))
    assert transform(e, 0.5) is None and transform(e, 3.5) is None
    assert transform(e, 1.0)[1] < -1000 and abs(transform(e, 2.0)[1]) < 1
    assert hm("10:58") == 658 and hm("12:00") == 0
    print("selfcheck ok")


if __name__ == "__main__":
    cmd, args = (sys.argv[1:] or ["shots"])[0], sys.argv[2:]
    if cmd == "selfcheck":
        selfcheck(); sys.exit()
    scenes = plan()
    if cmd == "plan":
        for s in scenes:
            print(f"{s['id']}  {s['t0']:6.2f}-{s['t1']:6.2f}  " +
                  "  ".join(f"{e['kind']}:{e['what'][:12]}@{e['t_in']:.2f}" for e in s["els"]))
    elif cmd == "shots":
        for s in scenes:
            if not args or s["id"] in args:
                render_scene(s)
        write_ass(scenes)
    elif cmd == "master":
        write_ass(scenes)
        master(scenes)
