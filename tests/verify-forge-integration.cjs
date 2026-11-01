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

const repair = read('forge-integration/src/main/java/forge/commandtable/CommandTableStarterDeckRepair.java');
const projection = read('forge-integration/src/main/java/forge/commandtable/CommandTableGameProjection.java');
assert(overlay.includes('case "deck.repairPrebuilt"'),
  'Native bridge must expose Forge-powered starter deck repair');
assert(repair.includes('CommandTableForgeDecks.validationError('),
  'Starter repairs must use Forge deck validation, not JavaScript heuristics');
assert(repair.includes('getColorIdentity().hasNoColorsExcept(identity)'),
  'Replacement candidates must respect mana symbols in rules text');
assert(repair.includes('main.size() != 99'),
  'Every repair must preserve the 99 + 1 Commander deck size');
assert(repair.includes('result.put("replacements"'),
  'Return the original and replacement names for auditability');
assert(frontend.includes('d.prebuilt===true'),
  'Only stock starter decks may be auto-repaired');
assert(frontend.includes("ctRepairStarterDecks().then(allDecks"),
  'Matches must await starter repair before creating AI opponent decks');
assert(frontend.includes("token:!!c.token"),
  'Forge tokens must survive the state projection');
assert(frontend.includes("ct-token-permanent"),
  'Show tokens as distinct native battlefield permanents');
assert(projection.includes('m.put("token", c.isToken())'),
  'Forge must include token flag in authoritative state');

const forgeHostPatch = read('forge-integration/tools/patch_forge_android.py');
assert(forgeHostPatch.includes('<manifestApplicationLabel>Command Table Forge</manifestApplicationLabel>'),
  'Installed Forge app must have a distinct launcher label from old Command Table');
assert(frontend.includes('FORGE BUILT-IN · v0.14.0'),
  'New in-app header must identify bundled Forge build');
assert(!frontend.includes('Play full rules in Forge'),
  'An embedded Forge build must never advertise an external Forge app');
const guiProxy = read('forge-integration/src/main/java/forge/commandtable/CommandTableGuiProxy.java');
const host = read('forge-integration/src/main/java/forge/app/CommandTableMain.java');
assert(guiProxy.includes('if ("message".equals(name) || "showErrorDialog".equals(name))'),
  'Native Forge messages must not show the native game screen/modal');
assert(guiProxy.includes('if ("openView".equals(name) && afterNativeChoice != null)'),
  'Bring Command Table back to front after Forge creates its match controller');
assert(guiProxy.includes('Missing Command Table Forge choice handler:'),
  'Unsupported blocking native dialogs must be visible errors, not silent handoffs');
assert(!overlay.includes('web.setVisibility(android.view.View.GONE)'),
  'Forge must never hide the Command Table UI for its native game screen');
assert(overlay.includes('web.setElevation(32f)') && overlay.includes('web.bringToFront()'),
  'Command Table must remain above Forge LibGDX surface');
assert(overlay.includes('case "game.command"'), 'Forge rules engine must accept Command Table moves');
assert(overlay.includes('CommandTableOverlay::publishNotice'),
  'Forge notices must flow into Command Table WebView');
assert(frontend.includes("data.type === 'game.notice'"),
  'Command Table must display Forge notices without a native dialog');
assert(host.includes('protected void onResume()') &&
       host.includes('CommandTableOverlay.show();'),
  'Android resume must restore the Command Table game surface');

const deckAdapter = read('forge-integration/src/main/java/forge/commandtable/CommandTableForgeDecks.java');
const matchLauncher = read('forge-integration/src/main/java/forge/commandtable/CommandTableMatchLauncher.java');
assert(deckAdapter.includes("canonicalName(commander)") &&
       deckAdapter.includes("pool.add(canonicalName(card), 1)"),
  'All decks, including saved decks, must use Forge canonical card names');
assert(deckAdapter.includes("replace('\\u2019'"),
  'Typographic apostrophes in the existing seven starter decks must be normalized');
assert(repair.includes('for (int i = 0; i < cards.size(); i++)') &&
       repair.includes('!basic(nameHere)') && repair.includes('legal(nameHere, commander)'),
  'Repair must inspect all 99 card names individually, not parse the first validator error');
assert(repair.includes('CommandTableForgeDecks.canonicalName(original)'),
  'Starter decks must be normalized before repair');
assert(matchLauncher.includes('rules.setWarnAboutAICards(false)'),
  'Advisory AI-compatibility dialogs must not block the match launch');
assert(frontend.includes('async function ctWatchNativeMatchStart()') &&
       frontend.includes("CommandTableNative.request('game.snapshot')"),
  'Command Table must recover the first playable Forge snapshot');
assert(frontend.includes("app.view='game';app.modal='';app.notice=''"),
  'A Forge game state must switch to the real Command Table battlefield');

console.log('PASS: offline resources, Java bootstrap syntax, stable WebView origin, Forge match/validation, and emulator gate');
