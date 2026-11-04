'use strict';
/* v0.50: no-action pregame is loading; choices do not auto-dismiss. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
const router=read('forge-integration/web/forge-required-action-v046.js');
const loading=read('forge-integration/web/forge-landscape-ui.js');
const choices=read('forge-integration/web/forge-choice.js');
const patch=read('forge-integration/tools/patch_frontend.py');
for(const file of [router,loading,choices])new vm.Script(file);
assert(router.includes('if(!enabled&&!needCards&&!bottoming)return null'),
 'Empty opening phase must never be rendered as an actionable decision');
assert(loading.includes('waitForOpening')&&loading.includes('ct-loading-deck'),
 'Opening wait must reuse existing animated Sol Pod loading screen');
assert(loading.includes('elapsed>20000'),
 'Loading screen must retain visible recovery after prolonged wait');
assert(!choices.includes('forcedChoicesSubmitted.add(current.id)'),
 'Single-option mandatory choices must not be auto-approved');
assert(!choices.includes('void answer(false);') ||
       !choices.includes('selected.length===1 && current.min===1'),
 'Single card taps must not auto-submit mandatory decisions');
assert(choices.includes('if(!closingId || (current?.id && String(closingId)!==String(current.id)))return;'),
 'Missing or stale clear IDs must not hide another player decision');
assert(patch.includes("15000:9000"),
 'Informational/error banners should remain readable');

class E {
 constructor(tag){
  this.tagName=tag.toUpperCase();this.id='';this.children=[];this.parentNode=null;
  this.dataset={};this.style={};this.attrs={};this.textContent='';
  this.disabled=false;this.className='';
  this.classList={toggle:(key,on)=>{this._classes??=new Set();
    if(on)this._classes.add(key);else this._classes.delete(key);}};
 }
 append(...items){for(const item of items){if(item.parentNode)item.parentNode.children=item.parentNode.children.filter(x=>x!==item);item.parentNode=this;this.children.push(item);}}
 replaceChildren(...items){this.children=[];this.append(...items);}
 setAttribute(k,v){this.attrs[k]=String(v);}
 getAttribute(k){return this.attrs[k]??null;}
 addEventListener(k,fn){this['on'+k]=fn;}
 querySelector(selector){
  const all=el=>[el,...el.children.flatMap(all)];
  if(selector[0]==='[') {
   const key=selector.match(/data-ct-[\w-]+/)?.[0];
   return all(this).find(e=>e.dataset?.[key?.replace(/-([a-z])/g,(_,x)=>x.toUpperCase())]);
  }
  return null;
 }
}
const root=new E('div');root.id='app';
const document={head:new E('head'),body:new E('body'),createElement:t=>new E(t),
 addEventListener(){},getElementById(id){
  const walk=n=>n.id===id?n:n.children.map(walk).find(Boolean);
  return walk(this.body);
}};
document.body.append(root);
let waitCount=0,hideCount=0;
let buttons={label1:'OK',label2:'Cancel',enable1:false,enable2:false,
 message:'',sequence:0};
const listeners={};
const app={nativeMatch:true,view:'game',game:{phase:'mulligan',phaseDetail:'MULLIGAN',
 gameOver:false,winner:null,players:[{hand:[],handCards:[]}]}};
const win={app,ctForgeChoice:{hasPending:false},ctForgeSafety:{recoveryVisible:false},
 ctMatchLoading:{
  waitForOpening(){waitCount++;},
  hide(){hideCount++;this.awaitingOpening=false;},
  awaitingOpening:true
 },
 ctForgeSelection:{get selectionInfo(){return {cards:[],targets:[],chosen:[],min:0,max:0};},
  get legalTargets(){return [];}},
 ctForgePriority:{
  get buttonInfo(){return buttons;},
  get hasActionableDecision(){return buttons.enable1||buttons.enable2;}
 },
 addEventListener:(t,fn)=>{(listeners[t]??=[]).push(fn);},
 dispatchEvent:e=>{for(const fn of listeners[e.type]||[])fn(e);},
 CommandTableNativeReply:()=>{},
};
vm.runInNewContext(router,{window:win,document,Promise},{filename:'required-action.js'});
const backdrop=document.getElementById('ct-required-forge-action');
assert.equal(backdrop.dataset.open,'false','Disabled opening prompt must not cover the screen');
assert.equal(win.ctForgeRequiredAction.required,false);
assert.equal(waitCount,1,'No-choice opening state must use loading screen');
buttons={label1:'Play',label2:'Draw',enable1:true,enable2:true,
 message:'Who goes first?',sequence:1};
win.dispatchEvent({type:'ct-forge-prompt-updated'});
assert.equal(backdrop.dataset.open,'true','Real Play/Draw choice should appear fullscreen');
assert.equal(hideCount,1,'Loading screen should release actual decisions');
assert.equal(win.ctForgeRequiredAction.kind,'opening');
buttons={label1:'OK',label2:'Cancel',enable1:false,enable2:false,
 message:'',sequence:2};
win.dispatchEvent({type:'ct-forge-prompt-updated'});
assert.equal(backdrop.dataset.open,'false','Interim disabled buttons must not form an empty modal');
assert.equal(waitCount,2,'Interim opening state should show loading again');
app.game.phase='main1';
win.dispatchEvent({type:'ct-forge-prompt-updated'});
assert.equal(waitCount,2,'Normal gameplay should not reopen opening loader');
buttons={label1:'Auto',label2:'Cancel',enable1:true,enable2:true,
 message:'Pay mana',sequence:3};
win.dispatchEvent({type:'ct-forge-prompt-updated'});
assert.equal(win.ctForgeRequiredAction.required,false,
 'Configured automatic mana payment should not flash a modal');

const choiceDoc={head:new E('head'),body:new E('body'),
 createElement:t=>new E(t),addEventListener(){}};
const native=[];
const choiceWindow={CommandTableNative:{request:async(type,payload)=>{
 native.push({type,payload});return {accepted:true};
}}};
vm.runInNewContext(choices,{window:choiceWindow,document:choiceDoc,
 setTimeout:()=>1,clearTimeout:()=>{},encodeURIComponent},
 {filename:'forge-choice.js'});
const dialog=choiceDoc.body.children.find(x=>x.id==='ct-forge-decision-sheet');
const all=node=>[node,...node.children.flatMap(all)];
const buttonsInDialog=()=>all(dialog).filter(x=>x.tagName==='BUTTON');
const offer=(id)=>choiceWindow.CommandTableNativeReply({type:'game.choice',payload:{
 id,mode:'single',title:'Choose a replacement effect',min:1,max:1,
 options:[{index:0,label:'Apply effect'}],confirm:false
}});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 offer('decision-1');
 assert.equal(dialog.style.display,'flex');
 assert.equal(native.length,0,'Mandatory one-option popup must not auto-approve');
 const pick=buttonsInDialog().find(x=>x.textContent==='Apply effect');
 assert(pick,'Player must see the exact option');
 pick.onclick();
 assert.equal(native.length,0,'Tapping an option must not immediately dismiss dialog');
 assert.equal(dialog.style.display,'flex');
 const confirm=buttonsInDialog().find(x=>x.textContent==='Confirm choice');
 assert(confirm && !confirm.disabled);
 confirm.onclick();await tick();
 assert.equal(native.length,1,'Confirm must submit the one selected Forge option');
 offer('decision-2');
 choiceWindow.CommandTableNativeReply({type:'game.choice.clear',payload:{choiceId:'decision-1'}});
 assert.equal(dialog.style.display,'flex','Old clear must not dismiss next decision');
 choiceWindow.CommandTableNativeReply({type:'game.choice.clear',payload:{}});
 assert.equal(dialog.style.display,'flex','ID-less clear must not dismiss current decision');
 choiceWindow.CommandTableNativeReply({type:'game.choice.clear',payload:{choiceId:'decision-2'}});
 assert.equal(dialog.style.display,'none','Matching clear should dismiss completed decision');
 if(process.argv[2]){
  const html=read(process.argv[2]);
  assert(html.includes('waitForOpening')&&html.includes('ct-match-loading'),
   'Generated Android app must use loading UI for empty opening state');
  assert(html.includes('Preparing your next Sol Pod decision'),
   'Generated screen should be branded Sol Pod');
 }
 console.log('PASS Sol Pod v0.50: no-action opening loading, real full-screen choices, explicit confirmation, stale clear protection, no auto-mana flash');
})().catch(e=>{console.error(e);process.exitCode=1;});
