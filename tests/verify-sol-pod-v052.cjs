'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
const projection=read('forge-integration/src/main/java/forge/commandtable/CommandTableGameProjection.java');
const dispatcher=read('forge-integration/src/main/java/forge/commandtable/CommandTableChoiceDispatcher.java');
const engine=read('forge-integration/src/main/java/forge/commandtable/CommandTableForgeInput.java');
const overlay=read('forge-integration/src/main/java/forge/app/CommandTableOverlay.java');
const planner=read('forge-integration/web/sol-pod-combat-planner-v051.js');
const allocation=read('forge-integration/web/forge-choice.js');
const patch=read('forge-integration/tools/patch_frontend.py');
new Function(planner);new Function(allocation);
assert(projection.includes('CombatUtil.canBlock(attacker,blocker,realCombat)') &&
 projection.includes('out.put("legalBlockersReady", candidatesReady)') &&
 projection.includes('realCombat.isBlocking(blocker,attacker)'),
 'Actual Forge combat legality must drive suggestions and allow removing assigned blockers');
assert(patch.includes('legalBlockers:raw.legalBlockers||{}') &&
 patch.includes('legalBlockersReady:raw.legalBlockersReady===true'),
 'Client must preserve exactly the legal IDs published by the rules engine');
assert(planner.includes('const legal=legalFor(attacker.cardId)') &&
 planner.includes('legal.has(Number(c.forgeId))') &&
 planner.includes("if(!legal)return [];") &&
 planner.includes("No eligible unassigned blockers"),
 'Unverified or illegal blockers must never be suggested, including flyers');
assert(planner.includes('b.disabled=busy||uncertain||!allowed'),
 'Illegal blocker buttons must be disabled');
assert(planner.includes("action:'confirmBlocks'") &&
 planner.includes('const bounded=') &&
 planner.includes('uncertain=true') &&
 !planner.includes('ctForgePriority?.confirm?.()'),
 'Block and Skip must use bounded native confirmation, with safe recovery');
assert(overlay.includes('bridge.confirmBlocks();') &&
 engine.includes('instanceof InputBlock') &&
 engine.includes('requirePhase("COMBAT_DECLARE_BLOCKERS")'),
 'A stale block confirmation must not advance another phase or pass priority');
assert(dispatcher.includes('extras.put("combatDamage", true)') &&
 dispatcher.includes('extras.put("sourcePower"') &&
 dispatcher.includes('extras.put("sourceToughness"') &&
 dispatcher.includes('entry.put("power"') &&
 dispatcher.includes('entry.put("toughness"'),
 'Combat allocation must carry authentic source and recipient power/toughness');
assert(allocation.includes('Damage source · ') &&
 allocation.includes(' P/T') &&
 allocation.includes("current.combatDamage"),
 'Damage allocation UI must visibly display source and targets power/toughness');
if(process.argv[2]){
 const html=read(process.argv[2]);
 assert(html.includes('Suggested legal blockers') &&
 html.includes('Checking blocker legality') &&
 html.includes('Damage source · ') &&
 html.includes("action:'confirmBlocks'") &&
 html.includes('legalBlockersReady:raw.legalBlockersReady===true'),
 'Embedded Sol Pod v0.52 app is missing combat or damage allocation fixes');
}
console.log('PASS Sol Pod v0.52: Forge-legal blocking, no flying misrecommendations, bounded Skip/Confirm, damage P/T');
