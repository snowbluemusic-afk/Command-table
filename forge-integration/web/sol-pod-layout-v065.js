/* Sol Pod v0.65 — uncluttered landscape HUD.
 * Never change the location or semantics of live Forge controls outside
 * their existing right-hand flex layout. Style only; no rules or input changes.
 */
(()=>{
 'use strict';
 if(window.solPodLayoutV065)return;
 const style=document.createElement('style');style.id='sol-pod-layout-v065-css';
 style.textContent=[
  /* Branding belongs in settings, not above readable opponent cards. */
  '.sol-battlefield .sol-game-brand{display:none!important}',
  'body:has(.sol-battlefield) #sol-pod-build-marker{display:none!important}',
  /* The library + graveyard are now real flex children AFTER priority.
     Reserve their height instead of floating over the player's hand. */
  'body:has(.sol-battlefield) #sol-pod-hud-layout{overflow:visible!important;',
  'gap:clamp(4px,.8dvh,8px)!important}',
  'body:has(.sol-battlefield) #sol-pod-hud-layout>',
  '#ct-forge-priority-buttons:not(.ct-forge-pregame){',
  'position:relative!important;top:auto!important;bottom:auto!important;',
  'left:auto!important;right:auto!important;margin:auto 0 0!important;',
  'max-height:28dvh!important;min-height:0!important;overflow-y:auto!important}',
  /* Mandatory multi-choice prompts must remain usable rather than shrinking
     into an offscreen overlay on shorter landscape screens. */
  'body:has(.sol-battlefield) #sol-pod-hud-layout>',
  '#ct-forge-priority-buttons.ct-forge-hand-choice{max-height:35dvh!important}',
  /* Lower-left is now the life total, Zones and Hand — small tap targets, not
     oversized cards that compete with the fan of playable cards. */
  '.sol-battlefield .ct10-zone-rail>.ct-zone-toggle{',
  'min-width:clamp(98px,8vw,122px)!important;max-width:130px!important;',
  'min-height:34px!important;padding:4px 8px!important;',
  'font:750 clamp(10px,.9vw,13px) system-ui!important;',
  'border:1px solid #c9ae7c!important;background:#2a3039ed!important;',
  'box-shadow:0 2px 8px #0008!important}',
  '.sol-battlefield .ct10-hand-ribbon button{',
  'min-height:33px!important;max-width:148px!important;',
  'padding:4px 9px!important;font:750 clamp(10px,.9vw,13px) system-ui!important;',
  'border:1px solid #c9ae7c!important;background:#192d39ed!important;',
  'box-shadow:0 2px 8px #0008!important}',
  '.sol-battlefield .ct10-zone-rail{',
  'left:clamp(136px,17vw,252px)!important;bottom:1.4%!important;top:auto!important;',
  'width:auto!important;max-width:none!important}',
  '@media(orientation:landscape) and (max-height:420px){',
  'body:has(.sol-battlefield) #sol-pod-hud-layout>',
  '#ct-forge-priority-buttons:not(.ct-forge-pregame){max-height:32dvh!important}',
  '.sol-battlefield .ct10-zone-rail>.ct-zone-toggle{min-height:30px!important;',
  'padding:3px 7px!important;min-width:93px!important}',
  '.sol-battlefield .ct10-hand-ribbon button{min-height:30px!important;padding:3px 7px!important}',
  '.sol-battlefield .ct10-zone-rail{left:clamp(133px,17vw,248px)!important}}',
  '#sol-pod-preferences .sol-build-settings-label{',
  'margin:12px 0 0!important;font:600 11px system-ui;color:#b8c8c8;',
  'text-align:right;letter-spacing:.04em}'
 ].join('');
 document.head.append(style);
 function sync(){
  const settings=document.querySelector('#sol-pod-preferences > section');
  if(settings&&!settings.querySelector('.sol-build-settings-label')){
   const label=document.createElement('p');
   label.className='sol-build-settings-label';
   label.textContent='Sol Pod v'+String(window.SOL_POD_BUILD||'0.65.0');
   const foot=settings.querySelector('.sol-pref-foot');
   if(foot)settings.insertBefore(label,foot);
   else settings.append(label);
  }
  window.solPodLibraryGraveyard?.refresh?.();
 }
 let pending=false;
 function schedule(){
  if(pending)return;pending=true;
  requestAnimationFrame(()=>{pending=false;sync();});
 }
 const root=document.getElementById('app');
 if(root)new MutationObserver(schedule).observe(root,{childList:true,subtree:false});
 window.solPodLayoutV065={refresh:schedule};
 schedule();
})();