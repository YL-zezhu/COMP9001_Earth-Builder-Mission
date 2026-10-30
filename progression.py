"""Permanent JSON profile and temporary upgrade choices."""

import json
from pathlib import Path
import random

PROFILE_DEFAULT = {"research": 0, "hull": 0, "scanner": 0, "drill": 0,
                   "tutorial_done": False, "best_stage": 0, "wins": 0}
UPGRADES = {
    "repair": ("Emergency repair", "Restore one shield immediately"),
    "hull": ("Reinforced hull", "One extra shield this run"),
    "double": ("Twin laser", "Fire two visible bolts per volley"),
    "scanner": ("Signal focus", "Lock scanner faster"),
    "drill": ("Precision drill", "Wider rhythm timing window"),
    "data": ("Field notebook", "Two bonus research points"),
}
PERMANENT = {
    "hull": ("Start shield +1", 2),
    "scanner": ("Faster scanner", 2),
    "drill": ("Wider mining window", 2),
}


def load(path: Path) -> dict:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            raise ValueError("Profile must be an object")
    except (OSError, ValueError, json.JSONDecodeError):
        return PROFILE_DEFAULT.copy()
    profile = PROFILE_DEFAULT.copy()
    for key, default in PROFILE_DEFAULT.items():
        if key in data and type(data[key]) is type(default):
            profile[key] = data[key]
    for key in ("research", "hull", "scanner", "drill", "wins", "best_stage"):
        profile[key] = max(0, min(999 if key in ("research", "wins") else 5,
                                 profile[key]))
    for key in ("hull", "scanner", "drill"):
        profile[key] = min(profile[key], 2)
    return profile


def save(path: Path, profile: dict) -> None:
    """Replace an on-disk profile atomically to avoid half-written saves."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(profile, indent=2), encoding="utf-8")
    tmp.replace(path)


def choices(seed: int, stage: int, shields: int, max_shields: int) -> list[str]:
    pool = ["repair", "hull", "double", "scanner", "drill", "data"]
    if shields >= max_shields:
        pool.remove("repair")
    if stage == 2:
        pool.remove("drill")  # The final mineral has already been collected.
        pool.remove("scanner")  # Boss scanning does not use a lock timer yet.
    return random.Random(seed * 47 + stage).sample(pool, 2)


def purchase(profile: dict, key: str) -> bool:
    if key not in PERMANENT or profile[key] >= 2:
        return False
    cost = PERMANENT[key][1] * (profile[key] + 1)
    if profile["research"] < cost:
        return False
    profile["research"] -= cost
    profile[key] += 1
    return True
