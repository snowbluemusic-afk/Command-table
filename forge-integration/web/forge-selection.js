/* Legal selection highlights and targets supplied by Forge's Selection model.
 * This is visual/control logic ONLY: Forge decides what may be chosen.
 */
(() => {
  'use strict';
  const panel = document.createElement('section');
  panel.id='ct-forge-legal-actions';
  panel.style.cssText='position:fixed;z-index:99999;top:calc(env(safe-area-inset-top) + 62px);right:10px;left:auto;width:min(34vw,410px);max-width:410px;background:rgba(18,36,43,.96);border:1px solid #b89a74;border-radius:12px;color:#f7ead4;padding:9px;display:none;box-shadow:0 12px 30px #000a;font-family:system-ui;max-height:55dvh;overflow:auto;box-sizing:border-box';
  const panelCss=document.createElement('style');
  panelCss.id='ct-forge-selection-layout';
  panelCss.textContent='@media(orientation:portrait){#ct-forge-legal-actions{left:8px!important;right:8px!important;width:auto!important;max-width:none!important;top:calc(env(safe-area-inset-top) + 62px)!important;max-height:28dvh!important}}';
  document.head.append(panelCss);
  const header=document.createElement('div');
  header.style.cssText='font-weight:750;font-size:12px;display:flex;align-items:center;justify-content:space-between;gap:7px';
  const title=document.createElement('span');
  const expander=document.createElement('button');
  expander.textContent='Show options';
  expander.style.cssText='background:#344d55;border:1px solid #b89a74;border-radius:7px;color:#f7ead4;padding:6px;font-size:11px';
  header.append(title,expander);
  const choices=document.createElement('div');
  choices.style.cssText='display:none;flex-wrap:wrap;gap:6px;margin-top:8px;max-height:31dvh;overflow:auto';
  panel.append(header,choices);
  document.body.append(panel);
  let selection={cards:[],targets:[],chosen:[]};
  let expanded=false;
  let working=false;
  let promptMessage='';

  function candidates() {
    const all=[...(selection.cards||[]),...(selection.targets||[])];
    const seen=new Set();
    return all.filter(c=>{
      const key=c.kind+':'+c.id;
      if(seen.has(key))return false;
      seen.add(key);
      return true;
    });
  }
  function highlight() {
    document.querySelectorAll('.ct-forge-legal-target').forEach(e=>{
      e.classList.remove('ct-forge-legal-target');
      e.style.outline='';
      e.style.outlineOffset='';
    });
    const all=candidates().filter(c=>c.kind==='card');
    const ids=new Set(all.map(x=>String(x.id)));
    for(const element of document.querySelectorAll('[data-action="permanent"][data-value],[data-action="cardId"][data-value]')) {
      if(ids.has(element.getAttribute('data-value'))) {
        element.classList.add('ct-forge-legal-target');
        element.style.outline='3px solid #e8be6c';
        element.style.outlineOffset='2px';
      }
    }
    try {
      const idsInHand=app.game?.players?.[0]?.handForgeIds||[];
      for(const element of document.querySelectorAll('[data-action="selectHand"][data-value]')) {
        const pos=Number(element.getAttribute('data-value'));
        if(ids.has(String(idsInHand[pos]))) {
          element.classList.add('ct-forge-legal-target');
          element.style.outline='3px solid #e8be6c';
          element.style.outlineOffset='2px';
        }
      }
    }catch(_){}
  }
  async function select(item) {
    if(working)return;
    const action = item.kind==='player'?'selectPlayer':
                   item.kind==='stack'?'selectStack':'cardId';
    working=true;
    try {
      await CommandTableNative.request('game.command',{action,value:item.id});
      try {
        const next=await CommandTableNative.request('game.snapshot');
        if(next?.game && app.nativeMatch) {
          applyAuthoritativeGame(next.game);
          if(app.view==='game') render();
        }
      }catch(_){}
    }catch(err) {
      if(typeof announce==='function')announce('Forge: '+(err?.message||String(err)));
    }finally{working=false;}
  }
  function update() {
    const all=candidates();
    const playing=(()=>{try{return !!app.nativeMatch && app.view==='game' && app.game?.winner===null;}catch(_){return false;}})();
    const choiceSheet=document.getElementById('ct-forge-decision-sheet');
    const choiceActive=choiceSheet?.style.display==='flex';
    panel.style.display=playing&&all.length&&!choiceActive?'block':'none';
    if(!playing||!all.length)return;
    const chosen=(selection.chosen||[]).length;
    title.textContent=(promptMessage||'Forge legal choices').slice(0,95)+
      ' · '+all.length+' option'+(all.length===1?'':'s')+
      (chosen?' · '+chosen+' selected':'');
    expander.textContent=expanded?'Hide options':'Show options';
    choices.style.display=expanded?'flex':'none';
    choices.replaceChildren();
    if(expanded) for (const item of all) {
      const b=document.createElement('button');
      b.type='button';
      b.textContent=(selection.chosen||[]).includes(item.id)?'✓ '+item.label:item.label;
      b.style.cssText='padding:8px 10px;font-size:12px;background:#2b434c;border:1px solid #a68c66;border-radius:8px;color:#f1e8da;max-width:100%;white-space:normal;text-align:left';
      b.disabled=working;
      b.onclick=()=>select(item);
      choices.append(b);
    }
    highlight();
  }
  expander.onclick=()=>{expanded=!expanded;update();};
  const before=window.CommandTableNativeReply;
  window.CommandTableNativeReply=function(value) {
    let message;
    try{message=typeof value==='string'?JSON.parse(value):value;}catch(_){}
    if(message?.type==='game.selection'){
      const next=message.payload||{cards:[],targets:[],chosen:[]};
      const changed=JSON.stringify([selection.cards,selection.targets])!==
        JSON.stringify([next.cards,next.targets]);
      selection=next;
      if(changed) {
        expanded=candidates().length>0 && candidates().length<=4;
        // A legal-target selection supersedes an unrelated card preview.
        // Keep the hand and battlefield visible rather than stacking panels.
        if(candidates().length && window.app?.sideInspect) {
          window.app.sideInspect=null;
          window.app.inspectForgeId=null;
        }
        // Native selections can change between consecutive GameView updates.
        // Re-render to give each legal target its authoritative numeric ID.
        if(window.app?.nativeMatch && window.app?.view==='game')
          window.render?.();
      }
      update();
      return;
    }
    if(message?.type==='game.prompt'){
      promptMessage=String(message.payload?.message||promptMessage);
      update();
    }
    return typeof before==='function'?before(value):undefined;
  };
  // Native Forge asks "play or draw?" and "keep or mulligan?"
  // before GameView.getPlayerTurn exists. The former code waited for a
  // complete turn and left those decisions in hidden Forge controls.
  const decision=document.createElement('section');
  decision.id='ct-forge-priority-buttons';
  decision.setAttribute('role','group');
  decision.setAttribute('aria-label','Forge opening and priority decisions');
  decision.style.cssText=[
    'position:fixed','left:auto','right:10px',
    'top:auto','bottom:calc(env(safe-area-inset-bottom) + 25dvh)',
    'z-index:210000','display:none',
    'margin:0 auto','max-width:420px',
    'border:1px solid #c59c61','background:#15272ef5',
    'color:#fff2db','padding:8px','border-radius:12px',
    'box-shadow:0 8px 22px #0009',
    'font-family:system-ui','box-sizing:border-box',
    'pointer-events:auto'
  ].join(';');
  // This is a small action dock, not an opaque game-blocking modal. Its
  // footprint is kept above the hand and is hidden when viewing any card.
  const decisionCss=document.createElement('style');
  decisionCss.textContent=[
    '@media(orientation:landscape) and (max-height:600px){',
    '#ct-forge-priority-buttons{top:auto!important;bottom:calc(env(safe-area-inset-bottom) + 10px)!important;left:auto!important;right:9px!important;margin:0!important;width:min(24vw,300px)!important;padding:6px!important;max-height:118px!important}',
    '#ct-forge-priority-buttons button{min-height:32px!important;font-size:12px!important}',
    '#ct-forge-priority-buttons .ct-forge-decision-caption{max-height:32px!important;font-size:11px!important;line-height:1.2!important}',
    '#ct-forge-priority-buttons.ct-forge-pregame{top:calc(env(safe-area-inset-top) + 70px)!important;bottom:auto!important;right:9px!important}',
    '}'
  ].join('');
  document.head.append(decisionCss);
  const decisionText=document.createElement('div');
  decisionText.className='ct-forge-decision-caption';
  decisionText.style.cssText='font-size:12px;line-height:1.2;max-height:42px;overflow:auto;margin-bottom:5px;white-space:pre-wrap';
  const buttons=document.createElement('div');
  buttons.style.cssText='display:flex;gap:7px';
  const phaseRail=document.createElement('div');
  phaseRail.className='ct-forge-phase-rail';
  phaseRail.setAttribute('aria-label','Turn phase progression');
  phaseRail.style.cssText='display:flex;justify-content:space-between;gap:3px;padding:5px 0;margin-bottom:4px;border-bottom:1px solid #ad94645b';
  decision.append(phaseRail,decisionText,buttons);
  // Keep the dock reachable on both turns; Forge enables the actual actions.
  document.body.append(decision);
  let buttonState={label1:'OK',label2:'Cancel',enable1:false,enable2:false};
  let openingMessage='';
  let busy=false;
  async function decide(ok){
    if(busy)return;
    busy=true;
    paintDecision();
    try{
      await window.CommandTableNative.request('game.command',{
        action:ok?'resolve':'cancelCastTarget',value:null
      });
      // Forge sends the next state/buttons; keep decision panel responsive.
    }catch(err){
      if(typeof window.announce==='function')
        window.announce('Forge could not apply your decision: '+(err?.message||String(err)));
    }finally{busy=false;paintDecision();}
  }
  function paintDecision(){
    const forgeChoice=document.getElementById('ct-forge-decision-sheet');
    const otherChoiceOpen=!!forgeChoice && forgeChoice.style.display!=='none';
    const active=!!window.app?.nativeMatch &&
      window.app?.view==='game' && window.app?.game?.winner===null && !window.app?.modal &&
      !window.app?.sideInspect && !otherChoiceOpen &&
      (!!buttonState.enable1||!!buttonState.enable2);
    // A single small dock owns Forge buttons. Never mount a full-width
    // secondary prompt or cover the enlarged card browser.
    decision.style.pointerEvents=active?'auto':'none';
    decision.style.display=active?'block':'none';
    if(!active)return;
    const pregame=window.app?.game?.phase==='mulligan' ||
      window.app?.view!=='game';
    decision.classList.toggle('ct-forge-pregame',pregame);
    const game=window.app?.game;
    const steps=[
      ['untap','↻','Untap'],['upkeep','✧','Upkeep'],['draw','▤','Draw'],
      ['main1','◆','Main'],['combat','⚔','Combat'],
      ['main2','◆','Main 2'],['end','◉','End']
    ];
    phaseRail.replaceChildren();
    for(const [id,glyph,label] of steps){
      const pip=document.createElement('span');
      pip.textContent=glyph;
      pip.setAttribute('title',label);
      pip.setAttribute('aria-label',label);
      const phase=String(game?.phase||'').toLowerCase();
      const raw=String(game?.phaseDetail||'').toLowerCase();
      const active=(id==='combat'?phase==='combat':id==='end'?phase==='end':
        id==='main1'?phase==='main1':id==='main2'?phase==='main2':
        raw.includes(id));
      pip.style.cssText='flex:1;min-width:0;text-align:center;border-radius:5px;'+
        (active?'background:#e7b773;color:#10252a;box-shadow:0 0 8px #c79a5777;':
          'color:#99aeb2;opacity:.65;')+'font-size:13px;font-weight:900';
      phaseRail.append(pip);
    }
    phaseRail.style.display=pregame?'none':'flex';
    const phases={main1:'First main',main2:'Second main',combat:'Combat',end:'End step',mulligan:'Opening hand'};
    const detail=String(game?.phaseDetail||'').toLowerCase();
    const phaseText=detail.includes('blocker')?'Declare blockers':
      detail.includes('attacker')?'Declare attackers':
      detail.includes('damage')?'Combat damage':
      phases[game?.phase]||game?.phase||'Priority';
    decisionText.textContent=pregame
      ? (openingMessage||'Keep your opening hand or take a mulligan.')
      : 'Turn '+(game?.turn||1)+' · '+phaseText+
        ' · '+(game?.players?.[0]?.priority?'Your priority':'Respond / advance');
    buttons.replaceChildren();
    for(const [label,enabled,ok] of [
      [buttonState.label1,buttonState.enable1,true],
      [buttonState.label2,buttonState.enable2,false]
    ]){
      const b=document.createElement('button');
      b.type='button';
      const original=String(label|| (ok?'OK':'Cancel'));
      const ordinary=/^(ok|done|continue)$/i.test(original.trim());
      const phase=window.app?.game?.phase;
      const stack=window.app?.game?.stack||[];
      b.textContent=ok && !pregame && ordinary
        ? (stack.length?'Resolve':window.app?.game?.active===0?'Next':'Pass')
        :original;
      b.setAttribute('aria-label',original+' — '+b.textContent);
      b.disabled=!enabled||busy;
      b.style.cssText=[
        'flex:1','min-height:36px','padding:6px 8px','border-radius:9px',
        'border:1px solid #bda17d',
        ok?'background:#e6b46c;color:#14252a':'background:#2a4049;color:#f4e3c9',
        'font-size:13px','font-weight:700',
        b.disabled?'opacity:.5':'opacity:1'
      ].join(';');
      b.onclick=()=>decide(ok);
      buttons.append(b);
    }
  }
  const firstReply=window.CommandTableNativeReply;
  window.CommandTableNativeReply=function(value){
    let payload;
    try{payload=typeof value==='string'?JSON.parse(value):value;}catch(_){}
    if(payload?.type==='game.prompt'){
      const p=payload.payload||{};
      if(typeof p.message==='string')openingMessage=p.message;
      for(const key of ['label1','label2','enable1','enable2']){
        if(Object.prototype.hasOwnProperty.call(p,key))buttonState[key]=p[key];
      }
      paintDecision();
    }
    if(payload?.type==='game.state')paintDecision();
    return typeof firstReply==='function'?firstReply(value):undefined;
  };
  window.ctForgePriority={
    reset:()=>{openingMessage='';buttonState.enable1=false;buttonState.enable2=false;paintDecision();},
    refresh:paintDecision
  };

  const appRoot=document.getElementById('app');
  if(appRoot) {
    new MutationObserver(()=>{
      if(selection.cards?.length||selection.targets?.length)highlight();
      paintDecision(); // Close behind full-screen card inspector / hand browser.
    })
      .observe(appRoot,{childList:true,subtree:false});
  }
  window.ctForgeSelection={
    reset:()=>{selection={cards:[],targets:[],chosen:[]};expanded=false;promptMessage='';update();},
    refresh:()=>{update();},
    isLegalCard:(id)=>Number.isInteger(Number(id))&&
      candidates().some(c=>c.kind==='card'&&Number(c.id)===Number(id)),
    get active(){return candidates().length>0;}
  };
})();
