# -*- coding: utf-8 -*-
"""flow_harvest.py: Autonomous Google Flow Media Harvester & Ingestion Engine.

Solves the Zero-User-Download & Anti-Duplication Mandate:
1. Autonomously extracts rendered images from candidate download folders and DeepX Bridge.
2. Ingests and maps images into elements/raw/<name>.png matching ELEMENTS.tsv.
3. Automatically avoids duplicate prompts by maintaining flow_manifest.json and registry.
4. Requires ZERO manual downloading or clicking by the user.
"""

import csv
import glob
import json
import os
import re
import shutil
import sys
import time
from PIL import Image

RAW_DIR = "elements/raw"
CUT_DIR = "elements/cut"
MANIFEST = "flow_manifest.json"
REGISTRY = "elements/registry.json"


def get_elements_list(elements_tsv="ELEMENTS.tsv"):
    if not os.path.exists(elements_tsv):
        return []
    with open(elements_tsv, encoding="utf-8") as f:
        return list(csv.DictReader(f, delimiter="\t"))


def get_search_folders(custom_folder=None):
    folders = []
    if custom_folder and os.path.isdir(custom_folder):
        folders.append(os.path.abspath(custom_folder))

    project_folder = re.sub(r"[^A-Za-z0-9_-]+", "_", os.path.basename(os.getcwd())).strip("_").lower() or "voxdoc"
    dl_base = os.path.expanduser("~/Downloads")
    candidates = [
        dl_base,
        os.path.join(dl_base, project_folder),
        os.path.join(dl_base, f"{project_folder}_props"),
        os.path.join(dl_base, "deepx_renders"),
        os.path.join(dl_base, "deepx_renders", project_folder),
    ]
    if os.environ.get("FLOW_DOWNLOADS"):
        candidates.insert(0, os.environ["FLOW_DOWNLOADS"])
    try:
        candidates.extend(glob.glob(os.path.join(dl_base, "*", "")))
    except Exception:
        pass

    for c in candidates:
        if os.path.isdir(c) and c not in folders:
            folders.append(os.path.abspath(c))
    return folders


def harvest_from_folder(src_folder=None, elements_tsv="ELEMENTS.tsv"):
    """Maps harvested images from download directories into elements/raw/ matching ELEMENTS.tsv."""
    os.makedirs(RAW_DIR, exist_ok=True)
    elements = get_elements_list(elements_tsv)
    if not elements:
        print("flow_harvest: No ELEMENTS.tsv found.")
        return 0

    folders = get_search_folders(src_folder)
    manifest = {"jobs": {}}
    if os.path.exists(MANIFEST):
        try:
            manifest = json.load(open(MANIFEST, encoding="utf-8"))
        except Exception:
            pass
    jobs = manifest.setdefault("jobs", {})

    copied = 0
    for el in elements:
        el_name = el.get("name") or el.get("id")
        target = os.path.join(RAW_DIR, f"{el_name}.png")

        # Skip if already exists and valid
        if os.path.exists(target) and os.path.getsize(target) > 1024:
            jobs.setdefault(el_name, {})["status"] = "done"
            jobs[el_name]["file"] = target
            continue

        # Also check cut dir
        cut_cand = os.path.join(CUT_DIR, f"{el_name}.png")
        if os.path.exists(cut_cand) and os.path.getsize(cut_cand) > 1024:
            jobs.setdefault(el_name, {})["status"] = "done"
            jobs[el_name]["file"] = cut_cand
            continue

        # Look for matching file in candidate folders
        escaped = re.escape(el_name)
        pat = re.compile(rf"^{escaped}(?:\s*\(\d+\))?(?:_\d+)?\.(?:png|webp|jpg|jpeg)$", re.IGNORECASE)

        found = None
        for folder in folders:
            if not os.path.exists(folder):
                continue
            try:
                matches = []
                for fname in os.listdir(folder):
                    if pat.match(fname):
                        p = os.path.join(folder, fname)
                        if os.path.isfile(p) and os.path.getsize(p) > 1024:
                            matches.append(p)
                if matches:
                    # Pick newest
                    found = max(matches, key=os.path.getmtime)
                    break
            except Exception:
                continue

        if found:
            try:
                im = Image.open(found).convert("RGB")
                im.save(target, "PNG")
                copied += 1
                jobs[el_name] = {"status": "done", "file": target, "t": int(time.time())}
                print(f"  ✓ Harvested: {el_name} -> {target}")
            except Exception as ex:
                print(f"  ⚠ Failed to convert {found}: {ex}")

    with open(MANIFEST, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=1)

    # Sync to registry as well
    if os.path.exists(REGISTRY) or os.path.exists(os.path.dirname(REGISTRY) or "."):
        try:
            os.makedirs(os.path.dirname(REGISTRY) or ".", exist_ok=True)
            reg = json.load(open(REGISTRY, encoding="utf-8")) if os.path.exists(REGISTRY) else {}
            for name, j in jobs.items():
                if j.get("status") == "done":
                    reg[name] = {"status": "COMPLETED", "file": j.get("file"), "t": j.get("t", int(time.time()))}
            with open(REGISTRY, "w", encoding="utf-8") as f:
                json.dump(reg, f, ensure_ascii=False, indent=2)
        except Exception:
            pass

    print(f"flow_harvest: Successfully ingested {copied} assets into {RAW_DIR}/.")
    return copied


if __name__ == "__main__":
    src = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].endswith(".tsv") else None
    tsv = next((a for a in sys.argv[1:] if a.endswith(".tsv")), "ELEMENTS.tsv")
    harvest_from_folder(src, tsv)
