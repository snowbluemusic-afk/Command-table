# Ward Zero v0.4 — Integrated Hospital & Replay Update

The approved survival-horror direction is rendered using actual world-space game tiles. Stretched room photographs have been removed.

- Department-specific clinical floor textures, procedural rooms, curtains, lighting, signs and bloodstains
- Collidable multi-tile hospital beds, nurses' desks, surgical tables and CT scanners; player and infected navigate around them
- Corrected pickup handling: items now trigger reliably; full-health herbs store as med kits; inventory overflow grants an explicit fallback benefit
- MED touch button and H keyboard hotkey to consume a stored medical kit
- 11.5-second animated rooftop helicopter rescue cutscene with rotor, spotlights and radio; skip available
- 12 persistent achievements, including Pacifist (win without killing a zombie), Untouched, Code Blue and Last Flight
- Local records for best successful escape time, runs, escapes, deepest floor, per-floor splits and achievements
- In-game run clock and personal-best time

**Testing:** 300 generated floors checked for reachable exits and items; browser smoke tests passed for pickup types, cinema flow, records and achievements.

**Build:** GitHub Actions / Build Ward Zero Android APK on branch `ward-zero-apk`; download artifact `ward-zero-debug-apk`. Offline on Android 8+ in landscape.

**Debug APK signing:** GitHub Actions runners may generate different debug signing keys across builds. If Android refuses to install v0.4 over v0.3, uninstall the earlier build first. Uninstalling clears locally stored progress. A stable signing keystore is recommended for future releases.

Original procedural artwork and synthesised audio; no copyrighted Resident Evil game assets.
