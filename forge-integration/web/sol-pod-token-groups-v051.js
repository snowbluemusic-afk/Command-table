/* Sol Pod v0.51: visual token stacks without combining real game objects.
 * Each Forge token retains its unique ID, stats and possible targets.
 * Expanding exposes every original card node and native click handler.
 */
(() => {
 'use strict';
 const style=document.createElement('style');
 style.id='sol-token-stack-style';
 style.textContent=[
  '.ct10-lane.ct10-creatures{overflow-x:auto!important;overflow-y:hidden!important;',
  'scrollbar-width:thin;align-items:center!important;gap:4px!important}',
  '.ct10-lane.ct10-creatures .sol-token-stack{display:flex;flex:0 0 auto;',
  'flex-direction:column;align-items:center;justify-content:center;gap:4px;',
  'min-width:clamp(86px,9vw,139px);max-width:150px;height:90%;min-height:49px;',
  'border:2px solid #d5bb7c;border-radius:11px;',
  'background:linear-gradient(135deg,#1b443b,#1b3441);',
  'box-shadow:0 5px 14px #0009;color:#f6dfa8;font:750 12px system-ui;',
  'text-align:center;padding:5px 8px;cursor:pointer;touch-action:manipulation}',
  '.ct10-lane.ct10-creatures .sol-token-stack strong{font-size:clamp(13px,1.35vw,18px)}',
  '.ct10-lane.ct10-creatures .sol-token-stack small{color:#cde1d6;font:700 9px system-ui}',
  '.ct10-lane.ct10-creatures .sol-token-stack[data-open="true"]{border-color:#6edbd4;',
  'background:#254952}',
  '.ct10-lane.ct10-creatures .game-card.sol-token-collapsed{display:none!important}',
  '.ct10-lane.ct10-creatures .sol-token-expanded{display:contents}',
  '@media(max-height:460px){.ct10-lane.ct10-creatures .sol-token-stack{min-width:80px;padding:3px}}'
 ].join('');
 style.textContent+='.ct10-lane.ct10-lands .sol-land-stack{display:flex;flex-direction:column;gap:2px;flex:0 0 auto;min-height:39px;padding:5px 8px;border:1px solid #bfa375;border-radius:8px;background:#234039;color:#f3e0aa;font:750 11px system-ui;text-align:left}'+
 '.ct10-lane.ct10-lands .sol-land-collapsed{display:none!important}';
 document.head.append(style);
 const expanded=new Set();
 const findTokens=()=>{
  const cards=new Map();
  const players=window.app?.game?.players||[];
  // Enchanted/equipped tokens are visually distinct permanents. Never fold
  // one into a generic token stack or hide its attached cards.
  const attachedHosts=new Set(players.flatMap(p=>p.battlefield||[])
    .filter(c=>c.attachedToId!==null&&c.attachedToId!==undefined)
    .map(c=>String(c.attachedToId)));
  for(const player of players){
   for(const c of player.battlefield||[]){
    if(c.token&&c.creature&&Number.isInteger(Number(c.forgeId)) &&
       !attachedHosts.has(String(c.forgeId)))
     cards.set(String(c.forgeId),c);
   }
  }
  return cards;
 };
 const key=c=>JSON.stringify([c.name,c.power,c.toughness,!!c.tapped,
   JSON.stringify(c.counters||{}),!!c.attacking,!!c.blocking]);
 const update=()=>{
  if(!window.app?.nativeMatch||window.app?.view!=='game')return;
  const byId=findTokens();
  const lanes=document.querySelectorAll('.ct10-lane.ct10-creatures');
  for(const lane of lanes){
   if(lane.dataset.solTokenGrouped==='true')continue;
   lane.dataset.solTokenGrouped='true';
   // Each render builds fresh card nodes. Never reuse detached cards or
   // change the underlying player's battlefield/card IDs.
   const buckets=new Map();
   for(const el of Array.from(lane.children)){
    if(!el.classList?.contains('game-card'))continue;
    const id=String(el.getAttribute('data-value')||'').split(':').at(-1);
    const c=byId.get(id);
    if(!c)continue;
    const k=key(c);
    if(!buckets.has(k))buckets.set(k,[]);
    buckets.get(k).push({el,card:c});
   }
   for(const [k,members] of buckets){
    if(members.length<4)continue;
    const c=members[0].card;
    const uniqueId=String(c.name)+'|'+k+'|'+(lane.classList.contains('ct10-lane-own')?'own':'opp');
    const isOpen=expanded.has(uniqueId);
    const button=document.createElement('button');
    button.type='button';button.className='sol-token-stack';
    button.dataset.open=String(isOpen);
    // Preserve the exact Forge IDs for v0.62 legal-target/block highlights.
    button.dataset.solTokenIds=members.map(m=>m.card.forgeId).join(',');
    button.setAttribute('aria-expanded',String(isOpen));
    button.setAttribute('aria-label',(isOpen?'Collapse ':'Expand ')+
      members.length+' '+c.name+' tokens');
    const title=document.createElement('strong');
    title.textContent='×'+members.length+' '+c.name;
    const description=document.createElement('small');
    description.textContent=(c.power??'?')+'/'+(c.toughness??'?')+
      (c.tapped?' · tapped':'')+
      (isOpen?' · Collapse':' · Tap to inspect/use');
    button.append(title,description);
    button.onclick=event=>{
     event.preventDefault();event.stopImmediatePropagation();
     if(expanded.has(uniqueId))expanded.delete(uniqueId);
     else expanded.add(uniqueId);
     const opening=expanded.has(uniqueId);
     button.dataset.open=String(opening);
     button.setAttribute('aria-expanded',String(opening));
     description.textContent=(c.power??'?')+'/'+(c.toughness??'?')+
       (c.tapped?' · tapped':'')+(opening?' · Collapse':' · Tap to inspect/use');
     for(const {el} of members)
      el.classList.toggle('sol-token-collapsed',!opening);
    };
    lane.insertBefore(button,members[0].el);
    for(const {el} of members)
     el.classList.toggle('sol-token-collapsed',!isOpen);
   }
  }
  // Basic-land visual stacks preserve original node IDs. Auto-expand while
  // mana payments or Forge card targeting require individual permanents.
  const landCards=new Map((window.app?.game?.players||[]).flatMap(p=>p.battlefield||[])
    .map(c=>[String(c.forgeId),c]));
  const attachedHosts=new Set([...landCards.values()]
    .filter(c=>c.attachedToId!=null).map(c=>String(c.attachedToId)));
  const landTargets=new Set((window.ctForgeSelection?.legalTargets||[])
    .filter(t=>t.kind==='card').map(t=>String(t.id)));
  for(const lane of document.querySelectorAll('.ct10-lane.ct10-lands')){
   if(lane.dataset.solLandGrouped==='true')continue;
   lane.dataset.solLandGrouped='true';
   const buckets=new Map();
   for(const el of Array.from(lane.children)){
    if(!el.classList?.contains('game-card'))continue;
    const id=String(el.getAttribute('data-value')||'').split(':').at(-1);
    const c=landCards.get(id);
    if(!c?.land || !['Plains','Island','Swamp','Mountain','Forest','Wastes'].includes(c.name) ||
       attachedHosts.has(id)||c.attachedToId!=null||Number(c.counters||0)!==0)continue;
    const key=c.name+'|'+Boolean(c.tapped);
    if(!buckets.has(key))buckets.set(key,[]);
    buckets.get(key).push({el,c,id});
   }
   for(const [key,members] of buckets){
    if(members.length<5)continue;
    const groupId='basic:'+key+':'+(lane.classList.contains('ct10-lane-own')?'own':'opp');
    const open=expanded.has(groupId)||window.ctForgePriority?.isManaPayment===true||
      members.some(m=>landTargets.has(m.id));
    const button=document.createElement('button');
    button.type='button';button.className='sol-land-stack';
    button.dataset.solTokenIds=members.map(m=>m.id).join(',');
    button.setAttribute('aria-expanded',String(open));
    const title=document.createElement('strong');title.textContent='×'+members.length+' '+members[0].c.name;
    const copy=document.createElement('small');copy.textContent=open?'Choose individual land':'Tap to expand lands';
    button.append(title,copy);
    button.onclick=e=>{
     e.preventDefault();e.stopImmediatePropagation();
     const expand=button.getAttribute('aria-expanded')!=='true';
     if(expand)expanded.add(groupId);else expanded.delete(groupId);
     button.setAttribute('aria-expanded',String(expand));
     copy.textContent=expand?'Choose individual land':'Tap to expand lands';
     for(const m of members)m.el.classList.toggle('sol-land-collapsed',!expand);
    };
    lane.insertBefore(button,members[0].el);
    for(const m of members)m.el.classList.toggle('sol-land-collapsed',!open);
   }
  }
 };
 window.solPodGroupTokens=update;
})();
