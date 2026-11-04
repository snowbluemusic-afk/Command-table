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
  let selectionVersion=0;
  let expanded=false;
  let working=false;
  let promptMessage='';
  // Connect confirmed attacker/blocker pairs from Forge's CombatView.
  // This non-interactive visual never makes a combat/rules decision.
  const combatSvg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  combatSvg.id='ct-forge-combat-links';
  combatSvg.setAttribute('aria-hidden','true');
  combatSvg.style.cssText='position:fixed;inset:0;width:100vw;height:100dvh;z-index:20000;pointer-events:none;overflow:visible';
  document.body.append(combatSvg);
  let linkFrame=0;
  function paintCombatLinks(){
    combatSvg.replaceChildren();
    const game=window.app?.game;
    if(!window.app?.nativeMatch||window.app?.view!=='game'||
       game?.phase!=='combat'||!Array.isArray(game?.combat))return;
    const byCardId=new Map();
    for(const element of document.querySelectorAll('[data-action="inspectBoardPermanent"][data-value],.ct10-lane [data-action="cardId"][data-value]')){
      const value=String(element.getAttribute('data-value')||'');
      const id=value.split(':').at(-1);
      if(id&&!byCardId.has(id))byCardId.set(id,element);
    }
    const center=element=>{
      if(!element)return null;
      const r=element.getBoundingClientRect();
      return r.width&&r.height?{x:r.left+r.width/2,y:r.top+r.height/2}:null;
    };
    for(const combat of game.combat){
      const attacker=center(byCardId.get(String(combat.cardId)));
      if(!attacker)continue;
      const defenderElement=[...document.querySelectorAll('[data-ct-forge-player-id]')]
        .find(el=>String(el.getAttribute('data-ct-forge-player-id'))===String(combat.defenderId));
      const defender=center(defenderElement);
      // Dashed orange: attack target. Solid gold: confirmed blocker pair.
      // Both reflect CombatView; drawing cannot change attack legality.
      if(defender){
        const attackLine=document.createElementNS('http://www.w3.org/2000/svg','path');
        attackLine.setAttribute('d',`M ${attacker.x} ${attacker.y} Q ${(attacker.x+defender.x)/2} ${(attacker.y+defender.y)/2-28} ${defender.x} ${defender.y}`);
        attackLine.setAttribute('fill','none');
        attackLine.setAttribute('stroke','#ff9d59');
        attackLine.setAttribute('stroke-width','2.5');
        attackLine.setAttribute('stroke-dasharray','7 5');
        attackLine.setAttribute('stroke-linecap','round');
        attackLine.setAttribute('opacity','.86');
        combatSvg.append(attackLine);
      }
      for(const blockerId of combat.blockerIds||[]){
        const blocker=center(byCardId.get(String(blockerId)));
        if(!blocker)continue;
        const path=document.createElementNS('http://www.w3.org/2000/svg','path');
        const bend=Math.max(18,Math.min(55,Math.abs(blocker.y-attacker.y)*.24));
        path.setAttribute('d',`M ${attacker.x} ${attacker.y} Q ${(attacker.x+blocker.x)/2} ${Math.min(attacker.y,blocker.y)-bend} ${blocker.x} ${blocker.y}`);
        path.setAttribute('fill','none');
        path.setAttribute('stroke','#ffd06d');
        path.setAttribute('stroke-width','3');
        path.setAttribute('stroke-linecap','round');
        path.setAttribute('opacity','.95');
        path.style.filter='drop-shadow(0 0 5px #ffc45d)';
        combatSvg.append(path);
      }
    }
  }
  function queueCombatLinks(){
    if(linkFrame)return;
    linkFrame=requestAnimationFrame(()=>{linkFrame=0;paintCombatLinks();});
  }

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
  // An unconfirmed cast blocks NEW spells, but must not block Forge's
  // existing mana, target or discard selections needed to finish that cast.
  function isRequiredSelection(item){
    if(!item)return false;
    const same=x=>x.kind===item.kind&&Number(x.id)===Number(item.id);
    if((selection.targets||[]).some(same))return true;
    if(item.kind!=='card')return false;
    const card=(selection.cards||[]).find(same);
    if(!card)return false;
    if(window.ctForgePriority?.isManaPayment||window.ctForgePriority?.isHandChoice)return true;
    const message=String(promptMessage||window.ctForgePriority?.buttonInfo?.message||'');
    return !card.actionable&&(Number(selection.min||0)>0 ||
      /\b(?:choose|select|discard|sacrifice|bottom|return|pay)\b/i.test(message));
  }
  function highlight() {
    document.querySelectorAll('.ct-forge-legal-target').forEach(e=>{
      e.classList.remove('ct-forge-legal-target');
      e.style.outline='';
      e.style.outlineOffset='';
    });
    const all=candidates().filter(c=>c.kind==='card');
    const ids=new Set(all.map(x=>String(x.id)));
    for(const element of document.querySelectorAll('[data-action="permanent"][data-value],[data-action="cardId"][data-value],[data-action="inspectBoardPermanent"][data-value]')) {
      // The inspector action uses seat:forgeCardId; the target action
      // uses the numeric ID directly. Do not compare full UI action values.
      const raw=String(element.getAttribute('data-value')||'');
      const cardId=raw.includes(':')?raw.split(':').at(-1):raw;
      if(ids.has(cardId)) {
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
      const playerIds=new Set((selection.targets||[])
        .filter(item=>item.kind==='player').map(item=>String(item.id)));
      document.querySelectorAll('[data-ct-forge-player-id]').forEach(element=>{
        const legal=playerIds.has(String(element.getAttribute('data-ct-forge-player-id')));
        element.classList.toggle('ct-forge-legal-player',legal);
      });
    }catch(_){}
  }
  async function select(item) {
    // Never submit a stale or invented target. Only Forge's current Selection
    // model determines which player/card/stack item is actionable.
    if(working || (window.ctForgeSafety?.needsRecovery && !isRequiredSelection(item)) ||
       !candidates().some(candidate=>
        candidate.kind===item.kind && Number(candidate.id)===Number(item.id)))return false;
    const action = item.kind==='player'?'selectPlayer':
                   item.kind==='stack'?'selectStack':'cardId';
    working=true;
    try {
      await CommandTableNative.request('game.command',{action,value:item.id});
      try {
        const next=await CommandTableNative.request('game.snapshot');
        if(next?.game && app.nativeMatch) {
          if(typeof ctReceiveForgeState==='function')ctReceiveForgeState(next.game);
          else {applyAuthoritativeGame(next.game);if(app.view==='game')render();}
        }
      }catch(_){}
      return true;
    }catch(err) {
      // A failed required selection requires recovery, not a passive log entry.
      if(window.ctForgeSafety?.showError)
        window.ctForgeSafety.showError(err,'Sol Pod could not select card or target');
      else window.ctNativeToast?.('Sol Pod selection unavailable: '+(err?.message||String(err)));
      return false;
    }finally{working=false;update();}
  }
  // Outside combat there is no legacy player action: the normal click handler
  // does not dispatch selectPlayer. Handle legal player badges at capture time,
  // including our own player when Forge permits self-targeting. Intercept only
  // legal targets, leaving ordinary player inspection and combat taps alone.
  document.addEventListener('click',event=>{
    if(!window.app?.nativeMatch || window.app?.view!=='game' || window.app?.modal)return;
    if(document.getElementById('ct-forge-decision-sheet')?.style.display==='flex')return;
    const surface=event.target?.closest?.('[data-ct-forge-player-id]');
    if(!surface)return;
    const id=Number(surface.getAttribute('data-ct-forge-player-id'));
    if(!Number.isInteger(id)||id<=0||!(selection.targets||[]).some(target=>
        target.kind==='player'&&Number(target.id)===id))return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void select({kind:'player',id});
  },true);

  function update() {
    const all=candidates();
    const playing=(()=>{try{return !!app.nativeMatch && app.view==='game' && app.game?.winner===null;}catch(_){return false;}})();
    const choiceSheet=document.getElementById('ct-forge-decision-sheet');
    const choiceActive=choiceSheet?.style.display==='flex';
    // The advanced options drawer is optional during combat and must not
    // obscure the battlefield while players assign attackers or blockers.
    // Forge glows are the primary selection affordance. Do not show a second
    // overlapping list for ordinary card/player targets; retain the drawer
    // for non-board targets (e.g. stack or other nonvisual choices).
    // Every Forge-legal choice must remain reachable even when its card is
    // off-board (graveyard/exile/command zone), hidden beneath a large hand,
    // or represented only by a stack entry. Combat keeps its concise
    // battlefield-first gestures, with this picker as a manual fallback.
    const phaseDetail=String(window.app?.game?.phaseDetail||'').toUpperCase();
    const declaring=/ATTACKERS/.test(phaseDetail) ||
      (/BLOCKERS/.test(phaseDetail) && window.app?.game?.blockInputActive===true);
    const hasPlayer=all.some(item=>item.kind==='player');
    const hasCard=all.some(item=>item.kind==='card');
    const hasStack=all.some(item=>item.kind==='stack');
    const needsRecovery=!!window.ctForgeSafety?.needsRecovery;
    panel.style.display=playing&&all.length&&!choiceActive&&!window.app?.sideInspect?'block':'none';
    queueCombatLinks();
    if(!playing||!all.length){
      choices.replaceChildren();
      highlight();return;
    }
    const chosenIds=new Set((selection.chosen||[]).map(String));
    const chosen=chosenIds.size;
    const combatLabel=/ATTACKERS/.test(phaseDetail)?'Choose attackers':
      /BLOCKERS/.test(phaseDetail)?'Choose blockers':
      /COMBAT/.test(phaseDetail)?'Combat choices':null;
    const category=hasPlayer&&!(hasCard||hasStack)?'player':
      hasStack&&!(hasCard||hasPlayer)?'spell on stack':
      hasCard&&!(hasPlayer||hasStack)?'card':'target';
    const blockedByRecovery=needsRecovery&&!all.some(isRequiredSelection);
    title.textContent=(blockedByRecovery?'Refresh Sol Pod before a new action':
      !declaring?('Choose legal '+category):combatLabel||promptMessage||'Available choices')+
      ' · '+all.length+(chosen?' · '+chosen+' selected':'');
    // The title is always visible in Game Events. Expand automatically for
    // non-combat target prompts so players are not stuck hunting for a card.
    const expandedNow=!declaring||expanded;
    expander.textContent=expandedNow?'Hide choices':'Show legal choices';
    expander.style.display=declaring?'':'none';
    choices.style.display=expandedNow?'flex':'none';
    choices.replaceChildren();
    if(expandedNow) for(const item of all){
      const button=document.createElement('button');
      button.type='button';
      const tag=item.kind==='player'?'PLAYER':
        item.kind==='stack'?'STACK':'CARD';
      const label=String(item.label||tag+' #'+item.id);
      const zone=String(item.zone||'');
      // Equal card names can be separate game objects with distinct Forge IDs.
      const repeated=all.filter(other=>other.kind===item.kind&&
        String(other.label||'')===String(item.label||'')).length>1;
      const suffix=repeated?' · #'+item.id:'';
      button.textContent=(chosenIds.has(String(item.id))?'✓ ':'')+
        tag+' · '+label+(zone?' · '+zone:'')+suffix;
      button.setAttribute('data-ct-forge-choice-kind',item.kind);
      button.setAttribute('data-ct-forge-choice-id',String(item.id));
      button.style.cssText='padding:8px 10px;font-size:12px;background:#2b434c;'+
        'border:1px solid #a68c66;border-radius:8px;color:#f1e8da;'+
        'max-width:100%;white-space:normal;text-align:left;min-height:38px';
      button.disabled=working||(needsRecovery&&!isRequiredSelection(item));
      const expectedVersion=selectionVersion;
      button.onclick=()=>{
        // Ignore stale buttons after Forge has published a different selection.
        if(expectedVersion===selectionVersion)void select(item);
      };
      choices.append(button);
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
      // Chosen attackers/blockers can change while the legal target set
      // stays identical. Repaint on chosen changes too, so Undo is visible.
      const changed=JSON.stringify([selection.cards,selection.targets,selection.chosen])!==
        JSON.stringify([next.cards,next.targets,next.chosen]);
      selection=next;
      selectionVersion++;
      window.dispatchEvent(new CustomEvent('ct-forge-selection',{
        detail:{...next,version:selectionVersion}
      }));
      if(changed) {
        const combat=String(window.app?.game?.phaseDetail||'').toUpperCase().includes('COMBAT');
        // Keep combat on the battlefield, not a large auto-expanded option list.
        expanded=candidates().length>0 && !combat && candidates().length<=4 &&
          candidates().some(item=>item.kind!=='card'&&item.kind!=='player');
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
  decision.setAttribute('aria-label','Sol Pod opening and priority decisions');
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
  decisionCss.textContent += [
    '#ct-forge-priority-buttons.ct-forge-hand-choice{border:2px solid #e8bd79!important;',
    'background:#132b35fa!important;z-index:2147482400!important;',
    'box-shadow:0 7px 28px #000e!important;max-width:380px!important}',
    '#ct-forge-priority-buttons.ct-forge-hand-choice .ct-forge-decision-caption{',
    'font-size:13px!important;line-height:1.35!important;max-height:none!important;',
    'white-space:pre-wrap;color:#ffdfa9;font-weight:750;margin:5px 0 10px!important}',
    '@media(orientation:landscape) and (max-height:600px){',
    '#ct-forge-priority-buttons.ct-forge-hand-choice{max-height:145px!important;',
    'width:min(30vw,385px)!important;overflow:auto!important}',
    '#ct-forge-priority-buttons.ct-forge-hand-choice button{min-height:37px!important}}'
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
  let autoManaIssued=false;
  let promptSequence=0;
  let syncBusy=false;
  async function syncChoices(){
    if(syncBusy)return;
    syncBusy=true;
    paintDecision();
    try{
      await window.CommandTableNative.request('engine.status');
      const snapshot=await window.CommandTableNative.request('game.snapshot').catch(()=>null);
      if(snapshot?.game)window.ctReceiveForgeState?.(snapshot.game);
    }catch(error){
      if(window.ctForgeSafety?.showError)
        window.ctForgeSafety.showError(error,'Unable to sync Sol Pod decisions');
      else window.ctNativeToast?.('Unable to sync Sol Pod choices: '+(error?.message||String(error)));
    }finally{
      syncBusy=false;
      paintDecision();
      update();
    }
  }
  async function decide(ok){
    if(busy)return false;
    busy=true;
    // A player may press Confirm immediately after dragging two blockers.
    // Wait for both Forge assignments before advancing combat.
    if(window.ctDirectCombat?.pending)await window.ctDirectCombat.whenIdle();
    paintDecision();
    try{
      await window.CommandTableNative.request('game.command',{
        action:ok?'resolve':'cancelCastTarget',value:null
      });
      // Acknowledges the command; Forge remains responsible for resolution.
      return true;
    }catch(err){
      if(window.ctForgeSafety?.showError)
        window.ctForgeSafety.showError(err,'Sol Pod could not apply your decision');
      else window.ctNativeToast?.('Sol Pod decision rejected: '+(err?.message||String(err)));
      return false;
    }finally{busy=false;paintDecision();}
  }
  function paintDecision(){
    const forgeChoice=document.getElementById('ct-forge-decision-sheet');
    const otherChoiceOpen=!!forgeChoice && forgeChoice.style.display!=='none';
    const handChoice=!!window.ctForgePriority?.isHandChoice;
    const waitingForInput=/COMBAT_DECLARE_BLOCKERS/.test(
      String(window.app?.game?.phaseDetail||'')) &&
      ['none','transitioning'].includes(String(window.app?.game?.humanInput||''));
    const active=!!window.app?.nativeMatch &&
      window.app?.view==='game' && window.app?.game?.winner===null && !window.app?.modal &&
      !window.app?.sideInspect && !otherChoiceOpen && !waitingForInput &&
      (!!buttonState.enable1||!!buttonState.enable2||handChoice);
    decision.classList.toggle('ct-forge-hand-choice',handChoice);
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
    const inAttack=/ATTACKERS/.test(String(game?.phaseDetail||'').toUpperCase());
    const inBlockPhase=/BLOCKERS/.test(String(game?.phaseDetail||'').toUpperCase());
    const inBlock=inBlockPhase && game?.blockInputActive===true;
    const blockPriority=inBlockPhase && !inBlock && game?.humanInput==='InputPassPriority';
    const confirmedAttackers=Array.isArray(game?.combat)?game.combat.length:0;
    const confirmedBlockers=Array.isArray(game?.combat)?
      new Set(game.combat.flatMap(attack=>attack.blockerIds||[])).size:0;
    // Selection.chosen is the *focused defender/attacker*, NOT a count of
    // selected attacking or blocking creatures. Use CombatView exclusively.
    const combatCount=inAttack?confirmedAttackers:inBlock?confirmedBlockers:0;
    const blockerNames=(game?.combat||[]).flatMap(attack=>(attack.blockerIds||[]).map(id=>{
      const card=game.players?.flatMap(p=>p.battlefield||[]).find(c=>Number(c.forgeId)===Number(id));
      return card?.name||('Card #'+id);
    }));
    const pendingAssignments=window.ctDirectCombat?.pending||0;
    const activeStack=Array.isArray(game?.stack)&&game.stack.length
      ?String(game.stack[game.stack.length-1]?.name||'Spell on stack'):'';
    decisionText.textContent=handChoice
      ?((activeStack?activeStack+' · ':'')+
        (window.ctForgePriority?.handInstruction||'Choose cards · Press Confirm'))
      : pregame
      ? (openingMessage||'Keep your opening hand or take a mulligan.')
      : inAttack?'Choose attackers · tap glowing creatures':
        blockPriority?'Block declaration complete · pass priority to continue combat':
        inBlock?('Use Block Planner: choose an incoming attacker, then assign blockers. '+combatCount+' blocks confirmed'+
          (blockerNames.length?' · '+blockerNames.slice(0,3).join(', '):'')+
          (pendingAssignments?' · '+pendingAssignments+' processing…':'')):
        'Turn '+(game?.turn||1)+' · '+phaseText+
        ' · '+(game?.players?.[0]?.priority?'Your priority':'Respond / advance');
    const manaPayment=/^auto$/i.test(String(buttonState.label1).trim()) &&
      /^cancel$/i.test(String(buttonState.label2).trim());
    if(manaPayment && !buttonState.enable1 && !handChoice){
      decisionText.textContent='Pay mana: tap an untapped land or mana-producing artifact on your battlefield. '+
        'Auto becomes available when Sol Pod finds a valid payment.';
    }
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
      // Forge's Cancel button in InputAttack is either "Alpha Strike"
      // (declare every possible attacker) or "Call Back" (remove all).
      // It is never per-creature undo. InputBlock has no second action.
      const alpha=/alpha strike/i.test(original.trim());
      const callback=/call back|callback/i.test(original.trim());
      b.textContent=handChoice && ok?
          (/discard/i.test(String(openingMessage||'')+' '+String(promptMessage||''))?
            'Confirm discard':'Confirm cards'):
        !ok && inAttack && alpha?'Attack all':
        !ok && inAttack && callback?'Remove all attackers':
        ok && !pregame && ordinary && inAttack
          ? (combatCount?'Confirm '+combatCount+' attacker'+(combatCount===1?'':'s'):'No attacks'):
        ok && !pregame && ordinary && inBlock
          ? (combatCount?'Confirm '+combatCount+' block'+(combatCount===1?'':'s'):'Select blocker'):
        ok && !pregame && ordinary && blockPriority?'Pass priority':
        ok && !pregame && ordinary
          ? (stack.length?'Pass priority':window.app?.game?.active===0?'Next phase':'Pass'):
          original;
      if(inBlock&&!ok)continue; // no "End Turn" or stale cancel in blocker step
      b.setAttribute('aria-label',original+' — '+b.textContent);
      b.disabled=!enabled||busy||syncBusy||(inBlock&&ok&&combatCount===0)||((inBlock||inAttack)&&pendingAssignments>0);
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
    if(inBlock && (game?.combat||[]).some(a=>
      Number(a.defenderId)===Number(game?.players?.[0]?.forgeId))){
      const openPlanner=document.createElement('button');
      openPlanner.type='button';
      openPlanner.textContent='🛡 Block Planner';
      openPlanner.style.cssText='flex:1;min-height:38px;border-radius:9px;background:#29586a;color:#ffdfa3;border:2px solid #ddb678;font:800 12px system-ui';
      openPlanner.onclick=()=>window.ctCombatPlanner?.open?.();
      buttons.append(openPlanner);
    }
    // No blocks is a valid Forge choice, but it must be EXPLICIT: the
    // disabled Select blocker guide must never secretly confirm no blocks.
    if(inBlock&&!combatCount&&buttonState.enable1){
      const skip=document.createElement('button');
      skip.type='button';
      skip.textContent='Skip blocking';
      skip.setAttribute('aria-label','Declare no blockers and continue combat');
      skip.disabled=busy||syncBusy||pendingAssignments>0;
      skip.style.cssText='flex:1;min-height:36px;padding:6px 8px;border-radius:9px;border:1px solid #bda17d;background:#294452;color:#f4e3c9;font-size:13px;font-weight:700';
      skip.onclick=()=>decide(true);
      buttons.append(skip);
    }
    if(inBlock && window.ctDirectCombat?.needsRecovery){
      decisionText.textContent='Combat response timed out. Refresh the Sol Pod state and review blocks before confirming.';
      const recover=document.createElement('button');
      recover.type='button';
      recover.textContent='↻ Refresh combat';
      recover.disabled=syncBusy;
      recover.style.cssText='flex:1;min-height:38px;border-radius:9px;background:#3a6171;color:#fff4db;border:1px solid #eac088;font:700 13px system-ui';
      recover.onclick=()=>{void window.ctDirectCombat.recover();};
      buttons.append(recover);
    }
    if((handChoice || manaPayment) && !buttonState.enable1){
      const refresh=document.createElement('button');
      refresh.type='button';
      refresh.textContent=syncBusy?'Syncing…':(manaPayment?'Refresh mana':'Refresh choices');
      refresh.style.cssText='flex:1;min-height:36px;padding:6px 8px;'+
        'border-radius:9px;border:1px solid #8598a0;background:#294751;'+
        'color:#f1e8d7;font:700 12px system-ui';
      refresh.disabled=syncBusy;
      refresh.onclick=()=>{void syncChoices();};
      buttons.append(refresh);
    }
  }
  window.addEventListener('ct-combat-queue-updated',paintDecision);
  const firstReply=window.CommandTableNativeReply;
  window.CommandTableNativeReply=function(value){
    let payload;
    try{payload=typeof value==='string'?JSON.parse(value):value;}catch(_){}
    if(payload?.type==='game.prompt'){
      const p=payload.payload||{};
      if(typeof p.message==='string')openingMessage=p.message;
      promptSequence++;
      for(const key of ['label1','label2','enable1','enable2']){
        if(Object.prototype.hasOwnProperty.call(p,key))buttonState[key]=p[key];
      }
      paintDecision();
      // Required actions consume Forge's structured buttons, not Game Log text.
      if(typeof window.dispatchEvent==='function' && typeof CustomEvent!=='undefined')
        window.dispatchEvent(new CustomEvent('ct-forge-prompt-updated',{
          detail:{...buttonState,message:openingMessage}
        }));
      // Forge InputPayMana offers its Auto control only if its own
      // mana-payment solver can complete this cost. Never guess mana here.
      const auto=/^auto$/i.test(String(buttonState.label1).trim());
      if(!auto)autoManaIssued=false;
      if(auto && buttonState.enable1 && window.ctAutoMana!==false &&
         !autoManaIssued && window.app?.nativeMatch && !busy){
        autoManaIssued=true;
        Promise.resolve().then(()=>{if(!busy&&window.ctAutoMana!==false)void decide(true);});
      }
    }
    if(payload?.type==='game.state'){paintDecision();queueCombatLinks();}
    return typeof firstReply==='function'?firstReply(value):undefined;
  };
  window.ctForgePriority={
    reset:()=>{openingMessage='';buttonState.enable1=false;buttonState.enable2=false;paintDecision();},
    refresh:paintDecision,
    syncChoices,
    get canConfirm(){return !!buttonState.enable1&&!busy;},
    get hasActionableDecision(){return !!window.app?.nativeMatch &&
      (buttonState.enable1||buttonState.enable2) && !busy;},
    get isManaPayment(){return /^auto$/i.test(String(buttonState.label1).trim())&&
      /^cancel$/i.test(String(buttonState.label2).trim())&&window.app?.nativeMatch===true;},
    confirm:()=>decide(true),
    cancel:()=>decide(false),
    get buttonInfo(){return {...buttonState,message:openingMessage,prompt:promptMessage,busy,sequence:promptSequence};},
    // Distinguish Forge's mandatory hand-card choices from the ordinary
    // castable-card highlights shown during priority. Do not let the UI
    // mistake a discard for a request to cast.
    get isBottoming(){
      return window.app?.game?.phase==='mulligan' &&
        /\b(?:return|put)\b.*\bbottom\b.*\b(?:library|deck)\b/i
          .test(String(openingMessage||''));
    },
    get isHandChoice(){
      const player=window.app?.game?.players?.[0];
      if(!player || window.app?.view!=='game')return false;
      const handIds=new Set((player.handForgeIds||[]).map(Number));
      const matching=(selection.cards||[]).some(c=>handIds.has(Number(c.id)) && !c.actionable);
      const prompt=[openingMessage,promptMessage].filter(Boolean).join(' ');
      const explicit=/\bdiscard\b|\bbottom\b.*\blibrary\b|(?:choose|select|return|put)\b.*\b(?:cards?|hand)\b/i.test(prompt);
      const mandatory=Number(selection.min)>0 && Number(selection.max)>0;
      const choiceOpen=document.getElementById('ct-forge-decision-sheet')?.style.display==='flex';
      return !choiceOpen && (this.isBottoming || (matching && (mandatory || explicit)));
    },
    get handInstruction(){
      const prompt=[promptMessage,openingMessage].find(s=>/discard|bottom|choose|select/i.test(String(s||'')))||'';
      const needed=Number(selection.min||0),chosen=(selection.chosen||[]).length;
      if(needed>0)return (/\bdiscard\b/i.test(prompt)?'Discard':'Choose')+' '+needed+
        ' card'+(needed===1?'':'s')+' · '+chosen+' selected · Press OK';
      return this.isBottoming?'Tap cards to bottom · Press OK':'Tap glowing cards to select · Press OK';
    }
  };

  const appRoot=document.getElementById('app');
  if(appRoot) {
    new MutationObserver(()=>{
      if(selection.cards?.length||selection.targets?.length)highlight();
      paintDecision(); // Close behind full-screen card inspector / hand browser.
      queueCombatLinks();
    })
      .observe(appRoot,{childList:true,subtree:false});
  }
  window.ctForgeSelection={
    reset:()=>{selection={cards:[],targets:[],chosen:[]};expanded=false;promptMessage='';update();queueCombatLinks();},
    refresh:()=>{update();},
    isLegalCard:(id)=>Number.isInteger(Number(id))&&
      candidates().some(c=>c.kind==='card'&&Number(c.id)===Number(id)),
    // Zone browsers use the same guarded dispatcher as battlefield and stack
    // targets. A visible card never becomes legal just because it is displayed.
    chooseCard:(id)=>select({kind:'card',id:Number(id)}),
    choosePlayer:(id)=>select({kind:'player',id:Number(id)}),
    chooseStack:(id)=>select({kind:'stack',id:Number(id)}),
    isLegalStack:(id)=>Number.isInteger(Number(id))&&
      candidates().some(c=>c.kind==='stack'&&Number(c.id)===Number(id)),
    isLegalPlayer:(id)=>Number.isInteger(Number(id)) &&
      (selection.targets||[]).some(c=>c.kind==='player'&&Number(c.id)===Number(id)),
    get version(){return selectionVersion;},
    get legalTargets(){return selection.targets||[];},
    get chosenIds(){return selection.chosen||[];},
    isSelectedCard:(id)=>Number.isInteger(Number(id))&&
      (selection.chosen||[]).some(c=>Number(c)===Number(id)),
    get legalCards(){return candidates().filter(c=>c.kind==='card');},
    get selectionInfo(){return {...selection};},
    isRequiredSelection:(item)=>isRequiredSelection(item),
    get prompt(){return promptMessage;},
    get active(){return candidates().length>0;}
  };
})();
