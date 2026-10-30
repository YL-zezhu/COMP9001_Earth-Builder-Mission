"""Three fixed expeditions with distinct hazards and bounded layout variation."""

from dataclasses import dataclass
import random


@dataclass(frozen=True)
class Stage:
    element: str
    name: str
    source: str
    colour: str
    clues: tuple[str, str]
    samples: tuple[str, str, str]
    answer: int
    hazard: str
    difficulty: int


STAGES = (
    Stage("O", "Icefield", "Water ice (H₂O)", "#79caec",
          ("H₂O signature", "Layered ice"), ("Water ice", "Quartz", "Magnetite"), 0,
          "Slow ice fragments", 1),
    Stage("Si", "Crystal Reach", "Quartz (SiO₂)", "#b9a8ee",
          ("SiO₂ signature", "Angular crystal"), ("Water ice", "Quartz", "Magnetite"), 1,
          "Decoy signals", 2),
    Stage("Fe", "Magnetic Field", "Magnetite (Fe₃O₄)", "#e7a576",
          ("Iron oxide", "Magnetic response"), ("Water ice", "Quartz", "Magnetite"), 2,
          "Marked magnetic pull zones", 3),
)

# The original HTML prototype's beacon sat near world x=3420, on a 3600-unit
# course. Keep that sense of distance while increasing hazards by route.
ROUTE_ENDS = (3420, 3580, 3740)


def layout(index: int, seed: int) -> list[dict]:
    """Seeded obstacle bands; each has a visible passage at another height."""
    rng = random.Random(seed * 37 + index * 1009)
    rocks = []
    # Keep the first tutorial rings and target clear, then alternate danger
    # lanes. Background rocks are decorative; only these bodies collide.
    count = (13, 18, 22)[index]
    for i in range(count):
        x = 660 + i * ((ROUTE_ENDS[index] - 880) / max(1, count - 1)) + rng.randint(-38, 38)
        lane = (125, 205, 305, 405, 485)[(i * 3 + index) % 5]
        y = lane + rng.randint(-24, 24)
        rocks.append({"x": round(x), "y": round(y), "r": (35, 38, 41)[index] + rng.randint(-5, 5),
                      "phase": rng.random() * 6.28})
    return rocks
