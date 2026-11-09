# -*- coding: utf-8 -*-
"""selftest.py: test every feature of the studio on THIS machine (Android/Termux phone, Linux, macOS, Windows).

    python studio.py selftest            full run (~1-2 min on a phone)
    python studio.py selftest --quick    skip the 1080p video render, the audio mix and the speed benchmark

It builds a throw-away project in a temp folder (synthetic voiceover, images and cut-outs: no network, no Flow, no
credits), exercises each stage, prints PASS / FAIL with timings, and deletes the folder. Exit code 1 if anything fails.

What it proves
  environment      Python, Pillow + raqm (Hindi conjuncts), numpy, scipy, ffmpeg, workers/memory
  engine           layouts do not overlap (16:9 and 9:16), all style engines load, plans exist
  workflow         new project -> plan -> lint (must REJECT a duplicate) -> prompts
  flow generation  against a FAKE Flow bridge: a run is flagged half-way, then resumed; no prompt is sent twice,
                   an identical-prompt twin is copied, a third run sends nothing
  render           every style renders non-blank frames; every item type draws; the frame cache is pixel-identical
                   to full rendering; speed benchmark with / without the cache
  tools            chroma-key + asset-sheet split, timeline cues, the Claude Code hook, the audio mix
"""
import argparse, json, os, platform, shutil, subprocess, sys, tempfile, threading, time, urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PY = sys.executable
STUDIO = os.path.join(ROOT, "studio.py")
RESULTS = []


def check(name, fn):
    t0 = time.time()
    try:
        msg, ok = fn() or "", True
    except AssertionError as e:
        msg, ok = f"assert: {e}", False
    except Exception as e:                                   # noqa: BLE001
        msg, ok = f"{type(e).__name__}: {e}", False
    RESULTS.append((name, ok))
    print(f"{'PASS' if ok else 'FAIL'}  {name:36} {time.time() - t0:5.1f}s  {msg}", flush=True)


def sh(args, cwd, env=None, ok=(0,), timeout=300):
    r = subprocess.run([PY, *args], cwd=cwd, capture_output=True, text=True, timeout=timeout,
                       env=dict(os.environ, **(env or {})))
    assert r.returncode in ok, f"exit {r.returncode}: {(r.stdout + r.stderr)[-400:]}"
    return r


# ====================================================================== synthetic project data
LINES = [("01", "चौदह सितंबर अठारह सौ छियालीस काठमांडू", 0.4), ("02", "यहीं से शुरू हुआ राणा शासन का दौर", 0.6),
         ("03", "एक सौ चार साल तक सत्ता एक खानदान की रही", 1.0)]


def make_voice(p, secs=12.0):
    sh(["-c", "import subprocess,sys; subprocess.run(['ffmpeg','-y','-v','error','-f','lavfi','-i',"
              f"'sine=f=180:d={secs}','-ar','44100','-ac','1',sys.argv[1]],check=True)", os.path.join(p, "VO.wav")], p)
    words, vo, t = [], [], 0.3
    per = (secs - 1.5) / sum(len(x[1].split()) for x in LINES)
    for lid, text, gap in LINES:
        t0 = t
        for i, w in enumerate(text.split()):
            words.append((lid, i, t, t + per * 0.85, w))
            t += per
        vo.append((lid, t0, t, text))
        t += gap * 0.3
    open(os.path.join(p, "LINES.tsv"), "w", encoding="utf-8").write("id\ttext\tgap\n" + "".join(f"{a}\t{b}\t{c}\n" for a, b, c in LINES))
    open(os.path.join(p, "VO.tsv"), "w", encoding="utf-8").write("id\tstart\tend\ttext\n" + "".join(f"{a}\t{b:.3f}\t{c:.3f}\t{d}\n" for a, b, c, d in vo))
    open(os.path.join(p, "WORDS.tsv"), "w", encoding="utf-8").write(
        "line\tword_idx\tstart\tend\tword\tsrc\n" + "".join(f"{l}\t{i}\t{s:.3f}\t{e:.3f}\t{w}\tcartesia\n" for l, i, s, e, w in words))


def make_images(p):
    import numpy as np
    from PIL import Image, ImageDraw, ImageFilter
    raw, cut = os.path.join(p, "elements", "raw"), os.path.join(p, "elements", "cut")
    os.makedirs(raw, exist_ok=True)
    os.makedirs(cut, exist_ok=True)
    for n, (c1, c2) in enumerate([((20, 30, 60), (200, 120, 60)), ((40, 20, 20), (230, 190, 90))]):
        yy = np.linspace(0, 1, 720)[:, None, None]
        arr = (np.array(c1) * (1 - yy) + np.array(c2) * yy) * np.ones((720, 1280, 3))
        im = Image.fromarray(arr.astype(np.uint8))
        d = ImageDraw.Draw(im)
        d.ellipse([500 - n * 80, 140, 780 - n * 80, 560], fill=(30, 30, 34))
        d.rectangle([100, 420, 420, 700], fill=(70, 60, 55))
        im.filter(ImageFilter.GaussianBlur(2)).save(os.path.join(raw, f"bg_{'ab'[n]}.jpg"), quality=90)
    for name, col in (("cut_a", (180, 140, 90)), ("cut_b", (90, 120, 160)), ("cut_c", (150, 80, 80))):
        im = Image.new("RGBA", (500, 600), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        d.ellipse([60, 20, 440, 580], fill=col + (255,))
        d.ellipse([160, 120, 340, 300], fill=(240, 230, 215, 255))
        d.rectangle([180, 330, 320, 560], fill=(40, 40, 50, 255))
        im.save(os.path.join(cut, f"{name}.png"))


def write_json(p, name, obj):
    json.dump(obj, open(os.path.join(p, name), "w", encoding="utf-8"), ensure_ascii=False, indent=1)


EDITS = {
    "documentary": {"style": "documentary", "scenes": [
        {"at": "@01", "bg": "white", "layout": "numeral_collage", "items": [
            {"type": "bigtext", "text": "1846", "slot": "back", "color": "accent2"},
            {"type": "asset", "name": "cut_a", "slot": "center", "halftone": "bw", "ground": True},
            {"type": "asset", "name": "cut_b", "slot": "left", "frame": "torn"},
            {"type": "note", "text": "काठमांडू", "slot": "l1"}]},
        {"at": "@02", "bg": "paper", "layout": "desk_collage", "items": [
            {"type": "title", "text": "तीन *खानदान*", "sub": "एक कुर्सी", "box": "strip"},
            {"type": "block", "shape": "circle", "color": "accent2", "slot": "back"},
            {"type": "asset", "name": "cut_a", "slot": "b"}, {"type": "asset", "name": "cut_b", "slot": "a", "frame": "torn"},
            {"type": "asset", "name": "cut_c", "slot": "c", "frame": "torn"},
            {"type": "arrow", "from": "a", "to": "b"}, {"type": "loops", "from": "c", "to": "b", "loops": 2},
            {"type": "ransom", "text": "WHY", "slot": "d"}]},
        {"at": "@03", "bg": "grid", "layout": "chart_grid", "items": [
            {"type": "kicker", "text": "DATA"}, {"type": "title", "text": "सत्ता *कितनी*", "box": "plain", "sub": "स्रोत"},
            {"type": "chart", "slot": "band", "rows": [{"label": "साल", "value": 104}, {"label": "प्रधानमंत्री", "value": 9}]}]}]},
    "sticker": {"style": "sticker", "scenes": [
        {"at": "@01", "bg": "paper", "layout": "row3", "items": [
            {"type": "asset", "name": "cut_a", "slot": "a", "label": "चीन"}, {"type": "asset", "name": "cut_b", "slot": "b", "label": "रुपये"},
            {"type": "asset", "name": "cut_c", "slot": "c", "label": "इंग्लैंड"}]},
        {"at": "@02", "bg": "mat", "layout": "flatlay", "items": [
            {"type": "keyword", "text": "क्रिएटिव", "box": "block", "slot": "title"},
            {"type": "badge", "icon": "play", "slot": "e"}, {"type": "asset", "name": "cut_a", "slot": "a", "frame": "retro", "halftone": "retro"}]}]},
    "noir": {"style": "noir", "scenes": [
        {"at": "@01", "bg": "bg_a", "layout": "hero", "items": [
            {"type": "kicker", "text": "CASE FILE"}, {"type": "title", "text": "14 सितंबर *1846*"},
            {"type": "stamp", "text": "CLASSIFIED"}, {"type": "counter", "from": 0, "to": 104, "suffix": " साल"}]},
        {"at": "@02", "bg": "bg_b", "layout": "board", "items": [
            {"type": "photo", "src": "bg_a", "slot": "a", "caption": "A"}, {"type": "photo", "src": "bg_b", "slot": "b", "caption": "B"},
            {"type": "string", "from": "a", "to": "b"}]}]},
    "box": {"style": "box", "scenes": [
        {"at": "@01", "bg": "grid", "layout": "kpi_row", "items": [
            {"type": "title", "text": "तीन *आँकड़े*"}, {"type": "counter", "from": 0, "to": 104, "slot": "a"},
            {"type": "bento_card", "title": "GROWTH", "value": "104 साल", "delta": "+38%", "progress": 0.78, "slot": "b"}]}]},
    "stickman": {"style": "stickman", "scenes": [
        {"at": "@01", "bg": "paper", "layout": "whiteboard_hero", "items": [
            {"type": "speech_bubble", "text": "दिमाग का इस्तेमाल करो!", "slot": "title"},
            {"type": "asset", "name": "cut_a", "slot": "center"}]},
        {"at": "@02", "bg": "paper", "layout": "hero", "items": [
            {"type": "highlight_sweep", "text": "सत्ता एक खानदान की रही", "slot": "title"},
            {"type": "asset", "name": "cut_b", "slot": "right"}]}]},
    "kinetic": {"style": "kinetic", "scenes": [
        {"at": "@01", "bg": "dark", "layout": "mega_word", "items": [{"type": "title", "text": "*रुकिए*"}]}]},
    "cinematic": {"style": "cinematic", "scenes": [
        {"at": "@01", "bg": "bg_b", "layout": "hero", "items": [{"type": "title", "text": "एक *नई* सुबह"}]}]},
}


# ====================================================================== fake Flow bridge (in-process)
class FakeFlow:
    def __init__(self, delay=1.4):
        self.jobs, self.sent, self.flag_after, self.delay, self.n = {}, [], 0, delay, 0
        outer = self

        class H(BaseHTTPRequestHandler):
            def log_message(self, *a):
                pass

            def do_POST(self):
                req = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
                name, a = req["params"]["name"], req["params"]["arguments"]
                out = outer.handle(name, a)
                b = json.dumps({"jsonrpc": "2.0", "id": 1, "result": {"content": [{"type": "text", "text": json.dumps(out)}]}}).encode()
                self.send_response(200)
                self.send_header("Content-Length", str(len(b)))
                self.end_headers()
                self.wfile.write(b)

        self.srv = HTTPServer(("127.0.0.1", 0), H)
        self.url = f"http://127.0.0.1:{self.srv.server_address[1]}/mcp"
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()

    def handle(self, name, a):
        if name == "flow_status":
            return {"logged_in": True}
        if name == "flow_cancel":
            return {"cancelled": 0}
        if name == "flow_generate_image":
            self.n += 1
            jid = f"j{self.n:03d}"
            fail = bool(self.flag_after) and self.n > self.flag_after
            self.sent.append(a["prompt"])
            self.refs = getattr(self, "refs", [])
            self.refs.append((a["prompt"], a.get("references")))
            self.jobs[jid] = {"t": time.time(), "prompt": a["prompt"], "fail": fail}
            return [{"job_id": jid, "status": "failed" if fail else "running", "submitted": True,
                     "error": "PUBLIC_ERROR_UNUSUAL_ACTIVITY" if fail else ""}]
        if name == "flow_get_job":
            out = []
            for i in (a.get("job_ids") or [a.get("job_id")]):
                j = self.jobs.get(i)
                if not j:
                    continue
                if j["fail"]:
                    out.append({"job_id": i, "status": "failed", "error": "PUBLIC_ERROR_UNUSUAL_ACTIVITY"})
                elif time.time() - j["t"] > self.delay:
                    p = os.path.join(self.dir, f"fake_{i}.jpg")
                    open(p, "wb").write(b"\xff\xd8fake" + j["prompt"].encode())
                    out.append({"job_id": i, "status": "done", "files": [{"path": p}]})
                else:
                    out.append({"job_id": i, "status": "running"})
            return out
        return {}


# ====================================================================== the tests
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--quick", action="store_true")
    a = ap.parse_args()
    tmp = tempfile.mkdtemp(prefix="dstudio_selftest_")
    p = os.path.join(tmp, "proj")
    print(f"platform: {platform.platform()} | python {sys.version.split()[0]} | cpus {os.cpu_count()} | temp {tmp}\n")
    sys.path.insert(0, os.path.join(ROOT, "core", "engine"))
    try:
        # ---------------------------------------------------------------- environment
        def env():
            from PIL import features, __version__
            import numpy
            assert shutil.which("ffmpeg") and shutil.which("ffprobe"), "ffmpeg/ffprobe not found on PATH"
            assert features.check("raqm"), ("Pillow has no RAQM: Hindi conjuncts (क्ष, त्र, ज्ञ) and matras will render WRONG. "
                                            "Linux: apt install libraqm0 libfribidi0; Termux: pkg install python-pillow; "
                                            "Windows/macOS: pip install -U pillow")
            try:
                import scipy  # noqa: F401
                sc = "scipy ok"
            except ImportError:
                sc = "scipy MISSING (needed for chroma-key / sheets: pip install scipy)"
            try:
                import cv2  # noqa: F401
                cv = "opencv ok (faster camera moves)"
            except ImportError:
                cv = "opencv not installed (optional: pip install opencv-python-headless)"
            sys.path.insert(0, os.path.join(ROOT, "core", "engine"))
            import render
            return f"pillow {__version__}, raqm, numpy, {sc}; {cv}; render workers: {render.default_workers()}"
        check("environment", env)

        def engine():
            import layouts, styles
            assert layouts.selfcheck(), "layout slots overlap"
            names = [n for n, _ in styles.list_styles()]
            assert len(names) >= 5, names
            for n in names:
                pl = styles.plan_for(n)
                assert pl["beat_s"] > 0 and abs(sum(pl["mix"].values()) - 1) < 0.05, n
            return f"{len(names)} styles: {', '.join(names)}"
        check("layouts + style engines", engine)

        # ---------------------------------------------------------------- workflow
        def newproj():
            sh([STUDIO, "new", p], tmp)
            for f in ("core", "studio.py", "EDIT.json", "SHOTS.json"):
                assert os.path.lexists(os.path.join(p, f)), f
            make_voice(p, 12.0)
            make_images(p)
            return "project + synthetic voice/images created"
        check("studio.py new (+ test data)", newproj)

        def plan():
            sh([STUDIO, "plan", "--style", "documentary"], p)
            pl = json.load(open(os.path.join(p, "PLAN.json"), encoding="utf-8"))
            assert pl["images"] > 0 and pl["total_beats"] >= 3
            return f"{pl['total_beats']} beats -> {pl['images']} images {pl['counts']}"
        check("plan (style-aware)", plan)

        def lint():
            shot = lambda n, subj, line, cue: {"name": n, "kind": "scene", "subject": subj, "location": "palace courtyard",
                                              "time": "midnight", "lighting": "torches", "palette": "teal and amber", "mood": "tense",
                                              "focal": "the gate", "line": line, "cue": cue}
            dup = {"style": "documentary", "shots": [shot("s1", "armed soldiers wait at the palace gate", "01", "काठमांडू"),
                                                      shot("s2", "armed soldiers wait at the palace gate", "01", "काठमांडू")]}
            write_json(p, "SHOTS.json", dup)
            plan_json = os.path.join(p, "PLAN.json")
            if os.path.exists(plan_json):
                os.remove(plan_json)                            # coverage-vs-plan is a different check; test duplicates alone
            r = subprocess.run([PY, STUDIO, "lint"], cwd=p, capture_output=True, text=True)
            out = r.stdout + r.stderr
            assert r.returncode == 1 and ("same picture" in out or "IDENTICAL" in out), \
                "lint must REJECT two shots describing the same picture:\n" + out[-300:]
            ok = {"style": "documentary", "shots": [shot("s1", "armed soldiers wait at the palace gate", "01", "काठमांडू"),
                                                     {"name": "c1", "kind": "asset", "subject": "a vintage portrait photograph of a stern general",
                                                      "material": "albumen print", "view": "straight-on", "line": "02", "cue": "राणा"}]}
            write_json(p, "SHOTS.json", ok)
            sh([STUDIO, "prompts"], p)
            rows = open(os.path.join(p, "ELEMENTS.tsv"), encoding="utf-8").read().strip().splitlines()
            assert len(rows) == 3, rows
            return "duplicate rejected; clean list -> 2 prompts"
        check("lint rejects duplicates + prompts", lint)

        # ---------------------------------------------------------------- Flow: fake bridge, resume, no duplicates
        def flow():
            fd = os.path.join(tmp, "flow")
            os.makedirs(os.path.join(fd, "elements", "raw"))
            rows = ["id\tname\tprompt\tkind\taspect_ratio\tparts"] + [f"a{i}\ta{i}\tprompt number {i}\tbg\t16:9\t" for i in range(1, 7)]
            rows.append("twin\ttwin\tprompt number 2\tbg\t16:9\t")                          # identical prompt to a2
            open(os.path.join(fd, "ELEMENTS.tsv"), "w", encoding="utf-8").write("\n".join(rows) + "\n")
            fake = FakeFlow()
            fake.dir = fd
            env_ = {"FLOW_MCP_URL": fake.url, "FLOW_GUARD_LEDGER": os.path.join(fd, "ledger.json"), "FLOW_GUARD_GAP": "0.05"}
            gen = os.path.join(HERE, "flow_safe.py")
            fake.flag_after = 3
            sh([gen], fd, env_, ok=(2,))                                                     # run 1: flagged after 3 accepted
            st = sh([gen, "--status"], fd, env_).stdout
            assert "3 inflight" in st, st
            fake.flag_after = 0
            sh([os.path.join(HERE, "flow_guard.py"), "reset"], fd, env_)
            time.sleep(fake.delay + 0.3)
            sh([gen], fd, env_, ok=(0,))                                                    # run 2: resume
            counts = {}
            for s in fake.sent:
                counts[s] = counts.get(s, 0) + 1
            dup = {k: v for k, v in counts.items() if v > 1 and k != "prompt number 4"}       # #4 was rejected once: a legit retry
            assert not dup, f"prompts sent more than once: {dup}"
            assert counts["prompt number 2"] == 1, "the identical-prompt twin must be COPIED, not generated"
            assert all(os.path.exists(os.path.join(fd, "elements", "raw", f"{n}.jpg")) for n in ["a1", "a2", "a3", "a4", "a5", "a6", "twin"])
            before = fake.n
            sh([gen], fd, env_, ok=(0,))                                                    # run 3: nothing left
            assert fake.n == before, "a third run must submit nothing"
            fake.srv.shutdown()
            return f"{fake.n} submissions for 7 images; resumed without resending; twin copied"
        check("flow: flag -> resume, no duplicates", flow)

        def flow_refs():
            fd = os.path.join(tmp, "flow_refs")
            os.makedirs(os.path.join(fd, "elements", "raw"))
            rows = ["id\tname\tprompt\tkind\taspect_ratio\tparts\tref",
                    "mira_talk\tmira_talk\tpose talk\tprop\t3:4\t\tmira_idle",     # listed BEFORE its master on purpose
                    "mira_idle\tmira_idle\tpose idle master\tprop\t3:4\t\t",
                    "mira_wow\tmira_wow\tpose wow\tprop\t3:4\t\tmira_idle",
                    "bg_x\tbg_x\ta background\tbg\t16:9\t\t"]
            open(os.path.join(fd, "ELEMENTS.tsv"), "w", encoding="utf-8").write("\n".join(rows) + "\n")
            fake = FakeFlow(delay=0.6)
            fake.dir = fd
            env_ = {"FLOW_MCP_URL": fake.url, "FLOW_GUARD_LEDGER": os.path.join(fd, "ledger.json"), "FLOW_GUARD_GAP": "0.05"}
            gen = os.path.join(HERE, "flow_safe.py")
            sh([gen], fd, env_, ok=(0,))
            order = [p for p, _ in fake.refs]
            assert order.index("pose idle master") < order.index("pose talk") and order.index("pose idle master") < order.index("pose wow"), \
                f"master must be sent before its poses: {order}"
            for prm, ref in fake.refs:
                if prm.startswith("pose ") and prm != "pose idle master":
                    assert ref and ref[0].endswith(os.path.join("elements", "raw", "mira_idle.jpg")), f"{prm!r} sent without the master reference: {ref}"
                else:
                    assert not ref, f"{prm!r} should have no reference"
            n = fake.n
            sh([gen], fd, env_, ok=(0,))
            assert fake.n == n, "re-run must send nothing"
            fake.srv.shutdown()
            return f"master first, {sum(1 for _, r in fake.refs if r)} poses sent with the master as Flow reference, re-run sends nothing"
        check("flow: character poses use master reference", flow_refs)

        # ---------------------------------------------------------------- render: every style + every item type
        def styles_render():
            import numpy as np
            from PIL import Image
            done = []
            for st, edit in EDITS.items():
                write_json(p, f"E_{st}.json", edit)
                sh([STUDIO, "still", "3.0", "7.5", "--edit", f"E_{st}.json"], p)
                for t in ("3.0", "7.5"):
                    im = np.asarray(Image.open(os.path.join(p, "_stills", f"t{float(t):07.2f}.png")).convert("L"), dtype=np.float32)
                    assert im.std() > 4, f"{st} @ {t}s rendered a blank frame"
                done.append(st)
            return f"{len(done)} styles render non-blank frames: {', '.join(done)}"
        check("render: all styles + item types", styles_render)

        def cache_identical():
            import numpy as np
            old = os.getcwd()
            os.chdir(p)
            try:
                import render
                times = [0.2 + 0.41 * i for i in range(28)]
                bad = []
                for st in ("documentary", "sticker", "noir"):
                    render.Engine.NO_CACHE = False
                    fast = render.Engine(f"E_{st}.json", 0.4)
                    render.Engine.NO_CACHE = True
                    slow = render.Engine(f"E_{st}.json", 0.4)
                    keys = {}
                    for t in times:
                        render.Engine.NO_CACHE = False
                        f1 = np.asarray(fast.frame(t))
                        render.Engine.NO_CACHE = True
                        f2 = np.asarray(slow.frame(t))
                        if not np.array_equal(f1, f2):
                            bad.append(f"{st}@{t:.2f}")
                    # frames the renderer will REUSE (equal keys) must really be identical to a full render
                    render.Engine.NO_CACHE = False
                    seen = {}
                    for i in range(int(6 * 24)):
                        t = i / 24
                        k = fast.frame_key(t)
                        if k is None:
                            continue
                        f = np.asarray(fast.frame(t))
                        if k in seen:
                            if not np.array_equal(f, seen[k][1]):
                                bad.append(f"reuse {st}@{t:.2f} (same key as {seen[k][0]:.2f})")
                        else:
                            seen[k] = (t, f)
                assert not bad, f"cache changed pixels at: {bad[:6]}"
            finally:
                render.Engine.NO_CACHE = False
                os.chdir(old)
            return "cached frames == fully rendered frames (3 styles x 28 times) and frame reuse is exact"
        check("render: frame cache is pixel-exact", cache_identical)

        # ---------------------------------------------------------------- v3: natural shadows, variety, kicker, character
        def natural_shadows():
            import numpy as np
            from PIL import Image
            import kit
            sp = Image.new("RGBA", (300, 200), (200, 60, 50, 255))          # content touches every edge (worst case)
            out = []
            for blur, dy in ((18, 14), (9, 7), (24, 20)):
                im = kit.shadow(sp, blur=blur, dy=dy, alpha=0.65)
                a = np.asarray(im.getchannel("A"))
                border = max(a[0].max(), a[-1].max(), a[:, 0].max(), a[:, -1].max())
                assert border == 0, f"shadow cut by the sprite edge (border alpha {border}) at blur {blur}"
                row = a[:, a.shape[1] // 2].astype(int)
                below = row[200 + (im.height - 200) // 2:]
                assert np.abs(np.diff(below)).max() <= 40, "shadow has a hard step (not a soft falloff)"
                out.append(f"blur {blur}: soft, border 0")
            g = np.asarray(kit.ground_shadow(200, 30).getchannel("A"))
            assert max(g[0].max(), g[-1].max(), g[:, 0].max(), g[:, -1].max()) == 0, "ground shadow has a hard edge"
            return "; ".join(out) + "; ground shadow feathered"
        check("v3: natural shadows (no hard cut)", natural_shadows)

        def variety_engine():
            import variety
            spec = {"scenes": [{"items": [{"type": "kicker", "text": "K"}, {"type": "stamp", "text": f"S{i}"}]} for i in range(7)]}
            rep = variety.direct(spec, "noir", {"transition": "dip"})
            fams = rep["emphasis"]
            assert fams.count("rubber") <= 2, f"rubber stamp used {fams.count('rubber')}x (budget 2): {fams}"
            assert all(a != b for a, b in zip(fams, fams[1:])), f"consecutive emphasis beats share a design: {fams}"
            ks = rep["kickers"]
            assert all(a != b for a, b in zip(ks, ks[1:])), f"consecutive kickers share a design: {ks}"
            tr = [s.get("transition") for s in spec["scenes"][1:]]
            assert len(set(tr)) >= 3, f"transitions never vary: {tr}"
            return f"7 stamps -> {', '.join(fams)}; kickers {len(set(ks))} designs; transitions {len(set(tr))} kinds"
        check("v3: creative variety engine", variety_engine)

        def kicker_size():
            import kit, styles
            look = styles.get("noir")["look"]
            hs = {}
            for v in kit.KICKER_VARIANTS:
                sp = kit.kicker("CASE FILE #BUR-2018 // DELHI", v, look, 46, 960, on_image=True, index=3)
                bb = sp.getchannel("A").point(lambda q: 255 if q > 128 else 0).getbbox()   # visible ink, not shadow
                hs[v] = bb[3] - bb[1]
                assert hs[v] >= 34, f"kicker {v} only {hs[v]}px tall at 1080p -- unreadable on a phone"
            return "kicker heights @1080p: " + ", ".join(f"{k} {v}px" for k, v in hs.items())
        check("v3: kicker readable size (5 designs)", kicker_size)

        def character_mode():
            import numpy as np
            edit = {"style": "toon", "aspect": "16:9", "scenes": [
                {"at": "@01", "layout": "stage", "stage": {"particles": "petals"}, "items": [
                    {"type": "kicker", "text": "NEPAL"},
                    {"type": "character", "cast": "mira", "x": 0.3, "from": "left",
                     "actions": [{"at": "अठारह", "do": "walk", "to": 1.2}, {"at": "काठमांडू", "do": "react", "pose": "wow"},
                                 {"at": "काठमांडू", "do": "say", "text": "नेपाल बहुत सुंदर है!"}]}]},
                {"at": "@02", "layout": "presenter", "bg": "bg_a", "items": [
                    {"type": "title", "text": "*104* साल"}, {"type": "asset", "name": "cut_a", "slot": "left"},
                    {"type": "character", "cast": "mira", "actions": [{"at": "राणा", "do": "point"}]}]}]}
            write_json(p, "E_char.json", edit)
            old = os.getcwd()
            os.chdir(p)
            try:
                import render
                e = render.Engine("E_char.json", 0.5)
                ch = [i for i in e.scenes[0]["items"] if i.type == "character"][0]
                xs = [ch.x_at(t) for t in (0.5, 1.5, 2.5, 3.5)]
                assert xs[0] < xs[-1], f"character never walked: {xs}"
                cams = [e.scenes[0]["_stage"].cam_at(t) for t in (0.5, 3.5)]
                assert cams[1] > cams[0] + 0.05, f"stage camera did not track the walk: {cams}"
                talk = [t for t in np.arange(0.4, 3.0, 1 / 24) if ch.speaking(t)]
                assert talk, "no lip-flaps while words are spoken"
                frames = [np.asarray(e.frame(t)).astype(np.int16) for t in (0.6, 2.0, 3.4)]
                assert all(f.std() > 4 for f in frames), "blank stage frame"
                assert np.abs(frames[0] - frames[1]).mean() > 1.0, "stage frames identical: nothing moves"
                pres = e.frame(e.scenes[1]["t0"] + 1.5)
                assert np.asarray(pres).std() > 4
            finally:
                os.chdir(old)
            return (f"walk {xs[0]:.2f}->{xs[-1]:.2f}, camera tracked {cams[0]:.2f}->{cams[1]:.2f}, "
                    f"{len(talk)} talking frames, stage + presenter render")
        check("v3: character mode (walk/talk/stage)", character_mode)

        if not a.quick:
            def bench():
                """Per-frame throughput in ONE process (end-to-end timings of a tiny job are dominated by process start-up)."""
                import render
                old = os.getcwd()
                os.chdir(p)
                try:
                    rows = []
                    for st in ("documentary", "sticker", "noir"):
                        res = {}
                        for label, nc in (("before", True), ("after", False)):
                            render.Engine.NO_CACHE = nc
                            e = render.Engine(f"E_{st}.json", 0.5)
                            e.frame(0.3)
                            t0, prev, pk = time.time(), None, None
                            for i in range(180):
                                k = e.frame_key(i / 24) if not nc else None
                                if k is None or k != pk:
                                    prev, pk = e.frame(i / 24).tobytes(), k
                            res[label] = 180 / (time.time() - t0)
                        assert res["after"] > res["before"] * 0.85, f"{st}: the cache made rendering slower ({res})"
                        rows.append(f"{st} {res['before']:.0f}->{res['after']:.0f} fps")
                finally:
                    render.Engine.NO_CACHE = False
                    os.chdir(old)
                return "540p per-frame, " + ", ".join(rows)
            check("render: speed benchmark", bench)

            def full():
                t0 = time.time()
                sh([STUDIO, "render", "--edit", "E_documentary.json", "--to", "4", "--out", "full.mp4"], p, timeout=600)
                out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_name,width,height", "-of", "csv=p=0",
                                      os.path.join(p, "full.mp4")], capture_output=True, text=True).stdout.split()
                assert any("1920,1080" in x for x in out) and any("aac" in x for x in out), out
                return f"4 s of 1080p + audio in {time.time() - t0:.1f}s"
            check("render: 1080p video + audio mux", full)

        # ---------------------------------------------------------------- tools
        def keysplit():
            from PIL import Image, ImageDraw
            im = Image.new("RGB", (1024, 1024), (255, 0, 255))
            d = ImageDraw.Draw(im)
            d.ellipse([80, 80, 420, 420], fill=(200, 40, 40))
            d.rectangle([600, 120, 920, 400], fill=(40, 40, 200))
            d.polygon([(250, 560), (420, 920), (80, 920)], fill=(40, 160, 40))
            d.rectangle([620, 580, 920, 940], fill=(230, 200, 40))
            im.save(os.path.join(p, "elements", "raw", "sheet_t.jpg"), quality=92)
            open(os.path.join(p, "ELEMENTS.tsv"), "w", encoding="utf-8").write(
                "id\tname\tprompt\tkind\taspect_ratio\tparts\nsheet_t\tsheet_t\tx\tsheet\t1:1\tw1,w2,w3,w4|2x2\n")
            sh([STUDIO, "key"], p)
            for n in ("w1", "w2", "w3", "w4"):
                assert os.path.exists(os.path.join(p, "elements", "cut", f"{n}.png")), n
            return "magenta key + 2x2 sheet split -> 4 cut-outs"
        check("key + asset-sheet split", keysplit)

        def timeline():
            os.chdir(p)
            from timeline import Timeline
            tl = Timeline("WORDS.tsv")
            assert tl.resolve("@02") > tl.resolve("@01") and not tl.estimated_lines
            assert tl.resolve("राणा") > 0 and len(tl.phrases()) >= 3
            os.chdir(tmp)
            return f"{len(tl.words)} exact words; cues + caption phrases ok"
        check("timeline cues + captions", timeline)

        def hook():
            h = os.path.join(ROOT, "hooks", "flow_guard_hook.py")
            led = {"FLOW_GUARD_LEDGER": os.path.join(tmp, "hook_ledger.json"), "FLOW_GUARD_GAP": "0.05"}
            two = json.dumps({"hook_event_name": "PreToolUse", "tool_input": {"items": [{"prompt": "a"}, {"prompt": "b"}]}})
            one = json.dumps({"hook_event_name": "PreToolUse", "tool_input": {"prompt": "a"}})
            r2 = subprocess.run([PY, h], input=two, capture_output=True, text=True, env=dict(os.environ, **led))
            r1 = subprocess.run([PY, h], input=one, capture_output=True, text=True, env=dict(os.environ, **led))
            assert r2.returncode == 2 and r1.returncode == 0, (r2.returncode, r1.returncode)
            return "multi-prompt Flow call blocked, single call allowed"
        check("Claude Code Flow hook", hook)

        if not a.quick:
            def mix():
                open(os.path.join(p, "cues.tsv"), "w", encoding="utf-8").write(
                    "label\tkind\tfile\tat\tdur\tgain_db\tfade_in\tfade_out\n"
                    "bed\tloop\taudio/music/crime_and_suspense/mystery_ambient.mp3\t0.0\tall\t-24\t1.5\t2.5\n")
                sh([STUDIO, "mix"], p, timeout=300)
                assert os.path.getsize(os.path.join(p, "mix.wav")) > 100000
                return "music bed + voice -> mix.wav"
            check("audio mix", mix)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    bad = [n for n, ok in RESULTS if not ok]
    print(f"\n{len(RESULTS) - len(bad)}/{len(RESULTS)} checks passed" + (f"  FAILED: {', '.join(bad)}" if bad else "  ✓ everything works on this machine"))
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
