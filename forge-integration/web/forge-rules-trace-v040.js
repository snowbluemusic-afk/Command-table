/* Sol Pod v0.40: observational Forge diagnostics, NOT a replacement rules engine.
 * This trace records public-state transitions and native choices. Library
 * contents and opponent hand identities are never examined or copied.
 */
(() => {
  'use strict';
  if(window.ctRulesTrace)return;
  const MAX=600;
  let entries=[],previous=null,sequence=0,seenMatch=false;
  const now=()=>new Date().toISOString();
  const num=v=>Number.isFinite(Number(v))?Number(v):0;
  const name=p=>String(p?.name||p?.id||'Player');
  const stackName=v=>String(v?.cardName||v?.name||'Spell/ability');
  function push(kind,message,details={}){
    entries.push({seq:++sequence,time:now(),kind,message,...details});
    if(entries.length>MAX)entries.splice(0,entries.length-MAX);
  }
  function playerList(snapshot){
    return (Array.isArray(snapshot?.players)?snapshot.players:[]).map(p=>({
      id:String(p.id),name:name(p),
      library:num(p.libraryCount),
      graveyard:Array.isArray(p.graveyard)?p.graveyard.length:0,
      exile:Array.isArray(p.exile)?p.exile.length:0,
      battlefield:Array.isArray(p.battlefield)?p.battlefield.length:0,
      battlefieldIds:(p.battlefield||[]).map(c=>String(c.id)),
      hand:num(p.handCount),life:num(p.life),lost:!!p.hasLost,
      commanderDamage:p.commanderDamage||{}
    }));
  }
  function stackList(snapshot){
    return (Array.isArray(snapshot?.stack)?snapshot.stack:[]).map(s=>({
      id:String(s.id),name:stackName(s),controller:String(s.controllerName||''),
      type:s.trigger?'triggered ability':s.ability?'activated ability':'spell',
      targets:(s.targets||[]).map(t=>String(t?.name||t?.kind||'Target'))
    }));
  }
  function counts(p){
    return {library:p.library,graveyard:p.graveyard,exile:p.exile,
      battlefield:p.battlefield,hand:p.hand,life:p.life};
  }
  function capture(snapshot){
    if(!snapshot?.players||!Array.isArray(snapshot.players))return;
    const players=playerList(snapshot),stack=stackList(snapshot);
    const current={
      turn:num(snapshot.turn),phase:String(snapshot.phase||''),
      players,stack,gameOver:!!snapshot.gameOver,
      winner:String(snapshot.winner||'')
    };
    if(!previous){
      push('snapshot','Forge game snapshot received',{turn:current.turn,phase:current.phase,
        players:players.map(p=>({name:p.name,counts:counts(p)}))});
      previous=current;seenMatch=true;return;
    }
    if(current.turn<previous.turn || (current.turn<=1 && previous.turn>1)){
      push('match-reset','New match detected');previous=null;capture(snapshot);return;
    }
    if(current.turn!==previous.turn||current.phase!==previous.phase)
      push('phase','Turn/phase changed',{from:{turn:previous.turn,phase:previous.phase},
        to:{turn:current.turn,phase:current.phase}});
    for(const p of players){
      const old=previous.players.find(x=>x.id===p.id);
      if(!old){
        push('seat','Player appeared in Forge state',{player:p.name,counts:counts(p)});
        continue;
      }
      for(const k of ['library','graveyard','exile','battlefield','hand','life']){
        if(p[k]!==old[k])push('zone',p.name+' · '+k+' '+old[k]+' → '+p[k],
          {player:p.name,zone:k,from:old[k],to:p[k],delta:p[k]-old[k]});
      }
      if(!old.lost&&p.lost)push('elimination',p.name+' has lost according to Forge',
        {player:p.name});
      const oldDamage=old.commanderDamage||{},newDamage=p.commanderDamage||{};
      for(const commander of new Set([...Object.keys(oldDamage),...Object.keys(newDamage)])){
        if(num(oldDamage[commander])!==num(newDamage[commander]))
          push('commander-damage',p.name+' · '+commander+' damage '+num(oldDamage[commander])+
            ' → '+num(newDamage[commander]),{player:p.name,commander});
      }
      const oldIds=new Set(old.battlefieldIds),newIds=new Set(p.battlefieldIds);
      const arrived=[...newIds].filter(id=>!oldIds.has(id));
      const gone=[...oldIds].filter(id=>!newIds.has(id));
      if(arrived.length||gone.length)
        push('battlefield','Battlefield object IDs changed',{player:p.name,
          enteredIds:arrived.slice(0,30),leftIds:gone.slice(0,30),
          enteredTotal:arrived.length,leftTotal:gone.length});
    }
    const prevStack=new Map(previous.stack.map(x=>[x.id,x]));
    const nextStack=new Map(stack.map(x=>[x.id,x]));
    for(const [id,item] of nextStack)
      if(!prevStack.has(id))push('stack-enter','On stack: '+item.name,{item});
    for(const [id,item] of prevStack)
      if(!nextStack.has(id))push('stack-leave','Left stack: '+item.name,
        {item,note:'Leaving the stack alone does NOT prove it resolved, was countered or was copied.'});
    if(current.gameOver&&!previous.gameOver)
      push('game-over','Forge declared game over',{winner:current.winner});
    previous=current;
  }
  function notice(value){
    const data=typeof value==='string'?JSON.parse(value):value;
    if(!data?.type)return;
    const type=data.type,p=data.payload||{};
    if(type==='game.selection'){
      const targets=Array.isArray(p.targets)?p.targets:[];
      // Selection does not guarantee a trigger resolved; it is an engine
      // instruction to pick one of these targets.
      const fingerprint=JSON.stringify(targets.map(t=>[t.kind,t.id]));
      if(fingerprint!==notice.lastTargets){
        push('target-choice','Forge targets offered',{targets:targets.map(t=>({
          kind:t.kind,id:t.id,label:t.label,zone:t.zone
        })),chosen:p.chosen||[]});
        notice.lastTargets=fingerprint;
      }
    }else if(type==='game.choice'){
      push('choice','Forge choice: '+String(p.title||'Make a choice'),
        {id:p.id,mode:p.mode,min:p.min,max:p.max,
          options:(p.options||[]).slice(0,35).map(x=>String(x.label||''))});
    }else if(type==='game.choice.clear'){
      push('choice-clear','Forge choice completed/cleared',{id:p.choiceId||p.id});
    }else if(type==='game.notice'){
      const msg=String(p.message||'');
      if(msg)push('forge-notice',msg.slice(0,450));
    }
  }
  const before=window.CommandTableNativeReply;
  window.CommandTableNativeReply=function(payload){
    try {notice(payload);}catch(_){}
    const result=typeof before==='function'?before(payload):undefined;
    try {
      const message=typeof payload==='string'?JSON.parse(payload):payload;
      if(message?.type==='game.choice'||message?.type==='game.choice.clear')
        window.ctFullscreenTargets?.refresh?.();
    }catch(_){}
    return result;
  };
  // CommandTableNative is a top-level lexical const in the generated Android
  // HTML and is not necessarily exposed as window.CommandTableNative.
  const engine=()=>typeof CommandTableNative!=='undefined'?CommandTableNative:window.CommandTableNative;
  engine()?.onState?.(capture);
  function report(){
    const header=['Sol Pod Forge rules trace','Observer only — never proof that a trigger fired.',
      'Native Forge is the rules authority. All changes are observed GameView snapshots.',
      'Snapshots between events may be missed; do not infer card-rule correctness from counts.',
      'Opponent hidden hand and library contents are omitted.',
      ''];
    return header.join('\n')+entries.map(e=>JSON.stringify(e)).join('\n');
  }
  async function copy(){
    try{
      const snapshot=await engine()?.request?.('game.snapshot');
      if(snapshot?.game)capture(snapshot.game);
    }catch(e){push('sync-warning','Could not refresh final Forge snapshot: '+String(e?.message||e));}
    const text=report();
    try{
      if(window.AndroidBridge?.copyText)window.AndroidBridge.copyText(text);
      else if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(text);
      else throw new Error('Clipboard not accessible');
      window.solPodNotice?.('Rules trace copied. Include it with the screenshots when reporting a mechanic.','info','rules-trace');
      return true;
    }catch(err){
      window.solPodNotice?.('Could not copy the rules trace: '+String(err?.message||err),'info','rules-trace');
      return false;
    }
  }
  document.addEventListener('click',event=>{
    const control=event.target?.closest?.('[data-action="ctCopyRulesTrace"]');
    if(!control)return;
    event.preventDefault();event.stopImmediatePropagation();
    void copy();
  },true);
  window.ctRulesTrace={
    capture,copy,report,
    get events(){return entries.slice();},
    reset(){entries=[];previous=null;sequence=0;seenMatch=false;notice.lastTargets=null;}
  };
})();