'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
const required=read('forge-integration/web/forge-required-action-v046.js');
const build=read('forge-integration/web/sol-pod-build-v053.js');
const patch=read('forge-integration/tools/patch_frontend.py');
new vm.Script(required);new vm.Script(build);
assert(required.includes("d.attachment?'Choose attachment target'"));
assert(required.includes("(d.attachment?'Attach to ':'')"));
assert(required.includes("d.kind==='cards'&&!d.attachment"));
assert(patch.includes('sol-pod-build-v053.js'));
assert(build.includes("window.SOL_POD_BUILD='0.53.0'"));
class E{
 constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};
  this.style={};this.id='';this.className='';this.textContent='';this.attributes={};
  this.classList={toggle:()=>{}};}
 append(...items){this.children.push(...items);}
 replaceChildren(...items){this.children=[...items];}
 setAttribute(k,v){this.attributes[k]=String(v);}
 addEventListener(){}
}
const body=new E('body'),head=new E('head');
const doc={body,head,createElement:t=>new E(t),addEventListener(){},
 getElementById(id){const walk=e=>e.id===id?e:e.children.map(walk).find(Boolean);return walk(body);}
};
const selected=[];
const win={app:{nativeMatch:true,view:'game',game:{
 phase:'main1',phaseDetail:'MAIN1',winner:null,gameOver:false,
 players:[{forgeId:1,handCards:[],hand:[]}]}},
 ctForgeChoice:{hasPending:false},ctForgeSafety:{recoveryVisible:false,needsRecovery:false},
 ctForgePriority:{buttonInfo:{
  enable1:false,enable2:true,label1:'OK',label2:'Cancel',
  message:'Lightning Greaves (12) - Equip {0} ({0}: Attach to target creature you control. Equip only as a sorcery.)',
  sequence:1
 }},
 ctForgeSelection:{selectionInfo:{
  cards:[{id:44,label:'Solemn Simulacrum · You',zone:'Battlefield',actionable:false}],
  targets:[],chosen:[],min:1,max:1},
  isLegalCard:id=>id===44,chooseCard:async id=>{selected.push(id);return true;}
 },
 addEventListener(){},CommandTableNativeReply:()=>{}};
vm.runInNewContext(required,{window:win,document:doc,Promise,console},{filename:'required-action.js'});
const modal=doc.getElementById('ct-required-forge-action');
assert(modal,'The full-screen required action sheet is missing');
assert.equal(modal.dataset.open,'true','Legal Equipment target should open fullscreen');
const sheet=modal.children[0],heading=sheet.children[0],intro=sheet.children[1],
 options=sheet.children[3],footer=sheet.children[5];
assert.equal(heading.textContent,'Choose attachment target');
assert(intro.textContent.includes('Tap the creature you want to attach to'));
assert(options.children[0].textContent.startsWith('Attach to Solemn Simulacrum'));
assert(!footer.children.some(b=>b.textContent==='Use battlefield'),
 'Attachment target must never be hidden behind an ambiguous battlefield button');
assert(footer.children.some(b=>b.textContent==='Cancel'));
options.children[0].onclick();
(async()=>{
 await Promise.resolve();await Promise.resolve();
 assert.deepEqual(selected,[44],
  'Tapping the named legal target must send exactly its Forge object ID');
 if(process.argv[2]){
  const html=read(process.argv[2]);
  assert(html.includes("SOL_POD_BUILD='0.53.0'") &&
   html.includes("d.attachment?'Choose attachment target'"),
   'Compiled Android UI must include v0.53 attachment action and build marker');
 }
 console.log('PASS Sol Pod v0.53: Equipment fullscreen target selects exact creature, no misleading battlefield button, visible build version');
})().catch(e=>{console.error(e);process.exitCode=1;});
