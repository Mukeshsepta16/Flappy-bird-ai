"""Flask application factory: serves the JSON API and the static frontend."""
from __future__ import annotations

from flask import Flask, jsonify, request, send_from_directory

from .api import register_blueprints
from .config import Config
from .services.model_registry import ModelRegistry
from .services.score_store import ScoreStore


def create_app(config: type = Config) -> Flask:
    app = Flask(__name__, static_folder=None)
    app.config.from_object(config)
    app.config["JSON_AS_ASCII"] = False

    # long-lived services (loaded once, shared by all requests)
    app.extensions["models"] = ModelRegistry()
    app.extensions["scores"] = ScoreStore(config.SCORES_FILE, config.MAX_SCORES_STORED)

    register_blueprints(app)
    _register_frontend(app)
    _register_errors(app)
    _register_cors(app)
    return app


def _register_frontend(app: Flask) -> None:
    root = app.config["FRONTEND_DIR"]

    @app.get("/")
    def index():
        return send_from_directory(root, "index.html")

    @app.get("/<path:path>")
    def assets(path: str):
        if path.startswith("api/"):
            return _json_error(404, "Unknown API endpoint")
        return send_from_directory(root, path)


def _json_error(status: int, message: str):
    resp = jsonify({"error": message, "status": status})
    resp.status_code = status
    return resp


def _register_errors(app: Flask) -> None:
    for code, msg in {400: "Bad request", 404: "Not found", 405: "Method not allowed",
                      429: "Too many requests", 500: "Internal server error"}.items():
        app.register_error_handler(code, lambda e, c=code, m=msg: _json_error(c, getattr(e, "description", m) or m))


def _register_cors(app: Flask) -> None:
    origin = app.config.get("CORS_ORIGIN")

    @app.after_request
    def headers(resp):
        if origin and request.path.startswith("/api/"):
            resp.headers["Access-Control-Allow-Origin"] = origin
            resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
            resp.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
        return resp
