# Shiganshina graphics overhaul (Minecraft-shader inspired)

The active converted **Shiganshina Minecraft world** now has an original voxel rendering pipeline, without downloading or copying Minecraft shader-pack code, textures, or assets.

## New visuals

- **Procedural 256×128 atlas:** all 32 original block material slots gain hand-coded 32×32 pixel details. Brick/stone courses, staggered red roof shingles, darker wooden beams, foliage noise, reflective-looking blue windowpanes, rippled water details, and illuminated lantern blocks.
- **Sun + sky:** warm late-afternoon sun, cool directional skylight, a camera-centered gradient sky dome with a small warm sun halo and gently drifting clouds.
- **Approximate block ambient occlusion:** block-edge and seam darkening in the map shader, with face-dependent lighting. This is not screen-space AO and avoids an extra full-screen depth pass.
- **Atmosphere:** distance fog, slightly stronger haze at street level, subtle drifting procedural cloud shade on sunny surfaces.
- **Water/glass:** inexpensive view-dependent light variation; no performance-heavy screen-space reflections.
- **Cinematic bloom:** optional low-strength UnrealBloomPass followed by OutputPass.
- **User interface:** quality buttons on launch menu and HUD; `K` toggles during gameplay. Preference saved locally.

## Graphics profiles

| Setting | Performance (default) | Cinematic |
|---|---|---|
| Pixel ratio ceiling | 1.12 | 1.35 |
| Fog start/end (world units) | 112 / 332 | 78 / 285 |
| Cloud shadow | subtle | stronger |
| Block edge shading | subtle | stronger |
| Sun shadow-map resolution | 1024 | 2048 |
| Bloom | OFF | ON (low-strength, reduced resolution) |
| Exposure | 1.15 | 1.07 |
| Screen grain/vignette | faint | subtle |

Controls: click **Graphics: Performance/Cinematic** on the launch menu, click **Visuals** in the HUD, or press `K` while in the game. Your choice is saved as `joe-titan-graphics` in localStorage.

## Implementation

- `src/shiganshina-visuals.js` — new procedural pixel atlas, custom fragment/sky shader, fog, lighting and uniforms
- `src/graphics-quality.js` — renderer pixel ratio, optional postprocessing composer and bloom, resizing and graphics presets
- `src/minecraft-world.js` — connects the new material and sky to the actual region-file-derived geometry and continues updating shader time
- `src/voxel-city.js` — equivalent sun/fog/quality adaptation in the fallback city
- `src/main.js`, `index.html`, `src/style.css` — UI controls and rendering selection
- `tests/graphics-quality.test.mjs` — shader assembly / mode-switch regression tests

## Performance and limitations

The Shiganshina geometry and .jtvx compression format are unchanged. The new map shader replaces the old fragment shader using the same chunk meshes and existing world/collision/grapple systems. **No new scene collision meshes are added.**

This is a stylized interpretation inspired by Minecraft shader packs, **not** a port of Complementary or BSL. The map still lacks physically accurate global illumination, actual volumetric ray marching, ray tracing, SSR and true Minecraft lightmaps. The custom map shader uses directional face lighting plus inexpensive fake occlusion; real sun shadow maps affect materials that participate in Three.js shadow rendering but not the custom voxel map shader itself.

The automated tests verify JavaScript integration and materials/uniforms but **are not an in-browser GPU shader compilation or FPS benchmark**. Test on the actual Vercel deployment with F3 draw-call diagnostics, including mid-flight switches between both modes. Reduce to Performance if Cinematic bloom hurts frame rate.
