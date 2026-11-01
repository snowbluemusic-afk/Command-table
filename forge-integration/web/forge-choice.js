/* Command Table's authoritative human decision sheet.
 * Original Forge option indices are returned to the engine; no JS rules or
 * browser-generated targets are ever considered legal on their own.
 */
(() => {
  'use strict';
  let current = null;
  let selected = [];
  let inFlight = false;
  const view = document.createElement('section');
  view.id = 'ct-forge-decision-sheet';
  view.setAttribute('role', 'dialog');
  view.setAttribute('aria-label', 'Forge game choice');
  view.setAttribute('aria-modal', 'true');
  view.style.cssText = [
    'display:none','position:fixed','inset:0','z-index:2147483000',
    'background:transparent','pointer-events:none',
    'justify-content:flex-end','align-items:center','padding:9px 16px',
    'box-sizing:border-box','font-family:system-ui,-apple-system,sans-serif'
  ].join(';');
  const sheet = document.createElement('div');
  sheet.style.cssText = [
    'background:#17252cf9','color:#f2e8d8','width:min(37vw,460px)',
    'max-width:460px','max-height:74dvh','overflow:auto','border:1px solid #bda17d',
    'border-radius:15px','box-shadow:0 12px 30px #000b','padding:12px',
    'pointer-events:auto',
    'box-sizing:border-box'
  ].join(';');
  view.append(sheet);
  document.body.append(view);
  // A Forge selection is part of the battlefield, not a navigation event.
  // Keep the table and hand visible; only the choice tray intercepts touches.
  const responsive = document.createElement('style');
  responsive.id='ct-forge-choice-layout';
  responsive.textContent=[
    '@media(orientation:portrait){#ct-forge-decision-sheet{align-items:flex-end!important;justify-content:center!important;padding:6px!important}',
    '#ct-forge-decision-sheet>div{width:100%!important;max-width:640px!important;max-height:64dvh!important}}',
    '@media(orientation:landscape) and (max-height:520px){#ct-forge-decision-sheet>div{max-height:79dvh!important;width:min(34vw,420px)!important}}'
  ].join('');
  document.head.append(responsive);

  function el(tag, text, css) {
    const x = document.createElement(tag);
    if (text !== undefined && text !== null) x.textContent = String(text);
    if (css) x.style.cssText = css;
    return x;
  }
  function action(text, onClick, primary = false) {
    const b = el('button',text,[
      'background:' + (primary ? '#bda17d' : '#2a3c46'),
      'color:' + (primary ? '#17242b' : '#f5e9d7'),
      'border:1px solid #a98d6b','border-radius:11px',
      'padding:12px 14px','font-size:14px','font-weight:700',
      'min-height:46px','cursor:pointer','flex:1'
    ].join(';'));
    b.type = 'button';
    b.onclick=onClick;
    return b;
  }
  function isOrder() { return current && current.mode === 'order'; }
  function toggle(index) {
    if (inFlight) return;
    if (isOrder()) return;
    if (current.mode === 'single') {
      selected = [index];
    } else {
      selected = selected.includes(index)
        ? selected.filter(x => x !== index)
        : selected.length < current.max ? [...selected,index] : selected;
    }
    paint();
    // One legal pick: the card/option tap IS confirmation. No second
    // full-screen confirm step unless Forge actually requested more picks.
    if (current && selected.length===1 && current.min===1 && current.max===1 &&
        (current.mode==='single'||current.mode==='multiple')) void answer(false);
  }
  function move(index, delta) {
    if (inFlight || !isOrder()) return;
    const before = selected.indexOf(index);
    const after = before + delta;
    if (after < 0 || after >= selected.length) return;
    [selected[before],selected[after]]=[selected[after],selected[before]];
    paint();
  }
  function getTyped() {
    const input = sheet.querySelector('[data-ct-choice-value]');
    return input ? input.value : '';
  }
  async function answer(cancelled = false) {
    if (!current || inFlight) return;
    const mode = current.mode;
    if (!cancelled && mode !== 'integer' && mode !== 'text') {
      if (selected.length < current.min || selected.length > current.max) {
        showError('Select between '+current.min+' and '+current.max+' choices.');
        return;
      }
    }
    const value = getTyped();
    if (!cancelled && mode === 'allocation') {
      const total=Object.values(current.allocation||{}).reduce((n,v)=>n+Number(v||0),0);
      if(total!==Number(current.amount||0)){
        showError('Assign all '+current.amount+' '+(current.unit||'points')+'.');
        return;
      }
    }
    if (!cancelled && mode === 'integer') {
      const n = Number(value);
      if (!Number.isInteger(n) || n < current.minValue || n > current.maxValue) {
        showError('Choose an integer from '+current.minValue+' to '+current.maxValue+'.');
        return;
      }
    }
    const submittingId=current.id;
    inFlight=true;
    paint();
    try {
      const response = await window.CommandTableNative.request('choice.answer', {
        choiceId:submittingId,
        indices:selected.slice(),
        text:value,
        allocation:current.allocation||{},
        cancelled,
        remember:false
      });
      if (!response || response.accepted !== true) throw new Error('Choice was no longer active');
      // The Forge match thread may issue its NEXT discard/target prompt before
      // this HTTP-style bridge request completes. Never clear a newer choice.
      if(current?.id===submittingId) {
        current=null;
        selected=[];
        view.style.display='none';
      }
      inFlight=false;
      if(current)paint();
      // Recover after Android briefly backgrounds the WebView while Forge
      // waits on a subsequent human decision. engine.status replays pending.
      setTimeout(()=>{
        if(!current && window.app?.nativeMatch)
          void window.CommandTableNative.request('engine.status').catch(()=>{});
      },350);
    } catch (e) {
      inFlight=false;
      if(current?.id!==submittingId)return; // A newer valid choice owns UI.
      showError('Forge could not accept this choice: '+(e?.message||String(e)));
      paint();
    }
  }
  function showError(message) {
    if (!current) return;
    current.error=message;
    const status=sheet.querySelector('[data-ct-error]');
    if(status) status.textContent=message;
  }
  function paint() {
    sheet.replaceChildren();
    if (!current) return;
    const subtitle=el('p','YOUR DECISION · FORGE RULES',
      'color:#c6ab83;font-size:10px;font-weight:800;letter-spacing:.15em;margin:0 0 6px');
    sheet.append(subtitle);
    const plainTitle=String(current.title||'Choose an option')
      .replace(/\b1 card\(s\)/gi,'one card')
      .replace(/\bDiscarded\s*$/i,'').trim();
    const heading=el('h3',plainTitle,
      'font-size:17px;line-height:1.3;font-weight:750;margin:0 0 7px;white-space:pre-wrap');
    sheet.append(heading);
    const desc = current.mode==='order'
      ? 'Arrange these cards in the required order.'
      : current.mode==='multiple'
        ? 'Choose '+current.min+(current.min!==current.max?'–'+current.max:'')+' option(s).'
        : current.mode==='single'
          ? 'Select the legal option you want.'
          : 'Enter your decision.';
    sheet.append(el('p',desc,'font-size:12px;color:#acb8bc;margin:0 0 12px'));
    const list=el('div',null,'display:grid;gap:7px;max-height:42dvh;overflow:auto');
    const opts=Array.isArray(current.options)?current.options:[];
    if (current.mode==='allocation') {
      const total=Number(current.amount||0);
      const minimum=Number(current.minEach||0);
      const assigned=current.allocation||{};
      const summary=el('div',
        'Total to distribute: '+total+' '+(current.unit||'points'),
        'color:#e8cd9e;font-size:13px;font-weight:700;margin-bottom:8px');
      list.append(summary);
      for(let i=0;i<opts.length;i++){
        const label=opts[i]?.label==='null'?'Defending player':opts[i]?.label||('Target '+(i+1));
        const line=el('label',null,'display:flex;gap:10px;align-items:center;padding:8px;border:1px solid #536b72;border-radius:10px');
        const name=el('span',label,'flex:1;font-size:13px;overflow-wrap:anywhere');
        const input=el('input');
        input.type='number';input.min=String(minimum);input.max=String(total);input.step='1';
        input.value=String(assigned[i]??minimum);
        input.style.cssText='width:75px;min-height:40px;background:#283d46;color:white;border:1px solid #ba9e7b;border-radius:9px;padding:6px;font-size:16px;box-sizing:border-box';
        input.oninput=()=>{
          const val=Number(input.value);
          if(!Number.isInteger(val)||val<minimum||val>total)return;
          current.allocation[i]=val;
          const left=total-Object.values(current.allocation).reduce((n,v)=>n+Number(v||0),0);
          summary.textContent='Total: '+total+' · '+(left>=0?left+' remaining':Math.abs(left)+' over');
        };
        line.append(name,input);list.append(line);
      }
    } else if (current.mode==='integer' || current.mode==='text') {
      const input=el('input');
      input.dataset.ctChoiceValue='1';
      input.type=current.mode==='integer'?'number':current.numeric?'number':'text';
      input.value=current.value === undefined?'':String(current.value);
      input.placeholder='Enter a value';
      if(current.mode==='integer') {
        input.min=String(current.minValue);
        input.max=String(current.maxValue);
        input.step='1';
      }
      input.style.cssText='box-sizing:border-box;width:100%;min-height:48px;background:#243640;color:#fff;border:1px solid #c3a887;border-radius:10px;padding:12px;font-size:16px';
      input.oninput=()=>{current.value=input.value;};
      list.append(input);
    } else {
      const order = isOrder() ? selected : opts.map((_,i)=>i);
      for (const index of order) {
        const item=opts[index];
        if(!item)continue;
        const label=item.label || ('Choice '+(index+1));
        const chosen=selected.includes(index);
        const line=el('div',null,'display:flex;align-items:stretch;gap:7px;');
        if (isOrder()) {
          const number=el('span',String(selected.indexOf(index)+1)+'.',
            'min-width:24px;align-self:center;color:#d5b585;font-weight:800');
          line.append(number);
        }
        const b=action((chosen && !isOrder()?'✓ ':'')+label,()=>toggle(index),chosen && !isOrder());
        b.style.textAlign='left';
        b.style.whiteSpace='normal';
        b.style.wordBreak='break-word';
        // Show genuine card art in discard, hand and zone decisions. Artwork
        // is optional; legal choice identity still comes only from Forge.
        const cardPrompt=/discard|card|hand|graveyard|exile|library|permanent/i.test(plainTitle);
        const simpleName=String(label).trim().replace(/^\d+\s*[xX]?\s+/,'');
        if(cardPrompt && simpleName.length>2 && simpleName.length<85 &&
           !/target|player|damage|select|option/i.test(simpleName)) {
          const image=el('img');
          let local='';
          try{local=window.AndroidBridge?.artworkUrl?.(simpleName)||'';}catch(_){}
          image.src=local||('https://api.scryfall.com/cards/named?exact='+
            encodeURIComponent(simpleName)+'&format=image&version=art_crop');
          image.alt='';
          image.loading='lazy';
          image.style.cssText='width:54px;height:51px;object-fit:cover;border-radius:7px;flex:0 0 54px;background:#1d3438';
          image.onerror=()=>{image.style.display='none';};
          const title=el('span',(chosen&&!isOrder()?'✓ ':'')+label,
            'min-width:0;flex:1;overflow-wrap:anywhere');
          b.replaceChildren(image,title);
          b.style.display='flex';b.style.alignItems='center';b.style.gap='9px';
        }
        if (isOrder()) b.disabled=true;
        line.append(b);
        if (isOrder()) {
          const up=action('↑',()=>move(index,-1));
          const down=action('↓',()=>move(index,1));
          up.style.flex=down.style.flex='0 0 42px';
          up.disabled=selected.indexOf(index)===0;
          down.disabled=selected.indexOf(index)===selected.length-1;
          line.append(up,down);
        }
        list.append(line);
      }
    }
    sheet.append(list);
    const error=el('p',current.error||'',
      'color:#f0a294;font-size:12px;min-height:16px;margin:8px 0');
    error.dataset.ctError='1';
    sheet.append(error);
    const footer=el('div',null,'display:flex;gap:10px;position:sticky;bottom:0;background:#17252c;padding-top:8px');
    const ok=action(inFlight?'Applying…':(current.mode==='order'?'Confirm order':'Confirm choice'),
      ()=>answer(false),true);
    ok.disabled=inFlight || (current.mode!=='integer' && current.mode!=='text'
      && (selected.length<current.min || selected.length>current.max));
    if(current.mode==='allocation'){
      const total=Object.values(current.allocation||{}).reduce((n,v)=>n+Number(v||0),0);
      ok.disabled=inFlight||total!==Number(current.amount||0);
      // Input changes still validate on submission; don't prevent correcting amounts.
      ok.disabled=inFlight;
    }
    footer.append(ok);
    if((current.min===0 && current.mode!=='allocation') ||
       current.mode==='text' || current.mode==='integer' || current.allowSkip) {
      const skip=action('Cancel / Skip',()=>answer(true));
      skip.disabled=inFlight;
      footer.append(skip);
    }
    sheet.append(footer);
    view.style.display='flex';
  }
  const previous=window.CommandTableNativeReply;
  window.CommandTableNativeReply=function(payload) {
    let event;
    try {event=typeof payload==='string'?JSON.parse(payload):payload;}catch(e){}
    if(event && event.type==='game.choice') {
      current=event.payload||null;
      selected=current?.mode==='order'
        ? (current.options||[]).map((_,i)=>i) : [];
      if(current) {
        if (current.mode==='integer')current.value=current.initial??current.minValue??0;
        if (current.mode==='text')current.value=current.initial??'';
        if (current.mode==='allocation') {
          current.allocation={};
          for(let i=0;i<(current.options||[]).length;i++)
            current.allocation[i]=Number(current.minEach||0);
        }
      }
      inFlight=false;
      paint();
      return;
    }
    if(event && event.type==='game.choice.clear') {
      current=null;selected=[];inFlight=false;view.style.display='none';
      return;
    }
    return typeof previous==='function'?previous(payload):undefined;
  };
  window.ctForgeChoice = {close:()=>{
    current=null;selected=[];inFlight=false;view.style.display='none';
  }};
})();
