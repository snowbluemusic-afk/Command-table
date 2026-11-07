/* Sol Pod v0.62 — battlefield-first gameplay, engine-authoritative interactions.
 * This layer supplies a direct touch surface; every mutation still goes through
 * the established Forge-backed selection or blocker command. No rules shortcuts.
 */
(()=>{
 'use strict';
 if(window.solPodGameplayV062)return;
 const make=(tag,cls,text)=>{
  const el=document.createElement(tag);if(cls)el.className=cls;
  if(text!==undefined)el.textContent=String(text);return el;
 };
 const style=make('style');style.id='sol-pod-gameplay-v062-style';
 style.textContent=[
  '#sol-v62-combat{display:none;position:fixed;z-index:2147482820;left:10px;',
  'top:clamp(64px,18dvh,125px);width:min(245px,40vw);max-height:55dvh;',
  'overflow:auto;box-sizing:border-box;border:1px solid #d5b985;border-radius:12px;',
  'background:#102630ed;color:#f8ebd1;padding:9px;box-shadow:0 9px 30px #0009;',
  'font:12px/1.3 system-ui;backdrop-filter:blur(8px)}',
  '#sol-v62-combat[data-active="true"]{display:block}',
  '#sol-v62-combat h3{font:700 14px Georgia,serif;margin:0 0 4px;color:#ffe1ad}',
  '#sol-v62-combat p{margin:3px 0 8px;color:#d2e1db}',
  '#sol-v62-combat .sol-v62-row{display:flex;gap:5px;flex-wrap:wrap;margin-top:6px}',
  '#sol-v62-combat button,#sol-v62-target-dock button,#sol-v62-damage button{',
  'min-height:33px;border-radius:8px;background:#294b57;color:#ffecd2;',
  'border:1px solid #cba875;padding:5px 8px;font:750 11px system-ui}',
  '#sol-v62-combat button:disabled{opacity:.45}',
  '#sol-v62-combat button[data-primary="true"]{background:#dfbd80;color:#132931}',
  '.sol-v62-block-attacker{outline:3px solid #ffb568!important;',
  'outline-offset:2px!important;box-shadow:0 0 13px #f0a35caa!important}',
  '.sol-v62-block-legal,.sol-v62-target-legal{outline:3px solid #63e2ba!important;',
  'outline-offset:2px!important;box-shadow:0 0 14px #51eacaaa!important}',
  '.sol-v62-block-selected{outline:3px solid #ffdf8b!important}',
  '#sol-v62-target-dock{display:none;position:fixed;z-index:2147483090;',
  'top:calc(env(safe-area-inset-top) + 8px);left:50%;transform:translateX(-50%);',
  'max-width:88vw;min-width:230px;box-sizing:border-box;padding:7px 9px;',
  'border:1px solid #e0be84;border-radius:10px;background:#102c35f5;',
  'color:#ffefd2;font:750 12px system-ui;box-shadow:0 8px 24px #0009;',
  'align-items:center;justify-content:center;gap:9px}',
  '#sol-v62-target-dock[data-active="true"]{display:flex}',
  '#ct-fullscreen-targets .sol-v62-board-choice{margin-left:auto;',
  'background:#326256;color:#f7edd9;border:1px solid #93d5b6;',
  'border-radius:9px;padding:7px 11px;min-height:35px;font:700 12px system-ui}',
  '#sol-v62-phase{position:fixed;z-index:2147482600;left:50%;',
  'top:calc(env(safe-area-inset-top) + 44px);transform:translateX(-50%);',
  'display:none;pointer-events:none;background:#163a3fe6;color:#fce8c4;',
  'padding:6px 16px;border:1px solid #cbac79;border-radius:99px;',
  'font:750 12px system-ui;box-shadow:0 5px 18px #0007}',
  '#sol-v62-phase[data-active="true"]{display:block}',
  '#sol-v62-damage{display:none;position:fixed;z-index:2147482660;',
  'left:12px;bottom:calc(env(safe-area-inset-bottom) + 7px);',
  'width:min(330px,48vw);max-height:43dvh;overflow:auto;padding:9px;',
  'box-sizing:border-box;border-radius:10px;border:1px solid #b89d78;',
  'background:#112833f2;color:#f4e5ce;font:11px/1.4 system-ui}',
  '#sol-v62-damage[data-active="true"]{display:block}',
  '#sol-v62-damage strong{display:block;font-size:12px;color:#ffe0a6}',
  '#sol-v62-damage li{padding:3px 0;border-bottom:1px solid #ffffff17}',
  '#sol-v62-damage ul{padding-left:16px;margin:4px 0}',
  '#ct-fullscreen-targets .ct-target-tile .ct-target-meta{line-height:1.45}',
  '.sol-battlefield .ct10-lane.ct10-creatures .game-card{scroll-margin:8px}',
  '#ct-forge-priority-buttons .sol-priority-heading{font-size:10px;opacity:.82}',
  '@media(orientation:landscape) and (max-height:440px){',
  '#sol-v62-combat{top:11%;width:min(214px,36vw);padding:6px;font-size:10px}',
  '#sol-v62-combat button{min-height:29px;padding:4px 6px}',
  '#sol-v62-phase{top:4px}#sol-v62-damage{width:min(310px,39vw)}}',
  '@media(prefers-reduced-motion:no-preference){',
  '.sol-v62-block-legal,.sol-v62-target-legal{transition:box-shadow .15s ease}',
  '#sol-v62-phase[data-active="true"]{animation:sol-v62-appear .2s ease-out}',
  '@keyframes sol-v62-appear{from{opacity:0}to{opacity:1}}}'
 ].join('');
 document.head.append(style);
 const combat=make('section');combat.id='sol-v62-combat';
 combat.setAttribute('role','group');combat.setAttribute('aria-label','Battlefield blocking controls');
 const heading=make('h3'),instructions=make('p'),summary=make('p'),actions=make('div','sol-v62-row');
 combat.append(heading,instructions,summary,actions);document.body.append(combat);
 const targetDock=make('section');targetDock.id='sol-v62-target-dock';
 targetDock.setAttribute('role','status');
 const targetText=make('span',null,'Tap a highlighted legal target.');
 const targetList=make('button',null,'All targets');targetList.type='button';
 targetList.onclick=()=>{targetMode=false;window.ctFullscreenTargets?.open?.();render();};
 targetDock.append(targetText,targetList);document.body.append(targetDock);
 const phaseToast=make('div');phaseToast.id='sol-v62-phase';document.body.append(phaseToast);
 const damage=make('aside');damage.id='sol-v62-damage';
 const damageTitle=make('strong',null,'Resolved damage & combat log');
 const damageList=make('ul');
 const damageClose=make('button',null,'Dismiss');damageClose.type='button';
 damageClose.onclick=()=>{damage.dataset.active='false';};
 damage.append(damageTitle,damageList,damageClose);document.body.append(damage);
 let attackerId=null,targetMode=false,busy=false,renderQueued=false;
 let prior=null,phaseTimer=null,damageTimer=null,seenDamage=-1;
 const game=()=>window.app?.nativeMatch&&window.app?.view==='game'?window.app.game:null;
 const human=()=>game()?.players?.[0];
 const attacks=()=>Array.isArray(game()?.combat)?game().combat.filter(a=>
  Number(a.defenderId)===Number(human()?.forgeId)):[];
 const blocking=()=>game()?.blockInputActive===true &&
  /COMBAT_DECLARE_BLOCKERS/i.test(String(game()?.phaseDetail||''))&&attacks().length>0;
 const battlefield=()=>game()?.players?.flatMap(p=>p.battlefield||[])||[];
 const card=id=>battlefield().find(c=>Number(c.forgeId)===Number(id));
 const legal=id=>game()?.legalBlockersReady===true?
  new Set((game()?.legalBlockers?.[String(id)]||[]).map(Number)):null;
 const cardId=el=>{
  const raw=el?.getAttribute?.('data-value');
  const match=raw&&String(raw).match(/(?:^|:)(\d+)$/);
  return match?Number(match[1]):null;
 };
 const boardCard=el=>el?.closest?.(
  '[data-action="inspectBoardPermanent"][data-value],.ct10-lane [data-action="cardId"][data-value]');
 const nodes=()=>[...document.querySelectorAll(
  '[data-action="inspectBoardPermanent"][data-value],.ct10-lane [data-action="cardId"][data-value]')];
 const button=(label,fn,primary=false)=>{
  const b=make('button',null,label);b.type='button';
  if(primary)b.dataset.primary='true';
  b.addEventListener('click',fn);return b;
 };
 const stats=c=>c&&Number.isFinite(Number(c.power))&&Number.isFinite(Number(c.toughness))?
  String(c.power)+'/'+String(c.toughness):'?/?';
 function cleanHighlights(){
  document.querySelectorAll('.sol-v62-block-attacker,.sol-v62-block-legal,'+
   '.sol-v62-block-selected,.sol-v62-target-legal').forEach(el=>
    el.classList.remove('sol-v62-block-attacker','sol-v62-block-legal',
     'sol-v62-block-selected','sol-v62-target-legal'));
 }
 function report(text){
  instructions.textContent=text;
 }
 function renderCombat(){
  const all=attacks();
  if(!all.some(a=>Number(a.cardId)===Number(attackerId)))
   attackerId=all[0]?.cardId??null;
  const selected=all.find(a=>Number(a.cardId)===Number(attackerId));
  const defender=selected&&card(selected.cardId);
  const ids=legal(attackerId);
  heading.textContent='Block '+(all.findIndex(a=>a===selected)+1)+'/'+all.length+
   ' · '+String(defender?.name||selected?.cardName||'Attacker');
  report(ids?'Tap an orange attacker, then a green legal blocker. Tap again to remove.':
   'Checking legal blockers… Open planner to refresh if needed.');
  const unblocked=all.filter(a=>!(a.blockerIds||[]).length);
  const power=unblocked.reduce((n,a)=>{
   const p=Number(card(a.cardId)?.power);
   return n+(Number.isFinite(p)?p:0);
  },0);
  summary.textContent=unblocked.length+' currently unblocked · visible power '+power+
   ' (not a damage forecast)';
  actions.replaceChildren();
  actions.append(button('‹',()=>{
   const i=all.findIndex(a=>Number(a.cardId)===Number(attackerId));
   attackerId=all[(i+all.length-1)%all.length].cardId;window.ctCombatPlanner?.selectAttacker?.(attackerId);render();
  }));
  actions.append(button('›',()=>{
   const i=all.findIndex(a=>Number(a.cardId)===Number(attackerId));
   attackerId=all[(i+1)%all.length].cardId;window.ctCombatPlanner?.selectAttacker?.(attackerId);render();
  }));
  actions.append(button('Details',()=>window.ctCombatPlanner?.open?.()));
  const count=all.reduce((n,a)=>n+(a.blockerIds||[]).length,0);
  const confirm=button(busy?'Working…':count?'Confirm '+count+' blocks':'Skip blocks',()=>{
   const submitted=window.ctCombatPlanner?.confirm?.();
   if(!submitted)window.ctCombatPlanner?.open?.();
  },true);
  confirm.disabled=busy||!window.ctCombatPlanner?.ready||
   !!window.ctDirectCombat?.pending;
  actions.append(confirm);
  for(const node of nodes()){
   const id=cardId(node);
   if(id==null)continue;
   if(all.some(a=>Number(a.cardId)===id))node.classList.add('sol-v62-block-attacker');
   if(selected?.blockerIds?.some(b=>Number(b)===id))
    node.classList.add('sol-v62-block-selected');
   else if(ids?.has(id))node.classList.add('sol-v62-block-legal');
  }
  // Collapsed token groups must stay discoverable when an individual member
  // is Forge-legal. Tapping a group expands the ORIGINAL card nodes/IDs.
  for(const group of document.querySelectorAll('.sol-token-stack')){
   const members=String(group.dataset.solTokenIds||'').split(',').map(Number);
   if(ids&&members.some(id=>ids.has(id)))group.classList.add('sol-v62-block-legal');
  }
 }
 function targetChoices(){
  return Array.isArray(window.ctForgeSelection?.legalTargets)?
   window.ctForgeSelection.legalTargets:[];
 }
 function showBoardButton(){
  const modal=document.getElementById('ct-fullscreen-targets');
  if(!modal||modal.dataset.open!=='true')return;
  const options=targetChoices();
  const boardIds=new Set(battlefield().map(c=>Number(c.forgeId)));
  const visible=options.some(t=>t.kind==='player'||(t.kind==='card'&&boardIds.has(Number(t.id))));
  const header=modal.querySelector('header');
  if(!header)return;
  let b=header.querySelector('.sol-v62-board-choice');
  if(!b){b=button('Tap target on board',()=>{
    targetMode=true;window.ctFullscreenTargets?.dismiss?.();render();
   });b.className='sol-v62-board-choice';header.append(b);}
  b.style.display=visible?'block':'none';
 }
 function renderTargets(){
  const targets=targetChoices();
  const allowed=new Set(targets.filter(t=>t.kind==='card').map(t=>Number(t.id)));
  const players=new Set(targets.filter(t=>t.kind==='player').map(t=>Number(t.id)));
  if(targetMode&&!targets.length)targetMode=false;
  for(const node of nodes())if(allowed.has(cardId(node)))
   node.classList.add('sol-v62-target-legal');
  for(const group of document.querySelectorAll('.sol-token-stack')){
   const members=String(group.dataset.solTokenIds||'').split(',').map(Number);
   if(members.some(id=>allowed.has(id)))group.classList.add('sol-v62-target-legal');
  }
  document.querySelectorAll('[data-ct-forge-player-id]').forEach(el=>{
   if(players.has(Number(el.getAttribute('data-ct-forge-player-id'))))
    el.classList.add('sol-v62-target-legal');
  });
  targetText.textContent='Tap a glowing target · '+targets.length+' legal option'+(targets.length===1?'':'s');
  targetDock.dataset.active=String(targetMode&&targets.length>0);
  // Enrich legal card choices with the *current* Forge-projected stats.
  document.querySelectorAll('#ct-fullscreen-targets [data-forge-target-kind="card"]')
   .forEach(tile=>{
    const c=card(tile.getAttribute('data-forge-target-id'));
    const meta=tile.querySelector('.ct-target-meta');
    if(c&&meta&&!meta.dataset.solV62){
     meta.dataset.solV62='true';
     meta.textContent+=' · '+String(c.type||'Permanent')+
      (c.creature?' · '+stats(c):'')+(c.tapped?' · tapped':'');
    }
   });
 }
 function render(){
  const g=game();cleanHighlights();
  if(!g){combat.dataset.active='false';targetDock.dataset.active='false';targetMode=false;return;}
  combat.dataset.active=String(blocking()&&!window.ctCombatPlanner?.visible &&
   !window.ctForgeChoice?.hasPending&&!window.ctForgeRequiredAction?.visible);
  if(combat.dataset.active==='true')renderCombat();
  if(!blocking())attackerId=null;
  showBoardButton();
  if(!window.ctForgeSafety?.recoveryVisible && !window.ctForgeRequiredAction?.visible)
   renderTargets();
  else {targetMode=false;targetDock.dataset.active='false';}
 }
 function queue(){if(renderQueued)return;renderQueued=true;
  requestAnimationFrame(()=>{renderQueued=false;render();});}
 document.addEventListener('click',event=>{
  const g=game();if(!g)return;
  const tile=boardCard(event.target);
  if(blocking()&&combat.dataset.active==='true'&&tile){
   const id=cardId(tile),all=attacks();
   if(all.some(a=>Number(a.cardId)===id)){
    event.preventDefault();event.stopImmediatePropagation();
    attackerId=id;window.ctCombatPlanner?.selectAttacker?.(id);queue();return;
   }
   const allowed=legal(attackerId);
   if(id!=null && (allowed?.has(id)||all.some(a=>(a.blockerIds||[]).some(b=>Number(b)===id)))){
    event.preventDefault();event.stopImmediatePropagation();
    if(busy||!window.ctCombatPlanner?.ready)return;
    busy=true;queue();
    Promise.resolve(window.ctCombatPlanner.assign(attackerId,id))
     .catch(err=>window.solPodNotice?.(String(err?.message||err),'error','block-error'))
     .finally(()=>{busy=false;queue();});
    return;
   }
  }
  if(!targetMode||!targetChoices().length||window.ctForgeSafety?.recoveryVisible||
     window.ctForgeRequiredAction?.visible)return;
  const player=event.target.closest?.('[data-ct-forge-player-id]');
  const id=player?Number(player.getAttribute('data-ct-forge-player-id')):cardId(tile);
  const kind=player?'player':'card';
  const chosen=targetChoices().some(t=>t.kind===kind&&Number(t.id)===id);
  if(!chosen)return;
  event.preventDefault();event.stopImmediatePropagation();
  if(busy)return;
  busy=true;
  const select=kind==='player'?window.ctForgeSelection.choosePlayer:
   window.ctForgeSelection.chooseCard;
  Promise.resolve(select(id)).then(ok=>{
   if(!ok)window.ctFullscreenTargets?.open?.();
   else window.solPodPreferences?.playCue?.('tap');
  }).catch(()=>window.ctFullscreenTargets?.open?.())
   .finally(()=>{busy=false;queue();});
 },true);
 function onState(){
  const g=game();if(!g){prior=null;render();return;}
  const next={turn:g.turn,active:g.active,phase:g.phaseDetail};
  if(prior && (prior.turn!==next.turn||prior.active!==next.active) &&
     !window.ctForgeChoice?.hasPending){
   phaseToast.textContent=next.active===0?'Your turn · '+String(g.phase||''):'Opponent turn';
   phaseToast.dataset.active='true';
   clearTimeout(phaseTimer);
   phaseTimer=setTimeout(()=>{phaseToast.dataset.active='false';},1500);
  }
  prior=next;
  const history=Array.isArray(g.damageHistory)?g.damageHistory:[];
  const last=history[history.length-1];
  if(last && Number.isInteger(Number(last.index))){
   const index=Number(last.index);
   if(seenDamage>=0&&index>seenDamage &&
      history.some(e=>Number(e.index)>seenDamage&&e.kind!=='COMBAT')){
    const recent=history.filter(e=>Number(e.index)>seenDamage).slice(-6);
    damageList.replaceChildren();
    for(const e of recent)damageList.append(make('li',null,String(e.message||e.kind)));
    damage.dataset.active='true';clearTimeout(damageTimer);
    damageTimer=setTimeout(()=>{damage.dataset.active='false';},12000);
   }
   seenDamage=index;
  }
  queue();
 }
 const root=document.getElementById('app');
 if(root)new MutationObserver(queue).observe(root,{childList:true,subtree:false});
 window.addEventListener('ct-forge-selection',queue);
 window.addEventListener('ct-forge-choice-cleared',queue);
 window.addEventListener('ct-combat-queue-updated',queue);
 window.addEventListener('ct-forge-prompt-updated',queue);
 const oldReply=window.CommandTableNativeReply;
 window.CommandTableNativeReply=function(payload){
  const response=typeof oldReply==='function'?oldReply(payload):undefined;
  let data;try{data=typeof payload==='string'?JSON.parse(payload):payload;}catch(_){}
  if(data?.type==='game.state'||data?.type==='game.selection')onState();
  return response;
 };
 window.solPodGameplayV062={refresh:queue,get targetMode(){return targetMode;},
  get blockerMode(){return blocking();}};
 onState();
})();