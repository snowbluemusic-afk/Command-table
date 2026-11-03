'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const read=x=>fs.readFileSync(x,'utf8');
const gesture=read('forge-integration/web/forge-gestures.js');
const choice=read('forge-integration/web/forge-choice.js');
const notifications=read('forge-integration/web/sol-pod-notifications-v029.js');
const bottom=read('forge-integration/web/sol-pod-ux-v033.js');
const selection=read('forge-integration/web/forge-selection.js');
const patch=read('forge-integration/tools/patch_frontend.py');
for(const [name,code] of [['gestures',gesture],['choices',choice],['notices',notifications],['bottom',bottom],['selection',selection]]){
 new Function(code);
}
const checks=[
 ['Compact hand no longer extends below viewport',bottom.includes('bottom:max(1.2%, env(safe-area-inset-bottom))')],
 ['Compact hand clips within its tray, not device edge',bottom.includes('height:100%!important;max-height:100%!important')],
 ['Hand is scrollable',bottom.includes('overflow-x:auto!important;overflow-y:hidden!important')],
 ['Buttons moved to left',bottom.includes('left:17.2%!important')&&bottom.includes('left:28.1%!important')],
 ['Hand constrained to free space left of priority',bottom.includes('left:39.3%!important;width:35.2%!important')],
 ['Expanded hand remains available',bottom.includes('.sol-battlefield.ct10-hand-zoom .ct10-hand-wrap')],
 ['Forge choices require explicit confirmation when requested',choice.includes("&& !current.confirm) void answer(false)")],
 ['Allocation cannot confirm an invalid total',choice.includes('ok.disabled=inFlight||needsVerification||total!==Number(current.amount||0)')],
 ['Retry choice is blocked until status has been replayed',choice.includes('needsVerification=true')&&choice.includes('if(needsVerification){needsVerification=false;answerGeneration++')],
 ['Rapid blocking is queued instead of silently rejected',!gesture.includes('The previous block is being applied. Select another blocker once Forge confirms it.')],
 ['Hung combat assignments enter safe recovery mode',gesture.includes('unresolved=true')&&gesture.includes('recover:async()=>')],
 ['Confirm Blocks stays disabled for unverified requests',gesture.includes('get pending(){return queued+(unresolved?1:0)')],
 ['Priority dock offers Refresh combat',selection.includes('Refresh combat')&&selection.includes('ctDirectCombat.recover()')],
 ['Dismissed guidance does not suppress a later error',notifications.includes("kind!=='error'&&(dismissed.get(key)||0)>Date.now()")],
 ['New HUD loaded by Forge HTML transform',patch.includes("sol-pod-ux-v033.js")]
];
for(const [name,yes] of checks)assert(yes,'FAIL '+name);
const createNode=(id)=>({getAttribute:k=>k==='data-value'?String(id):null,classList:{add(){},remove(){}}});
const own=[33,34].map(createNode),enemy=[44,45].map(createNode);
const combat=[44,45].map(cardId=>({cardId,blockerIds:[]}));
const listeners={},nativeCommands=[],messages=[];
const el=()=>({style:{},setAttribute(){},append(){},classList:{add(){},remove(){}}});
const doc={head:{append(){}},body:{append(){}},getElementById:()=>null,
 createElement:el,createElementNS:el,
 addEventListener:(name,fn)=>{(listeners[name]??=[]).push(fn);},
 querySelectorAll:s=>s.includes('ct10-lane-own')?own:[]};
const w={
 app:{nativeMatch:true,view:'game',modal:'',game:{
  winner:null,phaseDetail:'COMBAT_DECLARE_BLOCKERS',
  players:[{forgeId:11,battlefield:[{forgeId:33,creature:true},{forgeId:34,creature:true}]}],combat}},
 Event:class Event{},dispatchEvent(){},addEventListener(){},
 solPodNotice:(msg)=>messages.push(msg),
 ctReceiveForgeState:game=>{w.app.game.combat=game.combat;},
 CommandTableNative:{async request(action,arg){
  if(action==='game.command'){
   nativeCommands.push(arg);
   // Give a second user tap the opportunity to queue before completion.
   await Promise.resolve();
   const attack=combat.find(c=>c.cardId===arg.value.attackerId);
   if(attack)attack.blockerIds.push(arg.value.blockerId);
  }
  if(action==='game.snapshot')return {game:{combat:combat.map(c=>({...c,blockerIds:[...c.blockerIds]}))}};
  return {ok:true};
 }}
};
const noopTimer=(fn,delay)=>{if(delay<=200)fn();return 1;};
vm.runInNewContext(gesture,{document:doc,window:w,Promise,Math,Date,Number,Array,String,
 MutationObserver:undefined,setTimeout:noopTimer,clearTimeout(){}},{filename:'forge-gestures.js'});
const tap=(side,index)=>{
 const el=(side==='own'?own:enemy)[index];
 const target={closest:sel=>sel.includes(side==='own'?'ct10-lane-own':'ct10-lane-opp')?el:null};
 const event={target,preventDefault(){},stopImmediatePropagation(){this.stopped=true;}};
 for(const fn of listeners.click||[]){fn(event);if(event.stopped)break;}
};
// No artificial wait between the two assignments.
tap('own',0);tap('enemy',0);tap('own',1);tap('enemy',1);
w.ctDirectCombat.whenIdle().then(()=>{
 assert.equal(nativeCommands.length,2,'Two rapid taps should yield two native block requests');
 assert.deepEqual(nativeCommands.map(x=>[x.value.blockerId,x.value.attackerId]),[[33,44],[34,45]]);
 assert.deepEqual(combat.map(x=>x.blockerIds),[[33],[34]]);
 console.log('PASS Sol Pod v0.33 UX checks ('+checks.length+') and rapid two-blocker behaviour');
}).catch(e=>{console.error(e);process.exitCode=1;});
