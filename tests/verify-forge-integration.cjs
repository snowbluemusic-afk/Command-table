'use strict';
// Fail fast on integration mistakes before the expensive upstream Forge Maven build.
const fs = require('node:fs');
const assert = require('node:assert/strict');

const read = path => fs.readFileSync(path, 'utf8');
const bootstrap = read('forge-integration/src/main/java/forge/app/CommandTableBootstrap.java');
const overlay = read('forge-integration/src/main/java/forge/app/CommandTableOverlay.java');
const deckRules = read('forge-integration/src/main/java/forge/commandtable/CommandTableForgeDecks.java');
const match = read('forge-integration/src/main/java/forge/commandtable/CommandTableMatchLauncher.java');
const frontend = read('forge-integration/tools/patch_frontend.py');
const workflow = read('.github/workflows/command-table-android.yml');

const literal = n => "entryName.indexOf('" + '\\'.repeat(n) + "')";
assert(bootstrap.includes(literal(2)),
  'Java ZIP entry backslash check must use a valid single escaped char');
assert(!bootstrap.includes(literal(4)),
  'Invalid Java char literal would prevent Android compilation');
assert(bootstrap.includes('getExternalFilesDir(null)'),
  'Bundled Forge assets must use app-private storage');
assert(bootstrap.includes('command-table-forge-resources.zip'),
  'Bundled offline rules/card resources are missing');
assert(bootstrap.includes('CommandTableMain.class'),
  'App must open the Command Table entrypoint after resource setup');

const origin = 'https://appassets.androidplatform.net/assets/index.html';
assert(overlay.includes('view.loadUrl("' + origin + '")'),
  'The Command Table WebView origin must match the original app');
assert(overlay.includes('appassets.androidplatform.net') &&
       overlay.includes('"/assets/index.html".equals(u.getPath())'),
  'WebView asset interception must agree with the loaded URL');
assert(!overlay.includes('https://commandtable.local/index.html'),
  'Mismatched WebView origins isolate locally stored decks');
assert(overlay.includes('CommandTableMatchLauncher.start('),
  'Matches must start in the embedded Forge runtime');
assert(!overlay.includes('playInForge('),
  'Do not hand the user to a separate native Forge application');

assert(deckRules.includes('DeckFormat.Commander.getDeckConformanceProblem'),
  'Deck validation must be authoritative Forge Commander validation');
assert(match.includes('HostedMatch'), 'Forge must own the actual match');
assert(match.includes('GameType.Commander'), 'Do not launch a standard Magic match');
assert(frontend.includes('if(app.nativeMatch && app.view'), 
  'A native match must never silently use JavaScript gameplay rules');
assert(frontend.includes('window.CommandTableCatalog?.resolveSavedDecks()'),
  'Imported deck metadata should resolve from the embedded Forge catalogue');
assert(workflow.includes('needs: embedded-forge-android'),
  'Startup smoke must depend on the APK integration build');
assert(workflow.includes('bash ci/android-smoke.sh'),
  'Real Android installation/launch check is required');

console.log('PASS: offline resources, Java bootstrap syntax, stable WebView origin, Forge match/validation, and emulator gate');
