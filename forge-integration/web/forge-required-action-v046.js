/* Sol Pod v0.46 — structured Forge action router.
 * Required choices live in a dedicated full-screen dialog, NEVER the Game Log.
 * No local card legality: all selectable IDs, approvals and button availability
 * originate from Forge's Selection and updateButtons payloads.
 * Ordinary priority passes and normal attack/block gestures stay on battlefield.
 */
(()=>{
  'use strict';
  if(window.ctForgeRequiredAction)return;
  const css=document.createElement('style');
  css.id='ct-required-forge-action-v046';
  css.textContent=[
    '#ct-required-forge-action{position:fixed;inset:0;z-index:2147483350;',
    'display:none;align-items:center;justify-content:center;',
    'padding:clamp(8px,2vh,20px);background:#020a15ef;',
    'box-sizing:border-box;color:#f9ead4;font-family:system-ui;',
    'pointer-events:auto;backdrop-filter:blur(5px)}',
    '#ct-required-forge-action[data-open="true"]{display:flex;animation:ct-required-reveal .17s ease-out .18s both}',
    '@keyframes ct-required-reveal{from{opacity:0}to{opacity:1}}',
    '#ct-required-forge-action .ct-required-sheet{width:min(94vw,920px);',
    'max-height:94dvh;display:flex;flex-direction:column;gap:10px;',
    'padding:clamp(12px,3vh,25px);box-sizing:border-box;',
    'border:2px solid #dbb47a;border-radius:17px;',
    'background:linear-gradient(140deg,#19333b,#0d1b28);',
    'box-shadow:0 20px 70px #000d;overflow:auto}',
    '#ct-required-forge-action h2{font:800 clamp(23px,4vw,39px) Georgia,serif;',
    'color:#ffe1a2;margin:0}',
    '#ct-required-forge-action .ct-required-intro{font-size:clamp(12px,2.4vh,16px);',
    'color:#e3e8e6;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere}',
    '#ct-required-forge-action .ct-required-count{font:800 12px system-ui;',
    'color:#e5c38b}',
    '#ct-required-forge-action .ct-required-options{display:grid;',
    'grid-template-columns:repeat(auto-fit,minmax(min(205px,100%),1fr));',
    'gap:8px;overflow-y:auto;min-height:0;max-height:37dvh}',
    '#ct-required-forge-action button{min-height:43px;cursor:pointer;',
    'border-radius:9px;border:1px solid #bca87e;padding:9px 11px;',
    'color:#fff0d5;background:#2d4654;font:750 14px system-ui;',
    'text-align:left;touch-action:manipulation}',
    '#ct-required-forge-action button[data-chosen="true"]{',
    'border:2px solid #f2c77b;background:#435d57}',
    '#ct-required-forge-action button:disabled{opacity:.45;cursor:default}',
    '#ct-required-forge-action .ct-required-footer{display:flex;',
    'gap:10px;flex-wrap:wrap}',
    '#ct-required-forge-action .ct-required-footer button{flex:1;',
    'text-align:center}',
    '#ct-required-forge-action .ct-required-primary{',
    'background:#e1b876;color:#102431}',
    '#ct-required-forge-action .ct-required-options.ct-opening-hand-grid{',
    'display:flex;align-items:stretch;overflow-x:auto;overflow-y:hidden;',
    'flex-wrap:nowrap;max-height:none;min-height:0;gap:10px;',
    'padding:4px 3px 11px;scroll-snap-type:x proximity}',
    '#ct-required-forge-action .ct-bottom-card-wrap{',
    'display:flex;flex:0 0 clamp(112px,12vw,170px);max-width:170px;',
    'min-width:0;flex-direction:column;gap:5px}',
    '#ct-required-forge-action .ct-bottom-card-wrap .ct-opening-card{',
    'flex:1 1 auto;width:100%;max-width:100%}',
    '#ct-required-forge-action .ct-bottom-card-wrap button.ct-bottom-preview{',
    'min-height:29px;padding:5px 9px;font:750 11px system-ui;',
    'text-align:center;background:#213b45;border:1px solid #a68e67}',
    '#ct-required-forge-action .ct-opening-card[data-chosen="true"]{',
    'background:#3d5e53;border:3px solid #f6c978;',
    'box-shadow:0 0 13px #f4c27c77}',
    '#ct-required-forge-action .ct-opening-card{',
    'flex:0 0 clamp(112px,12vw,170px);min-width:0;max-width:170px;',
    'display:flex;flex-direction:column;gap:5px;align-items:stretch;',
    'padding:6px;border-radius:11px;text-align:left;',
    'border:1.5px solid #9db4b8;background:#203b45;',
    'scroll-snap-align:start;cursor:zoom-in}',
    '#ct-required-forge-action .ct-opening-card img{',
    'height:clamp(125px,30dvh,205px);width:100%;object-fit:contain;',
    'object-position:center;border-radius:7px;background:#0b1922}',
    '#ct-required-forge-action .ct-opening-card .ct-opening-placeholder{',
    'display:none;height:clamp(125px,30dvh,205px);align-content:center;',
    'text-align:center;background:#172c38;border-radius:7px;color:#cbd8db}',
    '#ct-required-forge-action .ct-opening-name{font:750 12px/1.2 system-ui;',
    'overflow-wrap:anywhere}',
    '#ct-required-forge-action .ct-opening-cost{font:600 11px system-ui;',
    'color:#e6c894}',
    '#ct-required-forge-action .ct-opening-empty{font:700 13px system-ui;',
    'color:#f5ce9b;padding:14px 5px}',
    '#ct-opening-card-viewer{display:none;position:fixed;inset:0;',
    'z-index:2147483470;background:#020915f2;',
    'align-items:center;justify-content:center;padding:clamp(8px,2vh,20px);',
    'box-sizing:border-box;color:#ffefdb;font-family:system-ui}',
    '#ct-opening-card-viewer[data-open="true"]{display:flex}',
    '#ct-opening-card-viewer .ct-opening-detail{width:min(93vw,1000px);',
    'max-height:94dvh;display:grid;grid-template-columns:minmax(155px,36%) 1fr;',
    'gap:clamp(10px,2vw,22px);overflow:auto;padding:clamp(12px,3vh,24px);',
    'box-sizing:border-box;border:2px solid #dbb47a;border-radius:17px;',
    'background:linear-gradient(140deg,#19333b,#0d1b28)}',
    '#ct-opening-card-viewer .ct-opening-detail img{width:100%;',
    'height:min(76dvh,510px);object-fit:contain;object-position:center}',
    '#ct-opening-card-viewer .ct-opening-detail-copy{display:flex;',
    'flex-direction:column;gap:12px;min-width:0;overflow:auto}',
    '#ct-opening-card-viewer h2{font:800 clamp(22px,3vw,34px) Georgia,serif;',
    'color:#ffdda1;margin:0}',
    '#ct-opening-card-viewer .ct-opening-rules{white-space:pre-wrap;',
    'line-height:1.55;overflow-y:auto;flex:1}',
    '#ct-opening-card-viewer button{align-self:flex-start;min-height:40px;',
    'padding:9px 15px;border-radius:9px;border:1px solid #e7c28a;',
    'background:#dfb77d;color:#152a33;font:800 13px system-ui}',
    '@media(orientation:landscape) and (max-height:460px){',
    '#ct-required-forge-action .ct-opening-card{flex-basis:115px}',
    '#ct-required-forge-action .ct-opening-card img,',
    '#ct-required-forge-action .ct-opening-card .ct-opening-placeholder{height:118px}',
    '#ct-required-forge-action .ct-required-options.ct-opening-hand-grid{gap:7px;padding-bottom:4px}',
    '#ct-required-forge-action .ct-opening-card .ct-opening-name{font-size:10px}',
    '#ct-opening-card-viewer .ct-opening-detail img{height:75dvh}',
    '#ct-opening-card-viewer .ct-opening-detail-copy{gap:6px}',
    '}',
    '#ct-required-forge-action .ct-required-status{min-height:17px;',
    'font:700 12px system-ui;color:#ffd7a8}',
    '#ct-forge-required-resume{position:fixed;left:clamp(10px,2vw,22px);',
    'bottom:clamp(9px,3dvh,22px);z-index:2147483270;',
    'display:none;min-height:43px;border:2px solid #dfb478;',
    'border-radius:11px;background:#e4bc7e;color:#13242f;',
    'padding:9px 16px;font:800 13px system-ui;',
    'box-shadow:0 7px 28px #000a}',
    // Forge priority buttons are still in the DOM for their original
    // command handlers; hide their dock only while this modal owns the choice.
    '#ct-forge-priority-buttons.ct-required-modal-source{display:none!important}',
    '@media(orientation:landscape) and (max-height:440px){',
    '#ct-required-forge-action .ct-required-sheet{gap:6px;padding:9px}',
    '#ct-required-forge-action h2{font-size:23px}',
    '#ct-required-forge-action .ct-required-options{max-height:26dvh}',
    '#ct-required-forge-action button{min-height:34px;padding:5px 9px}',
    '#ct-required-forge-action .ct-required-intro{font-size:12px}',
    '}'
  ].join('');
  document.head.append(css);
  const make=(tag,className,text)=>{
    const el=document.createElement(tag);
    if(className)el.className=className;
    if(text!==undefined)el.textContent=String(text);
    return el;
  };
  const backdrop=make('section');
  backdrop.id='ct-required-forge-action';
  backdrop.dataset.open='false';
  backdrop.setAttribute('role','dialog');
  backdrop.setAttribute('aria-modal','true');
  backdrop.setAttribute('aria-label','Sol Pod requires your decision');
  const sheet=make('div','ct-required-sheet');
  const heading=make('h2');
  const intro=make('div','ct-required-intro');
  const count=make('div','ct-required-count');
  const list=make('div','ct-required-options');
  const feedback=make('div','ct-required-status');
  const footer=make('div','ct-required-footer');
  sheet.append(heading,intro,count,list,feedback,footer);
  backdrop.append(sheet);
  document.body.append(backdrop);
  // Opening-hand inspection is read-only. The only mutating choices remain
  // Keep/Mulligan and come directly from Forge's enabled buttons.
  const handViewer=make('section');
  handViewer.id='ct-opening-card-viewer';handViewer.dataset.open='false';
  handViewer.setAttribute('role','dialog');
  handViewer.setAttribute('aria-modal','true');
  handViewer.setAttribute('aria-label','Inspect opening-hand card');
  document.body.append(handViewer);
  const resume=make('button',null,'✦ Continue Sol Pod choice');
  resume.id='ct-forge-required-resume';resume.type='button';
  document.body.append(resume);
  let minimized='',key='',submitting=false,lastExplicit='',notice='';
  let current=null,waitingForForgeKey='';
  let handLoading=false,requestedHandFor='',handViewerCardId='';
  const player=()=>window.app?.game?.players?.[0];
  const phase=()=>String(window.app?.game?.phaseDetail||'').toUpperCase();
  const inCombat=()=>/ATTACKERS|BLOCKERS/.test(phase());
  const forgeChoice=()=>!!window.ctForgeChoice?.hasPending;
  const priority=()=>window.ctForgePriority;
  const selector=()=>window.ctForgeSelection;
  const localHand=()=>{
    const me=player();
    if(!me)return [];
    const raw=Array.isArray(me.handCards)&&me.handCards.length
      ?me.handCards:(Array.isArray(me.hand)?me.hand.map((name,i)=>({
        ...window.ctForgeCards?.[String(name||'').toLowerCase()],
        // The catalog's card ID is a name-derived slug; never replace the
        // distinct Forge object ID (particularly for duplicate basic lands).
        name,id:me.handForgeIds?.[i]
      })):[]);
    return raw.filter(c=>c&&c.name).map((c,i)=>({
      ...c,id:c.id??me.handForgeIds?.[i]??i,name:String(c.name)
    }));
  };
  const isBottoming=d=>d?.kind==='bottoming';
  const isKeepMulligan=d=>d?.kind==='opening' &&
    /\bkeep\b/i.test(String(d.buttons?.label1||'')+' '+String(d.buttons?.label2||'')) &&
    /\bmulligan\b/i.test(String(d.buttons?.label1||'')+' '+String(d.buttons?.label2||''));
  const cardInfo=card=>{
    const meta=window.ctForgeCards?.[String(card.name).toLowerCase()]||{};
    return {name:card.name,id:card.id,
      manaCost:String(card.manaCost||meta.cost||''),
      type:String(card.type||meta.type||''),
      rulesText:String(card.rulesText||meta.text||'')};
  };
  function closeCardViewer(){handViewer.dataset.open='false';handViewerCardId='';handViewer.replaceChildren();}
  function inspectOpeningCard(card){
    if(!card || !(isKeepMulligan(current)||isBottoming(current)))return;
    const info=cardInfo(card);
    handViewerCardId=String(info.id);handViewer.replaceChildren();
    const paper=make('div','ct-opening-detail');
    const art=make('img');art.alt=info.name;
    art.src=window.ctCardArtUrl?.(info.name)||'';
    const copy=make('div','ct-opening-detail-copy');
    const name=make('h2',null,info.name);
    const meta=make('div',null,[info.manaCost,info.type].filter(Boolean).join(' · '));
    const rules=make('div','ct-opening-rules',info.rulesText||'Card text is not available in the current game state.');
    const close=make('button',null,'← Back to opening hand');close.type='button';
    close.onclick=closeCardViewer;
    copy.append(name,meta,rules,close);paper.append(art,copy);
    handViewer.append(paper);handViewer.dataset.open='true';
  }
  async function refreshOpeningHand(){
    if(handLoading||!(isKeepMulligan(current)||isBottoming(current)))return;
    handLoading=true;
    feedback.textContent='Loading your opening hand from Sol Pod…';
    try{
      const result=await window.CommandTableNative?.request?.('game.snapshot');
      if(result?.game)window.ctReceiveForgeState?.(result.game);
      if(!localHand().length)feedback.textContent='Sol Pod has not loaded your hand yet. Try Refresh hand, or review the game state.';
      else feedback.textContent='Your opening hand is ready. Tap any card to inspect it.';
    }catch(error){
      feedback.textContent='Could not load the opening hand: '+(error?.message||String(error));
    }finally{handLoading=false;sync();}
  }
  const modeData=()=>{
    if(!window.app?.nativeMatch||window.app?.view!=='game'||!window.app?.game||
        window.app.game.gameOver || window.app.game.winner!=null ||
        forgeChoice()||window.ctForgeSafety?.recoveryVisible)return null;
    const buttons=priority()?.buttonInfo||{};
    const select=selector()?.selectionInfo||{};
    const cards=Array.isArray(select.cards)?select.cards:[];
    const targets=Array.isArray(select.targets)?select.targets:[];
    const chosen=Array.isArray(select.chosen)?select.chosen:[];
    const min=Number(select.min)||0;
    const enabled=!!buttons.enable1||!!buttons.enable2;
    const messages=[buttons.message,buttons.prompt,selector()?.prompt,lastExplicit]
      .filter(Boolean).map(String);
    const prompt=messages.find(v=>/discard|mulligan|bottom|choose|select|pay mana|approve|confirm|sacrifice|exile|return/i.test(v))
      ||messages[0]||'Sol Pod requires your choice';
    const label1=String(buttons.label1||'OK');
    const label2=String(buttons.label2||'Cancel');
    const mana=/^auto$/i.test(label1.trim()) && /^cancel$/i.test(label2.trim());
    const opening=window.app.game.phase==='mulligan' ||
      /^(?:play|keep|mulligan)$/i.test(label1.trim()) ||
      /^(?:draw|mulligan)$/i.test(label2.trim());
    const usable=cards.filter(c=>!c.actionable);
    const needCards=usable.length>0 && (min>0 ||
      /\b(?:discard|bottom|return|choose|select|sacrifice)\b/i.test(prompt));
    // Forge InputLondonMulligan publishes ONLY Selection.chosen, never the
    // selectable cards. Bottoming must be recognised from its real prompt,
    // and its choices sourced from the owner's Forge-projected hand.
    const bottoming=!!priority()?.isBottoming ||
      (window.app.game.phase==='mulligan' &&
        /\b(?:return|put)\b.*\bbottom\b.*\b(?:library|deck)\b/i.test(prompt));
    const remainingMatch=bottoming ? prompt.match(/\b(?:return|put)\s+(\d+)\s+cards?\b/i) : null;
    const remaining=remainingMatch?Number(remainingMatch[1]):null;
    // Forge supplies choices of stack/board/player targets separately. The
    // already full-screen target UI owns those; never display two overlays.
    if(targets.length>0)return null;
    const unusual=enabled && (
      /^(?:yes|no|approve|decline|accept|reject|keep|mulligan|play|draw)$/i.test(label1.trim()) ||
      /^(?:yes|no|approve|decline|accept|reject|keep|mulligan|play|draw)$/i.test(label2.trim()) ||
      /^\s*(?:choose|select|approve|confirm|pay|discard|pick|return)\b/i.test(prompt)
    );
    // Ordinary priority/phase advancement (OK, Cancel, Pass) and combat
    // declaration must remain on the battlefield.
    if(inCombat()&&!mana&&!needCards&&!opening)return null;
    // Auto-mana is an intentional engine-side action, not a human decision.
    // When Auto is configured and Forge enables it, the payment will complete
    // without showing a modal for a split second. Recovery still handles any
    // request failure.
    if(mana&&window.ctAutoMana!==false&&buttons.enable1&&!needCards)return null;
    // During startup Forge may publish "mulligan" phase before it publishes
    // any enabled decision buttons. That is LOADING, never a blocking sheet
    // with a generic heading and zero actions.
    if(!enabled&&!needCards&&!bottoming)return null;
    if(!opening&&!mana&&!needCards&&!unusual&&!bottoming)return null;
    const keepMulliganButtons=/\bkeep\b/i.test(label1+' '+label2) &&
      /\bmulligan\b/i.test(label1+' '+label2);
    const kind=bottoming?'bottoming':keepMulliganButtons?'opening':needCards?'cards':mana?'mana':opening?'opening':'approval';
    // In an Equipment or Aura target prompt the listed creature itself
    // is the engine-approved selection. Hiding it behind "Use battlefield"
    // was confusing and could leave the player waiting indefinitely.
    const attachment=kind==='cards' &&
      /\b(?:equip(?:ment|ped)?|enchant(?:ed)?|attach(?:ing)?|target creature you control)\b/i.test(prompt);
    const available=needCards?usable:(mana?cards:[]);
    const hand=(kind==='opening'||kind==='bottoming')?localHand():[];
    return {kind,attachment,buttons,items:available,prompt,chosen,min,enabled,hand,
      remaining, required:remaining===null?null:remaining+chosen.length,
      key:JSON.stringify([kind,label1,label2,select.min,select.max,
        available.map(c=>[c.id,c.label,c.actionable]),
        chosen.map(String),prompt,buttons.sequence||0,
        hand.map(c=>[c.id,c.name]),remaining])};
  };
  function show(value,signature){
    backdrop.dataset.open=value?'true':'false';
    resume.style.display=!value&&current&&minimized===signature?'block':'none';
    const dock=document.getElementById('ct-forge-priority-buttons');
    dock?.classList.toggle('ct-required-modal-source',value);
  }
  const button=(label,fn,cls='',enabled=true)=>{
    const el=make('button',cls,label);
    el.type='button';el.disabled=!enabled||submitting||waitingForForgeKey===key;el.onclick=fn;
    footer.append(el);return el;
  };
  async function apply(ok){
    if(submitting||!current||waitingForForgeKey===key ||
       (isKeepMulligan(current)&&!current.hand.length) ||
       (isBottoming(current) && (!current.hand.length ||
         (ok && (current.remaining!==0 || !current.buttons.enable1)) ||
         (!ok && !current.buttons.enable2))))return;
    submitting=true;
    feedback.textContent='Sending your decision to Sol Pod…';
    paint();
    const answered=ok ? priority()?.confirm?.() : priority()?.cancel?.();
    try{
      const success=await answered;
      if(success===false) {
        feedback.textContent='Sol Pod did not accept this decision. Use the recovery dialog.';
        return;
      }
      waitingForForgeKey=key;
      feedback.textContent='Decision sent to Sol Pod. Waiting for the next prompt or game-state update; do not submit it twice.';
      minimized='';lastExplicit='';notice='';
      // Never assume completion or submit the decision twice; wait for
      // Forge's next selection/prompt/state event to close or replace it.
    }catch(error){
      feedback.textContent='Sol Pod did not complete the decision: '+(error?.message||error);
      window.ctForgeSafety?.showError?.(error,'Sol Pod decision unavailable');
    }finally{submitting=false;sync();}
  }
  async function chooseCard(item,signature){
    if(submitting||!current||signature!==key)return;
    if(!selector()?.isLegalCard?.(item.id)){
      feedback.textContent='This card is no longer legal. Review the new Sol Pod choice.';return;
    }
    submitting=true;paint();feedback.textContent='Selecting '+String(item.label||'card')+' in Sol Pod…';
    try{
      const success=await selector()?.chooseCard?.(item.id);
      if(success===false)
        feedback.textContent='Sol Pod did not accept that selection. Refresh the current decision.';
      else feedback.textContent='Selection received by Sol Pod.';
    }catch(error){
      feedback.textContent='Selection unavailable: '+(error?.message||error);
      window.ctForgeSafety?.showError?.(error,'Sol Pod selection unavailable');
    }finally{submitting=false;sync();}
  }
  async function chooseBottomCard(card){
    if(submitting||!isBottoming(current)||!card)return;
    if(!current.hand.some(c=>String(c.id)===String(card.id)))return;
    submitting=true;
    feedback.textContent='Updating selected cards in Sol Pod…';
    paint();
    try{
      await window.CommandTableNative.request('game.command',{
        action:'mulligan.bottom.select',value:Number(card.id)
      });
      feedback.textContent='Sol Pod updated your selection. Choose the required number, then confirm.';
    }catch(error){
      feedback.textContent='Sol Pod could not select that card: '+(error?.message||String(error));
      window.ctForgeSafety?.showError?.(error,'Could not choose a card to bottom');
    }finally{submitting=false;sync();}
  }
  function paint(){
    if(!current)return;
    const d=current;
    heading.textContent=isBottoming(d)?'Choose cards to put on the bottom':
      d.kind==='mana'?'Pay mana':d.kind==='opening'?'Opening decision':
      d.attachment?'Choose attachment target':
      d.kind==='cards'?'Choose cards':'Decision required';
    intro.textContent=d.kind==='mana'?
      'Sol Pod is waiting for mana payment. Use Auto only when Sol Pod enables it, or choose a legal mana source below.':
      d.attachment
        ?'Tap the creature you want to attach to. Sol Pod shows engine-approved targets.\n'+String(d.prompt)
        :String(d.prompt);
    const chosen=new Set(d.chosen.map(String));
    const bottoming=isBottoming(d);
    const showingHand=isKeepMulligan(d)||bottoming;
    count.textContent=bottoming
      ?('BOTTOM OF LIBRARY · '+chosen.size+' selected'+
        (d.required===null?'':' of '+d.required)+' · '+
        (d.remaining===null?'Waiting for Sol Pod selection count':d.remaining+' still to select'))
      :showingHand
      ?('YOUR OPENING HAND · '+d.hand.length+' card'+(d.hand.length===1?'':'s')+' · Tap a card to read it')
      :d.kind==='cards'?(d.min?d.min+' required · ':'')+chosen.size+' selected'
      :d.items.length?d.items.length+' legal options':'';
    list.replaceChildren();
    list.classList.toggle('ct-opening-hand-grid',showingHand);
    if(showingHand){
      if(!d.hand.length){
        list.append(make('div','ct-opening-empty','Loading the opening hand from Sol Pod. Keep and Mulligan are disabled until you can inspect your cards.'));
      }else for(const raw of d.hand){
        const card=cardInfo(raw);
        const isChosen=chosen.has(String(card.id));
        const group=bottoming?make('div','ct-bottom-card-wrap'):null;
        const tile=make('button','ct-opening-card');tile.type='button';
        tile.dataset.chosen=String(isChosen);
        tile.setAttribute('aria-pressed',String(isChosen));
        tile.setAttribute('aria-label',bottoming
          ?(isChosen?'Remove ':'Select ')+card.name+' for bottom of library'
          :'Inspect '+card.name+' in opening hand');
        const art=make('img');art.alt=card.name;
        const placeholder=make('span','ct-opening-placeholder','Artwork unavailable');
        art.src=window.ctCardArtUrl?.(card.name)||'';
        art.onerror=()=>{art.style.display='none';placeholder.style.display='block';};
        if(!art.src){art.style.display='none';placeholder.style.display='block';}
        const index=d.chosen.map(String).indexOf(String(card.id));
        const title=make('span','ct-opening-name',
          (bottoming && isChosen?'✓ '+(index+1)+'. ':'')+card.name);
        const cost=make('span','ct-opening-cost',card.manaCost||card.type||'');
        tile.append(art,placeholder,title,cost);
        tile.disabled=submitting;
        tile.onclick=bottoming?()=>{void chooseBottomCard(raw);}:()=>inspectOpeningCard(raw);
        if(group){
          const inspect=make('button','ct-bottom-preview','Read card');
          inspect.type='button';inspect.onclick=()=>inspectOpeningCard(raw);
          group.append(tile,inspect);list.append(group);
        }else list.append(tile);
      }
    }
    const signature=d.key;
    for(const item of (showingHand?[]:d.items)){
      const opt=make('button');
      opt.type='button';
      const label=String(item.label||('Card #'+item.id));
      opt.textContent=(chosen.has(String(item.id))?'✓ ':'')+
        (d.attachment?'Attach to ':'')+label+
        (item.zone?' · '+item.zone:'');
      opt.dataset.chosen=String(chosen.has(String(item.id)));
      opt.disabled=submitting||waitingForForgeKey===key||
        (!!window.ctForgeSafety?.needsRecovery && !selector()?.isRequiredSelection?.(item));
      opt.onclick=()=>{void chooseCard(item,signature);};
      list.append(opt);
    }
    feedback.textContent=feedback.textContent||(bottoming
      ?d.hand.length?'Tap the cards YOU want to bottom. Tap again to undo a selection.':'Waiting for Sol Pod to provide the hand…'
      :showingHand
      ?d.hand.length?'Inspect your cards, then choose Keep or Mulligan.':'Waiting for Sol Pod to provide your hand…'
      :d.attachment?'Tap a listed creature to attach this card. The choice is submitted directly to Sol Pod.'
      :'Select an option to continue.');
    footer.replaceChildren();
    const handReady=!showingHand||d.hand.length>0;
    if(bottoming){
      // Forge only enables OK after exactly N cards have been chosen.
      // Never replace that engine legality with a locally guessed threshold.
      button('Confirm selected cards',()=>{void apply(true);},
        'ct-required-primary',handReady && d.remaining===0 && !!d.buttons.enable1);
      if(d.buttons.enable2 && /\bauto\b/i.test(String(d.buttons.label2||''))){
        button('Let Sol Pod choose instead',()=>{void apply(false);},'',handReady);
      }
    }else{
      if(d.buttons.enable1)button(String(d.buttons.label1||'Confirm'),()=>{void apply(true);},
        'ct-required-primary',handReady);
      if(d.buttons.enable2)button(String(d.buttons.label2||'Cancel'),()=>{void apply(false);},
        '',handReady);
    }
    if(showingHand&&!d.hand.length){
      const retry=make('button',null,handLoading?'Loading hand…':'↻ Refresh hand');
      retry.disabled=handLoading;
      retry.onclick=()=>{void refreshOpeningHand();};
      footer.append(retry);
    }
    // A mana cost might require manually tapping battlefield mana sources if
    // Forge's Auto control cannot pay; do not trap the player behind a modal.
    if(waitingForForgeKey===key){
      const check=make('button',null,'↻ Check Sol Pod status');
      check.onclick=()=>{void window.ctForgeSafety?.recover?.();};
      footer.append(check);
    }
    if(d.kind==='mana'||(d.kind==='cards'&&!d.attachment))button('Use battlefield',()=>{
      minimized=key;show(false,key);feedback.textContent='';
    });
    if(!bottoming && !d.enabled && !d.items.length)
      feedback.textContent='Sol Pod has not enabled a response yet. Check available mana or refresh Sol Pod status.';
  }
  function sync(){
    const d=modeData();
    if(!d){
      current=null;key='';minimized='';lastExplicit='';waitingForForgeKey='';
      show(false,'');closeCardViewer();
      const game=window.app?.game;
      const loadingOpening=window.app?.nativeMatch && window.app?.view==='game' &&
        game?.phase==='mulligan' && game?.winner==null && !game?.gameOver &&
        !forgeChoice() && !window.ctForgeSafety?.recoveryVisible &&
        !window.ctForgePriority?.hasActionableDecision;
      if(loadingOpening)window.ctMatchLoading?.waitForOpening?.();
      return;
    }
    if(d.key!==key){
      key=d.key;minimized='';waitingForForgeKey='';feedback.textContent='';
      closeCardViewer();
    }
    current=d;
    // Never let a stale loader block the now-actionable Forge decision.
    if(window.ctMatchLoading?.awaitingOpening)
      window.ctMatchLoading.hide();
    const opened=minimized!==key;
    show(opened,key);
    if(opened)paint();
    // Pregame prompt events can arrive before GameView has projected the hand.
    // Snapshot is read-only; never guess or synthesize cards for the player.
    if((isKeepMulligan(d)||isBottoming(d))&&!d.hand.length&&requestedHandFor!==key){
      requestedHandFor=key;
      Promise.resolve().then(()=>{void refreshOpeningHand();});
    }
  }
  resume.onclick=()=>{minimized='';if(current){show(true,key);paint();}};
  backdrop.addEventListener('click',event=>{
    // Required Forge actions cannot be silently dismissed by backdrop taps.
    if(event.target===backdrop)event.stopPropagation();
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape' && handViewer.dataset.open==='true'){
      event.preventDefault();event.stopImmediatePropagation();closeCardViewer();return;
    }
    if(event.key==='Escape' && backdrop.dataset.open==='true'){
      event.preventDefault();event.stopImmediatePropagation();
    }
  },true);
  window.addEventListener('ct-forge-selection',sync);
  window.addEventListener('ct-forge-prompt-updated',sync);
  const previous=window.CommandTableNativeReply;
  window.CommandTableNativeReply=function(payload){
    let parsed;
    try{parsed=typeof payload==='string'?JSON.parse(payload):payload;}catch(_){}
    const result=typeof previous==='function'?previous(payload):undefined;
    if(parsed?.type==='game.state'||parsed?.type==='game.choice'||parsed?.type==='game.choice.clear')sync();
    return result;
  };
  window.ctForgeRequiredAction={
    refresh:sync,
    get visible(){return backdrop.dataset.open==='true';},
    get required(){return !!current;},
    get kind(){return current?.kind||null;},
    onNotice(message){
      // Never invent a choice from plain prose. Structured Forge selection
      // and button state supply the actual legal actions.
      const raw=String(message||'');
      if(!/^\s*(?:please\s+)?(?:choose|select|approve|confirm|discard|sacrifice|pay|tap|assign|cancel\s+pending|refresh\s+forge)\b/i.test(raw))
        return false;
      // Do not cover an already-visible Forge choice/target modal with a
      // second generic recovery sheet simply because notice text is imperative.
      if(forgeChoice() || window.ctFullscreenTargets?.visible ||
         (selector()?.legalTargets||[]).length>0)return true;
      lastExplicit=raw;
      sync();
      if(!current)window.ctForgeSafety?.showError?.(
        new Error(raw),'Sol Pod requires an action, but no legal choices are available yet');
      return true;
    }
  };
  sync();
})();