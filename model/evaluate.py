"""Greedy evaluation of a trained Q table.

Protocol (matches the original project's report): one environment seeded once,
``games`` consecutive greedy games with no exploration. A step cap prevents an
unbeatable agent from looping forever.
"""
from __future__ import annotations

from statistics import mean

from .agents import greedy
from .environment import FlappyEnv

EVAL_STEP_CAP = 20000


def evaluate(q_table: list, games: int = 30, seed: int = 42, max_steps: int = EVAL_STEP_CAP) -> dict:
    env = FlappyEnv(seed, max_steps)
    scores, crashes = [], 0
    for _ in range(games):
        env.reset()
        while not env.over:
            env.step(greedy(q_table, env.state()))
        scores.append(env.score)
        crashes += env.crash
    return {
        "games": games,
        "mean_score": round(mean(scores), 2),
        "best_score": max(scores),
        "min_score": min(scores),
        "survived": games - crashes,
    }
