#!/usr/bin/env bash
set -euo pipefail

mkdir -p smoke-results
# Keep evidence even if the emulator or ADB dies during resource extraction.
LOGCAT_PID=""
collect_debug() {
  result=$?
  if [ -n "$LOGCAT_PID" ]; then kill "$LOGCAT_PID" 2>/dev/null || true; fi
  if [ "$result" -ne 0 ]; then
    adb devices -l > smoke-results/adb-devices.txt 2>&1 || true
    adb logcat -d -t 3000 > smoke-results/failure-logcat.txt 2>&1 || true
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

adb install -r "$APK"
adb logcat -c
# Stream Android logs to the CI workspace before launching Forge.
adb logcat -v threadtime > smoke-results/stream-logcat.txt 2>&1 &
LOGCAT_PID=$!
adb shell am start -W -n "$PACKAGE/$ACTIVITY"
# First launch unpacks Forge's offline card database from the APK.
# Do not interpret the intentional installation screen as a failed startup.
READY=0
for i in $(seq 1 48); do
  if adb shell dumpsys activity activities 2>/dev/null | grep -q 'forge.app.CommandTableMain'; then
    READY=1
    break
  fi
  if ! adb shell pidof "$PACKAGE" >/dev/null 2>&1; then
    echo "FAIL: Command Table process exited during offline card installation"
    adb logcat -d -t 500 > smoke-results/crash-logcat.txt || true
    exit 1
  fi
  sleep 5
done
if [[ "$READY" -ne 1 ]]; then
  echo "FAIL: Offline Forge card installation did not complete"
  adb logcat -d -t 1000 > smoke-results/resource-install-logcat.txt || true
  exit 1
fi
sleep 4
adb shell pidof "$PACKAGE"
adb shell dumpsys activity activities > smoke-results/dumpsys-activity.txt
adb shell screencap -p /sdcard/ct-screen.png || true
adb pull /sdcard/ct-screen.png smoke-results/screen.png || true
timeout 20 adb shell uiautomator dump /sdcard/ct-ui.xml || true
timeout 10 adb pull /sdcard/ct-ui.xml smoke-results/ui.xml || true
adb logcat -d -t 5000 > smoke-results/logcat.txt

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
