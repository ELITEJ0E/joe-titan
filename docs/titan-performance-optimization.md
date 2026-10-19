# Performance pass — Titan GLBs, physics and frame stability

## Source-level diagnosis (not a browser GPU measurement)
- The nine Titan GLBs plus a separate Armored standing asset total **about 46.5 MiB compressed on disk**. The Armored running GLB alone is ~8.74 MiB; the standing GLB is ~5.96 MiB. Compression size is not equal to GPU triangles or VRAM.
- GLB assets are loaded on demand and skinned at runtime. The first conversion formerly allocated nested JS arrays for every vertex; detailed models in view also require skeletal animation and GPU fragment shading.
- Every playable Titan physics step previously scanned every building collider at **240 Hz**. Enemy navigation also tested repeated short steering rays against all city collision AABBs.
- Colossal's first-pass mushroom cloud created **51 separate smoke meshes/materials**, plus 2 wave meshes, which significantly increased draw calls during a special.
- Cinematic mode uses GTAO, Bloom and a layered cloud shader on top of high-resolution shadows. Its cost is hardware-dependent.
- Previously damaged instanced building chunks were unnecessarily flagged for GPU reupload on later impacts.

## Implemented
1. **24-metre spatial grid** for procedural city collisions. Scout and playable Titan collision queries, short enemy navigation rays, and long grapples use conservative nearby candidates. The grid is rebuilt only when destruction changes the collision set or the map resets; damage still removes matching real building collisions.
2. **GLB conversion without per-vertex temporary arrays**. Cache behavior, rig proportions, skin weights and original texture/color data are preserved. Mesh sides default to the original GLB's authored side setting, rather than forcing every surface double-sided.
3. **Distance-based GLB LOD**. Enemy Titan high-detail models are retained nearby but switch earlier to cheaper voxel silhouettes at a distance. Player-controlled Titans always retain the detailed original GLB model.
4. **Screen-frustum culling** hides complete off-screen enemy rigs, including the Armored GLB meshes that disable native per-mesh frustum checks. AI and collision continue irrespective of visibility.
5. **One instanced smoke draw** for the 51 components of Colossal's mushroom cloud, plus two separate shockwave meshes (about three draw calls instead of 53). Timed effect removal is preserved.
6. **Cinematic automatic GTAO bypass** on coarse-pointer/mobile devices or when sustained FPS/resolution scale is inadequate. All other material/sky/bloom effects remain; Performance mode still uses direct rendering without postprocessing.
7. **Targeted instance-buffer updates** only for building chunks altered by the current hit.
8. **F3 diagnostics** now show estimated FPS, render resolution scale, triangle/draw call count, average CPU game-loop time, average CPU render-submission time, visible enemy GLB count and how many enemy rigs were frustum culled.

## How to verify the bottleneck on a real computer
- Test on the same resolution and scene; press **F3** and compare Performance vs Cinematic by pressing **K**.
- Check **draw calls / triangles** near Titans versus far from them, the number of visible enemy GLBs, and CPU GAME ms.
- If FPS is poor but CPU GAME and RENDER SUBMIT are both low, the bottleneck is **likely GPU-side**; CPU submit time is not a GPU timer, so do not interpret it as one.
- First-time downloads/conversion can still stutter. Browser devtools Performance / WebGL timing and a screenshot of F3 will help identify remaining geometry/shader GPU hotspots.

## Scope and limitations
- This pass prioritizes maintaining the existing original colored Titan GLB models, camera behavior, 240-Hz flight physics and all nine playable forms.
- Large meshes can still have high vertex counts. A future optional offline low-poly LOD tier or mesh compression is more impactful than just reducing file size if real GPU measurements show geometry-bound frames.
- No reliable real-user FPS number or browser GPU trace is available through the repository alone; results need localhost / device playtesting.
