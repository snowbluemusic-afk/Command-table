/* Sol Pod v0.63: persistent active-turn / priority cues.
 * Turn ownership is read from the Forge-hydrated activePlayer index.
 */
(()=>{
 'use strict';
 if(window.solPodTurnIndicator)return;
 const style=document.createElement('style');style.id='sol-pod-turn-indicator-v063';
 style.textContent=[
 '#sol-pod-turn-indicator{position:fixed;z-index:2147482570;',
 'top:calc(env(safe-area-inset-top) + 4px);left:50%;transform:translateX(-50%);',
 'max-width:65vw;min-width:185px;padding:7px 18px;border-radius:0 0 12px 12px;',
 'display:none;text-align:center;pointer-events:none;',
 'background:#253d45ef;color:#f3e7ce;border:1px solid #9ca9a5;',
 'border-top:0;box-shadow:0 7px 25px #0009;font:850 13px/1.2 system-ui;',
 'letter-spacing:.035em;box-sizing:border-box}',
 'body[data-sol-pod-turn="mine"] #sol-pod-turn-indicator{display:block;',
 'background:#e6ba72;color:#142a31;border-color:#ffe2aa;',
 'box-shadow:0 0 25px #f0b45799,0 7px 18px #000a;font-size:16px}',
 'body[data-sol-pod-turn="opponent"] #sol-pod-turn-indicator{display:block}',
 'body[data-sol-pod-turn="mine"] .ct10-lane-own.ct10-creatures{',
 'border-bottom:2px solid #eebd72!important;',
 'box-shadow:inset 0 -9px 16px -15px #ffd78c!important}',
 'body[data-sol-pod-turn="mine"] #ct-forge-priority-buttons{',
 'border-color:#f0c77f!important;box-shadow:0 0 12px #dba65b55!important}',
 'body:has(#ct-fullscreen-targets[data-open="true"]) #sol-pod-turn-indicator,',
 'body:has(#ct-required-forge-action[data-open="true"]) #sol-pod-turn-indicator,',
 'body:has(#sol-pod-match-result-v043[data-open="true"]) #sol-pod-turn-indicator{display:none!important}',
 '@media(orientation:landscape) and (max-height:420px){',
 '#sol-pod-turn-indicator{min-width:160px;font-size:11px;padding:4px 11px;max-width:48vw}',
 'body[data-sol-pod-turn="mine"] #sol-pod-turn-indicator{font-size:13px}}',
 '@media(prefers-reduced-motion:no-preference){',
 'body[data-sol-pod-turn="mine"] #sol-pod-turn-indicator[data-new-turn="true"]{',
 'animation:sol-turn-glow .9s ease-in-out 2}',
 '@keyframes sol-turn-glow{50%{box-shadow:0 0 36px 12px #f9d68fcf}}}'
 ].join('');
 document.head.append(style);
 const flag=document.createElement('div');
 flag.id='sol-pod-turn-indicator';flag.setAttribute('role','status');
 flag.setAttribute('aria-live','polite');flag.setAttribute('aria-atomic','true');
 document.body.append(flag);
 let previousTurn='',lastLabel='',fade=null,pending=false;
 function refresh(){
   const g=window.app?.nativeMatch&&window.app?.view==='game'?window.app.game:null;
   const body=document.body;
   if(!g||g.gameOver||g.winner!=null||g.phase==='mulligan'){
     body.removeAttribute('data-sol-pod-turn');flag.dataset.newTurn='false';
     previousTurn='';lastLabel='';return;
   }
   const mine=g.active===0;
   const turnId=String(g.turn)+'|'+String(g.active);
   const who=mine?'mine':'opponent';
   const name=mine?'You':String(g.players?.[g.active]?.name||'Opponent');
   const priority=!!g.players?.[0]?.priority;
   const label=mine?'✦ YOUR TURN'+(priority?' · Your priority':' · Waiting'):
     priority?'YOUR RESPONSE · '+name+"'s turn":
      name.toUpperCase()+"'S TURN";
   body.dataset.solPodTurn=who;
   if(lastLabel!==label){flag.textContent=label;lastLabel=label;}
   if(previousTurn!==turnId){
     flag.dataset.newTurn=String(mine && !!previousTurn);
     clearTimeout(fade);
     fade=setTimeout(()=>{flag.dataset.newTurn='false';},2000);
     previousTurn=turnId;
   }
 }
 function schedule(){
   if(pending)return;
   pending=true;requestAnimationFrame(()=>{pending=false;refresh();});
 }
 const root=document.getElementById('app');
 if(root)new MutationObserver(schedule).observe(root,{childList:true,subtree:false});
 window.addEventListener('ct-forge-prompt-updated',schedule);
 window.addEventListener('ct-forge-selection',schedule);
 if(window.CommandTableNative?.onState)window.CommandTableNative.onState(schedule);
 window.solPodTurnIndicator={refresh:schedule};
 schedule();
})();