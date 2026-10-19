# JOE TITAN performance investigation (October 2026)

## Confirmed code bottlenecks

1. The 9 original Meshy GLBs are medium/large assets (several 5–10 MB on disk, plus the extra 6.25 MB Armored idle GLB). **Not all nine were resident on screen at once**; the original enemy simulation has six Titans and only the Beast and Armored enemy types use these nine-player GLBs. The selected playable Titan loads one additional form. Nevertheless, high-resolution converted geometry, skinning and shadow drawing are significant CPU/GPU costs.
2. `skinnedVisual()` formerly cloned, transformed and generated **four skin weights per vertex for every Titan instance**. These expensive, identical conversions were duplicated. Skinned meshes also had `frustumCulled=false`, so off-camera high-poly models could still be submitted to the renderer and shadow passes.
3. The playable Titan controller ran GLB bone animation and up to ~50 Colossal mushroom-cloud objects inside the **240 Hz** physics solver, even on a 60 Hz display.
4. After destruction was introduced, charging against a wall could retry expensive building/instanced-geometry scans every 1/240 second if no new pieces were removed; no-impact responses did not trigger the cooldown.
5. Cinematic graphics added expensive GTAO and bloom passes, layered cloud ray samples and high-resolution shadow maps. GPU load is also a likely contributor, distinct from GLB geometry.

These are **source-level diagnoses**, not direct browser profiler measurements on your PC. F3 live counters were added below to distinguish GPU overdraw/draw-call load from CPU simulation.

## Changes implemented

- One-time original Meshy conversion per Titan type, reused with SkeletonUtils clones. Each Titan keeps independent animated bones but **shares GPU geometry and materials**. Per-instance skeleton GPU resources are disposed when switching forms.
- Enable conservative frustum culling for the converted high-detail meshes, so off-camera Titans need not be drawn.
- **AI Titan LOD:** near = full GLB and limited nearby shadows; mid-distance = simple voxel silhouette, no GLB draw; far = no drawable Titan. Enemy GLB downloads are deferred until player approaches. Far animation falls to 15 Hz, and hidden far objects to 10 Hz, while collision/AI continue at their original rate.
- Skip unnecessary hidden procedural joint interpolation when the GLB is being displayed. The player Titan's GLB, Armored run clip and Colossal explosion are rendered **once per actual screen frame**, not every substep.
- Throttle unsuccessful destructive impact probes to prevent repeated full-world instanced-mesh scans every physics tick.
- **Adaptive resolution:** every few seconds, automatically reduce the render resolution if the sustained FPS falls below 48 and restore gradually above 58, without changing gameplay physics, selected Performance/Cinematic quality or camera controls. Resolution scale is bounded 59–100%.
- **F3 FPS profiler** for both Scout and playable Titan modes. It reports estimated FPS, active resolution scaling, draw calls, triangle count, geometry/texture counts and selected visual preset.

## How to diagnose lag in your own browser

1. Run `npm run dev` and play a Scout mission in **Performance** mode. Press **F3** and note FPS and draw calls.
2. Press **K** for Cinematic and compare FPS and resolution scale. If only Cinematic is slow, GTAO/bloom/volumetric clouds/lighting are the main suspects.
3. Select **PLAY AS A TITAN**. Compare FPS near and far from AI Titans. If it falls sharply on a particular model, that GLB's triangle count, materials or animation complexity needs additional mesh/texture optimization.
4. If FPS stays low even with few triangles and draw calls, use Chrome DevTools Performance to inspect JavaScript time, forced layout, GC or slow CPU instead of assuming GPU complexity.

## Limitations

No headless WebGL GPU/real phone benchmark was run. Tests and production build can validate correctness but cannot guarantee 60/120 FPS on every laptop. Large GLBs are still included, Cinematic remains expensive (with adaptive resolution), and Shiganshina voxel-shader destruction still has a 24-site cutout cap. Future optimization can use Draco/Meshopt GLB compression, baking more distant detail, GPU timer queries and quality presets tuned to real F3 numbers from your Dell laptop.
