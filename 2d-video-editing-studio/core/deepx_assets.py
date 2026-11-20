#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""deepx_assets.py -- ELEMENTS.tsv -> elements/raw/ through the built-in DeepX Google Flow engine.

Calls this plugin's own MCP tool `studio_generate_assets` (AntiGem plugin host, port 8865), which
checks the Google login, generates every missing asset in Agent Mode or Standard mode, re-sends
blocked prompts through Agent Mode on an "unusual activity / extension" error, and writes
elements/raw/<name>.<ext>. Nothing is ever pasted into Google Flow by hand.

USAGE (inside a project folder):
    python studio.py generate --mode agent        # with Google Flow Agent Mode (<=24 prompts per part)
    python studio.py generate --mode standard     # without Agent Mode (auto Agent fallback)
    python studio.py generate --status            # done / missing, no generation
    python studio.py generate --mode agent --regen bg_city ct_rifle
Exit code 3 = the agent must ask the user (generation mode) or the user must sign in to Google.
"""
import argparse, csv, json, os, sys, time, urllib.request

EXT_ID = os.environ.get("DEEPX_PLUGIN_ID", "2d-video-editing-studio")
MCP_URL = os.environ.get("DEEPX_MCP_URL", f"http://127.0.0.1:8865/mcp?extension={EXT_ID}")
DEVICE_ID = os.environ.get("ANTIGEM_DEVICE_ID") or os.environ.get("FLOW_DEVICE_ID", "78668db31e6bec3a")


def call(tool, args, timeout=200):
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": tool, "arguments": args}}).encode()
    req = urllib.request.Request(MCP_URL, data=body, headers={"X-Device-Id": DEVICE_ID, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        resp = json.loads(r.read().decode("utf-8"))
    if "error" in resp:
        raise RuntimeError(resp["error"])
    res = resp.get("result", {})
    text = "".join(c.get("text", "") for c in res.get("content", []))
    try:
        data = json.loads(text)
    except ValueError:
        data = {"text": text}
    if res.get("isError"):
        raise RuntimeError(data.get("error") if isinstance(data, dict) else text)
    return data


def status(elements):
    rows = [r for r in csv.DictReader(open(elements, encoding="utf-8"), delimiter="\t") if r.get("kind") != "video"]
    def done(n):
        for p in [f"elements/cut/{n}.png"] + [f"elements/raw/{n}.{e}" for e in ("png", "jpg", "jpeg", "webp")]:
            if os.path.exists(p) and os.path.getsize(p) > 1024:
                return True
        return False
    names = [str(r.get("name") or r.get("id") or "").strip() for r in rows]
    missing = [n for n in names if n and not done(n)]
    print(f"{len(names)} images: {len(names) - len(missing)} done, {len(missing)} missing")
    for n in missing[:40]:
        print("  · " + n)


def main():
    ap = argparse.ArgumentParser(description="Generate ELEMENTS.tsv assets with the DeepX Google Flow engine")
    ap.add_argument("--elements", default="ELEMENTS.tsv")
    ap.add_argument("--mode", choices=["agent", "standard"], default=os.environ.get("FLOW_GENERATION_MODE") or None)
    ap.add_argument("--agent", action="store_true", help="same as --mode agent")
    ap.add_argument("--standard", action="store_true", help="same as --mode standard")
    ap.add_argument("--only", nargs="*")
    ap.add_argument("--regen", nargs="*")
    ap.add_argument("--model", default="Nano Banana 2.1")
    ap.add_argument("--status", action="store_true")
    a, _ = ap.parse_known_args()
    if not os.path.exists(a.elements):
        sys.exit(f"Missing {a.elements} -- run `python studio.py prompts` first.")
    if a.status:
        return status(a.elements)
    mode = "agent" if a.agent else "standard" if a.standard else a.mode
    args = {"project_dir": os.path.abspath("."), "elements": a.elements, "model": a.model, "wait_seconds": 20}
    if mode:
        args["generation_mode"] = mode
    if a.only:
        args["only"] = a.only
    if a.regen:
        args["regen"] = a.regen
    try:
        r = call("studio_generate_assets", args)
    except Exception as e:
        sys.exit(f"DeepX engine not reachable ({e}). In AntiGem call the MCP tool studio_generate_assets "
                 f"with project_dir={os.path.abspath('.')} instead.")
    if r.get("all_done"):
        print("✓ " + r.get("message", "All assets already exist."))
        return
    if r.get("action_required") == "LOGIN_REQUIRED":
        print("⚠ " + r.get("message", "Sign in to Google in the Flow tab, then run this again."))
        sys.exit(3)
    if r.get("action_required") == "ASK_GENERATION_MODE":
        print(f"ASK_GENERATION_MODE: {r.get('question')}  -> rerun with --mode agent  or  --mode standard")
        sys.exit(3)
    job = r.get("job_id")
    print(f"▶ {r.get('stage')}  (job {job})", flush=True)
    last = ""
    while r.get("status") not in ("done", "failed", "cancelled"):
        r = call("deepx_job_status", {"job_id": job, "wait_seconds": 30}, timeout=90)
        if r.get("stage") != last:
            last = r.get("stage")
            print("  … " + str(last), flush=True)
    print(("✓ " if r.get("status") == "done" else "✗ ") + str(r.get("stage")))
    if r.get("error"):
        print("  error: " + str(r["error"]))
    if r.get("missing"):
        print("  missing: " + " ".join(r["missing"][:40]))
    sys.exit(0 if r.get("status") == "done" else 1)


if __name__ == "__main__":
    main()
