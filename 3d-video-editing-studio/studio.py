#!/usr/bin/env python3
"""
Deepesh Mobile Studio — 3D Video Editing Part 1 (Faceless Shorts Engine)
Universal Autonomous Executive Studio & Production CLI

Commands:
  python studio.py new <style> <project_dir>   Scaffold a self-contained 3D project (zero external template dependencies)
  python studio.py voice <project_dir>         Generate neural Kokoro voiceover (data/narration.wav)
  python studio.py words <project_dir>         Align word-level Whisper captions (data/words.json)
  python studio.py mix <project_dir>           Mix sound cues, foley, and background music (data/mix.wav)
  python studio.py sheet <project_dir>         Render visual contact sheet (review/all.jpg)
  python studio.py render <project_dir>        Render final video with Anti-LMK Shield (--fast, --turbo, --1080p)
  python studio.py autopilot                   1-Command Autonomous Production
  python studio.py selftest                    Check environment prerequisites and tools
"""

import os
import sys
import json
import shutil
import subprocess
from pathlib import Path

STUDIO_ROOT = Path(__file__).resolve().parent
SKILL_DIR = STUDIO_ROOT / "skills" / "faceless-shorts"
STYLES_DIR = SKILL_DIR / "styles"
SCRIPTS_DIR = SKILL_DIR / "scripts"

STYLES = {
    "deep-dive": "Deep Dive 3D (Zack D. Films style: sculpted 3D bodies, glowing x-ray anatomy, macro cameras)",
    "night-file": "Night File 3D (Unsolved mysteries, true crime noir, single-light chiaroscuro)",
    "tall-tale": "Tall Tale 3D (Humorous true stories, 2D cartoon characters emoting in sunny 3D towns)",
    "inside-out": "Inside Out (Flat 2D vector x-ray, bodily & scientific explainers, punchy cuts)",
    "stick-story": "Stick Story (Tactical survival, stick figures with emotive eyes, day/night sets)",
    "paper-atlas": "Paper Atlas (Grand history in cut paper, parchment maps, crimson routes, gold ribbons)"
}

def print_banner():
    print("""
========================================================================
 🎬 3D VIDEO EDITING STUDIO (PART 1 — FACELESS SHORTS) v1.1.0
 100% Code-Driven 3D & 2D | Three.js + Kokoro TTS + Whisper + Anti-LMK
========================================================================
""")

def get_python_bin():
    fh = Path(os.environ.get("FACELESS_HOME", Path.home() / ".faceless-shorts"))
    venv_py = fh / "venv" / "bin" / "python"
    if venv_py.exists():
        return str(venv_py)
    return sys.executable

def cmd_new(style: str, target: str):
    if style not in STYLES:
        print(f"❌ Unknown style '{style}'. Choose from:")
        for k, v in STYLES.items():
            print(f"   - {k}: {v}")
        sys.exit(1)

    example_dir = STYLES_DIR / style / "example"
    if not example_dir.exists():
        print(f"❌ Style template not found at {example_dir}")
        sys.exit(1)

    dest = Path(target).expanduser().resolve()
    if dest.exists():
        print(f"⚠️ Destination directory '{dest}' already exists. Using existing directory.")
    else:
        print(f"📦 Scaffolding new '{style}' project at {dest}...")
        shutil.copytree(example_dir, dest)

    # Ensure required runtime folders exist
    (dest / "renders").mkdir(parents=True, exist_ok=True)
    (dest / "review").mkdir(parents=True, exist_ok=True)
    (dest / "data").mkdir(parents=True, exist_ok=True)

    # Clean stale audio caches
    for old_file in ["data/narration.wav", "data/mix.wav", "data/words.json"]:
        p = dest / old_file
        if p.exists():
            p.unlink()

    # Link shared audio and fonts libraries
    audio_src = SKILL_DIR / "audio"
    fonts_src = SKILL_DIR / "fonts"
    if audio_src.exists():
        dest_audio = dest / "audio"
        dest_audio.mkdir(parents=True, exist_ok=True)
        for sub in ["sfx", "music"]:
            src_sub = audio_src / sub
            dst_sub = dest_audio / sub
            if src_sub.exists() and not dst_sub.exists():
                try:
                    dst_sub.symlink_to(src_sub)
                except Exception:
                    shutil.copytree(src_sub, dst_sub)

    if fonts_src.exists():
        dest_fonts = dest / "fonts"
        dest_fonts.mkdir(parents=True, exist_ok=True)
        for f in fonts_src.iterdir():
            dst_f = dest_fonts / f.name
            if not dst_f.exists():
                try:
                    dst_f.symlink_to(f)
                except Exception:
                    shutil.copy2(f, dst_f)

    print(f"✅ Project ready at: {dest}")
    print(f"💡 Next steps:")
    print(f"   1. Edit {dest}/script.json (lines & narration)")
    print(f"   2. Edit {dest}/src/shots.js (visual choreography)")
    print(f"   3. Run: python3 studio.py voice \"{dest}\"")
    print(f"   4. Run: python3 studio.py words \"{dest}\"")
    print(f"   5. Run: python3 studio.py render \"{dest}\" --fast")

def cmd_voice(project_dir: str, voice: str = "am_michael"):
    dest = Path(project_dir).expanduser().resolve()
    script_path = dest / "script.json"
    if not script_path.exists():
        print(f"❌ script.json not found in {dest}")
        sys.exit(1)

    py_bin = get_python_bin()
    voice_script = SCRIPTS_DIR / "voice.py"
    print(f"🎙️ Synthesizing voice with Kokoro neural TTS (voice: {voice})...")
    res = subprocess.run([py_bin, str(voice_script), str(dest), "--voice", voice])
    if res.returncode != 0:
        print("❌ Voice synthesis failed.")
        sys.exit(res.returncode)
    print("✅ Narration synthesized: data/narration.wav")

def cmd_words(project_dir: str):
    dest = Path(project_dir).expanduser().resolve()
    py_bin = get_python_bin()
    words_script = SCRIPTS_DIR / "words.py"
    print("⏱️ Aligning words with Faster-Whisper...")
    res = subprocess.run([py_bin, str(words_script), str(dest)])
    if res.returncode != 0:
        print("❌ Word alignment failed.")
        sys.exit(res.returncode)
    print("✅ Word timestamps aligned: data/words.json")

def cmd_mix(project_dir: str):
    dest = Path(project_dir).expanduser().resolve()
    py_bin = get_python_bin()
    mix_script = dest / "tools" / "mix.py"
    if not mix_script.exists():
        mix_script = SKILL_DIR / "styles" / "tall-tale" / "example" / "tools" / "mix.py"

    print("🎵 Mixing audio cues and BGM...")
    res = subprocess.run([py_bin, str(mix_script), str(dest)])
    if res.returncode != 0:
        print("❌ Audio mix failed.")
        sys.exit(res.returncode)
    print("✅ Audio mix complete: data/mix.wav")

def cmd_sheet(project_dir: str):
    dest = Path(project_dir).expanduser().resolve()
    capture_script = dest / "tools" / "capture.mjs"
    print("📸 Rendering visual contact sheet...")
    subprocess.run(["node", str(capture_script), "check"], cwd=str(dest))
    subprocess.run(["node", str(capture_script), "sheet", "review/all.jpg", "0.5", "10"], cwd=str(dest))
    print(f"✅ Contact sheet generated at: {dest}/review/all.jpg")

def cmd_render(project_dir: str, preset: str = "fast", output: str = "renders/master.mp4"):
    dest = Path(project_dir).expanduser().resolve()
    capture_script = dest / "tools" / "capture.mjs"
    flag = f"--{preset}"
    print(f"🚀 Rendering video (Preset: {preset}, Anti-LMK Shield active)...")
    res = subprocess.run(["node", str(capture_script), "video", output, flag], cwd=str(dest))
    if res.returncode != 0:
        print("❌ Render failed.")
        sys.exit(res.returncode)
    print(f"🎉 Master video rendered successfully: {dest}/{output}")

def cmd_selftest():
    setup_script = SCRIPTS_DIR / "setup.sh"
    selftest_script = SCRIPTS_DIR / "selftest.sh"
    if setup_script.exists():
        subprocess.run(["bash", str(setup_script)])
    if selftest_script.exists():
        subprocess.run(["bash", str(selftest_script)])

def main():
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help"):
        print_banner()
        print(__doc__)
        return

    cmd = sys.argv[1].lower()
    if cmd == "new":
        if len(sys.argv) < 4:
            print("Usage: python studio.py new <style> <project_dir>")
            print(f"Available styles: {', '.join(STYLES.keys())}")
            sys.exit(1)
        cmd_new(sys.argv[2], sys.argv[3])
    elif cmd == "voice":
        p = sys.argv[2] if len(sys.argv) > 2 else "."
        v = sys.argv[3] if len(sys.argv) > 3 else "am_michael"
        cmd_voice(p, v)
    elif cmd == "words":
        p = sys.argv[2] if len(sys.argv) > 2 else "."
        cmd_words(p)
    elif cmd == "mix":
        p = sys.argv[2] if len(sys.argv) > 2 else "."
        cmd_mix(p)
    elif cmd == "sheet":
        p = sys.argv[2] if len(sys.argv) > 2 else "."
        cmd_sheet(p)
    elif cmd == "render":
        p = sys.argv[2] if len(sys.argv) > 2 else "."
        preset = "fast"
        for arg in sys.argv[3:]:
            if arg in ("--fast", "--turbo", "--1080p"):
                preset = arg.lstrip("-")
        cmd_render(p, preset=preset)
    elif cmd == "selftest":
        cmd_selftest()
    elif cmd == "autopilot":
        p = sys.argv[2] if len(sys.argv) > 2 else "."
        preset = "fast"
        for arg in sys.argv:
            if arg in ("--fast", "--turbo", "--1080p"):
                preset = arg.lstrip("-")
        print("⚡ Executing 3D Autopilot...")
        cmd_voice(p)
        cmd_words(p)
        cmd_mix(p)
        cmd_sheet(p)
        cmd_render(p, preset=preset)
    else:
        print(f"❌ Unknown command: {cmd}")
        print("Run 'python studio.py --help' for available commands.")

if __name__ == "__main__":
    main()
