"""Authoritative ship, debris, drone and two-phase guardian simulation."""

from math import hypot, sin
import random


def ship(x: float = 80, y: float = 300, shields: int = 3) -> dict:
    return {"x": x, "y": y, "shields": shields, "max_shields": shields,
            "invuln": 0.0, "shot_cd": 0.0}


def guardian(phase: int = 1) -> dict:
    return {"phase": phase, "nodes": [5, 5] if phase == 1 else [0, 0],
            "core": 24, "scanned": phase == 2, "clock": 0.0,
            "pattern": 0, "window": 0.0 if phase == 1 else 2.0,
            "transition": 0.0, "projectiles": [], "beam_time": 0.0,
            "aim_y": 300}


def move(player: dict, dx: float, dy: float, dt: float, limit_x: float = 870) -> None:
    magnitude = max(1.0, hypot(dx, dy))
    player["x"] = max(45, min(limit_x, player["x"] + dx / magnitude * 215 * dt))
    player["y"] = max(48, min(552, player["y"] + dy / magnitude * 215 * dt))


def damage(player: dict, events: list[str]) -> None:
    if player["invuln"] <= 0:
        player["shields"] -= 1
        player["invuln"] = 1.35
        events.append("damage")


def flight_tick(player: dict, rocks: list[dict], drones: list[dict],
                level: int, dx: float, dy: float, dt: float, shoot: bool,
                shot_count: int, events: list[str], route_end: float) -> None:
    player["invuln"] = max(0, player["invuln"] - dt)
    player["shot_cd"] = max(0, player["shot_cd"] - dt)
    if level == 2 and 1200 < player["x"] < 2300:
        # The magnetic zone is marked in the view and only mildly alters steering.
        dy += 0.35 * sin(player["x"] * .015)
    move(player, dx, dy, dt, limit_x=route_end + 40)
    for rock in rocks:
        rock["phase"] += dt * (0.3 if level < 2 else .9)
        y = rock["y"] + (sin(rock["phase"]) * 18 if level >= 2 else 0)
        if hypot(player["x"] - rock["x"], player["y"] - y) < rock["r"] + 16:
            damage(player, events)
    if shoot and player["shot_cd"] <= 0:
        player["shot_cd"] = .32
        events.append("shoot")
        for offset in ((0,) if shot_count == 1 else (-19, 19)):
            for drone in drones:
                if drone["hp"] > 0 and 0 < drone["x"] - player["x"] < 420 \
                        and abs(drone["y"] - (player["y"] + offset)) < 34:
                    drone["hp"] -= 1
                    events.append("hit")
                    break
    for drone in drones:
        if drone["hp"] <= 0:
            continue
        drone["clock"] += dt
        drone["y"] += sin(drone["clock"] * 1.8) * 14 * dt
        if abs(drone["x"] - player["x"]) < 28 and abs(drone["y"] - player["y"]) < 25:
            damage(player, events)
        if drone["clock"] >= (2.9 if level == 0 else 1.7) and 0 < drone["x"] - player["x"] < 620:
            drone["clock"] = 0
            # Aim once when launched, then commit to a slow, dodgeable path.
            vx, vy = player["x"] - drone["x"], player["y"] - drone["y"]
            length = max(1, hypot(vx, vy))
            drone["bullet"] = {"x": drone["x"], "y": drone["y"],
                               "vx": vx / length * 175, "vy": vy / length * 175}
            events.append("enemy_shoot")
        if drone.get("bullet"):
            bullet = drone["bullet"]
            bullet["x"] += bullet["vx"] * dt
            bullet["y"] += bullet["vy"] * dt
            if hypot(player["x"] - bullet["x"], player["y"] - bullet["y"]) < 21:
                damage(player, events)
                drone["bullet"] = None
            elif bullet["x"] < player["x"] - 420 or not 0 < bullet["y"] < 600:
                drone["bullet"] = None


def make_drones(level: int, seed: int) -> list[dict]:
    rng = random.Random(seed * 131 + level)
    count = (2, 4, 5)[level]
    spacing = (940, 730, 600)[level]
    return [{"x": 930 + i * spacing,
             "y": rng.choice((195, 275, 350, 425)),
             "hp": 1 + (level == 2 and i % 2 == 0),
             "clock": rng.uniform(.5, 1.6), "bullet": None}
            for i in range(count)]


def boss_tick(boss: dict, player: dict, dx: float, dy: float, dt: float,
              shoot: bool, shot_count: int, events: list[str]) -> None:
    """Two visible armour states with dodgeable waves and separate bolt lanes."""
    move(player, dx, dy, dt, limit_x=630)
    player["invuln"] = max(0, player["invuln"] - dt)
    player["shot_cd"] = max(0, player["shot_cd"] - dt)
    if boss["transition"] > 0:
        boss["transition"] = max(0, boss["transition"] - dt)
        return
    if not boss["scanned"]:
        return

    previous = boss["clock"]
    boss["clock"] += dt
    boss["window"] = max(0, boss["window"] - dt)
    cycle = 4.8 if boss["phase"] == 1 else 4.4
    if int(previous / cycle) != int(boss["clock"] / cycle):
        boss["pattern"] += 1
        boss["aim_y"] = player["y"]
        if boss["phase"] == 2:
            boss["window"] = 2.2
        events.append("warning")
    if previous % cycle < 1.15 <= boss["clock"] % cycle:
        if boss["phase"] == 2:
            # A five-way amber fan telegraphed in the art and easy to read.
            for y in (180, 240, 300, 360, 420):
                boss["projectiles"].append({"x": 765, "y": 300,
                                            "vx": -170, "vy": (y - 300) * .48,
                                            "kind": "ember"})
        elif boss["pattern"] % 2:
            boss["beam_y"] = boss["aim_y"]
            boss["beam_time"] = .38
        else:
            gap = min(range(3), key=lambda i: abs((150, 300, 450)[i] - boss["aim_y"]))
            for i, y in enumerate((150, 300, 450)):
                if i != gap:
                    boss["projectiles"].append({"x": 765, "y": y, "vx": -188,
                                                "vy": 0, "kind": "debris"})
    boss["beam_time"] = max(0, boss["beam_time"] - dt)
    if boss["beam_time"] > 0 and abs(player["y"] - boss.get("beam_y", 300)) < 24:
        damage(player, events)
    for projectile in boss["projectiles"]:
        projectile["x"] += projectile["vx"] * dt
        projectile["y"] += projectile["vy"] * dt
        if hypot(player["x"] - projectile["x"], player["y"] - projectile["y"]) < 23:
            damage(player, events)
    boss["projectiles"] = [p for p in boss["projectiles"] if p["x"] > -30 and -30 < p["y"] < 630]

    if shoot and player["shot_cd"] <= 0:
        player["shot_cd"] = .43
        events.append("shoot")
        offsets = (0,) if shot_count == 1 else (-19, 19)
        if boss["phase"] == 1:
            for offset in offsets:
                for i, y in enumerate((210, 390)):
                    if boss["nodes"][i] > 0 and abs(player["y"] + offset - y) < 39:
                        boss["nodes"][i] -= 1
                        events.append("hit")
                        break
            if not any(boss["nodes"]):
                boss["phase"] = 2
                boss["clock"] = 0.0
                boss["window"] = 2.2
                boss["transition"] = 2.7
                boss["projectiles"].clear()
                boss["beam_time"] = 0.0
                events.append("boss_phase")
        elif boss["window"] > 0:
            for offset in offsets:
                if abs(player["y"] + offset - 300) < 38 and boss["core"] > 0:
                    boss["core"] -= 1
                    events.append("hit")
            if boss["core"] == 0:
                events.append("boss_defeated")
