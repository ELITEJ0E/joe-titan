# AETHERLINE prototype — technical architecture

## Runtime

```
  Browser input / pointer lock / UI
                  |
              main.js
    game state, mission FSM, fixed timestep
         /                      \
     player.js                 world.js
    motion + rope solver    buildings + targets
    camera + animation      collisions + beacons
         \                      /
               three.js
            WebGL renderer
```

## Rendering

- **Three.js 0.186.1** (MIT), WebGL and `MeshStandardMaterial` PBR shading; ACES filmic tonemapping; PCF soft directional sun shadows; physically colored gradient sky; distance fog.
- Environment assets are **generated in JavaScript** from deterministic random seeds. Canvas procedural tiling for plaster, roofing and cobblestone. Windows are batched with InstancedMesh to avoid thousands of draw calls.
- Browser render resolution capped at device pixel ratio 1.65 for consistent visual quality/performance. No texture asset downloads.

## State & update

- `requestAnimationFrame` handles rendering and UX timing.
- Game motion advances on a fixed `1/100 s` time step, capped at six steps per frame to avoid spiral of death.
- `main.js` tracks title/menu, active, paused and finished states, checkpoint index, current and personal-best timer.
- `player.js` owns independent velocity, transform, fuel, rope states, camera orbit and animation updates.
- `collision.js` holds the shared, directly testable world collision resolver.
- `navigation.js` draws the minimap and projects the active beacon into a clamped HUD marker.
- `batching.js` merges static city geometry by material while keeping the original raycast targets.
- `enemies.js` simulates bounded roaming Riftborn, their patrol/pursuit/stagger states, weak-point hit tests and procedural giant rigs.
- `aspects.js` defines the nine original Vanguard Aspects as data and provides selection, activation, cooldown and expiry state.
- Practice mode disables course timing and beacon collection; entering the timed course starts a fresh run. Controls work with pointer lock or a focused canvas, with arrow-key/drag aiming as the fallback. Losing focus always clears held controls and pauses.

## ODM movement physics

Player is modeled as a single point-mass body with effective 1m foot offset. Motion uses semi-implicit Euler (`velocity += force * dt`, `position += velocity * dt`) with gravity and aerial drag.

Each grapple stores `{ point, length, age }`:

1. Cast an aimed ray from the view camera against world scene geometry, or choose a nearby, forward-facing assisted anchor.
2. Rope tension acts **only beyond** the allowed rope length; forces depend on extension and outward radial speed.
3. Holding Shift shortens each active rope's rest length (winch), consuming gas.
   New cables start at their actual attachment distance. When both anchors are active, the sum of cable lengths is bounded by their separation so the winch cannot create contradictory constraints.
4. Multiple position-projection iterations maintain the maximum cable distance under fast flight. Outward radial velocity is suppressed, preserving tangential velocity for pendulum swings.
5. Hooks release when LMB/RMB or Q/E is released. Both anchors operate independently.
6. Space adds camera-forward thrust while airborne and uses gas; G brakes downward velocity.
7. Active Aspects can modify aerial acceleration, boost, reel rate and armor without bypassing cable constraints. A deployed form remains visual-only in collision terms, avoiding player-size changes that would make the current capsule contacts unreliable.

This is a prototype-friendly cable solver, not physically exact mass-spring CFD or rigid-body simulation. In production, introduce Rapier 3D for robust environment contacts/rigid bodies while retaining a custom rope/ODM movement controller.

## World generation & collision

- Deterministic grid with a central open plaza, 11 × 11 footprint slots and 120 textured buildings (one central slot excluded).
- Each building includes walls, a pitched roof, trim, window instances, and optional chimneys/details.
- Grapple raycasts consider building meshes, tower meshes and fortified walls.
- Collision uses static building AABBs with projected roof landing surfaces, a simple city boundary and ground plane. It does not yet have accurate roof slope collision, stair stepping or penetration-resistant capsule sweeps.
- Six sequential 3D beacons form the traversal course. Enter a 7.4m radius to collect the active beacon.
- Every update validates player position, velocity and aim. Invalid values or leaving the playable envelope redeploy at the plaza, clear both cables and snap the camera to a safe view. F3 exposes coordinates and recovery counts for diagnosis.
- Riftborn are limited to city bounds and have three small AI states: patrol, pursue and strike. Their glowing weak point uses a camera ray and a narrow hit radius so the attack system rewards a flight path around the creature instead of broad collision damage.

## Verification

`npm run verify` runs syntax/UI-contract checks and seven behavioral regression tests using the actual player and collision modules. `/tests/browser.html` runs six deterministic gameplay checks in the real city and WebGL renderer. Manual browser checks cover the title screen, practice/timed mode switching, movement, arrow aiming, pause/resume, map toggle, camera switch and photos. These are bounded regression checks, not a claim that every possible physics interaction is bug-free.

## Roadmap to production

1. **Traversal pass:** sweep-tested capsule, precise pitched-roof collision, ceiling/corner handling, gas tuning, gamepad mapping, hook projectile animation and cable occlusion.
2. **Visual pass:** authored modular GLB structures, trim atlases, material texture sets, baked ambient occlusion, optimizable vegetation instancing, weather, environmental audio, distant impostors and shadow cascades.
3. **Character pass:** custom skeletal model and animations, IK hands along grapples, air banking, cloak cloth bones, ground parkour and camera collision sweeps.
4. **Game mechanics:** practice challenges, score combos, enemy behavior, hit detection, finite blades, boss fights and objectives.
5. **Systems:** asset streaming, saved progression, accessibility/remappable controls, controller support, performance tier presets, telemetry, optional authoritative co-op servers.

## IP and authorship

The reference game is treated as a gameplay and usability reference only. This prototype's city, character, UI, textures, sounds and code were created from scratch. Production should continue with original names, artwork and lore.
