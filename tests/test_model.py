import unittest

from model.agents import QLearning, TDPrediction
from model.config import N_STATES
from model.environment import FlappyEnv, decode_state, encode_state, mulberry32
from model.evaluate import evaluate
from model.train import load_table


class ModelTests(unittest.TestCase):
    def test_rng_is_deterministic_and_in_range(self):
        a, b = mulberry32(42), mulberry32(42)
        xs = [a() for _ in range(50)]
        self.assertEqual(xs, [b() for _ in range(50)])
        self.assertTrue(all(0 <= x < 1 for x in xs))

    def test_state_encoding_bounds(self):
        self.assertTrue(0 <= encode_state(0, -20, -500, -500) < N_STATES)
        self.assertEqual(encode_state(9999, 99, 9999, 9999), N_STATES - 1)
        i = encode_state(250, 0, 60, -30)
        self.assertEqual(len(decode_state(i)), 4)

    def test_environment_crashes_when_idle(self):
        env = FlappyEnv(1)
        while not env.over:
            env.step(0)
        self.assertTrue(env.crash)
        self.assertIn(env.why, {"ground", "pipe"})

    def test_saved_tables_shape_and_quality(self):
        q = load_table("q")
        self.assertEqual(len(q), N_STATES)
        self.assertTrue(all(len(r) == 2 for r in q))
        self.assertEqual(len(load_table("v")), N_STATES)
        self.assertGreater(evaluate(q, games=10)["mean_score"], 10)

    def test_training_beats_untrained_table(self):
        res = QLearning(seed=1).train(1500)
        self.assertEqual((res.episodes, len(res.curve)), (1500, 1500))
        trained = evaluate(res.table, games=5)["mean_score"]
        untrained = evaluate([[0.0, 0.0]] * N_STATES, games=5)["mean_score"]
        self.assertGreater(trained, untrained)

    def test_td_prediction_needs_policy(self):
        with self.assertRaises(ValueError):
            TDPrediction().train(10)


if __name__ == "__main__":
    unittest.main()
