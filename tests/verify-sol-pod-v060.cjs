'use strict';
// v0.60 — audio is entirely optional and auto-resolve MUST NEVER acknowledge
// an arbitrary Forge input, spell, attack, block, or human choice.
const fs=require('node:fs');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
const script=read('forge-integration/web/sol-pod-audio-auto-v060.js');
const native=read('forge-integration/src/main/java/forge/commandtable/CommandTableForgeInput.java');
const overlay=read('forge-integration/src/main/java/forge/app/CommandTableOverlay.java');
const patch=read('forge-integration/tools/patch_gameplay_v059.py');
new vm.Script(script,{filename:'sol-pod-audio-auto-v060.js'});

// The native command must validate the ACTUAL, synchronized input and live
// stack on the GL thread. A blind call to bridge.confirm is unacceptable.
const method=native.split('public void passAutoTriggerPriority() {')[1]
  ?.split('public void passCombatPriority()')[0];
assert(method,'The specialized native command must exist');
for(const needle of [
 'runOnForgeUi(() -> {','current.getPlayerTurn().getId()!=current.getPlayers().get(0).getId()',
 'phase.startsWith("COMBAT_")','human().getInputQueue().getInput()',
 'instanceof InputPassPriority','current.getStack()',
 '!entry.isTrigger()','entry.getActivatingPlayer().getId()!=current.getPlayers().get(0).getId()',
 'input.selectButtonOK()'
])assert(method.includes(needle),'Missing Forge-native safety gate: '+needle);
assert(!method.includes('human().selectButtonOk()'),
  'Auto-resolve must operate on the checked live input, not generic confirmation');
assert(overlay.includes('case "passAutoTriggerPriority":') &&
       overlay.includes('bridge.passAutoTriggerPriority();') &&
       overlay.includes('"passAutoTriggerPriority".equals(action)'),
       'Auto-resolve must route on the interactive queue with a dedicated native command');
assert(script.includes("action:'passAutoTriggerPriority'") &&
       !script.includes("action:'resolve'"),
       'Auto-resolve must never send generic resolve');
for(const rule of [
 'prefs.autoResolve','issued>=60','g?.active!==0',
 'item.trigger!==true','item.controllerId','g.humanInput!==\'InputPassPriority\'',
 'window.ctForgeChoice?.hasPending',
 'window.ctForgeRequiredAction?.required',
 'window.ctFullscreenTargets?.visible',
 'window.ctForgePriority?.isManaPayment',
 'window.ctForgePriority?.isHandChoice',
 'window.ctDirectCombat?.pending',
 'document.querySelector(\'#sol-pod-stack-reader[data-open="true"]\')',
 'window.CommandTableNative.request(\'game.snapshot\')',
 'safe(g,true)','lastFingerprint=fingerprint',
 'if(g.stack.length>=2)batch=true','function resetBatch()'
])assert(script.includes(rule),'Missing auto-resolve guard: '+rule);

// Sound controls are local to the user, off by default for music, and use
// gesture-authorized Web Audio, rather than network samples or engine hooks.
for(const control of ['sound','effects','effectsVolume','ambient','ambientVolume','autoResolve'])
 assert(script.includes(control),'Missing audio/gameplay setting: '+control);
assert(script.includes('autoResolve:false') && script.includes('ambient:false') &&
       script.includes('window.AudioContext||window.webkitAudioContext') &&
       script.includes("document.addEventListener('pointerdown'") &&
       script.includes('localStorage.setItem(key,JSON.stringify(prefs))') &&
       script.includes('if(!force&&now-lastCue<700)return;') &&
       script.includes('window.solPodPreferences'),
       'Default-off automation, user control, and throttled synthesized audio required');
assert(patch.includes('sol-pod-audio-auto-v060.js') &&
       patch.includes("SOL_POD_BUILD='0.60.0'"),'Settings must ship in APK HTML');

if(process.argv[2]){
 const html=read(process.argv[2]);
 for(const marker of ["window.SOL_POD_BUILD='0.65.0'",
   'window.solPodPreferences','window.solPodHandGrid',
   "action:'passAutoTriggerPriority'"]){
   assert(html.includes(marker),'Missing APK-embedded v0.60 setting: '+marker);
 }
 const embedded=html.match(/<script>\s*\/\* Sol Pod v0\.60 — local audio controls[\s\S]*?<\/script>/);
 assert(embedded,'Audio / auto-resolve settings script must be embedded');
 new vm.Script(embedded[0].replace(/^\s*<script>/,'').replace(/<\/script>\s*$/,''));
}
console.log('PASS Sol Pod v0.60: audio controls and strict native trigger-only auto-resolve contract');
