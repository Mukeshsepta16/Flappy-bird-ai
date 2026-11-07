from flask import Blueprint, abort, current_app, jsonify, request

bp = Blueprint("models", __name__)


def _registry():
    return current_app.extensions["models"]


def _cached(resp, seconds=300):
    resp.headers["Cache-Control"] = f"public, max-age={seconds}"
    return resp


@bp.get("/models")
def list_models():
    reg = _registry()
    return jsonify(models=reg.list(), comparison_note=reg.comparison_note)


@bp.get("/models/<model_id>")
def get_model(model_id: str):
    reg = _registry()
    if not reg.has(model_id):
        abort(404, f"Unknown model '{model_id}'")
    return _cached(jsonify(reg.get(model_id)))


@bp.post("/predict")
def predict():
    """Ask a trained agent what it would do in a given state."""
    reg = _registry()
    body = request.get_json(silent=True) or {}
    model_id = body.get("model", "q")
    if model_id not in ("q", "s"):
        abort(400, "model must be 'q' or 's'")
    try:
        index = body.get("state_index")
        if index is not None and (not isinstance(index, int) or isinstance(index, bool)):
            abort(400, "state_index must be an integer")
        return jsonify(reg.predict(model_id, state_index=index, features=body.get("features")))
    except ValueError as exc:
        abort(400, str(exc))
