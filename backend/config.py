import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class Config:
    FRONTEND_DIR = ROOT / "frontend"
    DATA_DIR = ROOT / "backend" / "data"
    SCORES_FILE = DATA_DIR / "scores.json"
    MAX_SCORES_STORED = 1000
    MAX_NAME_LENGTH = 16
    MAX_SCORE = 10_000
    JSON_SORT_KEYS = False
    # set CORS_ORIGIN=http://localhost:5173 if you host the frontend elsewhere
    CORS_ORIGIN = os.environ.get("CORS_ORIGIN", "")
