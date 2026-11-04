/* Sol Pod v0.52: dedicated human blocker assignment surface.
 * A read-only CombatView supplies existing assignments. Every mutation is a
 * single Forge game.command combat.block and must be confirmed by GameView.
 * Suggested blocks rank readable stats only and are NEVER auto-applied.
 */
(() => {
 'use strict';
 const create=(tag,cls,content)=>{
  const el=document.createElement(tag);
  if(cls)el.className=cls;
  if(content!==undefined)el.textContent=String(content);
  return el;
 };
 const css=create('style');
 css.id='sol-pod-combat-planner-style';
 css.textContent=[
  '#sol-combat-planner{display:none;position:fixed;inset:0;z-index:2147482850;',
  'background:#041018f2;align-items:center;justify-content:center;padding:10px;',
  'box-sizing:border-box;color:#f5ebd9;font:13px/1.35 system-ui}',
  '#sol-combat-planner[data-open="true"]{display:flex}',
  '#sol-combat-planner .sol-block-sheet{width:min(97vw,1330px);height:min(94dvh,730px);',
  'display:flex;flex-direction:column;min-height:0;box-sizing:border-box;',
  'background:linear-gradient(135deg,#19343d,#0b1c27);',
  'border:2px solid #cba86d;border-radius:17px;padding:11px 15px;',
  'box-shadow:0 17px 65px #000a;gap:7px}',
  '#sol-combat-planner .sol-block-header{display:flex;justify-content:space-between;',
  'gap:12px;align-items:center;flex-wrap:wrap}',
  '#sol-combat-planner h2{font:700 clamp(18px,2.3vw,27px) Georgia,serif;',
  'color:#fbd9a5;margin:0}',
  '#sol-combat-planner .sol-block-progress{font-size:11px;color:#bed4d4}',
  '#sol-combat-planner .sol-block-progress strong{color:#f0c786}',
  '#sol-combat-planner .sol-block-columns{display:grid;grid-template-columns:42% 1fr;',
  'gap:12px;min-height:0;flex:1;overflow:hidden}',
  '#sol-combat-planner .sol-block-panel{border:1px solid #526b71;',
  'border-radius:10px;min-height:0;display:flex;flex-direction:column;overflow:hidden}',
  '#sol-combat-planner .sol-block-panel h3{margin:0;padding:8px 10px;',
  'border-bottom:1px solid #475d65;color:#edcb90;font-size:13px}',
  '#sol-combat-planner .sol-block-scroll{overflow:auto;overscroll-behavior:contain;',
  'padding:7px;display:flex;flex-direction:column;gap:6px;min-height:0}',
  '#sol-combat-planner button{min-height:38px;padding:7px 11px;',
  'border:1px solid #b7a07c;background:#28444d;color:#f7f1e7;',
  'border-radius:9px;font:700 12px system-ui;text-align:left;touch-action:manipulation}',
  '#sol-combat-planner button:disabled{opacity:.49}',
  '#sol-combat-planner button[data-selected="true"]{background:#755d39;',
  'border:2px solid #f2d39a}',
  '#sol-combat-planner .sol-block-card{display:flex;gap:9px;align-items:center;',
  'width:100%;min-width:0}',
  '#sol-combat-planner .sol-block-card img{width:43px;height:54px;',
  'object-fit:cover;flex:none;border-radius:5px;background:#12303b}',
  '#sol-combat-planner .sol-block-card span{display:flex;flex-direction:column;',
  'gap:3px;overflow-wrap:anywhere;min-width:0}',
  '#sol-combat-planner .sol-block-card small{font-size:10px;color:#c9dadd}',
  '#sol-combat-planner .sol-block-group{border:1px solid #516f73;',
  'border-radius:9px;padding:6px;background:#122d3588}',
  '#sol-combat-planner .sol-block-group summary{cursor:pointer;',
  'padding:8px 10px;font-weight:750;color:#eddbbf}',
  '#sol-combat-planner .sol-block-group-body{display:grid;',
  'grid-template-columns:repeat(auto-fill,minmax(165px,1fr));gap:6px;',
  'max-height:27dvh;overflow-y:auto;padding:4px}',
  '#sol-combat-planner .sol-block-suggest{padding:7px 9px;',
  'border:1px solid #a58451;border-radius:9px;background:#3d3d2a88}',
  '#sol-combat-planner .sol-block-suggest b{display:block;color:#f3d79f;',
  'margin-bottom:4px}',
  '#sol-combat-planner .sol-block-suggest small{display:block;color:#e2d4bd;',
  'font-size:10px;margin-bottom:5px}',
  '#sol-combat-planner .sol-block-suggest button{margin:2px 5px 2px 0}',
  '#sol-combat-planner .sol-block-status{min-height:19px;font-size:12px;',
  'color:#ffe1a2;max-height:44px;overflow:auto}',
  '#sol-combat-planner .sol-block-footer{display:flex;gap:8px;flex-wrap:wrap;',
  'align-items:center;border-top:1px solid #62737a;padding-top:8px}',
  '#sol-combat-planner .sol-block-footer button{flex:1;text-align:center}',
  '#sol-combat-planner .sol-block-footer .sol-primary{background:#deb576;',
  'color:#112731;border-color:#ffdb95}',
  '#sol-combat-planner .sol-block-legend{color:#bfd4d0;font-size:11px}',
  '#sol-combat-resume{display:none;position:fixed;z-index:2147482845;',
  'bottom:calc(env(safe-area-inset-bottom) + 15px);right:17px;',
  'background:#deb675;color:#19303a;border:2px solid #f5d39b;',
  'border-radius:11px;min-height:42px;padding:8px 15px;',
  'font:800 12px system-ui;box-shadow:0 7px 21px #000a}',
  '@media(orientation:landscape) and (max-height:440px){',
  '#sol-combat-planner .sol-block-sheet{padding:8px 11px;gap:4px}',
  '#sol-combat-planner .sol-block-scroll{padding:4px;gap:3px}',
  '#sol-combat-planner .sol-block-card img{width:33px;height:43px}',
  '#sol-combat-planner button{min-height:31px;padding:4px 7px}',
  '#sol-combat-planner .sol-block-footer{padding-top:4px}',
  '#sol-combat-planner .sol-block-suggest small{display:none}',
  '}'
 ].join('');
 document.head.append(css);
 const modal=create('section');modal.id='sol-combat-planner';
 modal.dataset.open='false';modal.setAttribute('role','dialog');
 modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label','Declare blockers');
 const sheet=create('section','sol-block-sheet');
 const head=create('div','sol-block-header'),heading=create('h2',null,'Declare blockers');
 const progress=create('div','sol-block-progress',
   'Combat  ·  Attack  ›  Block  ›  Damage  ›  End');
 head.append(heading,progress);
 const help=create('div','sol-block-legend',
  'Select an incoming attacker, then tap one of your creatures to assign or remove a blocker. Sol Pod checks legality.');
 const columns=create('div','sol-block-columns');
 const attacksPanel=create('div','sol-block-panel'),blockPanel=create('div','sol-block-panel');
 const attacksTitle=create('h3',null,'Incoming attackers');
 const blocksTitle=create('h3',null,'Your blockers');
 const attacksBody=create('div','sol-block-scroll');
 const blocksBody=create('div','sol-block-scroll');
 attacksPanel.append(attacksTitle,attacksBody);
 blockPanel.append(blocksTitle,blocksBody);
 columns.append(attacksPanel,blockPanel);
 const status=create('div','sol-block-status');status.setAttribute('role','status');
 const footer=create('div','sol-block-footer');
 sheet.append(head,help,columns,status,footer);modal.append(sheet);
 document.body.append(modal);
 const resume=create('button',null,'🛡 Block planner');
 resume.id='sol-combat-resume';resume.type='button';document.body.append(resume);
 let stage='',shownFor='',selectedAttacker=null,busy=false,uncertain=false;
 let autoTimer=null,lastMessage='',expandedGroups=new Set();
 const state=()=>window.app?.game;
 const own=()=>state()?.players?.[0];
 const inStep=()=>!!window.app?.nativeMatch&&window.app?.view==='game'&&
   state()?.winner==null&&!state()?.gameOver&&
   /COMBAT_DECLARE_BLOCKERS/i.test(String(state()?.phaseDetail||'')) &&
   (state()?.combat||[]).some(a=>Number(a.defenderId)===Number(own()?.forgeId));
 const attacks=()=>((state()?.combat)||[]).filter(a=>
   Number(a.defenderId)===Number(own()?.forgeId));
 const combatCards=()=>state()?.players?.flatMap(p=>p.battlefield||[])||[];
 const lookup=id=>combatCards().find(c=>Number(c.forgeId)===Number(id));
 const titleCard=(c,id)=>String(c?.name||'Card #'+id);
 const stats=c=>c&&Number.isFinite(Number(c.power))&&Number.isFinite(Number(c.toughness))
   ?String(c.power)+'/'+String(c.toughness):'Power / toughness not reported';
 const tokenKey=c=>JSON.stringify([c.name,String(c.power),String(c.toughness),
   !!c.tapped,JSON.stringify(c.counters||{}),!!c.attacking,!!c.blocking]);
 const groups=()=>{
  const result=new Map();
  for(const card of own()?.battlefield||[]){
   if(!card.creature)continue;
   const key=card.token?'token:'+tokenKey(card):'card:'+card.forgeId;
   if(!result.has(key))result.set(key,[]);
   result.get(key).push(card);
  }
  return [...result.entries()].map(([key,cards])=>({key,cards}));
 };
 const chosen=()=>attacks().find(a=>Number(a.cardId)===Number(selectedAttacker));
 const legalFor=attackerId=>{
  const game=state();
  if(!game?.legalBlockersReady)return null;
  const ids=game.legalBlockers?.[String(attackerId)];
  return Array.isArray(ids)?new Set(ids.map(Number)):new Set();
 };
 const bounded=(promise,label,ms=10000)=>new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>reject(new Error(label+' did not respond. Refresh Sol Pod status before retrying.')),ms);
  Promise.resolve(promise).then(v=>{clearTimeout(timeout);resolve(v);},
   error=>{clearTimeout(timeout);reject(error);});
 });
 const assignedTo=id=>attacks().filter(a=>(a.blockerIds||[])
   .some(b=>Number(b)===Number(id)));
 const notice=(txt,problem=false)=>{
  lastMessage=txt;status.textContent=txt;
  status.style.color=problem?'#ffad9e':'#ffe0a7';
 };
 const getArt=name=>{try{return window.ctCardArtUrl?.(name)||'';}catch(_){return '';}};
 function tile(card,id,subtitle,pressed,fn,allowed=true){
  const b=create('button','sol-block-card');
  b.type='button';b.dataset.selected=String(pressed);
  b.setAttribute('aria-pressed',String(pressed));
  const art=create('img');art.alt='';art.loading='lazy';
  art.src=getArt(titleCard(card,id));art.onerror=()=>art.remove();
  const words=create('span');
  words.append(create('strong',null,titleCard(card,id)),
    create('small',null,subtitle));
  b.append(art,words);b.onclick=fn;b.disabled=busy||uncertain||!allowed;
  return b;
 }
 function suggested(attacker,creatures){
  // Purely visual P/T sorting, never claimed as legal or auto-executed.
  // Flying, menace, restrictions, protection, deathtouch and replacement
  // effects are not inferred here: Forge validates any actual assignment.
  const threat=lookup(attacker.cardId);
  const ap=Number(threat?.power),at=Number(threat?.toughness);
  const score=c=>{
   let score=0;
   if(c.tapped)score-=100;
   if(assignedTo(c.forgeId).length)score-=10;
   const bp=Number(c.power),bt=Number(c.toughness);
   if(Number.isFinite(ap)&&Number.isFinite(bt))score+=bt>=ap?8:0;
   if(Number.isFinite(at)&&Number.isFinite(bp))score+=bp>=at?7:0;
   if(Number.isFinite(ap)&&Number.isFinite(bt))score-=Math.abs(bt-ap)*.2;
   if(Number.isFinite(at)&&Number.isFinite(bp))score-=Math.abs(bp-at)*.2;
   return score;
  };
  const legal=legalFor(attacker.cardId);
  if(!legal)return [];
  return creatures.filter(c=>legal.has(Number(c.forgeId))&&!c.tapped&&!assignedTo(c.forgeId).length)
    .sort((a,b)=>score(b)-score(a)||Number(a.forgeId)-Number(b.forgeId))
    .slice(0,3);
 }
 async function command(attackerId,blockerId){
  if(busy||uncertain||!inStep())return;
  const attacker=attacks().find(a=>Number(a.cardId)===Number(attackerId));
  const blocker=own()?.battlefield?.find(c=>Number(c.forgeId)===Number(blockerId)&&c.creature);
  if(!attacker||!blocker){notice('That attacker or blocker is no longer on the battlefield.',true);return;}
  const previously=(attacker.blockerIds||[]).some(id=>Number(id)===Number(blockerId));
  const legal=legalFor(attackerId);
  if(!previously&&(!legal||!legal.has(Number(blockerId)))){
   notice(legal?'That creature cannot legally block this attacker.':'Checking blocker legality. Refresh the game state.',true);
   return;
  }
  busy=true;notice((previously?'Removing':'Assigning')+' '+blocker.name+'…');
  paint();
  try{
   await bounded(window.CommandTableNative.request('game.command',{
    action:'combat.block',value:{attackerId,blockerId}
   }),'Block assignment',10000);
   let confirmed=false,next=null;
   for(let i=0;i<5;i++){
    const raw=await bounded(window.CommandTableNative.request('game.snapshot'),'Combat snapshot',7000);
    next=raw?.game;
    const updated=(next?.combat||[]).find(a=>Number(a.cardId)===Number(attackerId));
    if(updated && (updated.blockerIds||[]).some(id=>Number(id)===Number(blockerId))!==previously){
     confirmed=true;break;
    }
    await new Promise(resolve=>setTimeout(resolve,130));
   }
   if(next)window.ctReceiveForgeState?.(next);
   if(!confirmed){
    uncertain=true;
    notice('Sol Pod has not confirmed this block. Refresh before making another change.',true);
   }else notice(previously?'Blocker removed. Review other assignments.':
     'Block assigned. You can add more blockers or confirm.');
  }catch(error){
   const message=String(error?.message||error);
   if(/timed out|did not respond|still processing/i.test(message))uncertain=true;
   notice('Could not '+(previously?'remove':'assign')+' block: '+message,true);
  }finally{busy=false;paint();}
 }
 function paint(){
  if(!inStep()){hide(true);return;}
  const all=attacks();
  if(!all.some(a=>Number(a.cardId)===Number(selectedAttacker)))
   selectedAttacker=all[0]?.cardId??null;
  const selected=chosen();
  heading.textContent='Declare blockers · '+all.length+' incoming attacker'+(all.length===1?'':'s');
  progress.replaceChildren();
  progress.append(create('span',null,'Attack  ›  '),
    create('strong',null,'Block'),create('span',null,'  ›  Damage  ›  End'));
  attacksTitle.textContent='Incoming attackers · '+all.length;
  blocksTitle.textContent='Your creatures · '+(own()?.battlefield||[]).filter(c=>c.creature).length;
  attacksBody.replaceChildren();
  for(const a of all){
   const card=lookup(a.cardId);
   const current=(a.blockerIds||[]).map(id=>titleCard(lookup(id),id)).join(', ');
   const sub=stats(card)+' · '+((a.blockerIds||[]).length
      ?'Blocking: '+current:'Unblocked');
   attacksBody.append(tile(card,a.cardId,sub,
     Number(selectedAttacker)===Number(a.cardId),
     ()=>{selectedAttacker=a.cardId;notice('Choose a creature to block '+a.cardName+'.');paint();}));
  }
  blocksBody.replaceChildren();
  const visible=groups(),creatures=visible.flatMap(g=>g.cards);
  if(!creatures.length){
   blocksBody.append(create('p',null,'No creatures available on your battlefield. You can skip blocking.'));
  }
  if(selected){
   const guide=create('div','sol-block-suggest');
   const legal=legalFor(selected.cardId);
   const recommended=suggested(selected,creatures);
   if(!legal){
    guide.append(create('b',null,'Checking blocker legality…'),
      create('small',null,'Suggestions are hidden until the rules engine verifies blocks. Use Refresh blocks if needed.'));
   }else if(!recommended.length){
    guide.append(create('b',null,'No eligible unassigned blockers'),
      create('small',null,'Flying or another rule may prevent blocks. You may choose another attacker or skip.'));
   }else {
    guide.append(create('b',null,'Suggested legal blockers (optional)'),
      create('small',null,'Every suggestion is verified by Sol Pod. Ranking uses visible stats only and never auto-assigns.'));
    for(const c of recommended){
     const b=create('button',null,c.name+' · '+stats(c));
     b.type='button';b.disabled=busy||uncertain;
     b.onclick=()=>{void command(selected.cardId,c.forgeId);};
     guide.append(b);
    }
   }
   blocksBody.append(guide);
  }
  for(const group of visible){
   const cards=group.cards;
   if(cards.length>=3 && cards[0].token){
    const details=create('details','sol-block-group');
    details.open=expandedGroups.has(group.key);
    const summary=create('summary',null,cards[0].name+' · '+stats(cards[0])+' · '+cards.length+' tokens'+
      (cards.filter(c=>assignedTo(c.forgeId).length).length?
       ' · '+cards.filter(c=>assignedTo(c.forgeId).length).length+' assigned':''));
    details.append(summary);
    const body=create('div','sol-block-group-body');
    cards.forEach((c,i)=>body.append(tile(c,c.forgeId,
      'Token #'+(i+1)+(c.tapped?' · tapped':'')+
      (assignedTo(c.forgeId).length?' · assigned':''),
      !!selected?.blockerIds?.some(id=>Number(id)===Number(c.forgeId)),
      ()=>{if(selected)void command(selected.cardId,c.forgeId);})));
    details.append(body);
    details.addEventListener('toggle',()=>{if(details.open)expandedGroups.add(group.key);
      else expandedGroups.delete(group.key);});
    blocksBody.append(details);
   }else for(const c of cards)blocksBody.append(tile(c,c.forgeId,
     stats(c)+(c.tapped?' · tapped':'')+
     (assignedTo(c.forgeId).length?' · blocking '+assignedTo(c.forgeId).map(a=>a.cardName).join(', '):''),
     !!selected?.blockerIds?.some(id=>Number(id)===Number(c.forgeId)),
     ()=>{if(selected)void command(selected.cardId,c.forgeId);}));
  }
  if(!status.textContent)notice('Select an attacker, then choose a blocker. No blocks are also a valid decision.');
  footer.replaceChildren();
  const close=create('button',null,'Review battlefield');
  close.onclick=()=>hide(false);footer.append(close);
  const refresh=create('button',null,busy?'Working…':'↻ Refresh blocks');
  refresh.disabled=busy;
  refresh.onclick=async()=>{
   try{
    const result=await window.CommandTableNative.request('engine.status');
    const snap=await window.CommandTableNative.request('game.snapshot');
    if(!snap?.game)throw new Error('Game state is unavailable');
    window.ctReceiveForgeState?.(snap.game);
    uncertain=false;notice('Assignments refreshed from Sol Pod.');
   }catch(e){notice('Unable to refresh blocks: '+(e?.message||e),true);}
   paint();
  };
  footer.append(refresh);
  const count=all.reduce((sum,a)=>sum+(a.blockerIds||[]).length,0);
  const confirm=create('button','sol-primary',
   count?'Confirm '+count+' blocker'+(count===1?'':'s'):'Skip blocking');
  confirm.disabled=busy||uncertain||!!window.ctDirectCombat?.pending||
    !window.ctForgePriority?.canConfirm;
  confirm.onclick=async()=>{
   if(busy||uncertain||!inStep())return;
   busy=true;notice('Confirming the declared blockers…');paint();
   try{
    await window.ctDirectCombat?.whenIdle?.();
    const accepted=await window.ctForgePriority?.confirm?.();
    if(accepted===false)throw new Error('Sol Pod did not accept the confirmation');
    notice('Confirmation sent. Applying the next combat step…');
   }catch(error){notice('Could not finish declaring blockers: '+(error?.message||error),true);}
   finally{busy=false;paint();}
  };
  footer.append(confirm);
  resume.style.display='none';
 }
 function show(){
  if(!inStep()||window.ctForgeChoice?.hasPending||
    window.ctForgeSafety?.recoveryVisible||window.ctForgeRequiredAction?.visible)return;
  modal.dataset.open='true';paint();resume.style.display='none';
 }
 function hide(exiting){
  modal.dataset.open='false';
  if(exiting){stage='';selectedAttacker=null;expandedGroups.clear();
   if(autoTimer)clearTimeout(autoTimer);autoTimer=null;
   resume.style.display='none';return;}
  resume.style.display=inStep()?'block':'none';
 }
 function sync(){
  if(!inStep()){hide(true);return;}
  const key=String(state()?.turn)+'|'+String(state()?.phaseDetail)+'|'+
    String(own()?.forgeId);
  if(stage!==key){
   stage=key;shownFor='';selectedAttacker=null;lastMessage='';
   status.textContent='';uncertain=false;expandedGroups.clear();
  }
  if(modal.dataset.open==='true'){
   // Existing mandatory choices/recovery always own the top interaction.
   if(window.ctForgeChoice?.hasPending||window.ctForgeSafety?.recoveryVisible){
    modal.dataset.open='false';resume.style.display='block';return;
   }
   paint();return;
  }
  resume.style.display='block';
  if(shownFor!==key && !autoTimer){
   autoTimer=setTimeout(()=>{
    autoTimer=null;
    if(inStep()&&stage===key&&shownFor!==key){
     shownFor=key;
     show();
    }
   },350); // Stable game phase, not a one-frame popup.
  }
 }
 resume.onclick=()=>show();
 modal.addEventListener('click',event=>{
  // Do not dismiss a required blocker decision with backdrop taps.
  if(event.target===modal)event.stopPropagation();
 });
 window.addEventListener('ct-forge-selection',sync);
 window.addEventListener('ct-combat-queue-updated',sync);
 window.addEventListener('ct-forge-prompt-updated',sync);
 const previous=window.CommandTableNativeReply;
 window.CommandTableNativeReply=function(payload){
  let data;
  try{data=typeof payload==='string'?JSON.parse(payload):payload;}catch(_){}
  const result=typeof previous==='function'?previous(payload):undefined;
  if(data?.type==='game.state'||data?.type==='game.choice.clear')sync();
  return result;
 };
 window.ctCombatPlanner={sync,open:show,hide,
  get visible(){return modal.dataset.open==='true';},
  get pending(){return busy||uncertain;}};
 sync();
})();
