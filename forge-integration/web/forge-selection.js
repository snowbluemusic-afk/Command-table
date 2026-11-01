/* Legal selection highlights and targets supplied by Forge's Selection model.
 * This is visual/control logic ONLY: Forge decides what may be chosen.
 */
(() => {
  'use strict';
  const panel = document.createElement('section');
  panel.id='ct-forge-legal-actions';
  panel.style.cssText='position:fixed;z-index:99999;top:calc(env(safe-area-inset-top) + 56px);left:8px;right:8px;max-width:720px;margin:auto;background:rgba(18,36,43,.95);border:1px solid #b89a74;border-radius:13px;color:#f7ead4;padding:9px;display:none;box-shadow:0 12px 36px #000a;font-family:system-ui;max-height:45dvh;overflow:auto';
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
    for(const element of document.querySelectorAll('[data-action="permanent"][data-value]')) {
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
    const playing=(()=>{try{return !!app.nativeMatch && app.view==='game';}catch(_){return false;}})();
    panel.style.display=playing&&all.length?'block':'none';
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
      selection=message.payload||{cards:[],targets:[],chosen:[]};
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
    'position:fixed','left:12px','right:12px',
    'bottom:calc(env(safe-area-inset-bottom) + 86px)',
    'z-index:210000','display:none','margin:auto','max-width:680px',
    'border:1px solid #c59c61','background:#15272e','color:#fff2db',
    'padding:13px','border-radius:16px','box-shadow:0 12px 38px #000b',
    'font-family:system-ui'
  ].join(';');
  const decisionText=document.createElement('div');
  decisionText.style.cssText='font-size:13px;line-height:1.45;margin-bottom:10px;white-space:pre-wrap';
  const buttons=document.createElement('div');
  buttons.style.cssText='display:flex;gap:9px';
  decision.append(decisionText,buttons);
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
    const active=!!window.app?.nativeMatch &&
      (!!buttonState.enable1||!!buttonState.enable2);
    decision.style.display=active?'block':'none';
    if(!active)return;
    const pregame=window.app?.game?.phase==='mulligan' ||
      window.app?.view!=='game';
    decisionText.textContent=openingMessage ||
      (pregame?'Forge is preparing your starting hand.':'Choose how to continue.');
    buttons.replaceChildren();
    for(const [label,enabled,ok] of [
      [buttonState.label1,buttonState.enable1,true],
      [buttonState.label2,buttonState.enable2,false]
    ]){
      const b=document.createElement('button');
      b.type='button';
      b.textContent=label|| (ok?'OK':'Cancel');
      b.disabled=!enabled||busy;
      b.style.cssText=[
        'flex:1','min-height:48px','padding:10px','border-radius:10px',
        'border:1px solid #bda17d',
        ok?'background:#e6b46c;color:#14252a':'background:#2a4049;color:#f4e3c9',
        'font-size:15px','font-weight:700',
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
    new MutationObserver(()=>{if(selection.cards?.length||selection.targets?.length)highlight();})
      .observe(appRoot,{childList:true,subtree:false});
  }
  window.ctForgeSelection={
    reset:()=>{selection={cards:[],targets:[],chosen:[]};expanded=false;promptMessage='';update();},
    get active(){return candidates().length>0;}
  };
})();
