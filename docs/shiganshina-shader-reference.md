# Shiganshina Shader Reference — Material & Lighting Pass

This update uses the **real 304×88×304 Minecraft JTVX voxel asset** as the layout reference. The illustrative 16:9 raycast preview was rendered locally from those voxels (it is **not** a browser screenshot or a source image from a third-party Minecraft shader pack).

## Art direction — shader-inspired and geometrically faithful

The desired look is the cinematic, readable style associated with sophisticated Minecraft shader packs, while preserving every imported block, rooftop, district wall, bridge, and grappleable structure.

- **Terracotta roofs:** warmer sunward facets, darker mortar, staggered brick shingle relief and highlights
- **Stone fortifications and towers:** readable grey-beige masonry, pale mineral flecks, darker joints, real neighboring block contact shadows
- **Plaster buildings:** light warm cream in sunlight and cooler gray-blue in shade
- **Timber framing:** stronger dark grain, warmer edge glints
- **Moss/foliage:** green mineral stains, irregular leaf highlights
- **Water/glass:** blue-cyan color shift and cheap view-dependent highlights
- **Lanterns:** subtle warm emissive color
- **Sky:** cool upper atmosphere with warm low sun and sparse procedural clouds
- **Fog:** bluish atmospheric perspective that does not erase the outer Shiganshina walls

No copyrighted shader-pack source code, third-party shader assets, or Minecraft texture pack files are included.

## Implementation

- `src/voxel-illumination.js`: new imported-voxel light-baking helpers
  - checks sunlight visibility for each sun-facing greedy quad; foliage transmits partial daylight
  - computes a four-corner ambient occlusion factor using adjacent voxel occupancy
  - both computed **once at map load**, with no per-frame ray tracing
- `src/minecraft-world.js`: adds compact `aShadow` and `aAO` attributes to each greedy-mesh sector; **collision and grappling unchanged**
- `src/shiganshina-visuals.js`: consumes baked light visibility/AO and tunes warm sun, cool skylight, roof tint, fog and original procedural textures
- `tests/shiganshina-light-baking.test.mjs`: unit tests for occluders, ambient occlusion, profiles and shader inputs

## Performance

For the 271,315-quad imported world, illumination is an up-front mesh-building cost. Each quad receives one sun sample (if sun-facing) and four corner probes. The custom shader uses one texture lookup and interpolation of the prebaked factors. The extra attributes do increase GPU vertex-buffer memory. High-quality shadow-map/bloom options remain configurable by the existing `K` toggle; **Performance** stays the default.

This shader imitates visual ideas from modern Minecraft shading, not ray-traced GI, PBR normal maps or screen-space reflections. Single-center samples on long greedy faces can produce coarse shadow boundaries; this is an intentional frame-rate/readability compromise.

## How to test

```bash
git pull origin main
npm install
npm run verify
npm run dev
```

Start **Free Flight** in Shiganshina and inspect a facade half under sunlight, an alley, roof intersections and the outer walls. Press `K` to compare the two quality profiles; F3 shows render diagnostics. If the city feels too dark or a specific facade has too harsh a baked shadow, share a localhost screenshot for targeted tuning.
