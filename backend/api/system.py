from flask import Blueprint, current_app, jsonify

from model import config as mc

bp = Blueprint("system", __name__)


@bp.get("/health")
def health():
    return jsonify(status="ok", models=len(current_app.extensions["models"].list()))


@bp.get("/config")
def config():
    """Physics, bins and hyper-parameters shared with the browser engine."""
    return jsonify(
        physics=mc.PHYSICS,
        world={"width": mc.WORLD_WIDTH, "height": mc.WORLD_HEIGHT},
        bins=mc.BINS,
        hyper=mc.HYPER,
        rewards=mc.REWARDS,
        actions=mc.ACTIONS,
        n_states=mc.N_STATES,
        train_limits=mc.TRAIN_LIMITS,
    )
