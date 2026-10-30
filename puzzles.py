"""Fixed pipe puzzles, recursive connectivity, and forgiving mining timing."""

import json
from pathlib import Path

UP, RIGHT, DOWN, LEFT = 1, 2, 4, 8
DELTAS = ((-1, 0, UP, DOWN), (0, 1, RIGHT, LEFT),
          (1, 0, DOWN, UP), (0, -1, LEFT, RIGHT))

PUZZLE_DATA = json.loads((Path(__file__).resolve().parent / "assets" /
                          "pipe_puzzle_spec.json").read_text(encoding="utf-8"))["puzzles"]


def rotate(mask: int) -> int:
    """Rotate a pipe clockwise by 90 degrees."""
    return ((mask << 1) & 15) | (mask >> 3)


def new_pipes(level: int, seed: int = 0) -> list[list[int]]:
    """Copy an approved initial board; seed does not alter a designed puzzle."""
    return [row.copy() for row in PUZZLE_DATA[level]["initial_masks"]]


def connected(board: list[list[int]]) -> bool:
    """Recursively traverse mutually joined pipes; visited prevents cycles."""
    if len(board) != 4 or any(len(row) != 4 for row in board):
        return False
    if not (board[1][0] & LEFT and board[2][3] & RIGHT):
        return False
    visited: set[tuple[int, int]] = set()

    def visit(row: int, col: int) -> bool:
        if (row, col) == (2, 3):
            return True
        visited.add((row, col))
        for dr, dc, outgoing, incoming in DELTAS:
            nr, nc = row + dr, col + dc
            if (board[row][col] & outgoing and 0 <= nr < 4 and 0 <= nc < 4
                    and (nr, nc) not in visited and board[nr][nc] & incoming):
                if visit(nr, nc):
                    return True
        return False

    return visit(1, 0)


def mining_judgement(elapsed: float, beat: int, tolerance: float) -> str:
    """Judge a key press against the centre of a repeating 1.25s ring pulse.

    Waiting or missing a pulse does not erase the current layer's progress.
    The beat argument is kept for compatibility with the original caller.
    """
    phase = elapsed % 1.25
    return "good" if abs(phase - .625) <= tolerance else "miss"
