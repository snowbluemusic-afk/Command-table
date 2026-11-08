/* Sol Pod v0.63 — local-only Commander deck analytics.
 * Results are recorded only after Forge declares the match complete.
 * Composition uses current installed card metadata; missing metadata is disclosed.
 */
(()=>{
 'use strict';
 if(window.solPodDeckAnalytics)return;
 const HISTORY='sol_pod_completed_matches_v063';
 const ACTIVE='sol_pod_active_match_v063';
 const storage=(()=>{try{return window.localStorage;}catch(_){return null;}})();
 const read=(key,fallback)=>{
  try {const json=storage?.getItem(key);return json?JSON.parse(json):fallback;}catch(_){return fallback;}
 };
 const write=(key,value)=>{
  try{if(!storage)return false;storage.setItem(key,JSON.stringify(value));return true;}
  catch(_){return false;}
 };
 let matches=read(HISTORY,[]);
 if(!Array.isArray(matches))matches=[];
 matches=matches.filter(m=>m&&typeof m.token==='string').slice(-500);
 let session=read(ACTIVE,null),durable=!!storage;
 const classify=reason=>({
  Milled:'Empty library / failed draw',
  LifeReachedZero:'Life total reached zero',
  CommanderDamage:'21 commander damage',
  Poisoned:'Poison counters',
  SpellEffect:'Spell or ability',
  OpponentWon:'Opponent alternate win',
  Conceded:'Conceded',
  IntentionalDraw:'Intentional draw'
 })[String(reason||'')]||'Unspecified by rules engine';
 const elem=(tag,cls,content)=>{
  const el=document.createElement(tag);
  if(cls)el.className=cls;
  if(content!==undefined)el.textContent=String(content);
  return el;
 };
 const style=elem('style');style.id='sol-pod-deck-analytics-v063-css';
 style.textContent=[
  '.ct-deck-library-grid .sol-stats-wrap{min-width:0;display:flex;flex-direction:column;gap:0}',
  '.ct-deck-library-grid .sol-stats-wrap>.deck-tile{flex:1;width:100%;min-width:0}',
  '.sol-stats-entry{width:100%;min-height:44px;margin:0;padding:8px 12px;',
  'text-align:left;color:#ffe4b4;background:#1b373c;',
  'border:1px solid #8d986d;border-top:0;border-radius:0 0 11px 11px;',
  'font:750 12px system-ui;touch-action:manipulation}',
  '.ct-deck-library-grid .sol-stats-wrap .deck-tile{border-radius:14px 14px 0 0}',
  '.sol-stats-edit-open{margin:8px 0;min-height:40px;background:#34595f;',
  'color:#f8e7c4;border:1px solid #dbc082;border-radius:9px;padding:8px 14px;',
  'font:750 12px system-ui}',
  '#sol-pod-deck-stats-v063{position:fixed;inset:0;z-index:2147483490;',
  'display:none;align-items:center;justify-content:center;box-sizing:border-box;',
  'padding:clamp(8px,2vw,18px);background:#020a13ec;color:#fff1dc;',
  'font-family:system-ui;backdrop-filter:blur(7px)}',
  '#sol-pod-deck-stats-v063[data-open="true"]{display:flex}',
  '#sol-pod-deck-stats-v063 .sol-stats-sheet{width:min(96vw,900px);',
  'max-height:94dvh;overflow:auto;padding:clamp(12px,2.5vw,22px);',
  'box-sizing:border-box;background:#152b35;border:1px solid #d8b780;',
  'border-radius:16px;box-shadow:0 15px 50px #000b}',
  '.sol-stats-head{display:flex;justify-content:space-between;align-items:start;gap:14px}',
  '.sol-stats-head h2{font:750 clamp(20px,3vw,29px) Georgia,serif;margin:0 0 5px}',
  '.sol-stats-head button{flex:none;background:#304956;color:#fff0da;',
  'border:1px solid #b69f7a;border-radius:9px;padding:8px;min-width:62px;min-height:38px}',
  '.sol-stats-sub{font-size:12px;color:#b8d3cd;margin:0 0 10px}',
  '.sol-stats-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:12px 0}',
  '.sol-stats-kpi{background:#21404a;border:1px solid #526b72;border-radius:10px;padding:10px}',
  '.sol-stats-kpi strong{display:block;font:800 clamp(17px,2.5vw,26px) system-ui}',
  '.sol-stats-kpi small{font-size:10px;color:#c5d4d4}',
  '.sol-stats-sections{display:grid;grid-template-columns:1fr 1fr;gap:13px}',
  '.sol-stats-section{min-width:0;border:1px solid #4d686c;border-radius:10px;',
  'padding:10px 12px;background:#11272c}',
  '.sol-stats-section h3{font:750 15px system-ui;color:#f5d5a0;margin:0 0 9px}',
  '.sol-stats-section p,.sol-stats-footnote{font:11px/1.5 system-ui;color:#bccfd0;margin:7px 0}',
  '.sol-stats-barline{display:grid;grid-template-columns:minmax(85px,1fr) 2fr 28px;',
  'align-items:center;gap:6px;font-size:11px;margin:5px 0}',
  '.sol-stats-track{height:8px;border-radius:99px;background:#32494e;overflow:hidden}',
  '.sol-stats-fill{height:100%;background:#d5b474;border-radius:99px}',
  '.sol-stats-history{list-style:none;padding:0;margin:0}',
  '.sol-stats-history li{border-bottom:1px solid #405a5b;padding:7px 0;font-size:11px}',
  '.sol-stats-history strong{font-weight:800}',
  '.sol-stats-history small{display:block;color:#b7ccce;margin-top:3px}',
  '@media(max-width:620px){.sol-stats-sections{grid-template-columns:1fr}',
  '.sol-stats-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}',
  '@media(orientation:landscape) and (max-height:430px){',
  '#sol-pod-deck-stats-v063 .sol-stats-sheet{max-height:96dvh;padding:8px 13px}',
  '.sol-stats-kpis{margin:5px 0}.sol-stats-kpi{padding:5px 9px}}'
 ].join('');
 document.head.append(style);
 const overlay=elem('section');overlay.id='sol-pod-deck-stats-v063';
 overlay.dataset.open='false';overlay.setAttribute('role','dialog');
 overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Deck performance and composition');
 const sheet=elem('section','sol-stats-sheet');overlay.append(sheet);document.body.append(overlay);
 let shownId=null,pending=false;
 const deck=id=>window.app?.decks?.find(d=>String(d.id)===String(id));
 const keyOf=name=>String(name||'').normalize('NFKC').toLowerCase().replace(/[’]/g,"'").trim();
 // A revision changes when Commander/card quantities change, not card order.
 function deckRevision(d){
  const names=(Array.isArray(d?.cards)?d.cards:[]).map(keyOf).sort();
  const identity=[keyOf(d?.commander),...names].join('|');
  let hash=2166136261;
  for(let i=0;i<identity.length;i++)hash=Math.imul(hash^identity.charCodeAt(i),16777619)>>>0;
  return 'r1-'+hash.toString(16).padStart(8,'0')+'-'+names.length;
 }
 let cardIndex=new Map(),cardCount=-1;
 function metadata(name){
  const cards=window.CardData?.cards||[];
  if(cards.length!==cardCount){
   cardIndex=new Map(cards.filter(c=>c?.name).map(c=>[keyOf(c.name),c]));
   cardCount=cards.length;
  }
  const cached=cardIndex.get(keyOf(name)),live=window.ctForgeCards?.[keyOf(name)];
  // Forge's offline resolver enriches cached cards with authoritative manaValue.
  const card=(cached?.manaValue!==undefined&&cached?.manaValue!==null)?cached:live||cached;
  return card && String(card.type||'').toLowerCase()!=='unknown'&&card.type?card:null;
 }
 function manaValue(info){
  if(Number.isFinite(Number(info?.manaValue))&&info.manaValue!==null&&info.manaValue!==undefined)
   return Math.max(0,Number(info.manaValue));
  const raw=String(info?.cost||'').split('//')[0].trim();
  if(!raw||/^(?:no mana cost|unknown|—)$/i.test(raw))return null;
  const braces=[...raw.matchAll(/\{([^}]+)\}/g)].map(m=>m[1]);
  const symbols=braces.length?braces:
   (raw.toUpperCase().replace(/\s/g,'').match(/\d+\/[WUBRG]|\w\/\w|\d+|[WUBRGCXSP]/g)||[]);
  if(!symbols.length)return null;
  return symbols.reduce((sum,value)=>{
   const v=String(value).toUpperCase();
   if(v==='X')return sum;
   const numeric=v.match(/^\d+/);
   return sum+(numeric?Number(numeric[0]):1);
  },0);
 }
 const types=['Land','Creature','Instant','Sorcery','Artifact','Enchantment','Planeswalker','Battle','Other'];
 function mainType(type){
  const t=String(type||'');
  return types.find(k=>k!=='Other'&&new RegExp('\\b'+k+'\\b','i').test(t))||'Other';
 }
 function composition(d){
  const cards=Array.isArray(d?.cards)?d.cards:[];
  const counts=Object.fromEntries(types.map(t=>[t,0]));
  let unknown=0,knownCost=0,totalCost=0,nonlands=0,estimated=0;
  for(const name of cards){
   const info=metadata(name);
   if(!info){unknown++;continue;}
   const type=mainType(info.type);
   counts[type]++;
   if(type==='Land')continue;
   nonlands++;
   const cost=manaValue(info);
   if(cost!==null){knownCost++;totalCost+=cost;if(info.manaValue===undefined||info.manaValue===null)estimated++;}
  }
  return {counts,unknown,knownCost,totalCost,nonlands,estimated,mainCount:cards.length,
   average:knownCost?totalCost/knownCost:null,
   metadataPending:unknown>0||knownCost<nonlands||estimated>0};
 }
 function records(id,mode='manual',revision=null){
  return matches.filter(m=>String(m.deckId)===String(id)&&m.mode===mode&&
    (revision===null||m.revision===revision));
 }
 function beginMatch(d,autoPilot){
  if(!d?.id)return false;
  session={token:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),
   deckId:String(d.id),deckName:String(d.name),commander:String(d.commander),
   revision:deckRevision(d),gameId:null,phase:'starting',
   mode:autoPilot?'watch':'manual',startedAt:Date.now(),recorded:false};
  durable=write(ACTIVE,session)&&durable;
  return true;
 }
 function observeGame(raw){
  if(!session||session.recorded||!raw||!Array.isArray(raw.players)||!raw.players.length)return false;
  const id=Number(raw.gameId);
  if(!Number.isSafeInteger(id)||id<0)return false;
  if(session.phase==='starting'){
   if(Date.now()-Number(session.startedAt)>180000||raw.gameOver)return false;
   session.gameId=id;session.phase='bound';write(ACTIVE,session);return true;
  }
  return session.phase==='bound'&&Number(session.gameId)===id;
 }
 function cancelMatch(){
  if(session?.phase==='starting'){session=null;write(ACTIVE,null);}
 }
 function recordMatch(raw){
  if(!raw?.gameOver||!window.app?.nativeMatch || !session?.token ||
     session.recorded || !['victory','defeat','draw'].includes(String(raw.outcome)))return false;
  // Never assign another game's final result to this deck.
  const id=Number(raw.gameId);
  if(session.phase!=='bound'||!Number.isSafeInteger(id)||id<0||
    Number(session.gameId)!==id||!Array.isArray(raw.players)||!raw.players.length)return false;
  if(matches.some(m=>m.token===session.token)){
   session.recorded=true;write(ACTIVE,session);return false;
  }
  const entry={token:session.token,gameId:id,
   deckId:session.deckId,deckName:session.deckName,commander:session.commander,
   revision:session.revision||null,
   mode:session.mode,playedAt:Date.now(),outcome:String(raw.outcome),
   reason:raw.outcome==='defeat'?String(raw.lossReason||''):'',
   source:raw.outcome==='defeat'?String(raw.lossSource||raw.winningEffect||'').slice(0,140):'',
   turns:Math.max(0,Number(raw.turn)||0),
   opponents:Math.max(1,raw.players.length-1)};
  matches.push(entry);matches=matches.slice(-500);
  session.recorded=true;durable=write(HISTORY,matches)&&write(ACTIVE,session)&&durable;
  schedule();
  return true;
 }
 function row(label,count,max){
  const wrap=elem('div','sol-stats-barline');
  const name=elem('span',null,label);
  const track=elem('div','sol-stats-track');
  const fill=elem('div','sol-stats-fill');fill.style.width=(max?100*count/max:0)+'%';
  track.append(fill);track.setAttribute('aria-label',label+': '+count);
  wrap.append(name,track,elem('span',null,count));return wrap;
 }
 function section(title){const container=elem('section','sol-stats-section');
  container.append(elem('h3',null,title));return container;}
 function metric(container,label,value){
  const el=elem('div','sol-stats-kpi');
  el.append(elem('strong',null,value),elem('small',null,label));container.append(el);
 }
 function open(id){
  const d=deck(id);if(!d)return;
  shownId=String(id);sheet.replaceChildren();
  const head=elem('div','sol-stats-head'),title=elem('div');
  title.append(elem('h2',null,d.name),elem('p','sol-stats-sub',d.commander+' · Deck statistics'));
  const close=elem('button',null,'Close');close.type='button';
  close.onclick=()=>{overlay.dataset.open='false';shownId=null;};
  head.append(title,close);sheet.append(head);
  const lifetime=records(id),watched=records(id,'watch');
  const played=records(id,'manual',deckRevision(d));
  const wins=played.filter(x=>x.outcome==='victory').length;
  const defeats=played.filter(x=>x.outcome==='defeat');
  const draws=played.filter(x=>x.outcome==='draw').length;
  const comp=composition(d);
  const kpis=elem('div','sol-stats-kpis');
  const lifetimeWins=lifetime.filter(x=>x.outcome==='victory').length;
  metric(kpis,'Current revision · matches',played.length);
  metric(kpis,'Current revision · win rate',played.length?Math.round(wins/played.length*100)+'%':'—');
  metric(kpis,'Current revision · W / L / D',wins+' / '+defeats.length+' / '+draws);
  metric(kpis,'Lifetime · matches',lifetime.length);
  metric(kpis,'Lifetime · win rate',lifetime.length?Math.round(lifetimeWins/lifetime.length*100)+'%':'—');
  metric(kpis,'Avg nonland mana value',comp.average===null?'—':comp.average.toFixed(2)+(comp.metadataPending?'*':''));
  sheet.append(kpis);
  const areas=elem('div','sol-stats-sections');
  const makeup=section('Main-deck card types');
  if(comp.metadataPending)makeup.append(elem('p','sol-stats-loading',
   'Card metadata is still resolving from the offline Forge catalog. Figures marked * are provisional.'));
  for(const type of types)if(comp.counts[type])makeup.append(row(type,comp.counts[type],comp.mainCount));
  makeup.append(elem('p',null,'Primary card type per card. Commander excluded. '+(comp.unknown?
    comp.unknown+' card'+(comp.unknown===1?'':'s')+' awaiting metadata; totals are incomplete.':
    comp.mainCount+' main-deck cards classified.')+
    (comp.nonlands>comp.knownCost?' Mana value covers '+comp.knownCost+' of '+comp.nonlands+' known nonland cards.':'')));
  const causes=section('Why this deck lost');
  const reasonCounts=new Map();
  for(const loss of defeats){const cause=classify(loss.reason);
   reasonCounts.set(cause,(reasonCounts.get(cause)||0)+1);}
  if(!defeats.length)causes.append(elem('p',null,'No recorded manual losses yet.'));
  else for(const [reason,n] of [...reasonCounts].sort((a,b)=>b[1]-a[1]))
   causes.append(row(reason,n,defeats.length));
  causes.append(elem('p',null,'Loss categories come from Forge’s final rules outcome, not a guessed opponent deck archetype.'));
  const recent=section('Recent completed matches');
  const list=elem('ul','sol-stats-history');
  for(const m of played.slice(-8).reverse()){
   const li=elem('li'),label=m.outcome==='victory'?'Victory':m.outcome==='defeat'?'Defeat':'Draw';
   li.append(elem('strong',null,label+' · Turn '+m.turn),
    elem('small',null,(m.outcome==='defeat'?classify(m.reason)+' · ':'')+
     new Date(m.playedAt).toLocaleDateString()+' · '+(m.opponents+1)+' players'));
   list.append(li);
  }
  if(!played.length)recent.append(elem('p',null,'No completed manual matches recorded for this deck revision yet.'));
  else recent.append(list);
  const note=elem('p','sol-stats-footnote',
   'Current revision means this Commander and main-deck card list. Lifetime includes previous revisions. '+
   'Statistics begin with games completed after this update. Watch-mode results are separate ('+
   watched.length+' recorded). '+(durable?'History is stored privately on this device.':
   'Local storage is unavailable; history may reset when the app closes.'));
  areas.append(makeup,causes,recent);sheet.append(areas,note);
  overlay.dataset.open='true';close.focus?.();
 }
 function updateLibrary(){
  const app=window.app;
  if(app?.view==='decks'){
   for(const tile of document.querySelectorAll('.ct-deck-library-grid .deck-tile[data-action="openDeck"]')){
    if(tile.parentElement?.classList?.contains('sol-stats-wrap'))continue;
    const id=tile.getAttribute('data-value');
    if(!deck(id))continue;
    const wrap=elem('div','sol-stats-wrap');
    tile.parentNode.insertBefore(wrap,tile);wrap.append(tile);
    const button=elem('button','sol-stats-entry');
    button.type='button';button.dataset.solDeckStatsId=id;
    button.onclick=()=>open(id);wrap.append(button);
   }
   for(const button of document.querySelectorAll('.sol-stats-entry')){
    const id=button.dataset.solDeckStatsId;
    const played=records(id,'manual',deckRevision(deck(id)));
    const wins=played.filter(x=>x.outcome==='victory').length;
    const comp=composition(deck(id));
    button.textContent='▤ Current deck · '+(played.length?Math.round(wins/played.length*100)+'% win rate · '+played.length+' games':
     'No matches recorded')+' · Avg MV '+(comp.average===null?'—':comp.average.toFixed(1));
   }
  }
  if(app?.view==='edit'&&app.editing){
   const head=document.querySelector('.page-title');
   if(head&&!head.querySelector('.sol-stats-edit-open')){
    const b=elem('button','sol-stats-edit-open','▤ View deck performance & card types');
    b.type='button';b.onclick=()=>open(app.editing);head.append(b);
   }
  }
 }
 function schedule(){
  if(pending)return;pending=true;
  requestAnimationFrame(()=>{pending=false;updateLibrary();});
 }
 const root=document.getElementById('app');
 if(root)new MutationObserver(schedule).observe(root,{childList:true,subtree:false});
 overlay.addEventListener('click',event=>{if(event.target===overlay){
  overlay.dataset.open='false';shownId=null;}});
 document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&overlay.dataset.open==='true'){
   event.preventDefault();event.stopImmediatePropagation();overlay.dataset.open='false';shownId=null;
  }
 },true);
 window.solPodDeckAnalytics={beginMatch,observeGame,cancelMatch,deckRevision,recordMatch,open,composition,reasonLabel:classify,
  get history(){return matches.slice();},get activeSession(){return session;}};
 if(window.app?.nativeMatch&&window.app.game?.gameOver)recordMatch(window.app.game);
 schedule();
})();