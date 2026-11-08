#!/bin/sh
# setup_mobile.sh — 1-Command Automated Setup for Facebook Automation Studio
# Supports Android (Termux), Kiwi Browser, and Linux/macOS Desktop

set -e

echo "===================================================================="
echo "  🚀 FACEBOOK AUTOMATION & SEO STUDIO — MOBILE & DESKTOP INSTALLER"
echo "===================================================================="

PLUGIN_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PLUGIN_DIR"

# 1. Environment Detection
if [ -d "/data/data/com.termux" ]; then
    echo "✓ Detected Android Termux environment."
    echo "Updating Termux packages..."
    pkg update -y
    echo "Installing core dependencies (python, clang, libjpeg-turbo)..."
    pkg install -y python clang libjpeg-turbo
else
    echo "✓ Detected Linux / Desktop environment."
    mkdir -p "$HOME/.local/bin"
    case ":$PATH:" in
        *":$HOME/.local/bin:"*) ;;
        *) export PATH="$HOME/.local/bin:$PATH" ;;
    esac
fi

# 2. Python Dependencies
echo "Installing Python dependencies (mcp, websockets, pillow)..."
python3 -m pip install --upgrade pip --break-system-packages 2>/dev/null || python3 -m pip install --upgrade pip 2>/dev/null || true
python3 -m pip install --break-system-packages websockets pillow mcp 2>/dev/null || python3 -m pip install websockets pillow mcp 2>/dev/null || true

# 3. Create Private Data Directory
DATA_DIR="$HOME/.antigem/facebook-automation"
mkdir -p "$DATA_DIR"
echo "✓ Initialized private database directory: $DATA_DIR"

# 4. Register Skills into Gemini / Antigravity Skills Directory
if [ -d "$HOME/.gemini/config" ]; then
    mkdir -p "$HOME/.gemini/config/skills/facebook-automation"
    mkdir -p "$HOME/.gemini/config/skills/facebook-seo"
    cp -r "$PLUGIN_DIR/skills/facebook-automation/"* "$HOME/.gemini/config/skills/facebook-automation/" 2>/dev/null || true
    cp -r "$PLUGIN_DIR/skills/facebook-seo/"* "$HOME/.gemini/config/skills/facebook-seo/" 2>/dev/null || true
    echo "✓ Registered skills (facebook-automation, facebook-seo) into ~/.gemini/config/skills"
fi

# 5. Register Directorial Rules
for rule_file in GEMINI.md AGENTS.md SKILL.md CLAUDE.md; do
    if [ -f "$PLUGIN_DIR/$rule_file" ] && [ -d "$HOME/.gemini/config/rules" ]; then
        cp "$PLUGIN_DIR/$rule_file" "$HOME/.gemini/config/rules/FB_$rule_file" 2>/dev/null || true
    fi
done

echo ""
echo "===================================================================="
echo "🎉 INSTALLATION COMPLETE! Facebook Automation Studio is ready."
echo ""
echo "📱 Mobile (Kiwi Browser on Android) Instructions:"
echo "   1. Open Kiwi Browser -> Extensions (chrome://extensions)."
echo "   2. Enable 'Developer Mode'."
echo "   3. Click 'Load unpacked' and select: $PLUGIN_DIR/extension"
echo "   4. Log in to your Facebook account in Kiwi Browser."
echo ""
echo "🖥️ Start MCP Server:"
echo "   python3 $PLUGIN_DIR/mcp_server/server.py"
echo "===================================================================="
