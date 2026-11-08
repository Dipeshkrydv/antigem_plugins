"""
Configuration Module for Facebook Automation MCP Server
Zero Hardcoded Secrets & Dynamic Privacy-Clean Environment
"""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
DEFAULT_DATA_DIR = Path(os.path.expanduser("~/.antigem/facebook-automation"))
DATA_DIR = Path(os.getenv("FB_DATA_DIR", str(DEFAULT_DATA_DIR)))
DATA_DIR.mkdir(parents=True, exist_ok=True)

# SQLite Database Path
DB_PATH = Path(os.getenv("FB_DB_PATH", str(DATA_DIR / "facebook_suite.db")))

# WebSocket Bridge Configuration
WS_HOST = os.getenv("FB_WS_HOST", "127.0.0.1")
WS_PORT = int(os.getenv("FB_WS_PORT", "8766"))
WS_URL = f"ws://{WS_HOST}:{WS_PORT}"

# Security & Origin Filtering
ALLOWED_ORIGIN_PREFIXES = (
    "chrome-extension://",
    "moz-extension://",
    "http://127.0.0.1",
    "http://localhost",
)

# Operational Guardrails
MAX_POSTS_PER_DAY = int(os.getenv("FB_MAX_POSTS_PER_DAY", "30"))
MIN_POST_INTERVAL_SECONDS = int(os.getenv("FB_MIN_POST_INTERVAL_SECONDS", "45"))
DEDUPE_WINDOW_HOURS = int(os.getenv("FB_DEDUPE_WINDOW_HOURS", "48"))
LOCK_TTL_SECONDS = int(os.getenv("FB_LOCK_TTL_SECONDS", "180"))

# Dynamic Active Account State (Loaded dynamically from extension, never hardcoded)
ACTIVE_ACCOUNT_CACHE = DATA_DIR / "active_account.json"
