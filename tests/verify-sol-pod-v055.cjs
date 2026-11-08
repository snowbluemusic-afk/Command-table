'use strict';
// Sol Pod v0.55 P0: the live InputBlock/Combat state is the authority.
// v0.54 only repaired the waiting primitive; these checks protect the
// mismatch between phase/UI proxy, current input and committed blockers.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
const input=read('forge-integration/src/main/java/forge/commandtable/CommandTableForgeInput.java');
const native=read('forge-integration/src/main/java/forge/app/CommandTableOverlay.java');
const projection=read('forge-integration/src/main/java/forge/commandtable/CommandTableGameProjection.java');
const frontend=read('forge-integration/tools/patch_frontend.py');
const planner=read('forge-integration/web/sol-pod-combat-planner-v051.js');
const safety=read('forge-integration/web/forge-resilience-v035.js');
const build=read('forge-integration/web/sol-pod-build-v053.js');
for(const js of [planner,safety,build])new vm.Script(js);
assert(input.includes('human().getInputQueue().getInput()') &&
       input.includes('queued instanceof InputBlock blockInput') &&
       input.includes('active instanceof InputBlock input'),
       'Both blocker commands must consume the real Forge input queue');
const blockMethod=input.split('public boolean blockWith(int attackerId, int blockerId)')[1]
  .split('private void requirePhase')[0];
assert(!blockMethod.includes('human().getInputProxy().getInput()') &&
       !blockMethod.includes('human().selectCard('),
       'The block method must bypass InputProxy; attack commands may still use it');
assert(input.includes('blockInput.selectCard(attacker, Collections.emptyList(), null)') &&
       input.includes('blockInput.selectCard(blocker, Collections.emptyList(), null)') &&
       input.includes('boolean nowBlocking = combat.isBlocking(blocker, attacker)') &&
       input.includes('if (wasBlocking == nowBlocking)') &&
       input.includes('return result.get()'),
       'Live Combat must validate actual toggle and return the resulting assignment');
assert(input.includes('input.selectButtonOK();') &&
       input.includes('human().getInputQueue().getInput() == input'),
       'Confirmation must complete only the live input, not pass the next priority');
assert(native.includes('actionResult.put("blockApplied", assigned)') &&
       native.includes('actionResult.put("blockDecisionAccepted",true)') &&
       native.includes('addHumanInputStatus(state)') &&
       native.includes('addHumanInputStatus(snapshot)'),
       'Native ACKs and async/sync snapshots must report actual Forge decisions');
assert(projection.includes('for(Card actual:realCombat.getBlockers(liveAttacker))') &&
       projection.includes('blockerIds.add(actual.getId())'),
       'Combat projection must not rely solely on delayed GameView blockers');
assert(frontend.includes('blockInputActive:raw.blockInputActive===true') &&
       frontend.includes("SOL_POD_BUILD='0.58.0'"),
       'Native-to-web adaptation must publish input queue readiness and correct build');
assert(planner.includes('const inputReady=()=>state()?.blockInputActive===true;') &&
       planner.includes('if(result?.blockApplied!==!previously)') &&
       planner.includes('if(accepted?.blockDecisionAccepted!==true)') &&
       planner.includes('submittedStage=stage'),
       'Planner must require active input and live ACK, and avoid a duplicate confirmation');
assert(safety.includes("payload?.action==='combat.block'||payload?.action==='confirmBlocks'"),
       'Combat input-transition failures must be handled inline, not by a second modal');
assert(build.includes("SOL_POD_BUILD='0.58.0'") &&
       build.includes("tag.textContent='v0.58'"));
if(process.argv[2]){
 const html=read(process.argv[2]);
 assert(html.includes('blockInputActive:raw.blockInputActive===true') &&
        html.includes('blockDecisionAccepted') &&
        html.includes('blockApplied') &&
        html.includes("SOL_POD_BUILD='0.66.0'"),
        'The built Android HTML lacks the v0.55 blocker handshake');
}
console.log('PASS Sol Pod v0.55: live InputQueue/Combat, verified blocker and confirm ACKs, stale-state UI recovery');
