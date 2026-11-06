/* Sol Pod v0.61 — visual Aura/Equipment stacks from Forge CardView.attachedTo.
 * Display only: never move, merge, retarget or activate a real game object.
 */
(()=>{
 'use strict';
 if(window.solPodAttachmentStacks)return;
 const css=document.createElement('style');css.id='sol-attached-stacks-v061-css';
 css.textContent=[
 '.sol-battlefield .ct10-lane.ct10-creatures .sol-attached-host{position:relative;',
 'flex:0 0 clamp(58px,7.3vw,129px);min-width:58px;height:96%;',
 'display:flex;align-items:center;justify-content:flex-start;overflow:visible}',
 '.sol-battlefield .ct10-lane.ct10-creatures .sol-attached-host>.game-card{',
 'position:relative;z-index:4;flex:0 0 auto!important;',
 'height:88%!important;width:calc(100% - 17px)!important;max-width:calc(100% - 17px)!important}',
 '.sol-battlefield .ct10-lane.ct10-creatures .sol-attachment-peek{position:absolute;',
 'top:12%;height:79%;width:calc(100% - 18px);border:2px solid #c6b2d6;',
 'border-radius:6px;background:linear-gradient(145deg,#735f81,#233646 70%);',
 'pointer-events:none;box-shadow:0 2px 8px #0009}',
 '.sol-battlefield .sol-attachment-peek[data-aura="true"]{border-color:#aee0fb;',
 'background:linear-gradient(145deg,#3b657b,#244560)}',
 '.sol-battlefield .sol-attachment-count{position:absolute;z-index:9;',
 'top:0;right:0;min-width:29px;min-height:25px;padding:3px 5px;',
 'border:1px solid #f1d7a2;border-radius:8px;background:#233b4bf3;',
 'color:#fff1c6;font:850 11px system-ui;box-shadow:0 3px 9px #0009;',
 'cursor:pointer;touch-action:manipulation}',
 '.sol-battlefield .sol-attachment-count:focus-visible{outline:3px solid #fff8c4}',
 '#sol-attachment-viewer{display:none;position:fixed;inset:0;z-index:2147483300;',
 'background:#050e18e9;align-items:center;justify-content:center;',
 'padding:8px;box-sizing:border-box}',
 '#sol-attachment-viewer[data-open="true"]{display:flex}',
 '#sol-attachment-viewer>section{width:min(96vw,860px);max-height:95dvh;',
 'overflow-y:auto;padding:clamp(11px,2vw,20px);border:2px solid #e6bf84;',
 'border-radius:16px;background:#152534;color:#f6e7d4;font:12px system-ui}',
 '#sol-attachment-viewer h2{font:800 clamp(17px,2vw,24px) Georgia,serif;margin:0}',
 '#sol-attachment-viewer p{color:#c4d5d6;font-size:12px;line-height:1.4}',
 '#sol-attachment-viewer .sol-attach-reader-top{display:flex;justify-content:space-between;',
 'align-items:center;gap:12px}',
 '#sol-attachment-viewer button{min-height:36px;padding:7px 10px;',
 'border:1px solid #d2ba90;border-radius:9px;background:#314754;',
 'color:#fff0d2;font:750 12px system-ui}',
 '#sol-attachment-viewer .sol-attach-reader-grid{display:grid;',
 'grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:12px;',
 'margin-top:12px}',
 '#sol-attachment-viewer article{border:1px solid #827f79;border-radius:11px;',
 'padding:10px;min-width:0;background:#1d303b}',
 '#sol-attachment-viewer article img{display:block;width:100%;max-height:180px;',
 'object-fit:contain;margin-bottom:7px}',
 '#sol-attachment-viewer article strong{font-size:14px;color:#f5d39b}',
 '#sol-attachment-viewer article small{display:block;color:#a3e8e8;margin:3px 0}',
 '#sol-attachment-viewer article p{white-space:pre-wrap;overflow-wrap:anywhere}',
 '@media(orientation:landscape) and (max-height:440px){',
 '.sol-battlefield .ct10-lane.ct10-creatures .sol-attached-host{min-width:55px;flex-basis:68px}',
 '.sol-battlefield .sol-attachment-count{font-size:10px;min-height:22px;padding:2px 4px}}'
 ].join('');document.head.append(css);
 const overlay=document.createElement('div');overlay.id='sol-attachment-viewer';
 overlay.dataset.open='false';overlay.setAttribute('role','dialog');
 overlay.setAttribute('aria-modal','true');
 overlay.setAttribute('aria-label','Creature and attached cards');
 const pane=document.createElement('section');const heading=document.createElement('div');
 heading.className='sol-attach-reader-top';
 const title=document.createElement('h2');const close=document.createElement('button');
 close.textContent='✕ Close';close.type='button';
 close.onclick=()=>hide();heading.append(title,close);
 const desc=document.createElement('p');const grid=document.createElement('div');
 grid.className='sol-attach-reader-grid';pane.append(heading,desc,grid);overlay.append(pane);
 document.body.append(overlay);
 const node=(tag,content)=>{
   const el=document.createElement(tag);if(content!=null)el.textContent=String(content);
   return el;
 };
 const cards=()=>window.app?.game?.players?.flatMap((p,seat)=>
    (p.battlefield||[]).map(c=>({...c,seat})))||[];
 const idOf=c=>String(c.forgeId??c.id??c.uid??'');
 const linkOf=c=>c?.attachedToId==null?'':String(c.attachedToId);
 let selected='';
 function findGroup(creatureId){
   const all=cards(),creature=all.find(c=>idOf(c)===String(creatureId));
   if(!creature)return null;
   const attached=all.filter(c=>linkOf(c)===String(creatureId) &&
      idOf(c)!==String(creatureId));
   return attached.length?{creature,attached}:null;
 }
 function appendCard(c,index){
   const article=node('article');const name=node('strong',c.name||'Face-down card');
   const kind=String(window.ctForgeCards?.[String(c.name||'').toLowerCase()]?.type||'');
   const type=node('small',index===0?'Creature · host':
     /Equipment/i.test(kind)?'Equipment':/Aura/i.test(kind)?'Aura':'Attached permanent');
   const image=node('img');image.alt=String(c.name||'Card');
   image.loading='lazy';image.onerror=()=>{image.style.display='none';};
   const url=window.ctCardArtUrl?.(c.name);
   if(url && !c.faceDown)image.src=url;
   else image.style.display='none';
   const rules=window.ctForgeCards?.[String(c.name||'').toLowerCase()]?.text||'';
   article.append(image,name,type,node('p',rules||
     (c.faceDown?'Face-down permanent.':'Full card text not available in this snapshot.')));
   grid.append(article);
 }
 function show(id){
   const group=findGroup(id);if(!group)return false;
   selected=String(id);title.textContent=group.creature.name+' · Attached cards';
   desc.textContent=group.attached.length+' attachment'+
     (group.attached.length===1?'':'s')+
     '. Every card remains an independent Forge permanent. Inspect the attached cards below.';
   grid.replaceChildren();
   appendCard(group.creature,0);
   for(const c of group.attached)appendCard(c,1);
   overlay.dataset.open='true';close.focus();return true;
 }
 function hide(){overlay.dataset.open='false';selected='';}
 overlay.addEventListener('click',e=>{if(e.target===overlay)hide();});
 document.addEventListener('keydown',e=>{
   if(e.key==='Escape'&&overlay.dataset.open==='true'){
     e.preventDefault();e.stopImmediatePropagation();hide();
   }
 },true);
 function addInspectorAction(){
   // A normal creature tap still opens its existing inspector. Add an explicit
   // companion action so attachments are discoverable without stealing a
   // click that Forge needs for an attack, block, target or activation.
   if(window.app?.modal!=='inspect')return;
   const id=window.app?.inspectForgeId;
   if(!Number.isInteger(Number(id)))return;
   const group=findGroup(id);
   if(!group)return;
   const dialog=document.querySelector('.modal[role="dialog"]');
   if(!dialog||dialog.querySelector('.sol-view-attachments'))return;
   const button=node('button','View '+group.attached.length+' attached card'+
      (group.attached.length===1?'':'s')+' ↗');
   button.type='button';button.className='secondary full sol-view-attachments';
   button.style.cssText='display:block;margin:10px 0;border:1px solid #d4b880';
   button.onclick=e=>{e.preventDefault();e.stopPropagation();show(id);};
   const info=dialog.querySelector('.inspect-layout');
   if(info)info.insertAdjacentElement('afterend',button);
   else dialog.append(button);
 }
 function update(){
   addInspectorAction();
   if(!window.app?.nativeMatch||window.app?.view!=='game'){hide();return;}
   const all=cards();
   const grouped=new Map();
   for(const c of all)if(linkOf(c)){
     const key=linkOf(c),list=grouped.get(key)||[];
     list.push(c);grouped.set(key,list);
   }
   const lanes=document.querySelectorAll('.sol-board-row.sol-creatures .ct10-lane');
   for(const lane of lanes){
     // The card node remains untouched: Forge target, attacks, blocks and
     // drag gestures still use the original ID and handler.
     for(const cardEl of Array.from(lane.children)){
       if(!cardEl.classList?.contains('game-card'))continue;
       const key=String(cardEl.getAttribute('data-value')||'').split(':').at(-1);
       const attached=grouped.get(key);
       if(!attached?.length)continue;
       const host=node('div');host.className='sol-attached-host';
       host.dataset.hostId=key;
       const peeks=attached.slice(0,3);
       peeks.forEach((c,index)=>{
         const peek=node('span');
         peek.className='sol-attachment-peek';
         const kind=String(window.ctForgeCards?.[String(c.name||'').toLowerCase()]?.type||'');
         peek.dataset.aura=String(/Aura/i.test(kind));
         peek.style.left=(7+(index+1)*3)+'px';
         peek.style.zIndex=String(index+1);
         peek.title=c.name;
         host.append(peek);
       });
       const badge=node('button','+'+attached.length);
       badge.type='button';badge.className='sol-attachment-count';
       badge.setAttribute('aria-label','Inspect '+attached.length+' cards attached to creature');
       badge.onclick=e=>{e.preventDefault();e.stopImmediatePropagation();show(key);};
       lane.insertBefore(host,cardEl);host.append(cardEl,badge);
     }
   }
   if(selected&&overlay.dataset.open==='true'){
     if(!findGroup(selected))hide();
     else show(selected);
   }
 }
 let queued=false;
 const root=document.getElementById('app');
 if(root)new MutationObserver(()=>{
   if(queued)return;queued=true;
   requestAnimationFrame(()=>{queued=false;update();});
 }).observe(root,{childList:true,subtree:false});
 window.solPodAttachmentStacks={refresh:update,open:show,close:hide,
   get attachments(){return cards().filter(c=>linkOf(c));}};
 update();
})();
