# Minecraft Attack on Titan world-map candidates (14 October 2026)

Research for replacing the homegrown voxel map with a much more detailed authored Minecraft world.

## Shortlist

### 1. Vivinator — Shiganshina | Attack on Titan (preferred candidate)

- Page: https://www.planetminecraft.com/project/shiganshina/
- Publicly downloadable Minecraft world. Marked 100% complete and updated January 16, 2026.
- Quarter-scale city; approx. 50 houses, 30 towers, shops, moat, castle, colossal titan.
- Benefits for JOE Titan: contained spatial footprint, dense facades, rooftops, recognisable AoT streets, potentially manageable area conversion.
- **Reuse rights:** publisher provides a download for Minecraft use, but permission to convert and redistribute in an independently hosted public WebGL game was not confirmed on the listing. Ask creator before publishing model or textures. The Colossal Titan sculpture is credited to Nav9 separately.
- Status: awaiting map ZIP and permission to use it in JOE Titan.

### 2. Daniele1912 — Attack on Titan: Shiganshina MAP!

- Page: https://www.planetminecraft.com/project/attack-on-titan-shiganshina-map/
- Listed 100% complete; likely detailed city; site indicates DOWNLOAD.
- **Reuse rights:** no verified grant for third-party WebGL-game redistribution. Ask creator.
- Status: secondary candidate.

### 3. Archito — PARADIS | Shingeki no kyojin | AOT

- Page: https://www.planetminecraft.com/project/paradis-attack-on-titan/
- Free demo: Maria, Rose and Sina walls; Shiganshina, Trost, castle and other landmarks.
- **Explicit restrictions:** publisher reserves rights; personal use and own servers permitted, but prohibits certain commercial reuse and redistribution. Credit required for public projects. Not automatically reusable in JOE Titan's hosted distribution. Request a suitable license.
- Status: visually impressive, but larger than needed and reuse not cleared.

### 4. kriika — Shiganshina District and terrain outside the walls

- Page: https://www.planetminecraft.com/project/shiganshina-district-and-terrain-outside-the-walls/
- Explicitly allows modpacks and servers with author credit; recommends Excalibur texture pack (which has separate rights).
- Creator calls it a minimalistic beta. Not clearly licensed for conversion into a downloadable/public browser game.
- Status: permission more promising, but less detailed.

## Conversion plan (once usage rights and world ZIP are provided)

1. Inspect ZIP world format: Java region files `region/*.mca`, NBT data and world version; extract selected city area only. Ignore entities, inventories and out-of-bounds chunks.
2. Convert to **chunked visible-face meshing**, with greedy merges on full opaque cubes and selectively tessellated stairs/slabs/fences. Cull all internal opaque faces. Never create a Three.js mesh per block.
3. Use owned/licensed voxel textures in a single texture atlas; do not assume Minecraft base textures or third-party packs may be republished.
4. Divide world into distance-cullable sectors; simplify distant facades and roofs to low-detail proxies.
5. Generate simplified rooftop / wall / floor collision proxies, independent grapple targeting boxes or BVH, and supported spawnpoints/missions.
6. Measure WebGL geometry counts, draw calls, VRAM and sustained flight FPS before enabling as the default map. Keep `createVoxelWorld(scene)` as a low-end fallback.
7. Document credits/permissions in the shipped game.

**The external map has not been downloaded, converted, committed, or deployed.** This research does not itself convey third-party content licenses.

## Floating beam fix

The giant floating eaves pictured in the game were caused by a swapped `w`/`d` argument in the wall crenellation loop. Fixed in `src/voxel-city.js`, commit 966e82ab; see `tests/voxel-city.test.mjs` for a geometry regression test.
