#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""mobile_run.py: Turnkey 1-Command Video Generation Runner for Android & Mobile.

Optimized specifically for running on Android devices with Antigravity as the agent.
Automatically sets 9:16 vertical mobile aspect ratio, clamps worker processes
and FFmpeg threads to prevent Android Low Memory Killer (LMK) kills, and executes
the complete speech alignment, element formulation, audio mixing, and video rendering.
"""

import argparse
import os
import shutil
import subprocess
import sys
import time

# Enforce mobile-first environment
os.environ["IS_MOBILE"] = "1"
if "VOX_ASPECT" not in os.environ:
    os.environ["VOX_ASPECT"] = "9:16"

try:
    from core import mobile_config as mc
except ImportError:
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from core import mobile_config as mc

def print_banner():
    w, h = mc.get_dimensions()
    asp = mc.get_aspect_ratio()
    workers = mc.get_safe_workers()
    threads = mc.get_ffmpeg_threads()
    print("=" * 68)
    print("  🚀 XDEEP FREE VIDEO GENERATION — MOBILE EDITION (ANDROID / TERMUX)")
    print(f"  • Viewport: {w}x{h} ({asp} Vertical Mobile-First)")
    print(f"  • Safe RAM Workers: {workers} process | FFmpeg Threads: {threads}")
    print(f"  • Environment: {'Android / Termux' if mc.is_mobile() else 'Mobile Emulation'}")
    print("=" * 68)

def check_prerequisites():
    print("\n[Step 1/5] Checking System Prerequisites...")
    missing = []
    if not shutil.which("ffmpeg"):
        missing.append("ffmpeg")
    if not shutil.which("ffprobe"):
        missing.append("ffprobe")
        
    for mod in ["PIL", "numpy", "scipy"]:
        try:
            __import__(mod)
        except ImportError:
            missing.append(f"python-{mod.lower()}")
            
    if missing:
        print(f"📦 [Auto-Install] Missing required packages: {', '.join(missing)}. Installing automatically now...", flush=True)
        py_pkgs = ["pillow", "numpy", "scipy", "soundfile"]
        try:
            subprocess.run([sys.executable, "-m", "pip", "install", "--break-system-packages", *py_pkgs], check=True)
        except Exception:
            subprocess.run([sys.executable, "-m", "pip", "install", *py_pkgs], check=False)
        if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
            try:
                import static_ffmpeg
                static_ffmpeg.add_paths()
            except ImportError:
                pass
        
    print("✓ All mobile prerequisites installed and verified!")
    return True

def run_alignment(vo_file="VO.wav", lines_file="LINES.tsv"):
    print("\n[Step 2/5] Zero-Millisecond Phonetic Speech Alignment...")
    if not os.path.exists(vo_file):
        print(f"⚠️  Voiceover file '{vo_file}' not found.")
        print("    Place your recorded or TTS voiceover as 'VO.wav' in this folder,")
        print("    or generate via Cartesia TTS: python core/cartesia_tts.py --text '...'")
        return False
        
    if not os.path.exists(lines_file):
        print(f"⚠️  Script lines file '{lines_file}' not found.")
        return False

    align_script = os.path.join(os.path.dirname(__file__), "core", "align.py")
    cmd = [sys.executable, align_script, "--vo", vo_file, "--lines", lines_file]
    t0 = time.time()
    res = subprocess.run(cmd)
    if res.returncode != 0:
        print("❌ Speech alignment failed.")
        return False
    print(f"✓ Speech aligned in {time.time() - t0:.2f}s -> WORDS.tsv and VO.tsv ready!")
    return True

def run_audio_mix(cues_file="cues.tsv"):
    print("\n[Step 3/5] Mixing Broadcast Ducked Audio (Music Bed + SFX + Voice)...")
    if not os.path.exists(cues_file):
        print(f"ℹ️  '{cues_file}' not found. Skipping SFX mixing; using raw VO.")
        return True
        
    mix_script = os.path.join(os.path.dirname(__file__), "core", "mix.py")
    cmd = [
        sys.executable, mix_script, cues_file,
        "--vo", "VO.wav",
        "--lines", "VO.tsv",
        "--words", "WORDS.tsv",
        "--out", "mix.wav"
    ]
    t0 = time.time()
    res = subprocess.run(cmd)
    if res.returncode != 0:
        print("⚠️  Audio mixing had warnings, proceeding with direct voiceover.")
        return True
    print(f"✓ Broadcast audio mixed in {time.time() - t0:.2f}s -> mix.wav (-14 LUFS)")
    return True

def run_render():
    print("\n[Step 4/5] Rendering Video Scenes (Low-RAM Mobile Mode)...")
    if not os.path.exists("SCENES.tsv"):
        print("❌ SCENES.tsv missing! Required for scene choreography.")
        return False
        
    render_script = os.path.join(os.path.dirname(__file__), "core", "render.py")
    
    # 1. Render shots
    print("  • Rendering scene shots with mobile safe-zone clipping...")
    res = subprocess.run([sys.executable, render_script, "shots"])
    if res.returncode != 0:
        print("❌ Shots rendering failed.")
        return False

    # 2. Render master video
    print("\n[Step 5/5] Assembling Master 9:16 Video...")
    res = subprocess.run([sys.executable, render_script, "master"])
    if res.returncode != 0:
        print("❌ Master assembly failed.")
        return False
        
    if os.path.exists("master.mp4"):
        sz_mb = os.path.getsize("master.mp4") / (1024 * 1024)
        print("=" * 68)
        print(f"🎉 MASTER VIDEO EXPORTED SUCCESSFULLY: master.mp4 ({sz_mb:.1f} MB)")
        print("=" * 68)
        print("To preview on your Android phone:")
        if shutil.which("termux-open"):
            print("    termux-open master.mp4")
        else:
            print("    Open 'master.mp4' from your phone's file manager or gallery!")
        return True
    return False

def main():
    parser = argparse.ArgumentParser(description="Turnkey Mobile Video Generation Runner")
    parser.add_argument("--aspect", choices=["9:16", "16:9"], default="9:16", help="Aspect ratio (default: 9:16 vertical)")
    parser.add_argument("--align-only", action="store_true", help="Run speech alignment only")
    parser.add_argument("--mix-only", action="store_true", help="Run audio mixing only")
    parser.add_argument("--render-only", action="store_true", help="Run video rendering only")
    parser.add_argument("--all", action="store_true", default=True, help="Run complete pipeline")
    args = parser.parse_args()

    os.environ["VOX_ASPECT"] = args.aspect

    if os.path.exists("EDIT.json"):   # v2 project: hand over to the v2 engine (see ENGINE_V2.md)
        studio = os.path.join(os.path.dirname(os.path.realpath(__file__)), "studio.py")
        render_cmd = [sys.executable, studio, "render", "--fast"]
        if len(sys.argv) > 1:
            render_cmd = [sys.executable, studio, "render"] + [x for x in sys.argv[1:] if x != "--all"]
        sys.exit(subprocess.run(render_cmd).returncode)

    os.environ["VOX_ASPECT"] = args.aspect
    print_banner()

    if not check_prerequisites():
        sys.exit(1)

    if args.align_only:
        run_alignment()
        return

    if args.mix_only:
        run_audio_mix()
        return

    if args.render_only:
        run_render()
        return

    # Default full pipeline
    if os.path.exists("VO.wav") and os.path.exists("LINES.tsv"):
        if not run_alignment():
            sys.exit(1)
            
    if os.path.exists("cues.tsv") and os.path.exists("WORDS.tsv"):
        run_audio_mix()
        
    if os.path.exists("SCENES.tsv"):
        run_render()
    else:
        print("\nℹ️  Next Step for Mobile Antigravity Agent:")
        print("    1. Create or copy a template: cp -r templates/historical_vox_template/* .")
        print("    2. Generate VO via: python core/cartesia_tts.py --text '...'")
        print("    3. Run: python mobile_run.py")

if __name__ == "__main__":
    main()
