from flask import Blueprint, abort, current_app, jsonify, request

from model.config import TRAIN_LIMITS

from ..services import training_service

bp = Blueprint("training", __name__)


@bp.post("/train")
def train():
    """Train a fresh agent server-side (bounded by TRAIN_LIMITS)."""
    body = request.get_json(silent=True) or {}
    algo = body.get("algo", "q")
    if algo not in ("q", "s", "v"):
        abort(400, "algo must be one of: q, s, v")
    episodes, seed = body.get("episodes", 3000), body.get("seed", 0)
    if not all(isinstance(x, int) and not isinstance(x, bool) for x in (episodes, seed)):
        abort(400, "episodes and seed must be integers")
    if not 0 <= seed <= 2**31 - 1:
        abort(400, "seed out of range")
    if episodes < TRAIN_LIMITS["min_episodes"]:
        abort(400, f"episodes must be at least {TRAIN_LIMITS['min_episodes']}")
    policy = current_app.extensions["models"].q_table("q") if algo == "v" else None
    try:
        return jsonify(training_service.train(algo, episodes, seed, policy))
    except training_service.Busy as exc:
        abort(429, str(exc))
