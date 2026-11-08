/* Sol Pod v0.43 — a Forge-authored match result, never an inferred win.
 * Forge resolves combat, state-based actions, commander damage, draw attempts,
 * concessions and simultaneous losses before GameView.gameOver is true.
 */
(()=>{
  'use strict';
  if(window.solPodMatchResult)return;
  const css=document.createElement('style');
  css.id='sol-pod-match-result-v043';
  css.textContent=[
    // v0.14's scene-local outcome can be clipped by the battlefield and
    // sit underneath HUD dialogs. Keep its compatibility markup hidden.
    'body:has(#sol-pod-match-result-v043) .ct-native-game-end{display:none!important}',
    '#sol-pod-match-result-v043{display:none;position:fixed;inset:0;',
    'width:100vw;height:100dvh;z-index:2147483400;align-items:center;',
    'justify-content:center;box-sizing:border-box;padding:clamp(8px,3dvh,24px);',
    'background:#030a17e8;backdrop-filter:blur(8px);pointer-events:auto;',
    'font-family:system-ui,-apple-system,sans-serif}',
    '#sol-pod-match-result-v043[data-open="true"]{display:flex}',
    '#sol-pod-match-result-v043 .sol-result-card{display:flex;flex-direction:column;',
    'align-items:center;justify-content:center;max-height:96dvh;overflow-y:auto;',
    'width:min(94vw,660px);box-sizing:border-box;text-align:center;',
    'padding:clamp(15px,4dvh,36px);border:2px solid #d5b57d;border-radius:20px;',
    'background:radial-gradient(ellipse at 50% -10%,#51625c88,#162938 62%,#101b2b);',
    'color:#fff2de;box-shadow:0 20px 75px #000e}',
    '#sol-pod-match-result-v043 .sol-result-kicker{font:800 11px Georgia,serif;',
    'color:#dbbc83;letter-spacing:.18em}',
    '#sol-pod-match-result-v043 .sol-result-glyph{font-size:clamp(33px,7dvh,60px);',
    'color:#e9c382;text-shadow:0 0 18px #d4a56d9c;margin:5px 0}',
    '#sol-pod-match-result-v043 h2{font:800 clamp(36px,8dvh,75px) Georgia,serif;',
    'margin:0;color:#fff1d0}',
    '#sol-pod-match-result-v043 p{font-size:clamp(12px,2.2dvh,17px);',
    'line-height:1.45;margin:8px 0 17px;color:#d5e2e3}',
    '#sol-pod-match-result-v043 .sol-result-explanation{font-size:clamp(12px,2.4dvh,16px);'+
    'padding:9px 12px;border:1px solid #8ea79b77;border-radius:10px;'+
    'background:#18332cbb;max-width:540px;margin:0 0 12px;color:#fbe8c9}',
    '#sol-pod-match-result-v043 .sol-result-stats{font:750 12px system-ui;',
    'color:#e8cf98;margin-bottom:16px}',
    '#sol-pod-match-result-v043 .sol-result-actions{display:flex;',
    'gap:10px;flex-wrap:wrap;justify-content:center;width:100%}',
    '#sol-pod-match-result-v043 button,#sol-pod-result-reopen{',
    'font:800 13px system-ui;padding:11px 17px;min-height:44px;',
    'border-radius:11px;border:1px solid #d7b87e;cursor:pointer;',
    'touch-action:manipulation}',
    '#sol-pod-match-result-v043 .sol-result-leave{background:#e4bd7a;color:#182735}',
    '#sol-pod-match-result-v043 .sol-result-review{background:#2d4653;color:#f8e9d1}',
    '#sol-pod-result-reopen{display:none;position:fixed;bottom:4dvh;right:2vw;',
    'z-index:2147483100;background:#e4bd7a;color:#132836;',
    'box-shadow:0 8px 26px #0009}',
    '@media(orientation:landscape) and (max-height:450px){',
    '#sol-pod-match-result-v043 .sol-result-card{padding:12px}',
    '#sol-pod-match-result-v043 .sol-result-glyph{font-size:31px;margin:0}',
    '#sol-pod-match-result-v043 h2{font-size:34px}',
    '#sol-pod-match-result-v043 p{margin:4px 0 9px}',
    '#sol-pod-match-result-v043 .sol-result-stats{margin-bottom:8px}',
    '#sol-pod-match-result-v043 button{min-height:37px;padding:7px 13px}',
    '}'
  ].join('');
  document.head.append(css);
  const modal=document.createElement('section');
  modal.id='sol-pod-match-result-v043';
  modal.dataset.open='false';
  modal.setAttribute('role','dialog');
  modal.setAttribute('aria-modal','true');
  modal.setAttribute('aria-label','Sol Pod match result');
  const card=document.createElement('article');
  card.className='sol-result-card';
  const kicker=document.createElement('div');kicker.className='sol-result-kicker';
  kicker.textContent='SOL POD · MATCH COMPLETE';
  const glyph=document.createElement('div');glyph.className='sol-result-glyph';
  const title=document.createElement('h2');
  const subtitle=document.createElement('p');
  const explanation=document.createElement('p');explanation.className='sol-result-explanation';
  const stats=document.createElement('div');stats.className='sol-result-stats';
  const actions=document.createElement('div');actions.className='sol-result-actions';
  const review=document.createElement('button');review.type='button';
  review.className='sol-result-review';review.textContent='Review battlefield';
  const leave=document.createElement('button');leave.type='button';
  leave.className='sol-result-leave';leave.textContent='Back to decks / Play again';
  actions.append(review,leave);card.append(kicker,glyph,title,subtitle,explanation,stats,actions);
  modal.append(card);document.body.append(modal);
  const reopen=document.createElement('button');reopen.id='sol-pod-result-reopen';
  reopen.type='button';reopen.textContent='✦ View result';document.body.append(reopen);
  let key='',reviewing=false,actual=null;
  function clear(){
    key='';reviewing=false;actual=null;
    modal.dataset.open='false';reopen.style.display='none';
  }
  function display(){
    const showing=!!actual&&!reviewing;
    modal.dataset.open=showing?'true':'false';
    reopen.style.display=actual&&reviewing?'block':'none';
  }
  function lossExplanation(reason,source,winningEffect){
    // These are Forge GameLossReason codes, not inferred from library size,
    // life totals, visual board state or a guessed opponent archetype.
    const effect=String(source||winningEffect||'').trim().slice(0,140);
    switch(String(reason||'')){
      case 'Milled':
        return 'You attempted to draw a card from an empty library. You do not lose merely because the library reaches 0 cards — the failed draw causes the loss.';
      case 'LifeReachedZero':
        return 'Your life total reached 0 or less. This could be combat damage, spell damage, life loss or another effect.';
      case 'CommanderDamage':
        return 'You took at least 21 combat damage from the same commander.';
      case 'Poisoned':
        return 'You reached the poison counter loss threshold.';
      case 'SpellEffect':
        return effect?'You lost due to '+effect+'.':'A spell or ability caused you to lose the game.';
      case 'OpponentWon':
        return effect?effect+' caused an opponent to win the game.':'An opponent won through an alternate win condition.';
      case 'Conceded':
        return 'You conceded the match.';
      case 'IntentionalDraw':
        return 'The game ended by an agreed draw.';
      default:
        return 'Sol Pod could not determine the precise loss condition from the final game state. Review the Game Log for details.';
    }
  }
  function resultOf(raw){
    // The local player's life total, opponent health, battlefield, and turn
    // are NEVER used to predict victory. Only the finished Forge GameView is.
    if(!raw?.gameOver || !Array.isArray(raw.players)||!raw.players.length)return null;
    let result=String(raw.outcome||'').toLowerCase();
    const victor=String(raw.winner||'').trim();
    const me=String(raw.players[0].name||'').trim();
    if(!['victory','defeat','draw'].includes(result))
      result=!victor?'draw':victor===me?'victory':'defeat';
    return {result,victor,life:raw.players[0].life,turn:raw.turn,
      lossReason:raw.lossReason||null,lossSource:raw.lossSource||null,
      winningEffect:raw.winningEffect||null,
      key:JSON.stringify([raw.gameId,raw.turn,raw.winner,raw.outcome,raw.players[0].id])};
  }
  function onState(raw){
    if(!window.app?.nativeMatch){clear();return;}
    const next=resultOf(raw);
    if(!next){clear();return;}
    if(next.key!==key){key=next.key;reviewing=false;}
    actual=next;
    window.solPodDeckAnalytics?.recordMatch?.(raw);
    const win=next.result==='victory',lose=next.result==='defeat';
    const label=win?'Victory!':lose?'Defeat':'Draw';
    title.textContent=label;
    glyph.textContent=win?'✦':lose?'◇':'✧';
    subtitle.textContent=win?'You won the Commander match.':
      lose?(next.victor?next.victor+' won the Commander match.':'Your Commander was defeated.'):
      'The match ended without a winner.';
    explanation.hidden=!lose;
    explanation.textContent=lose?lossExplanation(next.lossReason,next.lossSource,next.winningEffect):'';
    stats.textContent='Turn '+(Number(next.turn)||1)+' · Your final life: '+
      (next.life??'—');
    modal.setAttribute('aria-label',label+' — Sol Pod match complete');
    display();
  }
  review.onclick=()=>{reviewing=true;display();};
  reopen.onclick=()=>{reviewing=false;display();};
  leave.onclick=()=>{
    if(!actual)return;
    clear();
    window.CommandTableAction?.('leaveFinishedGame');
  };
  // A finished match cannot be dismissed accidentally: the user explicitly
  // chooses to review its battlefield or leave. There is no fake Continue.
  modal.addEventListener('click',event=>{if(event.target===modal)event.stopPropagation();});
  window.solPodMatchResult={onState,clear,
    get visible(){return modal.dataset.open==='true';},
    get result(){return actual?.result||null;}};
  // Restore if the WebView was rebuilt with an already-complete Forge match.
  if(window.app?.nativeMatch && window.app?.game?.gameOver)
    onState(window.app.game);
})();
