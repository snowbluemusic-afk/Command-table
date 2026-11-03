'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const code=fs.readFileSync('forge-integration/web/forge-simple-cast.js','utf8');
new Function(code);
assert(code.includes("hand.getAttribute('data-value')"),
  'Hand card identity must come from its stable original hand index');
assert(!code.includes('indexOf(slot)'),
  'DOM position must not stand in for a Forge hand index');
class El{
 constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.style={};
  this.attrs={};this.listeners={};this.disabled=false;}
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this.children=nodes;}
 setAttribute(k,v){this.attrs[k]=v;}
 getAttribute(k){return this.attrs[k]??null;}
 addEventListener(type,fn){this.listeners[type]=fn;}
 focus(){}
}
const handlers={};
const document={
 head:{append(){}},body:{append(){}},
 createElement:tag=>new El(tag),
 addEventListener:(type,fn)=>{(handlers[type]??=[]).push(fn);}
};
const ids=[702,708,711];
const win={
 app:{nativeMatch:true,view:'game',modal:'',game:{
  players:[{hand:['Goblin Warchief','Mountain','Mountain'],handForgeIds:ids}]
 }},
 ctForgeCards:{
  'goblin warchief':{type:'Creature',cost:'{1}{R}{R}',text:'Goblins have haste.'},
  mountain:{type:'Basic Land — Mountain',text:'Tap: Add red mana.'}
 },
 ctCardArtUrl:name=>'/card-art/'+name,
 ctNativeToast(){},render(){},
 CommandTableNative:{async request(action,arg){
  calls.push({action,arg});return action==='game.snapshot'?{}:{ok:true};
 }}
};
const calls=[];
vm.runInNewContext(code,{window:win,document,Promise,Number,String,Math,
 setTimeout:()=>1,clearTimeout(){}},{filename:'forge-simple-cast.js'});
const backdrop=document.body; // body mock is plain; retrieve the created dialog.
let preview;
const docBody={append(x){preview=x;}};
// Recreate once with tracked body to obtain preview node.
const d2={...document,body:docBody};
handlers.click=[];
vm.runInNewContext(code,{window:win,document:d2,Promise,Number,String,Math,
 setTimeout:()=>1,clearTimeout(){}},{filename:'forge-simple-cast.js'});
assert(preview,'Cast preview must be created');
const click=originalIndex=>{
 const hand={getAttribute:k=>k==='data-value'?String(originalIndex):null};
 const event={target:{closest:selector=>selector.includes('.ct10-hand-slot')?hand:null},
   preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}};
 for(const handler of handlers.click){handler(event);if(event.stopped)break;}
 return event;
};
const inspect=()=>preview.children[0].children[1].children[0].textContent;
async function castSelected(){
 const sheet=preview.children[0];
 const section=sheet.children[1];
 const buttons=section.children[section.children.length-1];
 const confirm=buttons.children[0];
 await confirm.onclick();
 return calls.filter(x=>x.action==='game.command').at(-1)?.arg.value;
}
(async()=>{
 // The first DISPLAYED card represents hand index 2, not DOM index 0.
 assert(click(2).stopped,'Card tap must be handled by the Forge preview');
 assert.equal(inspect(),'Mountain','A sorted Mountain must open Mountain');
 assert.equal(await castSelected(),711,'Must cast the clicked Mountain instance (ID 711)');
 click(1);
 assert.equal(inspect(),'Mountain','Second identical Mountain must still open Mountain');
 assert.equal(await castSelected(),708,'Duplicate cards must use the correct unique Forge ID');
 click(0);
 assert.equal(inspect(),'Goblin Warchief');
 assert.equal(await castSelected(),702,'Warchief should use its own Forge ID');
 // No guessing from DOM placement if the clicked card has no valid index.
 const before=calls.length;
 win.ctSimpleCast.hide();
 const bad={getAttribute:()=>null};
 const event={target:{closest:s=>s.includes('.ct10-hand-slot')?bad:null},
  preventDefault(){throw Error('invalid card should not consume tap');},
  stopImmediatePropagation(){throw Error('invalid card should not consume tap');}};
 for(const handler of handlers.click)handler(event);
 assert.equal(calls.length,before);
 console.log('PASS sorted hand card taps and cast IDs: Mountain #711, Mountain #708, Warchief #702');
})().catch(e=>{console.error(e);process.exitCode=1;});
