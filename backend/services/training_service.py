"""Runs a (bounded) training job on the server using the ``model`` package."""
from __future__ import annotations

import threading

from model.agents import AGENTS
from model.config import TRAIN_LIMITS
from model.evaluate import evaluate

_lock = threading.Lock()


class Busy(Exception):
    pass


def _downsample(values: list, n: int = 300) -> list:
    if len(values) <= n:
        return [round(v, 2) for v in values]
    step = (len(values) - 1) / (n - 1)
    return [round(values[round(i * step)], 2) for i in range(n)]


def train(algo: str, episodes: int, seed: int, policy_q: list | None) -> dict:
    episodes = max(TRAIN_LIMITS["min_episodes"], min(episodes, TRAIN_LIMITS["max_episodes"]))
    if not _lock.acquire(blocking=False):
        raise Busy("Another training job is already running. Try again in a few seconds.")
    try:
        agent = AGENTS[algo](seed=seed, policy_q=policy_q)
        res = agent.train(episodes, time_budget=TRAIN_LIMITS["time_budget_s"])
        out = {
            "algo": algo,
            "episodes_requested": episodes,
            "episodes": res.episodes,
            "stopped_early": res.stopped_early,
            "seconds": round(res.seconds, 2),
            "best_score": res.best_score,
            "states_seen": res.states_seen,
            "curve": _downsample(res.curve),
            "table": res.table,
        }
        if algo != "v":
            out["evaluation"] = evaluate(res.table, games=20)
        return out
    finally:
        _lock.release()
