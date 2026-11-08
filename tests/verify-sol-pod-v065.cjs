#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const load=path=>fs.readFileSync(path,'utf8');
const zones=load('forge-integration/web/sol-pod-library-graveyard-v064.js');
const turn=load('forge-integration/web/sol-pod-turn-indicator-v063.js');
const layout=load('forge-integration/web/sol-pod-layout-v065.js');
const patch=load('forge-integration/tools/patch_gameplay_v059.py');
for(const [name,js] of [['zones',zones],['turn',turn],['layout',layout]])
 new vm.Script(js,{filename:name+'.js'});
for(const text of ['#sol-pod-hud-layout>.sol-v64-zones',
 'host.lastElementChild!==group','group.hidden=!g?.players?.[0]',
 "document.getElementById('sol-pod-hud-layout')",
 "window.ctZoneBrowser?.open?.('graveyard')"])
 assert(zones.includes(text),'Library/Graveyard must live below the right HUD priority controls: '+text);
assert(!zones.includes("document.querySelector('.ct10-own-player')"),
 'Never mount public zone buttons alongside the hand/life total again');
for(const text of ['.sol-battlefield .sol-game-brand{display:none!important}',
 '#sol-pod-build-marker{display:none!important}',
 '.sol-battlefield .ct10-zone-rail>.ct-zone-toggle',
 '.sol-battlefield .ct10-hand-ribbon button',
 '#sol-pod-hud-layout>',
 'Sol Pod v'+String.raw`'+String(window.SOL_POD_BUILD`,
 'window.solPodLibraryGraveyard?.refresh?.()'])
 assert(layout.includes(text),'Missing clean HUD/layout/Settings behaviour '+text);
for(const text of ['left:clamp(12px,5.8vw,90px)',
 'clearTimeout(collapseTimer)','flag.dataset.compact=\'true\'',
 '2400','prefers-reduced-motion'])
 assert(turn.includes(text),'Missing top-left, compact turn cue '+text);
for(const text of ["window.SOL_POD_BUILD='0.65.0'",
 'sol-pod-layout-v065.js','window.solPodLayoutV065'])
 assert(patch.includes(text),'Build must package v0.65 '+text);

class Node {
 constructor(tag='div'){
  this.tagName=tag;this.children=[];this.style={};this.dataset={};this.attrs={};
  this.className='';this.textContent='';this.hidden=false;
 }
 append(...nodes){for(const x of nodes){if(x.parentElement) x.parentElement.children=x.parentElement.children.filter(y=>y!==x);
  x.parentElement=this;this.children.push(x);}}
 get lastElementChild(){return this.children[this.children.length-1]||null;}
 setAttribute(k,v){this.attrs[k]=String(v);}
 getAttribute(k){return this.attrs[k]||null;}
 get innerHTML(){return this.children.map(c=>c.tagName).join(',');}
 set innerHTML(v){this.children=[];for(const match of String(v).matchAll(/<(span|strong)>(.*?)<\/\1>/g)){
  const el=new Node(match[1]);el.textContent=match[2];this.append(el);
 }}
 querySelector(selector){
  const match=(x)=>selector==='strong'?x.tagName==='strong':
   selector==='span'?x.tagName==='span':
   selector.startsWith('.')?x.className.split(' ').includes(selector.slice(1)):false;
  for(const child of this.children){if(match(child))return child;
   const nested=child.querySelector(selector);if(nested)return nested;}
  return null;
 }
}
const root=new Node(),hud=new Node('aside'),head=new Node('head');
hud.id='sol-pod-hud-layout';const priority=new Node('section');
priority.id='ct-forge-priority-buttons';hud.append(priority);
const document={head,body:new Node('body'),
 createElement:t=>new Node(t),
 getElementById:id=>id==='app'?root:id==='sol-pod-hud-layout'?hud:null};
let graveOpened=0;
const window={app:{view:'game',nativeMatch:true,game:{
 players:[{library:Array(9).fill('Unknown'),graveyardCards:Array(3).fill({name:'Card'})}]
 }},ctZoneBrowser:{open:name=>{assert.equal(name,'graveyard');graveOpened++;}}};
vm.runInNewContext(zones,{document,window,MutationObserver:class{observe(){}},
 requestAnimationFrame:fn=>fn(),Number,Math});
const group=hud.querySelector('.sol-v64-zones');
assert(group,'Right HUD must contain zone counter row');
assert.equal(hud.lastElementChild,group,'Zones must be BELOW priority controls');
assert.equal(root.querySelector('.sol-v64-zones'),null,
 'Zones must not move into left/bottom battlefield');
assert.equal(group.querySelector('.sol-v64-library').querySelector('strong').textContent,'9');
assert.equal(group.querySelector('.sol-v64-graveyard').querySelector('strong').textContent,'3');
group.querySelector('.sol-v64-graveyard').onclick({preventDefault(){},stopPropagation(){}});
assert.equal(graveOpened,1,'Graveyard opens existing viewer');
window.app.game.players[0].library=[];
window.solPodLibraryGraveyard.refresh();
assert.equal(group.querySelector('.sol-v64-library').dataset.empty,'true');
assert(group.querySelector('.sol-v64-library').attrs['aria-label'].includes('next required draw'),
 'Empty library warns of possible failed draw, not an automatic defeat');

if(process.argv[2]){
 const packaged=load(process.argv[2]);
 for(const needle of ["window.SOL_POD_BUILD='0.65.0'",
  'window.solPodLayoutV065','left:clamp(12px,5.8vw,90px)',
  'host.lastElementChild!==group',
  '.sol-battlefield .sol-game-brand{display:none!important}'])
  assert(packaged.includes(needle),'Packaged Android HTML missing '+needle);
}
console.log('PASS Sol Pod v0.65: right HUD zones, direct graveyard, compact turn, removed branding and settings version');
