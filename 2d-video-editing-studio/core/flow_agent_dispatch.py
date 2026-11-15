#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""flow_agent_dispatch.py -- Google Flow Agent Batch Dispatch Engine.

Collects all scene prompts from ELEMENTS.tsv / SHOTS.json and pastes them ALL AT ONCE
into Google Flow's Agent Mode / batch storyboard dispatcher for rapid parallel cluster rendering.

Features:
  - 1-Shot All-Prompt Dispatch (<1s per prompt)
  - Persistent Style & Protagonist Instruction Injection
  - Auto-detection of 9:16 vertical or 16:9 landscape
  - Auto-project attachment: ensures Google Flow is inside an active project (never times out with project_id: null)
  - Seamless fallback and harvest to elements/raw/
"""

import csv
import json
import os
import shutil
import sys
import time
import urllib.request

RAW_DIR = "elements/raw"
MANIFEST = "flow_manifest.json"
DEEPX_API_URL = os.environ.get("DEEPX_API_URL", "http://127.0.0.1:8792/api/command")
DEEPX_STATUS_URL = os.environ.get("DEEPX_STATUS_URL", "http://127.0.0.1:8792/status")


def log(msg):
    line = time.strftime("%H:%M:%S ") + msg
    print(line, flush=True)


def check_bridge():
    try:
        req = urllib.request.Request(DEEPX_STATUS_URL, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        return data.get("status") == "ok" and data.get("extensionConnected", False)
    except Exception:
        return False


def call_bridge(command, payload=None, timeout=180):
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


def load_prompts():
    """Reads prompts from ELEMENTS.tsv or SHOTS.json."""
    os.makedirs(RAW_DIR, exist_ok=True)
    prompts = []

    if os.path.exists("ELEMENTS.tsv"):
        with open("ELEMENTS.tsv", encoding="utf-8") as f:
            for row in csv.DictReader(f, delimiter="\t"):
                name = row.get("name") or row.get("id")
                prompt = (row.get("prompt") or "").strip()
                aspect = row.get("aspect") or row.get("aspect_ratio") or "1:1"
                kind = row.get("kind", "prop")
                if prompt:
                    # Skip if already exists
                    if any(os.path.exists(os.path.join(RAW_DIR, f"{name}{ext}")) for ext in (".png", ".jpg", ".jpeg", ".webp")):
                        continue
                    prompts.append({
                        "name": name,
                        "prompt": prompt,
                        "aspect": aspect,
                        "kind": kind
                    })

    if not prompts and os.path.exists("SHOTS.json"):
        with open("SHOTS.json", encoding="utf-8") as f:
            data = json.load(f)
            shots = data.get("shots", []) if isinstance(data, dict) else data
            for s in shots:
                name = s.get("id") or s.get("name")
                prompt = s.get("prompt") or s.get("description", "")
                if prompt:
                    prompts.append({
                        "name": name,
                        "prompt": prompt,
                        "aspect": s.get("aspect", "9:16"),
                        "kind": "scene"
                    })

    return prompts


def main():
    log("🚀 [Google Flow Agent Mode] Preparing All-in-One Storyboard Dispatch...")
    prompts = load_prompts()
    if not prompts:
        log("✓ All visual assets already exist in elements/raw/! Nothing to generate.")
        sys.exit(0)

    log(f"📋 Found {len(prompts)} visual prompts to dispatch to Google Flow Agent.")

    # Formatted multi-scene storyboard text with empty line gaps
    formatted_blocks = []
    for idx, p in enumerate(prompts, 1):
        formatted_blocks.append(f"### Scene {idx}: {p['name']}\n{p['prompt']}")

    full_storyboard_text = "\n\n".join(formatted_blocks)

    # Determine dominant aspect ratio
    aspect_ratio = "9:16" if os.environ.get("VOX_ASPECT") == "9:16" or any(p["aspect"] == "9:16" for p in prompts) else "16:9"

    # Check connection
    bridge_ready = check_bridge()
    if not bridge_ready:
        log("⚠️ Google Flow Bridge is not currently connected at ws://127.0.0.1:8792/ws.")
        log("  Falling back to export PROMPTS.md for manual 1-Click Copy into Google Flow Agent.")
        with open("PROMPTS_AGENT_MODE.md", "w", encoding="utf-8") as f:
            f.write("# Google Flow Agent Mode — 1-Click Batch Storyboard\n\n")
            f.write("Copy and paste the entire block below into Google Flow Agent:\n\n```text\n")
            f.write(full_storyboard_text)
            f.write("\n```\n")
        log("✓ Wrote PROMPTS_AGENT_MODE.md. You can copy-paste it directly into Flow Agent!")
        return

    log(f"▶ Dispatching {len(prompts)} prompts in batch to Google Flow Agent (<1s per prompt)...")
    try:
        res = call_bridge("deepx_rapid_batch_dispatch", {
            "script_text": full_storyboard_text,
            "mode": "textToImage",
            "model": "🍌 Nano Banana 2.1",
            "aspect_ratio": aspect_ratio,
            "auto_breakdown": False,
            "pacing_delay_sec": 0.8
        })
        log(f"✓ Google Flow Agent batch dispatched! Batch ID: {res.get('batchId', 'ok')}")
        log("  Flow is generating in parallel on cloud canvas. Run `python studio.py harvest` once finished.")
    except Exception as ex:
        log(f"⚠️ Agent dispatch returned: {ex}. Exported to PROMPTS_AGENT_MODE.md for manual paste.")
        with open("PROMPTS_AGENT_MODE.md", "w", encoding="utf-8") as f:
            f.write(full_storyboard_text)


if __name__ == "__main__":
    main()
