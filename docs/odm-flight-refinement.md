# JOE Titan ODM Flight Refinement — 14 October 2026

## Scope and evidence

The goal was to make JOE Titan's independent left/right grappling, aerial locomotion, camera, combat and visual feedback feel closer to fast, fluid ODM gameplay as requested.

Reference URL: https://attack-on-titancraft.netlify.app/

**Important evidence boundary:** This ChatGPT environment did not have access to the REA MCP tool installation in the user's Claude CLI. No verified REA extraction or recorded test of the target site was supplied in the conversation. Direct public page inspection did not yield a playable capture or inspectable JS bundle. The improvements below are independent design and engineering changes based on JOE Titan's own code, not measured/identical physics constants from the reference.

## Implemented

- **Crosshair accuracy:** `src/odm-targeting.js` always prefers valid direct raycast hits. It tries a narrow left/right offset for the other tether instead of blindly replacing the hit with a suggested roof. Assist is only used when appropriate and rejects walls occluding a proposed high roof.
- **Input precision:** mouse left/right and Q/E have independent hold/release state. Keeping a trigger down retries missed hooks at 100 ms intervals. Mobile hook buttons acquire and release normally.
- **Momentum-sensitive reel:** reel-in (Shift) accelerates gradually at speed. Pull acceleration is normalized across one/two cables, with a physically constrained maximum tether length. Flight gas boost blends view direction with existing momentum.
- **Stable two-cable swing:** symmetric iterative unilateral rope constraints remain active; tangential velocity persists. Tethered ground contact doesn't overwrite movement with walking speeds.
- **Camera:** responsive damping around walls and obstacles, smooth look-at tracking, slight roll based on player bank and velocity-sensitive FOV. No camera teleport for typical wall-obstruction changes.
- **Combat:** weak-point slash bonus increases with the player's approach speed and facing, and actual blade strikes require proximity (9.5 m) rather than unlimited-distance sight lines.
- **Performance:** player physics remains 100 Hz, enemy AI/pose sampling is 50 Hz, multiplayer snapshots 20 Hz. Two subtle speed streak lines are rendered only at high airborne velocities; no additional textures.
- **UI:** hook reticle shows when the free side can anchor and its distance.

## Existing worlds

- Original generated voxel city works without external files.
- A Minecraft Shiganshina world loader exists in `src/minecraft-world.js`. The imported authored map asset `public/maps/shiganshina.jtvx` must be present and have reuse permission; otherwise the game intentionally loads the generated world. ODM refinements work with either world.

## Testing

GitHub Actions runs `npm run verify` and `npm run build`. Added `tests/odm-targeting.test.mjs` for accurate direct hits, left/right separation, occlusion and invalid target rejection; added close-range combat regression. Manual browser verification remains needed for visual smoothness, input device feel, physics edge cases and FPS.

## Next comparison step

For actual parity with Attack on Titancraft, capture a REA report with evidence IDs, control mappings, playback of representative swing manoeuvres, camera measurements and observed timings. Then tune the JOE Titan constants under real gameplay tests. Do not assume REA can reveal hidden intent solely from minified JS; respect external content licenses.
