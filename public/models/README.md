# Medieval City 3D Asset

The game loads `/models/medieval-city.glb` and `/models/city-collision.json` when both are present.

**Source:** [Medieval Modular City Realistic – WIP](https://sketchfab.com/3d-models/medieval-modular-city-realistic-wip-49e6306b29c74c679de8cec69473535b)
**Artist:** Daniel Vicente
**License:** CC BY 4.0, per the uploaded model's metadata. Verify against the original download terms and credit the author in any distributed game.

The model and collider are not stored here yet. Get the ready-to-copy assets from the earlier `JOE_TITAN_City_Integration_Assets.zip` deliverable and copy them into this folder as:

- `medieval-city.glb` (~72 MB, optimized from the supplied GLB)
- `city-collision.json` (~7 KB, model-derived collision data)

Then commit both assets together. GitHub supports Git pushes for individual files below 100 MiB; the website uploader itself has a lower per-file limit, so use the git command line for the GLB. The old procedural city remains a fallback until both assets are available.

Verify from your deployed game's Network panel that both requests return HTTP 200; the game should show **MEDIEVAL CITY LOADED**.
