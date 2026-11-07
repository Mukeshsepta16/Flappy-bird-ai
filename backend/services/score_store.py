"""Tiny thread-safe JSON leaderboard (swap for a real DB in production)."""
from __future__ import annotations

import json
import os
import re
import threading
import time
from pathlib import Path

MODES = {"h": "Self Play", "q": "Q-Learning", "s": "SARSA", "c": "Co-pilot"}
_CLEAN = re.compile(r"[^\w .\-'!]", re.UNICODE)


class ScoreStore:
    def __init__(self, path: Path, max_entries: int = 1000):
        self.path = Path(path)
        self.max = max_entries
        self._lock = threading.Lock()
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def _read(self) -> list[dict]:
        try:
            return json.loads(self.path.read_text(encoding="utf-8"))
        except (FileNotFoundError, json.JSONDecodeError):
            return []

    def _write(self, rows: list[dict]) -> None:
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, self.path)  # atomic

    @staticmethod
    def clean_name(name: str, limit: int) -> str:
        name = _CLEAN.sub("", str(name or "")).strip()[:limit]
        return name or "Anonymous"

    @staticmethod
    def _order(r: dict):
        return (-r["score"], r["ts"])

    def add(self, name: str, mode: str, score: int, name_limit: int = 16) -> dict:
        entry = {"name": self.clean_name(name, name_limit), "mode": mode, "score": int(score), "ts": int(time.time())}
        with self._lock:
            rows = self._read()
            rows.append(entry)
            rows.sort(key=self._order)
            rows = rows[: self.max]
            self._write(rows)
            same = [r for r in rows if r["mode"] == mode]
            rank = next((i + 1 for i, r in enumerate(same) if r is entry or r == entry), None)
        return {**entry, "rank": rank}

    def top(self, mode: str | None = None, limit: int = 10) -> list[dict]:
        with self._lock:
            rows = self._read()
        if mode:
            rows = [r for r in rows if r["mode"] == mode]
        rows.sort(key=self._order)
        return rows[:limit]

    def summary(self) -> dict:
        with self._lock:
            rows = self._read()
        return {"total_games": len(rows), "best": max((r["score"] for r in rows), default=0)}
