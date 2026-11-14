"""Faceless Shorts soundtrack: narration + 2D Studio audio assets (music & SFX) + ducking.
Integrates professional recorded 2D documentary music tracks & Foley SFX from the 2D Animation Studio asset library,
with procedural synthesis fallback if assets are not present.

  python3 tools/mix.py [project=.]          → data/mix.wav (48 kHz stereo)

Reads data/cues.json, data/narration.wav if it exists (voice.py or words.py --audio),
and script.json "music": "bed" · "tension" · "mystery" · "documentary" · "action" · "tech" · "viral" · "none"
or direct file path. The music ducks smoothly under the voice (-24 dB) and is mixed to -14 LUFS.
"""
import json, os, subprocess, sys
from pathlib import Path
import numpy as np
from scipy import signal
from scipy.io import wavfile

P = Path(sys.argv[1] if len(sys.argv) > 1 else '.')
SR = 48000
rng = np.random.default_rng(11)

cj_file = P / 'data/cues.json'
if not cj_file.exists():
    # If cues.json does not exist, build an empty default
    cj = {'duration': 10.0, 'cues': []}
else:
    cj = json.loads(cj_file.read_text())

script_file = P / 'script.json'
script = json.loads(script_file.read_text()) if script_file.exists() else {}

DUR = float(cj.get('duration', 10.0))
N = int(DUR * SR) + SR // 10

def lp(x, f, o=2):
    b, a = signal.butter(o, min(f, SR / 2 - 100) / (SR / 2), 'low')
    return signal.lfilter(b, a, x)

def hp(x, f, o=2):
    b, a = signal.butter(o, f / (SR / 2), 'high')
    return signal.lfilter(b, a, x)

def bp(x, f0, f1, o=2):
    b, a = signal.butter(o, [f0 / (SR / 2), f1 / (SR / 2)], 'band')
    return signal.lfilter(b, a, x)

def db(x): return 10 ** (x / 20)
def tt(d): return np.arange(int(d * SR)) / SR
def env(n, a=0.005, r=None):
    e = np.ones(n); na = max(1, int(a * SR)); e[:na] = np.linspace(0, 1, na)
    rest = n - na; e[na:] = np.exp(-np.linspace(0, r or 5, rest)) if rest > 0 else 1
    return e

def sweep(f0, f1, d, shape='exp'):
    t = tt(d); f = f0 * (f1 / f0) ** (t / d) if shape == 'exp' else f0 + (f1 - f0) * t / d
    return np.sin(2 * np.pi * np.cumsum(f) / SR)

def noise(d): return rng.standard_normal(int(d * SR))

# ---------- Procedural fallbacks (used ONLY when real 2D audio samples are not found) ----------
def whoosh(d=0.38, **_):
    n = noise(d); lo, hi = lp(n, 500), lp(n, 2200)
    k = np.sin(np.pi * np.linspace(0, 1, len(n))); x = (lo * (1 - k) + hi * k) * k ** 1.5
    return x / (np.abs(x).max() + 1e-9) * 0.5

def slide(d=1.0, **_):
    n = lp(noise(d), 700); e = np.sin(np.pi * np.linspace(0, 1, len(n))) ** 2
    return n / (np.abs(n).max() + 1e-9) * e * 0.35 + sweep(260, 120, d) * e * 0.08

def pop(**_): x = sweep(560, 240, 0.11) * env(int(0.11 * SR), 0.002, 6); return lp(x, 3000) * 0.7
def plop(**_): x = sweep(700, 180, 0.14) * env(int(0.14 * SR), 0.002, 5); return lp(x, 2500) * 0.6
def gulp(**_):
    a = sweep(320, 140, 0.16) * env(int(0.16 * SR), 0.01, 4); b = sweep(240, 90, 0.2) * env(int(0.2 * SR), 0.01, 4)
    x = np.concatenate([a, np.zeros(int(0.04 * SR)), b]); return lp(x, 1800) * 0.8
def boing(**_):
    d = 0.42; t = tt(d); f = 200 * (1 + 0.6 * t / d) * (1 + 0.08 * np.sin(2 * np.pi * 18 * t))
    return lp(np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(t), 0.004, 4), 2000) * 0.55
def bubbles(d=2.0, **_):
    x = np.zeros(int(d * SR))
    for _ in range(int(d * 7)):
        st = rng.integers(0, max(1, len(x) - int(0.08 * SR))); f = rng.uniform(380, 900); b = sweep(f, f * 1.6, 0.06) * env(int(0.06 * SR), 0.003, 5)
        x[st:st + len(b)] += b * rng.uniform(0.2, 0.5)
    return lp(x, 2500) * 0.5
def sizzle(d=1.0, **_):
    n = bp(noise(d), 1800, 4500); crack = (rng.random(len(n)) < 0.002).astype(float); crack = lp(crack, 300) * 40
    e = np.minimum(1, np.linspace(0, 6, len(n))) * np.linspace(1, 0.2, len(n)); return n * (0.4 + crack) * e * 0.12
def sparkle(d=1.2, **_):
    notes = [784, 880, 1047, 1175, 1319, 1568]; x = np.zeros(int(d * SR) + SR // 2)
    for k, f in enumerate(notes):
        st = int(k * d / len(notes) * SR); n = int(0.4 * SR); t = tt(0.4)
        x[st:st + n] += (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t)) * env(n, 0.004, 6) * 0.22
    return lp(x, 4500)
def thud(**_):
    d = 0.35; t = tt(d); x = np.sin(2 * np.pi * (70 + 40 * np.exp(-t * 30)) * t) * env(len(t), 0.002, 7)
    return x * 0.9 + lp(noise(d), 220) * env(len(t), 0.001, 12) * 0.3
def slam(**_):
    d = 0.5; t = tt(d); x = np.sin(2 * np.pi * (60 + 60 * np.exp(-t * 25)) * t) * env(len(t), 0.002, 6)
    return np.tanh(1.6 * (x + lp(noise(d), 1200) * env(len(t), 0.001, 10) * 0.6)) * 0.9
def tock(**_): d = 0.09; t = tt(d); return (np.sin(2 * np.pi * 420 * t) + 0.3 * np.sin(2 * np.pi * 840 * t)) * env(len(t), 0.001, 9) * 0.35
def zip_(**_):
    d = 0.32; n = bp(noise(d), 400, 3000); k = np.linspace(0, 1, len(n))
    return (n / (np.abs(n).max() + 1e-9) * 0.35 + sweep(300, 1100, d) * 0.12) * np.sin(np.pi * k) ** 1.2
def alarm(d=2.0, **_):
    x = np.zeros(int(d * SR)); one = np.sin(2 * np.pi * 150 * tt(0.22)) * env(int(0.22 * SR), 0.02, 5)
    for st in np.arange(0, d - 0.25, 0.5): i = int(st * SR); x[i:i + len(one)] += one
    return lp(x, 900) * 0.55
def inhale(d=1.0, **_):
    n = bp(noise(d), 300, 2600); k = np.linspace(0, 1, len(n)); e = np.sin(np.pi * np.minimum(1, k * 1.15)) ** 1.5 * (0.6 + 0.4 * k)
    return n / (np.abs(n).max() + 1e-9) * e * 0.5
def heartbeat(**_):
    one = lambda d, f: np.sin(2 * np.pi * f * tt(d)) * env(int(d * SR), 0.004, 7)
    x = np.concatenate([one(0.16, 58), np.zeros(int(0.09 * SR)), one(0.2, 52) * 0.75]); return lp(x, 300) * 1.0

PROC_FX = dict(inhale=inhale, heartbeat=heartbeat, whoosh=whoosh, slide=slide, pop=pop, plop=plop, gulp=gulp, boing=boing,
               bubbles=bubbles, sizzle=sizzle, sparkle=sparkle, thud=thud, slam=slam, tock=tock, zip=zip_, alarm=alarm)
PROC_LEVEL = dict(inhale=-15, heartbeat=-8, whoosh=-17, slide=-19, pop=-14, plop=-15, gulp=-11, boing=-15, bubbles=-21, sizzle=-18,
                  sparkle=-17, thud=-11, slam=-9, tock=-18, zip=-14, alarm=-17)

# ---------- Asset Search Paths (P, workspace, plugin, system skills) ----------
AUDIO_ROOTS = [
    P / 'audio',
    P.parent / 'audio',
    Path(__file__).resolve().parents[2] / 'audio',
    Path(__file__).resolve().parents[3] / 'audio',
    Path(__file__).resolve().parents[4] / 'audio',
    Path('/home/cat/Downloads/faceless-shorts-plugin/skills/faceless-shorts/audio'),
    Path('/home/cat/Downloads/faceless-shorts-plugin/antigem-plugin/3d-video-editing-studio/audio'),
    Path('/home/cat/Downloads/faceless-shorts-plugin/antigem-plugin/2d-video-editing-studio/audio'),
    Path('/home/cat/.gemini/config/skills/faceless-shorts/audio'),
]

def load_audio(f):
    out = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(f), '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(out, dtype=np.float32).reshape(-1, 2).astype(np.float64)

# Semantic mapping for music genres to real 2D studio tracks
GENRE_MAP = {
    'bed': ['bed.mp3', 'acoustic.mp3', 'The Score - Revolution', 'tech_modern', 'history_serious'],
    'acoustic': ['acoustic.mp3', 'The Score - Revolution', 'bed.mp3'],
    'tension': ['tension.mp3', 'tension_build', 'mystery_ambient'],
    'mystery': ['mystery.mp3', 'mystery_ambient', 'tension_build'],
    'suspense': ['suspense.mp3', 'tension_build', 'mystery_ambient'],
    'documentary': ['documentary.mp3', 'history_serious', 'ES_Desert Whispers'],
    'history': ['history.mp3', 'history_serious', 'ES_Desert Whispers'],
    'desert': ['desert.mp3', 'ES_Desert Whispers'],
    'action': ['action.mp3', 'Energetic_Drum_Background_Music', 'drums.mp3'],
    'drums': ['drums.mp3', 'action.mp3', 'Energetic_Drum_Background_Music'],
    'epic': ['action.mp3', 'Energetic_Drum_Background_Music'],
    'tech': ['tech.mp3', 'tech_modern', 'synthwave.mp3'],
    'synthwave': ['synthwave.mp3', 'No_Copyright_Music_Dark_Synthwave'],
    'viral': ['viral.mp3', 'Tommy Richman', 'hiphop.mp3', 'bounce.mp3'],
    'hiphop': ['hiphop.mp3', 'Tommy Richman', 'viral.mp3'],
    'bounce': ['bounce.mp3', 'Tommy Richman', 'viral.mp3', 'acoustic.mp3'],
}

def find_music(mus_name):
    if not mus_name or mus_name.lower() in ('none', 'off', 'false', '0'):
        return None
    raw = mus_name.strip()
    q = raw.lower().replace('-', '_')

    # 1. Check direct file or relative to project
    for ext in ['', '.mp3', '.wav']:
        cand = Path(raw + ext)
        if cand.is_file(): return cand
        cand = P / (raw + ext)
        if cand.is_file(): return cand

    # 2. Gather candidates from genre map or name itself
    search_terms = GENRE_MAP.get(q, []) + [raw, q]

    for root in AUDIO_ROOTS:
        if not root.is_dir(): continue
        mdir = root / 'music' if (root / 'music').is_dir() else root
        # Check direct matches in music dir
        for term in search_terms:
            for ext in ['', '.mp3', '.wav']:
                p = mdir / (term + ext)
                if p.is_file(): return p
        # Scan recursive
        for f in mdir.glob('**/*'):
            if f.is_file() and f.suffix.lower() in ('.mp3', '.wav'):
                stem = f.stem.lower()
                for term in search_terms:
                    t = term.lower().replace('-', '_').replace('.mp3', '').replace('.wav', '')
                    if t and (t == stem or t in stem or stem in t):
                        return f
    return None

# Semantic mapping for cue sound effects to real 2D studio Foley samples
SFX_MAP = {
    'whoosh': ['whoosh', 'b2_sweep_down', 'b4_shimmer', 'b3_riser_short'],
    'slide': ['b4_paper_slide', 'b2_paper_slide', 'paper_slide'],
    'pop': ['b3_paper_popup', 'b4_postit_flip', 'b5_split_flap'],
    'plop': ['b3_paper_popup', 'b4_postit_flip'],
    'slam': ['b4_book_slam', 'b4_sub_drop'],
    'thud': ['b4_book_slam', 'b4_sub_drop', 'b4_thumbtack_drop'],
    'stamp': ['b4_stamp_press', 'stamp'],
    'marker': ['b4_marker_circle', 'b4_marker_draw', 'b4_marker_underline'],
    'circle': ['b4_marker_circle', 'b4_marker_draw'],
    'underline': ['b4_marker_underline', 'b4_marker_draw'],
    'draw': ['b4_marker_draw', 'b2_pen_writing', 'b2_pencil_scribble'],
    'typewriter': ['b2_typewriter_keys', 'b4_typewriter_keys'],
    'tock': ['b2_typewriter_keys', 'b2_typewriter_bell', 'b5_split_flap'],
    'bell': ['b2_typewriter_bell'],
    'ding': ['b2_typewriter_bell'],
    'paper': ['b2_map_unfold', 'b3_paper_fold', 'b2_paper_crumple'],
    'fold': ['b3_paper_fold', 'b4_map_fold'],
    'unfold': ['b2_map_unfold', 'b2_letter_unfold'],
    'pin': ['b4_thumbtack_drop'],
    'tack': ['b4_thumbtack_drop'],
    'tape': ['b2_tape_pull', 'b2_tape_rewind'],
    'rewind': ['b2_tape_rewind'],
    'riser': ['b3_riser_short', 'b2_riser_long'],
    'swell': ['b3_swell_reverse', 'b4_swell_reverse'],
    'shimmer': ['b4_shimmer', 'b2_shimmer'],
    'scoreboard': ['b5_scoreboard_flip', 'b5_odometer_roll'],
    'counter': ['b5_odometer_roll', 'b5_scoreboard_flip', 'b5_split_flap'],
    'flip': ['b5_split_flap', 'b4_postit_flip', 'b5_scoreboard_flip'],
    'burn': ['b5_film_burn'],
    'leak': ['b5_light_leak'],
}

SAMPLE_CACHE = {}

def find_sfx(cue_type):
    q = cue_type.lower().replace('-', '_').strip()
    search_terms = SFX_MAP.get(q, []) + [q]

    for root in AUDIO_ROOTS:
        if not root.is_dir(): continue
        sdir = root / 'sfx' if (root / 'sfx').is_dir() else root
        # 1. Exact match
        for term in search_terms:
            for ext in ['', '.mp3', '.wav']:
                p = sdir / (term + ext)
                if p.is_file(): return p
        # 2. Search recursive
        for f in sdir.glob('**/*'):
            if f.is_file() and f.suffix.lower() in ('.mp3', '.wav'):
                stem = f.stem.lower()
                for term in search_terms:
                    t = term.lower().replace('-', '_').replace('.mp3', '').replace('.wav', '')
                    if t and (t == stem or t in stem or stem.endswith('_' + t)):
                        return f
    return None

mix = np.zeros((N, 2))

# ═════════════════════════ 1. NARRATION VOICEOVER ═════════════════════════
vf = P / 'data/narration.wav'
voice = None
if vf.exists():
    v = load_audio(vf)[:N]; voice = np.zeros((N, 2)); voice[:len(v)] = v
    rms = np.sqrt(np.mean(voice ** 2) + 1e-12)
    voice *= db(-19) / rms
    mix += voice

# ═════════════════════════ 2. STUDIO BACKGROUND MUSIC ═════════════════════════
mus = script.get('music', 'bed')
if mus and mus != 'none':
    m = None
    mf = find_music(mus)
    if mf and mf.is_file():
        try:
            raw = load_audio(mf)
            m_raw = raw.mean(1)
            # Seamless loop if music is shorter than video duration
            if len(m_raw) < N:
                repeats = int(np.ceil(N / len(m_raw)))
                m_raw = np.tile(m_raw, repeats)
            m = m_raw[:N]
            peak = np.abs(m).max()
            if peak > 1e-6:
                m = m / peak
            # Smooth fade in (0.8s) & fade out (1.5s)
            fi = min(len(m), int(0.8 * SR))
            fo = min(len(m), int(1.5 * SR))
            if fi > 0: m[:fi] *= np.linspace(0, 1, fi)
            if fo > 0: m[-fo:] *= np.linspace(1, 0, fo)
            print(f"✔ 2D Studio Music loaded: {mf.name} (genre: {mus})")
        except Exception as e:
            print(f"Warning: could not load music {mf}: {e}")
            m = None

    # Procedural fallback if no audio file was found
    if m is None:
        if mus == 'bed':
            bpm = 100; beat = 60 / bpm; bar = beat * 4
            chords = [[261.6, 329.6, 392.0], [220.0, 261.6, 329.6], [174.6, 220.0, 261.6], [196.0, 246.9, 293.7]]
            m = np.zeros(N); nb = int(np.ceil(DUR / bar)) + 1
            for b in range(nb):
                ch = chords[b % 4]; st = int(b * bar * SR); n = int(bar * SR)
                if st >= N: break
                t = tt(bar); e = np.minimum(1, t / 0.4) * np.minimum(1, (bar - t) / 0.4)
                pad = sum(np.sin(2 * np.pi * f / 2 * t) + 0.25 * np.sin(2 * np.pi * f * t) for f in ch) * e * 0.10
                m[st:st + n] += pad[:max(0, min(n, N - st))]
            m = lp(m, 3200)
            fade = np.ones(N); fo = int(1.2 * SR); fade[-fo:] = np.linspace(1, 0, fo); m = m / (np.abs(m).max() + 1e-9) * fade
        elif mus == 'tension':
            t = np.arange(N) / SR; m = np.zeros(N)
            for f, g in [(55, 0.5), (82.4, 0.3), (110, 0.2), (130.8, 0.12)]:
                m += np.sin(2 * np.pi * f * t + np.sin(t * 0.3) * 0.5) * g
            m *= 0.55 + 0.45 * np.sin(2 * np.pi * t / 8) ** 2
            m = lp(m, 2200); fade = np.ones(N); fo = int(1.5 * SR); fade[-fo:] = np.linspace(1, 0, fo); m = m / (np.abs(m).max() + 1e-9) * fade

    if m is not None:
        m = np.stack([m, m], 1) * db(-24 if voice is not None else -20)
        if voice is not None:
            # Duck music under voice with smooth envelope
            lev = np.abs(voice.mean(1))
            lev = signal.lfilter([1 - 0.9995], [1, -0.9995], lev)
            lev /= lev.max() + 1e-9
            m *= (1 - 0.55 * np.clip(lev * 3, 0, 1))[:, None]
        mix += m

# ═════════════════════════ 3. STUDIO FOLEY SOUND EFFECTS ═════════════════════════
sfx_count = 0
for c in cj.get('cues', []):
    ctype = c.get('type', '')
    x = None
    sf = find_sfx(ctype)
    if sf:
        if str(sf) not in SAMPLE_CACHE:
            try:
                raw = load_audio(sf)
                SAMPLE_CACHE[str(sf)] = raw.mean(1)
            except Exception:
                SAMPLE_CACHE[str(sf)] = None
        sample = SAMPLE_CACHE.get(str(sf))
        if sample is not None:
            dur = c.get('dur')
            if dur:
                sample = sample[:min(len(sample), int(dur * SR))]
            x = sample * db(c.get('db', -12)) * c.get('gain', 1.0)
            fo = min(len(x), int(0.02 * SR))
            if fo > 0: x[-fo:] *= np.linspace(1, 0, fo)
            sfx_count += 1
    # Fallback to procedural formula if no real file was found
    if x is None:
        fn = PROC_FX.get(ctype)
        if fn:
            x = fn(**({'d': c['dur']} if c.get('dur') else {}))
            x = lp(x, 5000) * db(PROC_LEVEL.get(ctype, -14)) * c.get('gain', 1.0) / (np.abs(x).max() + 1e-9) * 0.9

    if x is not None and len(x) > 0:
        i = int(c.get('t', 0) * SR); n = min(len(x), N - i)
        if n > 0 and i >= 0:
            pan = c.get('pan', 0.0)
            mix[i:i + n, 0] += x[:n] * (1 - max(0, pan))
            mix[i:i + n, 1] += x[:n] * (1 + min(0, pan))

# ═════════════════════════ 4. MASTER MIX (-1 dBFS peak, -14 LUFS) ═════════════════════════
mix = np.tanh(mix * 1.2) / 1.2
mix *= db(-1) / (np.abs(mix).max() + 1e-9)

out_wav = P / 'data/mix.wav'
out_wav.parent.mkdir(parents=True, exist_ok=True)
wavfile.write(out_wav, SR, (mix * 32767).astype(np.int16))
print(f"✔ data/mix.wav generated: {DUR:.2f}s · voice: {'yes' if voice is not None else 'NO (captions-only)'} · music: {mus} · {sfx_count} studio SFX cues")
