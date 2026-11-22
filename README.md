# The Gilded Vault

[![make.fun · best-heist-game-20261122-0559](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/zhenggangnan33-lang/best-heist-game-20261122-0559/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/zhenggangnan33-lang/best-heist-game-20261122-0559/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)

A top-down stealth heist game, built for make.fun's "Make the best heist
game" bounty. You are Vesper, a thief slipping into the Marrow Museum after
dark. Steal the Jade Scarab — $50,000 — and reach the exit, quietly if you
can. Three guards patrol the galleries with vision cones, two wall cameras
sweep the halls, and every second you are seen pushes the alarm meter
higher. At 60 the guards hunt you; at 100, or if a guard lays a hand on
you, the night is over.

Optional loot sweetens the job: the Gold Bars ($12,000) and the painting
"The Duchess" ($18,000). Shadow rugs hide you, display cases block sight,
a hacked camera terminal buys twenty seconds of darkness, and a tossed coin
pulls the nearest guard away to look. Your rating at the end — GHOST,
SHADOW or LOUD — depends on how loud the night got, and your best loot
total is kept between visits.

## How to run it

The game is plain static files under `game/` — no build step, no network,
no files beyond its own folder.

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. Or serve `game/`
with any static file server and open `game/index.html`.

## Controls

- **WASD / arrow keys** — move
- **Shift (hold)** — sneak: slower, much harder to spot
- **E (hold)** — grab loot near a case or painting; hack the camera terminal
- **Q or click** — toss a coin (3 coins; a nearby guard walks over to investigate)
- **P** — pause, **M** — mute, **R** — restart, **Space / Enter** — start

## Rules

- The alarm runs 0–100 and decays when you break line of sight.
- Being seen raises it faster up close; sneaking and standing on a shadow
  rug each roughly halve how fast you are noticed.
- Walls and display cases block sight as well as movement.
- Hacking the terminal switches both cameras off for 20 seconds.
- Reach the EXIT with the Scarab to escape. Exiting without it is no win.
- Score is loot value plus a time bonus plus a ghost bonus. Ratings:
  **GHOST** when the alarm never passed 25 and all loot was taken,
  **SHADOW** when it stayed under 60, otherwise **LOUD**.

## Layout

- `game/index.html` — the page
- `game/src/` — the game, one job per module: `config`, `random`, `world`,
  `guards`, `input`, `audio`, `render`, `sim`, `shots`, `main`
- `screenshots/` — four real renders of the game: start, play, end, caught
- `shots.json` — the scenes behind those screenshots, each with a fixed seed
- `main.ts` — the hand-in program (Node 22, standard library only): copies
  `game/` and `screenshots/` to the output directory and writes
  `dossier.json` with the vendored make.fun library
- `serve.ts` — a tiny static server for local play
- `vendor/makefun-game.ts` — the kit's dossier library, copied unchanged

All art is drawn on canvas and all sounds are synthesised with WebAudio.
The game is deterministic: the same seed always deals the same museum.
