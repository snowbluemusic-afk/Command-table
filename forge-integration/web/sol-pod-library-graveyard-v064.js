/* Sol Pod v0.65: Forge-backed public-zone counters in the right-hand action HUD.
 * The library is a count only; the graveyard opens the existing Forge zone browser.
 * This module never guesses hidden cards or applies gameplay rules.
 */
(()=>{
 'use strict';
 if(window.solPodLibraryGraveyard)return;
 const css=document.createElement('style');css.id='sol-v64-library-graveyard-css';
 css.textContent=[
  '#sol-pod-hud-layout>.sol-v64-zones{display:none}',
  'body:has(.sol-battlefield) #sol-pod-hud-layout>.sol-v64-zones:not([hidden]){',
  'position:relative;display:flex;flex:0 0 auto;align-items:stretch;',
  'box-sizing:border-box;width:100%;min-width:0;gap:6px;pointer-events:auto;',
  'margin:0!important;padding:0!important;z-index:4}',
  '#sol-pod-hud-layout>.sol-v64-zones .sol-v64-zone{display:flex;align-items:center;',
  'justify-content:space-between;gap:4px;flex:1 1 0;min-width:0;',
  'min-height:40px;padding:5px 8px;border:1px solid #bda27b;border-radius:9px;',
  'background:#152b36ed;color:#f4e6cc;box-shadow:0 3px 10px #0008;',
  'font:700 clamp(10px,.85vw,13px) system-ui;box-sizing:border-box}',
  '#sol-pod-hud-layout>.sol-v64-zones .sol-v64-zone span{',
  'overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '#sol-pod-hud-layout>.sol-v64-zones .sol-v64-zone strong{font-size:15px;',
  'flex:none;font-variant-numeric:tabular-nums}',
  '#sol-pod-hud-layout>.sol-v64-zones button.sol-v64-zone{',
  'touch-action:manipulation;cursor:pointer}',
  '#sol-pod-hud-layout>.sol-v64-zones button.sol-v64-zone:active{background:#42606b}',
  '#sol-pod-hud-layout>.sol-v64-zones .sol-v64-library[data-low="true"]{',
  'border-color:#e8ac60;background:#513a28}',
  '#sol-pod-hud-layout>.sol-v64-zones .sol-v64-library[data-empty="true"]{',
  'border-color:#f28f88;background:#612e32}',
  '#sol-pod-hud-layout>.sol-v64-zones button:focus-visible{outline:3px solid #fff1b1}',
  '@media(orientation:landscape) and (max-height:420px){',
  '#sol-pod-hud-layout>.sol-v64-zones .sol-v64-zone{min-height:34px;',
  'padding:4px 6px;font-size:10px}',
  '#sol-pod-hud-layout>.sol-v64-zones .sol-v64-zone strong{font-size:13px}}',
  '@media(max-width:450px){',
  '#sol-pod-hud-layout>.sol-v64-zones .sol-v64-zone{padding:4px;gap:2px}',
  '#sol-pod-hud-layout>.sol-v64-zones .sol-v64-zone span{font-size:9px}}'
 ].join('');
 document.head.append(css);
 let queued=false,observedHud=null;
 function sync(){
  const app=window.app,g=app?.nativeMatch&&app.view==='game'?app.game:null;
  const host=document.getElementById('sol-pod-hud-layout');
  if(!host)return;
  let group=host.querySelector('.sol-v64-zones');
  if(!group){
   group=document.createElement('div');group.className='sol-v64-zones';
   group.setAttribute('role','group');group.setAttribute('aria-label','Your library and graveyard');
   const library=document.createElement('div');library.className='sol-v64-zone sol-v64-library';
   library.innerHTML='<span>▤ Library</span><strong>—</strong>';
   const grave=document.createElement('button');grave.type='button';
   grave.className='sol-v64-zone sol-v64-graveyard';
   grave.setAttribute('aria-label','Browse your graveyard');
   grave.innerHTML='<span>♜ Graveyard</span><strong>—</strong>';
   grave.onclick=event=>{
    event.preventDefault();event.stopPropagation();
    window.ctZoneBrowser?.open?.('graveyard');
   };
   group.append(library,grave);host.append(group);
  }
  // The existing HUD moves Forge priority controls during native updates.
  // Keep this footer AFTER priority; never float it over the battlefield.
  if(host.lastElementChild!==group)host.append(group);
  if(observedHud!==host){
   new MutationObserver(schedule).observe(host,{childList:true});
   observedHud=host;
  }
  group.hidden=!g?.players?.[0];
  if(group.hidden)return;
  const me=g.players[0],library=group.querySelector('.sol-v64-library');
  const grave=group.querySelector('.sol-v64-graveyard');
  const remaining=Number.isFinite(me.libraryCount)?Math.max(0,me.libraryCount):
   Array.isArray(me.library)?me.library.length:0;
  const graveCount=Array.isArray(me.graveyardCards)?me.graveyardCards.length:
   (Array.isArray(me.graveyard)?me.graveyard.length:0);
  const low=remaining<=5,empty=remaining===0;
  const message=empty?'Library empty. Your next required draw may cause you to lose.':
   low?'Only '+remaining+' cards remain in your library.':'Your library has '+remaining+' cards remaining.';
  library.querySelector('strong').textContent=String(remaining);
  library.querySelector('span').textContent=low?'⚠ Library':'▤ Library';
  library.dataset.low=String(low);library.dataset.empty=String(empty);
  library.title=message;library.setAttribute('aria-label',message);
  grave.querySelector('strong').textContent=String(graveCount);
  grave.setAttribute('aria-label','Browse your graveyard, '+graveCount+' cards');
 }
 function schedule(){
  if(queued)return;queued=true;
  requestAnimationFrame(()=>{queued=false;sync();});
 }
 const root=document.getElementById('app');
 if(root)new MutationObserver(schedule).observe(root,{childList:true,subtree:false});
 if(window.CommandTableNative?.onState)window.CommandTableNative.onState(schedule);
 window.solPodLibraryGraveyard={refresh:schedule};
 schedule();
})();