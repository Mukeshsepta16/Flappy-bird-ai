# Contributing

1. Fork the repo and create a branch: `git checkout -b my-change`.
2. Set up: `python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt`.
3. Run the app with `python run.py` and the tests with `python -m unittest discover -s tests -t .`.
4. Keep the Python (`model/environment.py`) and JavaScript (`frontend/js/game/env.js`) environments in sync. If you change the physics, change `model/config.py` only; the browser reads it from `/api/config`.
5. Open a pull request. CI must pass.
