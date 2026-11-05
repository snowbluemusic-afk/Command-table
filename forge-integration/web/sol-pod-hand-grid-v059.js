/* Sol Pod v0.59 — native-hand grid for large Commander game states.
 * Presentation only. Every card keeps its original Forge hand index and ID.
 * Does not compute legality, change turn order, pay mana, or answer prompts.
 */
(()=>{
 'use strict';
 if(window.solPodHandGrid)return;
 const state={open:false,query:'',filter:'all',sort:'original',selected:null,signature:''};
 const style=document.createElement('style');
 style.id='sol-hand-grid-v059-style';
 style.textContent=[
 '.sol-hand-grid-launch{border:1px solid #d6bb80;border-radius:9px;background:#1d3743;color:#fff0d8;',
 'font:750 11px system-ui;min-height:35px;padding:6px 11px;cursor:pointer;white-space:nowrap;z-index:8}',
 '.sol-hand-grid-launch:focus-visible,#sol-hand-grid button:focus-visible,#sol-hand-grid input:focus-visible{outline:3px solid #ffe1a2}',
 '#sol-hand-grid{display:none;position:fixed;inset:0;background:#051015e9;z-index:2147482000;',
 'padding:clamp(7px,2vw,18px);box-sizing:border-box;align-items:center;justify-content:center;pointer-events:auto}',
 '#sol-hand-grid[data-open="true"]{display:flex}',
 '#sol-hand-grid-panel{width:min(98vw,1150px);height:min(95dvh,800px);border:2px solid #cdb27c;',
 'border-radius:16px;background:#172a32;box-shadow:0 20px 65px #000e;color:#f7eddc;',
 'display:flex;flex-direction:column;overflow:hidden;font-family:system-ui}',
 '#sol-hand-grid-head{display:flex;gap:12px;align-items:center;justify-content:space-between;',
 'padding:10px 14px;background:#243e48;border-bottom:1px solid #6c8584}',
 '#sol-hand-grid-head h2{font:800 clamp(17px,2vw,25px) Georgia,serif;margin:0}',
 '#sol-hand-grid-head small{display:block;font:600 10px system-ui;color:#c2d6d7;margin-top:3px}',
 '#sol-hand-grid-head button,#sol-hand-grid-tools button,#sol-hand-grid-detail button{min-height:40px;',
 'padding:7px 11px;border:1px solid #af9873;border-radius:8px;background:#344b53;',
 'color:#fff3df;font:750 12px system-ui;cursor:pointer}',
 '#sol-hand-grid-tools{display:flex;gap:7px;align-items:center;flex-wrap:wrap;padding:8px 11px;',
 'border-bottom:1px solid #607d7b}',
 '#sol-hand-grid-search{background:#0d2029;color:#fff;border:1px solid #829b9b;border-radius:9px;',
 'min-height:39px;padding:8px;flex:2 1 160px;font-size:14px}',
 '#sol-hand-grid-tools button[data-active="true"]{background:#c8a877;color:#132831}',
 '#sol-hand-grid-content{min-height:0;display:grid;grid-template-columns:minmax(0,1fr) minmax(165px,26%);flex:1}',
 '#sol-hand-grid-list{overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(114px,1fr));',
 'align-content:start;gap:10px;padding:12px;scrollbar-width:thin}',
 '.sol-hand-grid-card{display:flex;flex-direction:column;gap:4px;text-align:left;background:#1c3640;',
 'border:1px solid #617980;border-radius:10px;color:#f5e8d0;padding:6px;cursor:pointer;min-width:0}',
 '.sol-hand-grid-card[data-selected="true"]{border:2px solid #edc077;background:#2c4a52}',
 '.sol-hand-grid-card[data-legal="true"]{box-shadow:inset 0 0 0 2px #65c5b7}',
 '.sol-hand-grid-card img{width:100%;height:clamp(80px,19dvh,170px);object-fit:cover;',
 'border-radius:6px;background:#1b272e}',
 '.sol-hand-grid-card b{font:750 11px/1.3 system-ui;overflow-wrap:anywhere}',
 '.sol-hand-grid-card small{font:650 10px system-ui;color:#c8d6d3}',
 '#sol-hand-grid-detail{overflow:auto;border-left:1px solid #607d7b;padding:14px;',
 'display:flex;flex-direction:column;gap:10px}',
 '#sol-hand-grid-detail h3{font:800 clamp(17px,2vw,24px) Georgia,serif;margin:0}',
 '#sol-hand-grid-detail p{white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.5 system-ui;margin:0}',
 '#sol-hand-grid-detail img{max-height:25dvh;max-width:100%;object-fit:contain;align-self:center}',
 '#sol-hand-grid-detail button{background:#e1bb81;color:#132831;font-weight:800}',
 '#sol-hand-grid-empty{color:#d0d9d8;padding:20px;font:13px system-ui}',
 '@media(max-height:520px){#sol-hand-grid-head{padding:6px 10px}#sol-hand-grid-tools{padding:5px 9px}',
 '#sol-hand-grid-list{grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:6px;padding:7px}',
 '#sol-hand-grid-detail{padding:8px}#sol-hand-grid-detail img{display:none}}',
 '@media(orientation:portrait){#sol-hand-grid-content{grid-template-columns:1fr}',
 '#sol-hand-grid-detail{border-left:0;border-top:1px solid #607d7b;max-height:27dvh;padding:8px}',
 '#sol-hand-grid-detail img{display:none}#sol-hand-grid-list{grid-template-columns:repeat(3,minmax(0,1fr))}}'
 ].join('');
 document.head.append(style);
 const create=(tag,text,cls)=>{
   const node=document.createElement(tag);
   if(text!==undefined&&text!==null)node.textContent=String(text);
   if(cls)node.className=cls;
   return node;
 };
 const button=(text,callback,cls)=>{
   const b=create('button',text,cls);b.type='button';b.addEventListener('click',callback);return b;
 };
 const overlay=create('section');overlay.id='sol-hand-grid';overlay.dataset.open='false';
 overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');
 overlay.setAttribute('aria-label','Browse your hand');
 const panel=create('section');panel.id='sol-hand-grid-panel';
 const head=create('header');head.id='sol-hand-grid-head';
 const titleWrap=create('div');
 const heading=create('h2','Your hand');
 const subtitle=create('small','Original Forge card identities and order preserved');
 titleWrap.append(heading,subtitle);
 head.append(titleWrap,button('✕ Back to table',()=>close()));
 const tools=create('nav');tools.id='sol-hand-grid-tools';
 tools.setAttribute('aria-label','Hand search and filters');
 const search=create('input');search.id='sol-hand-grid-search';search.type='search';
 search.placeholder='Find a card by name or type';
 search.setAttribute('aria-label','Search cards in your hand');
 search.addEventListener('input',()=>{state.query=search.value;paintCards();});
 tools.append(search);
 const filters={};
 for(const [id,label] of [['all','All'],['land','Lands'],['spell','Other spells'],['legal','Selectable']]){
   const b=button(label,()=>{state.filter=id;paintCards();});
   b.dataset.filter=id;filters[id]=b;tools.append(b);
 }
 const sortButton=button('Sort: Draw order',()=>{
   state.sort=state.sort==='original'?'name':state.sort==='name'?'type':'original';
   paintCards();
 });tools.append(sortButton);
 const content=create('section');content.id='sol-hand-grid-content';
 const cards=create('div');cards.id='sol-hand-grid-list';
 const detail=create('aside');detail.id='sol-hand-grid-detail';
 content.append(cards,detail);panel.append(head,tools,content);overlay.append(panel);
 document.body.append(overlay);
 overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
 document.addEventListener('keydown',e=>{
   if(!state.open||e.key!=='Escape')return;
   e.preventDefault();e.stopImmediatePropagation();close();
 },true);
 function isBlocked(){
   return !!window.ctForgeChoice?.hasPending ||
     !!window.ctForgePriority?.isHandChoice ||
     !!window.ctForgeRequiredAction?.hasPending ||
     !!window.app?.modal ||
     !!window.app?.game?.gameOver;
 }
 function hand(){
   const app=window.app;
   if(!app?.nativeMatch||app.view!=='game'||!app.game?.players?.[0])return [];
   const player=app.game.players[0];
   return (player.hand||[]).map((name,index)=>{
     const raw=player.handCards?.[index]||{};
     const id=player.handForgeIds?.[index];
     const catalog=window.ctForgeCards?.[String(name).toLowerCase()]||{};
     const type=String(raw.type||catalog.type||'Card');
     let legal=false;
     try{legal=id!==undefined&&window.ctForgeSelection?.isLegalCard?.(id)===true;}catch(_){}
     return {name:String(name),index,id,type,
       rules:String(raw.rulesText||catalog.text||''),
       cost:String(raw.manaCost||catalog.cost||''),legal};
   });
 }
 function identity(items){
   return items.map(c=>c.index+':'+c.id+':'+c.name+':'+Number(c.legal)).join('|');
 }
 function art(name){
   try{return window.ctCardArtUrl?.(name)||'';}catch(_){return '';}
 }
 function matches(c){
   const query=state.query.toLocaleLowerCase();
   const land=/\bLand\b/i.test(c.type);
   return (!query||(c.name+' '+c.type).toLocaleLowerCase().includes(query)) &&
     (state.filter==='all'||(state.filter==='land'&&land)||
     (state.filter==='spell'&&!land)||(state.filter==='legal'&&c.legal));
 }
 function updateDetail(items){
   detail.replaceChildren();
   const chosen=items.find(c=>c.index===state.selected);
   if(!chosen){
     detail.append(create('p','Select a card to see its full details. Every duplicate remains an individual card.'));
     return;
   }
   const picture=art(chosen.name);
   if(picture){const img=create('img');img.src=picture;img.alt='';img.loading='lazy';detail.append(img);}
   detail.append(create('h3',chosen.name));
   detail.append(create('p',chosen.type+(chosen.cost?' · '+chosen.cost:'')));
   if(chosen.rules)detail.append(create('p',chosen.rules));
   detail.append(create('p',chosen.legal?'Selectable in the current Forge decision.':
     'Sol Pod checks timing and mana when you act.'));
   const inspect=button('Inspect / card actions',()=>{
     const index=chosen.index;
     close();
     // This is the same existing game action as a card in the regular hand.
     // It resolves by original hand index, never by a sorted visual position.
     window.CommandTableAction?.('showHandCard',String(index));
   });
   detail.append(inspect);
 }
 function selectCard(index){
   state.selected=index;
   // Preserve scroll position and loaded card images for very large hands.
   for(const node of cards.children){
     if(node.dataset.handIndex!==undefined)
       node.dataset.selected=String(Number(node.dataset.handIndex)===index);
   }
   updateDetail(hand());
 }
 function paintCards(){
   if(!state.open)return;
   const items=hand();
   const signature=identity(items);
   state.signature=signature;
   heading.textContent='Your hand · '+items.length;
   const filtered=items.filter(matches);
   if(state.sort==='name')filtered.sort((a,b)=>a.name.localeCompare(b.name)||a.index-b.index);
   if(state.sort==='type')filtered.sort((a,b)=>a.type.localeCompare(b.type)||a.index-b.index);
   Object.entries(filters).forEach(([id,b])=>b.dataset.active=String(state.filter===id));
   sortButton.textContent='Sort: '+(state.sort==='original'?'Draw order':
     state.sort==='name'?'Name':'Card type');
   if(!filtered.some(c=>c.index===state.selected))state.selected=filtered[0]?.index??null;
   cards.replaceChildren();
   if(!filtered.length)cards.append(create('p','No cards match this filter.','sol-hand-grid-empty'));
   for(const item of filtered){
     const b=button(null,()=>selectCard(item.index),'sol-hand-grid-card');
     b.dataset.handIndex=String(item.index);
     b.dataset.selected=String(item.index===state.selected);
     b.dataset.legal=String(item.legal);
     b.setAttribute('aria-label','Card '+(item.index+1)+': '+item.name);
     const url=art(item.name);
     if(url){const img=create('img');img.src=url;img.alt='';img.loading='lazy';
       img.onerror=()=>{img.style.display='none';};b.append(img);}
     b.append(create('b',item.name));
     b.append(create('small','#'+(item.index+1)+(item.legal?' · Selectable':'')));
     cards.append(b);
   }
   updateDetail(items);
 }
 function open(){
   if(!hand().length||isBlocked())return;
   state.open=true;state.query='';state.filter='all';state.sort='original';
   state.selected=null;search.value='';overlay.dataset.open='true';
   paintCards();search.focus();
 }
 function close(){state.open=false;overlay.dataset.open='false';}
 function sync(){
   const items=hand();
   const oldButton=document.getElementById('sol-hand-grid-launch');
   const handToggle=document.querySelector('.sol-hand-toggle');
   if(!items.length||!handToggle){
     oldButton?.remove();if(state.open)close();return;
   }
   if(!oldButton){
     const trigger=button('▦ Browse ('+items.length+')',open,'sol-hand-grid-launch');
     trigger.id='sol-hand-grid-launch';
     trigger.setAttribute('aria-label','Browse and search '+items.length+' hand cards');
     handToggle.insertAdjacentElement('afterend',trigger);
   }else oldButton.textContent='▦ Browse ('+items.length+')';
   if(state.open){
     if(isBlocked()){close();return;}
     if(state.signature!==identity(items))paintCards();
   }
 }
 let scheduled=false;
 function schedule(){
   if(scheduled)return;
   scheduled=true;
   requestAnimationFrame(()=>{scheduled=false;sync();});
 }
 const root=document.getElementById('app');
 if(root)new MutationObserver(schedule).observe(root,{childList:true,subtree:false});
 window.CommandTableNative?.onState?.(schedule);
 window.addEventListener('ct-forge-selection',schedule);
 schedule();
 window.solPodHandGrid={open,close,sync,hand};
})();