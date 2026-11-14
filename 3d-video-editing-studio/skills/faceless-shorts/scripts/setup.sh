#!/usr/bin/env bash
# Universal Auto-Setup for Faceless Shorts. Safe to re-run.
# Automatically detects and installs:
#   - Node.js 22+, ffmpeg, Chromium/Chrome on Termux, Ubuntu/Debian, or macOS
#   - Private Python 3.10+ virtualenv (~/.faceless-shorts/venv) with numpy, scipy, kokoro-onnx, faster-whisper
#   - Kokoro TTS models (~340 MB) and Whisper small.en model (~0.5 GB)
#   - Registers skill into AntiGem / Gemini IDE config

set -u
ok=1; say() { printf '%-12s %s\n' "$1" "$2"; }
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
SKILL="$(cd "$(dirname "$0")/.." && pwd)"; FH="${FACELESS_HOME:-$HOME/.faceless-shorts}"; VENV="$FH/venv"

# 1. Automatic OS Package Manager Installation if packages are missing
is_termux() { [ -d "/data/data/com.termux" ] || [ -d "/data/user/0/com.termux" ] || [ -n "${TERMUX_VERSION:-}" ]; }

check_system_prereqs() {
  local need_install=0
  command -v node >/dev/null 2>&1 || need_install=1
  command -v ffmpeg >/dev/null 2>&1 || need_install=1
  [ $need_install -eq 0 ] && return 0

  echo "⚡ Missing system prerequisites detected. Attempting auto-installation..."
  if is_termux; then
    echo "📱 Android Termux detected. Running pkg install..."
    pkg update -y || true
    pkg install -y nodejs-lts ffmpeg chromium python clang libjpeg-turbo freetype || true
  elif command -v apt-get >/dev/null 2>&1; then
    echo "🐧 Debian/Ubuntu detected. Running apt-get install..."
    SUDO=""; [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1 && SUDO="sudo"
    $SUDO apt-get update -y || true
    $SUDO apt-get install -y nodejs ffmpeg chromium-browser python3 python3-pip python3-venv || true
  elif command -v brew >/dev/null 2>&1; then
    echo "🍎 macOS detected. Running brew install..."
    brew install node ffmpeg --cask google-chrome || true
  fi
}

check_system_prereqs

# 2. Node.js Verification
NODE_V=$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1 || echo "")
if [ -n "$NODE_V" ] && [ "$NODE_V" -ge 20 ]; then
  say node "ok ($(node -v))"
else
  say node "MISSING or too old: need Node.js 20+ (installing via system package manager recommended)"
  ok=0
fi

# 3. FFmpeg Verification
if command -v ffmpeg >/dev/null && command -v ffprobe >/dev/null; then
  say ffmpeg ok
else
  say ffmpeg "MISSING: install ffmpeg"
  ok=0
fi

# 4. Chrome / Chromium Verification
CH=""
for p in "${CHROME:-}" \
  "/data/user/0/com.termux/files/usr/bin/chromium-browser" \
  "/data/data/com.termux/files/usr/bin/chromium-browser" \
  "/data/user/0/com.termux/files/usr/bin/chromium" \
  "/data/data/com.termux/files/usr/bin/chromium" \
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  "/Applications/Chromium.app/Contents/MacOS/Chromium" \
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" \
  /usr/bin/google-chrome \
  /usr/bin/google-chrome-stable \
  /usr/bin/chromium \
  /usr/bin/chromium-browser \
  /snap/bin/chromium \
  "C:/Program Files/Google/Chrome/Application/chrome.exe" \
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"; do
  [ -n "$p" ] && [ -x "$p" ] && CH="$p" && break
done

if [ -n "$CH" ]; then
  say chrome "ok ($CH)"
else
  say chrome "MISSING: install Google Chrome or Chromium"
  ok=0
fi

# 5. Python Virtual Environment & Models
PYBIN=""
for p in python3.12 python3.11 python3.10 python3 python "py -3"; do
  $p -c "import sys; assert sys.version_info >= (3, 10)" >/dev/null 2>&1 && PYBIN=$p && break
done

mkdir -p "$FH"
if [ ! -x "$VENV/bin/python" ] && [ ! -x "$VENV/Scripts/python.exe" ]; then
  echo "Building private Python environment in $VENV..."
  if command -v uv >/dev/null 2>&1; then
    uv venv --python 3.11 "$VENV" >/dev/null 2>&1 || uv venv "$VENV" >/dev/null 2>&1
  elif [ -n "$PYBIN" ]; then
    $PYBIN -m venv "$VENV"
  fi
fi

PY="$VENV/bin/python"; [ -x "$PY" ] || PY="$VENV/Scripts/python.exe"
CHECK="import numpy, scipy, kokoro_onnx, faster_whisper"

if [ -x "$PY" ]; then
  if ! "$PY" -c "$CHECK" 2>/dev/null; then
    echo "Installing required Python libraries (numpy, scipy, kokoro-onnx, faster-whisper)..."
    if command -v uv >/dev/null 2>&1; then
      uv pip install --python "$PY" -q numpy scipy kokoro-onnx faster-whisper soundfile >/dev/null 2>&1
    else
      "$PY" -m pip install -q --upgrade pip >/dev/null 2>&1 || true
      "$PY" -m pip install -q numpy scipy kokoro-onnx faster-whisper soundfile >/dev/null 2>&1
    fi
  fi

  if "$PY" -c "$CHECK" 2>/dev/null; then
    say python-env "ok ($VENV)"
  else
    say python-env "BROKEN: running pip install..."
    "$PY" -m pip install numpy scipy kokoro-onnx faster-whisper soundfile || ok=0
  fi

  # Ensure Kokoro weights
  if "$PY" "$SKILL/scripts/voice.py" --download >/dev/null 2>&1; then
    say voice "ok (Kokoro, $FH/kokoro)"
  else
    say voice "model download FAILED (check internet connection)"
    ok=0
  fi

  # Ensure Whisper small.en
  WHISPER_DIR="$HOME/.cache/huggingface/hub/models--Systran--faster-whisper-small.en"
  if [ -d "$WHISPER_DIR" ] && [ -n "$(find "$WHISPER_DIR" -name "model.bin" 2>/dev/null)" ]; then
    say whisper "ok (small.en, cached)"
  elif "$PY" -c "from faster_whisper import WhisperModel; WhisperModel('small.en', device='cpu', compute_type='int8')" >/dev/null 2>&1; then
    say whisper "ok (small.en)"
  else
    say whisper "model download FAILED"
    ok=0
  fi
else
  say python-env "MISSING: install Python 3.10+ (python.org)"
  ok=0
fi

# 6. Ensure executable permissions
chmod +x "$SKILL"/scripts/* 2>/dev/null || true

# 7. Register Skill into AntiGem / Gemini Skills Directory
if [ -d "$HOME/.gemini/config/skills" ]; then
  mkdir -p "$HOME/.gemini/config/skills/faceless-shorts"
  ln -sfn "$SKILL" "$HOME/.gemini/config/skills/faceless-shorts" 2>/dev/null || true
  say ide-skill "ok (~/.gemini/config/skills/faceless-shorts)"
fi

if [ $ok = 1 ]; then
  echo "===================================================================="
  echo "🎉 ALL SET! Faceless Shorts Studio is 100% installed and ready to use."
  echo "===================================================================="
else
  echo "⚠️ Setup incomplete. Please resolve the issues above and re-run setup.sh."
  exit 1
fi
