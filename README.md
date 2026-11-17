# IRONHOLD — Foundry Yard

A round-based tactical FPS in the style Counter-Strike made famous — original map,
art, sounds and names. Built for the make.fun bounty **threejs-fps-01** ($1,000).

## The game

You are the **Vanguard** attacker, alone against four **Warden** defenders on
**Foundry Yard**, an industrial yard with three lanes (west / mid / east) and two
bomb sites: **Furnace (A)** and **Depot (B)**.

- **Rounds**: buy phase (15 s) → round (100 s). First to 5 rounds wins the match
  (max 9 rounds). Win a round by eliminating the squad, or by planting the charge
  and defending it until it detonates. Lose if you die, time runs out with no
  plant, or the Wardens defuse the charge.
- **Economy**: win +$3,250, loss +$1,900, kill +$300, plant +$300. Buy menu (B):
  VK-47 rifle, Raptor-9 SMG, Breacher-12 shotgun, Longbow DMR, frag + smoke
  grenades, kevlar vest.
- **Gunplay**: headshot multipliers, recoil + spread that punish firing on the
  move, acceleration-based movement, crouch, slow-walk for accuracy, AABB map
  collision. Stopping to aim pays.
- **Bots**: follow waypoint routes, hold site angles, react to sight (range +
  facing cone + line of sight, smoke blocks vision) and to the sound of gunfire,
  strafe and fire in bursts, converge on a planted bomb to defuse it.
- **Determinism**: bot decisions come from a seeded RNG (mulberry32); the sim
  runs at a fixed 60 Hz, decoupled from rendering.

## Controls

WASD move · mouse aim · click fire · R reload · Shift slow-walk · C / Ctrl
crouch · 1 / 2 weapons · 3 / 4 grenades · B buy menu · E plant (hold, on site).

## Play it

```sh
node serve.ts        # http://localhost:8080
```

Fully offline — static files, no network requests, all sound synthesized live
with Web Audio. three.js 0.187.0 is vendored under `game/vendor/three/`.

## Build the entry

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` + `screenshots/` to the output directory and writes
`dossier.json` with `vendor/makefun-threejs.ts`. Two runs write identical bytes.

## Layout

- `game/index.html` — page + import map (`three` → vendored module) + HUD markup
- `game/src/state.js` — single state store + seeded RNG
- `game/src/map.js` — Foundry Yard geometry, collision, waypoint graph
- `game/src/weapons.js` — weapon data + hitscan (head/torso spheres, wall block)
- `game/src/player.js` — acceleration movement, crouch, collision
- `game/src/bots.js` — Warden AI (routes, hold, sight/sound, bursts, defuse)
- `game/src/bomb.js` — plant / defuse / detonate
- `game/src/economy.js` — round money + buy menu
- `game/src/audio.js` — synthesized Web Audio SFX (no audio files)
- `game/src/input.js` — keyboard / mouse / pointer lock
- `game/src/render.js` — three.js scene, synced from state (no `new` per frame)
- `game/src/hud.js` — DOM HUD, overlays, buy menu
- `game/src/sim.js` — fixed-step 60 Hz simulation
- `game/src/main.js` — bootstrap + frame loop
- `main.ts`, `serve.ts`, `vendor/makefun-threejs.ts` (kit copy, unchanged)

## License

MIT — see LICENSE.
