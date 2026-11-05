'use strict';
// Sol Pod v0.57 P0: the combat dock must never disappear just because the
// cached Forge prompt/button and authoritative InputQueue disagree.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
const native=read('forge-integration/src/main/java/forge/app/CommandTableOverlay.java');
const selection=read('forge-integration/web/forge-selection.js');
const planner=read('forge-integration/web/sol-pod-combat-planner-v051.js');
const frontend=read('forge-integration/tools/patch_frontend.py');
const build=read('forge-integration/web/sol-pod-build-v053.js');
for(const js of [selection,planner,build])new vm.Script(js);

assert(native.includes('Map<String,Object> current=new LinkedHashMap<>(prompt);') &&
       native.includes('addHumanInputStatus(current);') &&
       native.includes('"payload", new JSONObject(current)'),
       'Every native prompt update must include the LIVE Forge InputQueue identity');
assert(selection.includes('if(window.app?.game && typeof p.humanInput===\'string\')') &&
       selection.includes('window.app.game.humanInput=p.humanInput;') &&
       selection.includes('window.app.game.blockInputActive=p.blockInputActive===true;') &&
       selection.includes('window.ctCombatPlanner?.sync?.();'),
       'On native prompt, apply the real queue status before repainting both controls');
assert(selection.includes("!!buttonState.enable1||!!buttonState.enable2||handChoice||") &&
       selection.includes("(combatPhase && (incomingAttack||inputName==='InputPassPriority'||game?.blockInputActive===true))") &&
       !selection.includes('!otherChoiceOpen && !waitingForInput &&'),
       'Combat dock must not vanish because cached buttons are disabled');
assert(selection.includes("if(waitingForInput){") &&
       selection.includes("refresh.textContent=syncBusy?'Refreshing…':'↻ Refresh combat'") &&
       selection.includes('refresh.onclick=()=>{void syncChoices();};'),
       'When InputQueue is transitioning, show a safe explicit Refresh combat action');
assert(selection.includes('const blockPriority=combatPhase && !inBlock') &&
       selection.includes('if(blockPriority){') &&
       selection.includes("pass.textContent=busy?'Passing…':'Pass priority'") &&
       selection.includes('pass.onclick=()=>{void decide(true);};'),
       'Actual InputPassPriority must expose a visible Pass action without cached button flags');
assert(selection.includes('queueCombatStatusCheck(') &&
       selection.includes('combatSyncAttempts>=6') &&
       selection.includes('void syncChoices();'),
       'Missing input prompts must trigger bounded read-only status reconciliation');
assert(selection.includes("const result=typeof firstReply==='function'?firstReply(value):undefined;") &&
       selection.includes("if(payload?.type==='game.state'){paintDecision();queueCombatLinks();}"),
       'The native GameView must be applied before priority visibility is recalculated');
assert(planner.includes('confirm.disabled=busy||uncertain||submittedStage===stage||!inputReady()||') &&
       !planner.includes('!window.ctForgePriority?.canConfirm;'),
       'Real InputBlock confirmation must not be disabled by old UI button labels');
assert(frontend.includes("SOL_POD_BUILD='0.58.0'") &&
       build.includes("SOL_POD_BUILD='0.58.0'") &&
       build.includes("tag.textContent='v0.58'"),
       'The actual APK must identify the fixed v0.57 controls');

if(process.argv[2]){
 const html=read(process.argv[2]);
 assert(html.includes("SOL_POD_BUILD='0.59.0'") &&
        html.includes('queueCombatStatusCheck(') &&
        html.includes('window.app.game.humanInput=p.humanInput;') &&
        html.includes("pass.textContent=busy?'Passing…':'Pass priority'"),
        'Packaged Android HTML must embed the new native input handoff and dock');
}
console.log('PASS Sol Pod v0.57: live combat input prompt, priority fallback, bounded refresh, no disappearing controls');
