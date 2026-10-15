# BSL / Photon / Complementary-inspired cinematic shader pass

This update is an original Three.js implementation, not an import of Minecraft shaderpack binaries, GLSL, assets or source. Minecraft Iris/OptiFine packs do not directly work with Three.js.

## Researched upstream references
- Complementary Unbound official: https://www.complementary.dev/shaders/ — realistic atmosphere while preserving voxel identity.
- BSL Shaders official CurseForge: https://www.curseforge.com/minecraft/shaders/bsl-shaders — shadows, AO, material detail and bloom. BSL licensing restricts redistributing modified shaderpack code.
- Photon official repository: https://github.com/sixthsurge/photon — soft shadows, GTAO, cloud layers and water.
- Sildur official: https://sildurs-shaders.github.io/ — performance-tiered illumination.
- Three.js GTAOPass documentation: https://threejs.org/docs/pages/GTAOPass.html

## Implemented
1. Surface relief: original 32-tile packed normal/roughness textures. Imported Shiganshina voxel faces sample tangent-space normals and per-category material roughness; specular brightness changes when wet. Procedural fallback uses MeshStandardMaterial with independent generated normal textures for stone, wood and roofs.
2. Deeper sky: Cinematic samples seven points inside an elevated cloud shell with vertical density and sunlight coloration, plus a cirrus layer. Performance keeps a simpler cloud pattern.
3. Cinematic contact shadows: optional Three.js GTAOPass in the existing EffectComposer before restrained bloom and OutputPass, rendered at reduced resolution. Performance keeps direct rendering without GTAO.
4. Water: geometric ripples now perturb water reflection normals; opacity and reflection strength vary with viewing angle.
5. Quality presets independently control normals, sky ray samples, AO and exposure. Nearest filtering retains pixel edges. ODM physics and network gameplay are unchanged.

## Limitations / validation
- This is original stylized volumetric lighting, not ray-traced GI, true volumetric scattering, physically correct water refraction, or shaderpack parity.
- Node automated tests do not compile WebGL fragment shaders; GPU rendering must be reviewed on localhost.
- Cinematic runs an extra GTAO pass and more complex sky fragments, potentially reducing FPS. Use the K key to switch back to Performance.
- Compare before/after screenshots and GPU frame times in real ODM flight. Shiganshina imported map is optional; the fallback city also uses new physically shaded materials.