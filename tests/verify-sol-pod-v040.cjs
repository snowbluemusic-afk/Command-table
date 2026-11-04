'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
const target=read('forge-integration/web/forge-target-dialog-v040.js');
const trace=read('forge-integration/web/forge-rules-trace-v040.js');
const patch=read('forge-integration/tools/patch_frontend.py');
const selection=read('forge-integration/web/forge-selection.js');
const proxy=read('forge-integration/src/main/java/forge/commandtable/CommandTableGuiProxy.java');
new Function(target);new Function(trace);
assert(patch.includes('forge-target-dialog-v040.js'),'Target dialog missing from Android build');
assert(patch.includes('forge-rules-trace-v040.js'),'Rules trace missing from Android build');
assert(patch.includes('Copy Forge rules diagnostics'),'Copy trace missing from match history');
assert(selection.includes('get chosenIds()'),'Selected targets not available to read-only dialog');
for(const event of ['updateStack','notifyStackAddition','notifyStackRemoval','updateLives','updateTurn']){
 assert(proxy.includes('"'+event+'".equals(name)'),'Forge '+event+' must publish an authoritative snapshot');
}
assert(!target.includes("action:'resolve'"),'Target UI must not resolve a Forge spell');
assert(!target.includes("action:'castById'"),'Target UI must not cast spells directly');
assert(!trace.includes('doubleMill')&&!trace.includes('setLibraryCount'),
  'Trace must observe Forge state rather than simulate Magic rules');

class El{
 constructor(tag='div',id=''){
  this.tagName=tag.toUpperCase();this.id=id;this.style={};this.dataset={};
  this.children=[];this.attrs={};this.className='';this.disabled=false;
  this.textContent='';this.listeners={};this.parentNode=null;
 }
 append(...nodes){
  for(const n of nodes){if(!n)continue;n.parentNode=this;this.children.push(n);}
 }
 replaceChildren(...nodes){this.children=[];this.append(...nodes);}
 setAttribute(k,v){this.attrs[k]=String(v);}
 getAttribute(k){return this.attrs[k]??null;}
 addEventListener(type,fn){this.listeners[type]=fn;}
 remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this);}
 focus(){this.focused=true;}
 closest(sel){return sel==='[data-action="ctCopyRulesTrace"]'&&this.attrs['data-action']==='ctCopyRulesTrace'?this:null;}
}
const body=new El('body'),head=new El('head'),root=new El('div','app');
const compact=new El('div','ct-forge-legal-actions');
body.append(root,compact);
const handlers=new Map(),listeners=[];
const doc={head,body,activeElement:compact,
 createElement:tag=>new El(tag),
 getElementById:id=>{
  function search(node){if(node.id===id)return node;for(const x of node.children){const match=search(x);if(match)return match;}return null;}
  return search(body);
 },
 addEventListener:(name,fn,capture)=>listeners.push({name,fn,capture})
};
const on=(type,fn)=>{const all=handlers.get(type)||[];all.push(fn);handlers.set(type,all);};
const fire=(type,detail={})=>(handlers.get(type)||[]).forEach(fn=>fn({detail}));
let chosen=[],targets=[],calls=[],canSelect=new Set([21,11]),pending=false;
const players=[{forgeId:11,name:'You',life:32},{forgeId:21,name:'Opponent 1',life:39}];
const app={nativeMatch:true,view:'game',modal:null,sideInspect:null,
 game:{phaseDetail:'MAIN1',winner:null,players,stack:[]}};
const selectionApi={
 get legalTargets(){return targets;},get chosenIds(){return chosen;},
 get prompt(){return 'Choose target player for this spell';},
 isLegalPlayer:id=>canSelect.has(Number(id)),
 isRequiredSelection:target=>targets.some(t=>t.kind===target.kind&&t.id===target.id),
 isLegalCard:()=>false,isLegalStack:()=>false,
 choosePlayer:async id=>{calls.push({kind:'player',id});return true;},
 chooseCard:async id=>{calls.push({kind:'card',id});return true;},
 chooseStack:async id=>{calls.push({kind:'stack',id});return true;}
};
let onState=null,lastSnapshot=null,copied='';
const native={
 onState:fn=>{onState=fn;},
 request:async type=>type==='game.snapshot'?{game:lastSnapshot}:{}
};
const win={
 app,ctForgeSelection:selectionApi,ctForgeSafety:{needsRecovery:false},
 ctForgeChoice:{get hasPending(){return pending;}},
 ctCardArtUrl:name=>'https://invalid.example/'+name,
 CommandTableNative:native,AndroidBridge:{copyText:s=>{copied=s;}},
 CommandTableNativeReply:()=>{},solPodStack:{close:()=>{}},
 addEventListener:on,solPodNotice:()=>{}
};
const ctx={window:win,document:doc,console,Date,Map,Set,Number,String,Array,JSON,Promise,
 navigator:{clipboard:{writeText:async t=>{copied=t;}}},
};
vm.runInNewContext(target,ctx,{filename:'forge-target-dialog-v040.js'});
vm.runInNewContext(trace,ctx,{filename:'forge-rules-trace-v040.js'});
const modal=doc.getElementById('ct-fullscreen-targets');
assert(modal,'Full-screen target modal missing');
const cards=modal.children[0].children[3];
assert.equal(modal.dataset.open,'false','Target overlay should be hidden without targets');
targets=[{kind:'player',id:21,label:'Opponent 1'},
 {kind:'player',id:11,label:'You'}];
fire('ct-forge-selection');
assert.equal(modal.dataset.open,'true','Player-target prompt must auto-open fullscreen');
assert.equal(cards.children.length,2,'All Forge target players must be visible');
assert.equal(cards.children[0].attrs['data-forge-target-id'],'21');
assert.equal(cards.children[1].attrs['data-forge-target-id'],'11',
 'Forge-legal self targeting must be preserved');
assert(cards.children[0].children[1].children[1].textContent.includes('39 life'),
 'Player target must show public life information');
(async()=>{
 cards.children[0].onclick();
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(calls,[{kind:'player',id:21}], 'Target selection must use exact Forge player ID');
 assert.equal(modal.dataset.open,'false','Accepted target must close reader');
 // Repeated identical target state must not reopen a completed choice.
 fire('ct-forge-selection');
 assert.equal(modal.dataset.open,'false');
 targets=[];fire('ct-forge-selection');
 assert.equal(modal.dataset.open,'false','No target prompt on ordinary playable-card highlights');
 targets=[{kind:'player',id:21,label:'Opponent 1'}];
 app.game.phaseDetail='COMBAT_DECLARE_ATTACKERS';fire('ct-forge-selection');
 assert.equal(modal.dataset.open,'false','Ordinary attacker/defender selection remains on board');
 app.game.phaseDetail='MAIN2';fire('ct-forge-selection');
 assert.equal(modal.dataset.open,'true','Targets should auto-open outside combat');
 pending=true;win.ctFullscreenTargets.refresh();
 assert.equal(modal.dataset.open,'false','Mandatory Forge choice must win over target modal');
 pending=false;win.ctFullscreenTargets.refresh();
 assert.equal(modal.dataset.open,'true','Suspended target returns after mandatory choice');
 win.ctForgeSafety.needsRecovery=true;win.ctFullscreenTargets.refresh();
 assert(cards.children.every(b=>!b.disabled),
  'Forge-required targets must remain selectable while original cast confirmation is uncertain');
 win.ctForgeSafety.needsRecovery=false;
 win.ctFullscreenTargets.dismiss();
 const reopen=compact.children.find(x=>x.className==='ct-fullscreen-target-open');
 assert(reopen,'Players need a way to reopen a dismissed target modal');
 reopen.onclick();assert.equal(modal.dataset.open,'true','Manual reopen failed');

 // Cross-mechanic trace: no rule calculation, observe only state deltas,
 // target choice, stack-trigger identity, life and elimination.
 const card=id=>({id,name:'Public card'});
 const snapshot=(library,graveyard,stack=[],life=39,lost=false)=>({
  turn:18,phase:'MAIN1',gameOver:lost,
  players:[
   {id:11,name:'You',libraryCount:12,graveyard:[],exile:[],battlefield:[card(1)],handCount:5,life:32},
   {id:21,name:'Opponent 1',libraryCount:library,
    graveyard:Array.from({length:graveyard},(_,i)=>card(100+i)),
    exile:[],battlefield:[],handCount:4,life,hasLost:lost}
  ],stack
 });
 const original=snapshot(60,2);
 const millSpell={id:91,name:'Mill spell',cardName:'Mill spell',controllerName:'You',
  targets:[{kind:'player',id:21,name:'Opponent 1'}]};
 lastSnapshot=original;onState(original);
 const pendingSpell=snapshot(60,2,[millSpell]);onState(pendingSpell);
 const after=snapshot(0,62,[]);onState(after);
 assert(win.ctRulesTrace.events.some(e=>e.kind==='stack-enter' && e.message.includes('Mill spell')));
 assert(win.ctRulesTrace.events.some(e=>e.kind==='stack-leave' && e.message.includes('Mill spell')));
 assert(win.ctRulesTrace.events.some(e=>e.kind==='zone' && e.zone==='library'&&e.delta===-60),
  'Mill observation must expose exact public library delta');
 assert(win.ctRulesTrace.events.some(e=>e.kind==='zone' && e.zone==='graveyard'&&e.delta===60));
 assert(!win.ctRulesTrace.events.some(e=>e.kind==='elimination'),
  'Empty library alone must NOT be reported as a loss');
 const afterDraw=snapshot(0,62,[],39,true);onState(afterDraw);
 assert(win.ctRulesTrace.events.some(e=>e.kind==='elimination'),
  'Forge loss must be recorded only when reported by engine');
 const triggered={id:92,name:'ETB ability',cardName:'Public creature',trigger:true,controllerName:'You'};
 onState(snapshot(0,62,[triggered],39,true));
 assert(win.ctRulesTrace.events.some(e=>e.kind==='stack-enter'&&e.item.type==='triggered ability'),
  'Triggered abilities must be distinguished from spells');
 win.CommandTableNativeReply({type:'game.choice',
  payload:{id:'choice-1',title:'Choose an order for triggers',mode:'order',
   options:[{label:'ETB A'},{label:'ETB B'}]}});
 assert(win.ctRulesTrace.events.some(e=>e.kind==='choice' && e.mode==='order'),
  'Trigger ordering choices must be traceable');
 win.CommandTableNativeReply({type:'game.selection',payload:{
  targets:[{kind:'player',id:21,label:'Opponent 1'}],chosen:[]}});
 assert(win.ctRulesTrace.events.some(e=>e.kind==='target-choice'),
  'Target choice offers must be traceable');
 const button=new El('button');button.attrs['data-action']='ctCopyRulesTrace';
 const click=listeners.find(x=>x.name==='click'&&x.capture)?.fn;
 assert(click,'Copy diagnostics capture handler missing');
 lastSnapshot=afterDraw;
 click({target:button,preventDefault(){},stopImmediatePropagation(){}});
 await new Promise(resolve=>setImmediate(resolve));
 assert(copied.includes('Observer only'),'Diagnostic report must say it is observational');
 assert(copied.includes('"zone":"library"'),'Diagnostic report must include zone deltas');
 assert(!copied.includes('hiddenLibraryCards'),'Trace must not expose hidden library identities');
 const generated=process.argv[2];
 if(generated){
  const html=read(generated);
  assert(html.includes('ct-fullscreen-targets'),'Generated Android UI missing fullscreen target selection');
  assert(html.includes('Copy Sol Pod rules diagnostics'),'Generated Android history missing copy action');
  assert(html.includes('ctRulesTrace'),'Generated Android UI missing mechanics trace');
 }
 console.log('PASS v0.40: fullscreen Forge player targeting, combat suppression, interruption, recovery, cross-mechanic stack/zone/trigger trace');
})().catch(error=>{console.error(error);process.exitCode=1;});
