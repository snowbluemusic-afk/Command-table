#!/usr/bin/env python3
"""Embed Sol Pod and the Forge rules engine in a single Android app."""
from pathlib import Path
import sys, shutil, re

forge=Path(sys.argv[1])
ct=Path(sys.argv[2])
android=forge/'forge-gui-android'

for source in (ct/'forge-integration/src/main/java/forge/app').glob('*.java'):
    target=android/'src/forge/app'/source.name
    target.parent.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(source,target)

for source in (ct/'forge-integration/src/main/java/forge/commandtable').glob('*.java'):
    target=forge/'forge-gui/src/main/java/forge/commandtable'/source.name
    target.parent.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(source,target)

main=android/'src/forge/app/Main.java'
main_code=main.read_text()
needle='crossfade(forgeView, forgeLogo);'
assert main_code.count(needle)>=2, "Upstream startup lifecycle has changed"
main_code=main_code.replace(needle,needle+'\n                                if (Main.this instanceof CommandTableMain) ((CommandTableMain) Main.this).showCommandTable();')
# Personal sideload build: Forge storage lives in app-specific directories.
# Requesting shared Photos/Music access blocks our UI on first launch,
# even though app-private Forge card assets need no such permission.
assert 'private boolean checkPermission() {' in main_code, "Forge permission API changed"
main_code=main_code.replace('private boolean checkPermission() {',
    'private boolean checkPermission() {\n        if (this instanceof CommandTableMain) return true;')
assert 'public boolean needExternalFileAccess() {' in main_code
main_code=main_code.replace('public boolean needExternalFileAccess() {',
    'public boolean needExternalFileAccess() {\n        if (this instanceof CommandTableMain) return false;')
storage_needle='getContext().getObbDir() + "/Forge/"'
assert main_code.count(storage_needle)==1, "Forge asset location changed"
main_code=main_code.replace(storage_needle,
    'getContext().getExternalFilesDir(null) + "/Forge/"')

main.write_text(main_code)

# Forge's standard Android build expects a separate downloaded asset archive.
# Command Table already unpacks a complete pinned card library on first launch,
# so never show Forge's mandatory network-download/update dialog.
downloader=forge/'forge-gui-mobile/src/forge/assets/AssetsDownloader.java'
downloader_code=downloader.read_text()
download_start='        if (exited)\n            return;'
assert downloader_code.count(download_start)==1, 'Upstream asset startup changed'
downloader_code=downloader_code.replace(download_start,
    download_start + '\n'
    + '        if (GuiBase.isAndroid() && new java.io.File(ASSETS_DIR + ".command-table-resources-ready").isFile()) {\n'
    + '            run(runnable);\n'
    + '            return;\n'
    + '        }')
downloader.write_text(downloader_code)



launcher=android/'src/forge/app/Launcher.java'
launcher_code=launcher.read_text()
needle='new Intent(Launcher.this, Main.class)'
assert launcher_code.count(needle)==1, "Upstream launcher changed"
launcher.write_text(launcher_code.replace(needle,'new Intent(Launcher.this, CommandTableBootstrap.class)'))

manifest=android/'src/main/AndroidManifest.xml'
manifest_code=manifest.read_text()
# Command Table now uses Android app-specific storage, so these broad permissions
# are unnecessary and can trigger security warnings on modern Samsung devices.
for permission in (
    'MANAGE_EXTERNAL_STORAGE', 'READ_MEDIA_IMAGES', 'READ_MEDIA_VIDEO',
    'READ_MEDIA_AUDIO', 'READ_EXTERNAL_STORAGE', 'WRITE_EXTERNAL_STORAGE',
    'REQUEST_INSTALL_PACKAGES'
):
    manifest_code=re.sub(
        r'\s*<uses-permission\s+android:name="android\.permission\.' + permission + r'"[^>]*/>',
        '', manifest_code)
for permission in ('MANAGE_EXTERNAL_STORAGE', 'READ_MEDIA_IMAGES', 'READ_MEDIA_VIDEO',
                   'READ_MEDIA_AUDIO', 'READ_EXTERNAL_STORAGE',
                   'WRITE_EXTERNAL_STORAGE', 'REQUEST_INSTALL_PACKAGES'):
    assert ('android.permission.' + permission) not in manifest_code, permission

# Private sideload build: do not inherit Forge's opt-in-unrelated telemetry DSN
# or default personally identifiable event reporting configuration.
import re
manifest_code=re.sub(
    r'(<meta-data\s+android:name="io\.sentry\.dsn"\s+android:value=")[^"]*(")',
    r'\1\2', manifest_code)
manifest_code=manifest_code.replace(
    'android:name="io.sentry.send-default-pii" android:value="true"',
    'android:name="io.sentry.send-default-pii" android:value="false"')

needle='android:name=".Main"'
assert manifest_code.count(needle)==1, "Upstream manifest changed"
manifest_code=manifest_code.replace(needle,'android:name=".CommandTableMain"')
assert manifest_code.count('android:name=".CommandTableMain"') == 1
bootstrap_activity = ('        <activity android:name=".CommandTableBootstrap" '
                      'android:exported="false" android:theme="@style/NormalTheme" />\n')
manifest_code=manifest_code.replace('        <activity\n            android:name=".CommandTableMain"',
                                  bootstrap_activity + '        <activity\n            android:name=".CommandTableMain"')
assert 'android:name=".CommandTableBootstrap"' in manifest_code
# Rebrand the actual launcher resources, not only a title inside the WebView.
assert manifest_code.count('android:icon="@mipmap/ic_launcher"')==1
assert manifest_code.count('android:roundIcon="@mipmap/ic_launcher_round"')==1
manifest_code=manifest_code.replace('android:icon="@mipmap/ic_launcher"',
                                    'android:icon="@drawable/sol_pod_launcher"')
manifest_code=manifest_code.replace('android:roundIcon="@mipmap/ic_launcher_round"',
                                    'android:roundIcon="@drawable/sol_pod_launcher"')
icon=ct/'forge-integration/branding/sol_pod_launcher.xml'
assert icon.is_file(), 'Sol Pod launcher icon missing'
icon_dest=android/'src/main/res/drawable/sol_pod_launcher.xml'
icon_dest.parent.mkdir(parents=True,exist_ok=True)
shutil.copyfile(icon,icon_dest)
manifest.write_text(manifest_code)

pom=android/'pom.xml'
pom_code=pom.read_text()
assert '<app.id.dev>forge.app.dev</app.id.dev>' in pom_code
pom_code=pom_code.replace('<app.id.dev>forge.app.dev</app.id.dev>',
                          '<app.id.dev>com.commandtable.play</app.id.dev>')
assert '<manifestApplicationLabel>Forge (dev)</manifestApplicationLabel>' in pom_code
pom.write_text(pom_code.replace('<manifestApplicationLabel>Forge (dev)</manifestApplicationLabel>',
                               '<manifestApplicationLabel>Sol Pod</manifestApplicationLabel>'))

asset=android/'assets/command-table.html'
asset.parent.mkdir(parents=True,exist_ok=True)
print('Forge Android patch applied. Sol Pod launcher and icon installed. Patch frontend separately.')
