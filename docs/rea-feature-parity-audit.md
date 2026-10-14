# Attack on Titancraft REA feature parity audit (14 Oct 2026)

This is a feature-by-feature audit against the **user-provided extracted-code report**, not a verified claim of identical runtime behavior or a copy of the reference game's assets/source.

| Reference system | JOE Titan status | Source |
|---|---|---|
| Player physics, 26 gravity, 9.6 jump, 85 cap, 240 Hz | Implemented with source-derived coefficients | src/player.js, src/odm-motor.js, src/main.js |
| Q/E independent exact center reticle targets | Implemented; deliberate user preference | src/odm-targeting.js |
| 3–26 cable reel, 2.5–38 pull, 7 pump, drag, gas | Implemented using reported values | src/odm-motor.js |
| Player 0.6 × 1.8, swept voxel slide, limited rebound | Implemented approximately | src/voxel-slide.js |
| Wall/landing impact damage | Implemented with measured thresholds | src/odm-impacts.js |
| Six Titan variants & pursuit/swipe | Original implementation, type details not source-identical | src/enemies.js |
| Shifter nape segments, armor/crack/stagger | Implemented using supplied numeric description | src/reference-combat.js, src/enemies.js |
| Arm severance, 12/6 sec regrowth & attack interruption | Implemented 14 Oct; original geometry-based arm collision | src/titan-limbs.js, src/enemies.js |
| Boss boulder throw, 22 speed and 4 gravity | Implemented; damage/cooldown are original choices | src/titan-projectiles.js |
| Grab: 7 inputs to escape | Implemented | src/player.js |
| Gun: 110 speed, 4 gravity, 30 dmg, 1.4 life, .28 CD, 1.6 reload | Implemented, with original ammo capacity | src/reference-combat.js, src/ranged-combat.js |
| Bullet deflection: 0.3 slash/0.6 spin and 1.9 range | Implemented from supplied numbers | src/reference-combat.js |
| Gas +60, health +15, blades +2 pickup, 3.6 reach | Implemented | src/supplies.js |
| Peer-to-peer networking, precision .01, 20 Hz snapshots | Implemented; authority rules may differ | src/multiplayer.js, src/reference-combat.js |
| Remote interpolation | Implemented | src/network-interpolation.js |
| Character roster of 16, unique exact character multipliers | **Not source-exact**: report only gives multiplier keys/range and one illustrative character; original JOE Titan has 9 Aspect skills rather than that roster | src/aspects.js |
| Titan shifter transformation powers and boss phase behaviors | **Not parity-verified**: code/abilities unspecified in report | — |
| Avatar bones, detailed 3D hitbox topology, combat/physics effects and precise animation | **Partial**: JOE Titan procedural character rigs and basic effects; no extracted rig files provided | src/player.js, src/enemies.js |
| Full game modes, cooperative missions, scoring and packet authority | **Partial**: comparable functions exist, but protocols/mission state machines not fully specified | src/missions.js, src/multiplayer.js |
| One-block automatic step-up, grip/stun timings, hit authority | **Not parity-verified**: report omits enough detail for faithful reproduction | — |

Important REA report inconsistencies: bullet gravity of 4 units/s² is *not* half of player gravity 26; the 24-unit nape value is reported as **marker sprite radius** and must **not** be treated as a 24-unit combat hit radius; several Titan type examples are labeled inferred rather than measured.

The next parity pass requires the actual per-character 16-item table, the specific Titan attack timing/bone geometry, shifter ability state charts, and multiplayer packet/authority rules extracted from the user's artifacts. Until these are supplied, original game-specific mechanics remain original rather than invented as reference-accurate.
