'use strict';
// Fail fast on integration mistakes before the expensive upstream Forge Maven build.
const fs = require('node:fs');
const assert = require('node:assert/strict');

const read = path => fs.readFileSync(path, 'utf8');
const bootstrap = read('forge-integration/src/main/java/forge/app/CommandTableBootstrap.java');
const overlay = read('forge-integration/src/main/java/forge/app/CommandTableOverlay.java');
const forgeInput = read('forge-integration/src/main/java/forge/commandtable/CommandTableForgeInput.java');
const deckRules = read('forge-integration/src/main/java/forge/commandtable/CommandTableForgeDecks.java');
const match = read('forge-integration/src/main/java/forge/commandtable/CommandTableMatchLauncher.java');
const frontend = read('forge-integration/tools/patch_frontend.py');
const workflow = read('.github/workflows/command-table-android.yml');
const selectionScript = read('forge-integration/web/forge-selection.js');
const castingScript = read('forge-integration/web/forge-simple-cast.js');

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
assert(frontend.includes('FORGE BUILT-IN · v0.15.0'),
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

const projectionSource = read('forge-integration/src/main/java/forge/commandtable/CommandTableGameProjection.java');
assert(projectionSource.includes('public static boolean ready(GameView game)') &&
  projectionSource.includes('game.getPlayers().size() >= 2;') &&
  projectionSource.includes('boolean pregame = game.getPlayerTurn() == null;'),
  'Publish a safe pre-turn snapshot for Forge starting player and mulligan choices');
assert(projectionSource.includes('ownCommanders != null && !ownCommanders.isEmpty()') &&
  projectionSource.includes('if (commanders == null) continue'),
  'Forge PlayerView.getCommanders() is nullable before first turn');
assert(overlay.includes('if (!CommandTableGameProjection.ready(game)) return;') &&
  overlay.includes('Forge is preparing the Commander game'),
  'Match-start acknowledgment and snapshots must wait for populated GameView');
assert(overlay.includes('android.util.Log.e("CommandTable", "GameView projection failed", ex)') &&
  overlay.includes('android.util.Log.e("CommandTable", "Forge match start failed", err)'),
  'Capture complete Android stack traces for genuine startup failures');

const selectionUi = read('forge-integration/web/forge-selection.js');
const gestureUi = read('forge-integration/web/forge-gestures.js');
assert(projectionSource.includes('game.getPlayers().size() >= 2;') &&
       !projectionSource.includes('game.getPlayers().size() < 2 || game.getPlayerTurn() == null'),
  'Forge must publish a pregame snapshot before the first turn is chosen');
assert(projectionSource.includes('out.put("phase", pregame ? "MULLIGAN"') &&
       projectionSource.includes('initialInt(game::getTurn, 0)'),
  'Pre-turn snapshots must be safe and identify the mulligan stage');
assert(guiProxy.includes('else if (args.length == 4)') &&
       guiProxy.includes('if (args.length >= 6)') &&
       guiProxy.includes('onPrompt.accept(prompt)'),
  'Forge starting-player buttons must be forwarded for both overloads');
assert(selectionUi.includes("payload?.type==='game.prompt'") &&
       selectionUi.includes("action:ok?'resolve':'cancelCastTarget'") &&
       selectionUi.includes("ct-forge-priority-buttons"),
  'Command Table must present and answer real Forge opening decisions');
assert(selectionUi.includes("window.app?.nativeMatch") &&
       selectionUi.includes("decision.style.display=active?'block':'none'"),
  'Opening decisions must remain accessible before the first battlefield');

assert(frontend.includes("function turnControls(g,active,self){if(app.nativeMatch)return ''"),
  'Simulator turn controls must not duplicate authoritative Forge buttons');
assert(frontend.includes("'dismiss','rotateMatch','togglePod'"),
  'Native UI-only actions must stay usable when Forge handles rules');
assert(frontend.includes("app.modal='';render();"),
  'Native cast should close hand browser so card controls are usable');
assert(frontend.includes("overview?'▣':'▦'") &&
       frontend.includes('data-action="rotateMatch"'),
  'Pod toggle and orientation toggle must be compact icon buttons');
assert(frontend.includes('.ct10-overview .ct-pod-grid') &&
       frontend.includes('@media(orientation:landscape)'),
  'Compact Pod overview must support both phone orientations');
assert(selectionUi.includes("bottom:calc(env(safe-area-inset-bottom) + 25dvh)") &&
       selectionUi.includes("!window.app?.modal") &&
       selectionUi.includes("paintDecision(); // Close behind full-screen"),
  'Priority and mulligan controls must not cover cards or hand inspector');
assert(overlay.includes('activity.setRequestedOrientation(orientation)') &&
       overlay.includes('SCREEN_ORIENTATION_SENSOR_LANDSCAPE'),
  'Native Android orientation switch must not be a no-op');
// On-device 0.14.4 showed two identical OK/Undo panels. The second one
// was appended by patch_frontend.py and covered the entire bottom hand.
assert(!frontend.includes("command-table-forge-choice") &&
       !frontend.includes("setInterval(update,500)") &&
       !frontend.includes("prompt_script ="),
  'Only forge-selection.js may own native Forge priority buttons');
assert(selectionUi.includes("decision.id='ct-forge-priority-buttons'") &&
       selectionUi.split("decision.id='ct-forge-priority-buttons'").length===2,
  'Exactly one Forge priority dock should exist');
assert(selectionUi.includes("bottom:calc(env(safe-area-inset-bottom) + 10px)") &&
       selectionUi.includes("width:min(24vw,300px)"),
  'Landscape priority buttons must be compact at the bottom right');
assert(selectionUi.includes("!window.app?.modal") &&
       selectionUi.includes("!otherChoiceOpen"),
  'Do not overlay the hand browser or Forge detailed choice dialogs');
assert(frontend.includes('ctShowStarterDecks()') &&
       frontend.includes('ctOrderedDecks')===false &&
       frontend.includes('ctSortedDecks') &&
       frontend.includes('ctHomeDeckCards') &&
       frontend.includes('ct_show_starter_decks_v1'),
  'Custom decks must display first, with reversible hiding of starter decks');
assert(frontend.includes('ct10-hand-mulligan') &&
       frontend.includes('toggleHandZoom') &&
       frontend.includes('ct10-hand-zoom'),
  'Opening hands must expand and tapping hand must toggle zoom');
assert(frontend.includes('ct-native-stack') &&
       frontend.includes('g.stack.slice().reverse()'),
  'Show a visible, Forge-owned spell stack');
assert(projectionSource.includes('seat.put("tokenCount"') &&
       projectionSource.includes('c.getName()'),
  'Token provenance and fallback names must survive native projection');
assert(selectionUi.includes("phases={main1:'First main'") &&
       selectionUi.includes("!window.app?.sideInspect"),
  'Show current phase without covering inspected cards');
const choiceUi=read('forge-integration/web/forge-choice.js');
assert(choiceUi.includes("'background:transparent','pointer-events:none'") &&
       choiceUi.includes("'pointer-events:auto'") &&
       choiceUi.includes("width:min(37vw,460px)") &&
       choiceUi.includes('ct-forge-choice-layout'),
  'Routine Forge decisions must be a non-blocking responsive side tray');
assert(choiceUi.includes("current.min===1 && current.max===1") &&
       choiceUi.includes("void answer(false)"),
  'A single required Forge card choice must complete with one tap');
assert(choiceUi.includes("window.AndroidBridge?.artworkUrl?.(simpleName)"),
  'Forge discard and card-choice options must have optional card art');
assert(selectionUi.includes("candidates().length<=4") &&
       selectionUi.includes("width:min(34vw,410px)") &&
       selectionUi.includes("ct-forge-selection-layout"),
  'Small target selections should display inline in compact panels');
assert(frontend.includes('ctForgeLastSignature') &&
       frontend.includes('ctReceiveForgeState(message)') &&
       frontend.includes('ctForgeRenderTimer=setTimeout') &&
       frontend.includes('ctReceiveForgeState(latest.game)'),
  'Native state updates must be deduplicated and grouped without repeated full-screen resets');
assert(frontend.includes("if (data.type === 'game.notice') {ctNativeToast") &&
       frontend.includes('ct-native-toast'),
  'Transient notices must not replace the battlefield or persist as blocking banners');
assert(frontend.includes('function ctNativeTiming(c)') &&
       frontend.includes('Wait for your main phase to cast this card') &&
       frontend.includes("ctNativeTiming(c).allowed") &&
       frontend.includes('timing.reason'),
  'Do not offer non-flash sorcery-speed casting during opponent turns');
assert(frontend.includes("case 'inspectBoardPermanent'") &&
       frontend.includes('ctNativeToast(\'This card is no longer') &&
       frontend.includes("action:'castById',value:stableId") &&
       frontend.includes('else beginCastFromDrag(d.commander,d.index)'),
  'Native drag must use Forge card selection, and permanent taps must open preview');
assert(frontend.includes("'toggleHandZoom','inspectBoardPermanent','toggleZones'") &&
       frontend.includes('case \'toggleZones\':app.zonesOpen='),
  'Hand zoom and zone drawer must bypass native rules-action guard');
assert(frontend.includes('ct10-opp-lands') &&
       frontend.includes('ct10-own-lands') &&
       frontend.includes('ct10-zone-drawer'),
  'Cards must be grouped by lands, creatures and other permanents');
assert(selectionUi.includes('ct-forge-phase-rail') &&
       selectionUi.includes("stack.length?'Pass priority'") &&
       selectionUi.includes('isLegalCard:(id)'),
  'Forge priority controls must show phase progression and authoritative card availability');
assert(choiceUi.includes("const submittingId=current.id") &&
       choiceUi.includes("if(current?.id===submittingId)") &&
       choiceUi.includes("request('engine.status')"),
  'Accepting a discard must not dismiss a newer Forge choice, and pending decisions must recover');
assert(frontend.includes("['castSelected','playInspected','castById','castCommander','cardId','quitGame']") &&
       frontend.includes('app.inspectForgeId=null;render();'),
  'Activating a permanent must close its inspector so Resolve is accessible');
assert(frontend.includes("source.replace('<span>✦</span>','')"),
  'Remove decorative star that overlaps battlefield cards');
assert(frontend.includes('function ctNativeEndOverlay(g)') &&
       frontend.includes('ctNativeEndOverlay(g)') &&
       frontend.includes('case \'leaveFinishedGame\'') &&
       selectionUi.includes('window.app?.game?.winner===null'),
  'Only Forge game completion may show Victory/Defeat and hide priority controls');
assert(frontend.includes('function ctNativeAffordable(c,me,g)') &&
       frontend.includes('ctNativeAffordable(c,me,g)') &&
       frontend.includes("!ctNativeTiming(c).allowed"),
  'Provide conservative mana-affordability hints without bypassing Forge');
assert(overlay.includes('case "castCommander":') &&
       overlay.includes('case "castById":') &&
       overlay.includes('human.getCommand().get(0).getId()') &&
       overlay.includes('c.getId()==wanted'),
  'Commander casting and inspected hand casts must use stable Forge zone IDs');
assert(frontend.includes("case 'castCommander'")===false &&
       frontend.includes("'cardId','castCommander','castById'") &&
       frontend.includes("?'castById':act"),
  'Commander actions and cast-by-ID dispatch must use native Forge, not simulator');
assert(frontend.includes('data-drag-commander="true"') &&
       frontend.includes("data-action=\"castCommander\"") &&
       frontend.includes('Commander is not in the command zone')===false,
  'Command-zone drawer must expose cast and drag interaction');
assert(frontend.includes('function ctNativeCombatGuide(g)') &&
       frontend.includes('ctNativeCombatGuide(g)') &&
       frontend.includes('ct-native-combat-guide') &&
       frontend.includes('ct-native-attacker') &&
       frontend.includes('ct-native-blocker'),
  'Native combat must expose attacker-to-defender/blocker mapping and clear steps');
assert(selectionUi.includes("data-action=\"inspectBoardPermanent\"") &&
       selectionUi.includes("raw.split(':').at(-1)") &&
       selectionUi.includes("isSelectedCard:(id)"),
  'Selection highlighting must match stable Forge card IDs instead of seat-prefixed UI IDs');
assert(frontend.includes("if(key==='sol ring')mana.push('C','C')") &&
       frontend.includes('arcane signet') &&
       frontend.includes("mana.indexOf('*')"),
  'Advisory casting highlights must account for known untapped mana rocks');
assert(selectionUi.includes("ct-forge-combat-links") &&
       selectionUi.includes("game.combat") &&
       selectionUi.includes("combat.blockerIds") &&
       selectionUi.includes("pointer-events:none") &&
       selectionUi.includes('ct10-lane [data-action="cardId"]'),
  'Combat connections must be driven by Forge blocker IDs and leave card taps unobstructed');
assert(selectionUi.includes("!combat && candidates().length<=4") &&
       selectionUi.includes("Confirm ") &&
       selectionUi.includes("No attacks") &&
       selectionUi.includes("No blocks") &&
       selectionUi.includes("Undo blocker")===false,
  'Arena-like combat actions must use a compact optional tray and phase-specific confirmation');
assert(frontend.includes('forge-gestures.js') &&
       frontend.includes('data-ct-forge-player-id=') &&
       frontend.includes("'permanent','cardId','selectPlayer','castCommander'") &&
       frontend.includes("me?.handForgeIds?.[index]"),
  'Native arena gestures and stable hand/commander drag IDs must be bundled');
assert(gestureUi.includes('ct-direct-combat-gesture') &&
       gestureUi.includes('ctDirectCombat') &&
       gestureUi.includes("sourceId") &&
       gestureUi.includes("dragMode") &&
       gestureUi.includes("combat.attack") &&
       gestureUi.includes("combat.block") &&
       gestureUi.includes('window.app?.game?.combat') &&
       gestureUi.includes('selectSourceAndTarget') &&
       gestureUi.includes("event.stopImmediatePropagation()"),
  'Drag attackers and blockers must be confirmed by Forge and suppress synthetic taps');
assert(selectionUi.includes('selectionVersion++') &&
       selectionUi.includes("isLegalPlayer:(id)") &&
       selectionUi.includes("ct-forge-selection") &&
       selectionUi.includes("ct-forge-legal-player"),
  'Selection must publish versioned legal players and targets to gesture controller');
assert(forgeInput.includes('public void attackWith(int attackerId, int defenderId)') &&
       forgeInput.includes('human().selectPlayer(defender, null)') &&
       forgeInput.includes('public void blockWith(int attackerId, int blockerId)') &&
       forgeInput.includes('human().selectCard(attacker, Collections.emptyList(), null)') &&
       overlay.includes('case "combat.attack":') &&
       overlay.includes('case "combat.block":'),
  'Combat operations must use correct Forge InputAttack/InputBlock ordering');
assert(selectionUi.includes("const combatCount=inAttack?confirmedAttackers:inBlock?confirmedBlockers:0") &&
       selectionUi.includes("Attack all") &&
       selectionUi.includes("Remove all attackers") &&
       selectionUi.includes("if(inBlock&&!ok)continue"),
  'Combat counts/confirmations must reflect Forge CombatView, not current target selection');
assert(matchLauncher.includes('FPref.UI_SHOW_ACTIONABLE_HIGHLIGHTS, true') &&
       matchLauncher.indexOf('FPref.UI_SHOW_ACTIONABLE_HIGHLIGHTS, true') <
         matchLauncher.indexOf('match.startMatch(rules,'),
  'Forge must enable authoritative playable-card highlighting BEFORE match startup');
assert(forgeInput.includes('current instanceof InputPassPriority priority') &&
       forgeInput.includes('priority.getChosenSa()') &&
       forgeInput.includes('You cannot cast yet.') &&
       overlay.includes('bridge.castCard(wanted)'),
  'A cast must require the priority input and an actual Forge spell/land selection');
assert(frontend.includes("const g=app.game,name=app.nativeMatch?app.sideInspect") &&
       frontend.includes("Tap cards to select · Press OK") &&
       frontend.includes("isSelectedCard?.(me.handForgeIds?.[i])"),
  'Mulligan choices must show and native stack inspector must close');
assert(selectionScript.includes("get isBottoming()") &&
       selectionScript.includes("get isHandChoice()") &&
       castingScript.includes("window.ctForgePriority?.isHandChoice") &&
       castingScript.includes("action:'cardId',value:card.id"),
  'Mulligan card taps must reach Forge without Cast');
assert(selectionScript.includes("||handChoice") &&
       selectionScript.includes("syncChoices()") &&
       selectionScript.includes("'Confirm discard'"),
  'Mandatory discard selections must remain visible without enabled native buttons');
console.log('PASS: native hand confirmation, mulligan, inspector and Forge integration');
