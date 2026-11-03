'use strict';
// Sol Pod v0.45: actionable Forge recovery must not be hidden in Game Log.
// Verify live recovery choices and prohibit duplicate cast on timeout.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
const safety=read('forge-integration/web/forge-resilience-v035.js');
const cast=read('forge-integration/web/forge-simple-cast.js');
const input=read('forge-integration/src/main/java/forge/commandtable/CommandTableForgeInput.java');
const overlay=read('forge-integration/src/main/java/forge/app/CommandTableOverlay.java');
new vm.Script(safety);
new vm.Script(cast);
assert(safety.includes("retryPanel.setAttribute('aria-modal','true')"),
 'Recovery must be a blocking accessible dialog');
assert(safety.includes('document.body.append(retryPanel)'),
 'Recovery cannot live in a collapsed Game Log');
assert(!safety.includes("document.getElementById('sol-pod-hub-content')"),
 'Never attach recovery to the Game Log');
assert(!safety.includes("solPodNotice?.(message,'error'"),
 'Action-required recovery must not only be logged');
assert(safety.includes('status?.castInProgress'),
 'Do not mark recovery complete while native Forge still has the cast');
assert(safety.includes('ctForgeChoice?.hasPending'),
 'A required Forge choice takes precedence over cancellation');
assert(cast.includes('if(window.ctForgeSafety?.recoveryVisible){hide();return;}'),
 'A failed cast cannot reopen a card sheet over the recovery modal');
assert(overlay.includes('.put("choicePending",choices!=null && choices.hasPending())'),
 'Recovery must know when Forge has a decision even if the JS sheet is temporarily missing');
assert(overlay.includes('.put("castInProgress",castInProgress)'),
 'Engine status must report actual in-flight native casting');
assert(overlay.includes('finally {if(isCast)castInProgress=false;}'),
 'Native cast-in-progress flag must be released after cast completion');
assert(input.includes('FThreads.invokeInEdtNowOrLater(() -> human().selectButtonCancel());'),
 'Cancel request must not block the WebView behind Forge GL-thread interaction');
class El{
 constructor(tag){
  this.tag=tag;this.children=[];this.parentNode=null;this.attrs={};
  this.style={};this.dataset={};this.textContent='';this.className='';
  this.disabled=false;
 }
 append(...items){
  for(const node of items){
   if(node.parentNode)node.parentNode.children=node.parentNode.children.filter(x=>x!==node);
   node.parentNode=this;this.children.push(node);
  }
 }
 replaceChildren(...items){this.children=[];this.append(...items);}
 remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(x=>x!==this);this.parentNode=null;}
 setAttribute(key,value){this.attrs[key]=value;}
}
const rail=new El('div'),document={
 head:new El('head'),body:new El('body'),createElement:tag=>new El(tag),
 getElementById:id=>id==='sol-pod-hub-content'?rail:null
};
const calls=[],notices=[];
let nativeBusy=true,forceTimeout=true,choicePending=false,nativeChoice=false,hidden=0,updated=0;
const native={request:async(type,payload={})=>{
 calls.push({type,payload});
 if(type==='game.command'&&payload.action==='castById'&&forceTimeout){
  const e=new Error('Forge cast timed out');e.code='FORGE_TIMEOUT';throw e;
 }
 if(type==='engine.status')return {castInProgress:nativeBusy,choicePending:nativeChoice,ready:true};
 if(type==='game.snapshot')return {game:{turn:8,players:[{id:1}]}};
 return {accepted:true};
}};
const window={
 app:{nativeMatch:true,view:'game',
  game:{phase:'main1',winner:null,players:[{
   priority:true,handForgeIds:[42],commandZone:[{id:44,commander:true}]
  }]}},
 ctForgeChoice:{get hasPending(){return choicePending;}},
 ctForgePriority:{isManaPayment:false,isHandChoice:false,refresh(){}},
 ctForgeSelection:{refresh(){}},ctDirectCombat:{pending:0},
 ctReceiveForgeState:()=>updated++,
 ctSimpleCast:{hide:()=>hidden++},
 ctNativeToast:()=>{},solPodNotice:(...args)=>notices.push(args)
};
vm.runInNewContext(safety,{window,document,CommandTableNative:native,Promise,Number,String,Date,Math});
function modal(){
 const element=document.body.children.find(x=>x.id==='ct-forge-safety');
 assert(element,'Recovery must exist on document.body');
 assert.equal(element.attrs.role,'dialog');
 assert.equal(element.attrs['aria-modal'],'true');
 assert(!rail.children.includes(element),'Game Log must not contain recovery controls');
 return element;
}
function buttons(){
 return modal().children[0].children.at(-1).children.map(e=>e.textContent);
}
(async()=>{
 await assert.rejects(native.request('game.command',{action:'castById',value:42}),/timed out/);
 assert(window.ctForgeSafety.needsRecovery);
 assert.equal(notices.length,0,'Actionable errors must not be relegated to Game Log');
 assert(buttons().includes('↻ Refresh Forge status'));
 assert(buttons().includes('Cancel pending action'));
 assert(hidden>0,'Recovery should hide stale cast preview');
 const submitted=calls.filter(x=>x.type==='game.command'&&x.payload.action==='castById').length;
 assert.equal(await window.ctForgeSafety.recover(),false);
 assert(window.ctForgeSafety.recoveryVisible);
 assert(window.ctForgeSafety.needsRecovery);
 assert.equal(calls.filter(x=>x.type==='game.command'&&x.payload.action==='castById').length,submitted,
  'Refresh must not submit any new spell');
 choicePending=true;
 window.ctForgeSafety.showError(new Error('A choice is pending'));
 assert(buttons().includes('Open required Forge choice'));
 assert(!buttons().includes('Cancel pending action'),
  'Cannot cancel a potentially mandatory choice');
 choicePending=false;nativeBusy=false;nativeChoice=true;forceTimeout=false;
 assert.equal(await window.ctForgeSafety.recover(),false,
  'Native Forge may have an unanswered decision even when the JS sheet is not rendered');
 assert(buttons().includes('Open required Forge choice'),
  'Native pending choice must never lead to an unsafe Cancel suggestion');
 nativeChoice=false;
 assert.equal(await window.ctForgeSafety.recover(),true);
 assert.equal(window.ctForgeSafety.recoveryVisible,false);
 assert.equal(window.ctForgeSafety.needsRecovery,false);
 assert(updated>=2,'Refresh should apply authoritative Forge snapshots');
 window.ctForgeSafety.showError(new Error('Cancel a pending mana payment'));
 assert.equal(await window.ctForgeSafety.cancelAndRecover(),true);
 assert(calls.some(x=>x.type==='game.command'&&x.payload.action==='cancelCastTarget'),
  'Cancel must send native Forge cancel instead of just dismissing');
 assert.equal(window.ctForgeSafety.recoveryVisible,false);
 const bundled=process.argv[2];
 if(bundled){
  const html=read(bundled);
  assert(html.includes('ct-forge-safety')&&html.includes('Refresh Forge status'),
   'Embedded APK must include full-screen recovery controls');
  assert(html.includes('status?.castInProgress'),
   'Embedded APK must check live native cast progress');
  assert(html.includes('recoveryVisible'),
   'Embedded cast preview must yield to recovery dialog');
 }
 console.log('PASS Sol Pod v0.45: full-screen actionable recovery, safe refresh, cancel, required choice, no duplicate casts');
})().catch(error=>{console.error(error);process.exitCode=1;});
