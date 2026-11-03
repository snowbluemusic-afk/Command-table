'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
const overlay=read('forge-integration/src/main/java/forge/app/CommandTableOverlay.java');
const safety=read('forge-integration/web/forge-resilience-v035.js');
const cast=read('forge-integration/web/forge-simple-cast.js');
const patch=read('forge-integration/tools/patch_frontend.py');
new Function(safety);new Function(cast);
const checks=[
 ['Native requests are not all queued behind cast',
  overlay.includes('worker=INTERACTIVE')&&overlay.includes('worker=CONTROL')&&overlay.includes('worker=REQUESTS')],
 ['Follow-up target and choice inputs can unblock pending casts',
  overlay.includes('"choice.answer".equals(type)')&&overlay.includes('"chooseCastTarget".equals(action)')],
 ['Nested interactive abilities are not serially deadlocked',
  overlay.includes('INTERACTIVE = Executors.newFixedThreadPool(4)')],
 ['Cast preflight is called before dispatch',
  cast.indexOf('ctForgeSafety?.checkCast(choice)')<cast.indexOf("request=window.CommandTableNative.request('game.command'")],
 ['Cast preflight preserves the card preview',
  cast.includes('open(choice,safety.reason)')],
 ['Generic native requests always expire after a deadline',
  patch.includes('const ctRequestDeadline = type =>')&&patch.includes("problem.code='FORGE_TIMEOUT'")],
 ['Timed-out native requests remove pending promise records',
  patch.includes('pending.delete(id);')&&patch.includes('clearTimeout(p.timer);')],
 ['Recovery does not blindly replay a cast',
  safety.includes("await nativeRequest('game.snapshot')")&&safety.includes('unknownResult=false')],
 ['Mandatory Forge choices block new casting',
  safety.includes('ctForgeChoice?.hasPending')&&safety.includes('ctForgePriority?.isManaPayment')],
 ['Front-end reports rejected and timed-out commands',
  safety.includes('showError(error,')&&safety.includes('Forge rejected the action')],
 ['Tutorial has 12 steps',patch.includes("['RECOVER FROM ERRORS'")],
 ['Tutorial has blocker-first guidance',patch.includes('Tap YOUR blocker FIRST')],
 ['Tutorial describes stack, activated abilities and Forge recovery',
  patch.includes('The stack resolves last-in, first-out')&&patch.includes('Activate ability')&&patch.includes('A timed-out action may still be processing')]
];
for(const [name,pass] of checks)assert(pass,'FAIL '+name);
class El{
 constructor(tag){this.tag=tag;this.children=[];this.style={};this.attrs={};this.classList={add(){},remove(){}};}
 append(...v){this.children.push(...v);v.forEach(n=>n.parentNode=this);}
 prepend(v){this.children.unshift(v);v.parentNode=this;}
 remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(x=>x!==this);}
 replaceChildren(...v){this.children=[];this.append(...v);}
 setAttribute(k,v){this.attrs[k]=v;}
 getAttribute(k){return this.attrs[k]??null;}
}
const rail=new El('div'),head=new El('head'),body=new El('body');
const doc={head,body,createElement:x=>new El(x),
 getElementById:id=>id==='sol-pod-hub-content'?rail:null};
const calls=[],notices=[];
let mode='ok';
const native={async request(type,payload={}){
 calls.push({type,payload});
 if(type==='game.command'&&payload.action==='castById'){
  if(mode==='insufficient')throw new Error('Forge rejected mana payment');
  if(mode==='timeout'){
   const e=new Error('Forge timed out');e.code='FORGE_TIMEOUT';throw e;
  }
  if(mode==='never')return new Promise(()=>{});
 }
 if(type==='engine.status')return {ready:true,engine:'forge'};
 if(type==='game.snapshot')return {game:{turn:1,players:[{hand:[]}]}}
 return {ok:true};
}};
const p={hand:['Mountain','Spell'],handForgeIds:[11,12],commandZone:[],priority:true};
const win={
 app:{nativeMatch:true,view:'game',game:{phase:'main1',winner:null,players:[p]}},
 ctForgeChoice:{hasPending:false},ctForgePriority:{isHandChoice:false,isManaPayment:false,
  refresh(){}},
 ctForgeSelection:{refresh(){}},
 ctReceiveForgeState(){},solPodNotice:(...x)=>notices.push(x),
 ctNativeToast(){},ctDirectCombat:{pending:0}
};
vm.runInNewContext(safety,{window:win,document:doc,CommandTableNative:native,Promise,Number,String,Date,Math},{filename:'forge-resilience-v035.js'});
(async()=>{
 const block=()=>win.ctForgeSafety.checkCast({id:12});
 p.priority=false;
 assert(!block().ok,'Opponent priority must block Cast before reaching Forge');
 p.priority=true;
 win.ctForgeChoice.hasPending=true;
 assert(!block().ok,'Mandatory choice must block another cast');
 win.ctForgeChoice.hasPending=false;
 win.ctForgePriority.isManaPayment=true;
 assert(!block().ok,'Pending mana payment must block another cast');
 win.ctForgePriority.isManaPayment=false;
 assert(!win.ctForgeSafety.checkCast({id:999}).ok,'Moved card must not cast');
 assert(block().ok,'Legal turn/card should reach authoritative Forge');
 const before=calls.length;
 await assert.rejects(native.request('game.command',{action:'castById',value:999}),/no longer/);
 assert.equal(calls.length,before,'Preflight must prevent native invalid ID');
 mode='insufficient';
 await assert.rejects(native.request('game.command',{action:'castById',value:12}),/mana payment/);
 assert(!win.ctForgeSafety.castBusy,'Rejected mana payment must release cast lock');
 assert(rail.children.some(n=>n.id==='ct-forge-safety'),'Error recovery panel must remain available');
 mode='timeout';
 await assert.rejects(native.request('game.command',{action:'castById',value:12}),/timed out/);
 assert(win.ctForgeSafety.needsRecovery,'Unconfirmed request requires recovery');
 const count=calls.length;
 await assert.rejects(native.request('game.command',{action:'castById',value:12}),/previous Forge action/);
 assert.equal(calls.length,count,'Unsafe cast must not resubmit after timeout');
 assert(await win.ctForgeSafety.recover(),'Snapshot recovery must work');
 assert(!win.ctForgeSafety.needsRecovery,'Successful refresh releases recovery lock');
 mode='never';
 const first=native.request('game.command',{action:'castById',value:12});
 await assert.rejects(native.request('game.command',{action:'castById',value:11}),/already processing/);
 await native.request('choice.answer',{choiceId:'sample'});
 assert(calls.at(-1).type==='choice.answer','Decision answers must remain available during cast');
 void first;
 console.log('PASS Sol Pod v0.35 Forge preflight, rejected mana, ambiguous timeout, recovery, nested choice ('+checks.length+' source checks)');
 if(process.argv[2]){
  const html=read(process.argv[2]);
  const start=html.indexOf('const TUTORIAL_STEPS=[');
  const end=html.indexOf('const LESSONS={',start);
  assert(start>=0&&end>start,'Generated tutorial missing');
  const script=html.slice(start,end).replace(/const TUTORIAL_STEPS=/,'return ' ).trim().replace(/;\s*$/,'');
  const steps=new Function(script)();
  assert.equal(steps.length,12,'Full onboarding must have twelve practical steps');
  assert(steps.every(s=>s.title&&s.body&&s.try),'All guide steps require a title, instructions and a practice task');
  assert(html.includes('ct-welcome-v035')&&html.includes('ct-guide-v035'));
  assert(html.includes('const ctRequestDeadline = type =>'));
  assert(html.includes('ctForgeSafety'));
  console.log('PASS generated v0.35 Android UI tutorial, recovery and native deadline integration');
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
