# REA follow-up implementation and evidence boundaries — 2026-10-14

Source: user's static REA analysis of 21 loaded JavaScript files; source maps unavailable. Static observations do not establish runtime timing or network authority.

## Added in this pass
- Close-range blade arcs select a rear-facing nape within 9.5 units and a narrow aim cone, rejecting blocking voxel geometry. The camera does not snap and existing nape armor/health rules remain in charge.
- Grab escape needs seven fresh input presses; 45 ms anti-repeat and 1.55 s combo timeout are original JOE TITAN tuning choices, not observed reference constants.
- Titan navigation samples voxel line-of-sight headings; runners zigzag on timed intervals and nearby Titans separate. This is reactive steering, not global pathfinding.
- Pooled short-lived slash/spin cut effects, landing compression, braking stance, grabbed head/arms and cosmetic hit reactions. Flight physics remains unchanged.
- Integration tests added for arcs, obstruction, grab timing, steering, effects and player poses.

## Already present before this pass
- 240 Hz physics, ODM gas/dual hooks/cable constraints, damage protection, voxel terrain collision, timed slash/spin, Titan attack state phases and limb/nape rules.
- Minecraft-style rigs, sky/voxel shaders, basic supplies, several missions, peer-to-peer co-op, touch controls.

## Still unresolved / not implemented
- Exact acceleration and turn curves, hit animation frame data, complete camera target lock and exact timing values (requires runtime REA observations).
- Full civilian rescue AI and pathing, interactive depots, destructible wall propagation, weighted Titan wave spawning, difficulty scaling, richer checkpoint and mission transitions.
- Full Titan attack kits (bite/throw/crush/stomp/leap), boss phases and steam volumes, precise per-type hitboxes, and global urban pathfinding.
- Detailed particle pools, hit-stop and vignette, full collapse/dissolve, procedural audio orchestration, comprehensive day/night and water depth effects.
- Full authoritative multiplayer ownership and rollback, wire packet meanings, correction thresholds, host migration; exact gamepad/touch deadzones and accessibility scaling.

## Measurements needed for exact behavior
Runtime captures of player velocities, camera FOV, contact normals, hook states, attack/hit frames, Titan navigation and damage, and 2-client network packet timings during controlled experiments.

No reference game code or assets were imported.