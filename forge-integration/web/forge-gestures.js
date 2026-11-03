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
  let selectedBlocker=null;
  let queued=0;
  let commandQueue=Promise.resolve();
  let unresolved=false;
  const nativeDeadline=(promise,label,ms=18000)=>new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{const err=new Error(label+' did not respond; resynchronise Forge before confirming combat.');err.nativeTimeout=true;reject(err);},ms);
    Promise.resolve(promise).then(value=>{clearTimeout(timer);resolve(value);},err=>{clearTimeout(timer);reject(err);});
  });
  let suppressUntil=0;
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
    if(mode()==='block' && typeof window.solPodNotice==='function')
      window.solPodNotice(msg,/\berror\b|\bfailed\b|\brejected\b|did not respond|cannot|could not/i.test(String(msg))?'error':'combat',/\berror\b|\bfailed\b|\brejected\b|did not respond|cannot|could not/i.test(String(msg))?'blocker-error':'blocker-selection');
    else if(typeof window.ctNativeToast==='function')window.ctNativeToast(msg);
    else if(typeof window.announce==='function')window.announce(msg);
  };
  const showSelectedBlocker=()=>{
    document.querySelectorAll('.ct-block-source-selected').forEach(el=>el.classList.remove('ct-block-source-selected'));
    if(mode()!=='block'||!selectedBlocker)return;
    for(const el of document.querySelectorAll('.ct10-lane-own.ct10-creatures .game-card[data-value]')){
      if(idFromCard(el)===selectedBlocker)el.classList.add('ct-block-source-selected');
    }
  };
  const notify=(text)=>{
    // Fixed right-side guidance rather than a message following the finger.
    if(window.solPodNotice)window.solPodNotice(text,'combat');
    else {hint.textContent=text;hint.style.display='block';}
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
  // Queue every deliberate drag. Previously, the second quick drag was silently
  // dropped while the first native command was processing.
  const selectSourceAndTarget=(sourceId,target,dragMode)=>{
    queued++;
    const task=async()=>{
      busy=true;
      try {
        if(unresolved){
          feedback('Combat has an unanswered Forge request. Use Refresh combat before making more assignments.');
          return;
        }
        if(mode()!==dragMode){
          feedback('Combat moved on before your '+dragMode+' could be assigned.');
          return;
        }
        const action=dragMode==='attack'?'combat.attack':'combat.block';
        const value=dragMode==='attack'
          ? {attackerId:sourceId,defenderId:target.id}
          : {attackerId:target.id,blockerId:sourceId};
        // Dragging an already assigned blocker must not unassign it by accident.
        if(dragMode==='block'&&window.app?.game?.combat?.some(c=>
          Number(c.cardId)===target.id&&(c.blockerIds||[]).some(id=>Number(id)===sourceId))){
          feedback('This creature is already blocking that attacker.');
          return;
        }
        await nativeDeadline(window.CommandTableNative.request('game.command',{action,value}),
          'Combat assignment',18000);
        let snapshot=null,confirmed=false;
        // A command can return before Forge publishes the updated CombatView.
        for(let attempt=0;attempt<4;attempt++){
          snapshot=await nativeDeadline(window.CommandTableNative.request('game.snapshot'),
            'Combat snapshot',10000).catch(()=>null);
          const combat=snapshot?.game?.combat||[];
          if(dragMode==='block'){
            confirmed=combat.some(c=>Number(c.cardId)===target.id&&
              (c.blockerIds||[]).some(id=>Number(id)===sourceId));
          }else{
            confirmed=combat.some(c=>Number(c.cardId)===sourceId&&
              Number(c.defenderId)===target.id);
          }
          if(confirmed)break;
          await new Promise(done=>setTimeout(done,110));
        }
        if(snapshot?.game&&typeof window.ctReceiveForgeState==='function')
          window.ctReceiveForgeState(snapshot.game);
        if(!confirmed){
          feedback('Forge did not confirm that '+(dragMode==='block'?'blocker':'attacker')+
            '. Check the highlighted combat connection before pressing Confirm.');
        }else if(dragMode==='block'){
          const count=(snapshot?.game?.combat||[]).reduce((sum,c)=>sum+(c.blockerIds||[]).length,0);
          feedback('Block confirmed: '+count+' assigned. Select another blocker or confirm.');
        }
      }catch(error){
        if(error?.nativeTimeout)unresolved=true;
        feedback('Forge could not apply this '+(dragMode==='attack'?'attack':'block')+
          ': '+(error?.message||String(error)));
      }finally{
        busy=false;queued--;
        if(typeof window.dispatchEvent==='function'&&typeof window.Event==='function')
          window.dispatchEvent(new window.Event('ct-combat-queue-updated'));
      }
    };
    commandQueue=commandQueue.catch(()=>{}).then(task);
    if(typeof window.dispatchEvent==='function'&&typeof window.Event==='function')
          window.dispatchEvent(new window.Event('ct-combat-queue-updated'));
    return commandQueue;
  };
  // Candidate highlights are advisory; a transient empty Selection from
  // Forge is NOT proof that a creature cannot attack or block.
  function isOwnCreature(id){
    return window.app?.game?.players?.[0]?.battlefield?.some(c=>
      Number(c.forgeId)===Number(id)&&c.creature===true)===true;
  }
  document.addEventListener('pointerdown',event=>{
    if(event.button!==0||!window.app?.nativeMatch||window.app?.view!=='game'||
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
    if(event.cancelable)event.preventDefault();
    event.stopImmediatePropagation();
    suppressClick=state.el;
    suppressUntil=Date.now()+750;
    setTimeout(()=>{if(suppressClick===state.el)suppressClick=null;},750);
    if(!target) {
      feedback(state.kind==='attack'?'Drop on an opponent to declare the attack.':
        'Drop on an attacking creature to declare a block.');
      return;
    }
    void selectSourceAndTarget(state.sourceId,target,state.kind);
  },true);
  document.addEventListener('pointercancel',clear,true);
  document.addEventListener('click',event=>{
    if(!suppressClick||Date.now()>suppressUntil)return;
    // Touch browsers may synthesize click on the drop target rather than source.
    // Consume only the immediate post-drag click, never a later deliberate tap.
    event.preventDefault();
    event.stopImmediatePropagation();
    suppressClick=null;
  },true);
  // Player-facing flow: select YOUR blocker, then select the incoming
  // attacker that it will block. Send exactly one atomic combat.block request
  // to Forge, whose InputBlock still receives attacker before blocker.
  document.addEventListener('click',event=>{
    if(!window.app?.nativeMatch||window.app?.view!=='game'||window.app?.modal)return;
    const kind=mode();
    if(!kind){selectedBlocker=null;showSelectedBlocker();return;}
    const own=event.target.closest('.ct10-lane-own.ct10-creatures .game-card[data-value]');
    const opponent=event.target.closest('.ct10-lane-opp.ct10-creatures .game-card[data-value]');
    const player=event.target.closest('[data-ct-forge-player-id]');
    if(kind==='block'){
      const attacks=window.app?.game?.combat||[];
      if(own){
        const id=idFromCard(own);
        if(!isOwnCreature(id))return;
        event.preventDefault();event.stopImmediatePropagation();
        if(unresolved){
          feedback('Refresh combat first: Forge has not confirmed an earlier assignment.');
          return;
        }
        selectedBlocker=id===selectedBlocker?null:id;
        showSelectedBlocker();
        feedback(selectedBlocker?
          'Blocker selected. Tap the attacking creature you want it to block.':
          'Blocker selection cleared. Tap your blocker to begin.');
        return;
      }
      if(opponent){
        const id=idFromCard(opponent);
        if(!attacks.some(c=>Number(c.cardId)===id))return;
        // Prevent the opponent card's ordinary inspector/Forge click from
        // consuming one of the two taps and changing the game unexpectedly.
        event.preventDefault();event.stopImmediatePropagation();
        if(!selectedBlocker){
          feedback('First tap one of YOUR creatures to select a blocker, then tap this attacker.');
          return;
        }
        if(unresolved){
          feedback('Refresh combat first: Forge has not confirmed an earlier assignment.');
          return;
        }
        const blockerId=selectedBlocker;
        selectedBlocker=null;
        showSelectedBlocker();
        void selectSourceAndTarget(blockerId,{kind:'card',id},'block');
        return;
      }
      return;
    }
    // Attack taps still use Forge's natural selectPlayer / selectCard route.
    // Serialize quick taps rather than dropping a second tap while busy.
    let command=null;
    if(player){
      const playerId=Number(player.getAttribute('data-ct-forge-player-id'));
      const ownId=Number(window.app?.game?.players?.[0]?.forgeId);
      if(Number.isInteger(playerId)&&playerId>0&&playerId!==ownId)
        command={action:'selectPlayer',value:playerId};
    }else if(own && isOwnCreature(idFromCard(own))){
      command={action:'cardId',value:idFromCard(own)};
    }
    if(!command)return;
    event.preventDefault();event.stopImmediatePropagation();
    queued++;
    commandQueue=commandQueue.catch(()=>{}).then(async()=>{
      busy=true;
      try{
        await window.CommandTableNative.request('game.command',command);
        const snapshot=await window.CommandTableNative.request('game.snapshot').catch(()=>null);
        if(snapshot?.game)window.ctReceiveForgeState?.(snapshot.game);
      }catch(error){
        feedback('Forge rejected your attack selection: '+(error?.message||String(error)));
      }finally{
        queued--;busy=false;
        if(typeof window.dispatchEvent==='function'&&typeof window.Event==='function')
          window.dispatchEvent(new window.Event('ct-combat-queue-updated'));
      }
    });
  },true);
  window.addEventListener?.('ct-combat-queue-updated',()=>{
    if(mode()!=='block')selectedBlocker=null;
    showSelectedBlocker();
  });
  // A Forge state update can replace all card elements; keep the chosen
  // blocker visibly selected until the next attacker tap.
  const boardRoot=document.getElementById('app');
  if(boardRoot&&typeof MutationObserver!=='undefined')
    new MutationObserver(showSelectedBlocker).observe(boardRoot,{childList:true,subtree:false});
  const style=document.createElement('style');
  style.id='ct-direct-combat-style';
  style.textContent=`
    .ct-direct-drag-hover{outline:4px solid #ffca69!important;box-shadow:0 0 20px #f1bd5fb5!important}
    .ct-block-source-selected{outline:4px solid #6ee3ff!important;box-shadow:0 0 19px #4cc7f9!important;filter:brightness(1.16)!important}
    .ct10-lane-own.ct10-creatures .game-card{touch-action:none}
    [data-ct-forge-player-id].ct-forge-legal-player{outline:3px solid #60d5f8!important;box-shadow:0 0 18px #48c9f890!important}
    @media (orientation:landscape) and (max-height:550px){
      #ct-direct-combat-hint{font-size:11px;top:8%}
    }`;
  document.head.append(style);
  window.ctDirectCombat={
    reset:()=>{clear();selectedBlocker=null;unresolved=false;showSelectedBlocker();},
    get active(){return !!drag||busy||queued>0;},
    get selectedBlockerId(){return selectedBlocker;},
    get needsRecovery(){return unresolved;},
    get pending(){return queued+(unresolved?1:0);},
    whenIdle:()=>commandQueue.catch(()=>{}),
    recover:async()=>{
      try{
        const status=await nativeDeadline(window.CommandTableNative.request('engine.status'),'Forge status',12000);
        const result=await nativeDeadline(window.CommandTableNative.request('game.snapshot'),'Forge snapshot',12000);
        if(!result?.game)throw new Error('Forge did not return a game snapshot');
        window.ctReceiveForgeState?.(result.game);
        unresolved=false;
        feedback('Combat resynchronised. Review the displayed blocks before confirming.');
        window.dispatchEvent?.(new window.Event('ct-combat-queue-updated'));
        return true;
      }catch(error){
        feedback('Combat still unavailable: '+(error?.message||String(error)));
        return false;
      }
    }
  };
})();
