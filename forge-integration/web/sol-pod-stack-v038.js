/* Sol Pod v0.38: independent stack surface and full-screen Forge stack reader.
 * The UI never invents targets, costs, priority or resolution outcomes.
 * Every visible active item comes directly from the Forge GameView snapshot.
 */
(() => {
  'use strict';
  if (document.getElementById('sol-pod-stack')) return;
  const style=document.createElement('style');
  style.id='sol-pod-stack-v038';
  style.textContent=[
    'body:has(.sol-battlefield) #sol-pod-hub{top:21%!important;right:1%!important;width:22%!important;',
    'max-height:18dvh!important;min-height:0!important;z-index:220080!important}',
    'body:has(.sol-battlefield) #sol-pod-hub-content{max-height:14dvh!important;overflow-y:auto!important}',
    'body:has(.sol-battlefield) #sol-pod-hub #sol-pod-notices{max-height:12dvh!important}',
    'body:has(.sol-battlefield) #sol-pod-hub #ct-forge-legal-actions{max-height:13dvh!important}',
    'body:has(.sol-battlefield) .ct-native-stack{display:none!important}',
    'body:has(.sol-battlefield) #ct-forge-priority-buttons:not(.ct-forge-pregame){',
    'bottom:2%!important;max-height:27dvh!important;overflow:auto!important}',
    '#sol-pod-stack{position:fixed;top:41%;right:1%;width:22%;height:29dvh;max-height:29dvh;',
    'box-sizing:border-box;z-index:220090;display:none;flex-direction:column;overflow:hidden;',
    'background:linear-gradient(170deg,#112b37fa,#0c1d2ef9);border:1.5px solid #caaa75;',
    'border-radius:12px;box-shadow:0 7px 23px #000b;color:#fbead2;font-family:system-ui;',
    'pointer-events:auto}',
    'body:has(.sol-battlefield) #sol-pod-stack{display:flex}',
    'body:has(.sol-battlefield.sol-roster-expanded) #sol-pod-stack{visibility:hidden;pointer-events:none}',
    '#sol-pod-stack-head{display:flex;flex:none;align-items:center;justify-content:space-between;',
    'gap:5px;padding:6px 8px;background:#1b3544;border-bottom:1px solid #d6b87970}',
    '#sol-pod-stack-head strong{font:800 clamp(10px,.92vw,14px) Georgia,serif;letter-spacing:.06em;',
    'color:#ffe5b4;white-space:nowrap}',
    '#sol-pod-stack-count{font:750 10px system-ui;color:#cde1e2;flex:1;text-align:right}',
    '#sol-pod-stack-expand{border:1px solid #c6a873;background:#294554;color:#fff0d5;',
    'font:750 10px system-ui;border-radius:7px;padding:4px 6px;min-height:28px;cursor:pointer}',
    '#sol-pod-stack-cards{display:flex;flex-direction:column;gap:5px;min-height:0;overflow-y:auto;',
    'overscroll-behavior:contain;padding:6px;scrollbar-width:thin}',
    '.sol-stack-tile{display:grid;grid-template-columns:clamp(34px,4vw,48px) minmax(0,1fr);',
    'gap:7px;align-items:center;width:100%;text-align:left;padding:5px;',
    'border:1px solid #597889;border-radius:9px;background:#1c3746;color:#fdf0dd;',
    'cursor:pointer;min-height:57px}',
    '.sol-stack-tile[data-top="true"]{border:2px solid #e6bb74;background:#284753;',
    'box-shadow:inset 0 0 0 1px #e6b96c33}',
    '.sol-stack-tile img{display:block;width:100%;height:53px;object-fit:cover;',
    'object-position:top;border-radius:5px;border:1px solid #bb9e6a;background:#1e2d38}',
    '.sol-stack-mini-fallback{display:grid;place-items:center;width:100%;height:53px;',
    'background:#314b57;border-radius:5px;color:#f6daa5;font-size:19px}',
    '.sol-stack-tile span{display:block;min-width:0}',
    '.sol-stack-tile b{display:block;font:750 11px/1.18 system-ui;overflow-wrap:anywhere}',
    '.sol-stack-tile small{display:block;font:650 10px/1.2 system-ui;color:#c8dbdd;',
    'margin-top:4px;overflow-wrap:anywhere}',
    '#sol-pod-stack[data-empty="true"]{height:clamp(58px,10dvh,86px);max-height:10dvh}',
    '#sol-pod-stack-empty{padding:12px 9px;color:#b5c9d0;font:650 11px/1.4 system-ui}',
    '#sol-pod-stack-reader{position:fixed;inset:0;display:none;align-items:center;justify-content:center;',
    'box-sizing:border-box;padding:clamp(5px,1.2vw,15px);background:#020812f5;',
    'z-index:2147483160;pointer-events:auto;color:#fbead2;font-family:system-ui}',
    '#sol-pod-stack-reader[data-open="true"]{display:flex}',
    '#sol-pod-stack-sheet{width:min(98vw,1200px);height:min(96dvh,850px);max-height:96dvh;',
    'box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;',
    'border:2px solid #dfb975;border-radius:14px;background:#101e2bf9;box-shadow:0 16px 42px #000e}',
    '#sol-pod-stack-reader-head{display:flex;align-items:center;gap:10px;padding:8px 12px;',
    'background:#1c3240;border-bottom:1px solid #e1b77780;flex:none}',
    '#sol-pod-stack-reader-head h2{font:800 clamp(14px,1.5vw,20px) Georgia,serif;',
    'margin:0;flex:1;color:#ffe3a8}',
    '#sol-pod-stack-reader-head button{border:1px solid #cfb37b;border-radius:8px;',
    'background:#344753;color:#fff1da;padding:7px 12px;min-height:37px;font:750 13px system-ui}',
    '#sol-pod-stack-reader-body{display:grid;grid-template-columns:minmax(130px,23%) minmax(140px,29%) minmax(0,1fr);',
    'gap:11px;padding:10px;overflow:hidden;flex:1;min-height:0}',
    '#sol-pod-stack-timeline{overflow-y:auto;scrollbar-width:thin;display:flex;flex-direction:column;',
    'gap:6px;padding:2px 4px 2px 0}',
    '.sol-stack-history-head{color:#e0bd7d;font:800 11px system-ui;margin:8px 0 2px}',
    '.sol-stack-history-entry{font:650 10px/1.3 system-ui;color:#c5d4d7;padding:5px 3px;',
    'border-bottom:1px solid #647b7655;overflow-wrap:anywhere}',
    '.sol-stack-history-entry span{color:#e6c992;font-size:9px}',
    '.sol-stack-timeline-choice{font:700 11px/1.2 system-ui;padding:7px;',
    'border-radius:8px;border:1px solid #5f7b83;background:#263d4b;color:#fff1da;',
    'text-align:left;cursor:pointer}',
    '.sol-stack-timeline-choice[data-selected="true"]{border:2px solid #edc47e;background:#3a5360}',
    '.sol-stack-timeline-choice small{display:block;color:#c5dce0;font-size:10px;margin-top:3px}',
    '#sol-pod-stack-card-panel{display:flex;align-items:center;justify-content:center;min-height:0;',
    'border:1px solid #607b7c;border-radius:9px;background:#172a35;overflow:hidden;padding:5px}',
    '#sol-pod-stack-big-art{max-width:100%;max-height:100%;width:auto;height:auto;',
    'object-fit:contain;border-radius:8px}',
    '#sol-pod-stack-big-fallback{display:grid;place-items:center;padding:24px;',
    'text-align:center;color:#dbc89e;font:750 16px/1.4 Georgia,serif}',
    '#sol-pod-stack-detail{overflow-y:auto;scrollbar-width:thin;padding:5px 6px}',
    '#sol-pod-stack-detail h3{margin:0 0 8px;font:800 clamp(18px,2vw,28px)/1.15 Georgia,serif;',
    'color:#ffe3ad;overflow-wrap:anywhere}',
    '.sol-stack-detail-meta{font:700 12px/1.5 system-ui;color:#c6dfe0;margin:4px 0}',
    '.sol-stack-section{margin:11px 0;border-top:1px solid #607b765a;padding-top:10px}',
    '.sol-stack-section h4{font:800 12px system-ui;color:#e6c585;margin:0 0 6px}',
    '.sol-stack-section p{font:13px/1.45 system-ui;margin:4px 0;white-space:pre-wrap;overflow-wrap:anywhere}',
    '#sol-pod-stack-reader-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:12px}',
    '#sol-pod-stack-reader-actions button{min-height:43px;border-radius:9px;border:1px solid #d4b57a;',
    'background:#365560;color:#fff2dc;font:750 13px system-ui;padding:8px 11px;cursor:pointer}',
    '#sol-pod-stack-reader-actions button.primary{background:#e2bb79;color:#102831}',
    '#sol-pod-stack-reader-actions button:disabled{opacity:.42;cursor:not-allowed}',
    '#sol-pod-stack-reader button:focus-visible,#sol-pod-stack button:focus-visible{outline:3px solid #fff0bb}',
    '@media(orientation:landscape) and (max-height:450px){',
    'body:has(.sol-battlefield) #sol-pod-hub{top:20%!important;max-height:18dvh!important}',
    '#sol-pod-stack{top:40%!important;height:28dvh!important;max-height:28dvh!important}',
    '#sol-pod-stack-reader-body{grid-template-columns:21% 26% minmax(0,1fr);gap:7px;padding:6px}',
    '#sol-pod-stack-reader-head{padding:3px 10px}',
    '#sol-pod-stack-detail h3{font-size:17px}',
    '#sol-pod-stack-reader-actions{margin-top:6px}',
    '#sol-pod-stack-reader-actions button{min-height:35px;font-size:11px}',
    '.sol-stack-section{margin:6px 0;padding-top:5px}',
    '.sol-stack-section p{font-size:11px}',
    '}',
    '@media(orientation:portrait){#sol-pod-stack{top:42%;height:27dvh;max-height:27dvh}',
    '#sol-pod-stack-reader-body{grid-template-columns:29% minmax(0,1fr);gap:6px}',
    '#sol-pod-stack-card-panel{display:none}',
    '#sol-pod-stack-detail h3{font-size:18px}}'
  ].join('');
  document.head.append(style);

  function create(tag,text,className) {
    const el=document.createElement(tag);
    if(text!==undefined&&text!==null)el.textContent=String(text);
    if(className)el.className=className;
    return el;
  }
  function button(text,callback,className) {
    const b=create('button',text,className);
    b.type='button';b.onclick=callback;
    return b;
  }
  const rail=create('section');rail.id='sol-pod-stack';
  rail.setAttribute('role','region');rail.setAttribute('aria-label','Stack — spells and abilities awaiting resolution');
  const head=create('div');head.id='sol-pod-stack-head';
  const heading=create('strong','⚡ STACK');
  const count=create('span','',null);count.id='sol-pod-stack-count';
  const expand=button('⤢ Read',()=>open(),null);expand.id='sol-pod-stack-expand';
  head.append(heading,count,expand);
  const cards=create('div');cards.id='sol-pod-stack-cards';
  rail.append(head,cards);document.body.append(rail);

  const overlay=create('div');overlay.id='sol-pod-stack-reader';
  overlay.dataset.open='false';
  overlay.setAttribute('role','dialog');
  overlay.setAttribute('aria-modal','true');
  overlay.setAttribute('aria-label','Full-screen Sol Pod stack reader');
  const sheet=create('div');sheet.id='sol-pod-stack-sheet';
  const modalHead=create('header');modalHead.id='sol-pod-stack-reader-head';
  const modalTitle=create('h2','⚡ STACK · READ & RESPOND');
  const closeButton=button('✕ Close',()=>close());
  closeButton.setAttribute('aria-label','Close stack reader');
  modalHead.append(modalTitle,closeButton);
  const body=create('div');body.id='sol-pod-stack-reader-body';
  const timeline=create('nav');timeline.id='sol-pod-stack-timeline';
  timeline.setAttribute('aria-label','Active stack and observed stack events');
  const artPanel=create('div');artPanel.id='sol-pod-stack-card-panel';
  const detail=create('section');detail.id='sol-pod-stack-detail';
  body.append(timeline,artPanel,detail);sheet.append(modalHead,body);
  overlay.append(sheet);document.body.append(overlay);

  let openId=null;
  let lastFocus=null;
  let current=[];
  let seen=new Map();
  let recent=[];
  let lastTurn=null;
  let pendingRender=false;
  let lastGamePresent=false;

  const game=()=>window.app?.nativeMatch&&window.app?.view==='game'?window.app?.game:null;
  const active=()=>Array.isArray(game()?.stack)?game().stack:[];
  const key=item=>String(item?.id??item?.uid??'');
  function title(item) {
    return String(item?.cardName||item?.name||'Spell or ability');
  }
  function kind(item){
    return item?.trigger?'Triggered ability':item?.ability?'Activated ability':'Spell';
  }
  function readable(item){
    return String(item?.description||item?.name||'No description reported by Sol Pod.');
  }
  function sources(){
    return window.ctForgeCards||{};
  }
  function metadata(item){
    const entry=sources()[title(item).toLowerCase()]||{};
    return {
      type:String(item?.type||entry.type||kind(item)),
      cost:String(item?.manaCost||entry.cost||''),
      rules:String(item?.rulesText||entry.text||'')
    };
  }
  function artUrl(item){
    if(item?.faceDown||!item?.cardName||title(item)==='Face-down card')return '';
    try {return String(window.ctCardArtUrl?.(title(item))||'');}catch(_){return '';}
  }
  function addArt(container,item,large){
    const url=artUrl(item);
    if(!url){
      container.append(create('div',large?title(item):'✦',large?
        'sol-stack-big-fallback':'sol-stack-mini-fallback'));
      return;
    }
    const img=create('img');
    img.src=url;
    img.alt=title(item)+' card art';
    img.loading='lazy';
    img.setAttribute('data-art-name',title(item));
    if(large)img.id='sol-pod-stack-big-art';
    img.onerror=()=>{
      img.remove();
      container.append(create('div',large?title(item):'✦',large?
        'sol-stack-big-fallback':'sol-stack-mini-fallback'));
    };
    container.append(img);
  }
  function itemById(id){return active().find(item=>key(item)===String(id));}
  function label(item){
    const caster=String(item?.controllerName||'');
    return kind(item)+(caster?' · '+caster:'');
  }
  function targetNames(item){
    return (Array.isArray(item?.targets)?item.targets:[]).map(target=>
      String(target?.name||target?.kind||'Target'));
  }
  function recordChanges(items,gameState){
    const next=new Map(items.map(item=>[key(item),item]));
    const turn=Number(gameState?.turn||0);
    if(lastTurn!==null && turn<=1 && lastTurn>1){seen.clear();recent=[];}
    if(!lastGamePresent && gameState){seen.clear();recent=[];}
    const phase=String(gameState?.phaseDetail||gameState?.phase||'');
    const append=(status,item)=>recent.unshift({
      status,name:title(item),kind:kind(item),turn,phase,controller:item?.controllerName||''
    });
    for(const [id,item] of next)if(!seen.has(id))append('Added to stack',item);
    for(const [id,item] of seen)if(!next.has(id))append('Left stack',item);
    recent=recent.slice(0,32);
    seen=next;lastTurn=turn;lastGamePresent=!!gameState;
  }
  function canRespond(){
    const g=game(),me=g?.players?.[0];
    return !!g?.stack?.length && !!me?.priority &&
      !window.ctForgeChoice?.hasPending &&
      !window.ctForgePriority?.isHandChoice &&
      !window.ctForgePriority?.isManaPayment &&
      !window.ctForgeSafety?.needsRecovery &&
      !window.app?.modal;
  }
  function close(){
    if(overlay.dataset.open!=='true')return;
    overlay.dataset.open='false';
    openId=null;
    lastFocus?.focus?.();
    lastFocus=null;
  }
  function open(id){
    if(!active().length||!game())return;
    const choice=document.getElementById('ct-forge-decision-sheet');
    if(choice?.style?.display==='flex' || window.ctForgeChoice?.hasPending)return;
    if(window.app?.modal)return;
    lastFocus=document.activeElement;
    openId=itemById(id)?String(id):key(active()[active().length-1]);
    overlay.dataset.open='true';
    paintModal();
    closeButton.focus?.();
  }
  function respond(){
    if(!canRespond())return;
    close();
    if((window.app?.game?.players?.[0]?.hand||[]).length){
      window.app.handZoom=true;
      window.render?.();
      window.solPodNotice?.('Choose an available instant, flash spell or activated ability. Sol Pod checks legality.','info','stack-respond');
    }else{
      window.solPodNotice?.('You have priority. Inspect a permanent to activate an available ability, or use Pass priority.','info','stack-respond');
    }
  }
  // Viewing the stack must never implicitly resolve or advance an ability.
  // Return to Forge's own priority dock for any confirmation / pass decision.
  function returnToPriority(){
    close();
    const dock=document.getElementById('ct-forge-priority-buttons');
    dock?.querySelector?.('button:not([disabled])')?.focus?.();
  }
  async function targetStack(id){
    const item=itemById(id);
    if(!item || !window.ctForgeSelection?.isLegalStack?.(Number(id)))return;
    close();
    // Legality remains controlled by the current Forge Selection model.
    await window.ctForgeSelection.chooseStack(Number(id));
  }
  function paintModal(){
    if(overlay.dataset.open!=='true')return;
    const mandatory=document.getElementById('ct-forge-decision-sheet');
    if(mandatory?.style?.display==='flex' || window.ctForgeChoice?.hasPending ||
      window.app?.modal){close();return;}
    const items=active();
    const item=itemById(openId);
    if(!item || !items.length){close();return;}
    const isTop=key(items[items.length-1])===key(item);
    const meta=metadata(item);
    timeline.replaceChildren();artPanel.replaceChildren();detail.replaceChildren();
    const heading=create('h3','Active stack · '+items.length);
    heading.className='sol-stack-history-head';
    timeline.append(heading);
    [...items].reverse().forEach((entry,i)=>{
      const selected=key(entry)===key(item);
      const b=button((i===0?'NEXT · ':'')+title(entry),()=>{
        openId=key(entry);paintModal();
      },'sol-stack-timeline-choice');
      b.dataset.selected=String(selected);
      b.append(create('small',label(entry)));
      timeline.append(b);
    });
    const historyTitle=create('h4','Observed stack changes','sol-stack-history-head');
    timeline.append(historyTitle);
    for(const event of recent.slice(0,16)){
      const label=create('div',event.status+' · '+event.name,'sol-stack-history-entry');
      label.append(create('span','Turn '+event.turn+
        (event.phase?' · '+event.phase:'')+(event.controller?' · '+event.controller:'')));
      timeline.append(label);
    }
    addArt(artPanel,item,true);
    detail.append(create('h3',title(item)));
    detail.append(create('p',(isTop?'RESOLVES NEXT · ':'')+kind(item),'sol-stack-detail-meta'));
    detail.append(create('p',item.controllerName?'Controlled by '+item.controllerName:
      'Controller not available','sol-stack-detail-meta'));
    if(meta.type)detail.append(create('p',meta.type,'sol-stack-detail-meta'));
    if(meta.cost)detail.append(create('p','Mana cost · '+meta.cost,'sol-stack-detail-meta'));
    const description=create('div',null,'sol-stack-section');
    description.append(create('h4','ON THE STACK'));
    description.append(create('p',readable(item)));
    detail.append(description);
    if(meta.rules){
      const ruleSection=create('div',null,'sol-stack-section');
      ruleSection.append(create('h4','CARD RULES TEXT'),create('p',meta.rules));
      detail.append(ruleSection);
    }
    const targets=targetNames(item);
    if(targets.length){
      const targetSection=create('div',null,'sol-stack-section');
      targetSection.append(create('h4','FORGE TARGETS'),create('p',targets.join(' · ')));
      detail.append(targetSection);
    }
    const note=create('div',null,'sol-stack-section');
    note.append(create('p','Top item resolves first after all players pass priority. This is a read-only view of Sol Pod; inspecting a spell does not cast it.'));
    detail.append(note);
    const actions=create('div');actions.id='sol-pod-stack-reader-actions';
    const response=button('Respond',respond,'primary');
    response.disabled=!canRespond();
    response.setAttribute('aria-label','Close stack reader and choose a legal response');
    actions.append(response);
    const select=button('Target this spell',()=>{void targetStack(key(item));});
    const legal=!!window.ctForgeSelection?.isLegalStack?.(Number(key(item)));
    select.disabled=!legal||!!window.ctForgeSafety?.needsRecovery;
    select.hidden=!legal;
    actions.append(select);
    actions.append(button('Priority controls',returnToPriority));
    actions.append(button('Back to battlefield',close));
    detail.append(actions);
  }
  function paintRail(){
    const items=active();
    count.textContent=items.length+' active';
    rail.dataset.empty=String(!items.length);
    cards.replaceChildren();
    expand.disabled=!items.length;
    if(!items.length){
      cards.append(create('div','No spells or abilities on the stack.','sol-pod-stack-empty'));
      return;
    }
    [...items].reverse().forEach((item,i)=>{
      const tile=button(null,()=>open(key(item)),'sol-stack-tile');
      tile.dataset.top=String(i===0);
      addArt(tile,item,false);
      const copy=create('span');
      copy.append(create('b',title(item)));
      copy.append(create('small',(i===0?'NEXT · ':'')+label(item)));
      tile.append(copy);cards.append(tile);
    });
  }
  function sync(){
    if(pendingRender)return;
    pendingRender=true;
    requestAnimationFrame(()=>{
      pendingRender=false;
      const g=game();
      if(!g){
        if(lastGamePresent){seen.clear();recent=[];lastTurn=null;}
        lastGamePresent=false;current=[];close();paintRail();return;
      }
      const items=active();
      recordChanges(items,g);
      current=items;
      paintRail();
      paintModal();
    });
  }
  overlay.addEventListener('click',event=>{if(event.target===overlay)close();});
  document.addEventListener('keydown',event=>{
    if(overlay.dataset.open!=='true')return;
    if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();}
  },true);
  const root=document.getElementById('app');
  if(root)new MutationObserver(sync).observe(root,{childList:true,subtree:false});
  window.CommandTableNative?.onState?.(sync);
  window.addEventListener('ct-forge-selection',sync);
  window.addEventListener('ct-combat-queue-updated',sync);
  window.solPodStack={refresh:sync,open,close,get visible(){return overlay.dataset.open==='true';}};
  sync();
})();