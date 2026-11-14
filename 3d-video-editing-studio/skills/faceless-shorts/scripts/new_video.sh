#!/usr/bin/env bash
# Start a new video from a style's working example (engine + shots + script), so it renders straight away.
#   bash new_video.sh <style> <short-name> [--dir <parent>]     → ~/faceless-shorts/<short-name>/
#   bash new_video.sh --list                                    the styles
set -eu
SKILL="$(cd "$(dirname "$0")/.." && pwd)"
FH="${FACELESS_HOME:-$HOME/.faceless-shorts}"

# Pre-flight check: ensure everything is installed before starting
if [ ! -x "$FH/venv/bin/python" ] || ! command -v ffmpeg >/dev/null 2>&1 || ! command -v node >/dev/null 2>&1 || [ ! -f "$FH/kokoro/kokoro-v1.0.onnx" ] || [ ! -f "$FH/kokoro/voices-v1.0.bin" ]; then
    echo "⚡ Prerequisites missing or incomplete: automatically installing all tools & models..."
    bash "$SKILL/scripts/setup.sh"
fi

if [ "${1:-}" = "--list" ]; then for d in "$SKILL"/styles/*/; do echo "$(basename "$d")"; done; exit 0; fi
USAGE="usage: new_video.sh <style> <short-name> [--dir <parent>]   (styles: $(ls "$SKILL/styles" | tr '\n' ' '))"
STYLE="${1:?$USAGE}"; NAME="${2:?$USAGE}"; shift 2
PARENT="$HOME/faceless-shorts"
while [ $# -gt 0 ]; do case "$1" in --dir) PARENT="${2:?}"; shift 2 ;; *) echo "unknown option $1" >&2; exit 2 ;; esac; done
SRC="$SKILL/styles/$STYLE/example"
[ -d "$SRC" ] || { echo "no style '$STYLE' ($USAGE)" >&2; exit 2; }
DST="$PARENT/$NAME"
[ -e "$DST" ] && { echo "$DST already exists: pick another name" >&2; exit 2; }
mkdir -p "$PARENT"; cp -R "$SRC" "$DST"; mkdir -p "$DST/renders" "$DST/review"
rm -f "$DST/data/narration.wav" "$DST/data/mix.wav"

# Automatically attach audio and fonts library
mkdir -p "$DST/audio" "$DST/fonts"
if [ -d "$SKILL/audio" ]; then
    ln -sfn "$SKILL/audio/sfx" "$DST/audio/sfx" 2>/dev/null || cp -rn "$SKILL/audio/sfx" "$DST/audio/" 2>/dev/null || true
    ln -sfn "$SKILL/audio/music" "$DST/audio/music" 2>/dev/null || cp -rn "$SKILL/audio/music" "$DST/audio/" 2>/dev/null || true
fi
if [ -d "$SKILL/fonts" ]; then
    for f in "$SKILL"/fonts/*; do
        bn=$(basename "$f")
        [ -e "$DST/fonts/$bn" ] || ln -sfn "$f" "$DST/fonts/$bn" 2>/dev/null || cp -rn "$f" "$DST/fonts/" 2>/dev/null || true
    done
fi

echo "$DST"
echo "style: $STYLE. Read $SKILL/styles/$STYLE/STYLE.md, then rewrite script.json + src/shots.js"
