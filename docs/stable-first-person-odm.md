# Stable first-person ODM camera

## Issue
The previous first-person camera smoothed the eye position and target/look point with independent interpolation factors (18/s and 19/s). High-speed swinging and rapid yaw changes created an apparent reticle drift because the target lagged behind the moving eye. The common third-person speed-FOV curve also widened first-person perspective excessively at high speed.

## New behavior
- **Direct eye tracking:** first-person camera origin is always player physics position + 1.3 m, without velocity lag, spring bob or body roll. This is camera-only; player/cable physics and collision are unchanged.
- **Exact aim:** camera forward is computed directly from player yaw/pitch each rendered frame. Grapple targeting remains based on the camera's reticle ray; it is synchronized with the visible crosshair, including after rapid turns.
- **Stable horizon:** view uses world-up (0,1,0). The character may bank/lean/spin, but first-person view does not inherit those pose rotations or hit-shake.
- **Restrained FOV:** base 72 degrees, at most +8 degrees with speed and +1.5 degrees under boost (vs up to +32 degrees in third person). FOV changes ease over time.
- **Camera mode transitions:** switching V snaps position and orientation to the new mode immediately, clears stale aim lag, and restores the correct character visibility.
- **Third person unchanged:** existing shoulder camera, cinematic bank and speed FOV retain their previous behavior.

## Validation
`npm run verify` now includes `tests/odm-first-person-camera.test.mjs`, which tests rapid translation, world-up roll suppression, instantaneous mouse aim, restrained speed FOV and integration with grapple target selection.

Actual browser GPU feel at different frame rates still requires localhost flight testing.
