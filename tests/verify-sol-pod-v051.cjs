'use strict';
// Sol Pod v0.51: no local combat legality, persistent full-screen block
// planner, exact blocker IDs, attachment target handoff, token visual groups.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
const planner=read('forge-integration/web/sol-pod-combat-planner-v051.js');
const attachment=read('forge-integration/web/sol-pod-attachment-flow-v051.js');
const tokens=read('forge-integration/web/sol-pod-token-groups-v051.js');
const target=read('forge-integration/web/forge-target-dialog-v040.js');
const frontend=read('forge-integration/tools/patch_frontend.py');
const native=read('forge-integration/src/main/java/forge/app/CommandTableOverlay.java');
const input=read('forge-integration/src/main/java/forge/commandtable/CommandTableForgeInput.java');
for(const js of [planner,attachment,tokens,target])new vm.Script(js);
for(const name of ['sol-pod-combat-planner-v051.js',
 'sol-pod-attachment-flow-v051.js','sol-pod-token-groups-v051.js'])
 assert(frontend.includes(name),name+' must be embedded into Android');
assert(frontend.includes('window.solPodGroupTokens?.()') &&
 frontend.includes('window.ctCombatPlanner?.sync?.()'),
 'Native game rendering must update independent combat/token views');
assert(native.includes('"combat.block".equals(action)') &&
 native.includes('"combat.attack".equals(action)') &&
 native.includes('"mulligan.bottom.select".equals(action)'),
 'Combat/mulligan input must be on the native INTERACTIVE worker');
assert(input.includes('human().selectCard(attacker, Collections.emptyList(), null)') &&
 input.includes('human().selectCard(blocker, Collections.emptyList(), null)'),
 'Forge InputBlock owns exact attacker-before-blocker selection');
assert(planner.includes("action:'combat.block'") &&
 planner.includes("window.CommandTableNative.request('game.snapshot')"),
 'Planner must mutate and verify via Forge only');
assert(planner.includes('Suggested matches by power/toughness (optional)') &&
 !planner.includes("action:'autoBlocks'"),
 'Suggestions must be visual only, never automatic assignments');
assert(target.includes("window.ctAttachmentFlow?.current?.()") &&
 target.includes("window.app?.modal==='inspect'"),
 'Required attachment targeting must take priority over stale inspect modal');
assert(attachment.includes("action:'cardId',value:id") &&
 attachment.includes('event.stopImmediatePropagation()'),
 'Equipment activation must use native card ID and not double-submit');
assert(tokens.includes('members.length<4') &&
 tokens.includes('sol-token-collapsed') &&
 tokens.includes('data-value'),
 'Token grouping must retain exact expanded card elements and stable IDs');
assert(!tokens.includes('app.game.players[0].battlefield='),'UI must not merge actual token records');

class E{
 constructor(tag='div'){
  this.tagName=String(tag).toUpperCase();this.children=[];this.parentNode=null;
  this.id='';this.className='';this.dataset={};this.style={};this.attrs={};
  this.textContent='';this.disabled=false;this.listeners={};this.hidden=false;
  this.classList={contains:cls=>String(this.className).split(' ').includes(cls),
   toggle:(cls,on)=>{const classes=new Set(String(this.className).split(' ').filter(Boolean));
    if(on)classes.add(cls);else classes.delete(cls);this.className=[...classes].join(' ');}};
 }
 append(...xs){for(const x of xs){if(x.parentNode)x.parentNode.children=x.parentNode.children.filter(v=>v!==x);x.parentNode=this;this.children.push(x);}}
 replaceChildren(...xs){this.children=[];this.append(...xs);}
 setAttribute(key,val){this.attrs[key]=String(val);}
 getAttribute(key){return this.attrs[key]??null;}
 addEventListener(key,fn){this.listeners[key]=fn;}
 remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(x=>x!==this);}
 insertBefore(x,other){const idx=this.children.indexOf(other);if(idx>=0){x.parentNode=this;this.children.splice(idx,0,x);}}
}
const callbacks={};const body=new E('body');const head=new E('head');
const root=new E('div');root.id='app';body.append(root);
const doc={
 head,body,createElement:t=>new E(t),addEventListener:(k,fn)=>{(callbacks[k]??=[]).push(fn);},
 getElementById(id){const find=e=>e.id===id?e:e.children.map(find).find(Boolean);return find(body);},
 querySelectorAll(selector){
  const all=e=>[e,...e.children.flatMap(all)];
  if(selector==='.ct10-lane.ct10-creatures')
   return all(body).filter(e=>e.classList.contains('ct10-lane')&&e.classList.contains('ct10-creatures'));
  return [];
 }
};
const own={forgeId:1,battlefield:[
 {forgeId:101,name:'Bear',creature:true,power:4,toughness:4,tapped:false},
 {forgeId:102,name:'Angel',creature:true,power:3,toughness:3,tapped:false},
 ...Array.from({length:31},(_,i)=>({forgeId:200+i,name:'Goblin Token',creature:true,
  token:true,power:1,toughness:1,tapped:false}))
]};
const opponent={forgeId:2,battlefield:[
 {forgeId:901,name:'Dragon',creature:true,power:5,toughness:5},
 {forgeId:902,name:'Wolf',creature:true,power:2,toughness:2}
]};
const app={nativeMatch:true,view:'game',modal:null,game:{
 phase:'combat',phaseDetail:'COMBAT_DECLARE_BLOCKERS',turn:8,winner:null,gameOver:false,
 players:[own,opponent],combat:[
  {cardId:901,cardName:'Dragon',defenderId:1,blockerIds:[]},
  {cardId:902,cardName:'Wolf',defenderId:1,blockerIds:[]}
 ]}};
const hooks={};let pendingTimers=[],calls=[],confirmed=0,synced=0;
const win={app,ctForgeSafety:{recoveryVisible:false},
 ctForgeChoice:{hasPending:false},ctForgeRequiredAction:{visible:false},
 ctDirectCombat:{pending:0,whenIdle:async()=>{}},
 ctForgePriority:{canConfirm:true,confirm:async()=>{confirmed++;return true;}},
 ctCardArtUrl:name=>'https://example.com/'+name,
 CommandTableNative:{request:async(type,p={})=>{
  calls.push({type,p});
  if(type==='game.command'&&p.action==='combat.block'){
   const attack=app.game.combat.find(a=>a.cardId===p.value.attackerId);
   const ids=attack.blockerIds;const k=ids.indexOf(p.value.blockerId);
   if(k>=0)ids.splice(k,1);else ids.push(p.value.blockerId);
   return {accepted:true};
  }
  if(type==='game.snapshot')return {game:app.game};
  return {accepted:true};
 }},
 ctReceiveForgeState:g=>{app.game=g;synced++;},
 addEventListener:(key,fn)=>{(hooks[key]??=[]).push(fn);},
 dispatchEvent:e=>{for(const fn of hooks[e.type]||[])fn(e);},
 CommandTableNativeReply:()=>{},
 Event:class{constructor(type){this.type=type;}}
};
const clock={setTimeout:fn=>{pendingTimers.push(fn);return pendingTimers.length;},
 clearTimeout:()=>{},Date,Promise,Number,Set,Map,JSON};
vm.runInNewContext(planner,{window:win,document:doc,...clock},
 {filename:'sol-pod-combat-planner-v051.js'});
const modal=doc.getElementById('sol-combat-planner');
assert.equal(modal.dataset.open,'false','Do not flash combat modal immediately before phase settles');
pendingTimers.shift()?.();
assert.equal(modal.dataset.open,'true','Stable blocker step should open full-screen planner');
const sheet=modal.children[0],columns=sheet.children[2];
const attackItems=columns.children[0].children[1];
const blockerItems=columns.children[1].children[1];
assert.equal(attackItems.children.length,2,'Show every incoming attacker');
assert(blockerItems.children.some(x=>x.tagName==='DETAILS'),
 '31 tokens should appear as one expandable blocker group');
const suggestions=blockerItems.children.find(x=>x.className==='sol-block-suggest');
assert(suggestions?.children.length>=2,'Optional suggested matches should be visible');
assert.equal(calls.length,0,'Suggestions must not auto-assign blocks');
const bear=blockerItems.children.find(x=>x.className==='sol-block-card'&&
 x.children[1]?.children?.[0]?.textContent==='Bear');
assert(bear,'Individual non-token blocker missing');
bear.onclick();
(async()=>{
 for(let i=0;i<10;i++)await Promise.resolve();
 assert(calls.some(x=>x.p?.action==='combat.block'&&
  x.p.value.attackerId===901&&x.p.value.blockerId===101),
  'Selection must send exact attacker and blocker IDs');
 assert.deepEqual(app.game.combat[0].blockerIds,[101],'Native combat result did not assign blocker');
 bear.onclick();
 for(let i=0;i<10;i++)await Promise.resolve();
 assert.deepEqual(app.game.combat[0].blockerIds,[],'Second explicit tap should remove assignment in Forge');
 assert.equal(synced>=2,true,'Planner should resync from authoritative combat state');
 const foot=sheet.children[4],skip=foot.children.at(-1);
 assert.equal(skip.textContent,'Skip blocking');
 skip.onclick();
 for(let i=0;i<7;i++)await Promise.resolve();
 assert.equal(confirmed,1,'Skip requires explicit player action on native button');
 // Test the token presentation layer independently, with exact card nodes.
 app.game.phase='main1';app.game.phaseDetail='MAIN1';
 const lane=new E('div');lane.className='ct10-lane ct10-creatures ct10-lane-own';
 for(const t of own.battlefield.slice(2)){
  const el=new E('div');el.className='game-card';el.setAttribute('data-value',String(t.forgeId));
  lane.append(el);
 }
 root.append(lane);
 const before=own.battlefield.map(c=>c.forgeId);
 vm.runInNewContext(tokens,{window:win,document:doc},
  {filename:'sol-pod-token-groups-v051.js'});
 win.solPodGroupTokens();
 const group=lane.children.find(c=>c.className==='sol-token-stack');
 assert(group,'Visual token summary missing');
 assert.equal(lane.children.filter(c=>c.classList.contains('sol-token-collapsed')).length,31,
  'Collapsed summary must conceal all duplicate visuals');
 group.onclick({preventDefault(){},stopImmediatePropagation(){}});
 assert.equal(lane.children.filter(c=>c.classList.contains('sol-token-collapsed')).length,0,
  'Expanding must expose every original card, not a merged simulator token');
 assert.deepEqual(own.battlefield.map(c=>c.forgeId),before,
  'Grouping must preserve all 31 separate native token IDs');
 if(process.argv[2]){
  const html=read(process.argv[2]);
  assert(html.includes('sol-combat-planner')&&html.includes('sol-token-stack')&&
   html.includes('ctAttachmentFlow'),'Embedded app missing v0.51 UX modules');
 }
 console.log('PASS Sol Pod v0.51: full-screen combat, confirmed block toggles, optional suggestions, exact 31-token expansion, native attachment handoff');
})().catch(e=>{console.error(e);process.exitCode=1;});
