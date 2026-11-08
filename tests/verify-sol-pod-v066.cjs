#!/usr/bin/env node
'use strict';
// v0.66 consolidation: one primary hand, one Players navigation, no rules changes.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=f=>fs.readFileSync(f,'utf8');
const hand=read('forge-integration/web/sol-pod-hand-grid-v059.js');
const hud=read('forge-integration/web/sol-pod-hud-consolidation-v066.js');
const turn=read('forge-integration/web/sol-pod-turn-indicator-v063.js');
const patch=read('forge-integration/tools/patch_gameplay_v059.py');
for(const [name,s] of [['hand',hand],['hud',hud],['turn',turn]])
 new vm.Script(s,{filename:name+'.js'});
for(const needle of [
 "'.sol-battlefield.ct10-hand-zoom .ct10-hand-ribbon, '",
 "'.sol-battlefield.ct10-hand-mulligan .ct10-hand-ribbon'",
 "ribbon.append(trigger)",
 "window.CommandTableAction?.('showHandCard',String(index))",
 "player.handForgeIds?.[index]",
 "window.ctForgeSelection?.isLegalCard?.(id)"
])assert(hand.includes(needle),'Search must stay under expanded hand with Forge identities: '+needle);
assert(!hand.includes("handToggle.insertAdjacentElement('afterend',trigger)"),
 'Top-left Browse must not return as an independent action');
assert(!hand.includes("request('choice.answer'")&&!hand.includes("request('game.command'"),
 'Hand browser must never answer Forge prompts or bypass legality');
for(const needle of [
 "'sol-player-full-pod'","count>2&&app.solRosterOpen",
 "'sol-pod-overview-back'","window.CommandTableAction?.('togglePod','')",
 "e.preventDefault();e.stopPropagation()"
])assert(hud.includes(needle),'Full Pod should be inside Players with safe return: '+needle);
for(const needle of [
 'pod_button','source,n=re.subn','assert n==1',
 'advanced=','source=source.replace(advanced,\'\')',
 "app.solRosterOpen=false;app.tableMode",
 "'● THEIR TURN'","'● OPPONENT'",
 "window.SOL_POD_BUILD='0.66.0'",
 'sol-pod-hud-consolidation-v066.js'
])assert(patch.includes(needle),'Packaging must remove redundancy: '+needle);
assert(turn.includes("'✦ YOUR RESPONSE'"),'Priority still visible');
assert(!turn.includes('positionBelowBrowse()'),'No obsolete top-left Browse anchor');
class Node{
 constructor(tag='div'){this.tag=tag;this.children=[];this.attrs={};this.handlers={};this.className='';}
 append(child){this.children.push(child);child.parentNode=this;}
 prepend(child){this.children.unshift(child);child.parentNode=this;}
 querySelector(q){
  const cls=q.replace('.','');
  return this.children.find(c=>c.className===cls)||null;
 }
 setAttribute(k,v){this.attrs[k]=String(v);}
 addEventListener(k,fn){this.handlers[k]=fn;}
 click(){this.handlers.click?.({preventDefault(){},stopPropagation(){}});}
}
const roster=new Node('nav'),overview=new Node('div'),root=new Node('div');
const document={
 head:new Node('head'),
 createElement:t=>new Node(t),
 getElementById:k=>k==='app'?root:null,
 querySelector:q=>q.includes('.sol-roster')?roster:q.includes('.ct10-overview')?overview:null
};
const calls=[];
const window={
 app:{nativeMatch:true,view:'game',solRosterOpen:true,game:{players:[{},{},{}]}},
 CommandTableAction:(action,value)=>calls.push([action,value])
};
vm.runInNewContext(hud,{window,document,MutationObserver:class{observe(){}},
 requestAnimationFrame:fn=>fn()});
const trigger=roster.querySelector('.sol-player-full-pod');
assert(trigger,'3+ player list should expose Full Pod');
trigger.click();
assert.equal(calls[0][0],'togglePod');
const back=overview.querySelector('.sol-pod-overview-back');
assert(back,'Full Pod must always have a visible return control');
back.click();
assert.equal(calls[1][0],'togglePod');
window.app.game.players=[{},{}];
const secondRoster=new Node('nav');
document.querySelector=q=>q.includes('.sol-roster')?secondRoster:q.includes('.ct10-overview')?null:null;
window.solPodHudConsolidation.refresh();
assert.equal(secondRoster.querySelector('.sol-player-full-pod'),null,
 '1v1 should not offer an unnecessary full-pod shortcut');
if(process.argv[2]){
 const html=read(process.argv[2]);
 for(const needle of [
  "window.SOL_POD_BUILD='0.66.0'",
  'window.solPodHudConsolidation',
  'ribbon.append(trigger)',
  'sol-player-full-pod',
  'sol-pod-overview-back',
  "'● OPPONENT'"
 ])assert(html.includes(needle),'Android package missing '+needle);
 assert(!html.includes('data-action="nativePrompts" title="Advanced Sol Pod decisions">⚖</button>'),
  'Redundant Advanced decision button remained in Android HTML');
 assert(!html.includes('data-action="togglePod" aria-label="Toggle pod overview" title="Show all players"'),
  'Redundant top-bar Pod icon remained in Android HTML');
}
console.log('PASS Sol Pod v0.66: hand Browse inside expansion, Players/Pod combined, advanced removed, concise turn cues');
