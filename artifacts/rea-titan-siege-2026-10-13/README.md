# REA capture: Titan Siege

Target: https://attack-on-titancraft.netlify.app/
Capture date: 2026-10-13 (Asia/Kuala_Lumpur)

REA connected after the client restart and ran capture_browser_scenario in an owned, headless Chrome session.

## Observed

- The initial page loaded with HTTP 200 and displayed the Titan Siege title screen.
- Its visible menu contains Multiplayer, Campaign, Mission Select, Free Roam, and Controls.
- The page imports Three.js 0.160.0 and loads PeerJS 1.5.4.
- The capture retained 21 distinct JavaScript files from the target origin, totaling 558,256 decoded bytes.
- All 21 extracted scripts match the SHA-256 digests returned by REA.
- The startup capture recorded no page-error events.
- Requests to /api/rooms and /api/session returned HTTP 200.

## Coverage and limitations

The only scenario action was a four-second settling wait after initial navigation. Gameplay, mission completion, and multiplayer interaction were not exercised. Successful startup responses do not establish the behavior of those features.

REA returned cleanup_incomplete: browser transport and temporary-profile cleanup could not be confirmed after a 1,000 ms cleanup timeout. Its partial_observation contains completed navigation and wait steps, captured DOM/accessibility, and 140 retained events with zero dropped events. The operation did not return a successful Evidence record or Evidence ID. Do not treat this result as a fully successful canonical capture.

An earlier passive discovery attempt found no endpoint at http://127.0.0.1:9222. The controlled session did not depend on an existing browser.

## Saved files

- capture.json: complete REA error envelope and retained partial observation, including network response content.
- page.html: captured DOM.
- manifest.json: source URLs, local paths, byte counts, and SHA-256 digests.
- scripts/: 21 same-origin scripts extracted directly from retained response bytes.

The files were saved without fetching the website again. Sources were preserved for analysis; none were executed locally.
