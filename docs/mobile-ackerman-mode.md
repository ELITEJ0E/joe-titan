# Mobile flight interface and Ackerman Mode

## Mobile layout
- In gameplay on small/coarse-pointer screens the top-left JOE TITAN branding disappears, while current objective and co-op information stay visible in much smaller translucent panels.
- The traversal course checkpoint and elapsed timer are compact and semi-transparent on the left side. The minimap shrinks and the bottom HUD is condensed to health, gas and special-ability status.
- The previous right-side virtual look joystick has been replaced with a transparent, full right-half drag-to-look zone. It supports pointer capture and simultaneous movement thumbstick/action-button input.
- The on-screen pause control and Android/browser Back gesture pause flight. Graphics Performance/Cinematic toggle is now accessible from the pause menu; its always-present upper-right HUD toggle was removed. The main-menu graphics setting and desktop K shortcut remain.
- Mobile button: Left and Right grapples auto reel and trigger gas thrust while attached and held. The automatic gas boost is weaker and consumes 60% of ordinary boost fuel per second. PC still uses Shift for fast reel and Space for gas boost.
- Portrait layout remains playable with tightened buttons, not blocked by a 'rotate device' cover. Layout uses CSS safe-area insets for notched devices.

## Ackerman Mode
- The old nine Vanguard Aspects were replaced with ONE toggle, Ackerman Mode, on keyboard X and the touch ACKERMAN button.
- Duration: 7 seconds of real gameplay time. Recharge: 26 seconds of real gameplay time, starting when activated.
- Player: 1.52x max running/air control speed, 1.3x gas boost, 1.45x grapple reel force; 34% ordinary gravity.
- Titans, boulders/projectiles in the enemy manager and environment animations run at 27% of normal game time. Pilot ODM physics remains fixed step and entirely responsive. Own pistol projectiles remain fast for the player's benefit.
- Time-trial elapsed duration and seven-second ability duration are NOT slowed, preventing infinite slow-motion and record-cheating.
- UI labels and ability overlay clearly show cooldown and remaining active seconds. It is a local bullet-time effect and not a server-authoritative multiplayer time-scale modifier.

## Known caveats and validation
- Actual physical phone Back key delivery depends on browser/platform. The in-game pause button is always a fallback.
- Native mobile browser touch gestures and safe-area scaling need device review in landscape and portrait.
- The camera drag is event-based and independent of the 240Hz physics loop. A second touch can move with the left stick while the first pans on the right.
- Real WebGL GPU, orientation, visibility and multiplayer compatibility need localhost/device testing.
- Automated CI checks validate JavaScript, physics, input policies and markup, not actual mobile touch hardware.