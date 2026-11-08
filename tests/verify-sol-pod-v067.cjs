#!/usr/bin/env node
'use strict';
// v0.67: aligned Hand/Zones, opponent public-zone counts and correct graveyard seat.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
const opponent=read('forge-integration/web/sol-pod-opponent-zones-v067.js');
const graveyard=read('forge-integration/web/forge-graveyard.js');
const layout=read('forge-integration/web/sol-pod-layout-v065.js');
const patch=read('forge-integration/tools/patch_gameplay_v059.py');
for(const [name,s] of [['opponent',opponent],['graveyard',graveyard],['layout',layout]])
 new vm.Script(s,{filename:name+'.js'});
for(const x of ["'left:17.0%!important;bottom:max(2.1%,env(safe-area-inset-bottom))!important;'",
 "'top:auto!important;width:10.8%!important;min-width:0!important;'",
 "'height:clamp(36px,6.4dvh,46px)!important;'"])
 assert(layout.includes(x),'Zones must match Hand dimensions and baseline: '+x);
for(const x of ['swap(">▤ YOUR HAND <b>",">▤ HAND <b>"',
 'sol-pod-opponent-zones-v067.js',"window.SOL_POD_BUILD='0.67.0'"])
 assert(patch.includes(x),'Missing Android HUD integration: '+x);
assert(graveyard.includes('function show(zoneName,initialSeat=0)'));
assert(graveyard.includes('requested<players.length?requested:0'));
assert(!opponent.includes('handCards')&&!opponent.includes('libraryCards'),
 'Opponent library is count-only; no hidden identities');
for(const x of ['#sol-pod-hud-layout>.sol-v67-opponent-zones',
 'host.insertBefore(row,following)',
 "host.querySelector('#sol-pod-stack')",
 "host.querySelector('#ct-forge-priority-buttons')",
 "window.ctZoneBrowser?.open?.('graveyard',id)",
 "app.tableMode==='overview'",
 'player.libraryCount','player.graveyardCards'])
 assert(opponent.includes(x),'Opponent HUD must be flow-based and Forge-backed: '+x);
class E {
 constructor(tag='div'){this.tagName=tag;this.children=[];this.className='';
  this.attrs={};this.dataset={};this.textContent='';this.hidden=false;this.style={};}
 append(...items){for(const child of items){if(child.parentNode)child.parentNode.children=
  child.parentNode.children.filter(x=>x!==child);
  child.parentNode=this;this.children.push(child);}}
 insertBefore(child,before){if(child.parentNode)child.parentNode.children=
  child.parentNode.children.filter(x=>x!==child);
  child.parentNode=this;const i=this.children.indexOf(before);
  this.children.splice(i<0?this.children.length:i,0,child);}
 get nextElementSibling(){
  const l=this.parentNode?.children||[];return l[l.indexOf(this)+1]||null;
 }
 setAttribute(k,v){this.attrs[k]=String(v);}
 querySelector(q){
  const matches=x=>q[0]==='.'?x.className.split(' ').includes(q.slice(1)):
   q[0]==='#'?x.id===q.slice(1):x.tagName===q;
  for(const el of this.children){if(matches(el))return el;
   const inner=el.querySelector(q);if(inner)return inner;}
  return null;
 }
 set innerHTML(v){
  this.children=[];
  for(const m of String(v).matchAll(/<(span|strong)>(.*?)<\/\1>/g)){
   const child=new E(m[1]);child.textContent=m[2];this.append(child);
  }
 }
}
const root=new E('root'),hud=new E('aside'),hub=new E(),stack=new E(),priority=new E(),own=new E();
hud.id='sol-pod-hud-layout';hub.id='sol-pod-hub';stack.id='sol-pod-stack';
priority.id='ct-forge-priority-buttons';own.className='sol-v64-zones';
hud.append(hub,stack,priority,own);
const document={head:new E('head'),createElement:t=>new E(t),
 getElementById:id=>id==='app'?root:id==='sol-pod-hud-layout'?hud:null};
const opened=[];
const players=[
 {name:'You',libraryCount:89,graveyardCards:[]},
 {name:'Azula',libraryCount:17,graveyardCards:[{name:'Mountain'},{name:'Ponder'}]},
 {name:'Eshki',libraryCount:55,graveyardCards:[{name:'Shock'},{name:'Birds'},{name:'Bolt'}]}
];
const window={app:{nativeMatch:true,view:'game',tableMode:'focus',focusPlayer:2,
 game:{players,active:1}},ctZoneBrowser:{open:(zone,index)=>opened.push([zone,index])},
 addEventListener(){}};
vm.runInNewContext(opponent,{window,document,MutationObserver:class{observe(){}},
 requestAnimationFrame:fn=>fn(),Number,Math});
const row=hud.querySelector('.sol-v67-opponent-zones');
assert(row&&!row.hidden);
assert.equal(hud.children.indexOf(row),hud.children.indexOf(stack)-1,
 'Opponent zone group must flow between Log and Stack/priority');
assert.equal(hud.lastElementChild,own,'Our own library/graveyard stays beneath Priority');
assert.equal(row.querySelector('.sol-v67-library').querySelector('strong').textContent,'55');
assert.equal(row.querySelector('.sol-v67-graveyard').querySelector('strong').textContent,'3');
row.querySelector('.sol-v67-graveyard').onclick({preventDefault(){},stopPropagation(){}});
assert.equal(opened[0][0],'graveyard');
assert.equal(opened[0][1],2,'Graveyard opens on focused opponent');
window.app.focusPlayer=1;window.solPodOpponentZones.refresh();
assert.equal(row.querySelector('.sol-v67-library').querySelector('strong').textContent,'17');
assert.equal(row.querySelector('.sol-v67-graveyard').querySelector('strong').textContent,'2');
row.querySelector('.sol-v67-graveyard').onclick({preventDefault(){},stopPropagation(){}});
assert.equal(opened[1][1],1,'Changing focus must change graveyard tab');
window.app.tableMode='overview';window.solPodOpponentZones.refresh();
assert(row.hidden,'Opponent panel hides while showing the whole pod');
if(process.argv[2]){
 const html=read(process.argv[2]);
 for(const x of ["window.SOL_POD_BUILD='0.67.0'",
  'window.solPodOpponentZones','function show(zoneName,initialSeat=0)',
  '>▤ HAND <b>','host.insertBefore(row,following)'])
  assert(html.includes(x),'Embedded Android UI missing: '+x);
 assert(!html.includes('>▤ YOUR HAND <b>'),
  'Legacy long Hand label should not appear in gameplay HUD');
}
console.log('PASS Sol Pod v0.67: matched controls, focused opponent public counts and graveyard viewer');
