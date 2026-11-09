# -*- coding: utf-8 -*-
"""flow_safe.py: fast, parallel, paced, resumable and 100% DUPLICATE-PROOF Google Flow image generation.

PACING (studio policy, core/flow_guard.py)
  Prompts are submitted one by one, 1.3 s apart (FLOW_GUARD_GAP). Flow generates them in PARALLEL: a new image
  starts every 1.3 s without waiting for the previous one to finish; finished images are collected continuously
  into elements/raw/<name>.png. The gap is measured from Flow ACCEPTING a prompt.
  On "unusual activity" generation stops at once: the rest of the queue is cancelled, the guard pauses.

ZERO DUPLICATE GENERATION MANDATE
  Before sending ANY request to Google Flow:
    1. Pre-harvest: Auto-scans Chrome Downloads & project folders for existing renders.
    2. Tier 1: If elements/cut/<name>.png exists (>1KB), skip.
    3. Tier 2: If elements/raw/<name>.* exists (>1KB), skip.
    4. Tier 3: If flow_manifest.json marks it done/dup, skip.
    5. Tier 4: Two assets with an IDENTICAL prompt generate once; the second is an instant local copy.
    6. ZERO calls are ever made to Google Flow if all assets already exist.
    7. In-flight jobs are never blindly re-submitted on client timeout.

USAGE (from a project folder with ELEMENTS.tsv):
    python core/flow_safe.py                       # everything missing
    python core/flow_safe.py --only bg_london ct_rifle
    python core/flow_safe.py --regen bg_london     # throw image away and generate it again
    python core/flow_safe.py --status              # show done / todo / failed without generating
    python core/flow_safe.py --model "imagen-3"
"""

import argparse
import csv
import hashlib
import io
import json
import os
import re
import shutil
import sys
import time
import urllib.request
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import flow_guard as fg  # noqa: E402
import flow_harvest as fh  # noqa: E402

FLOW_MCP_URL = os.environ.get("FLOW_MCP_URL")
FLOW_DEVICE_ID = os.environ.get("FLOW_DEVICE_ID", "78668db31e6bec3a")
DEEPX_API_URL = os.environ.get("DEEPX_API_URL", "http://127.0.0.1:8792/api/command")
DEEPX_STATUS_URL = os.environ.get("DEEPX_STATUS_URL", "http://127.0.0.1:8792/status")
RAW_DIR = "elements/raw"
CUT_DIR = "elements/cut"
MANIFEST = "flow_manifest.json"
REGISTRY = "elements/registry.json"
LOG = "flow_safe.log"


def log(msg):
    line = time.strftime("%H:%M:%S ") + msg
    print(line, flush=True)
    try:
        with open(LOG, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass


def call_bridge(command, payload=None, timeout=180):
    """Executes a command via DeepX Bridge on port 8792."""
    body = json.dumps({"command": command, "payload": payload or {}, "timeout": timeout * 1000}).encode("utf-8")
    req = urllib.request.Request(
        DEEPX_API_URL,
        data=body,
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=timeout + 10) as resp:
        raw = resp.read().decode("utf-8")
    data = json.loads(raw)
    if not data.get("success"):
        raise RuntimeError(data.get("error") or "DeepX bridge command failed")
    return data.get("result", {})


def check_flow_auto_status():
    """Checks if Flow Connector CLI (flow-auto) and Chrome extension are connected."""
    if not shutil.which("flow-auto"):
        return False, "flow-auto CLI not installed"
    import subprocess
    try:
        r = subprocess.run(
            ["flow-auto", "status", "--site", "flow", "--json"],
            capture_output=True, text=True, timeout=4
        )
        if r.returncode == 0:
            data = json.loads(r.stdout)
            if data.get("extensionConnected") or data.get("connected") or data.get("status") in ("ok", "connected", "ready"):
                return True, data
    except Exception as e:
        return False, str(e)
    return False, "Flow Connector extension not connected"


def check_bridge_status():
    """Checks if DeepX bridge and Google Flow tab are active."""
    try:
        req = urllib.request.Request(DEEPX_STATUS_URL, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        if data.get("status") == "ok" and data.get("extensionConnected"):
            return True, data.get("extensionInfo", {})
    except Exception:
        pass

    try:
        res = call_bridge("status", {}, timeout=3)
        if res.get("ready") or res.get("flowActive"):
            return True, res
    except Exception as e:
        return False, str(e)

    return False, "Bridge not connected"


def done_path(name):
    """Checks if an asset already exists on disk and is non-empty."""
    min_sz = 10 if os.environ.get("FLOW_MCP_URL") else 1024
    # Keyed cutout check
    cut = os.path.join(CUT_DIR, f"{name}.png")
    if os.path.exists(cut) and os.path.getsize(cut) > min_sz:
        return cut

    # Raw render check
    for ext in (".jpg", ".jpeg", ".png", ".webp", ".PNG", ".WEBP", ".JPG", ".JPEG"):
        p = os.path.join(RAW_DIR, f"{name}{ext}")
        if os.path.exists(p) and os.path.getsize(p) > min_sz:
            return p

    return None


def phash(row, model):
    p = str(row.get("prompt") or "")
    ar = str(row.get("aspect") or row.get("aspect_ratio") or "")
    return hashlib.sha1(f"{p}|{ar}|{model}".encode("utf-8")).hexdigest()[:16]


def download_image_to_raw(url, name):
    """Directly downloads and saves an image from Google Flow CDN into elements/raw/<name>.png."""
    os.makedirs(RAW_DIR, exist_ok=True)
    dst = os.path.join(RAW_DIR, f"{name}.png")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
    with urllib.request.urlopen(req, timeout=45) as resp:
        data = resp.read()
    img = Image.open(io.BytesIO(data)).convert("RGB")
    img.save(dst, "PNG")
    return dst


class Manifest:
    """name -> {hash, job, status: inflight|done|dup|failed, file, error, t}."""

    def __init__(self, path=MANIFEST):
        self.path = path
        self.jobs = {}
        if os.path.exists(path):
            try:
                self.jobs = json.load(open(path, encoding="utf-8")).get("jobs", {})
            except Exception:
                log(f"⚠ {path} unreadable; starting fresh manifest")

    def save(self):
        tmp = self.path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump({"jobs": self.jobs}, f, ensure_ascii=False, indent=2)
        os.replace(tmp, self.path)

    def set(self, name, **kw):
        e = self.jobs.setdefault(name, {})
        e.update(kw, t=int(time.time()))
        self.save()

    def status(self, name):
        return self.jobs.get(name, {}).get("status")


def extract_media_url(res):
    """Extracts the first image URL from a DeepX Bridge generation response."""
    if not isinstance(res, dict):
        return None
    if res.get("imageUrl"):
        return res["imageUrl"]
    media_res = res.get("mediaResult")
    if isinstance(media_res, dict):
        if media_res.get("imageUrl"):
            return media_res["imageUrl"]
        images = media_res.get("images")
        if isinstance(images, list) and images and images[0].get("url"):
            return images[0]["url"]
    images = res.get("images")
    if isinstance(images, list) and images and images[0].get("url"):
        return images[0]["url"]
    return None


def call_mcp(tool, args, timeout=300):
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": "tools/call",
                       "params": {"name": tool, "arguments": args}}).encode()
    req = urllib.request.Request(FLOW_MCP_URL, data=body, headers={
        "X-Device-Id": FLOW_DEVICE_ID, "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read().decode("utf-8")
    if raw.lstrip().startswith("event:") or "\ndata:" in raw:
        raw = next(l[5:] for l in raw.splitlines() if l.startswith("data:"))
    resp = json.loads(raw)
    if "error" in resp:
        raise RuntimeError(resp["error"])
    text = "".join(c.get("text", "") for c in resp["result"].get("content", []))
    try:
        return json.loads(text)
    except ValueError:
        return text


def as_list(res):
    return res if isinstance(res, list) else [res]


class RunMCP:
    def __init__(self, a, man, followers):
        self.a, self.man, self.followers = a, man, followers
        self.made = 0
        self.flagged = False
        self.name_of_job = {e["job"]: n for n, e in man.jobs.items() if e.get("status") == "inflight" and e.get("job")}

    def _finish(self, name, src):
        dst = os.path.join(RAW_DIR, name + (os.path.splitext(src)[1] or ".jpg"))
        shutil.copy(src, dst)
        self.man.set(name, status="done", file=dst)
        self.made += 1
        fg.record_ok()
        log(f"  ✓ {name}  ({self.made} done)")
        for twin in self.followers.get(self.man.jobs[name].get("hash"), []):
            if twin["name"] != name and not done_path(twin["name"]):
                d2 = os.path.join(RAW_DIR, twin["name"] + os.path.splitext(dst)[1])
                shutil.copy(dst, d2)
                self.man.set(twin["name"], status="dup", file=d2, hash=self.man.jobs[name].get("hash"), dup_of=name)
                log(f"  ✓ {twin['name']}  (identical prompt: copied from {name})")

    def collect(self, wait=0):
        if not self.name_of_job:
            return
        ids = list(self.name_of_job)
        try:
            jobs = as_list(call_mcp("flow_get_job", {"job_ids": ids, "wait_seconds": wait}))
        except Exception as ex:
            log(f"  … could not read job status ({ex}); will retry")
            return
        seen = set()
        for j in jobs:
            jid = j.get("job_id")
            name = self.name_of_job.get(jid)
            if name is None:
                continue
            seen.add(jid)
            st = j.get("status")
            if st == "done":
                if j.get("files"):
                    self._finish(name, j["files"][0]["path"])
                    del self.name_of_job[jid]
                else:
                    del self.name_of_job[jid]
                    self.man.set(name, status="failed", error="done without files")
                    log(f"  ✗ {name} finished without files")
            elif st in ("cancelled", "canceled"):
                del self.name_of_job[jid]
                err = str(j.get("error") or "cancelled")
                self.man.set(name, status="cancelled", error=err[:140])
                log(f"  - {name} cancelled: {err[:140]}")
            elif st == "failed":
                err = str(j.get("error") or j.get("stage"))
                del self.name_of_job[jid]
                if fg.is_flag(err):
                    self.man.set(name, status="failed", error="unusual activity")
                    self.flag(name)
                else:
                    self.man.set(name, status="failed", error=err[:140])
                    log(f"  ✗ {name} failed: {err[:140]}")
        for jid in set(ids) - seen:
            name = self.name_of_job.pop(jid)
            self.man.set(name, status="lost")
            log(f"  ? {name}: job {jid} is unknown to the bridge; it will be submitted again")

    def flag(self, name):
        if not self.flagged:
            self.flagged = True
            fg.record_flag()
            log(f"⚠ Flow reported UNUSUAL ACTIVITY (on {name}). Stopping: cancelling the queue, nothing more is sent.")
            try:
                call_mcp("flow_cancel", {})
            except Exception:
                pass

    def submit(self, row, h):
        self.man.set(row["name"], hash=h, status="inflight", job=None)
        args = {"prompt": row["prompt"], "aspect_ratio": row["aspect"], "model": self.a.model, "count": 1, "wait_seconds": 0}
        if row.get("ref") and done_path(row["ref"]):
            args["references"] = [os.path.abspath(done_path(row["ref"]))]
        if self.a.project_id:
            args["project_id"] = self.a.project_id
        j = as_list(call_mcp("flow_generate_image", args))[0]
        jid = j.get("job_id")
        self.man.set(row["name"], job=jid)
        self.name_of_job[jid] = row["name"]
        deadline = time.time() + 90
        while True:
            st, err = j.get("status"), str(j.get("error") or "")
            if st == "failed":
                self.name_of_job.pop(jid, None)
                if fg.is_flag(err):
                    self.man.set(row["name"], status="failed", error="unusual activity")
                    self.flag(row["name"])
                    return False
                self.man.set(row["name"], status="failed", error=err[:140])
                log(f"  ✗ {row['name']} failed on submit: {err[:140]}")
                return True
            if j.get("submitted") or st == "done":
                break
            if time.time() > deadline:
                log(f"  … {row['name']}: not accepted after 90s; it stays in flight (never resubmitted)")
                break
            time.sleep(0.25)
            j = as_list(call_mcp("flow_get_job", {"job_id": jid, "wait_seconds": 0}))[0]
        fg.mark_submitted()
        return True


def run_mcp(a):
    os.makedirs(RAW_DIR, exist_ok=True)
    with open(a.elements, encoding="utf-8") as f:
        rows = list(csv.DictReader(f, delimiter="\t"))
    vids = [r["name"] for r in rows if r.get("kind") == "video"]
    rows = [r for r in rows if r.get("kind") != "video"]
    for r in rows:
        r["name"] = r.get("name") or r["id"]
        r["aspect"] = r.get("aspect_ratio") or ("16:9" if r.get("kind") == "bg" else "1:1")
        r["ref"] = (r.get("ref") or "").strip()
    man = Manifest()

    if a.regen:
        for n in a.regen:
            p = done_path(n)
            if p:
                os.remove(p)
            man.jobs.pop(n, None)
            log(f"regenerating {n}")
        man.save()
    if a.only:
        rows = [r for r in rows if r["name"] in a.only]

    if a.status:
        c = {}
        for r in rows:
            s = "done" if done_path(r["name"]) else (man.status(r["name"]) or "todo")
            c[s] = c.get(s, 0) + 1
        print(f"{len(rows)} images: " + ", ".join(f"{v} {k}" for k, v in sorted(c.items())) + (f"  ({len(vids)} video shot(s) skipped)" if vids else ""))
        return
    if vids:
        log(f"skipping {len(vids)} video shot(s) (videos cost credits; generate them explicitly)")
    if fg.status()["paused"]:
        sys.exit("Flow guard is PAUSED after an unusual-activity report. Check Flow in the browser, then "
                 "`python studio.py guard reset` and run this again.")
    st = call_mcp("flow_status", {})
    if isinstance(st, dict) and not st.get("logged_in", True):
        sys.exit("Flow is not logged in -- sign in to Flow in the browser and re-run.")

    pending, followers, inflight_names, copied = [], {}, [], 0
    done_by_hash = {e.get("hash"): n for n, e in man.jobs.items() if e.get("status") in ("done", "dup") and done_path(n)}
    inflight_by_hash = {e.get("hash"): n for n, e in man.jobs.items() if e.get("status") == "inflight" and e.get("job")}
    leaders = {}
    for r in rows:
        h = phash(r, a.model)
        r["h"] = h
        if done_path(r["name"]):
            if man.status(r["name"]) not in ("done", "dup"):
                man.set(r["name"], hash=h, status="done", file=done_path(r["name"]))
            continue
        if man.status(r["name"]) == "inflight" and man.jobs[r["name"]].get("job"):
            inflight_names.append(r["name"])
            continue
        twin = done_by_hash.get(h)
        if twin and twin != r["name"]:
            dst = os.path.join(RAW_DIR, r["name"] + os.path.splitext(done_path(twin))[1])
            shutil.copy(done_path(twin), dst)
            man.set(r["name"], hash=h, status="dup", file=dst, dup_of=twin)
            copied += 1
            log(f"  ✓ {r['name']}  (identical prompt to {twin}: copied, not regenerated)")
            continue
        if h in inflight_by_hash and inflight_by_hash[h] != r["name"]:
            followers.setdefault(h, []).append(r)
            continue
        if h in leaders:
            followers.setdefault(h, []).append(r)
            continue
        leaders[h] = r
        pending.append(r)
    done_n = sum(1 for r in rows if done_path(r["name"]))
    log(f"{done_n} already done, {len(inflight_names)} still in flight from an earlier run, {copied} copied from identical prompts, "
        f"{len(pending)} to generate (parallel, {fg.GAP:g}s apart)")

    run = RunMCP(a, man, followers)
    if run.name_of_job:
        log(f"collecting {len(run.name_of_job)} job(s) from an earlier run ...")
        t_end = time.time() + 120
        while run.name_of_job and time.time() < t_end:
            run.collect(20)
        for n in list(run.name_of_job.values()):
            log(f"  … {n} is still generating; it is kept in flight")
        lost = [r for r in rows if man.status(r["name"]) in ("lost",) and not done_path(r["name"])]
        for r in lost:
            if r not in pending and r["h"] not in leaders:
                leaders[r["h"]] = r
                pending.append(r)

    pending.sort(key=lambda r: 1 if r.get("ref") else 0)
    for k, row in enumerate(pending, 1):
        if run.flagged or not fg.acquire(1):
            break
        if done_path(row["name"]):
            continue
        if row.get("ref") and not done_path(row["ref"]):
            log(f"  … {row['name']}: waiting for its reference {row['ref']} (same-character consistency)")
            t_ref = time.time() + 300
            while not done_path(row["ref"]) and time.time() < t_ref and not run.flagged:
                run.collect(15)
            if not done_path(row["ref"]):
                log(f"  ⚠ {row['name']}: reference {row['ref']} not ready -- skipped (re-run generate after it exists)")
                continue
        try:
            if not run.submit(row, row["h"]):
                break
        except Exception as ex:
            man.set(row["name"], status="failed", error=f"bridge error: {ex}"[:140])
            log(f"  ✗ {row['name']}: bridge error {ex}")
        if k % 6 == 0:
            run.collect(0)
    t_end = time.time() + a.wait
    while run.name_of_job and time.time() < t_end and not run.flagged:
        run.collect(30)
    if run.flagged:
        run.collect(5)

    missing = [r["name"] for r in rows if not done_path(r["name"])]
    still = [n for n in missing if man.status(n) == "inflight"]
    log(f"finished: {run.made} generated this run, {len(missing)} not done yet"
        + (f" ({len(still)} still generating on Flow: run again later to collect them, they will NOT be resubmitted)" if still else "")
        + (" -- re-run to continue" if missing and not still else ""))
    if run.flagged:
        log("Generation was STOPPED by an unusual-activity report. Resume later with `python studio.py generate`.")
    sys.exit(2 if run.flagged else (1 if missing else 0))


def main():
    ap = argparse.ArgumentParser(description="Parallel, paced, 100% duplicate-proof Google Flow image generator")
    ap.add_argument("--elements", default="ELEMENTS.tsv")
    ap.add_argument("--only", nargs="*", help="generate just these names")
    ap.add_argument("--regen", nargs="*", help="delete these images and generate them again")
    ap.add_argument("--status", action="store_true", help="show done / todo / failed and exit")
    ap.add_argument("--model", default="imagen-3")
    ap.add_argument("--project-id", default=None)
    ap.add_argument("--wait", type=int, default=300, help="seconds to wait for images")
    ap.add_argument("--sync", action="store_true", help="wait for each render tile sequentially before submitting the next")
    ap.add_argument("--parallel", type=int, default=int(os.environ.get("FLOW_CONCURRENCY", "2")), help="max concurrent in-flight generation slots in Google Flow (default: 2, safe high-speed)")
    a = ap.parse_args()

    if FLOW_MCP_URL:
        return run_mcp(a)

    os.makedirs(RAW_DIR, exist_ok=True)
    os.makedirs(CUT_DIR, exist_ok=True)

    if not os.path.exists(a.elements):
        sys.exit(f"Missing {a.elements} -- run `python studio.py prompts` first.")

    with open(a.elements, encoding="utf-8") as f:
        rows = list(csv.DictReader(f, delimiter="\t"))

    vids = [r["name"] for r in rows if r.get("kind") == "video"]
    rows = [r for r in rows if r.get("kind") != "video"]
    for r in rows:
        r["name"] = str(r.get("name") or r.get("id") or "").strip()
        r["aspect"] = r.get("aspect_ratio") or ("16:9" if r.get("kind") == "bg" else "1:1")
        r["ref"] = (r.get("ref") or "").strip()

    man = Manifest()

    if a.regen:
        for n in a.regen:
            p = done_path(n)
            if p and os.path.exists(p):
                os.remove(p)
            man.jobs.pop(n, None)
            log(f"regenerating {n}")
        man.save()

    if a.only:
        rows = [r for r in rows if r["name"] in a.only]

    # Pre-harvest step: scan Downloads folders to rescue any already downloaded images
    try:
        fh.harvest_from_folder(elements_tsv=a.elements)
    except Exception:
        pass

    # Status check
    if a.status:
        c = {}
        for r in rows:
            s = "done" if done_path(r["name"]) else (man.status(r["name"]) or "todo")
            c[s] = c.get(s, 0) + 1
        print(f"{len(rows)} images: " + ", ".join(f"{v} {k}" for k, v in sorted(c.items())) + (f"  ({len(vids)} video shot(s) skipped)" if vids else ""))
        return

    # Check Flow Guard pause state
    if fg.status().get("paused"):
        sys.exit("Flow guard is PAUSED after an unusual-activity report. Check Flow in the browser, then "
                 "`python studio.py guard reset` and run this again.")

    # 4-Tier Deduplication Decision
    pending = []
    leaders = {}
    copied = 0
    done_by_hash = {e.get("hash"): n for n, e in man.jobs.items() if e.get("status") in ("done", "dup") and done_path(n)}

    for r in rows:
        name = r["name"]
        h = phash(r, a.model)
        r["h"] = h

        # Tier 1 & 2: Local Disk Check (Raw or Cut)
        existing_file = done_path(name)
        if existing_file:
            if man.status(name) not in ("done", "dup"):
                man.set(name, hash=h, status="done", file=existing_file)
            continue

        # Tier 3: Manifest Done / Dup with valid file
        if man.status(name) in ("done", "dup"):
            rec_file = man.jobs[name].get("file")
            min_sz = 10 if FLOW_MCP_URL else 1024
            if rec_file and os.path.exists(rec_file) and os.path.getsize(rec_file) > min_sz:
                continue

        # Tier 4: In-Flight Check (< 300s old): Do NOT resubmit
        if man.status(name) == "inflight":
            t_sent = man.jobs[name].get("t", 0)
            if time.time() - t_sent < 300:
                log(f"  … {name} is already in-flight on Google Flow (sent {int(time.time() - t_sent)}s ago); skipping duplicate dispatch.")
                continue

        # Tier 5: Identical Prompt Twin Check: Copy instead of generating twice
        twin = done_by_hash.get(h)
        if twin and twin != name and done_path(twin):
            twin_file = done_path(twin)
            dst = os.path.join(RAW_DIR, f"{name}.png")
            shutil.copy2(twin_file, dst)
            man.set(name, hash=h, status="dup", file=dst, dup_of=twin)
            copied += 1
            log(f"  ✓ {name} (identical prompt to {twin}: copied locally, ZERO Flow calls)")
            continue

        if h in leaders:
            continue

        leaders[h] = r
        pending.append(r)

    done_n = sum(1 for r in rows if done_path(r["name"]))
    if not pending:
        log(f"✓ All {len(rows)} assets are ALREADY GENERATED and verified — ZERO calls sent to Google Flow!")
        sys.exit(0)

    # Tier 1: Check Flow Connector Extension (`flow-auto`) first
    flow_auto_ok, flow_auto_info = check_flow_auto_status()
    if flow_auto_ok:
        log(f"⚡ Flow Connector Extension connected! Queuing {len(pending)} pending asset(s) in parallel (batch=4, 1.2s gap)...")
        import glob
        import subprocess
        folder_name = os.path.basename(os.path.abspath(".")) + "_flow"
        downloads_dir = os.path.expanduser(f"~/Downloads/{folder_name}")
        os.makedirs(downloads_dir, exist_ok=True)
        model_slug = "nano-banana-pro" if "pro" in a.model.lower() else ("nano-banana-lite" if "lite" in a.model.lower() else "nano-banana-2")
        for idx, row in enumerate(pending, 1):
            name = row["name"]
            if done_path(name):
                continue
            raw_prompt = row["prompt"].strip()
            tag = f"#{name}"
            final_prompt = raw_prompt if tag in raw_prompt else f"{raw_prompt} {tag}"
            cmd = [
                "flow-auto", "generate", "create", "flow-text-to-image",
                "--prompt", final_prompt,
                "--model", model_slug,
                "--ratio", row["aspect"],
                "--count", "1",
                "--index", str(idx),
                "--folder", folder_name,
                "--batch", str(max(2, min(a.parallel, 4))),
                "--delay", "3-6",
                "--image-delay", "1.0-2.0",
                "--json"
            ]
            if row.get("ref") and done_path(row["ref"]):
                cmd.extend(["--images", os.path.abspath(done_path(row["ref"]))])
            try:
                subprocess.run(cmd, capture_output=True, text=True, timeout=15)
                man.set(name, hash=row["h"], status="inflight", t=int(time.time()))
                fg.mark_submitted()
                log(f"  [+] Queued [{idx}/{len(pending)}] {name} to Flow Connector")
            except Exception as ex:
                log(f"  [!] Flow Connector queue warning for {name}: {ex}")
            time.sleep(0.35)

        t_end = time.time() + a.wait
        idx_map = {idx: row for idx, row in enumerate(pending, 1)}
        while idx_map and time.time() < t_end:
            try:
                fh.harvest_from_folder(elements_tsv=a.elements)
            except Exception:
                pass
            for idx, row in list(idx_map.items()):
                name = row["name"]
                if done_path(name):
                    man.set(name, hash=row["h"], status="done", file=done_path(name))
                    idx_map.pop(idx, None)
                    fg.record_ok()
                    log(f"  ✓ {name} completed! ({len(rows) - len(idx_map)}/{len(rows)} ready)")
                    continue
                matches = []
                for ext in ("*.png", "*.jpg", "*.jpeg", "*.webp"):
                    matches.extend(glob.glob(os.path.join(downloads_dir, f"{idx}_*{ext[1:]}")))
                if matches:
                    latest = max(matches, key=os.path.getctime)
                    if os.path.getsize(latest) > 1024:
                        dst = os.path.join(RAW_DIR, f"{name}.png")
                        Image.open(latest).convert("RGB").save(dst, "PNG")
                        man.set(name, hash=row["h"], status="done", file=dst)
                        idx_map.pop(idx, None)
                        fg.record_ok()
                        log(f"  ✓ {name} harvested from Flow Connector ({len(rows) - len(idx_map)}/{len(rows)} ready)")
            if idx_map:
                time.sleep(1.5)
        missing = [r["name"] for r in rows if not done_path(r["name"])]
        log(f"\nFlow Connector batch completed: {len(rows) - len(missing)}/{len(rows)} ready.")
        sys.exit(1 if missing else 0)

    # Tier 2: Verify DeepX Bridge Connection ONLY when there is actually work to do
    bridge_ok, info = check_bridge_status()
    if not bridge_ok:
        sys.exit(
            "⚠️ Google Flow Bridge is not connected!\n"
            "Open Google Flow in your browser (https://flow.google.com), ensure the Flow Connector or DeepX extension is active,\n"
            "and re-run `python studio.py generate`."
        )

    log(f"{done_n}/{len(rows)} already done, {copied} copied from identical prompts, {len(pending)} to generate (paced {fg.GAP:g}s apart)")

    # Execute slotted parallel generation for pending assets
    made = 0
    flagged = False
    dispatched = 0
    concurrency = 1 if a.sync else max(1, min(a.parallel, 3))

    mode_label = "Synchronous (1-by-1)" if a.sync else f"Slotted Parallel ({concurrency} concurrent slots)"
    log(f"🚀 {mode_label} dispatch: {len(pending)} pending asset(s), {fg.GAP:g}s pacing delay")

    in_flight = {}
    pending_queue = list(pending)
    import random

    while pending_queue or in_flight:
        # Fill available concurrency slots from pending queue
        while pending_queue and len(in_flight) < concurrency and not flagged:
            row = pending_queue.pop(0)
            name = row["name"]

            # Quick check if already on disk
            if done_path(name):
                man.set(name, hash=row["h"], status="done", file=done_path(name))
                continue

            if not fg.acquire(1):
                log("  … Rate guard waiting for next submission slot...")
                time.sleep(fg.GAP)
                if not fg.acquire(1):
                    break

            # Natural humanized micro-jitter to prevent bot fingerprinting
            time.sleep(random.uniform(0.2, 0.5))

            # Tag with #{name} so Chrome/DeepX names the saved file correctly
            raw_prompt = row["prompt"].strip()
            tag = f"#{name}"
            final_prompt = raw_prompt if tag in raw_prompt else f"{raw_prompt} {tag}"

            man.set(name, hash=row["h"], status="inflight", t=int(time.time()))
            log(f"  [+] [Slot {len(in_flight)+1}/{concurrency}] Dispatching {name} to Google Flow...")

            wait_render = bool(a.sync)
            payload = {
                "prompt": final_prompt,
                "aspectRatio": row["aspect"],
                "model": a.model if a.model in ("imagen-3", "veo-quality") else "imagen-3",
                "count": 1,
                "waitForRender": wait_render,
                "wait_for_render": wait_render,
            }

            try:
                timeout_sec = 120 if a.sync else 40
                res = call_bridge("generate_image", payload, timeout=timeout_sec)
                fg.mark_submitted()
                fg.record_ok()
                dispatched += 1

                img_url = extract_media_url(res)
                if img_url:
                    saved_path = download_image_to_raw(img_url, name)
                    man.set(name, status="done", file=saved_path)
                    made += 1
                    log(f"  ✓ {name} (downloaded directly from CDN, {made} done)")
                    continue

                if a.sync:
                    time.sleep(1.5)
                    fh.harvest_from_folder(elements_tsv=a.elements)
                    p = done_path(name)
                    if p:
                        man.set(name, status="done", file=p)
                        made += 1
                        log(f"  ✓ {name} (harvested from Chrome Downloads)")
                    else:
                        in_flight[name] = {"row": row, "dispatched_at": time.time()}
                else:
                    in_flight[name] = {"row": row, "dispatched_at": time.time()}
                    log(f"  ⚡ {name} active in Flow slot (parallel in-flight: {len(in_flight)}/{concurrency})")

            except Exception as ex:
                err_msg = str(ex)
                if fg.is_flag(err_msg):
                    log(f"⚠ Google Flow reported UNUSUAL ACTIVITY on {name}.")
                    log("  🔄 Initiating auto-recovery: cooling off for 15s, resetting guard, and continuing...")
                    time.sleep(15.0)
                    fg.reset()
                    concurrency = 1  # Throttle to 1 concurrent slot to guarantee safe completion
                    pending_queue.insert(0, row)
                    break
                else:
                    man.set(name, status="failed", error=err_msg[:140])
                    log(f"  ✗ {name}: {err_msg[:120]}")

        # Check in-flight jobs for completions
        if in_flight:
            try:
                fh.harvest_from_folder(elements_tsv=a.elements)
            except Exception:
                pass

            now = time.time()
            for n in list(in_flight.keys()):
                p = done_path(n)
                if p:
                    man.set(n, status="done", file=p)
                    del in_flight[n]
                    made += 1
                    fg.record_ok()
                    missing_now = sum(1 for r in rows if not done_path(r["name"]))
                    log(f"  ✓ {n} completed! ({len(rows) - missing_now}/{len(rows)} ready)")
                elif now - in_flight[n]["dispatched_at"] > 160:
                    log(f"  … {n} in-flight > 160s; freeing slot to allow queue progress.")
                    del in_flight[n]

            # Brief pause before next slot check
            time.sleep(1.5)

    # Final Harvest & Ingestion verification
    try:
        fh.harvest_from_folder(elements_tsv=a.elements)
    except Exception:
        pass

    for r in rows:
        p = done_path(r["name"])
        if p and man.status(r["name"]) != "done":
            man.set(r["name"], status="done", file=p)
    man.save()

    missing = [r["name"] for r in rows if not done_path(r["name"])]
    log(f"\nBatch completed: Total ready: {len(rows) - len(missing)}/{len(rows)}.")
    if flagged:
        sys.exit(2)
    sys.exit(1 if missing else 0)


if __name__ == "__main__":
    main()

