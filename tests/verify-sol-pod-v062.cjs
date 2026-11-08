#!/usr/bin/env node
/* Sol Pod v0.62 contract. No engine rules are approximated in JS. */
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
const ux=read('forge-integration/web/sol-pod-gameplay-v062.js');
const combat=read('forge-integration/web/sol-pod-combat-planner-v051.js');
const target=read('forge-integration/web/forge-target-dialog-v040.js');
const attach=read('forge-integration/web/sol-pod-attachment-flow-v051.js');
const patch=read('forge-integration/tools/patch_gameplay_v059.py');
const audio=read('forge-integration/web/sol-pod-audio-auto-v060.js');
new vm.Script(ux,{filename:'sol-pod-gameplay-v062.js'});
for(const [name,body] of [['combat',combat],['target',target],['attach',attach],['audio',audio]])
 new vm.Script(body,{filename:name+'.js'});
for(const expected of [
 'window.solPodGameplayV062','ctCombatPlanner.assign','ctCombatPlanner?.confirm',
 'ctForgeSelection.choosePlayer','ctForgeSelection.chooseCard',
 'ct-fullscreen-targets','sol-v62-block-legal',
 'sol-v62-target-legal','sol-v62-damage','damageHistory',
 'prefers-reduced-motion','ct-forge-selection','ct-forge-prompt-updated'
])assert.ok(ux.includes(expected),'missing '+expected);
assert.match(ux,/game\(\)\?\.legalBlockersReady===true/,'only Forge supplies blocker legality');
assert.match(ux,/blocking\(\).*combat\.dataset\.active/,'blocker surface requires live input');
assert.match(combat,/assign:\(attackerId,blockerId\)=>command\(attackerId,blockerId\)/);
assert.match(combat,/confirm:\(\)=>\{if\(!inStep\(\)\)/);
assert.match(combat,/Block assignment/);
assert.ok(!combat.includes('shownFor=key;\n     show();'),'full-screen combat planner must not automatically cover battlefield');
assert.match(target,/const attachment=intent && \/\\b/);
assert.match(attach,/startedAt:Date\.now\(\)/);
assert.match(audio,/playCue,get settings/);
assert.ok(patch.includes("'sol-pod-gameplay-v062.js'"),'script must be embedded in APK');
assert.ok(patch.includes("SOL_POD_BUILD='0.62.0'"),'version must identify APK');
if(process.argv[2]){
 const packaged=read(process.argv[2]);
 assert.ok(packaged.includes('window.solPodGameplayV062'),'APK HTML missing v0.62 layer');
 assert.ok(packaged.includes("window.SOL_POD_BUILD='0.65.0'"),'APK HTML missing v0.62 build');
 assert.ok(packaged.includes('window.ctCombatPlanner'),'APK HTML missing live combat planner');
 assert.ok(packaged.includes('sol-v62-target-dock'),'APK HTML missing board targeting');
}
console.log('Sol Pod v0.62 source'+(process.argv[2]?' and packaged HTML':'')+' contracts passed.');
