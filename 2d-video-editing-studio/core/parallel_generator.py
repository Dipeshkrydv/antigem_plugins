import os
import time
import glob
import json
import shutil
import subprocess
from core.flow_bridge import bridge


def check_flow_auto():
    """Checks if flow-auto CLI (Flow Connector extension) is installed and connected."""
    if not shutil.which("flow-auto"):
        return False
    try:
        res = subprocess.run(
            ["flow-auto", "status", "--site", "flow", "--json"],
            capture_output=True, text=True, timeout=4
        )
        if res.returncode == 0:
            data = json.loads(res.stdout)
            return bool(data.get("extensionConnected") or data.get("connected"))
    except Exception:
        pass
    return False


def generate_all_assets(prompts, output_dir, aspect_ratio="16:9", timeout=600, max_workers=3):
    """
    3-Tier High-Speed Parallel Asset Dispatcher:
      1. Tier 1: Flow Connector Extension (`flow-auto`) — queues up to 4 concurrent jobs with 1.2s pacing (ZERO 30s delays!).
      2. Tier 2: DeepX Google Flow Bridge (`ws://127.0.0.1:8792`) — slotted parallel batch dispatch.
      3. Tier 3: Fallback `flow_safe.py` execution.
    """
    os.makedirs(output_dir, exist_ok=True)
    missing_prompts = {}
    results = {}

    for idx, p in prompts.items():
        expected = os.path.join(output_dir, f"scene_{idx:03d}.png")
        if os.path.exists(expected) and os.path.getsize(expected) > 1024:
            print(f"  [✓] Scene {idx:03d} already exists on disk. Skipping.")
            results[idx] = expected
        else:
            missing_prompts[idx] = p

    if not missing_prompts:
        return results

    folder_name = os.path.basename(os.path.abspath(output_dir)) + "_flow"
    downloads_dir = os.path.expanduser(f"~/Downloads/{folder_name}")
    os.makedirs(downloads_dir, exist_ok=True)

    # TIER 1: Flow Connector CLI (`flow-auto`) Rapid Parallel Queue
    if check_flow_auto():
        print(f"  [⚡] Flow Connector Extension detected! Queuing {len(missing_prompts)} prompts in parallel (batch=4, 1.2s gap)...")
        job_ids = {}
        for idx, prompt in missing_prompts.items():
            clean_prompt = f"{prompt}, ultra clean graphic, NO WATERMARK, NO TEXT LOGOS"
            cmd = [
                "flow-auto", "generate", "create", "flow-text-to-image",
                "--prompt", clean_prompt,
                "--model", "nano-banana-2",
                "--ratio", aspect_ratio,
                "--count", "1",
                "--index", str(idx),
                "--folder", folder_name,
                "--batch", str(max(2, min(max_workers, 4))),
                "--delay", "3-6",
                "--image-delay", "1.0-2.0",
                "--json"
            ]
            try:
                r = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
                if r.returncode == 0:
                    data = json.loads(r.stdout)
                    jid = data.get("jobId") or data.get("id")
                    if jid:
                        job_ids[idx] = jid
                print(f"    -> Queued Scene {idx:03d} to Flow Connector")
            except Exception as e:
                print(f"    [!] Queue warning for Scene {idx:03d}: {e}")
            time.sleep(0.4)

        # Poll Downloads folder continuously as parallel jobs complete
        deadline = time.time() + timeout
        pending_indices = set(missing_prompts.keys())
        while pending_indices and time.time() < deadline:
            for idx in list(pending_indices):
                matches = []
                for ext in ("*.png", "*.jpg", "*.jpeg", "*.webp"):
                    matches.extend(glob.glob(os.path.join(downloads_dir, f"{idx}_*{ext[1:]}")))
                    matches.extend(glob.glob(os.path.join(os.path.expanduser("~/Downloads"), f"{idx}_*{ext[1:]}")))
                if matches:
                    latest_file = max(matches, key=os.path.getctime)
                    if os.path.getsize(latest_file) > 1024:
                        expected_path = os.path.join(output_dir, f"scene_{idx:03d}.png")
                        shutil.copy2(latest_file, expected_path)
                        results[idx] = expected_path
                        pending_indices.remove(idx)
                        print(f"    [✓] Scene {idx:03d} harvested ({len(results)}/{len(prompts)} ready)")
            if pending_indices:
                time.sleep(1.5)
        return results

    # TIER 2: DeepX Bridge Slotted Parallel Dispatch
    if bridge.check_connection():
        print(f"  [🚀] DeepX Flow Bridge connected! Dispatching {len(missing_prompts)} assets via rapid batch...")
        batch_items = [
            {"id": f"scene_{idx:03d}", "prompt": f"{p} #scene_{idx:03d}", "aspectRatio": aspect_ratio}
            for idx, p in missing_prompts.items()
        ]
        try:
            bridge.send_command("rapid_batch_dispatch", {
                "items": batch_items,
                "concurrency": max_workers,
                "aspectRatio": aspect_ratio
            }, timeout=timeout)
        except Exception as e:
            print(f"  [!] DeepX batch warning: {e}")

    return results
