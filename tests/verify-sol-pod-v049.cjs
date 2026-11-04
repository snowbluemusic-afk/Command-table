'use strict';
// v0.49: player copy says Sol Pod, while the embedded Forge protocol and
// authoritative rules engine retain their original stable identifiers.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
const uiFiles=[
 'forge-choice.js','forge-selection.js','forge-simple-cast.js',
 'forge-resilience-v035.js','forge-required-action-v046.js',
 'forge-target-dialog-v040.js','forge-landscape-ui.js',
 'forge-catalog.js','forge-graveyard.js','forge-gestures.js',
 'forge-rules-trace-v040.js','sol-pod-stack-v038.js',
 'sol-pod-match-result-v043.js','sol-pod-hub-v030.js',
 'sol-pod-hud-layout-v039.js'
];
for(const filename of uiFiles){
 const s=read('forge-integration/web/'+filename);
 new (require('node:vm').Script)(s,{filename});
 const bad=s.split('\n').flatMap((line,i)=>
  /\bForge\b/.test(line)&&!/^\s*(\/\/|\/\*|\*|#)/.test(line)
    ?[i+1+': '+line.trim()]:[]);
 assert.deepEqual(bad,[],filename+' still exposes internal engine name in frontend copy');
}
const choice=read('forge-integration/web/forge-choice.js');
const safety=read('forge-integration/web/forge-resilience-v035.js');
const mulligan=read('forge-integration/web/forge-required-action-v046.js');
const cast=read('forge-integration/web/forge-simple-cast.js');
const patch=read('forge-integration/tools/patch_frontend.py');
const overlay=read('forge-integration/src/main/java/forge/app/CommandTableOverlay.java');
const input=read('forge-integration/src/main/java/forge/commandtable/CommandTableForgeInput.java');
const proxy=read('forge-integration/src/main/java/forge/commandtable/CommandTableGuiProxy.java');
assert(choice.includes('YOUR DECISION · SOL POD'));
assert(choice.includes('Refresh Sol Pod status'));
assert(safety.includes('Sol Pod needs your attention'));
assert(safety.includes('Refresh Sol Pod status'));
assert(mulligan.includes('Let Sol Pod choose instead') &&
       mulligan.includes('mulligan.bottom.select'),
 'Opening-hand card selection behavior must not change during rebranding');
assert(cast.includes('Sol Pod checks'));
assert(patch.includes('player_copy={') &&
       patch.indexOf('player_copy={')>patch.indexOf('final_outcome_hook='),
 'Generated HTML branding substitutions must run AFTER all old patch anchors');
assert(patch.includes('"Ask Forge to cast": "Cast"'),
 'End-user Cast button should not mention the engine');
assert(patch.includes('"FORGE BUILT-IN · v0.19.0": "SOL POD · v0.19.0"'));
assert(overlay.includes('"engine","forge"') &&
       overlay.includes('"provider","embedded-forge-android"'),
 'Native engine protocol identifiers must NOT be renamed');
assert(overlay.includes('case "mulligan.bottom.select":') &&
       input.includes('current instanceof InputLondonMulligan'),
 'London mulligan engine and native bridge must remain unaltered');
assert(proxy.includes('"setSelection".equals(name)'),
 'Forge selection bridge must remain authoritative');
const htmlFile=process.argv[2];
if(htmlFile){
 const html=read(htmlFile);
 const banned=[
  'Forge needs your attention',
  'Refresh Forge status',
  'Open required Forge choice',
  'Let Forge choose instead',
  'Ask Forge to cast',
  'Starting Forge Commander match',
  'Copy Forge rules diagnostics',
  'FORGE BUILT-IN',
  'Forge is still loading',
  'Forge could not cast this card',
  'FORGE RULES ENGINE'
 ];
 for(const label of banned)
  assert(!html.includes(label),'Embedded Android still displays '+label);
 for(const label of [
  'Sol Pod needs your attention','Refresh Sol Pod status',
  'Let Sol Pod choose instead','YOUR DECISION · SOL POD',
  'Copy Sol Pod rules diagnostics'
 ])
  assert(html.includes(label),'Missing player-facing Sol Pod label: '+label);
 assert(html.includes('mulligan.bottom.select'),
  'Rebranding must not break manual bottom-card selection');
}
console.log('PASS v0.49: player UI branded Sol Pod, gameplay and native Forge API preserved');
