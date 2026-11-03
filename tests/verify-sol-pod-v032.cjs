'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
const gesture=read('forge-integration/web/forge-gestures.js');
const ui=read('forge-integration/web/sol-pod-ux-v032.js');
const patch=read('forge-integration/tools/patch_frontend.py');
const selection=read('forge-integration/web/forge-selection.js');
new Function(gesture);new Function(ui);
const checks=[
 ['Blocking starts from own blocker',gesture.includes("selectedBlocker=id===selectedBlocker?null:id")],
 ['Attacker selected second',gesture.includes("selectSourceAndTarget(blockerId,{kind:'card',id},'block')")],
 ['Atomic Forge combat assignment',gesture.includes("const action=dragMode==='attack'?'combat.attack':'combat.block'")],
 ['No separate blocker/attacker cardId taps',!gesture.includes('selectedBlockTarget')],
 ['Keep pending assignments serialized',gesture.includes('commandQueue=commandQueue.catch(()=>{}).then(task)')],
 ['Explicit hand button by Zones',patch.includes('class="sol-hand-toggle" data-action="toggleHandZoom"')],
 ['Hand count no longer clickable',patch.includes('<span class="sol-hand-count">YOUR HAND')],
 ['Player roster takes precedence',ui.includes('body:has(.sol-battlefield.sol-roster-expanded) #sol-pod-hub')],
 ['Event rail uses vertical gap',ui.includes('max-height:42dvh')],
 ['Real native blocker instructions',selection.includes('Tap blocker → attacker')],
 ['Rules unchanged',read('forge-integration/src/main/java/forge/commandtable/CommandTableForgeInput.java').includes('human().selectCard(attacker')]
];
for(const [name,yes] of checks)assert(yes,'FAIL '+name);

// Behaviour regression: a tap on our blocker, then a tap on their attacking
// creature must produce exactly ONE native combat.block call in that order.
async function blockerFlow(){
 const listeners={},sent=[],notices=[];
 const myCard={
  classList:{add(){},remove(){}},
  getAttribute(name){return name==='data-value'?'33':null;}
 };
 const enemyCard={
  classList:{add(){},remove(){}},
  getAttribute(name){return name==='data-value'?'44':null;}
 };
 const create=()=>({style:{},setAttribute(){},getAttribute(){return null;},append(){},
  classList:{add(){},remove(){}},set textContent(v){this._text=v;},get textContent(){return this._text;}});
 const document={
  body:{append(){}},head:{append(){}},
  createElementNS:create,createElement:create,
  getElementById(){return null;},
  addEventListener(type,fn){(listeners[type]??=[]).push(fn);},
  querySelectorAll(selector){return selector.includes('.ct10-lane-own')?[myCard]:[];}
 };
 const window={
  app:{nativeMatch:true,view:'game',modal:'',game:{
    winner:null,phaseDetail:'COMBAT_DECLARE_BLOCKERS',
    players:[{forgeId:11,battlefield:[{forgeId:33,creature:true}]}],
    combat:[{cardId:44,blockerIds:[]}]
  }},
  solPodNotice(message){notices.push(message);},
  dispatchEvent(){},addEventListener(){},
  Event:class Event{constructor(name){this.type=name;}},
  CommandTableNative:{async request(action,arg){
    sent.push({action,arg});
    if(action==='game.snapshot')return {game:{combat:[{cardId:44,blockerIds:[33]}]}};
    return {ok:true};
  }},
  ctReceiveForgeState(){}
 };
 const ctx={window,document,Promise,Number,Date,Math,String,Array,
   setTimeout:(fn,ms)=>{if(ms<10000)fn();return 1;},clearTimeout(){},
   MutationObserver:undefined};
 vm.runInNewContext(gesture,ctx,{filename:'forge-gestures.js'});
 const target=which=>({
   closest(selector){
     if(which==='mine'&&selector.includes('.ct10-lane-own.ct10-creatures'))return myCard;
     if(which==='enemy'&&selector.includes('.ct10-lane-opp.ct10-creatures'))return enemyCard;
     return null;
   }
 });
 const tap=which=>{
  const e={target:target(which),preventDefault(){this.prevented=true;},
    stopImmediatePropagation(){this.stopped=true;}};
  for(const fn of listeners.click||[]){fn(e);if(e.stopped)break;}
  return e;
 };
 tap('enemy');
 assert.equal(sent.length,0,'Attacker-first tap must not issue a native command');
 tap('mine');
 assert.equal(window.ctDirectCombat.selectedBlockerId,33,'Our blocker is selected');
 assert.equal(sent.length,0,'Blocker selection alone is UI-only');
 tap('enemy');
 await window.ctDirectCombat.whenIdle();
 assert.equal(window.ctDirectCombat.selectedBlockerId,null);
 const native=sent.filter(s=>s.action==='game.command');
 assert.equal(native.length,1,'Two taps must become one Forge command');
 assert.equal(native[0].arg.action,'combat.block');
 assert.equal(native[0].arg.value.attackerId,44);
 assert.equal(native[0].arg.value.blockerId,33);
 assert(notices.some(s=>s.includes('Block confirmed')),'Confirmed result should be visible');
 console.log('PASS native blocker-first, attacker-second interaction');
}
blockerFlow().then(()=>{
 console.log('PASS Sol Pod v0.32 layout and gameplay regressions ('+checks.length+' static checks)');
}).catch(error=>{console.error(error);process.exitCode=1;});
