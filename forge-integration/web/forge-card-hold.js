/* Hold any visible card to read it without entering another screen. */
(() => {
  'use strict';
  const style=document.createElement('style');
  style.id='ct-card-hold-v018';
  style.textContent=[
    '#ct-card-hold-preview{position:fixed;inset:0;z-index:2147482600;display:none;',
    'align-items:center;justify-content:center;gap:16px;padding:14px;background:#061015b3;pointer-events:none}',
    '#ct-card-hold-preview[data-visible="true"]{display:flex}',
    '#ct-card-hold-preview img{width:clamp(165px,22vw,280px);height:min(77dvh,395px);object-fit:contain;',
    'flex:none;border-radius:10px;filter:drop-shadow(0 13px 20px #000c)}',
    '#ct-card-hold-preview section{color:#f5ebd8;max-width:270px;max-height:76dvh;overflow:hidden;',
    'background:#102732ef;border:1px solid #8b9b94;border-radius:12px;padding:14px;font:12px/1.45 system-ui}',
    '#ct-card-hold-preview strong{display:block;font-size:17px;color:#ffe1b5;margin-bottom:6px}',
    '#ct-card-hold-preview small{display:block;color:#c5d6d0;margin-bottom:9px}',
    '@media(orientation:portrait){#ct-card-hold-preview{flex-direction:column;gap:5px}',
    '#ct-card-hold-preview img{height:min(54dvh,325px)}#ct-card-hold-preview section{max-height:23dvh}}'
  ].join('');
  document.head.append(style);
  const preview=document.createElement('div');
  preview.id='ct-card-hold-preview';preview.dataset.visible='false';
  preview.setAttribute('role','status');
  preview.setAttribute('aria-label','Enlarged card, release to return to game');
  document.body.append(preview);
  let hold=null,suppressClick=false;
  const cardFor=target=>target?.closest?.('.ct10-stage .game-card,.ct-hand-browser .game-card');
  function hide(){preview.dataset.visible='false';preview.replaceChildren();}
  function show(card){
    if(!window.app?.nativeMatch||window.app?.view!=='game'||window.app?.zonesOpen||window.app?.modal)return;
    const img=card.querySelector('img');
    const name=img?.getAttribute('data-art-name')||card.getAttribute('title')||card.getAttribute('aria-label')||'Card';
    const meta=window.ctForgeCards?.[String(name).toLowerCase()];
    const art=document.createElement('img');
    art.alt=name;art.src=img?.currentSrc||img?.src||'';
    const text=document.createElement('section');
    const title=document.createElement('strong');title.textContent=name;
    const type=document.createElement('small');type.textContent=meta?.type||'Magic card';
    const rule=document.createElement('p');
    rule.textContent=meta?.text||'Hold to view; tap Full details to read additional card text.';
    text.append(title,type,rule);
    preview.replaceChildren(art,text);preview.dataset.visible='true';
  }
  document.addEventListener('pointerdown',event=>{
    if(event.button!==0||window.app?.zonesOpen)return;
    const card=cardFor(event.target);
    if(!card)return;
    if(hold?.timer)clearTimeout(hold.timer);
    const h={card,pointerId:event.pointerId,x:event.clientX,y:event.clientY,shown:false,timer:null};
    hold=h;
    h.timer=setTimeout(()=>{if(hold===h){h.shown=true;show(h.card);}},390);
  },true);
  document.addEventListener('pointermove',event=>{
    if(!hold||hold.pointerId!==event.pointerId)return;
    if(Math.hypot(event.clientX-hold.x,event.clientY-hold.y)>12){
      if(hold.timer)clearTimeout(hold.timer);
      if(!hold.shown)hold=null;
    }
  },true);
  const end=event=>{
    if(!hold||hold.pointerId!==event.pointerId)return;
    if(hold.timer)clearTimeout(hold.timer);
    if(hold.shown){
      hide();suppressClick=true;
      setTimeout(()=>{suppressClick=false;},230);
    }
    hold=null;
  };
  document.addEventListener('pointerup',end,true);
  document.addEventListener('pointercancel',end,true);
  document.addEventListener('click',event=>{
    if(!suppressClick)return;
    suppressClick=false;event.preventDefault();event.stopImmediatePropagation();
  },true);
  document.addEventListener('contextmenu',event=>{
    if(cardFor(event.target))event.preventDefault();
  },true);
  window.ctCardHold={hide,get visible(){return preview.dataset.visible==='true';}};
})();