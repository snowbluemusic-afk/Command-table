/* Sol Pod v0.66 — a single entry point for each gameplay task.
 * The searchable hand remains Forge identity-safe. The Players menu provides
 * both seat selection and full-pod overview, without a second HUD icon.
 */
(()=>{
 'use strict';
 if(window.solPodHudConsolidation)return;
 const style=document.createElement('style');style.id='sol-pod-hud-consolidation-v066';
 style.textContent=[
  '.sol-battlefield .sol-player-full-pod{width:100%;justify-content:center!important;',
  'background:#304655!important;color:#ffe3ac!important;',
  'border:1px solid #c9b388!important;min-height:33px!important;font:750 12px system-ui!important}',
  '.sol-battlefield .sol-pod-overview-back{position:absolute;top:8px;right:9px;',
  'z-index:30;border:1px solid #e1bd83;border-radius:9px;',
  'background:#293b4b;color:#fce6c4;padding:7px 12px;',
  'min-height:34px;font:750 12px system-ui}',
  '.sol-battlefield .sol-player-full-pod:focus-visible,',
  '.sol-battlefield .sol-pod-overview-back:focus-visible{outline:3px solid #fff0b1}',
  '@media(orientation:landscape) and (max-height:430px){',
  '.sol-battlefield .sol-player-full-pod{min-height:28px!important}',
  '.sol-battlefield .sol-pod-overview-back{min-height:29px;top:5px;right:5px}}'
 ].join('');
 document.head.append(style);
 function make(text,cssClass,aria){
  const b=document.createElement('button');b.type='button';
  b.className=cssClass;b.textContent=text;b.setAttribute('aria-label',aria);
  // Use the same established UI-only switch, never a game.command or a
  // second rules handler. Prevent delegated action from firing it twice.
  b.addEventListener('click',e=>{
   e.preventDefault();e.stopPropagation();
   window.CommandTableAction?.('togglePod','');
  });
  return b;
 }
 function sync(){
  const app=window.app;
  if(!app?.nativeMatch||app.view!=='game')return;
  const roster=document.querySelector('.sol-battlefield .sol-roster');
  const count=app.game?.players?.length||0;
  if(roster&&count>2&&app.solRosterOpen&&!roster.querySelector('.sol-player-full-pod')){
   roster.append(make('▦ View full pod','sol-player-full-pod',
    'View all '+count+' players on the Commander table'));
  }
  // In overview the focused-player roster is not rendered. Always provide
  // an explicit way back after the obsolete top-bar Pod icon is removed.
  const overview=document.querySelector('.sol-battlefield .ct10-overview');
  if(overview&&!overview.querySelector('.sol-pod-overview-back')){
   overview.prepend(make('← Back to table','sol-pod-overview-back',
    'Return to focused battlefield'));
  }
 }
 let pending=false;
 function schedule(){
  if(pending)return;pending=true;
  requestAnimationFrame(()=>{pending=false;sync();});
 }
 const root=document.getElementById('app');
 if(root)new MutationObserver(schedule).observe(root,{childList:true,subtree:false});
 if(window.CommandTableNative?.onState)window.CommandTableNative.onState(schedule);
 window.solPodHudConsolidation={refresh:schedule};
 schedule();
})();