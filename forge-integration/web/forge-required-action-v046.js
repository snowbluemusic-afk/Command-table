/* Sol Pod v0.46 — structured Forge action router.
 * Required choices live in a dedicated full-screen dialog, NEVER the Game Log.
 * No local card legality: all selectable IDs, approvals and button availability
 * originate from Forge's Selection and updateButtons payloads.
 * Ordinary priority passes and normal attack/block gestures stay on battlefield.
 */
(()=>{
  'use strict';
  if(window.ctForgeRequiredAction)return;
  const css=document.createElement('style');
  css.id='ct-required-forge-action-v046';
  css.textContent=[
    '#ct-required-forge-action{position:fixed;inset:0;z-index:2147483350;',
    'display:none;align-items:center;justify-content:center;',
    'padding:clamp(8px,2vh,20px);background:#020a15ef;',
    'box-sizing:border-box;color:#f9ead4;font-family:system-ui;',
    'pointer-events:auto;backdrop-filter:blur(5px)}',
    '#ct-required-forge-action[data-open="true"]{display:flex}',
    '#ct-required-forge-action .ct-required-sheet{width:min(94vw,920px);',
    'max-height:94dvh;display:flex;flex-direction:column;gap:10px;',
    'padding:clamp(12px,3vh,25px);box-sizing:border-box;',
    'border:2px solid #dbb47a;border-radius:17px;',
    'background:linear-gradient(140deg,#19333b,#0d1b28);',
    'box-shadow:0 20px 70px #000d;overflow:auto}',
    '#ct-required-forge-action h2{font:800 clamp(23px,4vw,39px) Georgia,serif;',
    'color:#ffe1a2;margin:0}',
    '#ct-required-forge-action .ct-required-intro{font-size:clamp(12px,2.4vh,16px);',
    'color:#e3e8e6;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere}',
    '#ct-required-forge-action .ct-required-count{font:800 12px system-ui;',
    'color:#e5c38b}',
    '#ct-required-forge-action .ct-required-options{display:grid;',
    'grid-template-columns:repeat(auto-fit,minmax(min(205px,100%),1fr));',
    'gap:8px;overflow-y:auto;min-height:0;max-height:37dvh}',
    '#ct-required-forge-action button{min-height:43px;cursor:pointer;',
    'border-radius:9px;border:1px solid #bca87e;padding:9px 11px;',
    'color:#fff0d5;background:#2d4654;font:750 14px system-ui;',
    'text-align:left;touch-action:manipulation}',
    '#ct-required-forge-action button[data-chosen="true"]{',
    'border:2px solid #f2c77b;background:#435d57}',
    '#ct-required-forge-action button:disabled{opacity:.45;cursor:default}',
    '#ct-required-forge-action .ct-required-footer{display:flex;',
    'gap:10px;flex-wrap:wrap}',
    '#ct-required-forge-action .ct-required-footer button{flex:1;',
    'text-align:center}',
    '#ct-required-forge-action .ct-required-primary{',
    'background:#e1b876;color:#102431}',
    '#ct-required-forge-action .ct-required-status{min-height:17px;',
    'font:700 12px system-ui;color:#ffd7a8}',
    '#ct-forge-required-resume{position:fixed;left:clamp(10px,2vw,22px);',
    'bottom:clamp(9px,3dvh,22px);z-index:2147483270;',
    'display:none;min-height:43px;border:2px solid #dfb478;',
    'border-radius:11px;background:#e4bc7e;color:#13242f;',
    'padding:9px 16px;font:800 13px system-ui;',
    'box-shadow:0 7px 28px #000a}',
    // Forge priority buttons are still in the DOM for their original
    // command handlers; hide their dock only while this modal owns the choice.
    '#ct-forge-priority-buttons.ct-required-modal-source{display:none!important}',
    '@media(orientation:landscape) and (max-height:440px){',
    '#ct-required-forge-action .ct-required-sheet{gap:6px;padding:9px}',
    '#ct-required-forge-action h2{font-size:23px}',
    '#ct-required-forge-action .ct-required-options{max-height:26dvh}',
    '#ct-required-forge-action button{min-height:34px;padding:5px 9px}',
    '#ct-required-forge-action .ct-required-intro{font-size:12px}',
    '}'
  ].join('');
  document.head.append(css);
  const make=(tag,className,text)=>{
    const el=document.createElement(tag);
    if(className)el.className=className;
    if(text!==undefined)el.textContent=String(text);
    return el;
  };
  const backdrop=make('section');
  backdrop.id='ct-required-forge-action';
  backdrop.dataset.open='false';
  backdrop.setAttribute('role','dialog');
  backdrop.setAttribute('aria-modal','true');
  backdrop.setAttribute('aria-label','Forge requires your decision');
  const sheet=make('div','ct-required-sheet');
  const heading=make('h2');
  const intro=make('div','ct-required-intro');
  const count=make('div','ct-required-count');
  const list=make('div','ct-required-options');
  const feedback=make('div','ct-required-status');
  const footer=make('div','ct-required-footer');
  sheet.append(heading,intro,count,list,feedback,footer);
  backdrop.append(sheet);
  document.body.append(backdrop);
  const resume=make('button',null,'✦ Continue Forge choice');
  resume.id='ct-forge-required-resume';resume.type='button';
  document.body.append(resume);
  let minimized='',key='',submitting=false,lastExplicit='',notice='';
  let current=null,waitingForForgeKey='';
  const player=()=>window.app?.game?.players?.[0];
  const phase=()=>String(window.app?.game?.phaseDetail||'').toUpperCase();
  const inCombat=()=>/ATTACKERS|BLOCKERS/.test(phase());
  const forgeChoice=()=>!!window.ctForgeChoice?.hasPending;
  const priority=()=>window.ctForgePriority;
  const selector=()=>window.ctForgeSelection;
  const modeData=()=>{
    if(!window.app?.nativeMatch||window.app?.view!=='game'||!window.app?.game||
        window.app.game.gameOver || window.app.game.winner!=null ||
        forgeChoice()||window.ctForgeSafety?.recoveryVisible)return null;
    const buttons=priority()?.buttonInfo||{};
    const select=selector()?.selectionInfo||{};
    const cards=Array.isArray(select.cards)?select.cards:[];
    const targets=Array.isArray(select.targets)?select.targets:[];
    const chosen=Array.isArray(select.chosen)?select.chosen:[];
    const min=Number(select.min)||0;
    const enabled=!!buttons.enable1||!!buttons.enable2;
    const messages=[buttons.message,buttons.prompt,selector()?.prompt,lastExplicit]
      .filter(Boolean).map(String);
    const prompt=messages.find(v=>/discard|mulligan|bottom|choose|select|pay mana|approve|confirm|sacrifice|exile|return/i.test(v))
      ||messages[0]||'Forge requires your choice';
    const label1=String(buttons.label1||'OK');
    const label2=String(buttons.label2||'Cancel');
    const mana=/^auto$/i.test(label1.trim()) && /^cancel$/i.test(label2.trim());
    const opening=window.app.game.phase==='mulligan' ||
      /^(?:play|keep|mulligan)$/i.test(label1.trim()) ||
      /^(?:draw|mulligan)$/i.test(label2.trim());
    const usable=cards.filter(c=>!c.actionable);
    const needCards=usable.length>0 && (min>0 ||
      /\b(?:discard|bottom|return|choose|select|sacrifice)\b/i.test(prompt));
    // Forge supplies choices of stack/board/player targets separately. The
    // already full-screen target UI owns those; never display two overlays.
    if(targets.length>0)return null;
    const unusual=enabled && (
      /^(?:yes|no|approve|decline|accept|reject|keep|mulligan|play|draw)$/i.test(label1.trim()) ||
      /^(?:yes|no|approve|decline|accept|reject|keep|mulligan|play|draw)$/i.test(label2.trim()) ||
      /^\s*(?:choose|select|approve|confirm|pay|discard|pick|return)\b/i.test(prompt)
    );
    // Ordinary priority/phase advancement (OK, Cancel, Pass) and combat
    // declaration must remain on the battlefield.
    if(inCombat()&&!mana&&!needCards&&!opening)return null;
    if(!opening&&!mana&&!needCards&&!unusual)return null;
    const kind=needCards?'cards':mana?'mana':opening?'opening':'approval';
    const available=needCards?usable:(mana?cards:[]);
    return {kind,buttons,items:available,prompt,chosen,min,enabled,
      key:JSON.stringify([kind,label1,label2,select.min,select.max,
        available.map(c=>[c.id,c.label,c.actionable]),
        chosen.map(String),prompt,buttons.sequence||0])};
  };
  function show(value,signature){
    backdrop.dataset.open=value?'true':'false';
    resume.style.display=!value&&current&&minimized===signature?'block':'none';
    const dock=document.getElementById('ct-forge-priority-buttons');
    dock?.classList.toggle('ct-required-modal-source',value);
  }
  const button=(label,fn,cls='',enabled=true)=>{
    const el=make('button',cls,label);
    el.type='button';el.disabled=!enabled||submitting||waitingForForgeKey===key;el.onclick=fn;
    footer.append(el);return el;
  };
  async function apply(ok){
    if(submitting||!current||waitingForForgeKey===key)return;
    submitting=true;
    feedback.textContent='Sending your decision to Forge…';
    paint();
    const answered=ok ? priority()?.confirm?.() : priority()?.cancel?.();
    try{
      const success=await answered;
      if(success===false) {
        feedback.textContent='Forge did not accept this decision. Use the recovery dialog.';
        return;
      }
      waitingForForgeKey=key;
      feedback.textContent='Decision sent to Forge. Waiting for the next prompt or game-state update; do not submit it twice.';
      minimized='';lastExplicit='';notice='';
      // Never assume completion or submit the decision twice; wait for
      // Forge's next selection/prompt/state event to close or replace it.
    }catch(error){
      feedback.textContent='Forge did not complete the decision: '+(error?.message||error);
      window.ctForgeSafety?.showError?.(error,'Forge decision unavailable');
    }finally{submitting=false;sync();}
  }
  async function chooseCard(item,signature){
    if(submitting||!current||signature!==key)return;
    if(!selector()?.isLegalCard?.(item.id)){
      feedback.textContent='This card is no longer legal. Review the new Forge choice.';return;
    }
    submitting=true;paint();feedback.textContent='Selecting '+String(item.label||'card')+' in Forge…';
    try{
      const success=await selector()?.chooseCard?.(item.id);
      if(success===false)
        feedback.textContent='Forge did not accept that selection. Refresh the current decision.';
      else feedback.textContent='Selection received by Forge.';
    }catch(error){
      feedback.textContent='Selection unavailable: '+(error?.message||error);
      window.ctForgeSafety?.showError?.(error,'Forge selection unavailable');
    }finally{submitting=false;sync();}
  }
  function paint(){
    if(!current)return;
    const d=current;
    heading.textContent=d.kind==='mana'?'Pay mana':d.kind==='opening'?'Opening decision':
      d.kind==='cards'?'Choose cards':'Decision required';
    intro.textContent=d.kind==='mana'?
      'Forge is waiting for mana payment. Use Auto only when Forge enables it, or choose a legal mana source below.':
      String(d.prompt);
    const chosen=new Set(d.chosen.map(String));
    count.textContent=d.kind==='cards'?
      (d.min?d.min+' required · ':'')+chosen.size+' selected':
      d.items.length?d.items.length+' Forge-legal options':'';
    list.replaceChildren();
    const signature=d.key;
    for(const item of d.items){
      const opt=make('button');
      opt.type='button';
      const label=String(item.label||('Card #'+item.id));
      opt.textContent=(chosen.has(String(item.id))?'✓ ':'')+label+
        (item.zone?' · '+item.zone:'');
      opt.dataset.chosen=String(chosen.has(String(item.id)));
      opt.disabled=submitting||waitingForForgeKey===key||
        (!!window.ctForgeSafety?.needsRecovery && !selector()?.isRequiredSelection?.(item));
      opt.onclick=()=>{void chooseCard(item,signature);};
      list.append(opt);
    }
    feedback.textContent=feedback.textContent||'Select an option to continue.';
    footer.replaceChildren();
    if(d.buttons.enable1)button(String(d.buttons.label1||'Confirm'),()=>{void apply(true);},
      'ct-required-primary');
    if(d.buttons.enable2)button(String(d.buttons.label2||'Cancel'),()=>{void apply(false);});
    // A mana cost might require manually tapping battlefield mana sources if
    // Forge's Auto control cannot pay; do not trap the player behind a modal.
    if(waitingForForgeKey===key){
      const check=make('button',null,'↻ Check Forge status');
      check.onclick=()=>{void window.ctForgeSafety?.recover?.();};
      footer.append(check);
    }
    if(d.kind==='mana'||d.kind==='cards')button('Use battlefield',()=>{
      minimized=key;show(false,key);feedback.textContent='';
    });
    if(!d.enabled && !d.items.length)
      feedback.textContent='Forge has not enabled a response yet. Check available mana or refresh Forge status.';
  }
  function sync(){
    const d=modeData();
    if(!d){current=null;key='';minimized='';lastExplicit='';waitingForForgeKey='';show(false,'');return;}
    if(d.key!==key){
      key=d.key;minimized='';waitingForForgeKey='';feedback.textContent='';
    }
    current=d;
    const opened=minimized!==key;
    show(opened,key);
    if(opened)paint();
  }
  resume.onclick=()=>{minimized='';if(current){show(true,key);paint();}};
  backdrop.addEventListener('click',event=>{
    // Required Forge actions cannot be silently dismissed by backdrop taps.
    if(event.target===backdrop)event.stopPropagation();
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape' && backdrop.dataset.open==='true'){
      event.preventDefault();event.stopImmediatePropagation();
    }
  },true);
  window.addEventListener('ct-forge-selection',sync);
  window.addEventListener('ct-forge-prompt-updated',sync);
  const previous=window.CommandTableNativeReply;
  window.CommandTableNativeReply=function(payload){
    let parsed;
    try{parsed=typeof payload==='string'?JSON.parse(payload):payload;}catch(_){}
    const result=typeof previous==='function'?previous(payload):undefined;
    if(parsed?.type==='game.state'||parsed?.type==='game.choice'||parsed?.type==='game.choice.clear')sync();
    return result;
  };
  window.ctForgeRequiredAction={
    refresh:sync,
    get visible(){return backdrop.dataset.open==='true';},
    get required(){return !!current;},
    get kind(){return current?.kind||null;},
    onNotice(message){
      // Never invent a choice from plain prose. Structured Forge selection
      // and button state supply the actual legal actions.
      const raw=String(message||'');
      if(!/^\s*(?:please\s+)?(?:choose|select|approve|confirm|discard|sacrifice|pay|tap|assign|cancel\s+pending|refresh\s+forge)\b/i.test(raw))
        return false;
      // Do not cover an already-visible Forge choice/target modal with a
      // second generic recovery sheet simply because notice text is imperative.
      if(forgeChoice() || window.ctFullscreenTargets?.visible ||
         (selector()?.legalTargets||[]).length>0)return true;
      lastExplicit=raw;
      sync();
      if(!current)window.ctForgeSafety?.showError?.(
        new Error(raw),'Forge requires an action, but no legal choices are available yet');
      return true;
    }
  };
  sync();
})();