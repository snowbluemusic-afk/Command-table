'use strict';
// Sol Pod v0.38: stable notifications ABOVE a separate stack, with a
// full-screen reader and Forge-controlled response/target selection.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const read=path=>fs.readFileSync(path,'utf8');
const hub=read('forge-integration/web/sol-pod-hub-v030.js');
const viewer=read('forge-integration/web/sol-pod-stack-v038.js');
const patch=read('forge-integration/tools/patch_frontend.py');
const java=read('forge-integration/src/main/java/forge/commandtable/CommandTableGameProjection.java');
const selection=read('forge-integration/web/forge-selection.js');
new Function(hub);new Function(viewer);
assert(!hub.includes('contents.append(stack)'), 'Stack must not be relocated into notices');
assert(!hub.includes('prior.remove()'), 'Old hub must not discard stack items');
assert(hub.includes('✦ GAME LOG'), 'Non-blocking game history must have a distinct heading');
assert(hub.includes('sol-log-collapsed'), 'Passive history must collapse without interfering with the stack');
assert(patch.includes('sol-pod-stack-v038.js'), 'Full-screen stack viewer not injected into generated Android UI');
assert(patch.includes('for(const item of Array.isArray(raw.stack)?raw.stack:[])'), 'Stack card metadata not hydrated');
assert(java.includes('item.getSourceCard()')&&java.includes('spell.put("cardName"'), 'Native Forge source art unavailable');
assert(java.includes('spell.put("targets"')&&java.includes('spell.put("controllerName"'), 'Stack identity/targets unavailable');
assert(selection.includes('isLegalStack:(id)'), 'Stack target button not constrained by Forge legality');
assert(!viewer.includes("action:'resolve'"), 'Stack reader cannot resolve spells directly');

class E {
 constructor(tag='div'){
   this.tagName=tag.toUpperCase();this.children=[];this.style={};
   this.dataset={};this.attributes={};this.hidden=false;this.disabled=false;this.textContent='';
   this.listeners=Object.create(null);
 }
 setAttribute(k,v){this.attributes[k]=String(v);}
 getAttribute(k){return this.attributes[k]??null;}
 append(...nodes){this.children.push(...nodes);for(const n of nodes)if(n&&typeof n==='object')n.parentNode=this;}
 replaceChildren(...nodes){this.children=[];this.append(...nodes);}
 addEventListener(type,fn){this.listeners[type]=fn;}
 focus(){this.focused=true;}
 remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this);}
 querySelector(){return null;}
}
const body=new E('body'),head=new E('head'),root=new E('div');root.id='app';body.append(root);
const ids={'app':root};
const document={
 body,head,activeElement:root,
 createElement:tag=>new E(tag),
 getElementById:id=>ids[id]||null,
 addEventListener(){}
};
let stateUpdated=null,renderCount=0,notices=[],submitted=[];
const app={
 nativeMatch:true,view:'game',modal:null,handZoom:false,
 game:{winner:null,turn:2,phaseDetail:'MAIN1',players:[{priority:true,hand:['Opt']}],
   stack:[
    {id:101,cardName:'Lightning Bolt',name:'Lightning Bolt → Deal 3 damage',
     description:'Deal 3 damage to any target.',type:'Instant',controllerName:'CPU 1',
     targets:[{kind:'player',id:1,name:'You'}]},
    {id:102,cardName:'Counterspell',name:'Counterspell → Counter target spell',
     description:'Counter target spell.',type:'Instant',controllerName:'You',
     targets:[{kind:'stack',id:101,name:'Lightning Bolt'}]}
   ]}
};
const win={
 app,
 ctForgeCards:{'lightning bolt':{type:'Instant',text:'Deal 3 damage to any target.'}},
 ctCardArtUrl:name=>'fake-card-art://'+name,
 ctForgeSafety:{needsRecovery:false},
 ctForgeChoice:{hasPending:false},
 ctForgePriority:{isHandChoice:false,isManaPayment:false,canConfirm:true},
 ctForgeSelection:{
   isLegalStack:id=>id===101,
   chooseStack:async id=>{submitted.push(id);return true;}
 },
 solPodNotice:(...args)=>notices.push(args),
 CommandTableNative:{onState:fn=>{stateUpdated=fn;return()=>{};}},
 render:()=>renderCount++,
 addEventListener(){}
};
vm.runInNewContext(viewer,{window:win,document,MutationObserver:class{observe(){}},
 requestAnimationFrame:fn=>{fn();return 1;},console,Number,String,Array,Map,Set,Promise}, {filename:'sol-pod-stack-v038.js'});
const rail=body.children.find(n=>n.id==='sol-pod-stack');
const overlay=body.children.find(n=>n.id==='sol-pod-stack-reader');
assert(rail&&overlay,'Independent stack and fullscreen reader not mounted');
assert.equal(rail.children[1].children.length,2,'Expected both spells visible');
const entries=rail.children[1].children;
assert(entries[0].children[1].children[0].textContent.includes('Counterspell'),
  'Top stack item must appear first');
assert.equal(entries[0].children[0].tagName,'IMG','Stack card artwork missing');
entries[0].onclick();
assert.equal(overlay.dataset.open,'true','Tapping spell must show full-screen reader');
const sheet=overlay.children[0],panels=sheet.children[1].children;
const details=panels[2],actions=details.children.at(-1);
assert(details.children.some(n=>n.textContent==='Counterspell'),'Reader does not identify selected spell');
const containsText=(node,value)=>node.textContent===value || node.children?.some(child=>containsText(child,value));
assert(containsText(details,'Counter target spell.'),'Forge effect text not shown');
const respond=actions.children.find(n=>n.textContent==='Respond');
assert(respond&&!respond.disabled,'Respond should be available with priority');
respond.onclick();
assert.equal(overlay.dataset.open,'false','Respond must close reader without resolving');
assert.equal(app.handZoom,true,'Respond should open hand for legal choices');
assert.equal(renderCount,1,'Respond should re-render accessible hand');
assert.equal(submitted.length,0,'Respond must not submit a guessed Forge game command');
win.solPodStack.open('101');
assert.equal(overlay.dataset.open,'true');
let d=overlay.children[0].children[1].children[2],a=d.children.at(-1);
const target=a.children.find(n=>n.textContent==='Target this spell');
assert(target&&!target.disabled&&!target.hidden,'Legal stack target cannot be chosen');
const pass=a.children.find(n=>n.textContent==='Pass priority');
assert(!pass,'Reader must never blindly pass/resolve Forge');
target.onclick();
Promise.resolve().then(()=>{
 assert.deepEqual(submitted,[101],'Target action must submit Forge-authorized stack ID');
 assert.equal(overlay.dataset.open,'false','Selecting a stack target closes the reader');
 win.solPodStack.open('102');
 d=overlay.children[0].children[1].children[2];
 a=d.children.at(-1);
 const invalid=a.children.find(n=>n.textContent==='Target this spell');
 assert(invalid.disabled&&invalid.hidden,'Illegal stack items must not be actionable');
 win.ctForgeChoice.hasPending=true;
 win.solPodStack.refresh();
 assert.equal(overlay.dataset.open,'false','Required Forge choice must take precedence');
 win.ctForgeChoice.hasPending=false;
 app.game.stack=[];
 stateUpdated?.();
 assert.equal(rail.dataset.empty,'true','Empty stack should collapse its dedicated panel');
 assert.equal(rail.children[1].children.length,1,'Empty stack explanatory state missing');
 const generated=process.argv[2];
 if(generated){
   const html=read(generated);
   assert(html.includes('sol-pod-stack-reader'),'Android generated HTML did not embed viewer');
   assert(html.includes('✦ GAME LOG'),'Android generated HTML did not keep Game Log separate from stack');
 }
 console.log('PASS Sol Pod v0.38: separate notifications, visible card stack, fullscreen reader, legal response/target, mandatory prompt safety');
}).catch(e=>{console.error(e);process.exitCode=1;});
