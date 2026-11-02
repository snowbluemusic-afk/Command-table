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
  const selectSourceAndTarget=async (sourceId,target,dragMode)=>{
    if(busy)return;
    busy=true;
    const base=window.ctForgeSelection?.version??0;
    let stop=null, timeout=null;
    let targetChosen=false;
    const eligible=items=>Array.isArray(items)&&items.some(item=>
      item.kind===target.kind&&Number(item.id)===target.id);
    const ready=new Promise(resolve=>{
      stop=event=>{
        const payload=event?.detail||{};
        if(Number(payload.version)<=base)return;
        if(eligible(payload.targets)||eligible(payload.cards))resolve(true);
      };
      window.addEventListener('ct-forge-selection',stop);
      timeout=setTimeout(()=>resolve(false),1300);
    });
    try {
      await window.CommandTableNative.request('game.command',{action:'cardId',value:sourceId});
      if(await ready) {
        await window.CommandTableNative.request('game.command',{
          action:target.kind==='player'?'selectPlayer':'cardId',value:target.id
        });
        targetChosen=true;
        const snapshot=await window.CommandTableNative.request('game.snapshot').catch(()=>null);
        if(snapshot?.game&&typeof window.ctReceiveForgeState==='function')
          window.ctReceiveForgeState(snapshot.game);
      } else {
        feedback(dragMode==='attack'?'Attacker selected. Choose the glowing defending player.':
          'Blocker selected. Choose the glowing attacker.');
      }
    } catch(error) {
      feedback('Forge could not apply this combat choice: '+(error?.message||String(error)));
    } finally {
      if(stop)window.removeEventListener('ct-forge-selection',stop);
      if(timeout!==null)clearTimeout(timeout);
      busy=false;
    }
    return targetChosen;
  };
  document.addEventListener('pointerdown',event=>{
    if(busy||event.button!==0||!window.app?.nativeMatch||window.app?.view!=='game'||
       window.app?.game?.winner!==null||window.app?.modal||window.app?.sideInspect)return;
    const kind=mode();
    if(!kind)return;
    const card=event.target.closest('.ct10-lane-own.ct10-creatures .game-card[data-value]');
    const id=idFromCard(card);
    if(id==null||!window.ctForgeSelection?.isLegalCard?.(id))return;
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
  // Tapping a glowing player in combat chooses that player in Forge rather
  // than opening the legacy inspect-player screen. Works in 1v1 and pods.
  document.addEventListener('click',event=>{
    if(busy||!window.app?.nativeMatch||window.app?.view!=='game'||window.app?.modal)return;
    const marker=event.target.closest('[data-ct-forge-player-id]');
    const playerId=Number(marker?.getAttribute('data-ct-forge-player-id'));
    if(!marker||!window.ctForgeSelection?.isLegalPlayer?.(playerId))return;
    event.preventDefault();
    event.stopImmediatePropagation();
    busy=true;
    void window.CommandTableNative.request('game.command',{
      action:'selectPlayer',value:playerId
    }).catch(error=>{
      feedback('Forge rejected the defending player: '+(error?.message||String(error)));
    }).finally(()=>{busy=false;});
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
