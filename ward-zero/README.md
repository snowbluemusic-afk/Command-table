# Biohazard: Last Flight v0.7 — Survivor Update

The user-supplied reference is used as the visual direction for the main character across the game.

- Brown knitted beanie with a pale patterned crown and dark hair.
- Dark hooded winter jacket and dark trousers, with a simple unbranded chest emblem.
- Updated **in-game 16×16 player sprite** with brown hat and charcoal jacket.
- New **visible pixel-art character portrait in the menu**, including the mobile landscape layout.
- Updated **animated helicopter rescue scene** with the matching character clothing and hat.
- Retains all v0.6 game mechanics: 20 procedural hospital floors, keycard mazes, zombies, adaptive original horror score, achievements and stored run records.
- Original game artwork; no photograph, third-party logo or Resident Evil assets are bundled.

## Installation and persistence

The app ID `com.wardzero.lastflight` and local save keys are kept unchanged so an in-place update retains records **if signed with the same certificate**. A debug APK with a different signing certificate may require uninstalling the old app, which erases its saved records.

## Build

GitHub Actions workflow **Build Biohazard Android APK**, branch `ward-zero-apk`. The installable artifact is `biohazard-debug-apk`. Supports offline landscape Android play.
