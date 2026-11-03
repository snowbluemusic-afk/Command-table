'use strict';
// v0.46 integration regression: action-required input never belongs to Game Log.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=path=>fs.readFileSync(path,'utf8');
const router=read('forge-integration/web/forge-required-action-v046.js');
const selection=read('forge-integration/web/forge-selection.js');
const hub=read('forge-integration/web/sol-pod-hub-v030.js');
const notices=read('forge-integration/web/sol-pod-notifications-v029.js');
const resilience=read('forge-integration/web/forge-resilience-v035.js');
const overlay=read('forge-integration/src/main/java/forge/app/CommandTableOverlay.java');
const patch=read('forge-integration/tools/patch_frontend.py');
for(const x of [router,selection,hub,notices,resilience])new vm.Script(x);
assert(patch.includes("'forge-required-action-v046.js'"),
 'Android HTML must embed full-screen Forge action router');
assert(hub.includes('Read-only history of Forge game events') &&
 !hub.includes("document.getElementById('ct-forge-legal-actions')"),
 'Game Log must never host Forge legal choices');
assert(hub.includes('#ct-forge-legal-actions{display:none!important}'),
 'Older legal-action drawer must not appear beside the Game Log');
assert(!hub.includes('logOpen=true'),
 'Game Log should not open automatically to demand player action');
assert(notices.includes('ctForgeRequiredAction?.onNotice?.(text)'),
 'Imperative notices should route into action UI, not history');
assert(selection.includes('get buttonInfo(){') &&
 selection.includes('get selectionInfo(){'),
 'Required-action router must read Forge button and selection objects');
assert(selection.includes('cancel:()=>decide(false)'),
 'Approvals need functional Forge Cancel, not an inert label');
assert(overlay.includes('.put("cancelRequested",cancelRequested)'),
 'Native status must distinguish cancellation request from completion');
assert(resilience.includes('Cancellation was requested, but Forge has not stopped'),
 'Pending cancellation must remain visibly unresolved');

class E {
 constructor(tag){
  this.tagName=String(tag).toUpperCase();this.children=[];this.parentNode=null;
  this.style={};this.dataset={};this.attrs={};this.textContent='';
  this.id='';this.className='';this.disabled=false;this.listeners={};
  this.classList={toggle:(key,on)=>{this._classes??=new Set();
    if(on)this._classes.add(key);else this._classes.delete(key);}};
 }
 append(...xs){for(const x of xs){if(x.parentNode)x.parentNode.children=x.parentNode.children.filter(v=>v!==x);x.parentNode=this;this.children.push(x);}}
 replaceChildren(...xs){this.children=[];this.append(...xs);}
 setAttribute(k,v){this.attrs[k]=String(v);}
 addEventListener(k,fn){this.listeners[k]=fn;}
}
const root=new E('div');root.id='app';
const doc={head:new E('head'),body:new E('body'),createElement:tag=>new E(tag),activeElement:root,
 getElementById(id){
  const find=n=>n.id===id?n:n.children.map(find).find(Boolean);
  return find(this.body);
 },
 addEventListener(){}
};doc.body.append(root);
const callbacks={};let approvals=0,denials=0,chosenCard=null,failed=0;
let buttons={label1:'OK',label2:'Cancel',enable1:true,enable2:true,
 message:'Your priority',sequence:1};
let selectionState={cards:[],targets:[],chosen:[],min:0,max:0};
const app={nativeMatch:true,view:'game',modal:'',sideInspect:null,
 game:{winner:null,gameOver:false,phase:'main1',phaseDetail:'MAIN1',
 players:[{id:1,priority:true}]}};
const win={app,ctForgeChoice:{hasPending:false},
 ctForgeSafety:{recoveryVisible:false,needsRecovery:false,
   recover:async()=>true,showError:()=>failed++},
 ctForgePriority:{
   get buttonInfo(){return buttons;},
   confirm:async()=>{approvals++;return true;},
   cancel:async()=>{denials++;return true;}
 },
 ctForgeSelection:{
  get selectionInfo(){return selectionState;},
  get prompt(){return buttons.message;},
  isLegalCard:id=>selectionState.cards.some(c=>Number(c.id)===Number(id)),
  chooseCard:async id=>{chosenCard=id;return true;}
 },
 addEventListener(type,fn){(callbacks[type]??=[]).push(fn);},
 dispatchEvent(event){for(const fn of callbacks[event.type]||[])fn(event);},
 CommandTableNativeReply:()=>{},
};
vm.runInNewContext(router,{window:win,document:doc},{filename:'forge-required-action-v046.js'});
const modal=()=>doc.getElementById('ct-required-forge-action');
const resume=()=>doc.getElementById('ct-forge-required-resume');
const sheet=()=>modal().children[0],optionList=()=>sheet().children[3],
 footer=()=>sheet().children[5];
const event=type=>win.dispatchEvent({type});
const update=()=>event('ct-forge-prompt-updated');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function test(){
 assert.equal(win.ctForgeRequiredAction.visible,false,
  'Normal priority must not cover battlefield');
 // Opening play/draw is a real Forge decision.
 app.game.phase='mulligan';buttons={label1:'Play',label2:'Draw',enable1:true,enable2:true,
 message:'Choose to play first or draw first',sequence:2};
 update();
 assert.equal(win.ctForgeRequiredAction.visible,true);
 assert.equal(win.ctForgeRequiredAction.kind,'opening');
 footer().children.find(x=>x.textContent==='Play').onclick();
 await tick();
 assert.equal(approvals,1,'Approval should invoke Forge confirm exactly once');
 footer().children.find(x=>x.textContent==='Play').onclick();
 await tick();
 assert.equal(approvals,1,'Duplicate approval must be blocked before new prompt');
 // A new Forge prompt allows the next decision even with identical labels.
 buttons.sequence=3;update();
 assert.equal(footer().children.find(x=>x.textContent==='Play').disabled,false);
 // Ordinary phase continuation must stay in normal HUD, not blocking.
 app.game.phase='main1';buttons={label1:'OK',label2:'Cancel',enable1:true,enable2:true,
 message:'Your priority',sequence:4};update();
 assert.equal(win.ctForgeRequiredAction.visible,false);
 // Forced discard is full-screen; it must select exact Forge card ID.
 selectionState={min:1,max:1,chosen:[],targets:[],
  cards:[{kind:'card',id:51,label:'Lotus Petal',actionable:false}]};
 buttons={label1:'OK',label2:'Cancel',enable1:true,enable2:true,
 message:'Select a card to discard',sequence:5};event('ct-forge-selection');
 assert.equal(win.ctForgeRequiredAction.visible,true);
 assert.equal(win.ctForgeRequiredAction.kind,'cards');
 assert.equal(optionList().children.length,1);
 optionList().children[0].onclick();await tick();
 assert.equal(chosenCard,51,'The exact original Forge card ID must be selected');
 footer().children.find(x=>x.textContent==='Cancel').onclick();await tick();
 assert.equal(denials,1,'Cancellation must use Forge Cancel handler');
 // Automatic or manual mana payment stays in full-screen action surface.
 selectionState={min:0,max:0,chosen:[],cards:[],targets:[]};
 buttons={label1:'Auto',label2:'Cancel',enable1:false,enable2:true,
 message:'Pay mana for your spell',sequence:6};update();
 assert.equal(win.ctForgeRequiredAction.visible,true);
 assert.equal(win.ctForgeRequiredAction.kind,'mana');
 const manual=footer().children.find(x=>x.textContent==='Use battlefield');
 assert(manual,'Manual mana tap must stay possible');
 manual.onclick();
 assert.equal(win.ctForgeRequiredAction.visible,false);
 assert.equal(resume().style.display,'block','Player can reopen payment choice');
 resume().onclick();
 assert.equal(win.ctForgeRequiredAction.visible,true);
 // Forge's own target decision modal (player/card/stack) takes precedence.
 selectionState={min:1,max:1,chosen:[],cards:[],
  targets:[{kind:'player',id:2,label:'Krenko'}]};
 buttons={label1:'OK',label2:'Cancel',enable1:true,enable2:true,
 message:'Choose target player',sequence:7};event('ct-forge-selection');
 assert.equal(win.ctForgeRequiredAction.visible,false,
  'Do not stack two full-screen choice dialogs');
 // Existing universal Forge native choice supersedes all other UI.
 selectionState={min:0,max:0,chosen:[],cards:[],targets:[]};
 buttons={label1:'Yes',label2:'No',enable1:true,enable2:true,
 message:'Approve replacement effect?',sequence:8};
 win.ctForgeChoice.hasPending=true;update();
 assert.equal(win.ctForgeRequiredAction.visible,false);
 win.ctForgeChoice.hasPending=false;update();
 assert.equal(win.ctForgeRequiredAction.visible,true);
 // Recovery always wins: do not bury or overlay it.
 win.ctForgeSafety.recoveryVisible=true;event('ct-forge-selection');
 assert.equal(win.ctForgeRequiredAction.visible,false);
 win.ctForgeSafety.recoveryVisible=false;
 // Combat gestures remain on the board.
 app.game.phase='combat';app.game.phaseDetail='DECLARE_ATTACKERS';
 buttons={label1:'OK',label2:'Cancel',enable1:true,enable2:true,
 message:'Attackers',sequence:9};update();
 assert.equal(win.ctForgeRequiredAction.visible,false);
 assert.equal(win.ctForgeRequiredAction.onNotice('Opponent draws a card'),false,
  'Passive game events belong only to Game Log');
 assert.equal(win.ctForgeRequiredAction.onNotice('Select target player'),true,
  'Imperative instructions must never become read-only log entries');
 assert.equal(failed,1,'Missing Forge choices must offer recovery, not fake inputs');
 const bundled=process.argv[2];
 if(bundled){
  const html=read(bundled);
  assert(html.includes('ct-required-forge-action')&&html.includes('ctForgeRequiredAction'),
   'Embedded Android UI must include full-screen approval and selection sheet');
  assert(html.includes('get buttonInfo(){')&&html.includes('cancel:()=>decide(false)'),
   'Embedded buttons must be bound to Forge approve/cancel handlers');
 }
 console.log('PASS Sol Pod v0.46: full-screen selection/approval, real buttons, dedupe, mana, target priority, combat, recovery, read-only Game Log');
}
test().catch(error=>{console.error(error);process.exitCode=1;});
