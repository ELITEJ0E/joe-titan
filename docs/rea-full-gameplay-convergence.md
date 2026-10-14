# REA TitanCraft gameplay convergence — 2026-10-14

JOE Titan remains an original game; this pass implements behaviors and numerical facts from the **user-provided REA analysis summary**, not copied code or assets from the reference. The analysis report summarizes 22 JavaScript modules, but the actual source files were not attached to this session. Unspecified values below are JOE Titan design choices, not measured values.

## Implemented and testable

| Reference behavior | JOE Titan implementation |
|---|---|
| ODM acceleration / gravity / speed / gas | Already integrated: `src/odm-motor.js`, `src/player.js`, `src/odm-physics.js`, 240 Hz `src/main.js` |
| Independent left/right cables and reticle hits | Existing `src/odm-targeting.js` and `src/player.js` |
| Bullet speed 110, gravity 4, damage 30, lifetime 1.4s | `src/reference-combat.js` and `src/ranged-combat.js` |
| Fire cooldown .28s, reload 1.6s, radius .9 | `src/ranged-combat.js`; shoot using **C** or mobile **PISTOL** |
| Bullet/parry timing .3s slash, .6s spin; radius 1.9 | `parryBullet` pure calculation, unit tested. Full player-vs-player bullet parry **not yet connected** because there is no inbound player shooting system |
| Titans with segmented napes, shallow/deep outcomes | `src/reference-combat.js` and Shifter-type variants in `src/enemies.js` |
| Hardened armor, nape crack, stagger, kill | Integrated into Armored / Beast combat. Deep cut threshold is JOE Titan tuning, not provided in REA summary |
| Titan type swipe damage 18–35 | Titan type AI in `src/enemies.js`; 3 additional Shifter variants (Armored, Beast, Colossus). Exact model dimensions/speeds remain original |
| Beast boulder speed 22 and gravity 4 | `src/titan-projectiles.js`, launched by Beast AI |
| Grabbed scout immobilized; 7 inputs to escape | `src/player.js` / `src/enemies.js` / `src/main.js`. F or Space on keyboard, Strike or Boost on touch. No grab damage |
| Gas +60, HP +15, blades +2, radius 3.6 and vertical ~3.4 | `src/supplies.js`; original rooftop pickup placement and 35s respawn |
| Wire encoding to .01 units of position/velocity/anchors | `src/reference-combat.js`, `src/multiplayer.js` |
| Remote packet smoothing | Bounded extrapolation and frame-rate-independent avatar interpolation in `src/network-interpolation.js` |

## Original game choices — not source measurements

- Projectile model, weapons sound, pistol magazine (8 rounds), blast cadence other than shot/reload, and choice of input C
- Boulder damage (24), radius (1.25), cooldown (4.5 seconds), projectile lifetime (5s), target leading
- Titan movement speeds, visual models, selected spawn positions, deep-cut threshold and armor guard criteria
- Grab cooldown (8s), enemy selection, pickup positions, respawn (35s)
- Shifter visual appearances and stagger presentation
- Co-op remote extrapolation window (.12s) and smoothing gain

## Not yet replicated

The user-supplied report does not give enough information for a faithful implementation of these subsystems:

1. All **16** reference-character records and their exact multipliers; only a Levi example was provided
2. Complete Titan skeletal nape, hand, limb severance, arm regeneration, projectile body collision and type-specific guard states
3. Actual shifter transformations, animation states, special abilities and cooldown tables
4. Network authority / victim-side adjudication, per-peer projectile ownership, shared loot synchronization and anti-cheat handling
5. Full mission/boss progression from `missions.js`, scoring and objective state transitions
6. Original gun projectile ownership, remote shot/parry synchronization and any unrecovered damage bonus
7. Complete audio, effects, and skin/model resources

If the user shares the extracted **per-module analysis with exact state diagrams/formulas** or legally sharable excerpts needed for interoperability, develop those next. Do not label JOE Titan behavior as exactly matching the reference until interactive gameplay tests confirm it.

## Verification

`npm run verify` includes movement, fixed-step, render-mode, REA constant, combat, Titan projectile, nape, pickup, grabbed pilot and interpolation checks. `npm run build` confirms production compilation.

**Deployment**: GitHub Actions can succeed while Vercel fails due to plan-specific build rate limit. Treat CI passing as source/build validation only, not successful public deployment. Confirm separate Vercel status when rolling out.
