# Setup & System Prerequisites — Deepesh Mobile Studio

## 1. System Packages (Linux / macOS / WSL)
Ensure ffmpeg and font utilities are installed:
```bash
sudo apt update && sudo apt install -y ffmpeg fonts-noto-core fonts-noto-ui-core
```

## 2. Android Phone (Termux) Automated Setup
On Android Termux, simply run:
```bash
sh setup_mobile.sh
```
This automatically installs `ffmpeg`, `python3`, `clang`, `libjpeg-turbo`, `freetype`, `pillow`, `numpy`, and `soundfile`.

## 3. Python Dependencies
Install required Python libraries:
```bash
pip install --upgrade pip
pip install pillow numpy scipy soundfile faster-whisper
```

## 4. Google Flow (built-in DeepX engine)
- Nothing to install: the 2D Studio plugin contains the DeepX Google Flow engine.
- `deepx_check_login` opens Google Flow in the AntiGem browser and checks the Google sign-in (sign in once if asked).
- Assets: `studio_generate_assets` (or `python studio.py generate --mode agent|standard`).

## 5. Engine Verification Check
Run self-check on the core engine components:
```bash
python3 core/render.py selfcheck
python3 core/mix.py --selfcheck
python3 core/cutout.py --demo
python3 core/key.py --demo
```
