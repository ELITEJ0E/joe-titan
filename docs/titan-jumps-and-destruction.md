# Titan camera zoom, jumps and destructible-world first pass

## Orbit camera zoom
- Scroll the mouse wheel over the active game canvas (or while pointer lock is active) to zoom in/out in third person.
- On mobile, pinch with two fingers in the right-hand look zone; one-finger drag still orbits.
- Scout camera: 2.7–25 world units; first person is unaffected by scroll.
- Titan camera: initial distance and allowed range scale with each Titan's height. Colossal and Founding remain far enough away to avoid placing the camera inside their model.

## Nine Titan jump profiles
- Jaw: 24 m apex, 1.75× airborne travel speed and increased takeoff impulse.
- Attack: 10.5 m; Female: 11.5; Beast: 9; Cart: 8.5; Armored: 7.3; War Hammer: 7.1; Colossal: 3.2; Founding: 2.6.
- Vertical takeoff velocity is derived from `sqrt(2 * gravity * jumpHeight)` at 25 units/s². Jump arc follows world gravity, not teleports.
- Giant Titans get a smaller controlled hop, rather than the old rule banning jump for all Titans above 30 metres.

## Colossal explosion visuals
- On Colossal special: spawn a 3D mushroom-cloud blast with a rising smoke stem, cauliflower-like cap, brief heat flash, and two expanding ground shockwave rings.
- A large radial blast damages nearby buildings and sectional perimeter walls and applies the existing Titan ability cooldown.
- Timed effect meshes and their materials are removed at expiration or when changing Titan forms.

## Breakable architecture and physics
- Procedural city: removes affected `InstancedMesh` block instances (zero-scale matrix) and associated collision boxes and grapple anchors. Perimeter walls are pre-divided into smaller spans, so a localized hit breaks only sections rather than a complete 160 m wall. Structures restore on reset.
- Imported Shiganshina voxel map: clears corresponding solid voxels in the actual physics grid and masks a matching blast sphere in the world shader. Foundations below y=10 remain; destruction slots are limited to 24 to control shader cost. **This path does not yet regenerate internal voxel faces or simulate rubble**; it produces cutout openings and matching collision changes.
- Titan melee, specials, and sufficiently fast movement into structures can break nearby blocks.
- New mission / Titan session and return to the main menu restore destructible architecture.
- These are local-world changes; destructible states are not yet synchronized over multiplayer.

## Validation
- `npm run verify` and `npm run build` must pass before merge.
- In-browser GPU effects, actual demolished wall appearance and phone pinch behavior need localhost/device testing.
