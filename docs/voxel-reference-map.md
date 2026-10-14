# Reference-inspired medieval voxel world

## Visual direction

The world is an **original procedural interpretation** of the three Varuna-style images supplied by the player. These images present different scenes, not a single measured schematic. We blend their distinctive features into a coherent ODM traversal map:

| Reference | In-game interpretation | Approximate coordinates |
|---|---|---|
| 1 — Monumental sunlit castle | Multi-tower pale-stone citadel, crenellations, golden accents, red flags, elevated gallery | (-98, -90) |
| 2 — Lush coastal fantasy settlement | Bright turquoise bay, timber quays, sailing ships, elevated castle skyline | southeastern approach / z>150 |
| 3 — Dense red-roof valley town | Close-spaced timber houses, dormers, cobble lanes, cathedral, warm haze, rocky mountain walls | central city, mountain backdrop beyond west/north walls |

### Implemented details
- **Voxel materials**: generated 64×64 nearest-filter tile / masonry / wood / leaf patterns; no external Minecraft textures
- **Lighting**: sunset-sky gradient, warm directional sun, ambient fill, distance fog
- **Architecture**: stepped roofs, cornices, roof ridges, dormers, shutters, balconies, market stalls, nave buttresses and rose window
- **Landscape**: distant multi-column grey rocky peaks with moss and snowy caps, fir tree clusters, outer blue bay
- **Castle & water**: banners, arch-supported skybridge, reinforced battlements, quay and original sailing ships
- **Performance**: blocks grouped by material and 150-metre chunks in `THREE.InstancedMesh`; mountains are decorative and have no physics bodies. Detailed hitboxes remain simple near buildings.
- **Game compatibility**: existing beacons, grapple hooks, movement, missions and player spawn remain functional.

### Important limitations

A render **cannot recover the hidden back faces, exact block coordinates, interiors or original WorldEdit schematic**. This project is therefore a faithful *style- and composition-inspired rebuild*, **not a block-for-block copy of a Varuna map**. To match a precise existing build, obtain the original Minecraft world or schematic from its creator under appropriate permissions and provide it for conversion.

### Developer notes

Change `src/voxel-city.js` for streets and detailed houses; `src/voxel-landmarks.js` for skyline landmarks and out-of-bounds decor. `npm run verify` checks geometry limits, landmarks, player visibility and grappling. Use the F3 debug overlay in-game for draw-call counts. The 72 MB retired GLB remains archived under `assets/legacy/` but is not served in production.
