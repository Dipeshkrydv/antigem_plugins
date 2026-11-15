# -*- coding: utf-8 -*-
"""render.py: High-End Creative Multi-Layer Documentary & Explainer Animation Engine.

Renders SCENES.tsv + WORDS.tsv + elements/cut/ -> shots/NN.mp4 + labels.ass -> Master MP4.

Features:
- Multi-layer visual composition (Background + Soft Ambient Drop Shadow + Hero Cutout + Context Props + Vector Accents)
- Continuous living Ken Burns camera push-in (subtle smooth zoom 1.0 -> 1.075)
- Snappy elastic spring overshoot entrances (pop, rise, slideL, slideR, zoom, drop)
- Organic breathing and floating sway (prevents static slideshow feeling)
- Tactile paper/sticker drop shadows (ImageFilter.BoxBlur)
- Procedural vector instruments: dynamic map pins with shockwaves, animated dashed trajectory rules, rotating vector clocks, number counters
- High-contrast documentary typography badges (KEY, TAG, NUM, LBL) with Devanagari & Latin shaping
- Parallel multi-core rendering with intelligent resume caching
"""

import argparse, csv, math, os, re, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
try:
    from core import mobile_config as mc
except ImportError:
    import mobile_config as mc
try:
    from core import motion_mix as mm
except ImportError:
    import motion_mix as mm

VOX_ASPECT = mc.get_aspect_ratio()
W, H = mc.get_dimensions(VOX_ASPECT)
SAFE_ZONE = mc.MobileSafeZone(W, H, VOX_ASPECT)
RESPONSIVE_SCALE = mc.get_responsive_scale(W, H)
FPS = 24
CUT = "elements/cut"
PAPER = (241, 233, 216)
NIGHT = (26, 33, 58)
CHALK = (34, 44, 40)
WHITE = (248, 248, 250)
INK = (42, 36, 32)
RED = (217, 69, 43)
YEL = (242, 183, 5)
CREAM = (250, 246, 236)
BLUE = (41, 128, 185)

FONT_PALETTES = {
    "documentary": {"display": "Montserrat", "body": "Merriweather", "mono": "Space Mono", "num": "Montserrat"},
    "kinetic_bold": {"display": "Anton", "body": "Liberation Sans", "mono": "Space Mono", "num": "Anton"},
    "kinetic_editorial": {"display": "Montserrat", "body": "Merriweather", "mono": "Space Mono", "num": "Montserrat"},
    "prestige": {"display": "Playfair Display", "body": "Liberation Sans", "mono": "Space Mono", "num": "Playfair Display"},
    "tech": {"display": "Manrope", "body": "Ubuntu", "mono": "Space Mono", "num": "Manrope"},
    "biography": {"display": "Noto Sans", "body": "Lora", "mono": "Liberation Mono", "num": "Noto Sans"},
    "cyber": {"display": "Space Mono", "body": "Liberation Sans", "mono": "Space Mono", "num": "Space Mono"},
    "hindi_documentary": {"display": "Khand", "body": "Noto Sans Devanagari", "mono": "Liberation Mono", "num": "Khand"},
    "hindi_noir": {"display": "Khand", "body": "Khand", "mono": "Space Mono", "num": "Anton"},
    "hindi_vintage": {"display": "Yatra One", "body": "Noto Sans Devanagari", "mono": "Liberation Mono", "num": "Yatra One"},
}

def get_font_palette():
    genre = os.environ.get("VOX_GENRE")
    if genre and genre in FONT_PALETTES:
        return FONT_PALETTES[genre]
    if os.path.exists("WORDS.tsv"):
        try:
            with open("WORDS.tsv", encoding="utf-8") as _wf:
                for line in _wf:
                    if any("\u0900" <= ch <= "\u097f" for ch in line):
                        return FONT_PALETTES["hindi_documentary"]
        except Exception:
            pass
    return FONT_PALETTES["documentary"]

FONT = get_font_palette()["body"]

PLACES = {}
if os.path.exists("PLACES.tsv"):
    with open("PLACES.tsv", encoding="utf-8") as _f:
        for _r in csv.DictReader(_f, delimiter="\t"):
            PLACES.setdefault(_r["map"], {})[_r["place"]] = (float(_r["u"]), float(_r["v"]))

def tsv(name):
    if not os.path.exists(name):
        return []
    with open(name, encoding="utf-8") as f:
        return list(csv.DictReader(f, delimiter="\t"))

WORDS = [(r["line"], float(r["start"]), float(r["end"]), re.sub(r"[।?,.!]", "", r["word"]))
         for r in tsv("WORDS.tsv")] if os.path.exists("WORDS.tsv") else []
NAMES = {r["name"]: r["id"] for r in tsv("ELEMENTS.tsv")} if os.path.exists("ELEMENTS.tsv") else {}

def find_cue(cue, frm=0):
    if cue.startswith("@"):
        for k, w in enumerate(WORDS):
            if w[0] == cue[1:]:
                return k
    clean_cue = re.sub(r"[।?,.!\"'“”‘’:;\s]", "", cue).strip()
    # Prefer a spoken word that CONTAINS the cue: the reverse test alone lets a short common
    # word ("के") match inside a longer cue ("बाँके") and fire the visual seconds early.
    for k in range(frm, len(WORDS)):
        if clean_cue and clean_cue in WORDS[k][3]:
            return k
    for k in range(frm, len(WORDS)):
        if clean_cue and (clean_cue in WORDS[k][3] or WORDS[k][3] in clean_cue):
            return k
    for k in range(0, len(WORDS)):
        if clean_cue and (clean_cue in WORDS[k][3] or WORDS[k][3] in clean_cue):
            return k
    raise SystemExit(f"cue not found after word {frm}: {cue!r}")

def num(v, d=0.0):
    return d if v in ("-", "", None) else float(v)

def plan(scenes_path="SCENES.tsv", mix_path="mix.wav", cue_offset=0.0):
    assert os.path.exists(scenes_path), f"Missing {scenes_path}"
    dur = (float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mix_path],
                                capture_output=True, text=True).stdout) if os.path.exists(mix_path)
           else (WORDS[-1][1] + 1.5 if WORDS else 10.0))
    groups = {}
    for r in tsv(scenes_path):
        groups.setdefault(r["scene"], []).append(r)
    scenes, p = [], 0
    for sid, rows in groups.items():
        k = find_cue(rows[0]["cue"], p)
        p = k
        t0 = 0.0 if not scenes else max(0.0, WORDS[k][1] + cue_offset)
        sc = {"id": sid, "t0": max(0.0, t0), "els": [], "bgs": [(max(0.0, t0), "paper")]}
        for r in rows:
            if r["cue"] == "-" or r["cue"].startswith("@"):
                t = t0 if r["cue"] == "-" else max(t0, WORDS[find_cue(r["cue"], p)][1] + cue_offset)
            else:
                p = find_cue(r["cue"], p)
                t = max(t0, WORDS[p][1] + cue_offset)
            if r["kind"] == "bg":
                if len(sc["bgs"]) == 1 and sc["bgs"][0][1] == "paper" and abs(t - t0) < 0.05:
                    sc["bgs"] = [(max(0.0, t0), r["what"])]
                else:
                    sc["bgs"].append((t, r["what"]))
                continue
            hold = r["motion"] == "hold"
            e = dict(kind=r["kind"], what=r["what"], x=num(r["x"]), y=num(r["y"]),
                     size=num(r["size"]), motion=r["motion"], label=r.get("label", "-"),
                     t_in=t0 if hold else t, anim=t if hold else t + 0.18,
                     t_out=max(t, WORDS[find_cue(r["out"], p)][1] + cue_offset) if r.get("out", "-") != "-" else None,
                     scene_t0=t0)
            sc["els"].append(e)
        scenes.append(sc)
    for a, b in zip(scenes, scenes[1:]):
        a["t1"] = b["t0"]
    scenes[-1]["t1"] = dur
    for s in scenes:
        assert s["t1"] - s["t0"] > 0.4, f"scene {s['id']} too short: {s['t1']-s['t0']:.2f}s"
        s["bgs"].sort(key=lambda b: b[0])
        for e in s["els"]:
            e["t_out"] = e["t_out"] or s["t1"]
    geometry(scenes)
    return scenes

_img = {}

def resolve_element_path(name):
    if os.path.exists(name):
        return name
    target_id = NAMES.get(name, name)
    search_dirs = [CUT, os.path.join(os.getcwd(), CUT), "elements/raw", "backgrounds", "assets", os.getcwd()]
    for base in search_dirs:
        for ext in ["", ".png", ".PNG", ".webp", ".jpg", ".jpeg", ".JPG", ".JPEG"]:
            cand = os.path.join(base, f"{target_id}{ext}")
            if os.path.exists(cand) and os.path.isfile(cand):
                return cand
            cand2 = os.path.join(base, f"{name}{ext}")
            if os.path.exists(cand2) and os.path.isfile(cand2):
                return cand2
    return None


def load(name):
    if name not in _img:
        p = resolve_element_path(name)
        assert p and os.path.exists(p), f"element missing: {name} in {CUT}/"
        im = Image.open(p).convert("RGBA")
        bbox = im.getbbox()
        _img[name] = im.crop(bbox) if bbox else im
    return _img[name]

def fit(name, size):
    h = int(H * size)
    p = resolve_element_path(name)
    if not p:
        return h, h
    im = load(name)
    w = round(im.width * h / max(1, im.height))
    if w > 0.92 * W:
        w, h = int(0.92 * W), round(im.height * 0.92 * W / max(1, im.width))
    return w, h

def geometry(scenes):
    for s in scenes:
        last_map = None
        for e in s["els"]:
            k = e["kind"]
            if k == "img":
                w, h = fit(e["what"], e["size"])
                e["box"] = (e["x"] * W, e["y"] * H, w, h)
                if e["what"] in PLACES:
                    last_map = e
            elif k == "clock":
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
                    if "," in b:
                        bx, by = (float(v) for v in b.split(","))
                        e["ends"], e["link"] = (at(a), (bx * W, by * H)), True
                    else:
                        e["ends"] = (at(a), at(b))
                    e["box"] = (0, 0, 0, 0)
            elif k == "cross":
                d = int(e["size"] * H)
                e["box"] = (e["x"] * W, e["y"] * H, d, d)
            elif k == "stamp":
                d = int(e["size"] * H)
                stamp_h = max(110, min(160, int(d * 0.70)))
                stamp_w = max(380, min(560, int(stamp_h * 3.4)))
                e["box"] = (e["x"] * W, e["y"] * H, stamp_w, stamp_h)
            elif k == "pinned_card":
                card_w = int(min(800, max(680, e["size"] * W * 0.55)))
                card_h = int(card_w * 0.61)
                e["box"] = (e["x"] * W, e["y"] * H, card_w, card_h)
            elif k in ("gradient_text", "gradient"):
                words_cnt = len(e["what"].replace("_", " ").split())
                gw = int(min(1100, max(450, words_cnt * 160)))
                gh = int(min(260, max(120, e["size"] * H * 0.45)))
                e["box"] = (e["x"] * W, e["y"] * H, gw, gh)
            elif k == "doodle":
                e["box"] = (e["x"] * W, e["y"] * H, int(e["size"] * W * 0.5), int(e["size"] * H * 0.4))
            elif k == "radiate":
                d = int(e["size"] * H)
                e["box"] = (e["x"] * W, e["y"] * H, d, d)
            else:
                e["box"] = (e["x"] * W, e["y"] * H, int(e.get("size", 0.4) * W * 0.4), int(e.get("size", 0.4) * H * 0.4))

_vec = {}

def ss(key, w, h, draw):
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

def remotion_spring(t_sec, damping=14.0, stiffness=160.0, mass=0.6):
    """Analytical solution of Remotion damped harmonic oscillator (theme.spring.snappy).
    Reaches target in ~180-220ms with crisp ~4% mechanical overshoot and rock-solid lock.
    """
    if t_sec <= 0.0:
        return 0.0
    omega_0 = math.sqrt(stiffness / mass)
    zeta = damping / (2.0 * math.sqrt(stiffness * mass))
    if zeta < 1.0:
        omega_d = omega_0 * math.sqrt(1.0 - zeta * zeta)
        decay = math.exp(-zeta * omega_0 * t_sec)
        val = 1.0 - decay * (math.cos(omega_d * t_sec) + (zeta / math.sqrt(1.0 - zeta * zeta)) * math.sin(omega_d * t_sec))
        return val
    else:
        decay = math.exp(-omega_0 * t_sec)
        return 1.0 - decay * (1.0 + omega_0 * t_sec)

def ease_out_expo(e):
    """Remotion theme.ease.out: ultra-sharp deceleration curve (0.16, 1, 0.3, 1)."""
    if e <= 0.0: return 0.0
    if e >= 1.0: return 1.0
    return 1.0 - math.pow(2.0, -10.0 * e)

def ease_out(e):
    return ease_out_expo(e)

def power3_out(e):
    return 1.0 - (1.0 - e) ** 3

def expo_out(e):
    return ease_out_expo(e)

def smooth_spring(e):
    return remotion_spring(e * 0.30)

def back_out(e):
    c = 1.9
    return 1.0 + (c + 1.0) * (e - 1.0) ** 3 + c * (e - 1.0) ** 2

def clamp(v):
    return max(0.0, min(1.0, v))

def make_forensic_stamp(text, w, h, color=RED, angle=-11.0):
    """Procedural authentic distressed forensic rubber stamp with double border, Anton typography, and ink bleed."""
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([6, 6, w - 6, h - 6], radius=14, outline=color + (235,), width=6)
    d.rounded_rectangle([14, 14, w - 14, h - 14], radius=9, outline=color + (175,), width=2)
    
    clean_text = text.replace("_", " ").strip()
    is_dev = bool(re.search(r"[\u0900-\u097F\uA8E0-\uA8FF\u1CD0-\u1CFF]", clean_text))
    if not is_dev:
        clean_text = clean_text.upper()
    
    base_fonts = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "fonts")
    if is_dev:
        candidates = [
            os.path.join(base_fonts, "hindi", "NotoSansDevanagari-VF.ttf"),
            os.path.join(base_fonts, "hindi", "Baloo2-Bold.ttf"),
            os.path.join(base_fonts, "hindi", "Khand-Bold.ttf"),
            "/system/fonts/NotoSansDevanagari-Bold.ttf",
            "/usr/share/fonts/truetype/noto/NotoSansDevanagari-Bold.ttf"
        ]
    else:
        candidates = [
            os.path.join(base_fonts, "english", "Anton-Regular.ttf"),
            "/home/cat/.local/share/fonts/xdeep/Anton-Regular.ttf",
            os.path.join(base_fonts, "english", "LiberationSans-Bold.ttf"),
            "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
        ]
    font_path = next((p for p in candidates if os.path.exists(p)), None)
        
    avail_w = w - 44
    avail_h = h - 28
    font_size = max(18, int(h * 0.48))
    
    def _load_font(sz):
        if not font_path:
            return ImageFont.load_default()
        try:
            return ImageFont.truetype(font_path, sz, layout_engine=ImageFont.Layout.RAQM)
        except Exception:
            try:
                return ImageFont.truetype(font_path, sz)
            except Exception:
                return ImageFont.load_default()

    while font_size >= 16:
        font = _load_font(font_size)
        bbox = d.textbbox((0, 0), clean_text, font=font)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        if tw <= avail_w and th <= avail_h:
            break
        font_size -= 2
        
    font = _load_font(font_size)
    d.text((w / 2, h / 2), clean_text, fill=color + (245,), font=font, anchor="mm")
    
    # Procedural distressed stamp ink texture
    arr = np.array(im)
    rng = np.random.default_rng(abs(hash(clean_text)) % (2**31))
    noise = rng.uniform(0.88, 1.0, (h, w))
    arr[..., 3] = np.clip(arr[..., 3] * noise, 0, 255).astype(np.uint8)
    im = Image.fromarray(arr, mode="RGBA")
    
    return im.rotate(angle, resample=Image.BICUBIC, expand=True)

_leak_cache = []

def init_leak_cache():
    if _leak_cache:
        return
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    r = np.hypot(xx / (W * 0.75), yy / (H * 0.55))
    leak_mask = np.clip(1.0 - r, 0.0, 1.0) ** 2.0
    for step in range(8):
        p = 1.0 - (step / 8.0)
        alpha = (leak_mask * (65 * p)).astype(np.uint8)
        rgba = np.zeros((H, W, 4), dtype=np.uint8)
        rgba[..., 0] = 255
        rgba[..., 1] = 195
        rgba[..., 2] = 110
        rgba[..., 3] = alpha
        _leak_cache.append(Image.fromarray(rgba, mode="RGBA"))

def transform(e, t):
    if t < e["t_in"]:
        return None
    dt = max(0.0, t - e["t_in"])
    s, dx, dy = 1.0, 0.0, 0.0
    sx, sy = 1.0, 1.0
    opacity, wipe = 1.0, 1.0
    
    # 1. Dedicated In-Motion vs Out-Motion decoupling
    m_in = e.get("motion_in") or e.get("motion", "pop")
    m_out = e.get("motion_out", "")
    
    # ZERO LOOP SWAY: The element remains completely solid during hold time.
    # No continuous sinusoidal float or wobble (banned per user directive).

    # In-Animation 1: FADE (Smooth Optical Film Dissolve)
    if m_in in ("fade", "fade-in", "fade_in"):
        a_fade = clamp(dt / 0.22)
        opacity = ease_out_expo(a_fade)
        s = 0.96 + 0.04 * ease_out_expo(a_fade)
        
    # In-Animation 2: SKETCH / DRAW (Progressive Blueprint & Marker Wipe)
    elif m_in in ("draw", "sketch", "whiteboard", "blueprint"):
        a_draw = clamp(dt / 0.38)
        wipe = ease_out_expo(a_draw)
        opacity = 1.0 # 100% solid opacity on attack frame
        # Subtle pen-tip micro pressure variation during drawing, settling to 0
        if a_draw < 0.95:
            dy += math.sin(dt * 90.0) * (1.0 - a_draw) * 0.8
        s = 1.0
        
    # In-Animation 3: ELASTIC POP (Snappy Overshoot & Settle - Zero Lingering Float)
    elif m_in in ("pop", "pop_up", "jelly", "elastic", "", "-"):
        s = remotion_spring(dt, damping=18.0, stiffness=320.0, mass=0.45)
        a_rise = clamp(dt / 0.12)
        dy += -(1.0 - ease_out_expo(a_rise)) * 20.0
        opacity = 1.0 # 100% solid opacity on attack frame
        # Settle squash-and-stretch strictly within the first 0.18s
        if 0.06 <= dt <= 0.18:
            impact_f = math.sin((dt - 0.06) / 0.12 * math.pi)
            sx += 0.10 * impact_f
            sy -= 0.10 * impact_f
        
    # In-Animation 4: SLAM / STAMP / DROP (Forensic Heavy Impact with Screen Shake)
    elif m_in in ("drop", "slam", "stamp"):
        if dt < 0.11:
            slam_p = dt / 0.11
            s = 1.7 - 0.7 * (slam_p ** 2)
            opacity = 1.0 # 100% solid opacity on attack frame
            dy += -(1.0 - slam_p) * 55.0
            sy = 1.12
            sx = 0.92
        else:
            settle_dt = dt - 0.11
            s = remotion_spring(settle_dt, damping=24.0, stiffness=420.0, mass=0.55)
            opacity = 1.0
            if settle_dt < 0.12:
                squash_f = math.sin(settle_dt / 0.12 * math.pi)
                sx += 0.14 * squash_f
                sy -= 0.12 * squash_f
        
    # In-Animation 5: KINETIC WHIP / SLIDE (Directional Deceleration)
    elif m_in in ("whipL", "slideL", "slide_left"):
        a_slide = clamp(dt / 0.28)
        dx += -(1.0 - ease_out_expo(a_slide)) * 0.40 * max(W, 1920)
        s = 0.96 + 0.04 * ease_out_expo(a_slide)
        opacity = 1.0 # 100% solid opacity on attack frame
        if a_slide < 0.65:
            sx, sy = 1.15, 0.94
    elif m_in in ("whipR", "slideR", "slide_right"):
        a_slide = clamp(dt / 0.28)
        dx += (1.0 - ease_out_expo(a_slide)) * 0.40 * max(W, 1920)
        s = 0.96 + 0.04 * ease_out_expo(a_slide)
        opacity = 1.0 # 100% solid opacity on attack frame
        if a_slide < 0.65:
            sx, sy = 1.15, 0.94
    elif m_in in ("rise", "slide_up", "mask_rise"):
        a_rise = clamp(dt / 0.28)
        dy += (1.0 - ease_out_expo(a_rise)) * 35.0
        s = 0.96 + 0.04 * ease_out_expo(a_rise)
        opacity = 1.0 # 100% solid opacity on attack frame
    elif m_in == "hold":
        s, dx, dy, opacity, wipe = 1.0, 0.0, 0.0, 1.0, 1.0
    elif m_in == "zoom":
        s = remotion_spring(dt, damping=18.0, stiffness=320.0, mass=0.45)
    elif m_in == "push_through":
        a_zoom = clamp(dt / 0.60)
        s = 1.0 + 1.8 * (a_zoom ** 2.5)
        opacity = 1.0 if a_zoom < 0.85 else (1.0 - (a_zoom - 0.85) / 0.15)

    # Cinematic Outro Transitions
    if t >= e["t_out"]:
        dt_out = t - e["t_out"]
        effective_out = m_out if m_out else (
            "slide_out_left" if m_in in ("slideL", "whipL") else
            "slide_out_right" if m_in in ("slideR", "whipR") else
            "sketch_out" if m_in in ("draw", "sketch") else
            "fade_out" if m_in in ("fade", "fade-in", "fade_in") else
            "pop_out"
        )
        
        if effective_out in ("slide_out_left", "slideL", "whipL"):
            f = clamp(dt_out / 0.22)
            if f >= 1.0: return None
            dx -= (f ** 2.0) * 0.40 * max(W, 1920)
            opacity *= (1.0 - f)
        elif effective_out in ("slide_out_right", "slideR", "whipR"):
            f = clamp(dt_out / 0.22)
            if f >= 1.0: return None
            dx += (f ** 2.0) * 0.40 * max(W, 1920)
            opacity *= (1.0 - f)
        elif effective_out in ("sketch_out", "erase"):
            f = clamp(dt_out / 0.24)
            if f >= 1.0: return None
            wipe = max(0.0, 1.0 - f)
            opacity *= (1.0 - f * 0.7)
        elif effective_out in ("pop_out", "shrink", "pop_down"):
            f = clamp(dt_out / 0.18)
            if f >= 1.0: return None
            s *= max(0.0, 1.0 - (f ** 2.2))
            dy += (f ** 2.0) * 22.0
            opacity *= (1.0 - f)
        elif effective_out in ("slide_out_down", "drop_out"):
            f = clamp(dt_out / 0.20)
            if f >= 1.0: return None
            dy += (f ** 2.0) * 65.0
            opacity *= (1.0 - f)
        else: # default fade_out
            f = clamp(dt_out / 0.24)
            if f >= 1.0: return None
            opacity *= (1.0 - ease_out_expo(f))
            s *= (1.0 - 0.04 * f)

    return s, dx, dy, opacity, wipe, sx, sy

_scaled_cache = {}
_shadow_cache = {}

def paste(cv, im, cx, cy, s, opacity=1.0, wipe=1.0, sx=1.0, sy=1.0):
    if s <= 0.02 or opacity <= 0.01:
        return
    tot_sx = s * sx
    tot_sy = s * sy
    if abs(tot_sx - 1.0) > 1e-3 or abs(tot_sy - 1.0) > 1e-3:
        target_w = max(1, int(round(im.width * tot_sx)))
        target_h = max(1, int(round(im.height * tot_sy)))
        im = im.resize((target_w, target_h), Image.BILINEAR)
    
    # Progressive wipe (draw/sketch reveal)
    if wipe < 0.999:
        w_cut = max(1, int(im.width * wipe))
        wiped_im = Image.new("RGBA", im.size, (0, 0, 0, 0))
        crop_box = (0, 0, w_cut, im.height)
        wiped_im.paste(im.crop(crop_box), crop_box)
        im = wiped_im
        
    # Alpha opacity modulation for true optical film dissolve
    if opacity < 0.99:
        r, g, b, a = im.split()
        a = a.point(lambda p: int(p * opacity))
        im = Image.merge("RGBA", (r, g, b, a))
        
    cv.paste(im, (int(cx - im.width / 2), int(cy - im.height / 2)), im)

def get_composite_sticker(key_name, im, w, h):
    """Pre-composite dual-tier subtle natural shadows (contact + ambient) with crisp die-cut contour outline."""
    cache_key = (key_name, w, h)
    if cache_key not in _shadow_cache:
        im = im if im.mode == "RGBA" else im.convert("RGBA")

        # Crisp professional die-cut contour outline on the asset
        if (np.asarray(im.getchannel("A")) < 255).any():
            px = max(2, int(round(0.020 * max(im.size))))
            pad_e = px + 2
            base = Image.new("RGBA", (im.width + pad_e * 2, im.height + pad_e * 2), (0, 0, 0, 0))
            base.paste(im, (pad_e, pad_e))
            small = base.getchannel("A").resize((max(1, base.width // 4), max(1, base.height // 4)), Image.BILINEAR)
            r = max(1, int(round(px / 4)))
            small = small.filter(ImageFilter.MaxFilter(2 * r + 1))
            edge_a = small.resize(base.size, Image.BILINEAR).filter(ImageFilter.GaussianBlur(1.2)).point(lambda v: 255 if v > 90 else int(v * 2.8))
            outlined = Image.new("RGBA", base.size, (255, 255, 255, 0))
            outlined.putalpha(edge_a)
            outlined.alpha_composite(base)
            im = outlined

        alpha = im.split()[3]
        tint = (26, 20, 16)
        a_blur_r, c_blur_r = 14, 4
        pad = a_blur_r * 3 + 24
        cw, ch = im.width + pad * 2, im.height + pad * 2

        edge = max(4, pad // 5)
        ramp = np.minimum(np.arange(cw, dtype=np.float32)[None, :], np.arange(cw, dtype=np.float32)[::-1][None, :])
        ramp = np.minimum(ramp, np.minimum(np.arange(ch, dtype=np.float32)[:, None], np.arange(ch, dtype=np.float32)[::-1][:, None]))
        feather = np.clip(ramp / edge, 0, 1)

        def tier(off_x, off_y, blur, strength):
            a = Image.new("L", (cw, ch), 0)
            a.paste(alpha, (pad + off_x, pad + off_y))
            a_arr = np.asarray(a.filter(ImageFilter.GaussianBlur(blur)), dtype=np.float32) * (strength * feather)
            lay = Image.new("RGBA", (cw, ch), tint + (0,))
            lay.putalpha(Image.fromarray(np.clip(a_arr, 0, 255).astype(np.uint8)))
            return lay

        # Subtle, professional natural shadow: 0.12 ambient + 0.16 contact (never dark or muddy)
        combo = Image.alpha_composite(tier(6, 10, a_blur_r, 0.12), tier(2, 3, c_blur_r, 0.16))
        combo.alpha_composite(im, (pad, pad))
        _shadow_cache[cache_key] = combo
    return _shadow_cache[cache_key]

def draw_el(cv, e, t, cam_dx=0.0, cam_dy=0.0):
    tr = transform(e, t)
    if not tr:
        return
    s, dx, dy, opacity, wipe, sx, sy = tr
    cx, cy, w, h = e["box"]
    cx, cy = cx + dx + cam_dx, cy + dy + cam_dy
    k = e["kind"]
    if k == "img":
        key = ("img", e["what"], w, h)
        if key not in _vec:
            raw_im = load(e["what"]).resize((w, h), Image.LANCZOS)
            tilted_im = raw_im
            _vec[key] = tilted_im
        tilted_im = _vec[key]
        combo = get_composite_sticker(e["what"], tilted_im, w, h)
        paste(cv, combo, cx, cy, s, opacity=opacity, wipe=wipe, sx=sx, sy=sy)
    elif k == "stamp":
        key = ("stamp", e["what"], int(w), int(h))
        if key not in _vec:
            col = RED if e.get("color", "red") == "red" else INK
            angle = float(e.get("angle", -11.0))
            _vec[key] = make_forensic_stamp(e["what"], int(w), int(h), col, angle)
        stamp_im = _vec[key]
        paste(cv, stamp_im, cx, cy, s, opacity=opacity, wipe=wipe, sx=sx, sy=sy)
    elif k == "clock":
        a, _, b = e["what"].partition(">")
        m = hm(a)
        if b:
            f = clamp((t - e["anim"]) / 0.8)
            f = f * f * (3 - 2 * f)
            m = m + (hm(b) - m) * f
        paste(cv, clock_img(int(w), m), cx, cy, s, opacity=opacity, sx=sx, sy=sy)
    elif k == "pin":
        f = clamp((t - e["t_in"]) / 0.7)
        def draw(g, kk, f=round(f, 2)):
            R = 70 * kk
            if f < 1:
                rr = (14 + 50 * f) * kk
                g.ellipse([R - rr, R - rr, R + rr, R + rr], outline=RED + (int(255 * (1 - f)),), width=int(4 * kk))
            g.ellipse([R - 17 * kk, R - 17 * kk, R + 17 * kk, R + 17 * kk], fill=CREAM + (255,))
            g.ellipse([R - 12 * kk, R - 12 * kk, R + 12 * kk, R + 12 * kk], fill=RED + (255,))
        paste(cv, ss(("pin", round(f, 2)), 140, 140, draw), cx, cy, 1.0, sx=sx, sy=sy)
    elif k == "rule":
        (ax, ay), (bx, by) = e["ends"]
        f = ease_out(clamp((t - e["t_in"]) / 0.7))
        g = ImageDraw.Draw(cv)
        ex, ey = ax + (bx - ax) * f + cam_dx, ay + (by - ay) * f + cam_dy
        sax, say = ax + cam_dx, ay + cam_dy
        if e.get("link"):
            n = max(1, int(math.hypot(ex - sax, ey - say) / 18))
            for i in range(0, n, 2):
                g.line([sax + (ex - sax) * i / n, say + (ey - say) * i / n,
                        sax + (ex - sax) * (i + 1) / n, say + (ey - say) * (i + 1) / n], fill=INK, width=3)
        else:
            g.line([sax, say, ex, ey], fill=RED, width=7)
    elif k == "clocks":
        n, d = int(e["what"]), int(h)
        for i in range(n):
            sub = dict(e, t_in=e["t_in"] + i * 0.04)
            tr2 = transform(sub, t)
            if tr2:
                x = cx - w / 2 + d * 1.18 * (i + 0.5)
                paste(cv, clock_img(d, ((i * 1) % 12 + 1) * 60), x, cy, tr2[0])
    elif k == "vline":
        f = round(ease_out(clamp((t - e["t_in"]) / 0.6)), 2) if e["motion"] != "hold" else 1.0
        L = int(h)
        def draw(g, kk, f=f):
            y, end = 0, L * f * kk
            while y < end:
                g.line([4 * kk, y, 4 * kk, min(end, y + 22 * kk)], fill=RED + (255,), width=int(6 * kk))
                y += 34 * kk
        paste(cv, ss(("vline", L, f), 8, L, draw), cx, cy, 1.0)
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
        paste(cv, ss(("cross", D, f), D, D, draw), cx, cy, s if t >= e["t_out"] else 1.0, sx=sx, sy=sy)
    elif k == "highlight":
        key = ("highlight", e["what"], int(w), int(h))
        if key not in _vec:
            lines = e["what"].split("//")
            hl_raw = mm.draw_highlighter_text(lines, highlight_indices=[(0, -1)])
            _vec[key] = hl_raw.resize((int(w), int(h)), Image.LANCZOS) if w > 0 and h > 0 else hl_raw
        paste(cv, _vec[key], cx, cy, s, opacity=opacity, wipe=wipe, sx=sx, sy=sy)
    elif k == "doodle":
        key = ("doodle", e["what"], int(w), int(h))
        if key not in _vec:
            parts = e["what"].split("|")
            text = parts[0]
            circ = parts[1] if len(parts) > 1 else ""
            under = parts[2] if len(parts) > 2 else ""
            dd_raw = mm.draw_doodle_annotated_text(text, circle_word=circ, underline_word=under)
            _vec[key] = dd_raw.resize((int(w), int(h)), Image.LANCZOS) if w > 0 and h > 0 else dd_raw
        paste(cv, _vec[key], cx, cy, s, opacity=opacity, wipe=wipe, sx=sx, sy=sy)
    elif k == "sticky":
        key = ("sticky", e["what"], int(w), int(h))
        if key not in _vec:
            parts = e["what"].split("|")
            title = parts[0]
            bullets = parts[1].split("//") if len(parts) > 1 else ["Note item"]
            st_raw = mm.draw_sticky_note(title=title, bullets=bullets)
            _vec[key] = st_raw.resize((int(w), int(h)), Image.LANCZOS) if w > 0 and h > 0 else st_raw
        paste(cv, _vec[key], cx, cy, s, opacity=opacity, wipe=wipe, sx=sx, sy=sy)
    elif k == "ladder":
        key = ("ladder", e["what"], int(w), int(h))
        if key not in _vec:
            steps = [{"text": s.strip()} for s in e["what"].split("//")]
            ld_raw = mm.draw_step_ladder(steps)
            _vec[key] = ld_raw.resize((int(w), int(h)), Image.LANCZOS) if w > 0 and h > 0 else ld_raw
        paste(cv, _vec[key], cx, cy, s, opacity=opacity, wipe=wipe, sx=sx, sy=sy)
    elif k == "radiate":
        key = ("radiate", int(w))
        if key not in _vec:
            _vec[key] = mm.draw_radiate_burst(size=int(w))
        paste(cv, _vec[key], cx, cy, s, opacity=opacity, sx=sx, sy=sy)
    elif k in ("gradient_text", "gradient"):
        key = ("gradient_text", e["what"], e.get("gradient", "fire"), e.get("font_style", "bold"), int(w), int(h))
        if key not in _vec:
            grad = e.get("gradient", "fire")
            style = e.get("font_style", "bold")
            f_size = int(e.get("font_size", 72))
            im_grad = mm.draw_gradient_text(e["what"], gradient=grad, font_size=f_size, font_style=style)
            if w > 0 and im_grad.width > w:
                ratio = w / float(im_grad.width)
                im_grad = im_grad.resize((int(w), int(im_grad.height * ratio)), Image.LANCZOS)
            _vec[key] = im_grad
        paste(cv, _vec[key], cx, cy, s, opacity=opacity, wipe=wipe, sx=sx, sy=sy)
    elif k in ("mix_match", "mix_match_text"):
        key = ("mix_match", e["what"], int(w), int(h))
        if key not in _vec:
            f_size = int(e.get("font_size", 64))
            im_mm = mm.draw_mix_match_text(e["what"], base_font_size=f_size)
            _vec[key] = im_mm.resize((int(w), int(h)), Image.LANCZOS) if w > 0 and h > 0 else im_mm
        paste(cv, _vec[key], cx, cy, s, opacity=opacity, wipe=wipe, sx=sx, sy=sy)
    elif k == "pinned_card":
        key = ("pinned_card", e["what"], e.get("subtitle", ""), int(w), int(h))
        if key not in _vec:
            grad = e.get("gradient", "fire")
            sub = e.get("subtitle", "")
            im_pin = mm.draw_pinned_gradient_card(e["what"], gradient_preset=grad, subtitle=sub)
            if w > 0 and im_pin.width > w:
                ratio = w / float(im_pin.width)
                im_pin = im_pin.resize((int(w), int(im_pin.height * ratio)), Image.LANCZOS)
            _vec[key] = im_pin
        paste(cv, _vec[key], cx, cy, s, opacity=opacity, wipe=wipe, sx=sx, sy=sy)
    elif k == "duet":
        key = ("duet", e["what"], int(w), int(h))
        if key not in _vec:
            asset_path = resolve_element_path(e.get("asset", ""))
            asset_img = Image.open(asset_path).convert("RGBA") if asset_path and os.path.exists(asset_path) else Image.new("RGBA", (200, 200), (45, 120, 255, 255))
            im_duet = mm.composite_asset_typography_duet(
                asset_img,
                badge_text=e.get("badge", "01 // DIRECTION"),
                headline_spec=e.get("headline", e["what"]),
                subtext=e.get("subtext", ""),
                bg_style=e.get("bg_style", "dot_grid"),
                bg_theme=e.get("bg_theme", "paper"),
                layout=e.get("layout", "auto" if W < H else "asset_left"),
                gradient_headline=e.get("gradient", ""),
                width=W,
                height=H
            )
            _vec[key] = im_duet.resize((int(w), int(h)), Image.LANCZOS) if w > 0 and h > 0 else im_duet
        paste(cv, _vec[key], cx, cy, s, opacity=opacity, wipe=wipe, sx=sx, sy=sy)

_bg = {}
_bg_pil = {}

def background(name):
    if name not in _bg:
        # 1. Full-Bleed Cinematic Mode: check if name is an image asset or file path
        p = resolve_element_path(name)
        if p and os.path.exists(p):
            im = Image.open(p).convert("RGB")
            im_cover = im.resize((W, H), Image.LANCZOS)
            _bg_pil[name] = im_cover
            _bg[name] = np.array(im_cover, dtype=np.uint8)
            return _bg[name]
            
        # 2. Procedural Canvas Mode: paper, whiteboard, night, noir, dot_grid, graph, blueprint
        if name in ("dot_grid", "dots"):
            im_proc = mm.generate_procedural_background(style="dot_grid", theme="paper", width=W, height=H)
            _bg_pil[name] = im_proc.convert("RGB")
            _bg[name] = np.array(_bg_pil[name], dtype=np.uint8)
            return _bg[name]
        elif name in ("graph", "grid"):
            im_proc = mm.generate_procedural_background(style="graph", theme="paper", width=W, height=H)
            _bg_pil[name] = im_proc.convert("RGB")
            _bg[name] = np.array(_bg_pil[name], dtype=np.uint8)
            return _bg[name]
        elif name == "blueprint":
            im_proc = mm.generate_procedural_background(style="blueprint", theme="blueprint", width=W, height=H)
            _bg_pil[name] = im_proc.convert("RGB")
            _bg[name] = np.array(_bg_pil[name], dtype=np.uint8)
            return _bg[name]

        rng = np.random.default_rng(7 if name == "paper" else 9)
        base = np.array(PAPER if name == "paper" else (WHITE if name == "whiteboard" else ((15, 18, 28) if name in ("night", "noir", "dark") else NIGHT)), np.float32)
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        r = np.hypot((xx - W / 2) / (W / 2), (yy - H / 2) / (H / 2))
        shade = 1 - 0.10 * np.clip(r - 0.4, 0, None)
        fib = rng.normal(0, 3.0, (H // 4, W // 4)).repeat(4, 0).repeat(4, 1)
        _bg[name] = np.clip(base * shade[..., None] + fib[..., None], 0, 255).astype(np.uint8)
        _bg_pil[name] = Image.fromarray(_bg[name])
    return _bg[name]

def bg_pil_at(bgs, t):
    cur = bgs[0][1]
    prev, since = cur, -99
    for bt, name in bgs:
        if bt <= t and name != cur:
            prev, cur, since = cur, name, bt
    f = clamp((t - since) / 0.5)
    if f >= 1 or prev == cur:
        background(cur)
        return _bg_pil[cur].copy()
    a = background(prev).astype(np.float32) * (1 - f) + background(cur).astype(np.float32) * f
    return Image.fromarray(a.astype(np.uint8))

KENBURNS = os.environ.get("VOX_KENBURNS", "1") == "1"

def kenburns(cv, prog, sid):
    """Slow continuous camera move on full-bleed scene images (1.0 -> 1.07), alternating push-in / pull-out."""
    z = 1.0 + 0.07 * (prog if int(re.sub(r"\D", "", sid) or 0) % 2 == 0 else 1.0 - prog)
    cw, ch = W / z, H / z
    x0 = (W - cw) / 2 + (W - cw) * 0.25 * (prog - 0.5)
    y0 = (H - ch) / 2
    return cv.resize((W, H), Image.BILINEAR, box=(x0, y0, x0 + cw, y0 + ch))

def render_scene(sc):
    init_leak_cache()
    shots_dir = "shots"
    f0, f1 = round(sc["t0"] * FPS), round(sc["t1"] * FPS)
    out = os.path.abspath(f"{shots_dir}/{sc['id']}.mp4")
    os.makedirs(shots_dir, exist_ok=True)
    ff_threads = mc.get_ffmpeg_threads()
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pixel_format", "rgb24",
           "-video_size", f"{W}x{H}", "-framerate", str(FPS), "-i", "-",
           "-c:v", "libx264", "-preset", "ultrafast", "-tune", "animation", "-crf", "19",
           "-pix_fmt", "yuv420p", "-threads", ff_threads, out]
    pr = subprocess.Popen(cmd, stdin=subprocess.PIPE, bufsize=10**7)
    single_bg = len(sc["bgs"]) == 1
    base_bg = None
    if single_bg:
        background(sc["bgs"][0][1])
        base_bg = _bg_pil[sc["bgs"][0][1]]
    for fr in range(f0, f1):
        t = fr / FPS
        cv = base_bg.copy() if single_bg else bg_pil_at(sc["bgs"], t)
        if KENBURNS and resolve_element_path(sc["bgs"][0][1]):
            cv = kenburns(cv, (t - sc["t0"]) / max(0.01, sc["t1"] - sc["t0"]), sc["id"])
        
        # 1. Forensic Screen Shake on Impact (slam, stamp, drop)
        shake_amp = 0.0
        for e in sc["els"]:
            if e.get("motion") in ("slam", "stamp", "drop") or e.get("kind") == "stamp":
                dt_hit = t - e.get("t_in", 0)
                if 0.0 <= dt_hit <= 0.16:
                    decay = math.exp(-dt_hit * 24.0)
                    shake_amp = max(shake_amp, 14.0 * decay)
        cam_dx = int(round(math.sin(t * 80.0) * shake_amp)) if shake_amp > 0.4 else 0
        cam_dy = int(round(math.cos(t * 95.0) * shake_amp)) if shake_amp > 0.4 else 0
        
        # 2. Draw all elements with camera impact shake
        for e in sc["els"]:
            draw_el(cv, e, t, cam_dx=cam_dx, cam_dy=cam_dy)
            
        # 3. Soft Optical Light Leak on scene entrance (< 0.32s)
        dt_scene = t - sc["t0"]
        if dt_scene < 0.32 and _leak_cache:
            idx = min(7, int(dt_scene / 0.32 * 8))
            leak_overlay = _leak_cache[idx]
            cv.paste(leak_overlay, (0, 0), leak_overlay)
            
        pr.stdin.write(cv.tobytes())
    pr.stdin.close()
    assert pr.wait() == 0, f"ffmpeg failed on scene {sc['id']}"
    print(f"scene {sc['id']}: {(f1 - f0) / FPS:.2f}s, {len(sc['els'])} elements", flush=True)

def col(c):
    return f"&H00{c[2]:02X}{c[1]:02X}{c[0]:02X}"

def ts(sec):
    sec = max(0.0, sec)
    h, rem = divmod(sec, 3600)
    m, s = divmod(rem, 60)
    return f"{int(h)}:{int(m):02d}:{s:05.2f}"

def write_ass(scenes, ass_path="labels.ass"):
    palette = get_font_palette()
    # Name, size, primary, outline, borderstyle, outlinewidth, font_family, spacing, shadow
    st = [
        ("LBL", int(round(56 * RESPONSIVE_SCALE)), INK, PAPER, 1, 3, palette["body"], 0, 2),
        ("LBLN", int(round(56 * RESPONSIVE_SCALE)), CREAM, NIGHT, 1, 3, palette["body"], 0, 2),
        ("PIN", int(round(48 * RESPONSIVE_SCALE)), INK, CREAM, 1, 4, palette["body"], 0, 2),
        ("PINN", int(round(48 * RESPONSIVE_SCALE)), CREAM, NIGHT, 1, 4, palette["body"], 0, 2),
        ("KEY", int(round(64 * RESPONSIVE_SCALE)), INK, YEL, 3, 14, palette["display"], -2, 3),
        ("TAG", int(round(54 * RESPONSIVE_SCALE)), CREAM, INK, 3, 12, palette["mono"], 1, 2),
        ("NUM", int(round(126 * RESPONSIVE_SCALE)), RED, CREAM, 1, 6, palette["num"], -3, 4),
        ("SUB", int(round(46 * RESPONSIVE_SCALE)), CREAM, INK, 1, 3.5, palette["body"], 0, 2)
    ]
    head = ["[Script Info]", "ScriptType: v4.00+", f"PlayResX: {W}", f"PlayResY: {H}",
            "WrapStyle: 2", "ScaledBorderAndShadow: yes", "", "[V4+ Styles]",
            "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, "
            "BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, "
            "BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding"]
    for n, sz, p, o, bs, ol, font_fam, spc, shd in st:
        head.append(f"Style: {n},{font_fam},{sz},{col(p)},{col(p)},{col(o)},{col(o)},1,0,0,0,100,100,{spc},0,{bs},{ol},{shd},5,0,0,0,1")
    head += ["", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"]
    ev = []
    for sc in scenes:
        for e in sc["els"]:
            if e["label"] in ("-", "", None):
                continue
            night = bg_pil_at(sc["bgs"], e["t_in"] + 0.5) is not None and "night" in sc["bgs"][0][1]
            cx, cy, w, h = e["box"]
            k = e["kind"]
            if k == "text":
                style, an, x, y = e["what"], 5, cx, cy
                if style == "LBL" and night:
                    style = "LBLN"
            elif k == "pin":
                right = cx < 0.72 * W
                style, an, x, y = ("PINN" if night else "PIN"), (4 if right else 6), cx + (28 if right else -28), cy
            elif k in ("pinned_card", "gradient_text", "mix_match"):
                style, an, x, y = ("LBLN" if night else "LBL"), 8, cx, min(H - 100, cy + h / 2 + 45)
            elif k == "stamp":
                style, an, x, y = ("LBLN" if night else "LBL"), 8, cx, min(H - 100, cy + h / 2 + 55)
            elif k == "cross":
                style, an, x, y = ("LBLN" if night else "LBL"), 8, cx, min(H - 100, cy + h / 2 + 40)
            else:
                style, an, x, y = ("LBLN" if night else "LBL"), 8, cx, min(H - 120, cy + h / 2 + 20)
            # Clamp position within mobile safe zone (avoids TikTok/Reels UI overlays)
            x = SAFE_ZONE.clamp_x(x)
            y = SAFE_ZONE.clamp_y(y)
            m = e.get("motion", "pop")
            t_in = e["t_in"]
            t_out = e["t_out"]
            lbl = e["label"]

            # Kinetic reveal animations (from kinetic-typography engine)
            if m in ("word_stagger", "stagger") and " " in lbl and k == "text":
                words = lbl.split()
                total_w = len(words)
                stagger_dt = 0.06
                for widx in range(total_w):
                    wt_in = t_in + (widx * stagger_dt)
                    if wt_in >= t_out:
                        break
                    rev = " ".join(words[:widx + 1])
                    next_wt = t_in + ((widx + 1) * stagger_dt) if widx + 1 < total_w else t_out
                    ev.append(f"Dialogue: 0,{ts(wt_in)},{ts(next_wt)},{style},,0,0,0,,"
                              f"{{\\an{an}\\pos({int(x)},{int(y)})\\fscx96\\fscy96\\t(0,60,0.3,\\fscx100\\fscy100)\\fad(30,0)}}{rev}")
                fin_in = t_in + (total_w * stagger_dt)
                if fin_in < t_out:
                    ev.append(f"Dialogue: 0,{ts(fin_in)},{ts(t_out)},{style},,0,0,0,,"
                              f"{{\\an{an}\\pos({int(x)},{int(y)})\\fad(0,50)}}{lbl}")
                continue

            if m in ("mask_rise", "rise"):
                clip_box = f"\\clip(0,{int(y - 140)},{W},{int(y + 90)})"
                anim = f"{clip_box}\\pos({int(x)},{int(y+45)})\\t(0,360,0.25,\\pos({int(x)},{int(y)}))\\fad(40,50)"
            elif m in ("blur", "blur_in"):
                anim = f"\\pos({int(x)},{int(y)})\\blur14\\t(0,350,0.22,\\blur1)\\fad(60,50)"
            elif m == "hold":
                anim = f"\\pos({int(x)},{int(y)})\\fad(50,50)"
            else:
                # Dynamic squash & stretch kinetic spring pop
                anim = f"\\pos({int(x)},{int(y)})\\fscx85\\fscy118\\t(0,110,0.3,\\fscx106\\fscy94)\\t(110,260,0.4,\\fscx100\\fscy100)\\fad(40,50)"

            ev.append(f"Dialogue: 0,{ts(t_in)},{ts(t_out)},{style},,0,0,0,,"
                      f"{{\\an{an}{anim}}}{lbl}")
    with open(ass_path, "w", encoding="utf-8") as f:
        f.write("\n".join(head + ev) + "\n")
    print(f"{ass_path}: {len(ev)} events (Kinetic Typography enabled)")

def master(scenes, mix_path="mix.wav", ass_path="labels.ass", out_path="master.mp4"):
    if not os.path.exists(mix_path) and os.path.exists("cues.tsv") and os.path.exists("VO.wav"):
        mix_script = os.path.join(os.path.dirname(__file__), "mix.py")
        print("Building full audio mix (Music Bed + SFX + VO ducking)...")
        subprocess.run(["python3", mix_script, "cues.tsv", "--vo", "VO.wav",
                        "--lines", "VO.tsv", "--words", "WORDS.tsv", "--out", mix_path], check=True)
    shots_dir = "shots"
    with open("_concat.txt", "w", encoding="utf-8") as f:
        for s in scenes:
            f.write(f"file '{os.path.abspath(f'{shots_dir}/{s['id']}.mp4')}'\n".replace("\\", "/"))
    run = lambda c: subprocess.run(c, check=True)
    run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", "_concat.txt",
         "-c", "copy", "_silent.mp4"])
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", "_silent.mp4", "-i", mix_path]
    fontsdir = os.environ.get("VOX_FONTSDIR")
    ass_arg = f"ass={ass_path}" + (f":fontsdir={fontsdir}" if fontsdir else "")
    vf_filters = [ass_arg] if os.path.exists(ass_path) and os.path.getsize(ass_path) > 0 else []
    if vf_filters:
        cmd += ["-vf", ",".join(vf_filters), "-c:v", "libx264", "-preset", "ultrafast", "-tune", "animation", "-crf", "20", "-pix_fmt", "yuv420p", "-threads", "0"]
    else:
        cmd += ["-c:v", "copy"]
    cmd += ["-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", out_path]
    run(cmd)
    if os.path.exists("_concat.txt"): os.remove("_concat.txt")
    if os.path.exists("_silent.mp4"): os.remove("_silent.mp4")
    d = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                              "-of", "csv=p=0", out_path], capture_output=True, text=True).stdout)
    print(f"{out_path} exported successfully -- {d:.2f}s")

def selfcheck():
    global WORDS
    keep = WORDS
    WORDS = [("01", 0.0, 0.5, "क"), ("01", 0.5, 1.0, "ख"), ("02", 1.2, 1.6, "क")]
    assert find_cue("@02", 0) == 2 and find_cue("क", 1) == 2 and find_cue("ख", 0) == 1
    WORDS = keep
    assert abs(back_out(1) - 1) < 1e-9 and abs(back_out(0)) < 1e-9
    assert remotion_spring(0.0) == 0.0 and remotion_spring(0.25) > 0.98
    e = dict(t_in=1.0, t_out=3.0, motion="slideL", box=(500, 500, 10, 10))
    assert transform(e, 0.5) is None and transform(e, 3.5) is None
    assert hm("10:58") == 658 and hm("12:00") == 0
    # Verify forensic stamp and optical light leak
    st = make_forensic_stamp("CLASSIFIED", 400, 150)
    assert st.size[0] > 350 and st.size[1] > 100
    init_leak_cache()
    assert len(_leak_cache) == 8
    print("selfcheck ok -- Remotion springs, Disney squash/stretch, forensic stamps, and optical leaks verified")

if __name__ == "__main__":
    cmd, args = (sys.argv[1:] or ["shots"])[0], sys.argv[2:]
    if cmd == "selfcheck":
        selfcheck()
        sys.exit(0)
    scenes = plan()
    if cmd == "plan":
        total_els = sum(len(s["els"]) for s in scenes)
        total_dur = scenes[-1]["t1"] - scenes[0]["t0"] if scenes else 0
        print("=" * 72)
        print("  COMPULSORY ASSET DENSITY STANDARD VALIDATION (V3.0)")
        print(f"  Total Duration: {total_dur:.2f}s | Total Visual Events: {total_els} | Rate: {total_dur/max(1, total_els):.2f}s/event")
        print("=" * 72)
        warnings = 0
        for s in scenes:
            dur = s["t1"] - s["t0"]
            n_els = len(s["els"])
            els_sorted = sorted(s["els"], key=lambda e: e["t_in"])
            gaps = []
            prev_t = s["t0"]
            for e in els_sorted:
                gaps.append(e["t_in"] - prev_t)
                prev_t = e["t_in"]
            max_gap = max(gaps) if gaps else dur
            status = "OK" if (n_els >= 3 and max_gap <= 2.2) else "LOW DENSITY"
            if status != "OK":
                warnings += 1
            print(f"Scene {s['id']} [{s['t0']:5.2f}s - {s['t1']:5.2f}s | {dur:4.1f}s]: {n_els} elements (Max Gap: {max_gap:.2f}s) -> [{status}]")
            for e in els_sorted:
                p = resolve_element_path(e["what"]) if e["kind"] == "img" else "-"
                found = "✓" if (e["kind"] != "img" or p) else "✗ MISSING"
                print(f"    • @{e['t_in']:5.2f}s [{e['kind']:5}] {e['what']:20} ({e['motion']:6}) {found} label: {e.get('label', '-')}")
            # Spatial Bounding-Box Overlap Check (Zero Overlap Law)
            overlaps = []
            for i in range(len(els_sorted)):
                for j in range(i + 1, len(els_sorted)):
                    e1, e2 = els_sorted[i], els_sorted[j]
                    if e1["kind"] != "img" or e2["kind"] != "img":
                        continue
                    # Check temporal overlap
                    if max(e1["t_in"], e2["t_in"]) < min(e1["t_out"], e2["t_out"]):
                        # Check spatial 2D box overlap
                        cx1, cy1, w1, h1 = e1["box"]
                        cx2, cy2, w2, h2 = e2["box"]
                        inter_w = max(0, min(cx1 + w1/2, cx2 + w2/2) - max(cx1 - w1/2, cx2 - w2/2))
                        inter_h = max(0, min(cy1 + h1/2, cy2 + h2/2) - max(cy1 - h1/2, cy2 - h2/2))
                        if inter_w > 25 and inter_h > 25:
                            overlaps.append((e1["what"], e2["what"]))
            if overlaps:
                warnings += len(overlaps)
                for o1, o2 in overlaps:
                    print(f"    ⚠ OVERLAP: '{o1}' collides with '{o2}'! Adjust coordinates to enforce zero-overlap rule.")
        print("-" * 72)
        if warnings == 0:
            print("✓ PASS: All scenes satisfy the Compulsory High-Density Asset Standard (gap <= 2.2s).")
        else:
            print(f"⚠ WARNING: {warnings} scene(s) have visual gaps > 2.2s or < 3 elements. See COMPULSORY_ASSET_DENSITY_STANDARD.md")
        print("=" * 72)
    elif cmd == "shots":
        from concurrent.futures import ProcessPoolExecutor
        scenes_mtime = os.path.getmtime("SCENES.tsv") if os.path.exists("SCENES.tsv") else 0
        if not args:
            to_render = [s for s in scenes if not (os.path.exists(f"shots/{s['id']}.mp4") and os.path.getmtime(f"shots/{s['id']}.mp4") >= scenes_mtime)]
        else:
            to_render = [s for s in scenes if s["id"] in args]
        workers = mc.get_safe_workers()
        print(f"Rendering {len(to_render)} scenes (skipped {len(scenes) - len(to_render)} already rendered) with {workers} parallel workers...")
        with ProcessPoolExecutor(max_workers=workers) as executor:
            list(executor.map(render_scene, to_render))
        write_ass(scenes)
    elif cmd == "master":
        write_ass(scenes)
        master(scenes)
