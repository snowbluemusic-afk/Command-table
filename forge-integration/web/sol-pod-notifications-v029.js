/* v0.29 central dismissible Forge notices */
(() => {
 'use strict';
 const css=document.createElement('style');
 css.id='sol-pod-notifications-v029';
 css.textContent="\n#sol-pod-notices{position:fixed;top:29%;right:1%;width:22%;max-height:32dvh;z-index:220050;display:flex;flex-direction:column;gap:5px;overflow-y:auto;overflow-x:hidden;scrollbar-width:thin;pointer-events:none}\n#sol-pod-notices:empty{display:none!important}\n#sol-pod-notices .sol-notice{position:relative;background:#112538f2;border:1px solid #bda572;border-left:3px solid #e6bd73;border-radius:10px;box-shadow:0 6px 17px #000a;padding:7px 32px 7px 10px;color:#f9e5c4;line-height:1.24;font:600 clamp(10px,.88vw,14px) system-ui;overflow-wrap:anywhere;pointer-events:auto;min-height:35px}\n#sol-pod-notices .sol-notice[data-kind=\"combat\"]{border-left-color:#fbc575}\n#sol-pod-notices .sol-notice[data-kind=\"mana\"]{border-left-color:#81d5fe}\n#sol-pod-notices .sol-notice[data-kind=\"art\"]{border-left-color:#8ddfbe}\n#sol-pod-notices .sol-notice[data-kind=\"error\"]{border-left-color:#ff858f;color:#fff0e8}\n#sol-pod-notices .sol-notice button{position:absolute;right:5px;top:4px;width:26px;height:26px;border:1px solid #cbbd9a!important;border-radius:8px;background:#273547!important;color:#ffebc9!important;font-size:18px;cursor:pointer;touch-action:manipulation}\nbody:has(.sol-battlefield) #ct-art-status,body:has(.sol-battlefield) #ct-direct-combat-hint{display:none!important}\nbody:has(.sol-battlefield) #ct-forge-legal-actions{top:42%!important;bottom:auto!important;right:1%!important;left:auto!important;width:22%!important;max-width:22%!important;max-height:18dvh!important;overflow-y:auto!important;z-index:220040!important}\nbody:has(.sol-battlefield) .app-shell .notice{position:fixed!important;top:29%!important;left:auto!important;right:1%!important;width:22%!important;max-width:22%!important;max-height:15dvh!important;z-index:220040!important;overflow:auto!important;background:#14263af2!important;border:1px solid #ddbc85!important}\nbody:has(.sol-battlefield) .ct10-combat-notice{right:1%!important;left:auto!important;top:43%!important;max-width:22%!important;max-height:16dvh!important;overflow:auto!important}\nbody:has(.sol-battlefield) .ct10-watch-pill{top:21%!important;right:1%!important;left:auto!important}\n@media(orientation:landscape) and (max-height:430px){#sol-pod-notices{top:26%;max-height:37dvh;gap:3px}#sol-pod-notices .sol-notice{font-size:10px;min-height:27px;padding:4px 28px 4px 7px}#sol-pod-notices .sol-notice button{height:21px;width:22px;font-size:15px}}\n";
 document.head.append(css);
 const host=document.createElement('aside');
 host.id='sol-pod-notices';
 host.setAttribute('aria-label','Game notifications');
 host.setAttribute('aria-live','polite');
 document.body.append(host);
 const entries=new Map(),dismissed=new Map();
 const legacy=window.ctNativeToast;
 const game=()=>window.app?.nativeMatch&&window.app?.view==='game';
 const normalize=s=>String(s||'').replace(/\s+/g,' ').trim().slice(0,380);
 function dismiss(key){entries.get(key)?.remove();entries.delete(key);dismissed.set(key,Date.now()+45000);}
 host.addEventListener('click',event=>{
  const key=event.target.closest('[data-dismiss-notice]')?.getAttribute('data-dismiss-notice');
  if(key){event.preventDefault();event.stopPropagation();dismiss(key);}
 });
 const issue=(message,kind='info',key=null)=>{
  if(!game())return false;
  const text=normalize(message);if(!text)return false;
  // Imperative instructions are not game HISTORY. Forward them to the
  // structured full-screen action router; it only exposes options/approvals
  // that Forge actually supplied, or a recovery path if choices are missing.
  const requiresPlayer=/^(?:please\s+)?(?:choose|select|approve|confirm|discard|sacrifice|pay|tap|assign|cancel\s+pending|refresh\s+forge)\b/i.test(text);
  if(requiresPlayer&&window.ctForgeRequiredAction?.onNotice?.(text))return true;
  key=key||kind+':'+text;
  // New gameplay errors must never be hidden by a previously dismissed hint.
  // The same key can be reused for a later, more serious event.
  for(const [k,expiry] of dismissed)if(expiry<=Date.now())dismissed.delete(k);
  if(kind!=='error'&&(dismissed.get(key)||0)>Date.now())return true;
  let item=entries.get(key);
  if(!item){
   item=document.createElement('div');item.className='sol-notice';item.dataset.kind=kind;
   const words=document.createElement('span');words.className='sol-notice-text';
   const close=document.createElement('button');close.type='button';
   close.setAttribute('aria-label','Dismiss notification');
   close.textContent='×';close.setAttribute('data-dismiss-notice',key);
   item.append(words,close);host.prepend(item);entries.set(key,item);
   if(entries.size>20){
     // Prefer evicting an informational event rather than an error.
     const oldestInfo=[...entries].find(([,node])=>node.dataset.kind!=='error')?.[0];
     const oldest=oldestInfo||[...entries.keys()][0];
     if(oldest) {
       entries.get(oldest)?.remove();
       entries.delete(oldest);
     }
   }
  }
  item.querySelector('.sol-notice-text').textContent=text;
  return true;
 };
 window.solPodNotice=issue;
 window.solPodDismissNotices=()=>{for(const key of [...entries.keys()])dismiss(key);};
 if(typeof legacy==='function')window.ctNativeToast=msg=>{
  if(!issue(msg,/error|rejected|failed|cannot|stuck/i.test(String(msg))?'error':'info'))legacy(msg);
 };
 const oldAnnounce=window.announce;
 if(typeof oldAnnounce==='function')window.announce=msg=>{
  if(!issue(msg,/error|cannot|failed|rejected/i.test(String(msg))?'error':'info'))oldAnnounce(msg);
 };
 let lastArt='',artNode=null,artObserver=null;
 function checkArt(){
  if(!game())return;
  const el=document.getElementById('ct-art-status');if(!el)return;
  const txt=normalize(el.textContent);
  const visible=el.getAttribute('data-loading')==='true'&&!!txt;
  if(visible){
   if(txt!==lastArt){lastArt=txt;issue(txt,'art','art-status');}
   else if(entries.has('art-status'))issue(txt,'art','art-status');
  }else{entries.get('art-status')?.remove();entries.delete('art-status');lastArt='';}
  if(artNode!==el&&typeof MutationObserver!=='undefined'){
   artObserver?.disconnect();artObserver=new MutationObserver(checkArt);
   artObserver.observe(el,{attributes:true,characterData:true,childList:true,subtree:true});artNode=el;
  }
 }
 window.solPodSyncNotices=checkArt;checkArt();
})();