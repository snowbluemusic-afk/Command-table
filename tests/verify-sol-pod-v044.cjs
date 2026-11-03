'use strict';
/* Sol Pod v0.44 P0 — Commander must be an applied Forge variant.
 * Previously the launcher only constructed GameRules(GameType.Commander)
 * and passed Collections.emptySet() as applied variants. Forge's real
 * commander SBA (CR 903.9a), commander-damage loss, and hasCommander flag
 * explicitly inspect the applied variants, NOT the primary game type.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=file=>fs.readFileSync(file,'utf8');
const launcher=read('forge-integration/src/main/java/forge/commandtable/CommandTableMatchLauncher.java');
const project=read('forge-integration/src/main/java/forge/commandtable/CommandTableGameProjection.java');
const choices=read('forge-integration/src/main/java/forge/commandtable/CommandTableChoiceDispatcher.java');
const proxy=read('forge-integration/src/main/java/forge/commandtable/CommandTableGuiProxy.java');
const overlay=read('forge-integration/src/main/java/forge/app/CommandTableOverlay.java');
const ui=read('forge-integration/web/forge-choice.js');
assert.match(launcher,/new GameRules\(GameType\.Constructed\)/,
 'Use normal Forge Constructed base for Commander matches');
assert.match(launcher,/Collections\.singleton\(GameType\.Commander\)/,
 'Commander must be explicitly installed as a variant');
assert.match(launcher,/rules\.setAppliedVariants\(appliedVariants\)/,
 'Forge game rules must receive the Commander variant before Game construction');
assert.match(launcher,/rules\.hasAppliedVariant\(GameType\.Commander\)\s*\|\|\s*!rules\.hasCommander\(\)/,
 'Fail early rather than silently starting a fake Commander game');
assert.match(launcher,/match\.startMatch\(rules,\s*appliedVariants,/,
 'HostedMatch must receive the same applied Commander variant');
assert.doesNotMatch(launcher,/match\.startMatch\(rules,\s*Collections\.emptySet\(\)/,
 'Never launch Commander with zero applied variants');
assert(launcher.includes('RegisteredPlayer.forCommander(humanDeck)') &&
       launcher.includes('RegisteredPlayer.forCommander(aiDecks.get(i))'),
 'Both player and AI decks must retain actual Commander registration');
assert(project.includes('out.put("isCommander", game.isCommander())'),
 'WebView must receive the Forge-authoritative Commander flag');
assert(proxy.includes('Object handled = choices.invoke(method, args)'),
 'Forge proxy must pass player confirmations into the real choice dispatcher');
assert(choices.includes('case "confirm"') &&
       choices.includes('extras.put("commanderDestination", true)'),
 'Command-zone confirmation must be surfaced as a Forge decision');
assert(choices.includes('Move to command zone') &&
       choices.includes('Keep the normal destination'),
 'Owner must have both legitimate destination responses');
assert(!/forced[^]*current\.confirm\) void answer\(false\)/.test(ui),
 'Commander yes/no confirmation must never be auto-answered');
assert(overlay.includes('private static void publishChoice(Map<String, Object> prompt)') &&
       overlay.includes('            show();\n            send(new JSONObject().put("v", 1).put("type", "game.choice")'),
 'Mandatory choice must show Sol Pod WebView before publishing to JS');
const forgeRoot=process.env.FORGE_ROOT||'/tmp/forge';
const rulePath=path.join(forgeRoot,'forge-game/src/main/java/forge/game/GameRules.java');
const actionPath=path.join(forgeRoot,'forge-game/src/main/java/forge/game/GameAction.java');
const playerPath=path.join(forgeRoot,'forge-game/src/main/java/forge/game/player/Player.java');
const inputPath=path.join(forgeRoot,'forge-gui/src/main/java/forge/gamemodes/match/input/InputConfirm.java');
if([rulePath,actionPath,playerPath,inputPath].every(fs.existsSync)){
 const rules=read(rulePath),action=read(actionPath),player=read(playerPath),input=read(inputPath);
 assert(rules.includes('return appliedVariants.contains(variant);'),
   'Forge hasAppliedVariant must inspect applied variants (regression rationale)');
 assert(rules.includes('appliedVariants.contains(GameType.Commander)'),
   'Forge hasCommander must inspect Commander as an applied variant');
 assert(action.includes('game.getRules().hasAppliedVariant(GameType.Commander)') &&
   action.includes('stateBasedAction_Commander(c, mapParams)'),
   'Forge graveyard/exile SBA must be gated by Commander applied variant');
 assert(action.includes('c.getOwner().getController().confirmAction(') &&
   action.includes('PlayerActionConfirmMode.ChangeZoneToAltDestination'),
   'Commander SBA must ask its real owner (never auto-move)');
 assert(action.includes('moveTo(c.getOwner().getZone(ZoneType.Command), c'),
   'Yes must lead to Forge command-zone move');
 assert(player.includes('game.getRules().hasAppliedVariant(GameType.Commander)') &&
   player.includes('GameLossReason.CommanderDamage'),
   'Commander damage loss conditions need the same variant');
 assert(input.includes('controller.getGui().confirm('),
   'Mobile human commander decision must flow into the IGuiGame proxy');
 console.log('PASS upstream Forge contract: Commander variant activates SBA, 21 commander damage and owner confirmation');
}else{
 console.log('Upstream Forge not checked in preflight; rerun with /tmp/forge during Android embedding');
}
const bundled=process.argv[2];
if(bundled){
 const html=read(bundled);
 assert(html.includes('Where should your commander go?'),
  'Embedded full-screen choice must describe commander destination');
 assert(html.includes('ct-forge-decision-sheet'),
  'Embedded Commander choice must use the full-screen Forge modal');
}
console.log('PASS Sol Pod v0.44: real Commander variant, Forge owner destination UI, no hidden auto-selection');
