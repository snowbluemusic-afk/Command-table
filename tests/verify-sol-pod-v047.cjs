'use strict';
// v0.47: Keep/Mulligan must show the actual Forge opening hand, never a blank
// blocking modal. Read-only card inspection must not submit gameplay commands.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const read=path=>fs.readFileSync(path,'utf8');
const ui=read('forge-integration/web/forge-required-action-v046.js');
const patch=read('forge-integration/tools/patch_frontend.py');
const projection=read('forge-integration/src/main/java/forge/commandtable/CommandTableGameProjection.java');
new vm.Script(ui);
assert(patch.includes('handCards:cardZone(p.hand)'),
 'Keep Forge local-hand card IDs, cost, type and text in hydrated UI');
assert(projection.includes('if (p.getId() == local.getId()) seat.put("hand", visibleCards(p.getHand()))'),
 'Never expose an opponent hand in the Forge projection');
assert(ui.includes("isKeepMulligan")&&ui.includes("ct-opening-hand-grid"),
 'Opening-hand reader must render inside mandatory fullscreen decision');
assert(ui.includes("↻ Refresh hand") && ui.includes("game.snapshot"),
 'Late opening hands need an authoritative Forge refresh control');
assert(ui.includes("if(isKeepMulligan(current)&&!current.hand.length)"),
 'Keep and Mulligan actions must not be sent before cards arrive');

class E{
 constructor(tag){
  this.tagName=String(tag).toUpperCase();this.id='';this.children=[];
  this.parentNode=null;this.style={};this.dataset={};this.attrs={};
  this.textContent='';this.className='';this.disabled=false;this.listeners={};
  this.classList={toggle:(cls,on)=>{this.classes??=new Set();
    if(on)this.classes.add(cls);else this.classes.delete(cls);}};
 }
 append(...nodes){
  for(const n of nodes){
   if(n.parentNode)n.parentNode.children=n.parentNode.children.filter(x=>x!==n);
   n.parentNode=this;this.children.push(n);
  }
 }
 replaceChildren(...nodes){this.children=[];this.append(...nodes);}
 setAttribute(k,v){this.attrs[k]=String(v);}
 addEventListener(k,cb){this.listeners[k]=cb;}
}
const root=new E('div');root.id='app';
const document={head:new E('head'),body:new E('body'),createElement:t=>new E(t),
 addEventListener(){},getElementById(id){
  const find=e=>e.id===id?e:e.children.map(find).find(Boolean);
  return find(this.body);
}};
document.body.append(root);
const seven=[
 {id:101,name:'Island',manaCost:'',type:'Basic Land — Island',rulesText:'{T}: Add {U}.'},
 {id:102,name:'Island',manaCost:'',type:'Basic Land — Island',rulesText:'{T}: Add {U}.'},
 {id:103,name:'Lotus Petal',manaCost:'{0}',type:'Artifact',
  rulesText:'{T}, Sacrifice Lotus Petal: Add one mana of any color.'},
 {id:104,name:'Counterspell',manaCost:'{U}{U}',type:'Instant',rulesText:'Counter target spell.'},
 {id:105,name:'Swords to Plowshares',manaCost:'{W}',type:'Instant',
  rulesText:'Exile target creature. Its controller gains life equal to its power.'},
 {id:106,name:'Arcane Signet',manaCost:'{2}',type:'Artifact',
  rulesText:'{T}: Add one mana of any color in your commander identity.'},
 {id:107,name:'Sol Ring',manaCost:'{1}',type:'Artifact',rulesText:'{T}: Add {C}{C}.'}
];
const seat={hand:seven.map(c=>c.name),handForgeIds:seven.map(c=>c.id),
 handCards:seven};
const app={nativeMatch:true,view:'game',modal:null,sideInspect:null,
 game:{phase:'mulligan',winner:null,gameOver:false,phaseDetail:'MULLIGAN',players:[seat]}};
let buttons={label1:'Keep',label2:'Mulligan',enable1:true,enable2:true,
 message:'You, you are going first! Do you want to keep your hand?',sequence:3};
let accepted=0,rejected=0,nativeRequests=[],sourceHand=seven;
const listeners={};
const window={app,ctForgeCards:{},ctForgeChoice:{hasPending:false},
 ctForgeSafety:{recoveryVisible:false,needsRecovery:false,showError(){}},
 ctForgePriority:{get buttonInfo(){return buttons;},
   confirm:async()=>{accepted++;return true;},
   cancel:async()=>{rejected++;return true;}},
 ctForgeSelection:{get selectionInfo(){return {cards:[],targets:[],chosen:[],min:0,max:0};},
   get prompt(){return buttons.message;}},
 ctCardArtUrl:name=>'https://cards.example/'+encodeURIComponent(name),
 CommandTableNative:{request:async(type)=>{
   nativeRequests.push(type);
   if(type==='game.snapshot')return {game:{players:[{hand:sourceHand}]}};
   return {accepted:true};
 }},
 ctReceiveForgeState:data=>{
   const newHand=data?.players?.[0]?.hand||[];
   seat.handCards=newHand;seat.hand=newHand.map(c=>c.name);
   seat.handForgeIds=newHand.map(c=>c.id);
 },
 addEventListener:(type,fn)=>{(listeners[type]??=[]).push(fn);},
 dispatchEvent:event=>{for(const cb of listeners[event.type]||[])cb(event);},
 CommandTableNativeReply:()=>{}
};
vm.runInNewContext(ui,{window,document,Promise,Number,String,Date,Math},
 {filename:'forge-required-action-v046.js'});
const host=()=>document.getElementById('ct-required-forge-action');
const body=()=>host().children[0];
const count=()=>body().children[2];
const options=()=>body().children[3];
const footer=()=>body().children[5];
const view=()=>document.getElementById('ct-opening-card-viewer');
const button=label=>footer().children.find(c=>c.textContent===label);
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const update=()=>window.dispatchEvent({type:'ct-forge-prompt-updated'});

(async()=>{
 assert.equal(host().dataset.open,'true');
 assert.equal(window.ctForgeRequiredAction.kind,'opening');
 assert.equal(options().children.length,7,'Show all seven opening cards, not a blank modal');
 assert(count().textContent.includes('7 cards'),'Hand count must be visible');
 assert(options().children.every(e=>e.tagName==='BUTTON'),'Cards must be inspectable');
 assert.equal(options().children[0].children[2].textContent,'Island');
 assert.equal(options().children[1].children[2].textContent,'Island',
  'Two identical basic lands must remain separate physical cards');
 assert.equal(options().children[2].children[3].textContent,'{0}',
  'Mana costs should be readable without opening the inspector');
 assert(options().children[3].children[0].src.includes('Counterspell'),
  'Cards should have artwork when supported');
 assert(button('Keep')&&!button('Keep').disabled);
 assert(button('Mulligan')&&!button('Mulligan').disabled);
 options().children[3].onclick();
 assert.equal(view().dataset.open,'true','Tapping a card must enlarge it');
 const cardSheet=view().children[0],copy=cardSheet.children[1];
 assert(copy.children.some(el=>el.textContent==='Counterspell'),
  'Inspector must display the correct selected card');
 assert(copy.children.some(el=>el.textContent==='Counter target spell.'),
  'Inspector must show Forge card rules text');
 assert.equal(accepted,0,'Inspecting card must never keep the hand');
 assert.equal(rejected,0,'Inspecting card must never mulligan');
 copy.children.at(-1).onclick();
 assert.equal(view().dataset.open,'false','Back returns to hand');
 button('Keep').onclick();await tick();
 assert.equal(accepted,1,'Keep must call Forge exactly once');
 button('Keep').onclick();await tick();
 assert.equal(accepted,1,'Double-tap cannot resubmit the same Forge decision');
 // Next mulligan prompt with hand not yet projected: show loading, block both.
 seat.hand=[];seat.handCards=[];seat.handForgeIds=[];sourceHand=[];
 buttons={...buttons,sequence:4};
 update();
 assert.equal(options().children.length,1,'Empty hand must show explicit loading state');
 assert(button('Keep').disabled && button('Mulligan').disabled,
  'Never ask players to keep an unseen hand');
 button('Keep').onclick();await tick();
 assert.equal(accepted,1,'Missing hand must block Keep even via stale button');
 // A delayed native snapshot supplies new cards and automatically repaints.
 sourceHand=seven.map((c,i)=>({...c,id:c.id+1000}));
 button('↻ Refresh hand').onclick();await tick();
 assert.equal(options().children.length,7,'Refreshing must reveal new Forge hand');
 assert(options().children[0].children[2].textContent==='Island');
 assert.equal(button('Keep').disabled,false);
 assert.equal(button('Mulligan').disabled,false);
 assert(nativeRequests.includes('game.snapshot'),'Hand refresh must use live Forge snapshot');
 // Play/Draw precedes dealing and must not incorrectly require seven cards.
 seat.hand=[];seat.handCards=[];seat.handForgeIds=[];
 buttons={label1:'Play',label2:'Draw',enable1:true,enable2:true,
  message:'Would you like to play first?',sequence:5};
 update();
 assert.equal(window.ctForgeRequiredAction.kind,'opening');
 assert.equal(button('Play').disabled,false,'Play/Draw must not await hand dealing');
 assert.equal(button('Draw').disabled,false);
 assert.equal(view().dataset.open,'false','Viewer must close across prompt changes');
 if(process.argv[2]){
  const html=read(process.argv[2]);
  assert(html.includes('ct-opening-card-viewer')&&html.includes('ct-opening-hand-grid'),
   'Android generated HTML must embed opening-hand preview');
  assert(html.includes('handCards:cardZone(p.hand)'),
   'Android state adapter must retain the human hand metadata');
 }
 console.log('PASS Sol Pod v0.47: actual 7-card opening hand, zoom/rules text, duplicates, Keep/Mulligan, late Forge hand, Play/Draw');
})().catch(error=>{console.error(error);process.exitCode=1;});
