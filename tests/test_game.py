"""Check the three-route rules before the Python-only visual frontend exists."""
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from game import Game
from combat import boss_tick
from progression import load
from puzzles import PUZZLE_DATA, connected, mining_judgement, new_pipes, rotate
from stages import STAGES
from stages import ROUTE_ENDS


class RouteTests(unittest.TestCase):
    def test_first_route_interaction_from_scan_to_second_stage(self):
        with tempfile.TemporaryDirectory() as tmp:
            game = Game(Path(tmp) / "profile.json")
            game.begin()
            game.player["x"] = game.route_end - 100
            game.step({"scan_hold": True, "dt": 0})
            self.assertEqual(game.phase, "scan")
            game.scan_cursor = game.snapshot()["scan_target"]
            for _ in range(11): game.step({"scan_hold": True, "dt": .08})
            self.assertEqual(game.phase, "identify")
            game.step({"action": "confirm", "dt": 0})
            self.assertEqual(game.phase, "pipes")
            game.step({"action": "right", "dt": 0})
            game.step({"action": "rotate", "dt": 0})
            game.step({"action": "right", "dt": 0})
            game.step({"action": "rotate", "dt": 0})
            self.assertEqual(game.phase, "pipes_success")
            self.assertIsNotNone(game.snapshot()["board"])
            for _ in range(21): game.step({"dt": .08})
            self.assertEqual(game.phase, "mine")
            for cycle in range(3):
                game.mine_elapsed = .625 + 1.25 * cycle
                game.step({"action": "mine", "dt": 0})
            self.assertEqual((game.phase, game.collected), ("upgrade", ["O"]))
            game.step({"action": "confirm", "dt": 0})
            self.assertEqual(game.phase, "loading")
            for _ in range(33): game.step({"dt": .08})
            self.assertEqual((game.phase, game.stage), ("flight", 1))

    def test_back_navigation_on_choice_and_pipe_screens(self):
        with tempfile.TemporaryDirectory() as tmp:
            game = Game(Path(tmp) / "profile.json")
            game.begin()
            game.phase = "identify"
            game.step({"action": "confirm", "dt": 0})
            self.assertEqual(game.phase, "pipes")
            game.step({"action": "back", "dt": 0})
            self.assertEqual(game.phase, "identify")
            game.step({"action": "back", "dt": 0})
            self.assertEqual(game.phase, "scan")

    def test_approved_boards_are_fixed_and_solvable(self):
        self.assertEqual([s.element for s in STAGES], ["O", "Si", "Fe"])
        for stage, design in enumerate(PUZZLE_DATA):
            board = new_pipes(stage, seed=123)
            self.assertEqual(board, new_pipes(stage, seed=999))
            self.assertFalse(connected(board), design["route"])
            for step in design["solution_steps"]:
                row, col = step["rotate_clockwise_once"]
                board[row][col] = rotate(board[row][col])
            self.assertTrue(connected(board), design["route"])
            self.assertEqual(board, design["solution_masks"])
            self.assertEqual(len(design["solution_steps"]), 2 + stage)

    def test_mining_waits_and_heat_preserves_layers(self):
        with tempfile.TemporaryDirectory() as tmp:
            game = Game(Path(tmp) / "profile.json")
            game.begin()
            game.phase = "mine"
            for _ in range(40): game.step({"dt": .08})
            self.assertEqual((game.mine_good, game.mine_heat), (0, 0))
            game.mine_elapsed = .625
            game.step({"action": "mine", "dt": 0})
            self.assertEqual(game.mine_good, 1)
            for cycle in range(3):
                game.mine_elapsed = 1.25 * (cycle + 1)
                game.step({"action": "mine", "dt": 0})
            self.assertGreater(game.mine_cooldown, 0)
            self.assertEqual(game.mine_good, 1)
            for _ in range(22): game.step({"dt": .08})
            self.assertEqual((game.mine_cooldown, game.mine_good), (0, 1))
            for cycle in range(2):
                game.mine_elapsed = .625 + 1.25 * cycle
                game.step({"action": "mine", "dt": 0})
            self.assertEqual(game.phase, "upgrade")
            self.assertEqual(game.collected, ["O"])
            self.assertEqual(len(game.offer), 2)
            self.assertNotIn("repair", game.offer)

    def test_three_complete_routes_lead_to_boss(self):
        with tempfile.TemporaryDirectory() as tmp:
            game = Game(Path(tmp) / "profile.json")
            game.begin()
            for stage in range(3):
                self.assertEqual(game.stage, stage)
                game.phase = "mine"
                game.mine_last_cycle = -1
                for cycle in range(3):
                    game.mine_elapsed = .625 + 1.25 * cycle
                    game.step({"action": "mine", "dt": 0})
                self.assertEqual(game.phase, "upgrade")
                self.assertEqual(len(game.offer), 2)
                if stage == 2:
                    self.assertNotIn("drill", game.offer)
                    self.assertNotIn("scanner", game.offer)
                game.step({"action": "confirm", "dt": 0})
                self.assertEqual(game.phase, "loading")
                for _ in range(33): game.step({"dt": .08})
            self.assertEqual(game.phase, "boss")
            self.assertEqual(game.collected, ["O", "Si", "Fe"])
            self.assertEqual(game.snapshot()["stage_name"], "Core Warden")

    def test_death_banks_research_and_resets_run(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "profile.json"
            game = Game(path)
            game.begin()
            game.research = 4
            game.collected = ["O", "Si"]
            game.upgrades = {"double": 1}
            game.end_run(False)
            self.assertEqual(load(path)["research"], 4)
            game.begin()
            self.assertEqual((game.collected, game.upgrades), ([], {}))

    def test_demo_jumps_do_not_save(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "profile.json"
            game = Game(path, demo=True)
            for jump in range(1, 4):
                game.jump(jump)
                self.assertEqual((game.phase, game.stage), ("flight", jump - 1))
            game.jump(4)
            self.assertEqual(game.boss["phase"], 1)
            game.jump(5)
            self.assertEqual(game.boss["phase"], 2)
            game.jump(6)
            self.assertEqual((game.phase, game.collected), ("victory", ["O", "Si", "Fe"]))
            game.end_run(True)
            self.assertFalse(path.exists())

    def test_repeating_green_window(self):
        self.assertEqual(mining_judgement(.625, 0, .32), "good")
        self.assertEqual(mining_judgement(1.875, 2, .32), "good")
        self.assertEqual(mining_judgement(.1, 1, .32), "miss")

    def test_one_cut_per_pulse(self):
        with tempfile.TemporaryDirectory() as tmp:
            game = Game(Path(tmp) / "profile.json")
            game.begin()
            game.phase = "mine"
            game.mine_elapsed = .625
            game.step({"action": "mine", "dt": 0})
            game.step({"action": "mine", "dt": 0})
            self.assertEqual((game.mine_good, game.mine_heat), (1, 0))

    def test_route_distance_hazards_and_stage_two_fire(self):
        with tempfile.TemporaryDirectory() as tmp:
            game = Game(Path(tmp) / "profile.json")
            for stage in range(3):
                game.setup_stage(stage)
                self.assertEqual(game.route_end, ROUTE_ENDS[stage])
                self.assertEqual(len(game.rocks), (13, 18, 22)[stage])
                self.assertEqual(len(game.drones), (2, 4, 5)[stage])
                self.assertLess(max(r["x"] for r in game.rocks), game.route_end - 150)
            game.setup_stage(1)
            target = game.drones[0]
            game.player["x"] = target["x"] - 400
            game.player["y"] = 300
            target["clock"] = 1.7
            state = game.step({"dt": .04})
            self.assertIn("enemy_shoot", state["events"])
            self.assertIsNotNone(target["bullet"])
            previous = target["bullet"]["x"]
            game.step({"dt": .04})
            self.assertLess(target["bullet"]["x"], previous)

    def test_paused_boss_retains_scene_and_resumes(self):
        with tempfile.TemporaryDirectory() as tmp:
            game = Game(Path(tmp) / "profile.json", demo=True)
            game.jump(4)
            paused = game.step({"action": "pause"})
            self.assertEqual((paused["phase"], paused["paused_from"]), ("paused", "boss"))
            self.assertEqual(paused["boss"]["phase"], 1)
            self.assertEqual(paused["player"]["x"], 170)
            resumed = game.step({"action": "resume"})
            self.assertEqual(resumed["phase"], "boss")
            self.assertIsNotNone(resumed["boss"])

    def test_all_six_upgrade_cards_have_live_effects(self):
        with tempfile.TemporaryDirectory() as tmp:
            for key in ("repair", "hull", "double", "scanner", "drill", "data"):
                game = Game(Path(tmp) / f"{key}.json")
                game.begin()
                game.offer = [key]
                game.phase = "upgrade"
                game.player["shields"] = 2
                game.choose_upgrade()
                self.assertEqual(game.phase, "loading")
                if key == "repair": self.assertEqual(game.player["shields"], 3)
                elif key == "hull":
                    self.assertEqual((game.player["shields"], game.player["max_shields"]), (3, 4))
                elif key == "double":
                    self.assertEqual(game.snapshot()["shot_count"], 2)
                    game.player["x"], game.player["y"] = 500, 300
                    game.drones[0]["x"], game.drones[0]["y"], game.drones[0]["hp"] = 720, 300, 2
                    game.phase = "flight"
                    game.step({"shoot": True, "dt": 0})
                    self.assertEqual(game.drones[0]["hp"], 0)
                elif key == "scanner":
                    game.phase = "scan"
                    game.scan_cursor = game.snapshot()["scan_target"]
                    game.step({"scan_hold": True, "dt": .08})
                    self.assertGreater(game.scan_meter, .08)
                elif key == "drill": self.assertGreater(game.snapshot()["mine_tolerance"], .32)
                elif key == "data": self.assertEqual(game.research, 2)

    def test_boss_phase_two_and_explosion_delay(self):
        with tempfile.TemporaryDirectory() as tmp:
            game = Game(Path(tmp) / "profile.json", demo=True)
            game.jump(4)
            game.boss["scanned"] = True
            game.boss["nodes"] = [1, 0]
            game.player["y"] = 210
            game.player["invuln"] = 99
            state = game.step({"shoot": True, "dt": 0})
            self.assertEqual(state["boss"]["phase"], 2)
            self.assertGreater(state["boss"]["transition"], 0)
            self.assertEqual(state["boss"]["core"], 24)
            for _ in range(35): game.step({"dt": .08})
            game.boss["core"] = 1
            game.boss["window"] = 2
            game.player["y"] = 300
            state = game.step({"shoot": True, "dt": .08})
            self.assertEqual(state["phase"], "boss_defeat")
            self.assertEqual(state["boss"]["core"], 0)
            for _ in range(38): game.step({"dt": .08})
            self.assertEqual(game.phase, "victory")


if __name__ == "__main__": unittest.main()
