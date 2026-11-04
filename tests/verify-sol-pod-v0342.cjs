'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const selection=fs.readFileSync('forge-integration/web/forge-selection.js','utf8');
const patch=fs.readFileSync('forge-integration/tools/patch_frontend.py','utf8');
new Function(selection);
const checks=[
 ['Block step explains correct selection order',selection.includes('Use Block Planner: choose an incoming attacker')],
 ['No misleading No blocks button',!selection.includes("'No blocks'")],
 ['Unselected blocker button is non-submitting',selection.includes('(inBlock&&ok&&combatCount===0)')],
 ['Skipping blocks is explicit',selection.includes("skip.textContent='Skip blocking'")&&selection.includes('skip.onclick=()=>decide(true)')],
 ['Pending Forge assignments disable skip',selection.includes('skip.disabled=busy||syncBusy||pendingAssignments>0')],
 ['Full inspector activates exact owned permanent ID',patch.includes('class="ct-native-activated-action"')&&patch.includes('app.inspectOwner===0&&forgeId!=null')],
 ['Native activation reuses Forge cardId command',patch.includes('data-action="cardId" data-value=')],
 ['Generic inspection cannot inherit prior permanent',patch.includes('case \'inspect\':app.inspectOwner=null;app.inspectForgeId=null;')],
 ['Commander view cannot inherit prior permanent',patch.includes('case \'inspectCommander\':app.inspectOwner=null;app.inspectForgeId=null;')]
];
for(const [name,passed] of checks)assert(passed,'FAIL '+name);
if(process.argv[2]){
 const html=fs.readFileSync(process.argv[2],'utf8');
 const begin=html.indexOf('function modalHtml()');
 const end=html.indexOf('function syncNativeOrientation()',begin);
 assert(begin>=0 && end>begin,'Generated Forge HTML missing actual modalHtml function');
 const code=html.slice(begin,end)+'\nreturn modalHtml();';
 const app={
  nativeMatch:true,modal:'inspect',inspect:'Thrashing Brontodon',
  selected:null,selectedCard:'Thrashing Brontodon',
  inspectOwner:0,inspectForgeId:42,
  game:{players:[{priority:true,hand:[],battlefield:[{forgeId:42,name:'Thrashing Brontodon'}],
   commander:'Krenko'}]}
 };
 const text='{1}, Sacrifice Thrashing Brontodon: Destroy target artifact or enchantment.';
 const card=name=>({name,type:'Creature — Dinosaur',cost:'{1}{G}{G}',text,
   keywords:[],implemented:true});
 const deps=['app','card','esc','artUrl','targetOptions','canCast','equalName','isLand','badge','smallCard','window'];
 const render=new Function(...deps,code);
 const run=()=>render(app,card,s=>String(s).replace(/"/g,'&quot;'),()=>'',()=>[],
  ()=>false,(a,b)=>a===b,()=>false,()=>'',()=>'',{ctForgeCards:{}});
 const own=run();
 assert(own.includes('Activate ability ↗'),'Own Brontodon must expose Activate ability');
 assert(own.includes('data-action="cardId" data-value="42"'),
  'Ability must target the actual Forge permanent ID 42, not its name');
 assert(!own.includes('disabled>Activate ability'),'Own in-priority ability should be actionable');
 app.inspectOwner=1; assert(!run().includes('Activate ability ↗'),'Opponent permanent must not activate');
 app.inspectOwner=0;app.inspectForgeId=999;
 assert(!run().includes('Activate ability ↗'),'Stale card ID must not activate');
 app.inspectForgeId=42;app.game.players[0].priority=false;
 assert(run().includes('disabled>Activate ability ↗'),
  'An out-of-priority ability cannot send a Forge request');
 console.log('PASS actual generated full-inspector Thrashing Brontodon activation and safety gating');
}
console.log('PASS Sol Pod v0.34.2 blocker wording and native activation tests ('+checks.length+')');
