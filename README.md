# Command Table Android

A custom Android Commander deck-builder and play interface with **Forge as an embedded, authoritative Magic rules engine**.

> **Development status: NOT PLAYABLE / NO VERIFIED APK.** The recovery build and Android emulator tests must pass before distribution.

## Product requirements

- Keep Command Table's own Android UI, deck import, commander selection, large cards and 1v1 / 3-player / 4-player gameplay.
- Run Forge **within the same APK** as a headless game/AI engine; do **not** launch a separate Forge app or substitute Forge's native interface.
- The complete card and rules resources must ship inside the sideload APK, without an optional download.
- Never silently substitute the training simulator during a real Forge match.
- Preserve existing user deck data when a properly signed migration path has been verified.

## Build

GitHub Actions: [Command Table Android integration build](../../actions/workflows/command-table-android.yml). The workflow compiles a pinned upstream Forge revision, bundles offline resources, compiles an APK and runs an emulator startup check. Any Android artifact before gameplay acceptance is **UNTESTED**.

The recovery source was migrated from the isolated `command-table-recovery` branch of a private workspace. Unrelated projects and their history remain private.
