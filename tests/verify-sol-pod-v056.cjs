'use strict';
// P0: Forge may be in COMBAT_DECLARE_BLOCKERS WITHOUT an InputBlock.
// PhaseHandler only calls declareBlockers when CombatUtil.canBlock is true.
// Otherwise the same phase transitions to an ordinary priority decision.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
const planner=read('forge-integration/web/sol-pod-combat-planner-v051.js');
const selection=read('forge-integration/web/forge-selection.js');
const gestures=read('forge-integration/web/forge-gestures.js');
const frontend=read('forge-integration/tools/patch_frontend.py');
const native=read('forge-integration/src/main/java/forge/app/CommandTableOverlay.java');
const build=read('forge-integration/web/sol-pod-build-v053.js');
for(const code of [planner,selection,gestures,build])new vm.Script(code);
assert(planner.includes('const inStep=()=>isBlockPhase()&&inputReady();'),
 'Never display Block Planner solely because the current phase includes BLOCKERS');
assert(planner.includes("if(!inStep()){hide(true);return;}") &&
       planner.includes('if(inStep()&&stage===key&&shownFor!==key)'),
 'Closing and delayed auto-open must both check actual InputBlock readiness');
assert(frontend.includes('blockInputActive:raw.blockInputActive===true') &&
       frontend.includes("humanInput:String(raw.humanInput||'')"),
 'Frontend must receive authoritative Forge InputQueue state, not infer it from phase');
assert(native.includes('snapshot.put("blockInputActive", bridge.blockInputActive())') &&
       native.includes('snapshot.put("humanInput", bridge.inputName())'),
 'Native snapshots must use actual human input queue');
assert(selection.includes('const inBlock=inBlockPhase && game?.blockInputActive===true;') &&
       selection.includes("game?.humanInput==='InputPassPriority'"),
 'Priority dock must discriminate real blocker decision from phase priority');
assert(selection.includes('blockPriority?\'Block declaration complete · pass priority to continue combat\'') &&
       selection.includes("ordinary && blockPriority?'Pass priority'"),
 'Players must get usable Pass priority when blocking was automatically skipped');
assert(selection.includes('!waitingForInput') &&
       selection.includes("['none','transitioning']"),
 'The dock must not submit a stale button click while input queue is empty');
assert(gestures.includes("window.app?.game?.blockInputActive===true?'block':null"),
 'Direct combat gestures must not issue block commands against InputPassPriority');
assert(build.includes("SOL_POD_BUILD='0.56.0'")&&build.includes("tag.textContent='v0.56'"),
 'Android screen must identify the phase-aware blocker build');
if(process.argv[2]){
 const html=read(process.argv[2]);
 assert(html.includes("SOL_POD_BUILD='0.56.0'") &&
        html.includes('const inStep=()=>isBlockPhase()&&inputReady();') &&
        html.includes("humanInput:String(raw.humanInput||'')"),
        'Packaged Android app must include v0.56 no-blocker priority fix');
}
console.log('PASS Sol Pod v0.56: no phantom blockers, real InputBlock only, normal pass-priority on auto-skip');
