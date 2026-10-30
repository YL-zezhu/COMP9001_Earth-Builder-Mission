"""Start the self-contained local Python game server (no pip packages)."""

import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import threading
import webbrowser
from urllib.parse import urlsplit

from game import Game

ROOT = Path(__file__).resolve().parent
WEB = ROOT / "web"
AUDIO = {"sector_mix.ogg", "airy_mix.ogg", "pulse_mix.mp3", "victory_5.ogg",
         "hover_0.ogg", "final_stand_phase_1.3_0.ogg",
         "final_stand_phase_2.2_0.ogg", "sfx_ui_click_1.mp3",
         "sonar_ping_0.mp3", "alienshoot1.ogg", "mining_tap.ogg",
         "powerup.wav", "hit.wav", "powerdown.wav", "shieldhit.wav",
         "charge.wav", "deathboom.wav", "teleport_1.wav"}


def serve(demo: bool, port: int, open_browser: bool = True) -> ThreadingHTTPServer:
    game = Game(ROOT / "save.json", demo=demo)
    lock = threading.Lock()

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            path = urlsplit(self.path).path
            if path == "/api/state":
                with lock:
                    self.json_response(game.snapshot())
                return
            paths = {"/": ("index.html", "text/html"),
                     "/game.js": ("game.js", "text/javascript"),
                     "/opening.js": ("opening.js", "text/javascript"),
                     "/audio.js": ("audio.js", "text/javascript"),
                     "/style.css": ("style.css", "text/css")}
            if path.startswith("/assets/") and path.endswith(".png"):
                filename = Path(path).name
                if filename not in {"icefield_environment.png", "crystal_environment.png",
                                    "magnetic_environment.png", "ship_side.png", "core_warden.png",
                                    "boss_phase2.png", "loading_scene.png", "failure_scene.png",
                                    "victory_scene.png"}:
                    self.send_error(404)
                    return
                data = (WEB / "assets" / filename).read_bytes()
                content_type = "image/png"
            elif path.startswith("/assets/audio/") and Path(path).name in AUDIO \
                    and path == "/assets/audio/" + Path(path).name:
                filename = Path(path).name
                audio_path = WEB / "assets" / "audio" / filename
                if not audio_path.is_file():
                    self.send_error(404)
                    return
                data = audio_path.read_bytes()
                content_type = {".mp3": "audio/mpeg", ".ogg": "audio/ogg",
                                ".wav": "audio/wav"}[audio_path.suffix]
            elif path in paths:
                filename, content_type = paths[path]
                data = (WEB / filename).read_bytes()
            else:
                self.send_error(404)
                return
            self.send_response(200)
            self.send_header("Content-Type", content_type +
                             ("; charset=utf-8" if content_type in
                              {"text/html", "text/javascript", "text/css"} else ""))
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_POST(self):
            if urlsplit(self.path).path != "/api/step":
                self.send_error(404)
                return
            try:
                size = int(self.headers.get("Content-Length", "0"))
                if not 0 < size <= 4096:
                    raise ValueError("Input too large")
                payload = json.loads(self.rfile.read(size))
                if not isinstance(payload, dict):
                    raise ValueError("Expected an object")
                with lock:
                    result = game.step(payload)
                self.json_response(result)
            except (ValueError, TypeError, json.JSONDecodeError) as exc:
                self.send_error(400, str(exc))

        def json_response(self, value):
            data = json.dumps(value, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def log_message(self, format, *args):
            if not format.startswith('"POST /api/step'):
                super().log_message(format, *args)

    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    url = f"http://127.0.0.1:{server.server_port}/"
    print(f"Earth Builder Mission: {url}")
    print("Press Ctrl+C to stop the game server.")
    if demo:
        print("Presentation mode: 1–3 routes, 4–5 boss, 6 ending, 0 menu.")
    if open_browser:
        threading.Timer(.45, lambda: webbrowser.open(url)).start()
    return server


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Earth Builder Mission")
    parser.add_argument("--demo", action="store_true", help="enable presentation shortcuts")
    parser.add_argument("--port", type=int, default=0, help="local port (0 chooses a free port)")
    args = parser.parse_args()
    try:
        serve(args.demo, args.port).serve_forever()
    except KeyboardInterrupt:
        print("\nGame closed.")
