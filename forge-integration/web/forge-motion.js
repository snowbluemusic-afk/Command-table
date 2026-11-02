/* Render animation ONLY after the authoritative Forge GameView changes. */
(() => {
  'use strict';
  const style=document.createElement('style');
  style.id='ct-motion-v018';
  style.textContent=[
    '.ct10-lane .game-card.ct-card-enter{animation:ct-card-enter .38s cubic-bezier(.2,.8,.3,1.15)!important}',
    '.ct10-lane .game-card.ct-card-tap{animation:ct-card-tap .38s ease-out!important}',
    '.ct10-phase-badge.ct-turn-pulse{animation:ct-turn-pulse .7s ease-out!important}',
    '.ct-native-stack.ct-stack-pulse{animation:ct-stack-pulse .4s ease-out!important}',
    '.ct-float-life{position:fixed;z-index:215000;pointer-events:none;font:bold 23px system-ui;',
    'color:#ffad88;text-shadow:0 3px 8px #061219;animation:ct-float-life 1.2s ease-out forwards}',
    '.ct-float-life.gain{color:#86edac}',
    '@keyframes ct-card-enter{from{opacity:.4;transform:translateY(-25px) scale(.78);filter:brightness(1.8)}',
    'to{opacity:1;transform:translateY(0) scale(1);filter:brightness(1)}}',
    '@keyframes ct-card-tap{from{filter:brightness(1.9)}to{filter:brightness(1)}}',
    '@keyframes ct-turn-pulse{0%,100%{box-shadow:0 0 0 #e8b97100}50%{box-shadow:0 0 30px #e8b971b5}}',
    '@keyframes ct-stack-pulse{from{opacity:.4;transform:translateY(-12px)}to{opacity:1;transform:none}}',
    '@keyframes ct-float-life{0%{opacity:0;transform:translate(-50%,0) scale(.7)}',
    '18%{opacity:1}100%{opacity:0;transform:translate(-50%,-46px) scale(1.16)}}',
    '@media(prefers-reduced-motion:reduce){.ct-card-enter,.ct-card-tap,.ct-turn-pulse,',
    '.ct-stack-pulse,.ct-float-life{animation:none!important}}'
  ].join('');
  document.head.append(style);
  let expanded=false;
  document.addEventListener('toggle',event=>{
    if(event.target?.matches?.('details.ct-native-stack'))
      expanded=event.target.open;
  },true);
  const isReduced=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const runClass=(element,name,ms)=>{
    if(!element)return;
    element.classList.remove(name);
    void element.offsetWidth;
    element.classList.add(name);
    setTimeout(()=>element.classList.remove(name),ms);
  };
  function showLifeChange(seat,player,amount){
    const id=String(player?.forgeId||'');
    const selector='[data-ct-forge-player-id="'+id+'"]';
    const element=seat===0?document.querySelector('.ct10-own-player'):
      document.querySelector('.ct10-focused-opponent '+selector)||
      document.querySelector('.ct10-overview '+selector);
    if(!element)return;
    const rect=element.getBoundingClientRect();
    const number=document.createElement('div');
    number.className='ct-float-life'+(amount>0?' gain':'');
    number.textContent=(amount>0?'+':'')+String(amount);
    number.style.left=(rect.left+rect.width/2)+'px';
    number.style.top=(rect.top+Math.min(rect.height/2,40))+'px';
    document.body.append(number);
    setTimeout(()=>number.remove(),1300);
  }
  function onState(previous,next){
    if(!previous?.native||!next?.native||isReduced())return;
    const appeared=[],tapped=[],life=[];
    for(let i=0;i<next.players.length;i++){
      const old=previous.players?.[i];
      const now=next.players[i];
      if(!old)continue;
      const oldCards=new Map((old.battlefield||[]).map(card=>[String(card.forgeId),card]));
      for(const card of now.battlefield||[]){
        const earlier=oldCards.get(String(card.forgeId));
        if(!earlier)appeared.push(String(card.forgeId));
        else if(!earlier.tapped&&card.tapped)tapped.push(String(card.forgeId));
      }
      if(Number.isFinite(Number(now.life))&&Number.isFinite(Number(old.life))&&now.life!==old.life){
        life.push({seat:i,player:now,amount:now.life-old.life});
      }
    }
    const turnChanged=previous.turn!==next.turn||previous.active!==next.active;
    const stackChanged=(next.stack?.length||0)>(previous.stack?.length||0);
    requestAnimationFrame(()=>setTimeout(()=>{
      if(window.app?.view!=='game')return;
      const cards=[...document.querySelectorAll('.ct10-lane .game-card[data-value]')];
      for(const [ids,cls] of [[appeared,'ct-card-enter'],[tapped,'ct-card-tap']]){
        for(const id of ids.slice(0,15)){
          const element=cards.find(el=>String(el.dataset.value||'').split(':').at(-1)===id);
          runClass(element,cls,580);
        }
      }
      if(turnChanged)runClass(document.querySelector('.ct10-phase-badge'),'ct-turn-pulse',760);
      if(stackChanged)runClass(document.querySelector('.ct-native-stack'),'ct-stack-pulse',480);
      for(const item of life)showLifeChange(item.seat,item.player,item.amount);
    },110));
  }
  window.ctArenaMotion={onState,get stackExpanded(){return expanded;}};
})();