'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const patch=fs.readFileSync('forge-integration/tools/patch_frontend.py','utf8');
const css=fs.readFileSync('forge-integration/web/sol-pod-ux-v034.js','utf8');
new Function(css);
const checks=[
 ['Forge provides legal-card selection, never JavaScript guessed mana',
   patch.includes('window.ctForgeSelection?.isLegalCard?.(me.handForgeIds?.[i])')],
 ['Visual sort retains the source hand index for all card actions',
   patch.includes('handOrder.map(({n,i},visualIndex)=>{') &&
   patch.includes('const c=card(n),offset=visualIndex-')],
 ['Cards remain in original order while mulligan or pending choice',
   patch.includes("g.phase!=='mulligan'") && patch.includes('!window.ctForgeChoice?.hasPending')],
 ['One YOUR HAND button replaces the old separate Enlarge Hand button',
   patch.includes('class="sol-hand-toggle sol-hand-pill"') &&
   patch.includes('source=source.replace(old_toggle,new_toggle)')],
 ['Mulligan can collapse and defaults to expanded',
   patch.includes('!app.mulliganHandClosed') && patch.includes("app.mulliganHandClosed=!app.mulliganHandClosed")],
 ['How to Play updated',
   patch.includes('Tap YOUR HAND beside Zones to browse your cards')],
 ['Expanded and mulligan panels bounded to left area',
   css.includes('width:72.5%!important') && css.includes('left:1.5%!important')],
 ['Right side no longer dimmed by full-viewport box shadow',
   css.includes('box-shadow:0 15px 35px #000d!important')],
 ['Game Events and Phase & Priority remain interactive',
   css.includes('#sol-pod-hub') && css.includes('#ct-forge-priority-buttons')],
 ['Compact hand remains scrollable and clear of nav area',
   css.includes('overflow-x:auto!important') && css.includes('env(safe-area-inset-bottom)')]
];
for(const [name,ok] of checks)assert(ok,'FAIL '+name);
if(process.argv[2]){
 const html=fs.readFileSync(process.argv[2],'utf8');
 const begin=html.indexOf('const mayRankHand=');
 const end=html.indexOf('const playerTarget=',begin);
 assert(begin>=0&&end>begin,'Patched game HTML did not contain v0.34 hand mapping');
 const fragment=html.slice(begin,end);
 const fn=new Function('me','g','app','window','card','smallCard',fragment+'\nreturn hand;');
 const cards={hand:['A','B','C'],handForgeIds:[101,102,103]};
 const g={phase:'main1',autoPilot:false};
 const app={nativeMatch:true,pendingCast:null,selected:-1};
 const window={ctForgeChoice:{hasPending:false},ctForgePriority:{isHandChoice:false},
  ctForgeSelection:{isLegalCard:id=>id===102||id===103,prompt:''}};
 const card=name=>({name});
 const smallCard=(c,opts)=>'<probe card="'+c.name+'" index="'+opts.value+'" drag="'+opts.dragIndex+'"/>';
 const get=()=>[...fn(cards,g,app,window,card,smallCard).matchAll(/<probe card="([^"]+)" index="([^"]+)" drag="([^"]+)"\/>/g)]
   .map(x=>[x[1],Number(x[2]),Number(x[3])]);
 assert.deepEqual(get(),[['B',1,1],['C',2,2],['A',0,0]],
  'Playable cards must sort first without mutating Forge indices');
 g.phase='mulligan';
 assert.deepEqual(get(),[['A',0,0],['B',1,1],['C',2,2]],
  'Mulligan selection must retain physical hand order');
 g.phase='main1';window.ctForgeChoice.hasPending=true;
 assert.deepEqual(get(),[['A',0,0],['B',1,1],['C',2,2]],
  'Active Forge choice must not reorder hand');
 console.log('PASS v0.34 generated-hand behaviour: Forge legal cards first, original IDs preserved, stable in choices');
 assert(html.includes('class="sol-hand-toggle sol-hand-pill"'),'YOUR HAND toggle missing in generated app');
 assert(html.includes('sol-pod-ux-v034'),'New CSS not bundled');
}
console.log('PASS Sol Pod v0.34 UI and source regressions ('+checks.length+' checks)');
