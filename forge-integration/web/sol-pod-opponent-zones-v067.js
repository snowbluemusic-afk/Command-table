/* Sol Pod v0.67 — public library/graveyard status of the focused opponent.
 * Forge supplies the remaining library count and public graveyard cards.
 * This status row is a normal child of the existing bounded right-side HUD:
 * it never floats over the board, stack, or mandatory priority controls.
 */
(()=>{
 'use strict';
 if(window.solPodOpponentZones)return;
 const css=document.createElement('style');
 css.id='sol-pod-opponent-zones-v067-css';
 css.textContent=[
  '#sol-pod-hud-layout>.sol-v67-opponent-zones{display:none}',
  'body:has(.sol-battlefield) #sol-pod-hud-layout>.sol-v67-opponent-zones:not([hidden]){',
  'position:relative;display:flex;flex-direction:column;flex:0 1 auto;',
  'min-height:0;min-width:0;width:100%;max-height:12dvh;gap:4px;',
  'overflow:hidden;padding:5px 6px!important;margin:0!important;',
  'box-sizing:border-box;pointer-events:auto;z-index:2;',
  'background:#271e3ad9;border:1px solid #b58bda;border-radius:11px}',
  '#sol-pod-hud-layout>.sol-v67-opponent-zones .sol-v67-label{',
  'font:750 10px/1.25 system-ui;color:#dac5ef;letter-spacing:.025em;',
  'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
  '#sol-pod-hud-layout>.sol-v67-opponent-zones .sol-v67-pair{',
  'display:flex;align-items:stretch;min-height:0;gap:5px;width:100%}',
  '#sol-pod-hud-layout>.sol-v67-opponent-zones .sol-v67-count{',
  'box-sizing:border-box;display:flex;justify-content:space-between;',
  'align-items:center;gap:4px;flex:1 1 0;min-width:0;min-height:32px;',
  'padding:3px 6px;border:1px solid #ae89ca;border-radius:8px;',
  'background:#1b2136;color:#f4e8fd;font:700 10px system-ui}',
  '#sol-pod-hud-layout>.sol-v67-opponent-zones .sol-v67-count span{',
  'overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '#sol-pod-hud-layout>.sol-v67-opponent-zones .sol-v67-count strong{',
  'flex:none;font:800 14px system-ui;font-variant-numeric:tabular-nums}',
  '#sol-pod-hud-layout>.sol-v67-opponent-zones button.sol-v67-count{',
  'touch-action:manipulation;cursor:pointer}',
  '#sol-pod-hud-layout>.sol-v67-opponent-zones button.sol-v67-count:active{',
  'background:#4c365d}',
  '#sol-pod-hud-layout>.sol-v67-opponent-zones button:focus-visible{',
  'outline:3px solid #ffe4b8}',
  '#sol-pod-hud-layout>.sol-v67-opponent-zones .sol-v67-library[data-empty="true"]{',
  'border-color:#f2a08f;background:#5e303f}',
  'body:has(.sol-battlefield.sol-roster-expanded)',
  ' #sol-pod-hud-layout>.sol-v67-opponent-zones{',
  'visibility:hidden!important;pointer-events:none!important}',
  /* Keep priority and mandatory modal decisions accessible in tight viewports.
     The opponent status disappears only when the right rail is extremely
     constrained by an interactive Forge choice or a visible stack. */
  '@media(orientation:landscape) and (max-height:460px){',
  '#sol-pod-hud-layout>.sol-v67-opponent-zones{max-height:34px!important;padding:3px!important}',
  '#sol-pod-hud-layout>.sol-v67-opponent-zones .sol-v67-label{display:none!important}',
  '#sol-pod-hud-layout>.sol-v67-opponent-zones .sol-v67-count{min-height:25px!important}',
  'body:has(#ct-forge-priority-buttons.ct-forge-hand-choice)',
  ' #sol-pod-hud-layout>.sol-v67-opponent-zones{display:none!important}}',
  '@media(max-height:360px){',
  'body:has(#sol-pod-stack:not([data-empty="true"]))',
  ' #sol-pod-hud-layout>.sol-v67-opponent-zones{display:none!important}}'
 ].join('');
 document.head.append(css);
 let pending=false,hostObserved=null;
 function focusedSeat(g,app){
  const players=g?.players||[];
  const selected=Number(app?.focusPlayer);
  if(Number.isInteger(selected)&&selected>0&&selected<players.length&&
     !players[selected]?.dead)return selected;
  const active=Number(g?.active);
  if(Number.isInteger(active)&&active>0&&active<players.length&&
     !players[active]?.dead)return active;
  return players.findIndex((p,i)=>i>0&&!p.dead);
 }
 function sync(){
  const app=window.app;
  const g=app?.nativeMatch&&app.view==='game'?app.game:null;
  const host=document.getElementById('sol-pod-hud-layout');
  if(!host)return;
  let row=host.querySelector('.sol-v67-opponent-zones');
  if(!row){
   row=document.createElement('section');
   row.className='sol-v67-opponent-zones';
   row.setAttribute('role','group');
   const label=document.createElement('div');
   label.className='sol-v67-label';
   const pair=document.createElement('div');
   pair.className='sol-v67-pair';
   const library=document.createElement('div');
   library.className='sol-v67-count sol-v67-library';
   library.innerHTML='<span>▤ Library</span><strong>—</strong>';
   const grave=document.createElement('button');
   grave.type='button';
   grave.className='sol-v67-count sol-v67-graveyard';
   grave.innerHTML='<span>♜ Graveyard</span><strong>—</strong>';
   grave.onclick=event=>{
    event.preventDefault();event.stopPropagation();
    const latest=window.app?.game;
    const id=focusedSeat(latest,window.app);
    if(id>0)window.ctZoneBrowser?.open?.('graveyard',id);
   };
   pair.append(library,grave);row.append(label,pair);
  }
  const focused=focusedSeat(g,app);
  row.hidden=!g||!Array.isArray(g.players)||focused<1||
   app.tableMode==='overview'||!!app.solRosterOpen;
  // Insert between Game Log and Stack/Phase, never over the battlefield.
  const following=host.querySelector('#sol-pod-stack')||
    host.querySelector('#ct-forge-priority-buttons')||
    host.querySelector('.sol-v64-zones');
  if(row.parentNode!==host){
   if(following)host.insertBefore(row,following);
   else host.append(row);
  }else if(following&&row.nextElementSibling!==following){
   host.insertBefore(row,following);
  }
  if(hostObserved!==host){
   new MutationObserver(schedule).observe(host,{childList:true});
   hostObserved=host;
  }
  if(row.hidden)return;
  const player=g.players[focused];
  const name=String(player.name||player.commander||'Opponent '+focused);
  const count=Number.isFinite(player.libraryCount)?
    Math.max(0,Math.trunc(player.libraryCount)):
    Array.isArray(player.library)?player.library.length:null;
  const grave=Array.isArray(player.graveyardCards)?
    player.graveyardCards.length:
    Array.isArray(player.graveyard)?player.graveyard.length:null;
  const label=row.querySelector('.sol-v67-label');
  label.textContent='OPPONENT · '+name;
  row.setAttribute('aria-label',name+' public zone counts');
  const library=row.querySelector('.sol-v67-library');
  library.querySelector('strong').textContent=count===null?'—':String(count);
  library.dataset.empty=String(count===0);
  library.setAttribute('aria-label',name+' library: '+(count===null?'unknown':count)+
    ' cards remaining. Contents are hidden.');
  const graveButton=row.querySelector('.sol-v67-graveyard');
  graveButton.querySelector('strong').textContent=grave===null?'—':String(grave);
  graveButton.setAttribute('aria-label','Browse '+name+
    ' graveyard, '+(grave===null?'unknown number of':grave)+' cards');
 }
 function schedule(){
  if(pending)return;pending=true;
  requestAnimationFrame(()=>{pending=false;sync();});
 }
 const root=document.getElementById('app');
 if(root)new MutationObserver(schedule).observe(root,{childList:true,subtree:false});
 if(window.CommandTableNative?.onState)window.CommandTableNative.onState(schedule);
 window.addEventListener('ct-forge-selection',schedule);
 window.solPodOpponentZones={refresh:schedule,focusedSeat};
 schedule();
})();