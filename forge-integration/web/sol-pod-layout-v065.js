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
  'position:relative!important;top:auto!important;bottom:auto!important;',
  'width:100%!important;height:100%!important;min-width:0!important;',
  'max-width:none!important;min-height:0!important;max-height:100%!important;',
  'box-sizing:border-box!important;display:flex!important;align-items:center!important;',
  'justify-content:center!important;text-align:center!important;',
  'font:800 clamp(10px,.9vw,14px) system-ui!important;',
  'white-space:nowrap!important;letter-spacing:0!important;',
  'color:#ffe7b9!important;border:2px solid #e3bf74!important;',
  'border-radius:11px!important;background:linear-gradient(160deg,#443c29f5,#142534f7)!important;',
  'box-shadow:0 0 15px #d1a65b5a!important;padding:5px 6px!important;',
  'cursor:pointer!important;touch-action:manipulation!important}',
  '.sol-battlefield .ct10-hand-ribbon button{',
  'min-height:33px!important;max-width:148px!important;',
  'padding:4px 9px!important;font:750 clamp(10px,.9vw,13px) system-ui!important;',
  'border:1px solid #c9ae7c!important;background:#192d39ed!important;',
  'box-shadow:0 2px 8px #0008!important}',
  '.sol-battlefield .ct10-zone-rail{',
  'left:17.2%!important;bottom:max(2.1%,env(safe-area-inset-bottom))!important;',
  'top:auto!important;width:10.4%!important;min-width:0!important;',
  'max-width:none!important;height:clamp(36px,6.4dvh,46px)!important;',
  'min-height:0!important;align-items:stretch!important;z-index:3000!important}',
  '@media(orientation:landscape) and (max-height:420px){',
  'body:has(.sol-battlefield) #sol-pod-hud-layout>',
  '#ct-forge-priority-buttons:not(.ct-forge-pregame){max-height:32dvh!important}',
  '.sol-battlefield .ct10-zone-rail{bottom:max(3%,env(safe-area-inset-bottom))!important;',
  'height:clamp(32px,6.4dvh,46px)!important}',
  '.sol-battlefield .ct10-zone-rail>.ct-zone-toggle{padding:3px 6px!important}',
  '.sol-battlefield .ct10-hand-ribbon button{min-height:30px!important;padding:3px 7px!important}}',
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
   label.textContent='Sol Pod v'+String(window.SOL_POD_BUILD||'0.65.1');
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