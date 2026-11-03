'use strict';
const fs=require('node:fs'), vm=require('node:vm'), assert=require('node:assert/strict');
const read=file=>fs.readFileSync(file,'utf8');
const source=read('forge-integration/web/forge-selection.js');
const zones=read('forge-integration/web/forge-graveyard.js');
const patch=read('forge-integration/tools/patch_frontend.py');
const proxy=read('forge-integration/src/main/java/forge/commandtable/CommandTableGuiProxy.java');
new Function(source);new Function(zones);
assert(patch.includes('graveyardCards:cardZone(p.graveyard)'), 'Graveyard IDs lost during hydration');
assert(patch.includes('exileCards:cardZone(p.exile)'), 'Exile IDs lost during hydration');
assert(proxy.includes('selectionView(selection, game.get())'), 'Forge zone metadata not attached to selections');
assert(proxy.includes('visibleZone(game, c)'), 'Forge card targets lost their zone context');
assert(zones.includes("chooseCard?.(id)"), 'Zone browser cannot dispatch exact legal card ID');
assert(source.includes("window.ctForgeSafety?.needsRecovery"), 'Unknown native result is not guarded');

class El{
 constructor(tag='div'){
  this.tag=tag;this.children=[];this.style={};this.attrs={};this.dataset={};this.textContent='';
  const data=new Set();
  this.classList={add:k=>data.add(k),remove:k=>data.delete(k),
   toggle:(k,yes)=>yes?data.add(k):data.delete(k),contains:k=>data.has(k)};
 }
 append(...items){this.children.push(...items);items.forEach(x=>{if(x&&typeof x==='object')x.parentNode=this;});}
 prepend(...items){this.children.unshift(...items);items.forEach(x=>{if(x&&typeof x==='object')x.parentNode=this;});}
 replaceChildren(...items){this.children=[];this.append(...items);}
 setAttribute(k,v){this.attrs[k]=String(v);}
 getAttribute(k){return this.attrs[k]??null;}
 closest(selector){return selector==='[data-ct-forge-player-id]' && this.getAttribute('data-ct-forge-player-id')?this:null;}
 addEventListener(type,fn){this['on'+type]=fn;}
 querySelectorAll(){return [];}
 remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(x=>x!==this);}
}
const own=new El(),rival=new El();
own.setAttribute('data-ct-forge-player-id','10');
rival.setAttribute('data-ct-forge-player-id','20');
const listeners=[],body=new El(),head=new El(),root=new El(),choiceSheet={style:{display:'none'}};
let zoneBackdrop=null;
const doc={head,body,
 createElement:t=>new El(t),createElementNS:(ns,t)=>new El(t),
 getElementById:id=>id==='app'?root:id==='ct-forge-decision-sheet'?choiceSheet:id==='ct-zone-browser'?zoneBackdrop:null,
 querySelectorAll:selector=>selector==='[data-ct-forge-player-id]'?[own,rival]:[],
 addEventListener:(type,fn,capture)=>listeners.push({type,fn,capture})};
const calls=[];
const native={async request(type,payload={}){
 if(type==='game.command') calls.push({action:payload.action,id:payload.value});
 if(type==='game.snapshot')return {game:app.game};
 return {ok:true};
}};
const app={nativeMatch:true,view:'game',modal:null,sideInspect:null,
 game:{winner:null,phase:'main1',phaseDetail:'MAIN1',players:[
  {forgeId:10,graveyard:['Solemn Simulacrum','Solemn Simulacrum'],
   graveyardCards:[{id:301,name:'Solemn Simulacrum'},{id:302,name:'Solemn Simulacrum'}],
   exile:['Gravecrawler'],exileCards:[{id:401,name:'Gravecrawler'}],handForgeIds:[]},
  {forgeId:20,graveyard:[],exile:[]}
 ]}};
const notices=[];
const win={app,CommandTableNative:native,render(){},dispatchEvent(){},addEventListener(){},
 ctForgeSafety:{needsRecovery:false},ctNativeToast:m=>notices.push(m),
 announce:m=>notices.push(m),ctCardArtUrl:()=>'',ctForgeCards:{}};
const context={window:win,document:doc,CommandTableNative:native,app,
 MutationObserver:class{observe(){}},CustomEvent:class{constructor(type,opts){this.type=type;this.detail=opts?.detail;}},
 requestAnimationFrame:()=>1,ctReceiveForgeState(){},setTimeout,clearTimeout,Number,String,Promise,console,innerWidth:1000,innerHeight:640};
vm.runInNewContext(source,context,{filename:'forge-selection.js'});
const panel=body.children.find(n=>n.id==='ct-forge-legal-actions');
assert(panel,'Choice panel not mounted');
const targetButtons=()=>panel.children[1].children;
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const emit=payload=>win.CommandTableNativeReply({type:'game.selection',payload});
const records=[
 {kind:'card',id:301,label:'Solemn Simulacrum',zone:'You · Graveyard'},
 {kind:'card',id:302,label:'Solemn Simulacrum',zone:'You · Graveyard'},
 {kind:'card',id:401,label:'Gravecrawler',zone:'You · Exile'},
 {kind:'stack',id:91,label:'Counterspell'},
 {kind:'player',id:20,label:'Opponent 1'}
];
(async()=>{
 emit({cards:records.slice(0,3),targets:records.slice(3),chosen:[]});
 assert.equal(panel.style.display,'block','All legal choices must be visible outside combat');
 const buttons=targetButtons();
 assert.equal(buttons.length,5,'Off-board card, stack and player options must coexist');
 assert(buttons.some(b=>b.textContent.includes('Graveyard')),'Missing graveyard origin');
 assert(buttons.some(b=>b.textContent.includes('Exile')),'Missing exile origin');
 assert(buttons.some(b=>b.textContent.includes('STACK')),'Missing stack choice');
 const doubles=buttons.filter(b=>b.textContent.includes('Solemn Simulacrum'));
 assert.equal(doubles.length,2);
 assert.notEqual(doubles[0].getAttribute('data-ct-forge-choice-id'),doubles[1].getAttribute('data-ct-forge-choice-id'));
 doubles[1].onclick();await flush();
 assert.deepEqual(calls.at(-1),{action:'cardId',id:302},'Duplicate card identity was lost');
 const stack=targetButtons().find(b=>b.textContent.includes('Counterspell'));
 stack.onclick();await flush();
 assert.deepEqual(calls.at(-1),{action:'selectStack',id:91});
 app.game.phaseDetail='COMBAT_DECLARE_ATTACKERS';
 emit({cards:[records[0]],targets:[],chosen:[]});
 assert.equal(panel.style.display,'block','Fallback picker disappeared during combat');
 assert.equal(panel.children[1].style.display,'none','Combat options should start collapsed');
 panel.children[0].children[1].onclick();
 assert.equal(panel.children[1].style.display,'flex','Combat fallback chooser cannot expand');
 app.game.phaseDetail='MAIN1';
 emit({cards:[records[2]],targets:[],chosen:[]});
 const stale=targetButtons()[0];
 emit({cards:[],targets:[],chosen:[]});
 assert.equal(panel.style.display,'none','Picker remains after Forge clears selection');
 const before=calls.length;
 stale.onclick();await flush();
 assert.equal(calls.length,before,'Stale option was submitted after selection ended');
 emit({cards:[records[2]],targets:[],chosen:[]});
 win.ctForgeSafety.needsRecovery=true;
 win.ctForgeSelection.refresh();
 assert(targetButtons().every(b=>b.disabled),'Unverified actions remain selectable after timeout');
 targetButtons()[0].onclick();await flush();
 assert.equal(calls.length,before,'Timed out choice must not be blindly resent');
 win.ctForgeSafety.needsRecovery=false;
 win.ctForgeSelection.refresh();

 // The zone browser is not its own rules engine. Its only action dispatches
 // the same exact Forge card ID, and only when that ID is in current Selection.
 vm.runInNewContext(zones,context,{filename:'forge-graveyard.js'});
 zoneBackdrop=body.children.find(n=>n.id==='ct-zone-browser');
 assert(zoneBackdrop,'Zone browser not mounted');
 win.ctZoneBrowser.open('graveyard');
 assert.equal(zoneBackdrop.dataset.open,'true');
 const sheet=zoneBackdrop.children[0],detail=sheet.children[2].children[1];
 const chosen=detail.children.find(n=>n.textContent==='Select this card with Forge');
 // Only exile is currently selected; graveyard is not legal.
 assert(!chosen,'A graveyard card was marked legal while only exile was selectable');
 win.ctZoneBrowser.close();
 emit({cards:[records[1]],targets:[],chosen:[]});
 win.ctZoneBrowser.open('graveyard');
 const newSheet=zoneBackdrop.children[0],grid=newSheet.children[2].children[0];
 grid.children[1].onclick();
 const detail2=zoneBackdrop.children[0].children[2].children[1];
 const pick=detail2.children.find(n=>n.textContent==='Select this card with Forge');
 assert(pick,'Exact legal graveyard choice button missing');
 pick.onclick();await flush();
 assert.deepEqual(calls.at(-1),{action:'cardId',id:302},'Zone action used name or index, not exact Forge ID');
 assert.equal(zoneBackdrop.dataset.open,'false','Successful target selection did not close zone browser');
 console.log('PASS Sol Pod v0.36 universal Forge choices: hidden-zone cards, duplicate IDs, stack, combat fallback, stale events, timeout gate and zone selection');
})().catch(e=>{console.error(e);process.exitCode=1;});
