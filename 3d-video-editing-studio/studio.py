#!/usr/bin/env python3
"""
Deepesh Mobile Studio — Stickman Video Editing Studio (Stick Story Engine)
Universal Autonomous Executive Studio & Production CLI

Commands:
  python studio.py new [style] <project_dir>   Scaffold a self-contained Stick Story project
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
    "stick-story": "Stick Story (Tactical survival, stick figures with emotive eyes, day/night sets)",
    "stickman": "Stickman Storytelling (Ink-black stick figures with emotive acting eyes, gold numbered step cards)"
}

def print_banner():
    print("""
========================================================================
 🏃 STICKMAN VIDEO EDITING STUDIO (STICK STORY ENGINE) v1.2.0
 100% Code-Driven Stick Figure Storytelling | Canvas + Kokoro TTS + Whisper
========================================================================
""")

def get_python_bin():
    fh = Path(os.environ.get("FACELESS_HOME", Path.home() / ".faceless-shorts"))
    venv_py = fh / "venv" / "bin" / "python"
    if venv_py.exists():
        return str(venv_py)
    return sys.executable

def cmd_new(style: str, target: str):
    if style in ("stickman", "stick_story", "stick-man"):
        style = "stick-story"

    if style not in STYLES:
        print(f"⚠️ Defaulting to 'stick-story' (Stickman Storytelling)...")
        style = "stick-story"

    example_dir = STYLES_DIR / style / "example"
    if not example_dir.exists():
        example_dir = STYLES_DIR / "stick-story" / "example"

    if not example_dir.exists():
        print(f"❌ Stick Story style template not found at {example_dir}")
        sys.exit(1)

    dest = Path(target).expanduser().resolve()
    if dest.exists():
        print(f"⚠️ Destination directory '{dest}' already exists. Using existing directory.")
    else:
        print(f"📦 Scaffolding new Stickman Story project at {dest}...")
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
        for font_file in fonts_src.glob("*"):
            dst_font = dest_fonts / font_file.name
            if not dst_font.exists():
                try:
                    dst_font.symlink_to(font_file)
                except Exception:
                    shutil.copy(font_file, dst_font)

    print(f"✅ Stickman Story project ready at: {dest}")
    print("Next steps:")
    print("  1. Edit script.json to adjust your spoken lines and step cards")
    print(f"  2. python studio.py voice {dest} --voice am_puck")
    print(f"  3. python studio.py words {dest}")
    print(f"  4. python studio.py mix {dest}")
    print(f"  5. python studio.py sheet {dest}")
    print(f"  6. python studio.py render {dest} --fast")

def cmd_voice(project_dir: str, voice: str = "am_puck"):
    py = get_python_bin()
    voice_script = SCRIPTS_DIR / "voice.py"
    target = Path(project_dir).expanduser().resolve()
    print(f"🎙️ Generating voiceover for {target} using voice '{voice}'...")
    subprocess.run([py, str(voice_script), str(target), "--voice", voice], check=True)

def cmd_words(project_dir: str):
    py = get_python_bin()
    words_script = SCRIPTS_DIR / "words.py"
    target = Path(project_dir).expanduser().resolve()
    print(f"⚡ Aligning words via Faster-Whisper for {target}...")
    subprocess.run([py, str(words_script), str(target)], check=True)

def cmd_mix(project_dir: str):
    py = get_python_bin()
    target = Path(project_dir).expanduser().resolve()
    mix_script = target / "tools" / "mix.py"
    if not mix_script.exists():
        mix_script = SCRIPTS_DIR / "mix.py"
    print(f"🎚️ Mixing procedural audio and music for {target}...")
    subprocess.run([py, str(mix_script), str(target)], check=True)

def cmd_sheet(project_dir: str, interval: float = 0.5, cols: int = 10):
    target = Path(project_dir).expanduser().resolve()
    capture_tool = target / "tools" / "capture.mjs"
    sheet_out = target / "review" / "all.jpg"
    print(f"📸 Generating contact sheet QA at {sheet_out}...")
    subprocess.run(["node", str(capture_tool), "sheet", str(sheet_out), str(interval), str(cols)], cwd=str(target), check=True)
    print(f"✅ QA Sheet written to {sheet_out}")

def cmd_render(project_dir: str, preset: str = "fast"):
    target = Path(project_dir).expanduser().resolve()
    capture_tool = target / "tools" / "capture.mjs"
    out_mp4 = target / "renders" / "master.mp4"

    scale_flag = []
    fps_flag = []
    if preset == "turbo":
        print("🏎️ Rendering with --turbo preset (540p ultrafast draft, 45-55 FPS)...")
        scale_flag = ["--scale", "0.5"]
        fps_flag = ["--fps", "24"]
    elif preset == "fast":
        print("⚡ Rendering with --fast preset (720p HD mobile default, Anti-LMK protected)...")
        scale_flag = ["--scale", "0.6667"]
        fps_flag = ["--fps", "30"]
    else:
        print("🌟 Rendering with --1080p preset (Full HD master)...")
        scale_flag = ["--scale", "1.0"]
        fps_flag = ["--fps", "30"]

    cmd = ["node", str(capture_tool), "video", str(out_mp4)] + scale_flag + fps_flag
    subprocess.run(cmd, cwd=str(target), check=True)
    print(f"🎉 Master render complete: {out_mp4}")

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
        if len(sys.argv) == 3:
            cmd_new("stick-story", sys.argv[2])
        elif len(sys.argv) >= 4:
            cmd_new(sys.argv[2], sys.argv[3])
        else:
            print("Usage: python studio.py new [style] <project_dir>")
            print(f"Available styles: {', '.join(STYLES.keys())}")
            sys.exit(1)
    elif cmd == "voice":
        p = sys.argv[2] if len(sys.argv) > 2 else "."
        v = sys.argv[3] if len(sys.argv) > 3 else "am_puck"
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
        print("⚡ Executing Stickman Autopilot...")
        cmd_voice(p, "am_puck")
        cmd_words(p)
        cmd_mix(p)
        cmd_sheet(p)
        cmd_render(p, preset=preset)
    else:
        print(f"❌ Unknown command: {cmd}")
        print("Run 'python studio.py --help' for available commands.")

if __name__ == "__main__":
    main()
