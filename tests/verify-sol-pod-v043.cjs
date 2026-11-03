'use strict';
/* Sol Pod v0.43: Forge-completed result and optional Game Log regression.
 * No simulated card rules or victory checks based on negative life totals.
 */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=path=>fs.readFileSync(path,'utf8');
const result=read('forge-integration/web/sol-pod-match-result-v043.js');
const projection=read('forge-integration/src/main/java/forge/commandtable/CommandTableGameProjection.java');
const proxy=read('forge-integration/src/main/java/forge/commandtable/CommandTableGuiProxy.java');
const patch=read('forge-integration/tools/patch_frontend.py');
const hub=read('forge-integration/web/sol-pod-hub-v030.js');
const notice=read('forge-integration/web/sol-pod-notifications-v029.js');
new vm.Script(result,{filename:'sol-pod-match-result-v043.js'});
assert(projection.includes('out.put("outcome", !gameOver ? null'),
 'Native result must be derived from Forge GameView completion');
assert(projection.includes('winningPlayer.equals(local.getLobbyPlayerName())'),
 'Native outcome must identify the actual local player');
assert(proxy.includes('"finishGame".equals(name)'),
 'Forge finishGame must publish the final authoritative snapshot');
assert(proxy.includes('"afterGameEnd".equals(name)'),
 'Forge afterGameEnd must not swallow the final snapshot');
assert(patch.includes("'sol-pod-match-result-v043.js'"),
 'Android embedding must include the standalone result modal');
assert(patch.includes('window.solPodMatchResult?.onState?.(state)'),
 'Every native state update must offer the Forge result');
assert(patch.includes('gameOver:!!raw.gameOver') && patch.includes('outcome:raw.gameOver'),
 'Hydrated game must retain authoritative GameView completion metadata');
assert(hub.includes('✦ GAME LOG') && hub.includes('sol-log-collapsed'),
 'Routine notifications must be collapsible');
assert(hub.includes("entry.dataset.kind==='error'") && hub.includes('logOpen=true'),
 'New errors must expand the event log');
assert(hub.includes('const hasChoices=') && hub.includes('sol-no-active-choices'),
 'Log collapse must not hide a Forge-legal selection');
assert(notice.includes('if(entries.size>20)'),
 'Game Log should retain a useful short history');

class Element{
 constructor(tag){
  this.tagName=tag.toUpperCase();this.id='';this.className='';
  this.children=[];this.parentNode=null;this.style={};this.dataset={};
  this.attrs={};this.textContent='';this.hidden=false;this.listeners={};
 }
 append(...parts){for(const p of parts){p.parentNode=this;this.children.push(p);}}
 setAttribute(key,value){this.attrs[key]=String(value);}
 addEventListener(event,handler){this.listeners[event]=handler;}
}
const head=new Element('head'),body=new Element('body'),document={
 head,body,createElement:tag=>new Element(tag)
};
const exits=[];
const window={
 app:{nativeMatch:true,view:'game',game:null},
 CommandTableAction:action=>exits.push(action)
};
vm.runInNewContext(result,{window,document,JSON,String,Number,Array});
const modal=body.children.find(n=>n.id==='sol-pod-match-result-v043');
const reopen=body.children.find(n=>n.id==='sol-pod-result-reopen');
assert(modal && reopen,'Result must live at document.body, not in clipped game scene');
const card=modal.children[0],title=card.children.find(n=>n.tagName==='H2');
const make=(gameOver,outcome,winner,life=-17)=>({
 gameOver,outcome,winner,turn:16,players:[
  {id:1,name:'You',life:33,hasLost:outcome==='defeat'},
  {id:2,name:'Krenko',life,hasLost:outcome==='victory'}]
});
window.solPodMatchResult.onState(make(false,null,null));
assert.equal(modal.dataset.open,'false',
 'Negative opponent life alone is NOT an authoritative match result');
window.solPodMatchResult.onState(make(true,'victory','You'));
assert.equal(modal.dataset.open,'true');
assert.equal(title.textContent,'Victory!');
assert.equal(window.solPodMatchResult.result,'victory');
const review=card.children.find(n=>n.className==='sol-result-actions').children[0];
const leave=card.children.find(n=>n.className==='sol-result-actions').children[1];
review.onclick();
assert.equal(modal.dataset.open,'false','Review must reveal the finished board');
assert.equal(reopen.style.display,'block','Player must be able to reopen result');
window.solPodMatchResult.onState(make(true,'victory','You'));
assert.equal(modal.dataset.open,'false',
 'Repeated identical outcome must not interrupt battlefield review');
reopen.onclick();
assert.equal(modal.dataset.open,'true','Result must reopen on demand');
window.solPodMatchResult.onState(make(true,'defeat','Krenko',33));
assert.equal(title.textContent,'Defeat','Opponent victory must show local defeat');
window.solPodMatchResult.onState(make(true,'draw',null,0));
assert.equal(title.textContent,'Draw','A completed game without a winner is Draw');
assert.equal(window.solPodMatchResult.result,'draw');
leave.onclick();
assert.equal(modal.dataset.open,'false');
assert.deepEqual(exits,['leaveFinishedGame'],
 'Return to decks must use the existing finished-game action');
window.app.nativeMatch=false;
window.solPodMatchResult.onState(make(true,'victory','You'));
assert.equal(modal.dataset.open,'false','No result when player has left the match');
const bundled=process.argv[2];
if(bundled){
 const html=read(bundled);
 assert(html.includes('sol-pod-match-result-v043'),
   'Embedded Android HTML must include the result dialog');
 assert(html.includes('window.solPodMatchResult?.onState?.(state)'),
   'Embedded Android state handler must publish result');
 assert(html.includes('sol-log-collapsed'),
   'Embedded Android HUD must support collapsing informational history');
}
console.log('PASS Sol Pod v0.43: Forge-only Victory/Defeat/Draw, review/reopen and collapsed Game Log');
