# JOE TITAN — Skyline Trials

## Current world: Voxel Asterfell (Minecraft-inspired)

The default map is a **procedural, original voxel-style medieval fortress city** with stepped terracotta roofs, timber-framed houses, walls and open gate passages, cathedral, markets, towers and canals. The scene uses spatially grouped `THREE.InstancedMesh` blocks, small generated nearest-neighbour pixel textures, an analytic box raycast for ODM hooks and simple building collision proxies. It works without external map downloads or the old heavyweight GLB, and the player is created only after the world.

- The game starts from `src/voxel-city.js` via `createVoxelWorld(scene)`.
- The previous licensed Daniel Vicente model is preserved as `assets/legacy/medieval-city.glb` (outside Vite's `public/` folder). It is **not loaded or deployed** by the default game.
- Credits for that archived model remain required if it is redistributed or reused: Daniel Vicente, [Medieval Modular City Realistic – WIP](https://sketchfab.com/3d-models/medieval-modular-city-realistic-wip-49e6306b29c74c679de8cec69473535b), CC BY 4.0.
- `npm run verify` includes voxel world, grapple, avatar and movement regression checks.

This visual style is inspired by voxel sandbox games; it does not use official Minecraft textures, blocks, game code or assets.


An **original playable desktop-browser 3D aerial traversal prototype**, inspired by the genre of dual-grappling movement games. Original code, geometry, procedural textures, city design and character. No source code or assets copied from the reference game.

## Play now / run locally

**Recommended for development (Node 20+):**

```bash
npm install
npm run dev
```

Open the address reported by Vite (usually `http://localhost:5173`).

**Without Node or build tools:** from this directory, serve the files over HTTP:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`. The standalone development HTML imports Three.js from jsDelivr and therefore requires internet access. Do not double-click the HTML using `file://`; browsers block ES module imports from local files.

**Build for Netlify / static hosting:**

```bash
npm install
npm run build
```

Upload the `dist/` folder. Static source also works directly on a static web host when the Three.js CDN is reachable.

## Free co-op rooms

JOE TITAN includes a lightweight two-player WebRTC co-op link through PeerJS Cloud, so no account or API key is required. On the landing screen, choose **CREATE ROOM**, copy the generated room code, and have a friend paste it into **JOIN**. The room synchronizes pilot position, facing and active Vanguard Aspect. The client tries direct STUN traversal first, then a public Open Relay TURN fallback for restrictive networks; that fallback is free/public and may be rate-limited.

## Controls

| Key | Action |
| --- | --- |
| W / A / S / D | Run, steer and pump aerial swings |
| Mouse movement | Aim and orbit the third-person camera |
| Hold **LMB** / **Q** | Shoot and hold left grappling cable |
| Hold **RMB** / **E** | Shoot and hold right grappling cable |
| **Shift** | Reel in attached cables; sprint on foot |
| **Space** | Jump when grounded, gas boost in midair |
| **G** | Air brake when falling |
| **V** | Toggle first / third-person camera |
| **R** | Redeploy at central plaza |
| **H** | Open the controls / pause menu |
| **Esc** | Release mouse and pause |
| **Arrow keys** | Aim the camera (also works without mouse capture) |
| **M** | Show / hide the city minimap |
| **P** | Download a flight photo of the 3D scene |
| **F3** | Show coordinates, camera position and recovery count |
| **F** | Blade strike; hit a giant's glowing weak point |
| **1–9** then **X** | Select and activate a Vanguard Aspect |

Use the left/right anchors independently or together. Hooks raycast against real building geometry and gracefully assist toward nearby roof attachment points when aimed at open sky. Boost with gas while tethered for rapid acceleration. Gas regenerates on landing. Clear the six luminous signal beacons as quickly as possible; personal-best times are saved locally.

## Build 0.5 — JOE TITAN rebrand and mobile flight update

- **Free flight practice:** enter directly from the title screen, explore without a timer, then start the timed course from the HUD. Restarting practice preserves the practice mode.
- **Navigation:** a city minimap displays your position, heading, course route and beacon progress. The timed course also has a distance marker that follows the next beacon or points toward it at the screen edge.
- **Grapple feedback:** the reticle lights up when an anchor is available and reports its range. New cables preserve your position, and dual winching stops before the cable lengths become impossible for the two anchors.
- **Mouse capture fallback:** when a browser refuses pointer lock, keyboard controls continue working. Drag on the scene or use arrow keys to aim; Q/E operate the hooks. Escape/H pauses in either mode.
- **Flight photos:** press P or use Save Flight Photo in the pause menu to download the scene as a PNG (without HUD overlays).
- **Stability:** fixed the undefined movement heading that produced invalid coordinates and a blank scene. Added finite-coordinate and world-bound recovery, immediate camera reset, overhead collision checks, and focus-loss pausing.
- **Rendering:** static city geometry is batched by material to reduce draw calls. Original collision and grapple geometry is retained for gameplay queries.

## Build 0.6 — Asterfell city rebuild

- **Layered medieval city:** Asterfell now has a landmark cathedral with bell tower and stained glass, an old-city defensive ring, gatehouses, full perimeter ramparts, crenellations, watchtowers and banners.
- **Detailed streets:** procedural houses use terracotta tiled roofs, dormers, chimneys, timber framing, balconies, shutters, shop canopies and warm windows. A relocated civic square adds market stalls and a monument landing point.
- **Canal infrastructure:** a reflective canal crosses the southern wards with stone quays, railings and seven traversable bridges. Entering the water now applies drag and buoyancy while bridge decks keep physical collision.
- **Lighting and atmosphere:** warm low-angle sunlight, cool sky fill, sunset haze, window and cathedral glow, moving chimney smoke, clouds, layered mountains and snowcaps give the city depth from street and aerial views.
- **Navigation and collision:** the tactical map now distinguishes water, both defensive rings, tall landmarks and ordinary rooftops. New civic structures, towers, ramparts and bridges participate in landing and wall collision.

## Verification

```bash
npm run verify
npm run build
```

The verification command checks module syntax, HUD IDs and actual movement/collision behavior, including invalid-coordinate recovery. For the browser/GPU checks, start the development server, open `http://localhost:5173/tests/browser.html` and click **Run gameplay checks**. It runs walking, jumping/boosting, dual grappling, rooftop landings, camera recovery and rendered-pixel checks against the real procedural city. The test page is a development-only file and is not included in the production build.

## Combat expansion

Six original **Riftborn** giants roam the city as Wanderers, Runners and Bruisers. They patrol their districts, notice nearby pilots, pursue, strike, stagger, and can be defeated by aiming a blade strike at their glowing weak point. The tactical map marks their positions and shows active pursuers in bright red.

Nine original, temporary **Vanguard Aspects** are available with `1–9`, then `X`: Skyrend, Bastion, Cinder, Tempest, Warden, Echo, Breaker, Harrier and Sovereign. Their gameplay effects cover aerial burst, armor, pulse damage, gas recovery, health recovery, decoy distraction, kinetic impact, cable mastery and enemy suppression. They are original JOE TITAN forms rather than recreations of characters or forms from another series.

## What's included

- Original procedural 3D city: more than 100 detailed buildings, a cathedral, market square, canal and bridges, two defensive wall systems, thousands of instanced windows, street lighting, trees, guard towers and a layered mountain horizon.
- Fully modeled stylized protagonist constructed from primitives (not a rigged external asset), with dynamic gait, airborne pose, backpack and twin wrist grapplers.
- Third-person spring camera with pointer lock, pitch/yaw, wall avoidance, cinematic speed FOV; optional first-person mode.
- Dual ropes using tension spring impulses and semi-implicit fixed-time integration, winch reel-in, tether velocity projection, steering, gravity, gas propulsion and braking.
- Rooftop / wall collision constraints, 6-marker time-trial loop, gas/altitude/speed HUD, start/pause/finish menus, personal-best persistence, synthetic feedback sound.

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for the system diagram, implementation details, constraints, and expansion roadmap.

## Status and limitations

This is **playable prototype v0.6**, not a complete game. It includes procedural roaming enemies, a compact combat loop, cross-network two-player WebRTC rooms and responsive landscape mobile controls with dual virtual joysticks. It does not yet have authored skeletal character animation, mission scripting, narrative, navigation meshes, soundtrack or advanced postprocessing. Rope dynamics are a compact custom physics solver rather than Rapier. Roof collision uses simplified landing planes, while all major landmarks, walls, towers and bridges have collision volumes. Best experienced in a hardware-accelerated Chromium/Firefox/Edge browser.

No affiliation with Attack on Titan, the reference game's developers, publishers, or any other game IP.
