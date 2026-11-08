#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const load=path=>fs.readFileSync(path,'utf8');
const analytics=load('forge-integration/web/sol-pod-deck-analytics-v063.js');
const zones=load('forge-integration/web/sol-pod-library-graveyard-v064.js');
const turn=load('forge-integration/web/sol-pod-turn-indicator-v063.js');
const patch=load('forge-integration/tools/patch_gameplay_v059.py');
for(const [name,src] of [['analytics',analytics],['zones',zones],['turn',turn]])
 new vm.Script(src,{filename:name+'.js'});
for(const needed of ['sol-v64-library','sol-v64-graveyard',
 "window.ctZoneBrowser?.open?.('graveyard')",
 "remaining<=5",'Your next required draw may cause you to lose',
 'me.graveyardCards','me.libraryCount'])
 assert(zones.includes(needed),'Missing Forge-backed zone UI: '+needed);
for(const needed of ['sol-v62-target-dock[data-active="true"]',
 'ct-zone-browser[data-open="true"]',
 'ct-floating-zones[data-open="true"]'])
 assert(turn.includes(needed),'Turn banner must not overlap '+needed);
for(const needed of ['window.solPodDeckAnalytics?.observeGame?.(raw)',
 'window.solPodDeckAnalytics?.cancelMatch?.()',
 'sol-pod-library-graveyard-v064.js',"window.SOL_POD_BUILD='0.64.0'"])
 assert(patch.includes(needed),'Missing v0.64 integration: '+needed);
for(const needed of ['session.phase!==\'bound\'',
 'Number(session.gameId)!==id',
 'revision:session.revision',
 'metadataPending',
 'Current revision · win rate',
 'Lifetime · win rate'])
 assert(analytics.includes(needed),'Missing protected results or stats: '+needed);
class E {
 constructor(tag='div'){this.tagName=tag;this.children=[];this.style={};
  this.dataset={};this.className='';this.textContent='';this.attrs={};}
 append(...items){this.children.push(...items);}
 replaceChildren(...items){this.children=items;}
 setAttribute(k,v){this.attrs[k]=String(v);}
 getAttribute(k){return this.attrs[k]||null;}
 addEventListener(){}
 focus(){}
}
const memory=new Map(),root=new E();
const document={head:new E('head'),body:new E('body'),createElement:t=>new E(t),
 getElementById:id=>id==='app'?root:null,
 addEventListener(){},querySelectorAll(){return [];}};
const cards=['Forest','Island','Sol Ring','Lightning Bolt'];
const deck={id:'deck-42',name:'Test',commander:'Leader',cards:cards.slice()};
const window={localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)},
 CardData:{cards:[
 {name:'Forest',type:'Land',manaValue:0},
 {name:'Island',type:'Land',manaValue:0},
 {name:'Sol Ring',type:'Artifact',manaValue:1},
 {name:'Lightning Bolt',type:'Instant',manaValue:1}]},
 app:{view:'home',nativeMatch:true,decks:[deck]},
 addEventListener(){}};
vm.runInNewContext(analytics,{window,document,Date,Number,Math,Map,Set,JSON,
 MutationObserver:class{observe(){}},requestAnimationFrame:fn=>fn()});
const api=window.solPodDeckAnalytics;
const rev=api.deckRevision(deck);
assert.equal(rev,api.deckRevision({...deck,cards:cards.slice().reverse()}),
 'Deck card ordering must not change the revision');
assert.notEqual(rev,api.deckRevision({...deck,cards:['Forest','Island','Sol Ring','Counterspell']}),
 'Changing cards must change the revision');
const terminal=(gameId,outcome='defeat')=>({
 gameId,gameOver:true,outcome,lossReason:'Milled',turn:14,
 winner:'Opponent',players:[{id:1,life:28},{id:2,life:3}]});
const active=gameId=>({gameId,gameOver:false,players:[{id:1},{id:2}]});
assert(api.beginMatch(deck,false));
assert(!api.recordMatch(terminal(12)),'An unbound match must not be counted');
assert(api.observeGame(active(12)),'Bind to first real running Forge game');
assert(!api.observeGame(active(13)),'Do not rebind to another game');
assert(!api.recordMatch(terminal(13)),'Stale terminal snapshot must be rejected');
assert(api.recordMatch(terminal(12)),'Matching game result must be counted');
assert.equal(api.history.length,1);
assert.equal(api.history[0].revision,rev);
assert(!api.recordMatch(terminal(12)),'Duplicate outcome must not count twice');
api.beginMatch(deck,false);
api.cancelMatch();
assert(!api.recordMatch(terminal(99)),'Failed launch must not count');
assert(api.beginMatch({...deck,cards:['Forest','Island','Sol Ring','Counterspell']},false));
assert(api.observeGame(active(14)));
assert(api.recordMatch(terminal(14,'victory')));
assert.equal(api.history.length,2);
assert.notEqual(api.history[0].revision,api.history[1].revision);
assert.equal(api.composition(deck).metadataPending,false);
if(process.argv[2]){
 const packaged=load(process.argv[2]);
 for(const needle of ["window.SOL_POD_BUILD='0.65.1'",
  'window.solPodLibraryGraveyard',
  'window.solPodDeckAnalytics?.observeGame?.(raw)',
  'Your next required draw may cause you to lose'])
  assert(packaged.includes(needle),'Packaged APK HTML missing '+needle);
}
console.log('PASS Sol Pod v0.64: match IDs, revisions, zone controls, metadata and turn overlay guards');
