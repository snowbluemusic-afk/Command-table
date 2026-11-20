# Ward Zero: Last Flight

Offline landscape Android game (v0.1) — original 8-bit zombie survival maze through 20 randomized hospital floors. Reach the rooftop helicopter.

## Features
- Procedurally generated connected floors with fog of war and wayfinding
- Ten HP, green herbs, handgun, ammo and optional floor maps
- Stairwell chase begins after 5 seconds on every floor
- Entrance horde doubles per floor: 1, 2, 4 ... 524,288 on floor 20 (queued and concurrency limited for mobile performance)
- Roaming zombies, AI pathfinding, shooting, touch D-pad and map
- Offline chiptune-style music and sound generated in-game (original; no external asset licences)
- Landscape fullscreen, local save progress, no Internet permission

## Build
GitHub Actions workflow `Build Ward Zero Android APK` on branch `ward-zero-apk` uploads an installable debug APK as artifact `ward-zero-debug-apk`.
To build manually: cd ward-zero && gradle assembleDebug

This game is isolated on a branch in the user's Command-table repository; `main` is unchanged.

## Licence
Original prototype code and procedural artwork/audio. Third-party Resident Evil assets are not bundled.
