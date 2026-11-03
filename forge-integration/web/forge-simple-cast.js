/* Command Table cast preview: one card, one Cast button, one Forge command.
 * No local rules, mana payment, target guessing or automatic stack resolution.
 */
(() => {
  'use strict';
  const style=document.createElement('style');
  style.id='ct-cast-preview-v019';
  style.textContent=[
    '#ct-cast-preview{display:none;position:fixed;inset:0;z-index:2147483200;',
    'align-items:center;justify-content:center;background:#040c10cc;',
    'backdrop-filter:blur(6px);padding:12px;box-sizing:border-box;pointer-events:auto}',
    '#ct-cast-preview[data-open="true"]{display:flex}',
    '#ct-cast-preview .ct-cast-sheet{display:flex;position:relative;gap:16px;',
    'width:min(800px,86vw);max-height:91dvh;overflow:auto;',
    'border:1px solid #e5c48a;border-radius:17px;padding:17px;',
    'background:linear-gradient(125deg,#152f37,#0c1c24);',
    'color:#f8ebd2;box-shadow:0 22px 90px #000d;box-sizing:border-box}',
    '#ct-cast-preview .ct-cast-art{width:clamp(170px,25vw,265px);',
    'height:min(77dvh,405px);object-fit:contain;border-radius:10px;flex:none;',
    'filter:drop-shadow(0 6px 18px #0009)}',
    '#ct-cast-preview .ct-cast-content{flex:1;min-width:0;display:flex;',
    'flex-direction:column;gap:10px;max-height:78dvh;overflow:auto}',
    '#ct-cast-preview .ct-cast-content h2{font:700 clamp(17px,2vw,25px) Georgia,serif;',
    'color:#fce3b0;margin:0 26px 0 0;overflow-wrap:anywhere}',
    '#ct-cast-preview .ct-cast-meta{font:600 12px system-ui;color:#bcd5d6}',
    '#ct-cast-preview .ct-cast-rules{font:13px/1.6 system-ui;white-space:pre-wrap;',
    'flex:1;overflow:auto;max-height:42dvh;padding:10px;',
    'background:#08171d9e;border:1px solid #45616c;border-radius:9px}',
    '#ct-cast-preview .ct-cast-actions{display:flex;gap:9px;flex-wrap:wrap}',
    '#ct-cast-preview button{min-height:44px;padding:9px 17px;border-radius:9px;',
    'border:1px solid #bba27d;font:bold 14px system-ui;touch-action:manipulation}',
    '#ct-cast-preview .ct-cast-go{flex:2;background:#e5b874;color:#102631}',
    '#ct-cast-preview .ct-cast-cancel{flex:1;background:#263b45;color:#f8e7ce}',
    '#ct-cast-preview .ct-cast-close{position:absolute;right:12px;top:12px;',
    'min-width:32px;min-height:32px;padding:2px 8px;background:#28424a;color:white}',
    '#ct-cast-preview button:disabled{opacity:.55}',
    '#ct-cast-preview .ct-cast-error{color:#ffc0a9;font:600 12px system-ui;',
    'border-left:3px solid #e38c65;padding:5px 9px}',
    '#ct-cast-preview .ct-cast-hint{font:11px/1.4 system-ui;color:#a4bdc2}',
    '@media(orientation:portrait){#ct-cast-preview .ct-cast-sheet{width:96vw;',
    'flex-direction:column;gap:8px;align-items:center;padding:10px}',
    '#ct-cast-preview .ct-cast-art{height:35dvh;width:min(45vw,200px)}',
    '#ct-cast-preview .ct-cast-content{width:100%;max-height:45dvh}',
    '#ct-cast-preview .ct-cast-rules{max-height:22dvh}}',
    '@media(orientation:landscape) and (max-height:540px){',
    '#ct-cast-preview .ct-cast-sheet{padding:10px;gap:12px;max-height:95dvh}',
    '#ct-cast-preview .ct-cast-art{height:77dvh;width:min(23vw,220px)}',
    '#ct-cast-preview .ct-cast-content{gap:5px;max-height:86dvh}',
    '#ct-cast-preview .ct-cast-rules{font-size:11px;max-height:35dvh;padding:7px}',
    '#ct-cast-preview button{min-height:35px;padding:6px 13px;font-size:12px}}'
  ].join('');
  document.head.append(style);
  const backdrop=document.createElement('div');
  backdrop.id='ct-cast-preview';
  backdrop.dataset.open='false';
  backdrop.setAttribute('role','dialog');
  backdrop.setAttribute('aria-modal','true');
  backdrop.setAttribute('aria-label','Card preview and cast');
  document.body.append(backdrop);
  let displayed=null,busy=false,handChoiceQueue=Promise.resolve();
  const say=(s)=>window.ctNativeToast?.(s) || window.announce?.(s);
  const currentPlayer=()=>window.app?.game?.players?.[0];
  const getFromHand=(index)=>{
    const p=currentPlayer();
    if(!p || !Number.isInteger(index) || index<0 || index>=p.hand.length)return null;
    const id=Number(p.handForgeIds?.[index]);
    if(!Number.isInteger(id)||id<=0)return null;
    return {name:p.hand[index],id,source:'hand',index};
  };
  const getCommander=()=>{
    const p=currentPlayer();
    const commander=p?.commandZone?.find(c=>c.commander) || p?.commandZone?.[0];
    if(!commander||!Number.isInteger(Number(commander.id)))return null;
    return {name:commander.name,id:Number(commander.id),source:'command'};
  };
  const lookup=(name)=>{
    const p=currentPlayer();
    if(!p)return null;
    const handIndex=p.hand.findIndex(n=>String(n).toLowerCase()===String(name).toLowerCase());
    return handIndex>=0?getFromHand(handIndex):getCommander()?.name===name?getCommander():null;
  };
  const hide=()=>{
    backdrop.dataset.open='false';
    backdrop.replaceChildren();
    displayed=null;
    busy=false;
  };
  function open(card,error){
    if(!card||!window.app?.nativeMatch||window.app?.view!=='game')return;
    const p=currentPlayer();
    const source=card.source==='hand'?getFromHand(card.index):getCommander();
    if(!source||source.id!==card.id){
      say('That card has moved. Choose it again from your hand or command zone.');
      return;
    }
    displayed=source;busy=false;
    const meta=window.ctForgeCards?.[String(source.name).toLowerCase()]||{};
    const zone=source.source==='command'
      ? p?.commandZone?.find(c=>Number(c.id)===source.id)
      : null;
    const fullText=String(zone?.rulesText||meta.text||'No card rules text available yet.');
    const type=String(zone?.type||meta.type||'');
    const mana=String(zone?.manaCost||meta.cost||'');
    const isLand=/\bLand\b/i.test(type);
    const sheet=document.createElement('article');sheet.className='ct-cast-sheet';
    const art=document.createElement('img');art.className='ct-cast-art';
    art.alt=source.name;art.src=window.ctCardArtUrl?.(source.name)||'';
    const content=document.createElement('section');content.className='ct-cast-content';
    const title=document.createElement('h2');title.textContent=source.name;
    const line=document.createElement('div');line.className='ct-cast-meta';
    line.textContent=[mana,type,source.source==='command'?'Command zone':'Hand'].filter(Boolean).join(' · ');
    const rules=document.createElement('div');rules.className='ct-cast-rules';rules.textContent=fullText;
    const hint=document.createElement('div');hint.className='ct-cast-hint';
    hint.textContent='Forge checks timing, mana, targets and all card rules. Spells resolve after players pass priority.';
    const err=document.createElement('div');err.className='ct-cast-error';
    if(error)err.textContent=error;else err.style.display='none';
    const actions=document.createElement('div');actions.className='ct-cast-actions';
    const confirm=document.createElement('button');
    confirm.type='button';confirm.className='ct-cast-go';
    confirm.textContent=isLand?'Play land':'Cast';
    const cancel=document.createElement('button');cancel.type='button';
    cancel.className='ct-cast-cancel';cancel.textContent='Cancel';cancel.onclick=hide;
    const x=document.createElement('button');x.type='button';
    x.className='ct-cast-close';x.setAttribute('aria-label','Close card preview');
    x.textContent='×';x.onclick=hide;
    confirm.onclick=async()=>{
      if(busy||!displayed)return;
      busy=true;confirm.disabled=true;confirm.textContent='Casting…';
      const choice=displayed;
      const isCurrent=choice.source==='hand'
        ? getFromHand(choice.index)?.id===choice.id
        : getCommander()?.id===choice.id;
      if(!isCurrent){
        busy=false;
        open(choice,'The card has moved. Please choose it again.');
        return;
      }
      // Gate every cast against the current Forge snapshot before entering
      // the native request. This is not a local mana rules approximation:
      // mana costs, alternate costs and stack legality stay with Forge.
      const safety=window.ctForgeSafety?.checkCast(choice);
      if(safety && !safety.ok){
        open(choice,safety.reason);
        return;
      }
      let request,watchdog;
      try {
        // Submit the actual Forge command FIRST. Previously, calling render()
        // before sending it could throw or replace the page and make Cast
        // appear to do nothing without ever reaching the Android bridge.
        request=window.CommandTableNative.request('game.command',{
          action:'castById',value:choice.id
        });
        hide();
        if(window.app){window.app.sideInspect=null;window.app.modal='';}
        try{window.render?.();}catch(renderError){
          window.ctNativeToast?.('Card sent to Forge; refreshing board failed: '+
            (renderError?.message||String(renderError)));
        }
        watchdog=setTimeout(()=>{
          window.ctNativeToast?.('Forge is still processing '+choice.name+
            '. Check for a mana, target or ability choice.');
        },7000);
        await request;
        window.ctNativeToast?.('Forge selected '+choice.name+
          '. Complete any mana or target choices; players can respond.');
        // Snapshot refresh is best-effort. A transient snapshot error MUST
        // NOT be misreported as a failed cast after Forge accepted the command.
        try {
          const snapshot=await window.CommandTableNative.request('game.snapshot');
          if(snapshot?.game)window.ctReceiveForgeState?.(snapshot.game);
        }catch(refreshError){
          window.ctNativeToast?.('Forge accepted the card. Waiting for the next game update.');
        }
      }catch(failure){
        const message='Forge could not cast this card: '+(failure?.message||String(failure));
        open(choice,message);
        window.ctNativeToast?.(message);
        window.announce?.(message);
      }finally{
        if(watchdog)clearTimeout(watchdog);
      }
    };
    actions.append(confirm,cancel);
    content.append(title,line,rules,hint,err,actions);
    sheet.append(art,content,x);
    backdrop.replaceChildren(sheet);
    backdrop.dataset.open='true';
    cancel.focus({preventScroll:true});
  }
  document.addEventListener('click',event=>{
    if(!window.app?.nativeMatch || window.app?.view!=='game'||backdrop.dataset.open==='true')return;
    // A hand copy is identified by its *current hand index*, never by name;
    // two copies of the same card must cast the correct Forge card instance.
    const hand=event.target.closest('.ct10-hand-slot .game-card[data-action],.ct10-hand-zoom .game-card[data-action]');
    if(hand){
      // data-value is the original Forge-hand index, even when the
      // card has been moved visually to the front of a playable-first hand.
      // The old DOM-position fallback selected the WRONG card after sorting.
      // Do not derive identity from screen order, labels, or duplicated names.
      const rawIndex=hand.getAttribute('data-value');
      const index=rawIndex!==null && /^\d+$/.test(rawIndex)
        ? Number(rawIndex) : -1;
      const card=getFromHand(index);
      if(!card)return;
      event.preventDefault();event.stopImmediatePropagation();
      if(window.ctForgePriority?.isHandChoice){
        // Discarding or mulliganing uses Forge card selection, not Cast.
        // Select by stable ID (two identical cards are different instances).
        // A two-card discard needs two distinct commands. Queue fast taps
        // instead of silently dropping the second tap while Forge processes
        // the first selection.
        const exactId=card.id;
        handChoiceQueue=handChoiceQueue.catch(()=>{}).then(async()=>{
          try{
            await window.CommandTableNative.request('game.command',{
              action:'cardId',value:exactId
            });
            const snapshot=await window.CommandTableNative.request('game.snapshot').catch(()=>null);
            if(snapshot?.game)window.ctReceiveForgeState?.(snapshot.game);
            window.ctForgePriority?.refresh?.();
          }catch(error){
            say('Forge could not select this hand card: '+(error?.message||String(error)));
          }
        });
        return;
      }
      open(card);return;
    }
    const command=event.target.closest('.ct-commander-zone-card [data-action="castCommander"],'+
      '.ct-commander-zone-card [data-action="inspectCommander"],'+
      '.ct10-own-player [data-action="inspectCommander"]');
    if(command){
      const card=getCommander();
      if(!card)return;
      event.preventDefault();event.stopImmediatePropagation();open(card);return;
    }
  },true);
  backdrop.addEventListener('click',event=>{if(event.target===backdrop)hide();});
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&backdrop.dataset.open==='true'){event.preventDefault();hide();}
  },true);
  window.ctSimpleCast={openHand:index=>open(getFromHand(index)),
    openCommander:()=>open(getCommander()),hide,
    get isOpen(){return backdrop.dataset.open==='true';}};
})();