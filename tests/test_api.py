import tempfile
import unittest
from pathlib import Path

from backend.app import create_app
from backend.config import Config


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        scores = Path(self.tmp.name) / "scores.json"

        class TestConfig(Config):
            SCORES_FILE = scores

        self.c = create_app(TestConfig).test_client()

    def tearDown(self):
        self.tmp.cleanup()

    def test_health_and_config(self):
        self.assertEqual(self.c.get("/api/health").json["status"], "ok")
        cfg = self.c.get("/api/config").json
        self.assertEqual(cfg["n_states"], 5760)
        self.assertIn("physics", cfg)

    def test_models_and_table(self):
        ids = [m["id"] for m in self.c.get("/api/models").json["models"]]
        self.assertEqual(ids, ["q", "s", "v"])
        self.assertEqual(len(self.c.get("/api/models/q").json["table"]), 5760)
        self.assertEqual(self.c.get("/api/models/nope").status_code, 404)

    def test_predict(self):
        r = self.c.post("/api/predict", json={"model": "q", "features": {"height": 250, "velocity": 0, "dx": 60, "dy": -30}})
        self.assertEqual(r.status_code, 200)
        self.assertIn(r.json["action"], (0, 1))
        self.assertEqual(self.c.post("/api/predict", json={"model": "v"}).status_code, 400)
        self.assertEqual(self.c.post("/api/predict", json={"model": "q", "features": {"height": "x"}}).status_code, 400)
        self.assertEqual(self.c.post("/api/predict", json={"model": "q", "state_index": 99999}).status_code, 400)

    def test_scores_roundtrip_and_validation(self):
        r = self.c.post("/api/scores", json={"name": "<Ada>", "mode": "q", "score": 12})
        self.assertEqual((r.status_code, r.json["name"], r.json["rank"]), (201, "Ada", 1))
        self.c.post("/api/scores", json={"name": "Bo", "mode": "q", "score": 30})
        top = self.c.get("/api/scores?mode=q").json["scores"]
        self.assertEqual([s["name"] for s in top], ["Bo", "Ada"])
        for bad in ({"mode": "zz", "score": 1}, {"mode": "q", "score": -1}, {"mode": "q", "score": "9"}, {"mode": "q", "score": True}):
            self.assertEqual(self.c.post("/api/scores", json=bad).status_code, 400, bad)

    def test_train(self):
        self.assertEqual(self.c.post("/api/train", json={"algo": "zz"}).status_code, 400)
        self.assertEqual(self.c.post("/api/train", json={"algo": "q", "episodes": 5}).status_code, 400)
        r = self.c.post("/api/train", json={"algo": "q", "episodes": 200, "seed": 3})
        self.assertEqual((r.status_code, r.json["episodes"]), (200, 200))
        self.assertIn("evaluation", r.json)
        self.assertEqual(self.c.post("/api/train", json={"algo": "v", "episodes": 100}).json["episodes"], 100)

    def test_json_404_and_frontend_served(self):
        r = self.c.get("/api/nothing")
        self.assertEqual((r.status_code, r.json["status"]), (404, 404))
        self.assertEqual(self.c.get("/").status_code, 200)
        self.assertEqual(self.c.get("/js/main.js").status_code, 200)


if __name__ == "__main__":
    unittest.main()
