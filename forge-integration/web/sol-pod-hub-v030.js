/* v0.30 one stable right side information surface */
(() => {
 'use strict';
 const style=document.createElement('style');
 style.id='sol-pod-hub-v030';
 style.textContent="\n#sol-pod-hub{position:fixed;top:24%;right:1%;width:22%;max-height:35dvh;z-index:220080;background:linear-gradient(165deg,#152638f8,#0b1b2af9);color:#f9e9d0;border:1.5px solid #d6b478;border-radius:12px;box-shadow:0 7px 24px #000a;display:flex;flex-direction:column;overflow:hidden;pointer-events:auto}\nbody:not(:has(.sol-battlefield)) #sol-pod-hub{display:none!important}\n#sol-pod-hub-header{display:flex;flex:none;align-items:center;gap:5px;justify-content:space-between;padding:5px 8px;border-bottom:1px solid #dfbf8557;color:#f6d89c;font:800 clamp(10px,.85vw,14px) Georgia,serif;letter-spacing:.04em}\n#sol-pod-hub-header button{font:700 11px system-ui;min-height:25px;border:1px solid #a99679;background:#26384a;color:#f2ddbd;border-radius:8px;padding:2px 7px;cursor:pointer}\n#sol-pod-hub-content{display:flex;flex-direction:column;gap:4px;min-height:0;overflow-y:auto;padding:5px 7px;scrollbar-width:thin;overscroll-behavior:contain}\n#sol-pod-hub #sol-pod-notices{position:static!important;width:100%!important;max-width:none!important;height:auto!important;max-height:17dvh!important;min-height:0!important;overflow-y:auto!important;order:1!important;z-index:auto!important;pointer-events:auto!important}\n#sol-pod-hub .ct-native-stack{position:static!important;inset:auto!important;transform:none!important;width:100%!important;max-width:100%!important;max-height:18dvh!important;overflow:auto!important;order:2!important;box-shadow:none!important;margin:0!important;border:1px solid #c4a7787a!important;border-radius:9px!important}#sol-pod-hub #ct-forge-legal-actions{position:static!important;inset:auto!important;top:auto!important;left:auto!important;right:auto!important;bottom:auto!important;width:100%!important;max-width:none!important;min-width:0!important;max-height:23dvh!important;margin:0!important;overflow-y:auto!important;z-index:auto!important;box-sizing:border-box;box-shadow:none!important;border:1px solid #c5a06b!important;order:2!important}\n#sol-pod-hub #ct-forge-legal-actions .ct-forge-choices{max-height:16dvh!important;overflow:auto!important}\n#sol-pod-hub #sol-pod-notices .sol-notice{padding:5px 30px 5px 8px!important;min-height:25px!important;max-height:16dvh!important;overflow-y:auto!important;font-size:clamp(10px,.8vw,13px)!important}\n#sol-pod-hub.sol-empty{opacity:.88}\n#sol-pod-hub.sol-empty #sol-pod-hub-content{display:none!important}\n#ct-forge-decision-sheet{inset:0!important;width:100vw!important;max-width:100vw!important;height:100dvh!important;max-height:100dvh!important;padding:clamp(8px,2vh,18px)!important;align-items:center!important;justify-content:center!important;overflow:auto!important;background:#020712d9!important;z-index:2147483000!important}\n#ct-forge-decision-sheet>div{width:min(94vw,1000px)!important;max-width:1000px!important;max-height:92dvh!important;padding:clamp(10px,1.8vh,18px)!important;box-sizing:border-box}\nbody:has(.sol-battlefield) #ct-native-toast,body:has(.sol-battlefield) #ct-direct-combat-hint,body:has(.sol-battlefield) #ct-art-status{display:none!important}\nbody:has(.sol-battlefield) .app-shell .notice{display:none!important}\nbody:has(.sol-battlefield) .ct10-combat-notice{display:none!important}\nbody:has(.sol-battlefield) #ct-forge-priority-buttons:not(.ct-forge-pregame){right:1%!important;bottom:3%!important;max-height:37dvh!important}\n@media(orientation:landscape) and (max-height:440px){#sol-pod-hub{top:22%;max-height:33dvh}#sol-pod-hub-header{padding:3px 6px}#sol-pod-hub-content{padding:3px 5px;gap:2px}#sol-pod-hub #sol-pod-notices{max-height:16dvh!important}#ct-forge-decision-sheet{top:0!important;max-height:100dvh!important}#ct-forge-decision-sheet>div{max-height:92dvh!important}}\n";
 // The Game Log is read-only history: no legal-choice controls and no
 // actionable recoveries may be placed inside it. Those live in modals.
 style.textContent+='\n#sol-pod-hub.sol-log-collapsed #sol-pod-hub-content{display:none!important}'+
  '#sol-pod-hub-header .sol-log-title{flex:1;min-width:0}'+
  '#ct-forge-legal-actions{display:none!important}';
 document.head.append(style);
 const hub=document.createElement('section');
 hub.id='sol-pod-hub';
 hub.setAttribute('aria-label','Read-only history of Sol Pod game events');
 hub.innerHTML='<div id="sol-pod-hub-header"><span class="sol-log-title">✦ GAME LOG</span>'+
   '<button type="button" id="sol-pod-log-toggle" aria-expanded="false">View log</button>'+
   '<button type="button" id="sol-pod-clear-info">Clear</button></div>'+
   '<div id="sol-pod-hub-content"></div>';
 document.body.append(hub);
 const contents=hub.querySelector('#sol-pod-hub-content');
 const toggle=hub.querySelector('#sol-pod-log-toggle');
 const clearButton=hub.querySelector('#sol-pod-clear-info');
 const heading=hub.querySelector('.sol-log-title');
 let logOpen=false;
 const move=()=>{
   const notices=document.getElementById('sol-pod-notices');
   // Only informational records enter this rail. Do not relocate Forge's
   // live selection panel, prompt buttons or stack into Game Log.
   if(notices&&notices.parentNode!==contents)contents.append(notices);
   const hasInfo=!!notices?.children?.length;
   hub.classList.toggle('sol-no-active-choices',true);
   hub.classList.toggle('sol-log-collapsed',!logOpen);
   hub.classList.toggle('sol-empty',!hasInfo);
   heading.textContent='✦ GAME LOG';
   toggle.hidden=!hasInfo;
   toggle.textContent=logOpen?'Hide log':'View '+notices.children.length;
   toggle.setAttribute('aria-expanded',String(logOpen));
   clearButton.hidden=!hasInfo||!logOpen;
 };
 toggle.onclick=()=>{logOpen=!logOpen;move();};
 clearButton.onclick=()=>{
   // Log controls never answer, cancel or dismiss a Forge choice.
   window.solPodDismissNotices?.();
   move();
 };
 const observer=new MutationObserver(move);
 observer.observe(contents,{childList:true,subtree:true,attributes:true,attributeFilter:['style','class']});
 const root=document.getElementById('app');
 if(root)new MutationObserver(()=>move()).observe(root,{childList:true,subtree:false});
 move();
 window.solPodHub={refresh:move};
})();