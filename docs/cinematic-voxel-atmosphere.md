# Cinematic voxel atmosphere (original Three.js shaders)

This pass keeps the sharp REA-inspired block identity but gives JOE TITAN a more unified environment. Visual references studied: Complementary Reimagined (https://www.complementary.dev/shaders-v4/), Photon (https://github.com/sixthsurge/photon), and BSL (https://www.curseforge.com/minecraft/shaders/bsl-shaders). No third-party shader source, Minecraft textures, or pack assets were imported. Iris/OptiFine shaderpacks are not drop-in Three.js materials.

## Implemented
- Shared `src/cinematic-atmosphere.js` sky/sun/fog color model; original layered procedural clouds, horizon scattering and sun disc, using a common sun direction and consistent palette.
- Shiganshina imported-world voxel shader retains greyscale baked sunlight, custom aAO corner occlusion, atlas coordinates and sector frustum culling. The visual daylight tint and subtle wetness highlight are combined with height-aware, forward-scattered atmospheric fog.
- Imported Shiganshina water faces (tile type 17) are split into transparent sector meshes. They use the same atlas and lighting uniforms, subtle vertex displacement, Fresnel sky tint and restrained sun glints. It is intentionally **not** SSR, ray-traced water or physically accurate underwater depth-fading.
- Procedural fallback city uses the same sky model and fog/sun state, translucent physically lit canal material, PCF shadows and original block textures.
- Dynamic Titans and pilot use physically based roughness/metalness via MeshStandardMaterial; world blocks retain less expensive baked-lit and Lambert methods.
- Quality presets continue supporting performance (without expensive postprocessing) and cinematic (existing optional bloom), with 1024/2048 dynamic shadow-map tiers.
- New atlas textures have nearest min/mag filtering and generated mipmaps disabled to retain the pixel-sharp target.
- The existing less-hazy, closer title camera remains; its separate clarity fog override is preserved.
- `world.setAtmosphere({timeOfDay,stormAmount,steamAmount,weather})` allows later day/night, rain, combat steam and mission state changes without recompiling shader source. The default remains readable clear daylight: these events are not automatically triggered by game missions yet.
- Lighting update frequency is limited to at most four times per second, while animated sky clouds and water waves use frame time. No per-frame material creation.
- Tests confirm color coherence, shared uniforms, quality changes, no geometry duplication, transparency, performance-mode fog and atlas sharpness.

## Scope limits
This is an original approximation of realistic Minecraft-shader atmospheric *feel*, not Complementary, Photon or BSL source/feature parity. A convincing environment needs in-browser GPU screenshots at different times, hardware frame-rate measurements and visual tuning on the actual installed Shiganshina JTVX map. Real volumetric scattering, screen-space reflections, complex cloud ray-marching, cascaded shadows and per-pixel scene-depth water refraction are intentionally not included due to ODM flight performance.
