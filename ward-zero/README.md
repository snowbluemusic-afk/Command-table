# Biohazard: Last Flight v1.0 — Difficulty Modes

## New difficulty modes

Choose **Easy**, **Normal** or **Hard** before starting a new 20-floor escape run. The selection stays visible on the title screen and in the HUD while playing.

| Settings | Easy | Normal | Hard |
|---|---|---|---|
| Five-second breach | +3 seconds (8 s; Code Red 6 s) | 5 s (Code Red 3 s) | -1.5 seconds (3.5 s; Code Red 1.5 s) |
| Zombie movement | 72% of Normal | 100% (v0.9) | 117% |
| Initial weapon | Handgun + 8 rounds | None | None |
| Initial supplies | 1 armour + 1 medkit | None | None |
| Enemy density and pressure | Reduced patrols, lower active cap and slower waves | Unchanged | More patrols, higher cap and faster waves |
| Supplies | More frequent and more useful | Unchanged | Reduced ammo/healing and fewer maps |

Everything remains procedurally generated; 20 floors, special objectives, keycards, valves, music, survivor artwork and rescue cinematic remain as in v0.9. There are no invulnerability cheats or skipped floors in Easy mode.

## Records, progress and achievements
- Separate **personal-best successful escape times**, completed escapes and deepest floors per difficulty.
- Records and achievements are local to the device and shared across modes; no network permission.
- v0.9 time records are mapped to **Normal** (current difficulty) and remain intact.
- A saved v0.9 run resumes as **Normal**, even if a different mode is selected on the title screen. New saves remember their selected difficulty.

## Testing
- Browser checks at 832×384: all three mode selectors, starter equipment and breach delays, survival and end-of-run records, per-mode isolation and no uncaught JavaScript errors.
- Legacy save compatibility test with a v0.9 floor-eight run and historic records: retained health, inventory, difficulty and achievements.
- Modes do not modify the character artwork, hospital tile assets, audio or existing game objectives.

Build from GitHub Actions **Build Biohazard Android APK** on `ward-zero-apk`, artifact `biohazard-debug-apk`. Android app ID remains `com.wardzero.lastflight`. In-place update preserves data only when signed with the same certificate as the installed APK.
