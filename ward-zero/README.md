# Ward Zero v0.5 — Maze & Finale Rework

A complete playthrough revealed v0.4 could be cleared in about 2 minutes 38 seconds, with health and ammunition left over and very short routes. This release targets those observed weaknesses.

- Procedural DFS maze generation now preserves branching corridors, side rooms and dead ends; no vertical exit directly above every entrance
- 400 randomized-map QA runs: average shortest route ~89 tiles (v0.4 ~25), zero unreachable exits or pickups
- Entrance changes each floor, exit chosen from a remote connected stairwell
- The infected emerge five seconds after entering; on-floor enemies and pursuit speed have increased, while total wave size still doubles by floor
- Less frequent ammo, herbs, bombs, map guidance and armour
- Floors 4, 8, 12 and 16 require a security keycard, located elsewhere in the ward
- New animated rooftop rescue lasting ~16 seconds: rooftop pursuit, helicopter approach, boarding, close escape, city flyaway and radio messages
- v0.5 challenging-maze completion personal best is tracked separately; old v0.4 achievements and previous times are retained
- All game art and music generated within game, offline; no third-party copyrighted game assets

## Build

Branch `ward-zero-apk`; workflow `Build Ward Zero Android APK`. Build produces `ward-zero-debug-apk` artifact. To compile locally: `cd ward-zero && gradle assembleDebug`.

## Debug signing note

Android updates require the same APK signing certificate. GitHub Actions may use an ephemeral debug keystore; if installing over an older debug APK is blocked by a signing mismatch, uninstalling it will erase locally stored data. A stable Android signing key is recommended for future releases.
