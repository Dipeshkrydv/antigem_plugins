#!/usr/bin/env bash
# Doctor & Diagnostic Pre-flight Verification for Faceless Shorts
# Verifies all 6 core components and auto-repairs if needed.
# Usage:
#   bash doctor.sh          Check health and auto-install if anything is missing
#   bash doctor.sh --check  Check only without auto-installing
set -u

SKILL="$(cd "$(dirname "$0")/.." && pwd)"
FH="${FACELESS_HOME:-$HOME/.faceless-shorts}"
VENV="$FH/venv"
PY="$VENV/bin/python"; [ -x "$PY" ] || PY="$VENV/Scripts/python.exe"

echo "===================================================================="
echo "🩺 FACELESS SHORTS 3D: PRE-FLIGHT ENVIRONMENT & HEALTH CHECK"
echo "===================================================================="

is_termux() { [ -d "/data/data/com.termux" ] || [ -d "/data/user/0/com.termux" ] || [ -n "${TERMUX_VERSION:-}" ]; }

# 1. Environment Details
echo -n "📱 Platform:        "
if is_termux; then
  echo "Android Termux (Mobile Anti-LMK Shield active)"
else
  echo "$(uname -s) $(uname -m) ($(grep -s -i "PRETTY_NAME" /etc/os-release | cut -d= -f2 | tr -d '\"' || echo "Desktop"))"
fi

TOTAL_MEM_MB=$(node -e 'console.log(Math.round(os.totalmem() / 1024 / 1024))' 2>/dev/null || echo "Unknown")
echo "🧠 Total Memory:    ${TOTAL_MEM_MB} MB"

all_ok=1

# 2. Node.js Check
echo -n "🟢 Node.js:         "
if command -v node >/dev/null 2>&1; then
  NODE_V=$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1 || echo "0")
  if [ "$NODE_V" -ge 18 ]; then
    echo "OK ($(node -v))"
  else
    echo "OUTDATED ($(node -v), need 18+)"; all_ok=0
  fi
else
  echo "MISSING"; all_ok=0
fi

# 3. FFmpeg Check
echo -n "🎬 FFmpeg:          "
if command -v ffmpeg >/dev/null 2>&1 && command -v ffprobe >/dev/null 2>&1; then
  echo "OK ($(ffmpeg -version 2>/dev/null | head -n1 | cut -d' ' -f3))"
else
  echo "MISSING"; all_ok=0
fi

# 4. Chrome / Chromium Check
echo -n "🌐 Browser Engine:  "
CH=""
for p in "${CHROME:-}" \
  "/data/user/0/com.termux/files/usr/bin/chromium-browser" \
  "/data/data/com.termux/files/usr/bin/chromium-browser" \
  "/data/user/0/com.termux/files/usr/bin/chromium" \
  "/data/data/com.termux/files/usr/bin/chromium" \
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  "/Applications/Chromium.app/Contents/MacOS/Chromium" \
  /usr/bin/google-chrome \
  /usr/bin/google-chrome-stable \
  /usr/bin/chromium \
  /usr/bin/chromium-browser; do
  [ -n "$p" ] && [ -x "$p" ] && CH="$p" && break
done

if [ -n "$CH" ]; then
  echo "OK ($CH)"
else
  echo "MISSING"; all_ok=0
fi

# 5. Python Environment & Libraries
echo -n "🐍 Python Venv:     "
if [ -x "$PY" ] && "$PY" -c "import numpy, scipy, kokoro_onnx, faster_whisper, soundfile" >/dev/null 2>&1; then
  echo "OK ($VENV)"
else
  echo "MISSING or INCOMPLETE"; all_ok=0
fi

# 6. Kokoro TTS Neural Models
echo -n "🎙️  Kokoro TTS Model: "
if [ -f "$FH/kokoro/kokoro-v1.0.onnx" ] && [ -f "$FH/kokoro/voices-v1.0.bin" ]; then
  SZ1=$(wc -c < "$FH/kokoro/kokoro-v1.0.onnx" 2>/dev/null || echo "0")
  if [ "$SZ1" -gt 300000000 ]; then
    echo "OK ($FH/kokoro/)"
  else
    echo "CORRUPTED (size < 300MB)"; all_ok=0
  fi
else
  echo "MISSING"; all_ok=0
fi

# 7. Whisper Model
echo -n "👂 Whisper Model:    "
WHISPER_DIR="$HOME/.cache/huggingface/hub/models--Systran--faster-whisper-small.en"
if [ -d "$WHISPER_DIR" ] && [ -n "$(find "$WHISPER_DIR" -name "model.bin" 2>/dev/null)" ]; then
  echo "OK (small.en, cached)"
elif [ -x "$PY" ] && "$PY" -c "from faster_whisper import WhisperModel; WhisperModel('small.en', device='cpu', compute_type='int8')" >/dev/null 2>&1; then
  echo "OK (small.en)"
else
  echo "MISSING"; all_ok=0
fi

# 8. Audio SFX & Music Library Check
echo -n "🎵 Audio Library:    "
AUDIO_CNT=0
if [ -d "$SKILL/audio" ]; then
  AUDIO_CNT=$(find "$SKILL/audio" -type f \( -name "*.mp3" -o -name "*.wav" \) 2>/dev/null | wc -l)
fi
if [ "$AUDIO_CNT" -gt 50 ]; then
  echo "OK ($AUDIO_CNT tracks & SFX samples in $SKILL/audio/)"
else
  echo "INCOMPLETE ($AUDIO_CNT files found)"; all_ok=0
fi

# 9. Multilingual Typography Fonts Check
echo -n "🔤 Font Library:     "
FONT_CNT=0
if [ -d "$SKILL/fonts" ]; then
  FONT_CNT=$(find "$SKILL/fonts" -type f \( -name "*.ttf" -o -name "*.otf" -o -name "*.TTF" \) 2>/dev/null | wc -l)
fi
if [ "$FONT_CNT" -ge 15 ]; then
  echo "OK ($FONT_CNT multilingual fonts: English, Hindi, Nepali)"
else
  echo "INCOMPLETE ($FONT_CNT fonts found)"; all_ok=0
fi

echo "===================================================================="

if [ $all_ok -eq 1 ]; then
  echo "🎉 100% HEALTHY! Everything is installed and ready to render 3D videos."
  echo "===================================================================="
  exit 0
else
  if [ "${1:-}" = "--check" ]; then
    echo "⚠️  Some dependencies are missing. Run: bash skills/faceless-shorts/scripts/setup.sh"
    echo "===================================================================="
    exit 1
  else
    echo "⚡ Automatically running auto-installer to install missing components..."
    echo "===================================================================="
    bash "$SKILL/scripts/setup.sh"
  fi
fi
