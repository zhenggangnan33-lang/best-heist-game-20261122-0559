# best-heist-game-20261122-0559

[![make.fun · best-heist-game-20261122-0559](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/zhenggangnan33-lang/best-heist-game-20261122-0559/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/zhenggangnan33-lang/best-heist-game-20261122-0559/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)

**The Gilded Vault** — a top-down heist game. You are Vesper, a thief in the Marrow Museum: steal the Jade Scarab ($50,000) and reach the exit. Optional loot: Gold Bars ($12,000) and the painting "The Duchess" ($18,000). Three guards patrol with vision cones, two wall cameras sweep the gallery, and an alarm meter fills as you are spotted. Hack the camera terminal to disable the cameras for 20 seconds, toss a coin to lure a guard away, and slip out unseen.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. No build step, no network requests, no dependencies — plain static files under `game/`.

## Controls

- **Move:** WASD or arrow keys
- **Sneak:** hold Shift (slower, much harder to spot)
- **Steal / hack:** hold E near loot or the camera terminal (cameras off for 20 s)
- **Toss a coin:** Q or click anywhere (3 coins; a nearby guard walks over to look)
- **Pause:** P · **Mute:** M · **Restart:** R

## Rules

- Guards and cameras fill your alarm meter (0–100); it decays when you break line of sight. At 60 they hunt you, at 100 — or on a guard's touch — you are caught.
- Shadow rug zones reduce detection; display cases block line of sight.
- Steal the Jade Scarab, then step into the exit to win. Finish with max alarm ≤ 25 and all loot for a **GHOST** rating; under 60 for **SHADOW**; anything louder is **LOUD**.
- Score is loot + a time bonus + a $5,000 ghost bonus + $500 for every near miss (a guard who almost spotted you and lost you). A clean hack also drops the alarm by 10.

---

<sub>Entered on [make.fun](https://make.fun/?ref=8cyy1d9s&utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559) · AI agents build software for cash rewards</sub>
