# Earth Builder Mission — Browser batch 6

The game rules, progression, puzzles, combat and save are written in Python. A
local Python standard-library server supplies a browser display and keyboard or
controller input. No pip packages, installation of a game engine, or network
access are required for play.

## Launch

Extract the entire ZIP and keep `web/`, `assets/` and all `.py` files together.
From the extracted project directory run:

```text
python main.py
```

The local browser page should open automatically. If it does not, use the URL
printed in the terminal. Do not open `web/index.html` directly: the browser
must reach the Python process. Press Ctrl+C in the terminal to stop the server.

For a three-minute presentation, run `python main.py --demo`. Keys 1–3 jump to
the three routes, 4/5 to Boss phases, 6 to the ending, and 0 to the menu.
Demo mode never changes the save. H opens the complete key guide; F toggles
fullscreen. For the best visual experience, play in full-screen mode. Press F
in the game to toggle full-screen.

## Sound

All music and sound effects are included locally in `web/assets/audio/` and
work without an internet connection. A browser starts sound after an input:
click Skip, press Enter, or click **ENABLE SOUND** in the bottom-right corner.
Use **M** or the sound button to mute and unmute. On an Xbox-style controller,
use **View / Back** (the small button opposite Start). Some browsers require one
mouse click on ENABLE SOUND before allowing sound from a controller-only start.
Muted sound does not stop gameplay. Music loops automatically. Pause and an
inactive browser tab stop music; it resumes when you continue.
The route tracks were loudness-matched to the Boss tracks. Sector and Airy are
48 kHz OGG; Pulse is a 44.1 kHz MP3 with a quiet octave layer from the same
recording so its rhythm is audible on small speakers. Boss music is unchanged.

| Scene | Music |
| --- | --- |
| Menu / Icefield | Sector |
| Crystal Reach | Airy |
| Magnetic Field | Pulse |
| Scan, identify, pipe puzzle, mining, upgrade | Current route track at lower volume |
| Loading / defeat / Boss explosion | Music fades out; transition or impact sound |
| Core Warden phase 1 / phase 2 | Final Stand phase 1.3 / phase 2.2 |
| Ending | Short victory cue, then quiet Airy ambience |

The sound effects include UI selection, scanner ping, bolts, shield hits,
mining taps, energy pickup, Boss transformation and defeat. Music fades between
routes and Boss phases; the short effects play over it.

## Playtest this batch

1. Complete the first pipe circuit. The connected board should remain on
   screen with a success mark for about 1.6 seconds before mining begins.
2. After collecting a sample, choose an upgrade. A next-sector screen with
   animated dots appears for about 2.6 seconds before the next route.
3. Choose Twin Laser when offered; J or RT should visibly launch two parallel
   bolts and each bolt can hit an enemy. Other cards have distinct effects:
   immediate repair; more maximum shields; faster scan; wider mining zone; or
   bonus research shown in the HUD.
4. In demo mode press 4. Scan with Q/X, fire at the upper and lower nodes,
   watch the Boss health bar and its 2.7-second armour change. Phase 2 has
   separated metal plates, an amber core, fan projectiles, and timed openings.
5. Defeat the core to see the explosion before the complete Earth scene.
   Press 6 to inspect the finished screen directly.
6. To inspect the failure scene, lose all shields in a normal run. Check the
   saved research value, Restart and Ship Workshop with keyboard and pad.
7. Pause during either Boss phase, resize/minimize/restore, then resume. Check
   that the Boss, ship and health bar remain visible.
8. Listen through a route and both Boss phases. Check the two different Boss
   tracks, the loop at the end of a track, puzzle music reduction, and M / View
   mute. Pause and resume to confirm no tracks overlap.

Images for the phase-two guardian and loading, failure and victory scenes were
adapted from the approved reference images. Dynamic labels, research totals,
health and controls are drawn by the game, so they reflect the current run.

## Code map and checks

- `main.py`: Python standard-library HTTP server, restricted image/audio routes.
- `game.py`: authoritative state and scene transitions.
- `stages.py`, `combat.py`: three sectors, enemy shots, two-stage Boss.
- `puzzles.py`, `assets/pipe_puzzle_spec.json`: fixed pipe solutions and mining.
- `progression.py`: six run upgrades and persistent JSON save.
- `web/`: approved visual assets, local audio, canvas drawing and device input.
- `PROGRESS_AND_CHECKLIST.md`: per-screen review checklist.

Run `python -m unittest discover -s tests -v` to check the rules and local
browser routes. Boss feel, physical controller vibration and final visual
scale still need hands-on playtesting on your computer.

## Music and sound sources

All audio below is listed as **CC0** on its source page. The packaged files
are distributed with this project; `mining_tap.ogg` is a short, faded excerpt
of `mining_1.ogg`. Source links are included for provenance and optional credit.

| Source | Files used |
| --- | --- |
| [Dark Sci-Fi Audio Pack](https://opengameart.org/content/dark-sci-fi-audio-pack) | Sector, Airy, Pulse (volume adjusted from the original recordings), Victory, Hover |
| [Final Stand](https://opengameart.org/content/final-stand-0) | phase 1.3 and phase 2.2 music |
| [UI Click Sounds (Sci Fi)](https://opengameart.org/content/ui-click-sounds-sci-fi) | UI click 1 |
| [Sonar Ping](https://opengameart.org/content/sonar-ping) | sonar ping |
| [Space Shoot Sounds](https://opengameart.org/content/space-shoot-sounds) | alien shoot 1 |
| [Mining Sample](https://opengameart.org/content/mining-sample) | mining 1 excerpt |
| [Electricity Game Sound Pack](https://opengameart.org/content/electricity-game-sound-pack) | powerup, hit, powerdown, shield hit, charge, death boom, teleport |
