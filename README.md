# Puncak Ridge Run

A 2.5D flight game over an Indonesian mountain valley. Fly a small prop plane
down the valley in chase view: layered ridges with snow caps, a winding river,
terraced fields, golden rings to fly through, and a landing strip at the end of
the valley. Offline static files, keyboard and mouse, no network requests.

## How to play

Serve `game/` with any static server (`node serve.ts`, then open
http://localhost:8080) and fly with the keyboard:

- **← →** or **A D** — bank and turn
- **↑ ↓** or **W S** — climb and descend
- **Shift** / **Q** — throttle up / down
- **1 / 2 / 3** — pick a mission on the title screen
- **Space** — start / restart (or click)
- **P** — pause

## Missions

1. **Ring Run** — fly through 8 golden rings. Each ring is +100 points and +6%
   fuel; a near miss is +25.
2. **River Run** — stay under 70 m while you follow the river through 6 rings.
   Low flying banks bonus points.
3. **Strip Landing** — reach the end of the valley and land on the strip: low,
   slow (under 58 m/s) and lined up with the centreline. A clean landing pays
   +500 plus a fuel bonus.

Watch the HUD: altitude, vertical speed, heading compass, speed, throttle,
fuel, score, rings and distance to the strip. Mind the ridges — the valley
floor is flat, the slopes are not — and mind the fuel gauge: rings top it up.

## Screenshots

Deterministic scenes, staged by `?shot=` with a fixed seed (`shots.json`):

- `1-start.jpg` — title screen over the valley (`?shot=start&seed=7`)
- `2-play.jpg` — mid-flight through the rings (`?shot=play&seed=7`)
- `3-valley.jpg` — low river run (`?shot=valley&seed=7`)
- `4-landing.jpg` — final approach to the strip (`?shot=landing&seed=7`)

## Files

- `main.ts` — the entry program: copies `game/` and `screenshots/` to
  `/output` and writes `dossier.json` with the vendored make.fun library.
- `game/` — the playable game as static files (`index.html` + ES modules under
  `src/`), no library, no network request.
- `screenshots/` — 4 real renders of the game's own code.
- `vendor/makefun-game.ts` — copied from the competition kit, unchanged.
