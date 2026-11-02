/* Arena-like direct combat gestures.
 * These gestures ONLY translate input into Forge controller selections.
 * No attacking/blocking legality or combat damage is computed here.
 */
(() => {
  'use strict';
  const ns='http://www.w3.org/2000/svg';
  const hud=document.createElementNS(ns,'svg');
  hud.id='ct-direct-combat-gesture';
  hud.setAttribute('aria-hidden','true');
  hud.style.cssText='position:fixed;inset:0;width:100vw;height:100dvh;z-index:220000;pointer-events:none;overflow:visible';
  const arrow=document.createElementNS(ns,'path');
  arrow.setAttribute('fill','none');
  arrow.setAttribute('stroke','#f8c06c');
  arrow.setAttribute('stroke-width','4');
  arrow.setAttribute('stroke-linecap','round');
  arrow.style.filter='drop-shadow(0 0 7px #ffcf7b)';
  hud.append(arrow);
  hud.style.display='none';
  document.body.append(hud);
  const hint=document.createElement('div');
  hint.id='ct-direct-combat-hint';
  hint.setAttribute('role','status');
  hint.style.cssText='position:fixed;z-index:220001;left:50%;top:13%;transform:translateX(-50%);background:#112932f0;color:#ffe6af;border:1px solid #c9ab76;border-radius:9px;padding:7px 12px;font:700 12px system-ui;pointer-events:none;display:none;max-width:60vw;text-align:center';
  document.body.append(hint);
  let drag=null, suppressClick=null, busy=false;
  const phase=()=>String(window.app?.game?.phaseDetail||'').toUpperCase();
  const mode=()=>/ATTACKERS/.test(phase())?'attack':
                 /BLOCKERS/.test(phase())?'block':null;
  const idFromCard=el=>{
    if(!el)return null;
    const raw=String(el.getAttribute('data-value')||'');
    const id=Number(raw.split(':').at(-1));
    return Number.isInteger(id)&&id>0?id:null;
  };
  const feedback=msg=>{
    if(typeof window.ctNativeToast==='function')window.ctNativeToast(msg);
    else if(typeof window.announce==='function')window.announce(msg);
  };
  const notify=(text,x,y)=>{
    hint.textContent=text;
    hint.style.display='block';
    hint.style.left=Math.max(120,Math.min(innerWidth-120,x))+'px';
    hint.style.top=Math.max(30,Math.min(innerHeight-70,y-65))+'px';
  };
  const clear=()=>{
    drag=null;
    hud.style.display='none';
    hint.style.display='none';
    document.querySelectorAll('.ct-direct-drag-hover').forEach(el=>el.classList.remove('ct-direct-drag-hover'));
  };
  const targetAt=(x,y,kind)=>{
    const el=document.elementFromPoint(x,y);
    if(!el)return null;
    if(kind==='attack'){
      const player=el.closest('[data-ct-forge-player-id]');
      const id=Number(player?.getAttribute('data-ct-forge-player-id'));
      const own=Number(window.app?.game?.players?.[0]?.forgeId);
      if(!Number.isInteger(id)||id<=0||id===own)return null;
      return {kind:'player',id,element:player};
    }
    if(kind==='block'){
      const card=el.closest('.ct10-lane-opp.ct10-creatures .game-card[data-value],.ct-pod-mini-board .game-card[data-value]');
      const id=idFromCard(card);
      if(id==null||!window.app?.game?.combat?.some(c=>Number(c.cardId)===id))return null;
      return {kind:'card',id,element:card};
    }
    return null;
  };
  // One gesture is one atomic Forge command. Forge's InputAttack/InputBlock
  // expects defender-before-attacker and attacker-before-blocker respectively.
  const selectSourceAndTarget=async (sourceId,target,dragMode)=>{
    if(busy)return;
    busy=true;
    try {
      const action=dragMode==='attack'?'combat.attack':'combat.block';
      const value=dragMode==='attack'
        ? {attackerId:sourceId,defenderId:target.id}
        : {attackerId:target.id,blockerId:sourceId};
      await window.CommandTableNative.request('game.command',{action,value});
      const snapshot=await window.CommandTableNative.request('game.snapshot').catch(()=>null);
      if(snapshot?.game&&typeof window.ctReceiveForgeState==='function')
        window.ctReceiveForgeState(snapshot.game);
    }catch(error){
      feedback('Forge could not apply this '+(dragMode==='attack'?'attack':'block')+
        ': '+(error?.message||String(error)));
    }finally{busy=false;}
  };
  // Candidate highlights are advisory; a transient empty Selection from
  // Forge is NOT proof that a creature cannot attack or block.
  function isOwnCreature(id){
    return window.app?.game?.players?.[0]?.battlefield?.some(c=>
      Number(c.forgeId)===Number(id)&&c.creature===true)===true;
  }
  document.addEventListener('pointerdown',event=>{
    if(busy||event.button!==0||!window.app?.nativeMatch||window.app?.view!=='game'||
       window.app?.game?.winner!==null||window.app?.modal)return;
    const kind=mode();
    if(!kind)return;
    const card=event.target.closest('.ct10-lane-own.ct10-creatures .game-card[data-value]');
    const id=idFromCard(card);
    if(id==null||!isOwnCreature(id))return;
    drag={pointerId:event.pointerId,sourceId:id,el:card,x:event.clientX,y:event.clientY,kind,moving:false};
  },true);
  document.addEventListener('pointermove',event=>{
    if(!drag||drag.pointerId!==event.pointerId)return;
    const distance=Math.hypot(event.clientX-drag.x,event.clientY-drag.y);
    if(!drag.moving&&distance<20)return;
    drag.moving=true;
    if(event.cancelable)event.preventDefault();
    hud.style.display='block';
    arrow.setAttribute('d',`M ${drag.x} ${drag.y} Q ${(drag.x+event.clientX)/2} ${Math.min(drag.y,event.clientY)-30} ${event.clientX} ${event.clientY}`);
    const target=targetAt(event.clientX,event.clientY,drag.kind);
    document.querySelectorAll('.ct-direct-drag-hover').forEach(el=>el.classList.remove('ct-direct-drag-hover'));
    target?.element?.classList.add('ct-direct-drag-hover');
    notify(target?(drag.kind==='attack'?'Attack this opponent':'Block this attacker'):
      (drag.kind==='attack'?'Drag to an opponent to attack':'Drag to an attacking creature to block'),
      event.clientX,event.clientY);
  },{capture:true,passive:false});
  document.addEventListener('pointerup',event=>{
    if(!drag||drag.pointerId!==event.pointerId)return;
    const state=drag;
    const target=state.moving?targetAt(event.clientX,event.clientY,state.kind):null;
    clear();
    if(!state.moving)return; // Ordinary tap keeps its native Forge behavior.
    suppressClick=state.el;
    setTimeout(()=>{if(suppressClick===state.el)suppressClick=null;},220);
    if(!target) {
      feedback(state.kind==='attack'?'Drop on an opponent to declare the attack.':
        'Drop on an attacking creature to declare a block.');
      return;
    }
    void selectSourceAndTarget(state.sourceId,target,state.kind);
  },true);
  document.addEventListener('pointercancel',clear,true);
  document.addEventListener('click',event=>{
    if(!suppressClick)return;
    // Touch browsers may synthesize click on the drop target rather than source.
    // Consume only the immediate post-drag click, never a later deliberate tap.
    event.preventDefault();
    event.stopImmediatePropagation();
    suppressClick=null;
  },true);
  // Direct taps never open a card inspector during a declaration step.
  // A tap on an attacker selects which attacker to block; a subsequent
  // tap on a blocker assigns it to THAT attacker, matching Forge InputBlock.
  document.addEventListener('click',event=>{
    if(busy||!window.app?.nativeMatch||window.app?.view!=='game'||window.app?.modal)return;
    const kind=mode();
    if(!kind)return;
    const own=event.target.closest('.ct10-lane-own.ct10-creatures .game-card[data-value]');
    const opponent=event.target.closest('.ct10-lane-opp.ct10-creatures .game-card[data-value]');
    const player=event.target.closest('[data-ct-forge-player-id]');
    let command=null;
    if(kind==='attack'&&player) {
      const playerId=Number(player.getAttribute('data-ct-forge-player-id'));
      const ownId=Number(window.app?.game?.players?.[0]?.forgeId);
      if(Number.isInteger(playerId)&&playerId>0&&playerId!==ownId)
        command={action:'selectPlayer',value:playerId};
    } else if(kind==='attack'&&own&&isOwnCreature(idFromCard(own))) {
      command={action:'cardId',value:idFromCard(own)};
    } else if(kind==='block'&&opponent) {
      const cardId=idFromCard(opponent);
      if(window.app?.game?.combat?.some(c=>Number(c.cardId)===cardId))
        command={action:'cardId',value:cardId};
    } else if(kind==='block'&&own&&isOwnCreature(idFromCard(own))) {
      command={action:'cardId',value:idFromCard(own)};
    }
    if(!command)return;
    event.preventDefault();event.stopImmediatePropagation();
    busy=true;
    void window.CommandTableNative.request('game.command',command)
      .then(async()=>{
        const snapshot=await window.CommandTableNative.request('game.snapshot').catch(()=>null);
        if(snapshot?.game&&typeof window.ctReceiveForgeState==='function')
          window.ctReceiveForgeState(snapshot.game);
      })
      .catch(error=>feedback('Forge rejected your selection: '+(error?.message||String(error))))
      .finally(()=>{busy=false;});
  },true);
  const style=document.createElement('style');
  style.id='ct-direct-combat-style';
  style.textContent=`
    .ct-direct-drag-hover{outline:4px solid #ffca69!important;box-shadow:0 0 20px #f1bd5fb5!important}
    .ct10-lane-own.ct10-creatures .game-card.ct-forge-legal-target{touch-action:none}
    [data-ct-forge-player-id].ct-forge-legal-player{outline:3px solid #60d5f8!important;box-shadow:0 0 18px #48c9f890!important}
    @media (orientation:landscape) and (max-height:550px){
      #ct-direct-combat-hint{font-size:11px;top:8%}
    }`;
  document.head.append(style);
  window.ctDirectCombat={reset:clear,get active(){return !!drag||busy;}};
})();
