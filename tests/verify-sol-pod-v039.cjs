'use strict';
// Sol Pod v0.39: regression for the screenshot where an empty stack covered
// the Forge Play/Draw prompt in landscape. Verify ownership and ordering,
// preserve native controls, and ensure there is no separately positioned panel.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(p,'utf8');
const script=read('forge-integration/web/sol-pod-hud-layout-v039.js');
const stack=read('forge-integration/web/sol-pod-stack-v038.js');
const patch=read('forge-integration/tools/patch_frontend.py');
new Function(script);
assert(patch.includes("hud_layout=(Path(__file__).resolve().parent.parent/'web'/'sol-pod-hud-layout-v039.js')"),
 'Layout script missing from Android HTML generator');
assert(patch.indexOf("stack_viewer=(Path") < patch.indexOf("hud_layout=(Path"),
 'HUD layout must load AFTER stack so its CSS wins');
assert(stack.includes('rail.dataset.empty=String(!items.length)'), 'Empty state must follow Forge stack items');

class El{
 constructor(tag,id=''){
  this.tag=tag;this.id=id;this.parentNode=null;this.children=[];this.attrs={};this.style={};
  this.dataset={};this.textContent='';
 }
 append(...nodes){
  for(const n of nodes){
   if(n.parentNode)n.parentNode.children=n.parentNode.children.filter(c=>c!==n);
   n.parentNode=this;this.children.push(n);
  }
 }
 setAttribute(k,v){this.attrs[k]=String(v);}
}
const root=new El('div','app'),body=new El('body'),head=new El('head');
const hub=new El('section','sol-pod-hub');
const rail=new El('section','sol-pod-stack');rail.dataset.empty='true';
const priority=new El('section','ct-forge-priority-buttons');priority.style.display='block';
body.append(root,hub,priority,rail);
const doc={body,head,createElement:tag=>new El(tag),getElementById:id=>{
 const visit=el=>el.id===id?el:el.children.map(visit).find(Boolean);
 return visit(body);
}};
let queued=[];
const win={addEventListener(){},solPodHudLayout:null};
vm.runInNewContext(script,{document:doc,window:win,
 MutationObserver:class{observe(){}},
 requestAnimationFrame:fn=>{queued.push(fn);return queued.length;},
 console},{filename:'sol-pod-hud-layout-v039.js'});
const layout=doc.getElementById('sol-pod-hud-layout');
assert(layout,'Missing right HUD layout');
assert.deepEqual(layout.children.map(e=>e.id),[
 'sol-pod-hub','sol-pod-stack','ct-forge-priority-buttons'
],'Notifications must precede stack; priority actions must be LAST');
assert.equal(priority.parentNode,layout,'Forge Play/Draw buttons must share layout with stack');
assert.equal(rail.parentNode,layout,'Stack must not be an independent viewport-fixed layer');
assert.equal(hub.parentNode,layout,'Notifications must not float over stack');
assert.equal(priority.style.display,'block','HUD must preserve actionable Forge prompt display');
assert.equal(rail.dataset.empty,'true','Empty stack must remain explicitly empty');

const css=head.children[0].textContent;
const need=(part,reason)=>assert(css.includes(part),reason||('Missing '+part));
need('#sol-pod-hud-layout{display:contents}', 'Prematch Forge prompt must not be hidden');
need('display:flex;flex-direction:column;align-items:stretch;', 'Non-overlapping flex column required');
need('> #sol-pod-stack[data-empty="true"]', 'Empty stack must be hidden, not positioned over prompt');
need('display:none!important}', 'Empty panel must consume zero height');
need('> #ct-forge-priority-buttons{', 'Priority actions must be in same flex flow');
need('position:relative!important;inset:auto!important;', 'No fixed-position child HUD panels');
need('margin: auto 0 0 0!important;', 'Priority dock must stay at bottom without overlap');
need('overflow-y:auto!important;', 'Long stack/choice lists must scroll internally');
need('@media(orientation:landscape) and (max-height:460px)', 'Compact landscape required');
need('max-height:34dvh!important', 'Bound active stack height');
need(':has(.ct-forge-hand-choice)', 'Discard/mulligan prompt must remain above expanded hand');
need('pointer-events:none', 'Unused HUD space must remain click-through');
assert(!script.includes("action:'resolve'"), 'HUD layout must never submit Forge commands');

// A later UI redraw may replace priority; reflow must preserve ordering.
const newPriority=new El('section','ct-forge-priority-buttons');
layout.children=layout.children.filter(x=>x!==priority);
priority.parentNode=null;
body.append(newPriority);
win.solPodHudLayout.refresh();
assert.equal(layout.children.at(-1),newPriority,'Recreated Forge dock did not return to bottom of HUD');
assert.equal(layout.children.length,3,'HUD must never duplicate priority actions');
const generated=process.argv[2];
if(generated){
 const html=read(generated);
 assert(html.includes('sol-pod-hud-layout-v039'),'Generated Android HTML missing v0.39');
 assert(html.includes('sol-pod-stack-reader'),'v0.38 reader disappeared from generated UI');
 assert(html.indexOf('sol-pod-stack-v038')<html.lastIndexOf('sol-pod-hud-layout-v039'),
   'Android stack styles must precede final flex layout styles');
}
console.log('PASS v0.39: non-overlapping ordered HUD, hidden empty stack, protected Forge priority, compact landscape, remount recovery');
