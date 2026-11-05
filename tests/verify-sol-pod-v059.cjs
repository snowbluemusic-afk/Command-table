'use strict';
// v0.59 UI contract. Forge still owns legality, stack, priority and combat.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
const hand=read('forge-integration/web/sol-pod-hand-grid-v059.js');
const patch=read('forge-integration/tools/patch_gameplay_v059.py');
new vm.Script(hand,{filename:'sol-pod-hand-grid-v059.js'});
for(const key of ['window.solPodHandGrid','handForgeIds?.[index]','handCards?.[index]',
  'window.CommandTableAction?.(\'showHandCard\',String(index))',
  "const search=create('input')","state.filter==='legal'","state.sort==='name'",
  'window.ctForgeSelection?.isLegalCard?.(id)']){
  assert(hand.includes(key),'The sortable hand must preserve Forge identities: '+key);
}
assert(!hand.includes("request('choice.answer'") &&
       !hand.includes("request('game.command'"),
       'The browser must never override Forge decisions or casting');
for(const key of ['function quickBinary(choice=current)','labels.includes(\'yes\')',
  "if(quickBinary())void answer(false);",
  "choice.commanderDestination || choice.allowSkip || needsVerification",
  "const groups=[]","targetNames(item).join('|')",
  'const entry=game()?.damageHistory?.[0]',
  "window.SOL_POD_BUILD='0.59.0';"]){
  assert(patch.includes(key),'Expected safe gameplay patch: '+key);
}
if(process.argv[2]){
 const html=read(process.argv[2]);
 for(const key of ["window.SOL_POD_BUILD='0.59.0'",
  'window.solPodHandGrid','function quickBinary(choice=current)',
  "if(quickBinary())void answer(false);",
  'const groups=[]',"const entry=game()?.damageHistory?.[0]"]){
   assert(html.includes(key),'Missing packaged v0.59 UX: '+key);
 }
 const embedded=html.match(/<script>\s*\/\* Sol Pod v0\.59 — native-hand grid[\s\S]*?<\/script>/);
 assert(embedded,'Hand grid must actually be injected into the Android HTML');
 new vm.Script(embedded[0].replace(/^\s*<script>/,'').replace(/<\/script>\s*$/,''));
}
console.log('PASS Sol Pod v0.59: searched/sorted hand identity, explicit binary ACK, visual stack grouping, Forge log source');
