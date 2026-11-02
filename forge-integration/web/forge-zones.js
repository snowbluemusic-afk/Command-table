/* Foreground Zones panel. The battlefield is a separate stacking context,
 * so raising the nested drawer's z-index alone cannot fix overlap.
 */
(() => {
  'use strict';
  const root=document.getElementById('app');
  if(!root)return;
  const style=document.createElement('style');
  style.id='ct-zones-foreground-v018';
  style.textContent=[
    '.ct10-zone-rail.ct-zones-open .ct10-zone-drawer{visibility:hidden!important;pointer-events:none!important}',
    '#ct-floating-zones{position:fixed;inset:0;z-index:2147482800;display:none;background:#050b1070;pointer-events:auto}',
    '#ct-floating-zones[data-open="true"]{display:block}',
    '#ct-floating-zones .ct-floating-panel{position:fixed;display:grid!important;gap:10px;min-width:245px;',
    'max-width:min(330px,70vw);max-height:78dvh;overflow:auto;padding:14px 16px;background:#0e2830;',
    'border:1px solid #e4c18a;border-radius:15px;box-shadow:0 22px 65px #000e;color:#fce9cb;pointer-events:auto}',
    '#ct-floating-zones .ct-floating-head{display:flex;align-items:center;justify-content:space-between;gap:12px}',
    '#ct-floating-zones .ct-floating-head button{background:#263d45;color:#fbeac8;border:1px solid #ac9775;',
    'border-radius:8px;padding:5px 12px;font-size:16px;min-height:34px}',
    '#ct-floating-zones [data-action]{cursor:pointer;touch-action:manipulation}',
    '@media(orientation:landscape) and (max-height:540px){#ct-floating-zones .ct-floating-panel{max-height:87dvh}}'
  ].join('');
  document.head.append(style);
  const portal=document.createElement('div');
  portal.id='ct-floating-zones';
  portal.dataset.open='false';
  portal.setAttribute('role','dialog');
  portal.setAttribute('aria-label','Your commander zones');
  portal.setAttribute('aria-modal','true');
  document.body.append(portal);
  let railToggle=null, drag=null, suppressPortalClick=false;
  const close=()=>{
    if(window.app?.zonesOpen)window.CommandTableAction?.('toggleZones');
  };
  function position(){
    const panel=portal.querySelector('.ct-floating-panel');
    if(!panel||!railToggle)return;
    const rect=railToggle.getBoundingClientRect();
    panel.style.left=Math.max(6,Math.min(innerWidth-255,rect.right+8))+'px';
    panel.style.top=Math.max(6,Math.min(innerHeight-145,rect.top))+'px';
  }
  function sync(){
    if(!window.app?.nativeMatch||window.app?.view!=='game'||!window.app?.zonesOpen){
      portal.dataset.open='false';portal.replaceChildren();railToggle=null;return;
    }
    const rail=root.querySelector('.ct10-zone-rail');
    const original=rail?.querySelector('.ct10-zone-drawer');
    railToggle=rail?.querySelector('.ct-zone-toggle');
    if(!original||!railToggle){portal.dataset.open='false';return;}
    const clone=original.cloneNode(true);
    clone.classList.add('ct-floating-panel');
    clone.style.display='grid';
    clone.setAttribute('aria-label','Command zone, graveyard, library and exile');
    const header=document.createElement('div');
    header.className='ct-floating-head';
    const title=document.createElement('strong');title.textContent='YOUR ZONES';
    const exit=document.createElement('button');exit.type='button';
    exit.textContent='×';exit.setAttribute('aria-label','Close zones');
    exit.onclick=close;
    header.append(title,exit);
    clone.querySelector('strong')?.remove();
    clone.prepend(header);
    portal.replaceChildren(clone);
    portal.dataset.open='true';
    position();
  }
  portal.addEventListener('click',event=>{
    if(suppressPortalClick){suppressPortalClick=false;event.preventDefault();event.stopImmediatePropagation();return;}
    if(event.target===portal){event.preventDefault();close();return;}
    const item=event.target.closest('[data-action]');
    if(item){event.preventDefault();window.CommandTableAction?.(item.dataset.action,item.dataset.value||'');}
  });
  // Preserve the commander's drag-to-cast affordance when its button is
  // rendered in the topmost portal instead of within #app.
  portal.addEventListener('pointerdown',event=>{
    const source=event.target.closest('[data-drag-commander]');
    if(source)drag={x:event.clientX,y:event.clientY};
  });
  portal.addEventListener('pointerup',event=>{
    if(!drag)return;
    const start=drag;drag=null;
    if(Math.hypot(event.clientX-start.x,event.clientY-start.y)<45)return;
    suppressPortalClick=true;
    setTimeout(()=>{suppressPortalClick=false;},240);
    event.preventDefault();event.stopPropagation();
    window.CommandTableNative?.request?.('game.command',{action:'castCommander',value:null})
      .then(()=>window.CommandTableNative?.request?.('game.snapshot'))
      .then(result=>{if(result?.game)window.ctReceiveForgeState?.(result.game);close();})
      .catch(error=>window.announce?.('Could not cast commander: '+error.message));
  });
  portal.addEventListener('pointercancel',()=>{drag=null;});
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&portal.dataset.open==='true'){event.preventDefault();close();}
  },true);
  window.addEventListener('resize',position);
  new MutationObserver(sync).observe(root,{childList:true,subtree:false});
  window.ctFloatingZones={sync,close};
  sync();
})();