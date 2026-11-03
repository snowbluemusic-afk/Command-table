/* Read-only graveyard and exile viewer. Forge's public zone snapshots are
 * the sole source of cards; this component never moves or casts cards.
 */
(() => {
  'use strict';
  const css=document.createElement('style');
  css.id='ct-graveyard-browser-css';
  css.textContent=[
    '#ct-zone-browser{position:fixed;inset:0;z-index:2147482900;display:none;',
    'align-items:center;justify-content:center;padding:12px;background:#061016dc;',
    'box-sizing:border-box;color:#f6e4c8;font-family:system-ui,-apple-system,sans-serif}',
    '#ct-zone-browser[data-open="true"]{display:flex}',
    '#ct-zone-browser .ct-zb-sheet{display:flex;flex-direction:column;width:min(980px,97vw);',
    'height:min(88dvh,660px);min-height:0;background:linear-gradient(145deg,#16313a,#091c25);',
    'border:1px solid #c5a374;border-radius:16px;overflow:hidden;box-shadow:0 20px 65px #000e}',
    '#ct-zone-browser .ct-zb-header{display:flex;align-items:center;justify-content:space-between;',
    'padding:10px 14px;gap:12px;border-bottom:1px solid #947b5555}',
    '#ct-zone-browser .ct-zb-header h2{margin:0;font:700 21px Georgia,serif;color:#f9dc9f}',
    '#ct-zone-browser button{touch-action:manipulation;cursor:pointer}',
    '#ct-zone-browser .ct-zb-close{min-width:42px;min-height:42px;background:#2b4650;',
    'border:1px solid #b69a74;border-radius:11px;color:white;font-size:24px}',
    '#ct-zone-browser .ct-zb-seats{display:flex;flex-wrap:wrap;gap:6px;padding:8px 12px;',
    'border-bottom:1px solid #977c5444}',
    '#ct-zone-browser .ct-zb-seats button{padding:8px 12px;border:1px solid #75858a;',
    'border-radius:9px;background:#233e47;color:#f4e3cb;font:700 12px system-ui}',
    '#ct-zone-browser .ct-zb-seats .active{background:#e2b77d;color:#162932}',
    '#ct-zone-browser .ct-zb-content{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(220px,1fr);',
    'gap:0;flex:1;min-height:0}',
    '#ct-zone-browser .ct-zb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(106px,1fr));',
    'gap:9px;align-content:start;padding:12px;overflow-y:auto;min-width:0}',
    '#ct-zone-browser .ct-zb-card{padding:5px;background:#17343e;border:1px solid #64808a;',
    'border-radius:10px;color:#fff1d7;text-align:left;min-width:0;overflow:hidden}',
    '#ct-zone-browser .ct-zb-card.active{border:2px solid #e5ba7a;background:#2c4348}',
    '#ct-zone-browser .ct-zb-card img{display:block;width:100%;height:122px;object-fit:cover;',
    'object-position:top;background:#102832;border-radius:5px}',
    '#ct-zone-browser .ct-zb-card span{display:block;padding:6px 2px 2px;',
    'font:650 11px/1.2 system-ui;overflow-wrap:anywhere}',
    '#ct-zone-browser .ct-zb-detail{border-left:1px solid #8a775b55;padding:12px;',
    'overflow-y:auto;min-width:0;background:#0f242ccc}',
    '#ct-zone-browser .ct-zb-detail img{display:block;width:auto;max-width:100%;',
    'max-height:43dvh;object-fit:contain;margin:0 auto 9px;border-radius:8px}',
    '#ct-zone-browser .ct-zb-detail h3{margin:4px 0;font:700 19px Georgia,serif;',
    'color:#ffe1a5;overflow-wrap:anywhere}',
    '#ct-zone-browser .ct-zb-detail p{font:13px/1.5 system-ui;white-space:pre-wrap;color:#d2e1dc}',
    '#ct-zone-browser .ct-zb-empty{grid-column:1/-1;padding:24px 12px;',
    'font-size:14px;color:#bacfd1;text-align:center}',
    '@media(orientation:landscape) and (max-height:530px){',
    '#ct-zone-browser .ct-zb-header{padding:6px 12px}',
    '#ct-zone-browser .ct-zb-card img{height:95px}',
    '#ct-zone-browser .ct-zb-detail img{max-height:32dvh}',
    '#ct-zone-browser .ct-zb-grid{grid-template-columns:repeat(auto-fill,minmax(87px,1fr))}}',
    '@media(orientation:portrait){#ct-zone-browser .ct-zb-content{grid-template-columns:1fr 42%}',
    '#ct-zone-browser .ct-zb-card img{height:100px}',
    '#ct-zone-browser .ct-zb-detail{padding:8px}#ct-zone-browser .ct-zb-detail h3{font-size:15px}}'
  ].join('');
  document.head.append(css);
  const backdrop=document.createElement('div');
  backdrop.id='ct-zone-browser';
  backdrop.dataset.open='false';
  backdrop.setAttribute('role','dialog');
  backdrop.setAttribute('aria-modal','true');
  backdrop.setAttribute('aria-label','Public card zone browser');
  document.body.append(backdrop);
  let zone=null,seat=0,chosen=0;
  const element=(tag,text,cls)=>{
    const el=document.createElement(tag);
    if(text!==null && text!==undefined)el.textContent=String(text);
    if(cls)el.className=cls;
    return el;
  };
  function cards(){
    const ps=window.app?.game?.players||[];
    // Retain stable Forge card IDs where available. The old name-only
    // representation stays as a display-only fallback for older snapshots.
    const p=ps[seat]||{};
    const exact=p[zone+'Cards'];
    return Array.isArray(exact)?exact:
      Array.isArray(p[zone])?p[zone]:[];
  }
  const cardName=card=>typeof card==='string'?card:
    String(card?.name||'Unknown card');
  const legalId=card=>{
    const id=Number(card?.id);
    return Number.isInteger(id)&&id>0&&
      !!window.ctForgeSelection?.isLegalCard?.(id)?id:null;
  };
  function art(name){
    try{return window.ctCardArtUrl?.(name)||'';}catch(_){return '';}
  }
  function cardInfo(name){
    return window.ctForgeCards?.[String(name).toLowerCase()]||{};
  }
  function hide(){
    zone=null;backdrop.dataset.open='false';backdrop.replaceChildren();
  }
  function show(zoneName){
    if(!window.app?.nativeMatch||window.app?.view!=='game')return;
    if(zoneName!=='graveyard'&&zoneName!=='exile')return;
    zone=zoneName;seat=0;chosen=0;
    window.ctFloatingZones?.close?.();
    backdrop.dataset.open='true';
    paint();
  }
  function paint(){
    if(!zone)return;
    if(!window.app?.nativeMatch||window.app?.view!=='game'){hide();return;}
    const players=window.app?.game?.players||[];
    if(seat>=players.length)seat=0;
    const owner=players[seat]||{};
    const entries=cards();
    chosen=Math.min(chosen,Math.max(0,entries.length-1));
    const panel=element('section',null,'ct-zb-sheet');
    const header=element('header',null,'ct-zb-header');
    const head=element('div');
    head.append(element('h2',zone==='graveyard'?'Graveyard':'Exile'),
      element('span',entries.length+' card'+(entries.length===1?'':'s')+' · Read-only'));
    const close=element('button','×','ct-zb-close');
    close.type='button';close.setAttribute('aria-label','Close card zone');
    close.onclick=hide;
    header.append(head,close);
    const tabs=element('div',null,'ct-zb-seats');
    players.forEach((p,i)=>{
      const b=element('button',i===0?'Your '+zone:(p.commander||p.name||'Opponent '+i),i===seat?'active':'');
      b.type='button';b.setAttribute('aria-pressed',String(i===seat));
      b.onclick=()=>{seat=i;chosen=0;paint();};
      tabs.append(b);
    });
    const body=element('div',null,'ct-zb-content');
    const grid=element('div',null,'ct-zb-grid');
    if(!entries.length)grid.append(element('p','No cards in this '+zone+' yet.','ct-zb-empty'));
    for(let i=0;i<entries.length;i++){
      const name=cardName(entries[i]);
      const b=element('button',null,'ct-zb-card'+(i===chosen?' active':''));
      b.type='button';
      b.setAttribute('aria-label','Inspect '+name);
      if(legalId(entries[i])!==null)b.classList.add('ct-zb-selectable');
      b.setAttribute('aria-pressed',String(i===chosen));
      const pic=element('img');
      pic.alt='';pic.loading='lazy';pic.src=art(name);
      pic.onerror=()=>{pic.style.display='none';};
      b.append(pic,element('span',name));
      b.onclick=()=>{chosen=i;paint();};
      grid.append(b);
    }
    const detail=element('aside',null,'ct-zb-detail');
    if(entries.length){
      const name=cardName(entries[chosen]),info=cardInfo(name);
      const img=element('img');img.alt=name;img.src=art(name);
      img.onerror=()=>{img.style.display='none';};
      detail.append(img,element('h3',name));
      if(info.type)detail.append(element('p',info.type));
      detail.append(element('p',info.text||'Card text unavailable offline. Forge remains authoritative for card rules.'));
      const id=legalId(entries[chosen]);
      if(id!==null){
        const select=element('button','Select this card with Forge','ct-zb-selectable-action');
        select.type='button';
        select.setAttribute('aria-label','Select '+name+' as a Forge legal choice');
        select.onclick=async()=>{
          select.disabled=true;
          const accepted=await window.ctForgeSelection?.chooseCard?.(id);
          if(accepted)hide();
          else {select.disabled=false;window.ctForgeSelection?.refresh?.();}
        };
        detail.append(select);
      }
    }else detail.append(element('p',seat===0?'Cards you discard, sacrifice, or lose to removal will appear here.':'This opponent has no cards in this zone.'));
    body.append(grid,detail);panel.append(header,tabs,body);
    backdrop.replaceChildren(panel);
  }
  document.addEventListener('click',e=>{
    const trigger=e.target.closest('[data-ct-zone-view]');
    if(!trigger)return;
    if(!window.app?.nativeMatch)return;
    e.preventDefault();e.stopImmediatePropagation();
    show(trigger.dataset.ctZoneView);
  },true);
  backdrop.addEventListener('click',e=>{if(e.target===backdrop)hide();});
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&backdrop.dataset.open==='true'){
      e.preventDefault();e.stopImmediatePropagation();hide();
    }
  },true);
  const previous=window.CommandTableNativeReply;
  window.CommandTableNativeReply=function(payload){
    try{
      const message=typeof payload==='string'?JSON.parse(payload):payload;
      if(message?.type==='game.choice'&&zone)hide();
      if(message?.type==='game.state'&&zone)requestAnimationFrame(paint);
    }catch(_){}
    return typeof previous==='function'?previous(payload):undefined;
  };
  window.ctZoneBrowser={open:show,close:hide,get openZone(){return zone;}};
})();