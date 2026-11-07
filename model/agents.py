"""Tabular TD learning agents: Q-Learning, SARSA and TD(0) prediction."""
from __future__ import annotations

import random
import time
from dataclasses import dataclass, field

from .config import HYPER, N_ACTIONS, N_STATES
from .environment import FlappyEnv


@dataclass
class TrainResult:
    algo: str
    episodes: int
    table: list
    curve: list = field(default_factory=list)      # moving-average reward
    best_score: int = 0
    seconds: float = 0.0
    states_seen: int = 0
    stopped_early: bool = False


def greedy(q: list, s: int) -> int:
    return 1 if q[s][1] > q[s][0] else 0


class _Base:
    algo = ""

    def __init__(self, seed: int = 0, policy_q: list | None = None):
        self.rng = random.Random(seed)
        self.seed = seed
        self.policy_q = policy_q

    def _explore_action(self) -> int:
        return 1 if self.rng.random() < HYPER["flap_prob"] else 0

    def train(self, episodes: int, time_budget: float | None = None) -> TrainResult:
        raise NotImplementedError


class _TDControl(_Base):
    """Shared loop for Q-Learning (off-policy) and SARSA (on-policy)."""

    on_policy = False

    def train(self, episodes, time_budget=None):
        H = HYPER
        q = [[0.0, 0.0] for _ in range(N_STATES)]
        env = FlappyEnv(self.seed * 7919 + 13, H["max_steps"])
        eps, best, rewards, curve, seen = H["eps_start"], 0, [], [], set()
        t0, done_eps, stopped = time.time(), 0, False

        def pick(s):
            if self.rng.random() < eps:
                return self._explore_action()
            return greedy(q, s)

        for ep in range(episodes):
            if time_budget and time.time() - t0 > time_budget:
                stopped = True
                break
            env.reset()
            s = env.state()
            a = pick(s)
            total = 0.0
            while not env.over:
                r = env.step(a)
                s2 = env.state()
                total += r
                seen.add(s)
                a2 = pick(s2)
                if env.crash:
                    target = r
                elif self.on_policy:
                    target = r + H["gamma"] * q[s2][a2]
                else:
                    target = r + H["gamma"] * max(q[s2])
                q[s][a] += H["alpha"] * (target - q[s][a])
                s, a = s2, a2
            best = max(best, env.score)
            rewards.append(total)
            window = rewards[-50:]
            curve.append(sum(window) / len(window))
            eps = max(H["eps_min"], eps * H["eps_decay"])
            done_eps += 1

        table = [[round(x, 1) for x in row] for row in q]
        return TrainResult(self.algo, done_eps, table, curve, best, time.time() - t0, len(seen), stopped)


class QLearning(_TDControl):
    algo = "q"


class Sarsa(_TDControl):
    algo = "s"
    on_policy = True


class TDPrediction(_Base):
    """V(s) estimation while following a fixed (trained) Q-Learning policy."""

    algo = "v"

    def train(self, episodes, time_budget=None):
        if not self.policy_q:
            raise ValueError("TD prediction needs a trained Q table to follow")
        H = HYPER
        v = [0.0] * N_STATES
        env = FlappyEnv(self.seed * 7919 + 13, H["max_steps"])
        best, rewards, curve, seen = 0, [], [], set()
        t0, done_eps, stopped = time.time(), 0, False

        def pick(s):
            if self.rng.random() < H["td_eps"]:
                return self._explore_action()
            return greedy(self.policy_q, s)

        for ep in range(episodes):
            if time_budget and time.time() - t0 > time_budget:
                stopped = True
                break
            env.reset()
            s = env.state()
            total = 0.0
            while not env.over:
                r = env.step(pick(s))
                s2 = env.state()
                total += r
                seen.add(s)
                target = r if env.crash else r + H["gamma"] * v[s2]
                v[s] += H["alpha"] * (target - v[s])
                s = s2
            best = max(best, env.score)
            rewards.append(total)
            window = rewards[-50:]
            curve.append(sum(window) / len(window))
            done_eps += 1

        table = [round(x, 1) for x in v]
        return TrainResult(self.algo, done_eps, table, curve, best, time.time() - t0, len(seen), stopped)


AGENTS = {"q": QLearning, "s": Sarsa, "v": TDPrediction}
