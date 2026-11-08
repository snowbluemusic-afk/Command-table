#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const load=x=>fs.readFileSync(x,'utf8');
const native=load('forge-integration/src/main/java/forge/commandtable/CommandTableGameProjection.java');
const catalog=load('forge-integration/src/main/java/forge/commandtable/CommandTableCardCatalog.java');
const result=load('forge-integration/web/sol-pod-match-result-v043.js');
const turn=load('forge-integration/web/sol-pod-turn-indicator-v063.js');
const analytics=load('forge-integration/web/sol-pod-deck-analytics-v063.js');
const patch=load('forge-integration/tools/patch_gameplay_v059.py');
for(const [name,js] of [['results',result],['turn',turn],['analytics',analytics]])
 new vm.Script(js,{filename:name+'.js'});
for(const needle of ['out.put("gameId", game.getId())','liveHuman.getOutcome()',
 'playerOutcome.lossState.name()','playerOutcome.loseConditionSpell',
 'finished.getWinSpellEffect()'])
 assert(native.includes(needle),'Missing authoritative Forge terminal state '+needle);
assert(catalog.includes('rules.getManaCost().getCMC()'),
 'Deck mana cost must be provided by Forge');
for(const needle of ["case 'Milled':",'attempted to draw a card from an empty library',
 'lossExplanation(next.lossReason,next.lossSource,next.winningEffect)',
 'window.solPodDeckAnalytics?.recordMatch?.(raw)'])
 assert(result.includes(needle),'Loss reason / recording missing '+needle);
for(const needle of ['g.active===0',"priority?'YOUR RESPONSE",
 'body.dataset.solPodTurn=who','prefers-reduced-motion'])
 assert(turn.includes(needle),'Turn ownership UI missing '+needle);
for(const needle of ['gameId:raw.gameId??null','lossReason:raw.lossReason??null',
 'window.solPodDeckAnalytics?.beginMatch?.(d,app.autoPilot)',
 'sol-pod-deck-analytics-v063.js','sol-pod-turn-indicator-v063.js',
 "window.SOL_POD_BUILD='0.63.0'"])
 assert(patch.includes(needle),'Missing packaged feature '+needle);
class E {
 constructor(tag='div'){this.tagName=tag;this.children=[];this.style={};
  this.dataset={};this.className='';this.textContent='';this.attrs={};}
 append(...v){this.children.push(...v);}
 replaceChildren(...v){this.children=v;}
 setAttribute(k,v){this.attrs[k]=String(v);}
 getAttribute(k){return this.attrs[k]||null;}
 addEventListener(){}
 focus(){}
}
const memory=new Map(),appRoot=new E();
const document={
 head:new E('head'),body:new E('body'),createElement:t=>new E(t),
 getElementById:id=>id==='app'?appRoot:null,
 addEventListener(){},querySelectorAll(){return [];}
};
const deck={id:'my-deck',name:'Test deck',commander:'Example Commander',
 cards:['Forest','Forest','Sol Ring','Lightning Bolt','Unknown Card']};
const window={
 localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)},
 CardData:{cards:[
  {name:'Forest',type:'Basic Land — Forest',manaValue:0},
  {name:'Sol Ring',type:'Artifact',manaValue:1},
  {name:'Lightning Bolt',type:'Instant',manaValue:1}]},
 app:{view:'home',nativeMatch:true,decks:[deck],game:null},
 addEventListener(){}};
vm.runInNewContext(analytics,{window,document,Date,Number,Math,Map,Set,JSON,
 MutationObserver:class{observe(){}},requestAnimationFrame:fn=>fn()},
 {filename:'sol-pod-deck-analytics-v063.js'});
const api=window.solPodDeckAnalytics,composition=api.composition(deck);
assert.equal(composition.counts.Land,2);
assert.equal(composition.counts.Artifact,1);
assert.equal(composition.counts.Instant,1);
assert.equal(composition.unknown,1);
assert.equal(composition.average,1);
assert.equal(api.reasonLabel('Milled'),'Empty library / failed draw');
assert(api.beginMatch(deck,false));
const terminal={gameId:45,gameOver:true,outcome:'defeat',lossReason:'Milled',
 turn:12,winner:'AI',players:[{id:1,life:30},{id:2,life:10}]};
assert(api.recordMatch(terminal));
assert.equal(api.history[0].deckId,deck.id);
assert.equal(api.history[0].reason,'Milled');
assert.equal(api.history[0].mode,'manual');
assert(!api.recordMatch(terminal),'Repeated game-over snapshots must not duplicate a loss');
api.beginMatch(deck,true);
assert(api.recordMatch({...terminal,gameId:46,outcome:'victory',lossReason:null}));
assert.equal(api.history.length,2);
assert.equal(api.history[1].mode,'watch');
if(process.argv[2]){
 const packaged=load(process.argv[2]);
 for(const needle of ["window.SOL_POD_BUILD='0.63.0'",
  'window.solPodDeckAnalytics','window.solPodTurnIndicator',
  'lossExplanation(next.lossReason,next.lossSource,next.winningEffect)',
  'gameId:raw.gameId??null'])
  assert(packaged.includes(needle),'Missing APK HTML feature '+needle);
}
console.log('PASS Sol Pod v0.63: Forge-authored loss cause, persistent turn cue, deck composition and deduplicated match history');
