/* Visible card-backs while art is loading. No gameplay state is modified. */
(() => {
  'use strict';
  const css=document.createElement('style');
  css.id='ct-card-art-loading-css';
  css.textContent=[
    '@keyframes ct-art-pulse{0%{background-position:100% 0}100%{background-position:0 0}}',
    'img.ct-art-loading{background:linear-gradient(115deg,#16303c 12%,',
    '#8b744f 33%,#203e48 49%,#8b744f 65%,#16303c 85%);',
    'background-size:260% 100%;animation:ct-art-pulse 1.6s ease-in-out infinite;',
    'border:1px solid #ac936355;box-sizing:border-box}',
    '.game-card.ct-art-missing,.ct-zb-card.ct-art-missing,',
    '.ct-zb-detail.ct-art-missing{background:linear-gradient(145deg,#284149,#111c27)!important}',
    '.game-card.ct-art-missing:before,.ct-zb-card.ct-art-missing:before{content:"✦";',
    'display:grid;place-items:center;color:#dfc18e;font-size:22px;opacity:.6}',
    '#ct-art-status{display:none;position:fixed;top:calc(env(safe-area-inset-top) + 58px);',
    'left:50%;transform:translateX(-50%);z-index:220001;pointer-events:none;',
    'padding:6px 12px;background:#142d36eb;border:1px solid #a58a6170;',
    'border-radius:12px;color:#f4ddad;box-shadow:0 6px 20px #0009;',
    'font:650 11px system-ui;white-space:nowrap}',
    '#ct-art-status[data-loading="true"]{display:block}',
    '@media(prefers-reduced-motion:reduce){img.ct-art-loading{animation:none}}'
  ].join('');
  document.head.append(css);
  const status=document.createElement('div');
  status.id='ct-art-status';
  status.setAttribute('role','status');
  status.setAttribute('aria-live','polite');
  status.dataset.loading='false';
  document.body.append(status);
  const selector=[
    '.ct10-stage img[data-art-name]',
    '.ct10-stage .game-card img',
    '#ct-zone-browser img',
    '#ct-cast-preview img',
    '#ct-forge-decision-sheet img',
    '.ct-hand-browser img'
  ].join(',');
  let queued=false;
  function visible(img){
    if(img.loading==='lazy'){
      const rect=img.getBoundingClientRect();
      return rect.bottom>=0&&rect.top<=innerHeight &&
             rect.right>=0&&rect.left<=innerWidth;
    }
    return true;
  }
  function refreshStatus(){
    let count=0;
    if(window.app?.view==='game'){
      for(const img of document.querySelectorAll(selector))
        if(img.classList.contains('ct-art-loading')&&visible(img))count++;
    }
    status.dataset.loading=count?'true':'false';
    status.textContent=count?'✦ Loading card art · '+count+' remaining':'';
  }
  function track(img){
    const src=img.getAttribute('src')||'';
    if(img.dataset.ctArtSrc===src)return;
    img.dataset.ctArtSrc=src;
    img.classList.remove('ct-art-loading');
    img.parentElement?.classList.remove('ct-art-missing');
    if(!src){refreshStatus();return;}
    const loaded=()=>{img.classList.remove('ct-art-loading');refreshStatus();};
    const missing=()=>{
      img.classList.remove('ct-art-loading');
      img.parentElement?.classList.add('ct-art-missing');
      refreshStatus();
    };
    if(img.complete){
      if(img.naturalWidth>0)loaded(); else missing();
    }else{
      img.classList.add('ct-art-loading');
      // Leave original inline onerror/fallback in place; the card name remains
      // visible even if artwork cannot be retrieved.
      img.addEventListener('load',loaded,{once:true});
      img.addEventListener('error',missing,{once:true});
    }
  }
  function scan(){
    queued=false;
    for(const img of document.querySelectorAll(selector))track(img);
    refreshStatus();
  }
  function schedule(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(scan);
  }
  const observer=new MutationObserver(schedule);
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['src']});
  window.addEventListener('resize',refreshStatus);
  window.ctArtLoading={refresh:schedule};
  schedule();
})();