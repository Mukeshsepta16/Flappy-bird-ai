"""Loads the trained artifacts from ``model/artifacts`` and answers queries."""
from __future__ import annotations

import json
import math

from model.agents import greedy
from model.config import ACTIONS, ARTIFACT_DIR, BINS, N_STATES
from model.environment import decode_state, encode_state

EXPECTED_LEN = N_STATES


class ModelRegistry:
    def __init__(self, directory=ARTIFACT_DIR):
        meta = json.loads((directory / "metadata.json").read_text(encoding="utf-8"))
        self.comparison_note = meta.get("comparison_note", "")
        self.meta: dict[str, dict] = {m["id"]: m for m in meta["models"]}
        self.tables: dict[str, list] = {}
        for mid, m in self.meta.items():
            payload = json.loads((directory / m["file"]).read_text(encoding="utf-8"))
            table = payload["table"]
            if len(table) != EXPECTED_LEN:
                raise ValueError(f"{m['file']}: expected {EXPECTED_LEN} states, got {len(table)}")
            self.tables[mid] = table

    # -- listing -------------------------------------------------------------
    def list(self) -> list[dict]:
        return [self.meta[k] for k in self.meta]

    def has(self, model_id: str) -> bool:
        return model_id in self.meta

    def get(self, model_id: str) -> dict:
        return {**self.meta[model_id], "table": self.tables[model_id]}

    def q_table(self, model_id: str = "q") -> list:
        return self.tables[model_id]

    # -- inference -----------------------------------------------------------
    def predict(self, model_id: str, *, state_index: int | None = None, features: dict | None = None) -> dict:
        if state_index is None:
            f = features or {}
            vals = [f.get(k) for k in ("height", "velocity", "dx", "dy")]
            if any(not isinstance(v, (int, float)) or isinstance(v, bool) or not math.isfinite(v) for v in vals):
                raise ValueError("features must contain finite numbers: height, velocity, dx, dy")
            state_index = encode_state(*vals)
        if not 0 <= state_index < EXPECTED_LEN:
            raise ValueError("state_index out of range")
        q = self.tables[model_id][state_index]
        v = self.tables["v"][state_index]
        action = greedy(self.tables[model_id], state_index)
        return {
            "model": model_id,
            "state_index": state_index,
            "bins": dict(zip(("height", "velocity", "dx", "dy"), decode_state(state_index))),
            "q_values": q,
            "state_value": v,
            "visited": not (q[0] == 0 and q[1] == 0),
            "action": action,
            "action_name": ACTIONS[action],
        }

    @staticmethod
    def bins() -> dict:
        return BINS
