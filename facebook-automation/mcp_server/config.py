import os

WS_HOST = os.getenv("WS_HOST", "127.0.0.1")
WS_PORT = int(os.getenv("WS_PORT", "8765"))
DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "meta_suite.db"))
