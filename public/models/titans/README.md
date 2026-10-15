# JOE Titan character assets

The nine GLB asset paths are loaded by `src/titan-glb-models.js`.

## Replaced with user-supplied Meshy GLBs (October 2026)

- `armored_titan.glb` — user-uploaded Armored Titan mesh
- `attack_titan.glb` — user-uploaded Attack Titan mesh
- `beast_titan.glb` — user-uploaded Beast Titan mesh
- `colossal_titan.glb` — user-uploaded Colossal Titan mesh
- `female_titan.glb` — user-uploaded Female Titan mesh
- `founding_titan.glb` — user-uploaded Founding Titan mesh

These six original uploads contained geometry only: no material, texture/UV map,
skin, animation or rig. To make them visible in game, the imported GLBs now carry
approximate Titan-specific baked vertex colors and vertex normals.

`src/titan-glb-models.js` builds a normalized bone hierarchy and weights
individual GLB vertices at load time. `animateTitanGLB` moves separate
heads, torsos, shoulders/elbows, hips/knees in the existing enemy/player update
loop, including walking and attack poses. Skin weights are automatically
estimated from body position; they are **not** artist-authored skin painting.
Extreme poses may expose deformation artifacts, especially for the Founding
Titan's unusual skeleton.

## Existing placeholders, not user-uploaded

- `jaw_titan.glb`
- `cart_titan.glb`
- `war_hammer_titan.glb`

These three remain from the earlier procedural GLB build until their respective
real GLB files are provided.

The fallback low-detail voxel rig is displayed only while an asset is loading
or if loading fails. The existing gameplay, hitbox and nape positions are kept.

Performance consideration: the imported user meshes have high polygon counts
and should eventually receive decimated LOD variants for mobile devices.
