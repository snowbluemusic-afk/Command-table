#!/usr/bin/env bash
set -euo pipefail

mkdir -p smoke-results
# Keep evidence even if the emulator or ADB dies during resource extraction.
LOGCAT_PID=""
# ADB commands can hang indefinitely if the emulator becomes unresponsive
# while Forge extracts its bundled card database. All probes are bounded.
adb_short() { timeout --kill-after=3s 12s adb "$@"; }
adb_install() { timeout --kill-after=5s 180s adb "$@"; }
echo "Smoke test started: $(date -u +%FT%TZ)"
collect_debug() {
  result=$?
  if [ -n "$LOGCAT_PID" ]; then kill "$LOGCAT_PID" 2>/dev/null || true; fi
  if [ "$result" -ne 0 ]; then
    adb_short devices -l > smoke-results/adb-devices.txt 2>&1 || true
    adb_short logcat -d -t 3000 > smoke-results/failure-logcat.txt 2>&1 || true
    free -m > smoke-results/host-memory.txt 2>&1 || true
    df -h > smoke-results/host-disk.txt 2>&1 || true
    ps -eo pid,rss,comm --sort=-rss | head -35 > smoke-results/host-processes.txt 2>&1 || true
  fi
}
trap collect_debug EXIT
APK=$(find smoke-apk -name '*.apk' -print -quit)
test -n "$APK"
test -s "$APK"
AAPT="${ANDROID_SDK_ROOT}/build-tools/35.0.0/aapt"
BADGING="$("$AAPT" dump badging "$APK")"
PACKAGE=$(printf "%s\n" "$BADGING" | sed -n "s/^package: name='\([^']*\)'.*/\1/p" | head -1)
ACTIVITY=$(printf "%s\n" "$BADGING" | sed -n "s/^launchable-activity: name='\([^']*\)'.*/\1/p" | head -1)
test -n "$PACKAGE"
test -n "$ACTIVITY"
echo "Package: $PACKAGE; launch activity: $ACTIVITY"

adb_install install -r "$APK"
adb_short logcat -c
# Stream Android logs to the CI workspace before launching Forge.
adb logcat -v threadtime > smoke-results/stream-logcat.txt 2>&1 &
LOGCAT_PID=$!
timeout --kill-after=3s 25s adb shell am start -W -n "$PACKAGE/$ACTIVITY"
# The first launch expands the bundled Forge rules/card database.
# Probe for up to five minutes; a lost ADB transport must not stall the job.
READY=0
DEADLINE=$((SECONDS + 300))
while (( SECONDS < DEADLINE )); do
  if adb_short shell dumpsys activity activities 2>/dev/null | grep -q 'forge.app.CommandTableMain'; then
    READY=1
    break
  fi
  if ! adb_short get-state 2>/dev/null | grep -qx 'device'; then
    echo "WARN: ADB transport unavailable during initial card installation"
  elif ! adb_short shell pidof "$PACKAGE" >/dev/null 2>&1; then
    echo "FAIL: Command Table process exited during offline card installation"
    adb_short logcat -d -t 500 > smoke-results/crash-logcat.txt 2>&1 || true
    exit 1
  fi
  echo "Waiting for Command Table main activity ($((DEADLINE-SECONDS))s remaining)"
  sleep 5
done
if [[ "$READY" -ne 1 ]]; then
  echo "FAIL: Command Table UI was not reached within five minutes; check resource extraction, crash or emulator transport"
  adb_short logcat -d -t 1000 > smoke-results/resource-install-logcat.txt 2>&1 || true
  exit 1
fi
sleep 4
adb_short shell pidof "$PACKAGE"
adb_short shell dumpsys activity activities > smoke-results/dumpsys-activity.txt
adb_short shell screencap -p /sdcard/ct-screen.png || true
adb_short pull /sdcard/ct-screen.png smoke-results/screen.png || true
timeout --kill-after=3s 20s adb shell uiautomator dump /sdcard/ct-ui.xml || true
adb_short pull /sdcard/ct-ui.xml smoke-results/ui.xml || true
adb_short logcat -d -t 5000 > smoke-results/logcat.txt

if grep -E 'FATAL EXCEPTION:|Unable to instantiate activity|Process.*has died' smoke-results/logcat.txt; then
  echo "Android process crashed"
  exit 1
fi
if [[ "$PACKAGE" != "com.commandtable.play" ]]; then
  echo "FAIL: Wrong Android package ID: $PACKAGE"
  exit 1
fi
if test -f smoke-results/ui.xml && grep -qi "Forge needs Photos and Videos" smoke-results/ui.xml; then
  echo "FAIL: Legacy Forge permission wall is blocking Command Table"
  exit 1
fi
if test -f smoke-results/ui.xml && ! grep -Eq 'android.webkit.WebView|Command Table|CommandTable' smoke-results/ui.xml; then
  echo "FAIL: Command Table UI is not visible"
  head -c 2000 smoke-results/ui.xml
  exit 1
fi
if test -f smoke-results/ui.xml && grep -qi 'Command Table loading' smoke-results/ui.xml; then
  echo "FAIL: JavaScript boot stuck on Command Table loading screen"
  exit 1
fi
echo "PASS: Signed Command Table APK installed and Command Table UI is visible. Gameplay is not yet verified."
echo "startup: passed; gameplay: unverified" > smoke-results/smoke-status.txt
