'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync('forge-integration/web/forge-selection.js','utf8');
new Function(src);
class E{
 constructor(){this.children=[];this.style={};this.attrs={};const set=new Set();this.classList={add:x=>set.add(x),remove:x=>set.delete(x),toggle:(x,b)=>b?set.add(x):set.delete(x),contains:x=>set.has(x)};}
 append(...items){this.children.push(...items);items.forEach(e=>e.parentNode=this);}
 replaceChildren(...items){this.children=[];this.append(...items);}
 setAttribute(k,v){this.attrs[k]=String(v);}
 getAttribute(k){return this.attrs[k]??null;}
 closest(sel){return sel==='[data-ct-forge-player-id]'&&this.attrs['data-ct-forge-player-id']?this:null;}
 querySelectorAll(){return [];}
}
const person=id=>{const e=new E();e.setAttribute('data-ct-forge-player-id',id);return e;};
const me=person(11),opponent=person(52),invalid=person(999);
const calls=[],listeners=[],head=new E(),body=new E(),root=new E(),sheet={style:{display:'none'}};
const doc={head,body,createElement:()=>new E(),createElementNS:()=>new E(),
 getElementById:id=>id==='app'?root:id==='ct-forge-decision-sheet'?sheet:null,
 querySelectorAll:sel=>sel==='[data-ct-forge-player-id]'?[me,opponent,invalid]:[],
 addEventListener:(type,fn,capture)=>listeners.push({type,fn,capture})};
const native={async request(type,payload={}){
 if(type==='game.command')calls.push(payload);
 if(type==='game.snapshot')return {game:{winner:null,players:[{handForgeIds:[]}]}};
 return {ok:true};
}};
const app={nativeMatch:true,view:'game',modal:null,sideInspect:null,
 game:{winner:null,phase:'main1',phaseDetail:'MAIN 1',players:[{forgeId:11,handForgeIds:[]}]}};
const win={app,CommandTableNative:native,render(){},dispatchEvent(){},addEventListener(){}};
vm.runInNewContext(src,{window:win,document:doc,CommandTableNative:native,app,
 MutationObserver:class{observe(){}},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},
 requestAnimationFrame:()=>1,ctReceiveForgeState(){},setTimeout,clearTimeout,Number,String,Promise,console});
const panel=body.children.find(e=>e.id==='ct-forge-legal-actions');
assert(panel,'Legal target chooser missing');
const click=listeners.find(x=>x.type==='click'&&x.capture)?.fn;
assert(click,'Capture handler for legal player selection missing');
function tap(el){const e={target:el,stopped:false,prevented:false,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}};click(e);return e;}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 win.CommandTableNativeReply({type:'game.selection',payload:{cards:[],chosen:[],targets:[
  {kind:'player',id:52,label:'Opponent 1'}, {kind:'player',id:11,label:'You'}]}});
 assert.equal(panel.style.display,'block','Player targets must be visible outside combat');
 assert(opponent.classList.contains('ct-forge-legal-player'));
 assert(me.classList.contains('ct-forge-legal-player'),'Forge-legal self-targeting was lost');
 assert(!invalid.classList.contains('ct-forge-legal-player'));
 const ignored=tap(invalid);await flush();
 assert(!ignored.stopped&&!ignored.prevented,'Nonlegal player should retain normal inspection');
 assert.equal(calls.length,0,'Illegal player target was sent to Forge');
 const valid=tap(opponent);await flush();
 assert(valid.stopped&&valid.prevented,'Legal click must be consumed before fallback handlers');
 assert.equal(calls[0]?.action,'selectPlayer');assert.equal(calls[0]?.value,52);
 const own=tap(me);await flush();
 assert(own.stopped,'Legal self target ignored');assert.equal(calls[1]?.value,11);
 const buttons=panel.children[1].children;
 const button=buttons.find(b=>/Opponent 1/.test(b.textContent));
 assert(button,'Missing explicit player target button');
 button.onclick();await flush();assert.equal(calls[2]?.value,52);
 sheet.style.display='flex';tap(opponent);await flush();
 assert.equal(calls.length,3,'Player tap must not escape mandatory choice dialog');
 sheet.style.display='none';
 win.CommandTableNativeReply({type:'game.selection',payload:{cards:[],chosen:[],targets:[]}});
 assert.equal(panel.style.display,'none','Stale options remain visible');
 assert(!opponent.classList.contains('ct-forge-legal-player'),'Stale glow remains');
 tap(opponent);await flush();assert.equal(calls.length,3,'Stale target was submitted to Forge');
 console.log('PASS v0.35.1 Forge player targets: legal, illegal, self, explicit picker, modal, stale-state');
})().catch(e=>{console.error(e);process.exitCode=1;});
