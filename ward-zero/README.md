# BIOHAZARD — Last Flight v0.9 · Hospital Emergency Variety

## Controls and map pickup
- Removed the touch Map button, full-screen minimap and M-key map toggle. The control strip has only MED, BOMB and FIRE next to the movement joystick.
- The floor-plan pickup **still reveals a dotted route** in the live world. It guides to an outstanding floor objective first (keycard, fuse or purge valve), then to the stairwell when the objective is complete.
- Runs, best times, 12 achievements, original horror music, beanie-wearing survivor and rooftop rescue remain intact.

## New floor variety
- **Standard escape:** reach the far stairwell without an extra lock.
- **Security lockdown:** find a physical keycard before the stairwell opens, on every fourth floor.
- **Power outage:** hospital lighting and vision radius are reduced until an emergency fuse is recovered.
- **Quarantine purge:** find and open two separate purge valves to release a sealed airlock.
- **Code Red surge:** breach starts after **3 seconds**, with more aggressive waves and a higher zombie cap.
- Objectives rotate between runs, and non-keycard floor types avoid repeating the previous type where possible. All variants preserve the ability to complete the Pacifist achievement.
- A live, compact HUD objective states what you must do, including valve progress and emergency status.

## Validation
- Browser smoke tests: no JavaScript exceptions at 832×384, and no Map button.
- 60 randomized floor checks across all 20 floors: exits and required pickups reachable.
- Locked exits confirmed to remain closed until their objective is completed for keycards, fuses and valves; then the player can advance.
- Map pickup retained and routes toward the nearest pending objective. Original gameplay remains offline.

## Android build
GitHub branch `ward-zero-apk`, workflow **Build Biohazard Android APK**, artifact `biohazard-debug-apk`. Package ID stays `com.wardzero.lastflight` to preserve previous records where Android signing permits an in-place update.

Biohazard is associated with the Resident Evil brand; commercial distribution should use distinctive branding.
