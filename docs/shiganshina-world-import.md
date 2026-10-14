# Authentic Shiganshina Minecraft world integration

JOE Titan supports the user's Minecraft Java 1.21.4 save, **Shiganshina 1:4 Scale** (creator: Vivinator), converted into an optimized WebGL asset.

## Status

The renderer and map loader are committed:
- `src/minecraft-world.js`: compressed voxel/mesh decoding; block-based cable raycasting; collision and mission beacons
- `src/main.js`: attempts Shiganshina map first, then automatically falls back to JOE Titan's original procedural voxel city

**The third-party map asset is deliberately not committed** because the archive doesn't establish permission to redistribute the converted world as part of a public web game. Obtain the creator's explicit permission to convert and host its geometry before publishing.

## Enable the downloaded map after permissions are cleared

Place the provided 1.08 MB file **`shiganshina.jtvx`** at:

```text
public/
  maps/
    shiganshina.jtvx
```

Commit to `main` through GitHub's file uploader (well below 25 MB) or Git CLI. Vercel will deploy the asset automatically.

After deployment, open the browser developer console and confirm `[JOE TITAN] Minecraft Shiganshina world loaded`. If the map isn't installed or decoding fails, the app will log a fallback and use its generated voxel world.

## Conversion and performance details

- Source: Minecraft Java Anvil `.mca` region chunks and 1.21.4 block-state palettes
- Extracted area: approximately 304 × 304 × 88 blocks surrounding Shiganshina
- 317k authored non-air blocks; 271,315 visible greedy-merged surface quads
- Compressed asset: around 1.08 MB; no original Mojang textures, audio, or models
- Original procedurally generated pixel-art texture atlas grouped by 32 material families
- About 342 independent frustum-cullable mesh sectors
- Voxel lookup used directly for exact-block hook targeting and collision; no triangle collision search
- Roof stairs, slabs, fences, panes, and doors are approximated as full cubes in this first pass. Future conversion passes can add shape-specific meshes.

### Existing controls and map fallback

ODM dual hooks, boost, camera, combat, multiplayer and six mission beacons remain in the app. The current procedural map remains available if the external asset isn't present.

### Legal

Downloaded Minecraft worlds are not automatically licensed for reuse in a public game. Credit the creator and obtain confirmation of redistribution and transformation rights for hosted distribution.
