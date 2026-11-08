/* Sol Pod v0.63: persistent active-turn / priority cues.
 * Turn ownership is read from the Forge-hydrated activePlayer index.
 */
(()=>{
 'use strict';
 if(window.solPodTurnIndicator)return;
 const style=document.createElement('style');style.id='sol-pod-turn-indicator-v063';
 style.textContent=[
 '#sol-pod-turn-indicator{position:fixed;z-index:2147482570;',
 'top:calc(env(safe-area-inset-top) + 9.5dvh);left:clamp(12px,5vw,80px);transform:none;',
 'max-width:20vw;min-width:0;padding:6px 10px;border-radius:11px;',
 'display:none;text-align:center;pointer-events:none;',
 'background:#253d45ef;color:#f3e7ce;border:1px solid #9ca9a5;',
 'box-shadow:0 5px 15px #0009;font:850 12px/1.2 system-ui;',
 'letter-spacing:.015em;box-sizing:border-box;white-space:nowrap;',
 'overflow:hidden;text-overflow:ellipsis}',
 'body[data-sol-pod-turn="mine"] #sol-pod-turn-indicator{display:block;',
 'background:#e6ba72;color:#142a31;border-color:#ffe2aa;',
 'box-shadow:0 0 16px #f0b45770,0 5px 13px #0009;font-size:13px}',
 'body[data-sol-pod-turn="opponent"] #sol-pod-turn-indicator{display:block}',
 'body[data-sol-pod-turn="mine"] .ct10-lane-own.ct10-creatures{',
 'border-bottom:2px solid #eebd72!important;',
 'box-shadow:inset 0 -9px 16px -15px #ffd78c!important}',
 'body[data-sol-pod-turn="mine"] #ct-forge-priority-buttons{',
 'border-color:#f0c77f!important;box-shadow:0 0 12px #dba65b55!important}',
 'body:has(#sol-v62-target-dock[data-active="true"]) #sol-pod-turn-indicator,',
 'body:has(#ct-zone-browser[data-open="true"]) #sol-pod-turn-indicator,',
 'body:has(#sol-hand-grid[data-open="true"]) #sol-pod-turn-indicator,',
 'body:has(#ct-floating-zones[data-open="true"]) #sol-pod-turn-indicator,',
 'body:has(#ct-fullscreen-targets[data-open="true"]) #sol-pod-turn-indicator,',
 'body:has(#ct-required-forge-action[data-open="true"]) #sol-pod-turn-indicator,',
 'body:has(#sol-pod-match-result-v043[data-open="true"]) #sol-pod-turn-indicator{display:none!important}',
 '@media(orientation:landscape) and (max-height:420px){',
 '#sol-pod-turn-indicator{min-width:0;font-size:10px;padding:4px 7px;max-width:20vw}',
 'body[data-sol-pod-turn="mine"] #sol-pod-turn-indicator{font-size:11px}}',
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
 let previousTurn='',lastLabel='',fade=null,collapseTimer=null,pending=false;
 function positionBelowBrowse(){
   const browse=document.getElementById('sol-hand-grid-launch');
   const g=window.app?.game;
   if(!browse||!g||!window.app?.nativeMatch){
     flag.style.removeProperty('top');
     flag.style.removeProperty('left');
     flag.style.removeProperty('max-width');
     return;
   }
   const r=browse.getBoundingClientRect();
   if(!r.width||!r.height||r.bottom<0||r.bottom>innerHeight*.30){
     flag.style.removeProperty('top');
     flag.style.removeProperty('left');
     flag.style.removeProperty('max-width');
     return;
   }
   // Browse is a real action. Anchor below its rendered rectangle, rather
   // than overlaying the button or guessing a percentage of screen height.
   flag.style.setProperty('top',Math.round(r.bottom+5)+'px');
   flag.style.setProperty('left',Math.round(Math.max(8,r.left))+'px');
   flag.style.setProperty('max-width',Math.round(Math.max(112,r.width))+'px');
 }
 function refresh(){
   const g=window.app?.nativeMatch&&window.app?.view==='game'?window.app.game:null;
   const body=document.body;
   positionBelowBrowse();
   if(!g||g.gameOver||g.winner!=null||g.phase==='mulligan'){
     body.removeAttribute('data-sol-pod-turn');flag.dataset.newTurn='false';
     clearTimeout(collapseTimer);previousTurn='';lastLabel='';return;
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
   if(lastLabel!==label){
     flag.title=label;flag.setAttribute('aria-label',label);
     // Full explanation on each change, then a quiet status pill.
     // Never cover the opponent portrait or navigation tools.
     flag.textContent=label;lastLabel=label;flag.dataset.compact='false';
     clearTimeout(collapseTimer);
     const shortLabel=mine?(priority?'✦ Your turn · Priority':'✦ Your turn'):
       priority?'✦ Your response':'Opponent turn';
     collapseTimer=setTimeout(()=>{
       if(lastLabel===label){
         flag.textContent=shortLabel;flag.dataset.compact='true';
       }
     },2400);
   }
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
 if(root)new MutationObserver(schedule).observe(root,{childList:true,subtree:true});
 window.addEventListener('resize',schedule);
 window.addEventListener('orientationchange',schedule);
 window.addEventListener('ct-forge-prompt-updated',schedule);
 window.addEventListener('ct-forge-selection',schedule);
 if(window.CommandTableNative?.onState)window.CommandTableNative.onState(schedule);
 window.solPodTurnIndicator={refresh:schedule};
 schedule();
})();