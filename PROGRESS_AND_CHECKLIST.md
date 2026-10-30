# Earth Builder Mission — batch 6 progress and checklist

PASS = Python/API/JavaScript checks; HANDS-ON = review in a real browser or
physical controller. The previous batch remains a separate backup.

| Batch | Scope | Status |
| --- | --- | --- |
| 1 | Python browser architecture, three routes and puzzle loop | Complete checkpoint |
| 2 | Scrolling sectors, approved ship and first Boss sprite, pause/resize fix | Complete checkpoint |
| 3 | Long two-phase Boss, health bar, twin bolts, transition scenes, card effects | Complete checkpoint |
| 4 | Local music and sound effects, looping, ducking, pause and mute | Complete checkpoint; route music was too quiet in listening test |
| 5 | Route music loudness fix, Boss-reference level | Complete checkpoint; Pulse still inaudible in user's third-route test |
| 6 | Pulse audible midrange, browser-friendly sample rates and MP3 format | Implemented; automated checks pass; hands-on listening next |
| 7 | Final balancing, classroom demonstration and rubric audit | After listening test |

| Screen or rule | Required behaviour | Check |
| --- | --- | --- |
| Launch / opening | Python starts local browser; original opening remains | PASS HTTP; HANDS-ON visuals |
| Flight | Three palettes; world scroll, rocks, active enemy fire, keyboard and pad | PASS rules; HANDS-ON difficulty |
| Scan / identify | Q/X at beacon; clue cards and keyboard/pad selection | PASS rules; HANDS-ON controls |
| Pipes | Fixed solvable board; success mark and ~1.6-second pause | PASS state; HANDS-ON appearance |
| Mining | Three layers, wide zone reflects Precision Drill, no idle penalty | PASS rules; HANDS-ON timing |
| Upgrade cards | Repair heals; Hull raises cap; Twin Laser fires two actual bolts; Focus speeds lock; Drill widens arc; Notebook adds research | PASS each effect; HANDS-ON twin visuals |
| Loading | Visual art, next-stage name, ship drift/dots animation, ~2.6 seconds after card | PASS state/asset; HANDS-ON scale |
| Boss phase 1 | Health bar, upper/lower weak points, telegraphed beam/debris | PASS mechanics; HANDS-ON battle |
| Boss phase 2 | 2.7-second armour split; approved second form, fan bullets and core windows | PASS state/asset; HANDS-ON art/difficulty |
| Boss defeat | 3-second breaking/explosion before Earth scene | PASS state; HANDS-ON animation |
| Failure / restart | Approved starfield and damaged ship, live saved-research number, pad and keyboard buttons | PASS routing; HANDS-ON layout |
| Earth ending | Approved Earth artwork, live new-run button, 0–6 demo jump preserved | PASS routing; HANDS-ON layout |
| Pause / resize | Boss/player persist, draw loop continues after resize | PASS regression and JS frame smoke |
| Sound | Pulse at 44.1 kHz with an audible upper-octave layer; Sector/Airy at 48 kHz; Boss tracks unchanged; loop and controls preserved | PASS codec/rate, audio decode, HTTP, JS state smoke; HANDS-ON third-route speaker check |
| Delivery | All Python sources and images in ZIP, offline runtime, no pip dependency | PASS archive/API |
| Advanced topics | Recursive connectivity and JSON file I/O used; exact Ed Advanced topic labels require course confirmation | Usage checked; course-label check pending |

Playtest priorities: choose Twin Laser to inspect two bullets; watch the Boss
phase switch; test loading after a card choice; inspect failure and Earth
scenes at your actual classroom screen size and with your controller. Listen
through an entire route track to confirm the loop sounds natural on your
speakers; test sound activation with both keyboard and controller.
