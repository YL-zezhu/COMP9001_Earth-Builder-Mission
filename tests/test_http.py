"""A local-server smoke check for browser delivery and API routes."""
import json
import sys
import threading
import unittest
from pathlib import Path
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from main import AUDIO, serve


class LocalBrowserTests(unittest.TestCase):
    def test_browser_assets_and_python_step_api(self):
        server = serve(demo=True, port=0, open_browser=False)
        runner = threading.Thread(target=server.serve_forever, daemon=True)
        runner.start()
        base = f"http://127.0.0.1:{server.server_port}"
        try:
            for path in ("/", "/game.js", "/opening.js", "/style.css",
                         "/audio.js", *(f"/assets/audio/{name}" for name in sorted(AUDIO)),
                         "/assets/icefield_environment.png",
                         "/assets/crystal_environment.png",
                         "/assets/magnetic_environment.png",
                         "/assets/ship_side.png", "/assets/core_warden.png",
                         "/assets/boss_phase2.png", "/assets/loading_scene.png",
                         "/assets/failure_scene.png", "/assets/victory_scene.png"):
                with urlopen(base + path) as result:
                    self.assertEqual(result.status, 200)
                    self.assertTrue(result.read())
                    if path.endswith(".mp3"):
                        self.assertEqual(result.headers["Content-Type"], "audio/mpeg")
                    if path.endswith(".ogg"):
                        self.assertEqual(result.headers["Content-Type"], "audio/ogg")
            req = Request(base + "/api/step", method="POST",
                          data=json.dumps({"action": "jump", "destination": 4}).encode(),
                          headers={"Content-Type": "application/json"})
            with urlopen(req) as result:
                state = json.load(result)
            self.assertEqual((state["phase"], state["collected"]),
                             ("boss", ["O", "Si", "Fe"]))
            pause = Request(base + "/api/step", method="POST",
                            data=json.dumps({"action": "pause"}).encode(),
                            headers={"Content-Type": "application/json"})
            with urlopen(pause) as result:
                paused = json.load(result)
            self.assertEqual(paused["phase"], "paused")
            self.assertEqual(paused["paused_from"], "boss")
            self.assertIsNotNone(paused["boss"])
            resume = Request(base + "/api/step", method="POST",
                             data=json.dumps({"action": "resume"}).encode(),
                             headers={"Content-Type": "application/json"})
            with urlopen(resume) as result:
                self.assertEqual(json.load(result)["phase"], "boss")
        finally:
            server.shutdown()
            server.server_close()
            runner.join(timeout=2)


if __name__ == "__main__": unittest.main()
