/* Sol Pod v0.57 — player-readable build identity.
 * Helps diagnose stale sideloads without exposing internal engine branding.
 */
(() => {
 'use strict';
 window.SOL_POD_BUILD='0.57.0';
 if(document.getElementById('sol-pod-build-marker'))return;
 const css=document.createElement('style');
 css.id='sol-pod-build-style';
 css.textContent=[
  '#sol-pod-build-marker{display:none;position:fixed;top:6.1dvh;left:10.3vw;',
  'z-index:220050;pointer-events:none;color:#e6c99a;opacity:.72;',
  'font:600 clamp(9px,1.0vw,11px) system-ui;letter-spacing:.07em}',
  'body:has(.sol-battlefield) #sol-pod-build-marker{display:block}',
  '@media(orientation:portrait){#sol-pod-build-marker{top:8dvh;left:14vw}}'
 ].join('');
 document.head.append(css);
 const tag=document.createElement('span');
 tag.id='sol-pod-build-marker';
 tag.textContent='v0.57';
 tag.setAttribute('aria-label','Sol Pod build version 0.57');
 document.body.append(tag);
})();