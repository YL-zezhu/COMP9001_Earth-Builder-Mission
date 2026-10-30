"""The Python-owned state machine for Earth Builder Mission."""

from pathlib import Path
from math import sin
import random

from combat import boss_tick, damage, flight_tick, guardian, make_drones, ship
from progression import (PERMANENT, UPGRADES, choices, load, purchase, save)
from puzzles import connected, mining_judgement, new_pipes, rotate
from stages import ROUTE_ENDS, STAGES, layout


class Game:
    def __init__(self, save_path: Path, demo: bool = False):
        self.save_path = save_path
        self.profile = load(save_path)
        self.demo = demo
        self.phase = "menu"
        self.stage = 0
        self.seed = 1
        self.collected: list[str] = []
        self.research = 0
        self.upgrades: dict[str, int] = {}
        self.player = ship()
        self.rocks: list[dict] = []
        self.drones: list[dict] = []
        self.boss = guardian()
        self.board = [[0] * 4 for _ in range(4)]
        self.cursor = [1, 0]
        self.selection = 0
        self.scan_cursor = -.65
        self.scan_time = 0.0
        self.scan_meter = 0.0
        self.mine_elapsed = 0.0
        self.mine_last_cycle = -1
        self.mine_beat = 0
        self.mine_good = 0
        self.mine_heat = 0
        self.mine_cooldown = 0.0
        self.mine_practice = False
        self.practice_hits = 0
        self.tutorial = 0
        self.message = ""
        self.events: list[str] = []
        self.offer: list[str] = []
        self.transition_time = 0.0
        self.next_stage = 0
        self.defeat_time = 0.0

    def begin(self) -> None:
        self.seed = random.SystemRandom().randint(1, 1000000)
        self.collected = []
        self.research = 0
        self.upgrades = {}
        self.setup_stage(0)

    def setup_stage(self, index: int) -> None:
        self.stage = index
        self.route_end = ROUTE_ENDS[index]
        hp = 3 + self.profile["hull"] + self.upgrades.get("hull", 0)
        previous = self.player["shields"] if index > 0 else hp
        self.player = ship(shields=hp)
        self.player["shields"] = min(hp, max(1, previous))
        self.rocks = layout(index, self.seed)
        self.drones = make_drones(index, self.seed)
        self.board = new_pipes(index, self.seed)
        self.cursor = [1, 0]
        self.scan_cursor = -.65
        self.scan_meter = 0.0
        self.scan_time = 0.0
        self.selection = 0
        self.tutorial = 0 if index == 0 and (not self.profile["tutorial_done"] or self.demo) else 3
        self.phase = "flight"
        self.message = "Follow the unidentified mineral signal."

    def start_boss(self, second: bool = False) -> None:
        self.stage = len(STAGES)
        self.phase = "boss"
        previous_shields = self.player["shields"]
        self.player = ship(170, 300, 3 + self.profile["hull"] + self.upgrades.get("hull", 0))
        self.boss = guardian(2 if second else 1)
        self.boss["aim_y"] = 300
        self.player["shields"] = min(self.player["max_shields"], max(1, previous_shields) + 1)
        self.message = "Scan the shield nodes (Q / X)." if not second else "Attack the open core."

    def jump(self, destination: int) -> None:
        if not self.demo or not 0 <= destination <= 6:
            return
        if destination == 0:
            self.phase = "menu"
            self.stage = 0
            self.collected = []
            self.upgrades = {}
            self.research = 0
        elif 1 <= destination <= len(STAGES):
            self.collected = [s.element for s in STAGES[:destination - 1]]
            self.upgrades = {"hull": 1, "double": 1} if destination > 2 else {}
            self.setup_stage(destination - 1)
        elif destination in (4, 5):
            self.collected = [s.element for s in STAGES]
            self.upgrades = {"hull": 1, "double": 1}
            self.start_boss(second=destination == 5)
        else:
            self.collected = [s.element for s in STAGES]
            self.stage = len(STAGES)
            self.phase = "victory"
            self.message = "Earth assembled — presentation preview."

    def end_run(self, won: bool) -> None:
        self.phase = "victory" if won else "death"
        if not self.demo:
            self.profile["research"] += self.research
            self.profile["best_stage"] = max(self.profile["best_stage"], self.stage + 1)
            if won:
                self.profile["wins"] += 1
            save(self.save_path, self.profile)
        self.message = "Earth assembled!" if won else "Ship lost. Research data returned to base."
        self.events.append("victory" if won else "defeat")

    def mine_complete(self) -> None:
        element = STAGES[self.stage].element
        if element not in self.collected:
            self.collected.append(element)
            self.research += 2 + self.upgrades.get("data", 0) * 2
        if self.stage == 0 and not self.demo and not self.profile["tutorial_done"]:
            self.profile["tutorial_done"] = True
            save(self.save_path, self.profile)
        self.offer = choices(self.seed, self.stage, self.player["shields"],
                             self.player["max_shields"])
        self.selection = 0
        self.phase = "upgrade"
        self.message = f"{element} sample secured. Choose one upgrade for this run."
        self.events.append("collected")

    def choose_upgrade(self) -> None:
        key = self.offer[self.selection]
        if key == "repair":
            self.player["shields"] = min(self.player["max_shields"], self.player["shields"] + 1)
        elif key == "data":
            self.research += 2
        else:
            self.upgrades[key] = self.upgrades.get(key, 0) + 1
            if key == "hull":
                self.player["max_shields"] += 1
                self.player["shields"] += 1
        self.next_stage = self.stage + 1
        self.transition_time = 2.6
        self.phase = "loading"
        self.message = f"{UPGRADES[key][0]} equipped. Preparing the next sector."

    def step(self, control: dict) -> dict:
        self.events = []
        dt = max(0.0, min(float(control.get("dt", .04)), .08))
        dx = max(-1.0, min(1.0, float(control.get("dx", 0))))
        dy = max(-1.0, min(1.0, float(control.get("dy", 0))))
        action = control.get("action", "")
        shoot = bool(control.get("shoot", False))
        scan_hold = bool(control.get("scan_hold", False))
        if action == "jump" and self.demo:
            self.jump(int(control.get("destination", 0)))
            return self.snapshot()
        if action == "pause" and self.phase not in ("menu", "death", "victory", "paused"):
            self.paused_from = self.phase
            self.phase = "paused"
        elif self.phase == "paused":
            if action in ("resume", "pause"):
                self.phase = self.paused_from
            return self.snapshot()
        elif self.phase == "menu":
            if action == "start":
                self.begin()
        elif self.phase in ("death", "victory"):
            if action == "start":
                self.begin()
            elif self.phase == "death" and action.startswith("buy:") and not self.demo:
                key = action[4:]
                if purchase(self.profile, key):
                    save(self.save_path, self.profile)
                    self.events.append("upgrade")
                else:
                    self.message = "Not enough research data, or upgrade already at maximum."
        elif self.phase == "flight":
            training = self.stage == 0 and self.tutorial < 3
            previous_hp = self.player["shields"]
            flight_tick(self.player, self.rocks, self.drones, self.stage,
                        dx, dy, dt, shoot, 1 + self.upgrades.get("double", 0),
                        self.events, self.route_end)
            if training:
                self.player["shields"] = previous_hp
                self.events = [event for event in self.events if event != "damage"]
                if self.tutorial == 0 and abs(self.player["x"] - 190) < 35 and abs(self.player["y"] - 235) < 65:
                    self.tutorial = 1
                elif self.tutorial == 1 and abs(self.player["x"] - 340) < 40 and abs(self.player["y"] - 365) < 65:
                    self.tutorial = 2
                elif self.tutorial == 2 and "shoot" in self.events and 370 < self.player["x"] < 600 \
                        and abs(self.player["y"] - 300) < 55:
                    self.tutorial = 3
                    self.events.append("hit")
            if (action == "scan" or scan_hold) and self.player["x"] > self.route_end - 120:
                self.tutorial = 3
                self.phase = "scan"
                self.message = "Move the cursor onto the signal, then hold Q / X."
            if self.player["shields"] <= 0:
                self.end_run(False)
        elif self.phase == "scan":
            self.scan_time += dt
            self.scan_cursor = max(-1, min(1, self.scan_cursor + dx * dt * 1.2))
            target = -.12 + (self.stage % 3) * .23
            if self.stage == 2:
                target += .15 * sin(self.scan_time * 1.1)
            if abs(self.scan_cursor - target) < .20 and scan_hold:
                self.scan_meter += dt * (1.0 + .25 * (self.profile["scanner"] + self.upgrades.get("scanner", 0)))
            else:
                self.scan_meter = max(0, self.scan_meter - dt * .25)
            if self.scan_meter >= .8:
                self.phase = "identify"
                self.selection = 0
                self.message = "Compare both clues; choose the matching sample."
                self.events.append("scan_complete")
        elif self.phase == "identify":
            if action == "back":
                self.phase = "scan"
                self.scan_meter = 0.0
                self.message = "Move the cursor onto the signal and hold Q / X."
                return self.snapshot()
            if action == "left": self.selection = (self.selection - 1) % 3
            if action == "right": self.selection = (self.selection + 1) % 3
            if action == "confirm":
                if self.selection == STAGES[self.stage].answer:
                    self.phase = "pipes"
                    self.message = "Connect the energy inlet to the outlet."
                    self.events.append("correct")
                else:
                    self.message = "That sample does not match both clues. Try another."
                    self.events.append("wrong")
        elif self.phase == "pipes":
            if action == "back":
                self.phase = "identify"
                self.message = "Compare both clues; choose the matching sample."
                return self.snapshot()
            if action == "left": self.cursor[1] = max(0, self.cursor[1] - 1)
            if action == "right": self.cursor[1] = min(3, self.cursor[1] + 1)
            if action == "up": self.cursor[0] = max(0, self.cursor[0] - 1)
            if action == "down": self.cursor[0] = min(3, self.cursor[0] + 1)
            if action == "rotate":
                row, col = self.cursor
                if self.board[row][col]:
                    self.board[row][col] = rotate(self.board[row][col])
                    self.events.append("rotate")
                    if connected(self.board):
                        self.phase = "pipes_success"
                        self.transition_time = 1.6
                        self.mine_elapsed = self.mine_beat = self.mine_good = self.mine_heat = 0
                        self.mine_last_cycle = -1
                        self.mine_cooldown = 0.0
                        self.mine_practice = False
                        self.practice_hits = 0
                        self.message = "Tap Space / A in the wide green zone. Three successful layers."
                        self.events.append("pipe_complete")
        elif self.phase == "pipes_success":
            self.transition_time = max(0, self.transition_time - dt)
            if self.transition_time == 0:
                self.phase = "mine"
        elif self.phase == "mine":
            if self.mine_cooldown > 0:
                self.mine_cooldown = max(0, self.mine_cooldown - dt)
                if self.mine_cooldown == 0:
                    self.mine_elapsed = 0.0
                    self.mine_heat = 0
                    self.mine_last_cycle = -1
                    self.message = "Drill cooled. Continue your current layer."
                return self.snapshot()
            self.mine_elapsed += dt
            tolerance = min(.45, .32 + .04 * (self.profile["drill"] +
                                             self.upgrades.get("drill", 0)))
            if action == "mine":
                cycle = int(self.mine_elapsed / 1.25)
                if cycle == self.mine_last_cycle:
                    return self.snapshot()  # One cut per pulse; no rapid-key exploit.
                result = mining_judgement(self.mine_elapsed, self.mine_beat, tolerance)
                if result == "good":
                    self.mine_last_cycle = cycle
                    self.mine_good += 1
                    self.mine_beat = self.mine_good
                    self.events.append("mining_good")
                else:
                    self.mine_heat += 1
                    self.events.append("mining_miss")
            if self.mine_good >= 3:
                self.mine_complete()
            elif self.mine_heat >= 3:
                self.mine_cooldown = 1.7
                self.message = "Drill overheated. Cool down, then retry."
        elif self.phase == "upgrade":
            if action == "left": self.selection = (self.selection - 1) % len(self.offer)
            if action == "right": self.selection = (self.selection + 1) % len(self.offer)
            if action == "confirm": self.choose_upgrade()
        elif self.phase == "loading":
            self.transition_time = max(0, self.transition_time - dt)
            if self.transition_time == 0:
                if self.next_stage == len(STAGES):
                    self.start_boss()
                else:
                    self.setup_stage(self.next_stage)
        elif self.phase == "boss":
            if action == "scan" and not self.boss["scanned"]:
                self.boss["scanned"] = True
                self.boss["clock"] = 0
                self.events.append("scan_complete")
                self.message = "Align with the glowing nodes and shoot."
            boss_tick(self.boss, self.player, dx, dy, dt, shoot,
                      1 + self.upgrades.get("double", 0), self.events)
            if "boss_phase" in self.events:
                self.message = "Armour shattered! The Core Warden is transforming."
            if "boss_defeated" in self.events:
                self.phase = "boss_defeat"
                self.defeat_time = 3.0
                self.message = "Core Warden defeated!"
            elif self.player["shields"] <= 0:
                self.end_run(False)
        elif self.phase == "boss_defeat":
            self.defeat_time = max(0, self.defeat_time - dt)
            if self.defeat_time == 0:
                self.end_run(True)
        return self.snapshot()

    def snapshot(self) -> dict:
        stage = STAGES[min(self.stage, len(STAGES) - 1)]
        boss_active = self.stage == len(STAGES)
        return {"phase": self.phase, "demo": self.demo, "stage": self.stage + 1,
                "stage_name": "Core Warden" if boss_active else stage.name,
                "element": "" if boss_active else stage.element,
                "source": "" if boss_active else stage.source,
                "colour": stage.colour, "clues": stage.clues, "samples": stage.samples,
                "hazard": stage.hazard, "collected": self.collected,
                "research_run": self.research, "profile": self.profile,
                "upgrades": self.upgrades, "shot_count": 1 + bool(self.upgrades.get("double", 0)),
                "player": self.player, "rocks": self.rocks, "drones": self.drones,
                "route_end": getattr(self, "route_end", ROUTE_ENDS[0]),
                "boss": self.boss if self.phase in ("boss", "boss_defeat", "victory") or
                (self.phase == "paused" and self.paused_from in ("boss", "boss_defeat")) else None,
                "board": self.board if self.phase in ("pipes", "pipes_success") or
                (self.phase == "paused" and self.paused_from in ("pipes", "pipes_success")) else None,
                "cursor": self.cursor, "selection": self.selection,
                "transition_time": self.transition_time,
                "next_stage_name": STAGES[self.next_stage].name if self.next_stage < len(STAGES) else "Core Warden",
                "defeat_time": self.defeat_time,
                "scan_cursor": self.scan_cursor, "scan_meter": self.scan_meter,
                "scan_target": -.12 + (self.stage % 3) * .23 +
                (.15 * sin(self.scan_time * 1.1) if self.stage == 2 else 0),
                "mine_elapsed": self.mine_elapsed, "mine_beat": self.mine_beat,
                "mine_tolerance": min(.45, .32 + .04 * (self.profile["drill"] + self.upgrades.get("drill", 0))),
                "mine_good": self.mine_good, "mine_heat": self.mine_heat,
                "mine_cooldown": self.mine_cooldown,
                "mine_practice": self.mine_practice, "practice_hits": self.practice_hits,
                "tutorial": self.tutorial, "message": self.message,
                "paused_from": getattr(self, "paused_from", None),
                "offer": [{"key": key, "name": UPGRADES[key][0], "detail": UPGRADES[key][1]}
                          for key in self.offer] if self.phase == "upgrade" else [],
                "permanent": [{"key": key, "name": item[0], "cost": item[1] * (self.profile[key] + 1),
                               "level": self.profile[key]} for key, item in PERMANENT.items()],
                "events": self.events}
