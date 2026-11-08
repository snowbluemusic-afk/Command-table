/* Sol Pod v0.64: a compact Forge-backed library + graveyard pair beside your life total.
 * Counts never inspect hidden library cards and never calculate game outcomes.
 * The graveyard control reuses the existing full-card public-zone browser.
 */
(()=>{
 'use strict';
 if(window.solPodLibraryGraveyard)return;
 const css=document.createElement('style');css.id='sol-v64-library-graveyard-css';
 css.textContent=[
  '.ct10-own-player .sol-v64-zones{position:absolute;left:calc(100% + 7px);top:0;',
  'display:flex;flex-direction:row;gap:5px;align-items:stretch;white-space:nowrap;z-index:40}',
  '.ct10-own-player .sol-v64-zones .sol-v64-zone{display:flex;flex-direction:column;',
  'align-items:center;justify-content:center;gap:2px;min-width:62px;min-height:43px;',
  'padding:5px 7px;border:1px solid #bca27b;border-radius:9px;',
  'background:#152e36f2;color:#f5e6ce;box-shadow:0 3px 11px #0009;',
  'font:750 12px system-ui;box-sizing:border-box;touch-action:manipulation}',
  '.ct10-own-player .sol-v64-zones .sol-v64-zone strong{font-size:15px;line-height:1}',
  '.ct10-own-player .sol-v64-zones .sol-v64-zone span{font-size:9px;letter-spacing:.035em}',
  '.ct10-own-player .sol-v64-zones button.sol-v64-zone{cursor:pointer}',
  '.ct10-own-player .sol-v64-zones button.sol-v64-zone:active{background:#416473}',
  '.ct10-own-player .sol-v64-zones .sol-v64-zone[data-low="true"]{border-color:#e9ac63;background:#5a3921}',
  '.ct10-own-player .sol-v64-zones .sol-v64-zone[data-empty="true"]{border-color:#f18c82;background:#632d2d}',
  '@media(orientation:landscape) and (max-height:420px){',
  '.ct10-own-player .sol-v64-zones{gap:3px;top:0}',
  '.ct10-own-player .sol-v64-zones .sol-v64-zone{min-width:53px;min-height:34px;padding:3px 4px}',
  '.ct10-own-player .sol-v64-zones .sol-v64-zone span{font-size:8px}}',
  '@media(max-width:380px){.ct10-own-player .sol-v64-zones .sol-v64-zone{min-width:48px;padding:3px}}'
 ].join('');
 document.head.append(css);
 let queued=false;
 function sync(){
  const app=window.app,g=app?.nativeMatch&&app.view==='game'?app.game:null;
  const host=document.querySelector('.ct10-own-player');
  if(!g||!host||!Array.isArray(g.players)||!g.players[0])return;
  let group=host.querySelector('.sol-v64-zones');
  if(!group){
   group=document.createElement('div');group.className='sol-v64-zones';
   group.setAttribute('role','group');group.setAttribute('aria-label','Your library and graveyard');
   const library=document.createElement('div');library.className='sol-v64-zone sol-v64-library';
   library.innerHTML='<strong>—</strong><span>▤ Library</span>';
   const grave=document.createElement('button');grave.type='button';
   grave.className='sol-v64-zone sol-v64-graveyard';
   grave.setAttribute('aria-label','Browse your graveyard');
   grave.innerHTML='<strong>—</strong><span>♜ Graveyard</span>';
   grave.onclick=(event)=>{
    event.preventDefault();event.stopPropagation();
    window.ctZoneBrowser?.open?.('graveyard');
   };
   group.append(library,grave);host.append(group);
  }
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