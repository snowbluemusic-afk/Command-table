/* Sol Pod v0.39: one collision-free right-hand HUD layout.
 * Notifications/choices stay above the stack; Forge's real priority dock
 * stays below it. No viewport-fixed child panels can overlap one another.
 * Full-screen choice and card-reading dialogs continue to use their own layer.
 */
(() => {
  'use strict';
  if(document.getElementById('sol-pod-hud-layout'))return;
  const style=document.createElement('style');
  style.id='sol-pod-hud-layout-v039';
  style.textContent=[
    // Without the rendered battlefield (early Play/Draw), preserve the native
    // standalone Forge prompt. A display:contents parent has no containing box.
    '#sol-pod-hud-layout{display:contents}',
    'body:has(.sol-battlefield) #sol-pod-hud-layout{',
    'position:fixed;top:20dvh;bottom:2.5dvh;right:1%;width:22%;',
    'box-sizing:border-box;display:flex;flex-direction:column;align-items:stretch;',
    'gap:clamp(5px,1.1dvh,10px);z-index:220080;min-height:0;',
    'overflow:visible;pointer-events:none}',
    // Overrides both v0.30's fixed notifications and v0.32/v0.38 later
    // !important heights. This is a real flex child, never a floating layer.
    'body:has(.sol-battlefield) #sol-pod-hud-layout > #sol-pod-hub{',
    'position:relative!important;inset:auto!important;top:auto!important;',
    'right:auto!important;bottom:auto!important;left:auto!important;',
    'width:100%!important;max-width:100%!important;min-width:0!important;',
    'height:auto!important;max-height:21dvh!important;min-height:0!important;',
    'flex:0 1 auto!important;margin:0!important;overflow:hidden!important;',
    'box-sizing:border-box!important;pointer-events:auto!important}',
    'body:has(.sol-battlefield) #sol-pod-hud-layout > #sol-pod-hub.sol-empty{',
    'display:none!important}',
    'body:has(.sol-battlefield) #sol-pod-hud-layout #sol-pod-hub-content{',
    'max-height:16dvh!important;overflow-y:auto!important;min-height:0!important}',
    'body:has(.sol-battlefield) #sol-pod-hud-layout #sol-pod-notices{',
    'max-height:15dvh!important;overflow-y:auto!important}',
    'body:has(.sol-battlefield) #sol-pod-hud-layout #ct-forge-legal-actions{',
    'max-height:15dvh!important;overflow-y:auto!important}',
    // Never reserve a large empty stack panel over mandatory Forge choices.
    // Stack entries appear only while Forge actually has a pending item.
    'body:has(.sol-battlefield) #sol-pod-hud-layout > #sol-pod-stack{',
    'position:relative!important;inset:auto!important;top:auto!important;',
    'right:auto!important;bottom:auto!important;left:auto!important;',
    'width:100%!important;max-width:100%!important;min-width:0!important;',
    'height:auto!important;max-height:34dvh!important;min-height:0!important;',
    'flex:1 1 auto!important;margin:0!important;overflow:hidden!important;',
    'box-sizing:border-box!important;pointer-events:auto!important;z-index:auto!important}',
    'body:has(.sol-battlefield) #sol-pod-hud-layout > #sol-pod-stack[data-empty="true"]{',
    'display:none!important}',
    'body:has(.sol-battlefield) #sol-pod-hud-layout #sol-pod-stack-cards{',
    'overflow-y:auto!important;overscroll-behavior:contain!important;min-height:0!important}',
    // Preserve mandatory Play/Draw, mulligan, mana, combat and priority
    // buttons. Their existing Forge handlers remain completely untouched.
    'body:has(.sol-battlefield) #sol-pod-hud-layout > #ct-forge-priority-buttons{',
    'position:relative!important;inset:auto!important;top:auto!important;',
    'right:auto!important;bottom:auto!important;left:auto!important;',
    'transform:none!important;width:100%!important;min-width:0!important;',
    'max-width:100%!important;box-sizing:border-box!important;',
    'margin: auto 0 0 0!important;max-height:31dvh!important;',
    'height:auto!important;overflow-y:auto!important;flex:0 0 auto!important;',
    'z-index:3!important;pointer-events:auto!important;box-shadow:0 7px 19px #000b!important}',
    'body:has(.sol-battlefield) #sol-pod-hud-layout > #ct-forge-priority-buttons.ct-forge-pregame{',
    'position:relative!important;top:auto!important;right:auto!important;',
    'bottom:auto!important;left:auto!important;margin:auto 0 0!important}',
    'body:has(.sol-battlefield) #sol-pod-hud-layout > #ct-forge-priority-buttons.ct-forge-hand-choice{',
    'max-height:35dvh!important;width:100%!important;max-width:100%!important}',
    // Hand discard/bottoming needs an above-hand Forge action dock.
    // The container itself stays click-through except on its actual controls.
    'body:has(.sol-battlefield) #sol-pod-hud-layout:has(.ct-forge-hand-choice){',
    'z-index:2147483000!important}',
    'body:has(.sol-battlefield.sol-roster-expanded) #sol-pod-hud-layout > #sol-pod-stack,',
    'body:has(.sol-battlefield.sol-roster-expanded) #sol-pod-hud-layout > #sol-pod-hub{',
    'visibility:hidden!important;pointer-events:none!important}',
    '@media(orientation:landscape) and (max-height:460px){',
    'body:has(.sol-battlefield) #sol-pod-hud-layout{top:20dvh;bottom:1.5dvh;',
    'gap:4px;width:23%;right:1%}',
    'body:has(.sol-battlefield) #sol-pod-hud-layout > #sol-pod-hub{',
    'max-height:19dvh!important}',
    'body:has(.sol-battlefield) #sol-pod-hud-layout > #sol-pod-stack{',
    'max-height:30dvh!important}',
    'body:has(.sol-battlefield) #sol-pod-hud-layout > #ct-forge-priority-buttons{',
    'max-height:34dvh!important}',
    '}',
    '@media(orientation:portrait){',
    'body:has(.sol-battlefield) #sol-pod-hud-layout{width:30%;top:18dvh;bottom:2dvh}',
    'body:has(.sol-battlefield) #sol-pod-hud-layout > #sol-pod-hub{',
    'max-height:18dvh!important}',
    'body:has(.sol-battlefield) #sol-pod-hud-layout > #sol-pod-stack{',
    'max-height:30dvh!important}',
    '}'
  ].join('');
  document.head.append(style);

  const hud=document.createElement('aside');
  hud.id='sol-pod-hud-layout';
  hud.setAttribute('aria-label','Sol Pod gameplay information and actions');
  document.body.append(hud);

  function layout(){
    // The three regions have a single ordering and sizing context. New
    // notifications or stack updates cannot float over Forge action buttons.
    for(const id of ['sol-pod-hub','sol-pod-stack','ct-forge-priority-buttons']){
      const el=document.getElementById(id);
      if(el&&el.parentNode!==hud)hud.append(el);
    }
  }
  let queued=false;
  function schedule(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;layout();});
  }
  // Stable sections are created in source order, but tolerate any later
  // Forge UI rebuild replacing a section without leaving a dead region.
  const observer=new MutationObserver(schedule);
  observer.observe(document.body,{childList:true,subtree:false});
  window.addEventListener('ct-forge-selection',schedule);
  window.addEventListener('ct-combat-queue-updated',schedule);
  layout();
  window.solPodHudLayout={refresh:layout};
})();