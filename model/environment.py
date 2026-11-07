"""Python port of the browser Flappy Bird environment.

The logic is a line-for-line port of ``frontend/js/game/env.js`` including the
mulberry32 random generator, so a given seed produces the same pipes in both.
"""
from __future__ import annotations

from bisect import bisect_right

from .config import BINS, PHYSICS as C, REWARDS, WORLD_WIDTH as WORLD_W

_M = 0xFFFFFFFF


def mulberry32(seed: int):
    """Deterministic 32-bit PRNG (identical to the JS implementation)."""
    a = seed & _M

    def nxt() -> float:
        nonlocal a
        a = (a + 0x6D2B79F5) & _M
        t = ((a ^ (a >> 15)) * (1 | a)) & _M
        t = ((t + (((t ^ (t >> 7)) * (61 | t)) & _M)) & _M) ^ t
        return ((t ^ (t >> 14)) & _M) / 4294967296

    return nxt


def _bin(edges: list, value: float) -> int:
    # same as the JS helper: count of edges <= value
    return bisect_right(edges, value)


def encode_state(height: float, velocity: float, dx: float, dy: float) -> int:
    """Map the 4 raw features to a single state index in [0, 5760)."""
    return (
        (_bin(BINS["height"], height) * 8 + _bin(BINS["velocity"], velocity)) * 10
        + _bin(BINS["dx"], dx)
    ) * 12 + _bin(BINS["dy"], dy)


def decode_state(index: int) -> list[int]:
    """Inverse of :func:`encode_state` -> the four bin numbers."""
    return [index // 960, (index // 120) % 8, (index // 12) % 10, index % 12]


class FlappyEnv:
    def __init__(self, seed: int = 0, max_steps: int = 0):
        self.rnd = mulberry32(seed)
        self.max = max_steps
        self.reset()

    # -- pipes ---------------------------------------------------------------
    def _gap(self) -> float:
        return max(C["GMIN"], C["GS"] - self.score)

    def _spawn(self, x: float) -> None:
        g = self._gap()
        lo = C["GM"] + g / 2
        hi = C["GY"] - C["GM"] - g / 2
        self.pipes.append({"x": x, "c": lo + self.rnd() * (hi - lo), "g": g, "done": False})

    def _fill(self) -> None:
        while self.pipes[-1]["x"] < WORLD_W:
            self._spawn(self.pipes[-1]["x"] + C["SP"])

    def reset(self) -> None:
        self.y = 250.0
        self.v = 0.0
        self.pipes: list[dict] = []
        self.score = 0
        self.steps = 0
        self.over = False
        self.crash = False
        self.why = ""
        self._spawn(C["FX"])
        self._fill()

    def speed(self) -> float:
        return min(C["SMAX"], C["SS"] + C["SINC"] * self.score)

    # -- observation -----------------------------------------------------------
    def next_pipe(self) -> dict:
        for p in self.pipes:
            if p["x"] + C["PW"] >= C["BX"] - C["R"]:
                return p
        return self.pipes[-1]

    def features(self) -> list[float]:
        p = self.next_pipe()
        return [self.y, self.v, p["x"] - C["BX"], p["c"] - self.y]

    def state(self) -> int:
        return encode_state(*self.features())

    # -- dynamics --------------------------------------------------------------
    def step(self, action: int) -> float:
        if action:
            self.v = C["FV"]
        self.v = min(self.v + C["G"], C["MF"])
        self.y += self.v
        sp = self.speed()
        for p in self.pipes:
            p["x"] -= sp
        if self.pipes[0]["x"] + C["PW"] < -10:
            self.pipes.pop(0)
        self._fill()
        self.steps += 1
        r = C["R"]
        why = ""
        if self.y - r <= 0:
            why = "ceiling"
        elif self.y + r >= C["GY"]:
            why = "ground"
        else:
            for p in self.pipes:
                if p["x"] < C["BX"] + r and p["x"] + C["PW"] > C["BX"] - r:
                    if self.y - r < p["c"] - p["g"] / 2 or self.y + r > p["c"] + p["g"] / 2:
                        why = "pipe"
                    break
        if why:
            self.over = self.crash = True
            self.why = why
            return REWARDS["crash"]
        reward = REWARDS["step"]
        for p in self.pipes:
            if not p["done"] and p["x"] + C["PW"] < C["BX"] - r:
                p["done"] = True
                self.score += 1
                reward += REWARDS["pipe"]
        if self.max and self.steps >= self.max:
            self.over = True
        return reward

