'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
const native=read('forge-integration/src/main/java/forge/app/CommandTableOverlay.java');
const projected=read('forge-integration/src/main/java/forge/commandtable/CommandTableGameProjection.java');
const patch=read('forge-integration/tools/patch_gameplay_v059.py');
const attached=read('forge-integration/web/sol-pod-attached-stacks-v061.js');
new vm.Script(attached,{filename:'sol-pod-attached-stacks-v061.js'});
// Random opponent selection occurs NATIVE-side and never picks the
// first eligible deck by input list order. Named deck overrides random.
for(const marker of [
 'p.optString("cpuDeckName","")',
 'java.util.Collections.shuffle(candidates,new java.security.SecureRandom())',
 'new Deck(candidates.get(i%candidates.size()))',
 'if(!candidate.getName().equals(own.getName()))',
 'throw new IllegalArgumentException("Selected AI deck is not available: "'
])assert(native.includes(marker),'Opponent-selection guarantee missing: '+marker);
assert(!native.includes('saved.getJSONObject((i+j)%saved.length())'),
 'Native opponent pool still iterates in fixed first-match order');
assert(patch.includes('cpuDeckName:app.enemyDeck==="random"') &&
       patch.includes('cpuDeck:app.enemyDeck') &&
       patch.includes('AI opponent decks are random by default'),
       'First-match setup must show/randomize and send selected name');
// Forge CardView remains authoritative for equipment and aura attachment.
assert(projected.includes('CardView attachedTo=c.getAttachedTo()'));
assert(projected.includes('m.put("attachedToId", attachedTo==null?null:attachedTo.getId())'));
assert(patch.includes('attachedToId:c.attachedToId??null'));
for(const marker of [
 'window.solPodAttachmentStacks',
 'const attached=all.filter(c=>linkOf(c)===String(creatureId)',
 'lane.insertBefore(host,cardEl);host.append(cardEl,badge)',
 'badge.onclick=e=>{e.preventDefault();e.stopImmediatePropagation();show(key);};',
 'const rules=window.ctForgeCards',
 'overlay.dataset.open',
 'if(!window.app?.nativeMatch',
 'const peeks=attached.slice(0,3)'
])assert(attached.includes(marker),'Attachment visual must preserve underlying Forge targets: '+marker);
assert(!attached.includes("request('game.command'") &&
       !attached.includes('selectCard('),
       'Attachment visuals must be read-only');
// Onboarding must reflect actual hand, stack, attachments and opt-in settings.
for(const marker of [
 'Search, sort and filter your hand',
 'Equipment and Auras attached to a creature',
 'Auto-resolve is off by default',
 'Use ⚙ for sound controls',
 'Choose a deck. Opponents are random by default'
])assert(patch.includes(marker),'Onboarding copy has become stale: '+marker);
assert(patch.includes('sol-pod-attached-stacks-v061.js') &&
       patch.includes("window.SOL_POD_BUILD='0.61.0'"));
if(process.argv[2]){
 const html=read(process.argv[2]);
 for(const marker of ["window.SOL_POD_BUILD='0.67.0'",
   'window.solPodAttachmentStacks','attachedToId:c.attachedToId??null',
   'cpuDeckName:app.enemyDeck==="random"','Audio, auto-resolve and recovery',
   'Search, sort and filter your hand']){
    assert(html.includes(marker),'Missing embedded v0.61 build feature: '+marker);
 }
 const embedded=html.match(/<script>\s*\/\* Sol Pod v0\.61 — visual Aura\/Equipment[\s\S]*?<\/script>/);
 assert(embedded,'Attachment viewer must actually be injected in the APK');
 new vm.Script(embedded[0].replace(/^\s*<script>/,'').replace(/<\/script>\s*$/,''));
}
console.log('PASS v0.61 native random opponents, visible attachment stack, onboarding and APK integration');
