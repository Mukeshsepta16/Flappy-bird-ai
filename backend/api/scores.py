from flask import Blueprint, abort, current_app, jsonify, request

from ..services.score_store import MODES

bp = Blueprint("scores", __name__)


def _store():
    return current_app.extensions["scores"]


@bp.get("/scores")
def list_scores():
    mode = request.args.get("mode") or None
    if mode and mode not in MODES:
        abort(400, "unknown mode")
    try:
        limit = max(1, min(int(request.args.get("limit", 10)), 50))
    except ValueError:
        abort(400, "limit must be an integer")
    return jsonify(scores=_store().top(mode, limit), modes=MODES, **_store().summary())


@bp.post("/scores")
def submit_score():
    body = request.get_json(silent=True) or {}
    mode, score = body.get("mode"), body.get("score")
    if mode not in MODES:
        abort(400, "mode must be one of: " + ", ".join(MODES))
    cfg = current_app.config
    if not isinstance(score, int) or isinstance(score, bool) or not 0 <= score <= cfg["MAX_SCORE"]:
        abort(400, f"score must be an integer between 0 and {cfg['MAX_SCORE']}")
    entry = _store().add(body.get("name", ""), mode, score, cfg["MAX_NAME_LENGTH"])
    return jsonify(entry), 201
