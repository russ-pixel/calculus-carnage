# Calculus Carnage — Prototype

Browser physics-sandbox where every unlock is gated behind an algebra problem. Adult tone, no condescension, 3-tier hint system. Single-file HTML + Matter.js (CDN), no build. Two worlds: **Surface** and **The Abyss** (underwater, gated behind a Level 4 problem).

## Run

```
open index.html
```

Reload with ⌘R. No server, no dependencies to install.

## How to play

- Click the stage to spawn the active tool.
- Drag bodies with the mouse.
- Click a tool in the top toolbar to switch (unlocked) or open its math gate (🔒 locked).
- Solve to unlock. Hint button cycles: **reframe → walkthrough → worked example + new problem**.
- Earn one skip token per 10 problems solved hint-free.
- Click **The Abyss** world tab (🔒 Level 4) to unlock the second world. Switching worlds clears the stage; unlocks persist across switches (but not reloads).

## Tools — Surface

| Tool | Level | Kind | Notes |
|---|---|---|---|
| Crate | 0 | spawn | Default unlocked. Available in both worlds. |
| Dummy | 0 | spawn | Default unlocked. Stands upright; ragdolls when back or legs break. |
| Cannonball | 1 | spawn | Heavy projectile. Both worlds (sinks underwater). |
| Bomb | 2 | spawn | Detonates after ~1.2s, applies radial force |
| Flip Gravity | 2 | action | Inverts `engine.gravity.y`. Both worlds (also flips buoyancy). |
| Freeze | 2 | action | Freezes all bodies in place. Drag a frozen limb to unfreeze + rip it; joints snap if stretched >45px. Thaws after 8s with a scatter burst. Both worlds. |
| Crate Stack | 3 | spawn | 12-crate stack |
| Fatality Slam | 3 | action | Guaranteed dismemberment + kill-cam for every living dummy. Both worlds. |
| Black Hole | 3 | action | 5s singularity, pulls + consumes bodies |
| Machine Gun | 3 | action | 2.8s bullet barrage from random edge points |
| Tornado | 3 | action | 6s vortex: spins + lifts all bodies, drifts across stage |
| Mutant Duck | 3 | spawn | Aggressive AI character — waddles + lunges at humans/monsters. Both worlds (floats underwater). |
| Parasite | 3 | spawn | Headcrab visual. Latches onto a human, transforms host into a tentacled monster over 3s. Monster hunts non-monsters; on death erupts into 2 new parasites. |
| Laser Shark | 3 | spawn | Hovers at spawn height, drifts toward nearest human/duck/monster. Fires a green laser beam every 2.5s (0.8s duration). Two beams dismember. Darkens when wounded. Both worlds. |

## Tools — The Abyss

The world itself is gated behind a **Level 4** problem (`ax + b = cx + d`, Grade 8). Underwater: area-based buoyancy (dense bodies sink, default-density bodies float), velocity drag, drifting blood, bubbles, light shafts, marine snow.

| Tool | Level | Kind | Notes |
|---|---|---|---|
| Diver | 0 | spawn | Default unlocked. The Abyss's dummy — same skeleton/damage model, brass helmet + bubble trail drawn in afterRender. `kind: 'human'`, `isDiver: true`. |
| Jellyfish | 2 | spawn | Pulses upward. Sting on contact: 5 damage + 2.4s paralysis (`paralyzedUntil` — posture + duck/monster AI respect it). |
| Depth Charge | 2 | spawn | Dense, sinks. Detonates on the seafloor (or 4.5s fallback): radius 300, bubble burst. Blinking arming light. |
| Piranha Swarm | 3 | spawn | Six tiny fish. Each darts at the nearest human/duck/monster and nibbles the closest limb (3 dmg/bite, then darts back). Structural breaks apply. |
| Anglerfish | 3 | spawn | Stalks slowly, lunges with gaping needle-toothed jaw inside 190px. Pulsing lure glow. Damage via lunge-speed collisions. |
| Electric Eel | 4 | spawn | Sinuous swim. Every ~3.4s discharges chain lightning at up to 3 creatures within 260px: 9 dmg + knockback + 1.5s paralysis. |
| Harpoon Volley | 4 | action | 2.4s of heavy steel bolts from left/right edges. Drag slows them; they sink as they decelerate. |
| Whirlpool | 4 | action | 5.2s mid-water vortex, pulls bodies into orbit, drifts. |
| Kraken | 4 | action | Three tentacles rise from the seafloor for 7.5s; each drags nearby bodies to its tip and periodically slams them down (sets velocity y=26 → floor-impact gore). Pure force-field + procedural render, no physics bodies. |

## Files

- `index.html` — UI shell, CSS, math-gate modal, HUD, world tabs, toolbar, sidebar log. PWA meta tags + responsive phone layout (stage on top, tool drawer below, 🛠 toggle for fullscreen play).
- `main.js` — all game logic (~3200 lines). Single source of truth. World 2 lives in the `WORLD 2: THE ABYSS` section at the bottom; world definitions (`WORLDS`, `ABYSS_GATE`) sit next to `TOOLS` at the top.
- `matter.min.js` — vendored Matter.js 0.20.0 (local so the PWA works offline).
- `manifest.webmanifest`, `sw.js`, `icon-*.png`, `apple-touch-icon.png` — PWA install + offline support. **Bump `CACHE` in sw.js when shipping changes**, or installed copies keep serving old files (cache-first). The install step fetches with `cache: 'reload'` to bypass stale HTTP caches.

## iPhone install

Host the folder anywhere static (GitHub Pages / Netlify / Vercel), open the URL in Safari → Share → **Add to Home Screen**. Runs fullscreen with its own icon, works offline after first load. Touch works: tap to spawn, drag bodies with a finger.

## Architecture notes for the next extension

### Body labels (`body.label`)

- `'flesh'` — character limb. Carries `body.dummyId` (key into `dummies` Map) and `body.bodyPart` (`'head'`, `'back'`, `'legL'`, `'legR'`, `'armL'`, `'armR'`, or character-specific like `'beak'`, `'tail'`).
- `'wall'` — static world boundary. `rebuildWalls()` only removes bodies with this label.
- `'bullet'`, `'bomb'`, `'parasite'` — projectiles / creatures.

### `dummies` Map

Each entry: `{ kind, parts, constraints, joints, limbs, damage, partDamage, legsOk, backOk, standing, dead, ... }`. AI handlers iterate `dummies.values()` and filter on `kind` (`'human' | 'duck' | 'monster'`). Always include `limbs.torso` (alias the main body if your creature doesn't have a literal torso) so generic posture/AI code works.

### Posture + damage

- `beforeUpdate` applies restoring torque to torso + legs when `standing && backOk`.
- Back damage >18 → `breakBack()` → `standing=false`, ragdolls from the waist.
- Leg damage >14 on a side → `breakLeg()` pops that hip, sets `standing=false`.
- Total damage >45 → `dismember()` removes all constraints + triggers slow-mo kill cam.
- `dismember` is monkey-patched at the bottom of `main.js` to also burst parasites if the host was a monster — `_origDismember` keeps the original.

### Force tuning that worked

`Body.applyForce(body, pos, { x: dir * K * body.mass, y: ... })`:

- Duck waddle: `0.008`, lunge: `0.04`
- Monster walk: `0.018`, lunge: `0.09`
- Parasite seek: `0.0009` (plus tiny upward lift to fight gravity)

Walls were thickened from 60px → 240px to stop high-speed bodies (bullets, lunges) from tunneling through. An `afterUpdate` culler also removes anything that strays >400px outside the canvas — defensive safety net.

### World system

- Every tool has a `world` field (`'surface' | 'abyss' | 'both'`); `renderToolbar()` filters on it. The world switcher gates locked worlds through the same `openMathGate()` flow via a pseudo-tool (`ABYSS_GATE`) with an `onUnlock` callback.
- `switchWorld(id)` calls `clearStage()` (removes all non-static bodies + non-mouse constraints, clears every effect array), restyles background/walls, and seeds a starter scene.
- Long-running spawners (`machineGunBarrage`, `harpoonVolley`) check `state.world` each shot so they stop if the player switches mid-volley.
- Water physics: buoyancy force is `-gravity.y * 8e-7 * body.area` (area, not mass — so density decides float vs. sink) plus per-tick velocity damping ×0.985.
- `paralyzedUntil` on a dummy entry suspends posture torque and duck/monster AI — used by jellyfish stings and eel discharges.

### Math gate

`makeProblem(level)` → `{ text, answer, level, method }`. Tier-3 hint *replaces* the current problem with a fresh structurally-identical one (so the player applies the method instead of copying the answer). Levels: 1 = `x ± a = b`, 2 = `ax = b` / `x÷a = b`, 3 = `ax + b = c`, 4 = `ax + b = cx + d`.

### Visual flourishes

Wings, eyes, tentacles, blood, fire, etc. are drawn procedurally in `afterRender` — they're visual-only, no physics. The decals/droplets system maintains a persistent splatter list capped at ~220.

## Removed (historical context)

- A fire-breathing dragon was added and later removed (Dec 2025 build). Code path included `breatheFire`, `fireParticles`, dragon AI, dragon fire-immunity carve-out, `DRAGON_SCALE` constant. All deleted — `git diff` would show the cleanup if this were in git.

## Not yet implemented

- Persistence (localStorage). Reload resets unlocks.
- Wound-decal textures on living dummies.
- Custom-execution / fatality builder.
- Tier-based content scaling per the original design doc.
