"""Command-line trainer.

    python -m model.train --algo q --episodes 5000
    python -m model.train --algo all --episodes 5000 --seed 1 --out model/artifacts

Writes ``q_table.json`` / ``sarsa_table.json`` / ``td_values.json`` so the
backend can serve them. Use ``--dry-run`` to train without overwriting files.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from .agents import AGENTS
from .config import ARTIFACT_DIR
from .evaluate import evaluate

FILES = {"q": "q_table.json", "s": "sarsa_table.json", "v": "td_values.json"}


def load_table(algo: str, directory: Path = ARTIFACT_DIR) -> list:
    with open(directory / FILES[algo], encoding="utf-8") as fh:
        return json.load(fh)["table"]


def save_table(algo: str, table: list, directory: Path = ARTIFACT_DIR) -> Path:
    shape = [len(table)] if algo == "v" else [len(table), 2]
    kind = "v_table" if algo == "v" else "q_table"
    path = directory / FILES[algo]
    with open(path, "w", encoding="utf-8") as fh:
        json.dump({"algo": algo, "kind": kind, "shape": shape, "table": table}, fh, separators=(",", ":"))
    return path


def run(algo: str, episodes: int, seed: int, out: Path, dry: bool) -> None:
    policy = load_table("q", out) if algo == "v" else None
    result = AGENTS[algo](seed=seed, policy_q=policy).train(episodes)
    line = f"[{algo}] {result.episodes} episodes in {result.seconds:.1f}s | best score {result.best_score} | states seen {result.states_seen}"
    if algo != "v":
        ev = evaluate(result.table)
        line += f" | greedy eval mean {ev['mean_score']} (best {ev['best_score']})"
    print(line)
    if not dry:
        print("   saved ->", save_table(algo, result.table, out))


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--algo", choices=["q", "s", "v", "all"], default="all")
    ap.add_argument("--episodes", type=int, default=5000)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--out", type=Path, default=ARTIFACT_DIR)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    for algo in (["q", "s", "v"] if a.algo == "all" else [a.algo]):
        run(algo, a.episodes if algo != "v" else max(a.episodes // 2, 100), a.seed, a.out, a.dry_run)


if __name__ == "__main__":
    main()
