from flask import Flask

from .models import bp as models_bp
from .scores import bp as scores_bp
from .system import bp as system_bp
from .training import bp as training_bp


def register_blueprints(app: Flask) -> None:
    for bp in (system_bp, models_bp, training_bp, scores_bp):
        app.register_blueprint(bp, url_prefix="/api")
