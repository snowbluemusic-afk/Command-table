'use strict';
/* London mulligan bottom-step regression.
 * Forge InputLondonMulligan.getSelection() emits ONLY chosen IDs, not
 * Selection.cards; this test specifically models an EMPTY eligible-card list.
 */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
const ui=read('forge-integration/web/forge-required-action-v046.js');
const native=read('forge-integration/src/main/java/forge/commandtable/CommandTableForgeInput.java');
const overlay=read('forge-integration/src/main/java/forge/app/CommandTableOverlay.java');
const select=read('forge-integration/web/forge-selection.js');
const projection=read('forge-integration/src/main/java/forge/commandtable/CommandTableGameProjection.java');
new vm.Script(ui);
assert(native.includes('current instanceof InputLondonMulligan'),
 'Only active Forge London mulligan input may handle bottom-card taps');
assert(native.includes('for (CardView card : view().getPlayers().get(0).getHand())'),
 'Native mulligan selector must verify the exact card in the current local hand');
assert(native.includes('human().selectCard(selected, Collections.emptyList(), null)'),
 'Selection must go through Forge, not JavaScript game simulation');
assert(overlay.includes('case "mulligan.bottom.select":'),
 'Android game.command must route a dedicated bottom selection');
assert(select.includes('get isBottoming()'),
 'Source message determines bottoming, not general phase alone');
assert(projection.includes('if (p.getId() == local.getId()) seat.put("hand", visibleCards(p.getHand()))'),
 'Do not expose opponents hidden hands');
assert(ui.includes('Confirm selected cards') && ui.includes('Let Sol Pod choose instead'),
 'Primary action must be manual; automatic fallback must be explicit');
assert(ui.includes("kind=bottoming?'bottoming'"),
 'London bottoming must be handled before generic opening/mana classifications');

class E{
 constructor(tag){
  this.tagName=String(tag).toUpperCase();this.id='';this.parentNode=null;
  this.children=[];this.style={};this.dataset={};this.attrs={};
  this.textContent='';this.className='';this.disabled=false;this.listeners={};
  this.classList={toggle:(cls,on)=>{this.classes??=new Set();
    if(on)this.classes.add(cls);else this.classes.delete(cls);}};
 }
 append(...items){for(const v of items){if(v.parentNode)v.parentNode.children=v.parentNode.children.filter(x=>x!==v);v.parentNode=this;this.children.push(v);}}
 replaceChildren(...items){this.children=[];this.append(...items);}
 setAttribute(k,v){this.attrs[k]=String(v);}
 addEventListener(k,fn){this.listeners[k]=fn;}
}
const root=new E('div');root.id='app';
const doc={head:new E('head'),body:new E('body'),createElement:t=>new E(t),
 addEventListener(){},getElementById(id){
  const find=e=>e.id===id?e:e.children.map(find).find(Boolean);return find(this.body);
}};
doc.body.append(root);
const original=[
 {id:111,name:'Island',type:'Basic Land',manaCost:'',rulesText:'{T}: Add {U}.'},
 {id:112,name:'Island',type:'Basic Land',manaCost:'',rulesText:'{T}: Add {U}.'},
 {id:113,name:'Sol Ring',type:'Artifact',manaCost:'{1}',rulesText:'Add {C}{C}.'},
 {id:114,name:'Forest',type:'Basic Land',manaCost:'',rulesText:'{T}: Add {G}.'},
 {id:115,name:'Counterspell',type:'Instant',manaCost:'{U}{U}',rulesText:'Counter target spell.'},
 {id:116,name:'Arcane Signet',type:'Artifact',manaCost:'{2}',rulesText:'Add mana.'},
 {id:117,name:'Mountain',type:'Basic Land',manaCost:'',rulesText:'{T}: Add {R}.'}
];
const seat={handCards:original,hand:original.map(x=>x.name),handForgeIds:original.map(x=>x.id)};
const app={nativeMatch:true,view:'game',game:{phase:'mulligan',phaseDetail:'MULLIGAN',
 winner:null,gameOver:false,players:[seat]}};
let chosen=[],need=1,approvals=0,auto=0;
let buttons={label1:'OK',label2:'Auto',enable1:false,enable2:true,
 message:'Return 1 card(s) to the bottom of your library',sequence:1};
const calls=[],listeners={};
const win={app,ctForgeCards:{},ctForgeChoice:{hasPending:false},
 ctForgeSafety:{recoveryVisible:false,needsRecovery:false,showError(err){throw err;}},
 ctForgePriority:{
  get buttonInfo(){return buttons;},
  get isBottoming(){return /Return .*bottom.*library/i.test(buttons.message);},
  confirm:async()=>{approvals++;return true;},
  cancel:async()=>{auto++;return true;}
 },
 ctForgeSelection:{
  get selectionInfo(){return {cards:[],targets:[],chosen:[...chosen],min:0,max:0};},
  get prompt(){return buttons.message;},
  isLegalCard:()=>false
 },
 ctCardArtUrl:name=>'https://cards.example/'+encodeURIComponent(name),
 CommandTableNative:{request:async(type,payload)=>{
  calls.push({type,payload});
  if(type==='game.command'&&payload.action==='mulligan.bottom.select'){
   const card=original.find(c=>c.id===payload.value);
   assert(card,'Selection must use actual Forge hand card ID');
   const pos=chosen.indexOf(card.id);
   if(pos>=0)chosen.splice(pos,1);
   else if(chosen.length<need)chosen.push(card.id);
   buttons={...buttons,message:'Return '+(need-chosen.length)+' card(s) to the bottom of your library',
    enable1:chosen.length===need,enable2:chosen.length!==need,sequence:buttons.sequence+1};
   updateSelection();
   return {accepted:true};
  }
  if(type==='game.snapshot')return {game:{players:[{hand:original}]}};
  return {accepted:true};
 }},
 addEventListener:(type,fn)=>{(listeners[type]??=[]).push(fn);},
 dispatchEvent:e=>{for(const fn of listeners[e.type]||[])fn(e);},
 CommandTableNativeReply:()=>{}
};
const emit=type=>win.dispatchEvent({type});
const updateSelection=()=>{emit('ct-forge-selection');emit('ct-forge-prompt-updated');};
vm.runInNewContext(ui,{window:win,document:doc,Promise,Number,String,Date,Math},
 {filename:'forge-required-action-v046.js'});
const modal=()=>doc.getElementById('ct-required-forge-action');
const sheet=()=>modal().children[0];
const heading=()=>sheet().children[0];
const count=()=>sheet().children[2];
const gallery=()=>sheet().children[3];
const footer=()=>sheet().children[5];
const findButton=text=>footer().children.find(e=>e.textContent===text);
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const cards=()=>gallery().children;
async function run(){
 assert.equal(modal().dataset.open,'true');
 assert.equal(win.ctForgeRequiredAction.kind,'bottoming',
  'Return X cards to the bottom cannot be classified as Opening/Auto');
 assert(heading().textContent.toLowerCase().includes('bottom'));
 assert.equal(cards().length,7,
  'All seven hand cards must appear despite empty Selection.cards');
 assert.equal(count().textContent.includes('0 selected of 1'),true);
 assert(findButton('Confirm selected cards').disabled,
  'Confirmation is disabled before selecting required card');
 assert(findButton('Let Sol Pod choose instead'),
  'Forge Auto remains a clearly labelled secondary fallback');
 assert.equal(calls.length,0,'Nothing is automatically bottomed when dialog opens');
 // Card detail can be read without changing selection.
 cards()[0].children[1].onclick();
 const viewer=doc.getElementById('ct-opening-card-viewer');
 assert.equal(viewer.dataset.open,'true');
 assert.equal(chosen.length,0,'Reading card must not bottom it');
 viewer.children[0].children[1].children.at(-1).onclick();
 assert.equal(viewer.dataset.open,'false');
 // Select the SECOND of two Islands: distinguish identical named objects by ID.
 cards()[1].children[0].onclick();
 await tick();
 assert.deepEqual(chosen,[112]);
 assert(calls.some(x=>x.type==='game.command' &&
   x.payload.action==='mulligan.bottom.select'&&x.payload.value===112),
   'Selecting the second Island must send its specific Forge ID');
 assert.equal(count().textContent.includes('1 selected of 1'),true);
 assert.equal(cards()[1].children[0].dataset.chosen,'true');
 assert.equal(cards()[0].children[0].dataset.chosen,'false');
 assert.equal(findButton('Confirm selected cards').disabled,false);
 findButton('Confirm selected cards').onclick();await tick();
 assert.equal(approvals,1,'Confirm should use real Forge OK');
 assert.equal(auto,0,'Manual selection must not invoke Forge Auto');
 findButton('Confirm selected cards').onclick();await tick();
 assert.equal(approvals,1,'Repeated confirm cannot submit same request twice');
 // Move to a NEW bottom step needing two cards; exercise undo and exact total.
 chosen=[];need=2;buttons={...buttons,message:'Return 2 card(s) to the bottom of your library',
  enable1:false,enable2:true,sequence:200};
 updateSelection();
 assert.equal(win.ctForgeRequiredAction.kind,'bottoming');
 assert.equal(cards().length,7);
 cards()[0].children[0].onclick();await tick();
 assert.deepEqual(chosen,[111]);
 assert(findButton('Confirm selected cards').disabled,'One chosen of two cannot confirm');
 cards()[0].children[0].onclick();await tick();
 assert.deepEqual(chosen,[],'Tapping an already selected card must deselect it');
 cards()[4].children[0].onclick();await tick();
 cards()[3].children[0].onclick();await tick();
 assert.deepEqual(chosen,[115,114],
  'Selection order should remain Forge-owned with exact IDs');
 assert.equal(findButton('Confirm selected cards').disabled,false);
 findButton('Confirm selected cards').onclick();await tick();
 assert.equal(approvals,2);
 // A normal Play/Draw choice is not mistakenly classified as bottoming.
 chosen=[];need=1;buttons={label1:'Play',label2:'Draw',enable1:true,enable2:true,
  message:'Choose to play or draw first',sequence:300};
 updateSelection();
 assert.equal(win.ctForgeRequiredAction.kind,'opening');
 assert.equal(findButton('Play').disabled,false);
 assert.equal(auto,0);
 const bundled=process.argv[2];
 if(bundled){
  const html=read(bundled);
  assert(html.includes('mulligan.bottom.select'),'Embedded Android must contain guarded card-selection request');
  assert(html.includes('ct-bottom-card-wrap'),'Embedded fullscreen modal must include bottoming tiles');
 }
 console.log('PASS Sol Pod v0.48: London mulligan selectable 7-card hand, exact IDs, duplicates, undo, 1/2-card confirmation, no auto-selection');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
