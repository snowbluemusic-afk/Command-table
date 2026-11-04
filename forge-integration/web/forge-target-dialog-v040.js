/* Sol Pod v0.40: full-screen, Forge-authoritative targeting.
 * Targets come ONLY from Selection.targets, never from battlefield guesses.
 * This is distinct from Selection.cards (ordinary playable-card highlights).
 */
(() => {
  'use strict';
  if(document.getElementById('ct-fullscreen-targets'))return;
  const css=document.createElement('style');css.id='ct-fullscreen-target-layout';
  css.textContent=[
    '#ct-fullscreen-targets{position:fixed;inset:0;z-index:2147483100;',
    'display:none;align-items:center;justify-content:center;',
    'padding:clamp(6px,1.5vw,16px);box-sizing:border-box;',
    'background:#020710ed;color:#f7e9d1;font-family:system-ui;',
    'pointer-events:auto}',
    '#ct-fullscreen-targets[data-open="true"]{display:flex}',
    '#ct-fullscreen-targets>div{width:min(96vw,1140px);height:min(93dvh,730px);',
    'max-height:93dvh;display:flex;flex-direction:column;min-height:0;',
    'border:2px solid #ddb77b;border-radius:16px;overflow:hidden;',
    'background:linear-gradient(140deg,#192e37,#0b1d2a);',
    'box-shadow:0 12px 46px #000d}',
    '#ct-fullscreen-targets header{display:flex;gap:10px;align-items:center;',
    'padding:clamp(9px,1.6vh,16px);border-bottom:1px solid #c8aa7266;flex:none}',
    '#ct-fullscreen-targets h2{margin:0;font:800 clamp(17px,2.5vw,29px) Georgia,serif;',
    'color:#ffe0aa;flex:1}',
    '#ct-fullscreen-targets button{touch-action:manipulation;cursor:pointer}',
    '#ct-fullscreen-targets .ct-target-back{background:#304c5a;',
    'color:#f7e4c6;border:1px solid #d8b57b;border-radius:10px;',
    'font:750 12px system-ui;min-height:40px;padding:8px 12px;flex:none}',
    '#ct-fullscreen-targets .ct-target-sub{padding:10px 16px 4px;',
    'font-size:12px;color:#c4d9d9;white-space:pre-wrap}',
    '#ct-fullscreen-targets .ct-target-count{padding:2px 16px 9px;',
    'color:#cda96c;font:800 11px system-ui}',
    '#ct-fullscreen-targets .ct-target-grid{display:grid;',
    'grid-template-columns:repeat(auto-fit,minmax(min(210px,100%),1fr));',
    'gap:10px;min-height:0;overflow-y:auto;padding:10px 16px 18px;',
    'align-content:start;overscroll-behavior:contain}',
    '#ct-fullscreen-targets .ct-target-tile{border:2px solid #75969b;',
    'border-radius:12px;background:#263f4c;color:#f8ead4;',
    'padding:12px;text-align:left;min-height:88px;',
    'display:flex;align-items:center;gap:12px}',
    '#ct-fullscreen-targets .ct-target-tile[data-chosen="true"]{',
    'border-color:#e6bc73;background:#3d5158}',
    '#ct-fullscreen-targets .ct-target-tile:disabled{opacity:.5;cursor:not-allowed}',
    '#ct-fullscreen-targets .ct-target-icon{display:grid;place-items:center;',
    'width:56px;height:66px;flex:none;background:#172935;border:1px solid #ac916c;',
    'border-radius:8px;font-size:26px;overflow:hidden}',
    '#ct-fullscreen-targets .ct-target-icon img{width:100%;height:100%;',
    'object-fit:cover;object-position:top}',
    '#ct-fullscreen-targets .ct-target-title{display:block;font-weight:800;',
    'line-height:1.25;overflow-wrap:anywhere}',
    '#ct-fullscreen-targets .ct-target-meta{display:block;',
    'font-size:11px;line-height:1.35;color:#bfd2d4;margin-top:5px}',
    '#ct-fullscreen-targets .ct-target-status{padding:9px 16px;',
    'border-top:1px solid #d7b07755;color:#ffdda3;min-height:19px;',
    'font:700 12px system-ui}',
    '#ct-fullscreen-targets button:focus-visible{outline:3px solid #fff0be}',
    '#ct-fullscreen-target-resume{display:none;position:fixed;left:2vw;',
    'bottom:3dvh;z-index:2147483060;border:2px solid #dfb778;',
    'border-radius:11px;background:#e0b775;color:#152a33;',
    'padding:9px 15px;min-height:43px;font:800 13px system-ui}',
    '@media(orientation:landscape) and (max-height:460px){',
    '#ct-fullscreen-targets>div{max-height:97dvh;height:97dvh}',
    '#ct-fullscreen-targets .ct-target-tile{min-height:64px;padding:6px}',
    '#ct-fullscreen-targets .ct-target-icon{height:49px;width:39px;font-size:19px}',
    '#ct-fullscreen-targets .ct-target-grid{gap:6px;padding:5px 12px}',
    '#ct-fullscreen-targets header{padding:6px 10px}',
    '#ct-fullscreen-targets .ct-target-sub{padding:4px 12px}',
    '#ct-fullscreen-targets .ct-target-count{padding:2px 12px}',
    '}'
  ].join('');
  document.head.append(css);
  const create=(tag,text,className)=>{
    const el=document.createElement(tag);
    if(text!==null&&text!==undefined)el.textContent=String(text);
    if(className)el.className=className;
    return el;
  };
  const modal=create('section');modal.id='ct-fullscreen-targets';
  modal.dataset.open='false';modal.setAttribute('role','dialog');
  modal.setAttribute('aria-modal','true');
  modal.setAttribute('aria-label','Choose a legal Sol Pod target');
  const sheet=create('div');
  const header=create('header');
  const title=create('h2','Choose a target');
  const back=create('button','Return to battlefield','ct-target-back');
  back.type='button';back.onclick=()=>dismiss();
  header.append(title,back);
  const subtitle=create('div',null,'ct-target-sub');
  const count=create('div',null,'ct-target-count');
  const grid=create('div',null,'ct-target-grid');
  grid.setAttribute('role','group');grid.setAttribute('aria-label','Legal target options');
  const status=create('div',null,'ct-target-status');
  sheet.append(header,subtitle,count,grid,status);
  modal.append(sheet);document.body.append(modal);
  // Full-screen target choices can be temporarily hidden to review the board;
  // this separate resume affordance never lives inside the Game Log.
  const resume=create('button','✦ Continue targeting');
  resume.id='ct-fullscreen-target-resume';resume.type='button';
  document.body.append(resume);
  let lastSignature='',dismissed='',busy=false,previousFocus=null,suspended=false,manualReview=false;
  const forge=()=>window.ctForgeSelection;
  const targeting=()=>Array.isArray(forge()?.legalTargets)?forge().legalTargets:[];
  const game=()=>window.app?.game;
  function available(){
    const phase=String(game()?.phaseDetail||'').toUpperCase();
    if(/ATTACKERS|BLOCKERS/.test(phase))return false;
    if(!window.app?.nativeMatch||window.app?.view!=='game'||game()?.winner!==null)return false;
    // Required targeting takes priority over a stale card inspector.
    // Closing that read-only preview is not a decision or cast.
    if(window.app?.modal==='inspect'){
      window.app.modal='';window.app.sideInspect=null;
      window.app.inspectForgeId=null;
    }
    if(window.app?.modal || window.app?.sideInspect)return false;
    if(window.ctForgeChoice?.hasPending || window.ctForgeSafety?.recoveryVisible)return false;
    const sheet=document.getElementById('ct-forge-decision-sheet');
    if(sheet && sheet.style?.display && sheet.style.display!=='none')return false;
    return targeting().length>0;
  }
  function signature(){
    const targets=targeting();
    return JSON.stringify([targets.map(t=>[t.kind,t.id,t.label,t.zone]),
      (forge()?.chosenIds||[]).map(String)]);
  }
  function dismiss(){
    if(modal.dataset.open==='true') {dismissed=lastSignature;manualReview=true;}
    modal.dataset.open='false';
    resume.style.display=manualReview&&available()?'block':'none';
    if(previousFocus?.focus)previousFocus.focus();
    previousFocus=null;
  }
  function name(target){return String(target.label||target.name||
    ((target.kind||'target')+' #'+target.id));}
  function cardImage(target,icon){
    if(target.kind!=='card'||!window.ctCardArtUrl)return;
    try {
      const url=window.ctCardArtUrl(name(target));
      if(!url)return;
      const img=create('img');img.src=url;img.alt=name(target)+' artwork';
      img.loading='lazy';img.onerror=()=>img.remove();
      icon.replaceChildren(img);
    }catch(_){}
  }
  async function choose(target,key){
    if(busy||key!==lastSignature||!available()||
      (window.ctForgeSafety?.needsRecovery&&!forge()?.isRequiredSelection?.(target)))return;
    const api=forge();
    const valid=target.kind==='player'
      ?api?.isLegalPlayer?.(target.id)
      :target.kind==='stack'
      ?api?.isLegalStack?.(target.id)
      :api?.isLegalCard?.(target.id);
    if(!valid){status.textContent='This target is no longer legal. Review the updated choices.';return;}
    const action=target.kind==='player'?api.choosePlayer:
      target.kind==='stack'?api.chooseStack:api.chooseCard;
    if(typeof action!=='function')return;
    busy=true;status.textContent='Sending your choice to Sol Pod…';
    renderOptions();
    const accepted=await action(target.id);
    busy=false;
    if(accepted){
      window.ctAttachmentFlow?.finish?.();
      // Selection may immediately advance to a SECOND target; if so the
      // version/signature will change and the next prompt should open.
      if(lastSignature===key){dismissed=key;manualReview=false;modal.dataset.open='false';
        resume.style.display='none';}
    }else status.textContent='Sol Pod could not select this target. Try again or refresh.';
    sync();
  }
  function renderOptions(){
    const targets=targeting(),chosen=new Set((forge()?.chosenIds||[]).map(String));
    grid.replaceChildren();
    const playerCount=targets.filter(t=>t.kind==='player').length;
    const type=targets.length&&playerCount===targets.length?'player':
      targets.length&&targets.every(t=>t.kind==='card')?'card':'target';
    const attachment=window.ctAttachmentFlow?.current?.();
    title.textContent=attachment&&type==='card'
      ?'Choose a creature to '+(attachment.kind==='aura'?'enchant':'equip')
      :'Choose '+(type==='player'?'a player':type==='card'?'a card':'a target');
    subtitle.textContent=attachment&&type==='card'
      ?'Select a legal target for '+attachment.name+'. Sol Pod will check the targeting and attachment rules.'
      :String(forge()?.prompt||'')||
       'Select a legal target for the spell or ability. Sol Pod checks the rules.';
    count.textContent=targets.length+' legal option'+(targets.length===1?'':'s')+
      (chosen.size?' · '+chosen.size+' already selected':'');
    const key=lastSignature;
    targets.forEach(t=>{
      const tile=create('button',null,'ct-target-tile');tile.type='button';
      tile.setAttribute('data-forge-target-kind',t.kind);
      tile.setAttribute('data-forge-target-id',String(t.id));
      tile.dataset.chosen=String(chosen.has(String(t.id)));
      const icon=create('span',t.kind==='player'?'♙':t.kind==='stack'?'⚡':'◆','ct-target-icon');
      cardImage(t,icon);
      const text=create('span');
      text.append(create('span',name(t),'ct-target-title'));
      let desc=String(t.zone||'');
      if(t.kind==='player'){
        const player=game()?.players?.find(p=>Number(p.forgeId)===Number(t.id));
        const isSelf=player && Number(player.forgeId)===Number(game()?.players?.[0]?.forgeId);
        const life=player&&Number.isFinite(Number(player.life))?' · '+player.life+' life':'';
        desc=(isSelf?'You':'Player')+life+(desc?' · '+desc:'');
      }else if(t.kind==='stack')desc='Spell or ability on stack'+(desc?' · '+desc:'');
      if(t.kind==='card' && !desc)desc='Card (legal target)';
      text.append(create('span',desc,'ct-target-meta'));
      tile.append(icon,text);
      tile.disabled=busy||(!!window.ctForgeSafety?.needsRecovery&&
        !forge()?.isRequiredSelection?.(t));
      tile.onclick=()=>{void choose(t,key);};
      grid.append(tile);
    });
    if(window.ctForgeSafety?.needsRecovery &&
       !targets.some(t=>forge()?.isRequiredSelection?.(t)))
      status.textContent='Refresh before initiating a new action.';
    else if(!busy)status.textContent='Only legal targets are shown. Returning to the battlefield does not cancel this choice.';
  }
  function sync(event){
    if(!available()){
      suspended=!!targeting().length&&dismissed!==lastSignature;
      modal.dataset.open='false';busy=false;resume.style.display='none';return;
    }
    const sig=signature();
    const changed=sig!==lastSignature;
    if(changed){lastSignature=sig;manualReview=false;}
    if((changed||suspended)&&sig!==dismissed){
      // The stack inspector might already be showing the card; a mandatory
      // target decision takes precedence, not two overlapping modals.
      window.solPodStack?.close?.();
      previousFocus=document.activeElement;
      modal.dataset.open='true';
    }
    suspended=false;
    resume.style.display=manualReview&&modal.dataset.open!=='true'?'block':'none';
    if(modal.dataset.open==='true')renderOptions();
  }
  window.addEventListener('ct-forge-selection',sync);
  window.addEventListener('ct-forge-choice-cleared',sync);
  document.addEventListener('keydown',event=>{
    if(modal.dataset.open!=='true')return;
    if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();dismiss();}
  },true);
  modal.addEventListener('click',event=>{if(event.target===modal)dismiss();});
  const launcher=create('button','Full-screen target choices','ct-fullscreen-target-open');
  launcher.type='button';
  launcher.style.cssText='display:none;margin-top:8px;width:100%;min-height:38px;'+
    'background:#b99c6b;color:#162e3a;border:0;border-radius:9px;font-weight:800';
  launcher.onclick=()=>{
    if(!available())return;
    dismissed='';manualReview=false;lastSignature=signature();
    previousFocus=document.activeElement;modal.dataset.open='true';
    resume.style.display='none';renderOptions();
  };
  resume.onclick=()=>launcher.onclick();
  document.getElementById('ct-forge-legal-actions')?.append(launcher);
  window.addEventListener('ct-forge-selection',()=>{
    launcher.style.display=available()?'block':'none';
  });
  window.ctFullscreenTargets={
    open:()=>launcher.onclick(),dismiss,
    refresh:sync,get visible(){return modal.dataset.open==='true';}
  };
  sync();
})();