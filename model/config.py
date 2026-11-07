"""Single source of truth for physics, state bins and hyper-parameters.

The backend serves these values at ``GET /api/config`` and the frontend game
engine reads them, so browser and Python simulations can never drift apart.
"""
from pathlib import Path

ARTIFACT_DIR = Path(__file__).resolve().parent / "artifacts"

# --- world / physics -------------------------------------------------------
PHYSICS = {
    "GY": 520,       # ground y
    "BX": 90,        # bird x (fixed)
    "R": 14,         # bird collision radius
    "G": 0.5,        # gravity per step
    "FV": -7.5,      # flap velocity
    "MF": 10,        # max fall speed
    "PW": 64,        # pipe width
    "SP": 220,       # distance between pipes
    "FX": 330,       # x of first pipe
    "GM": 70,        # min margin between gap and ceiling/ground
    "GS": 160,       # starting gap size
    "GMIN": 135,     # smallest gap
    "SS": 3,         # starting scroll speed
    "SMAX": 4.5,     # max scroll speed
    "SINC": 0.05,    # speed increase per point
}
WORLD_WIDTH = 400
WORLD_HEIGHT = 600

# --- state discretisation (4 features -> 6 * 8 * 10 * 12 = 5,760 states) -----
BINS = {
    "height": [100, 200, 300, 400, 470],
    "velocity": [-6, -3, 0, 2, 4, 6, 8],
    "dx": [-40, -15, 5, 25, 45, 70, 100, 140, 200],
    "dy": [-100, -60, -35, -20, -10, 0, 10, 20, 35, 60, 100],
}
N_STATES = 6 * 8 * 10 * 12
N_ACTIONS = 2
ACTIONS = ["DO NOTHING", "FLAP"]

# --- learning hyper-parameters ----------------------------------------------
HYPER = {
    "alpha": 0.1,          # learning rate
    "gamma": 0.99,         # discount
    "eps_start": 1.0,
    "eps_min": 0.01,
    "eps_decay": 0.995,    # per episode
    "flap_prob": 0.1,      # random exploration flaps only 10% of the time
    "td_eps": 0.05,        # TD-prediction policy randomness
    "max_steps": 3000,     # training episode cap
}
REWARDS = {"pipe": 10.0, "step": 0.1, "crash": -100.0}

# --- limits for server-side training ------------------------------------------
TRAIN_LIMITS = {"min_episodes": 100, "max_episodes": 5000, "time_budget_s": 30}
