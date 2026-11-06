/* Sol Pod v0.60 — local audio controls and opt-in, Forge-guarded trigger flow.
 * No external audio assets, no alternate rules engine, no hidden card access.
 */
(()=>{
 'use strict';
 if(window.solPodPreferences)return;
 const key='sol_pod_gameplay_preferences_v060';
 const defaults={sound:true,effects:true,effectsVolume:0.38,ambient:false,ambientVolume:0.12,autoResolve:false};
 function getSaved(){
   try{const value=JSON.parse(localStorage.getItem(key)||'{}');
     const result={...defaults};
     for(const k of Object.keys(defaults)){
       if(typeof defaults[k]==='boolean'&&typeof value[k]==='boolean')result[k]=value[k];
       else if(typeof defaults[k]==='number'&&Number.isFinite(value[k]))
         result[k]=Math.min(1,Math.max(0,value[k]));
     }
     return result;
   }catch(_){return {...defaults};}
 }
 const prefs=getSaved();
 const save=()=>{try{localStorage.setItem(key,JSON.stringify(prefs));}catch(_){}};
 const css=document.createElement('style');css.id='sol-pod-settings-v060-style';
 css.textContent=[
 '#sol-pod-preferences{position:fixed;inset:0;z-index:2147483100;display:none;',
 'background:#06131bea;align-items:center;justify-content:center;padding:10px;box-sizing:border-box}',
 '#sol-pod-preferences[data-open="true"]{display:flex}',
 '#sol-pod-preferences>section{width:min(96vw,630px);max-height:94dvh;overflow:auto;',
 'border:2px solid #e1b77c;border-radius:17px;background:#172a32;color:#f3e8d7;',
 'padding:clamp(12px,2vw,21px);font:13px system-ui;box-shadow:0 18px 70px #000d}',
 '#sol-pod-preferences h2{font:800 clamp(21px,3vw,29px) Georgia,serif;margin:0}',
 '#sol-pod-preferences h3{font:800 15px system-ui;color:#e9c98b;margin:10px 0}',
 '#sol-pod-preferences p{color:#c9d6d3;line-height:1.45;margin:5px 0 13px}',
 '#sol-pod-preferences .sol-pref-row{display:flex;align-items:center;justify-content:space-between;',
 'gap:12px;padding:9px 4px;border-bottom:1px solid #62757955}',
 '#sol-pod-preferences label{display:flex;gap:8px;align-items:center;flex:1;font-weight:750}',
 '#sol-pod-preferences input[type="checkbox"]{width:22px;height:22px;accent-color:#dfba83}',
 '#sol-pod-preferences input[type="range"]{width:min(43vw,235px);accent-color:#dfba83}',
 '#sol-pod-preferences .sol-pref-foot{display:flex;flex-wrap:wrap;gap:9px;',
 'justify-content:flex-end;margin-top:15px}',
 '#sol-pod-preferences button{background:#2c4c58;color:#f9e9d2;border:1px solid #bea273;',
 'border-radius:9px;font:750 12px system-ui;padding:10px 13px;min-height:42px}',
 '#sol-pod-preferences button[data-primary]{background:#e1bd84;color:#162832}',
 '#sol-pod-preferences button:focus-visible,#sol-pod-preferences input:focus-visible{outline:3px solid #fff2b4}',
 '#sol-pod-auto-status{position:fixed;left:2%;bottom:13%;z-index:220100;',
 'display:none;background:#183a3eea;color:#f9ead1;border:1px solid #cdb47d;',
 'border-radius:9px;padding:6px 9px;min-height:33px;font:700 10px system-ui}',
 'body:has(.sol-battlefield) #sol-pod-auto-status[data-active="true"]{display:block}',
 '@media(orientation:portrait){#sol-pod-auto-status{left:1%;bottom:17%;max-width:29vw}}'
 ].join('');document.head.append(css);
 const create=(tag,label)=>{
   const el=document.createElement(tag);
   if(label!=null)el.textContent=String(label);
   return el;
 };
 const overlay=create('div');overlay.id='sol-pod-preferences';overlay.dataset.open='false';
 overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');
 overlay.setAttribute('aria-label','Audio and auto-resolve settings');
 const panel=create('section');const head=create('h2','Audio & Gameplay');
 panel.append(head,create('p','Choose how Sol Pod sounds and when it can pass priority for your triggered abilities.'));
 const controls={};
 function row(label,type,name,help){
   const wrap=create('div');wrap.className='sol-pref-row';
   const title=create('label',label);const field=create('input');
   if(type==='checkbox'){
     field.type='checkbox';field.checked=!!prefs[name];
     field.onchange=()=>{
       prefs[name]=field.checked;save();render();
       if(name==='ambient'||name==='sound')syncAmbient(true);
       if(name==='autoResolve')resetBatch();
     };
   }else{
     field.type='range';field.min='0';field.max='100';field.step='5';
     field.value=String(Math.round(prefs[name]*100));
     field.setAttribute('aria-label',label);
     field.oninput=()=>{prefs[name]=Number(field.value)/100;save();syncAmbient(false);};
     field.onchange=()=>{if(name==='effectsVolume')playCue('tap',true);};
   }
   title.htmlFor='sol-pref-'+name;field.id='sol-pref-'+name;title.append(field);
   if(help)title.title=help;
   wrap.append(title);controls[name]=field;panel.append(wrap);
 }
 panel.append(create('h3','Sound'));
 row('Enable audio','checkbox','sound');
 row('Game sound effects','checkbox','effects');
 row('Effects volume','range','effectsVolume');
 row('Ambient atmosphere','checkbox','ambient','Subtle synthesized background ambience (not an external soundtrack)');
 row('Ambient volume','range','ambientVolume');
 panel.append(create('h3','Gameplay automation'));
 row('Auto-resolve my triggered abilities','checkbox','autoResolve',
   'Passes priority only for trigger-only stacks on your turn, after Forge validates the live input.');
 const caution=create('p',
   'Off by default. When enabled, Sol Pod can pass your priority for consecutive triggered abilities. '+
   'It stops for spells, activated abilities, combat, targets, mana, ordering, blockers, '+
   'other required choices, your opponent’s turn, or any unexpected engine response. '+
   'You may lose an opportunity to respond to your own triggers while this is enabled.');
 panel.append(caution);
 const foot=create('div');foot.className='sol-pref-foot';
 const test=create('button','▶ Test effect');test.type='button';
 test.addEventListener('click',()=>{void ensureAudio(true);playCue('tap',true);});
 const closeButton=create('button','Done · Return to game');closeButton.type='button';
 closeButton.dataset.primary='true';closeButton.onclick=()=>close();
 foot.append(test,closeButton);panel.append(foot);overlay.append(panel);document.body.append(overlay);
 const autoStatus=create('button','AUTO · ON');autoStatus.type='button';
 autoStatus.id='sol-pod-auto-status';autoStatus.dataset.active='false';
 autoStatus.setAttribute('aria-label','Disable automatic trigger resolution');
 autoStatus.onclick=()=>{prefs.autoResolve=false;save();resetBatch();render();
   window.solPodNotice?.('Auto-resolve disabled. Priority is yours.','info','auto-stop');};
 document.body.append(autoStatus);
 function open(){
   if(window.app?.nativeMatch!==true)return;
   // Closing the legacy menu removes its modal backdrop before we open ours.
   if(window.app?.modal==='gameMenu')window.CommandTableAction?.('closeModal','');
   overlay.dataset.open='true';render();resetBatch();closeButton.focus?.();
 }
 function close(){
   overlay.dataset.open='false';render();
   document.querySelector('.ct10-top-tools [data-action="menuGame"]')?.focus?.();
 }
 overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
 document.addEventListener('keydown',e=>{
   if(overlay.dataset.open==='true'&&e.key==='Escape'){
     e.preventDefault();e.stopImmediatePropagation();close();
   }
 },true);
 function attachMenu(){
   const menu=window.app?.modal==='gameMenu'?
     document.querySelector('.modal[role="dialog"]'):null;
   if(!menu||menu.querySelector('#sol-pod-settings-open'))return;
   const b=create('button','♫ Audio & Auto-resolve settings');
   b.id='sol-pod-settings-open';b.type='button';b.className='secondary full';
   b.addEventListener('click',open);
   const existing=menu.querySelector('[data-action="viewHistory"]');
   if(existing)existing.insertAdjacentElement('beforebegin',b);
   else menu.append(b);
 }
 // Audio nodes are created only in response to a gesture. No asset download
 // or repeated sound is played while a stack of 20+ abilities resolves.
 let context=null,ambience=[],lastCue=0,seen=null;
 async function ensureAudio(gesture){
   if(!prefs.sound||!gesture||context)return context;
   try{
     const Ctx=window.AudioContext||window.webkitAudioContext;
     if(!Ctx)return null;
     context=new Ctx();
     await context.resume();
     syncAmbient(false);
   }catch(_){context=null;}
   return context;
 }
 function stopAmbience(){
   for(const item of ambience){
     try{item.osc.stop();item.osc.disconnect();item.gain.disconnect();}catch(_){}
   }
   ambience=[];
 }
 function syncAmbient(fromGesture){
   if(fromGesture)void ensureAudio(true);
   if(!context)return;
   const enabled=prefs.sound&&prefs.ambient&&window.app?.nativeMatch&&
     window.app?.view==='game'&&document.visibilityState!=='hidden';
   if(!enabled){stopAmbience();return;}
   if(!ambience.length){
     // Quiet original ambient drone. No copyrighted track or samples.
     for(const [hz,level] of [[110,0.35],[164.81,0.16]]){
       const osc=context.createOscillator(),gain=context.createGain();
       osc.type='sine';osc.frequency.value=hz;
       gain.gain.value=0;osc.connect(gain);gain.connect(context.destination);
       osc.start();ambience.push({osc,gain,level});
     }
   }
   for(const note of ambience){
     note.gain.gain.setTargetAtTime(note.level*prefs.ambientVolume*0.20,
       context.currentTime,0.15);
   }
 }
 function playCue(kind,force=false){
   if(!prefs.sound||(!prefs.effects&&!force)||!context ||
      context.state!=='running')return;
   const now=Date.now();
   if(!force&&now-lastCue<700)return;
   lastCue=now;
   const scale=Math.min(1,Math.max(0,prefs.effectsVolume));
   if(scale<0.01)return;
   try{
     const osc=context.createOscillator(),gain=context.createGain();
     const t=context.currentTime;
     const pitch=kind==='turn'?523:kind==='damage'?185:kind==='stack'?392:440;
     osc.type='sine';osc.frequency.setValueAtTime(pitch,t);
     osc.frequency.exponentialRampToValueAtTime(pitch*0.83,t+0.15);
     gain.gain.setValueAtTime(0.0001,t);
     gain.gain.exponentialRampToValueAtTime(Math.max(.0001,scale*.12),t+.018);
     gain.gain.exponentialRampToValueAtTime(.0001,t+.2);
     osc.connect(gain);gain.connect(context.destination);
     osc.start(t);osc.stop(t+.23);
     osc.onended=()=>{try{osc.disconnect();gain.disconnect();}catch(_){}};
   }catch(_){}
 }
 document.addEventListener('pointerdown',()=>{
   if(prefs.sound&&!context)void ensureAudio(true);
 },{capture:true});
 document.addEventListener('visibilitychange',()=>syncAmbient(false));
 function listenState(raw){
   if(!raw||!Array.isArray(raw.players))return;
   const player=raw.players[0];
   const fresh={turn:Number(raw.turn||0),life:Number(player?.life||0),
     stack:(raw.stack||[]).length,gameOver:!!raw.gameOver};
   if(seen&&!fresh.gameOver&&window.app?.nativeMatch){
     if(seen.life!==fresh.life)playCue('damage');
     else if(fresh.turn!==seen.turn&&fresh.turn>0)playCue('turn');
     else if(fresh.stack>seen.stack)playCue('stack');
   }
   seen=fresh;
   scheduleAuto();
   if(fresh.gameOver)resetBatch();
 }
 let batch=false,busy=false,issued=0,lastFingerprint='',timer=null,pausedReason='';
 function resetBatch(){
   batch=false;issued=0;lastFingerprint='';pausedReason='';
   if(timer!==null){clearTimeout(timer);timer=null;}
   status();
 }
 function status(){
   autoStatus.dataset.active=String(prefs.autoResolve&&window.app?.nativeMatch&&
     window.app?.view==='game');
   autoStatus.textContent=prefs.autoResolve?
     ('AUTO · '+(pausedReason||'ON')):'AUTO · OFF';
   autoStatus.title='Tap to disable auto-resolve';
 }
 function stackFingerprint(g){
   return [g.turn,g.phaseDetail,g.humanInput,
     ...(g.stack||[]).map(e=>e.id)].join('|');
 }
 function safe(g){
   if(!prefs.autoResolve||busy||issued>=60)return 'Off';
   if(!window.app?.nativeMatch||window.app?.view!=='game'||
      g?.gameOver||g?.winner!=null||g?.active!==0)return 'Paused';
   if(overlay.dataset.open==='true'||window.app?.modal||
      window.ctForgeChoice?.hasPending||
      window.ctForgeRequiredAction?.required||
      window.ctForgeRequiredAction?.visible||
      window.ctFullscreenTargets?.visible||
      window.ctForgeSafety?.needsRecovery||
      window.ctForgePriority?.isManaPayment||
      window.ctForgePriority?.isHandChoice||
      window.ctDirectCombat?.pending||
      document.querySelector('#sol-pod-stack-reader[data-open="true"]')||
      document.querySelector('#sol-hand-grid[data-open="true"]'))return 'Choice';
   const phase=String(g.phaseDetail||'');
   if(/^COMBAT_|MULLIGAN/i.test(phase)||g.blockInputActive)return 'Combat';
   if(!Array.isArray(g.stack)||!g.stack.length){batch=false;issued=0;lastFingerprint='';return 'Empty';}
   if(g.stack.some(item=>item.trigger!==true ||
     Number(item.controllerId)!==Number(g.players?.[0]?.forgeId))){
      batch=false;return 'Spell';
   }
   if(g.stack.length>=2)batch=true;
   if(!batch)return 'Manual';
   if(g.humanInput!=='InputPassPriority'||!g.players?.[0]?.priority)return 'Priority';
   const buttons=window.ctForgePriority?.buttonInfo||{};
   if(buttons.busy||!buttons.enable1||
      !/^(OK|Continue|Done|Pass)$/i.test(String(buttons.label1||'')))return 'Priority';
   if(stackFingerprint(g)===lastFingerprint)return 'Syncing';
   return '';
 }
 function scheduleAuto(){
   if(timer!==null)clearTimeout(timer);
   timer=setTimeout(()=>{timer=null;void maybeAuto();},550);
 }
 async function maybeAuto(){
   const g=window.app?.game;
   const reason=safe(g);
   pausedReason=reason||'Running';status();
   if(reason)return;
   const fingerprint=stackFingerprint(g);
   busy=true;status();
   try{
     // A second read protects against delayed GameView / InputQueue handoff.
     const response=await window.CommandTableNative.request('game.snapshot');
     const raw=response?.game;
     const human=raw?.players?.[0];
     if(!raw||raw.humanInput!=='InputPassPriority' ||
       raw.activePlayer!==human?.id ||
       String(raw.phase||'').startsWith('COMBAT_') ||
       !Array.isArray(raw.stack)||!raw.stack.length ||
       raw.stack.some(e=>e.trigger!==true||e.controllerId!==human?.id) ||
       safe(g)!=='')return;
     lastFingerprint=fingerprint;
     // Dedicated native command verifies live InputPassPriority + trigger-only
     // stack atomically on the Forge UI thread. Generic resolve is forbidden.
     await window.CommandTableNative.request('game.command',{
       action:'passAutoTriggerPriority',value:null
     });
     issued++;
   }catch(error){
     // Any rejection disables automation for this session and leaves the
     // player with real Forge priority / retry controls.
     prefs.autoResolve=false;save();resetBatch();
     window.solPodNotice?.('Auto-resolve stopped: '+String(error?.message||error),
       'error','auto-rejection');
   }finally{busy=false;status();}
 }
 function render(){
   attachMenu();
   for(const k of Object.keys(controls)){
     controls[k][controls[k].type==='checkbox'?'checked':'value']=
       controls[k].type==='checkbox'?!!prefs[k]:String(Math.round(prefs[k]*100));
     controls[k].disabled=(k!=='sound'&&!prefs.sound&&k!=='autoResolve');
   }
   status();syncAmbient(false);
 }
 let pending=false;
 const root=document.getElementById('app');
 if(root)new MutationObserver(()=>{
   if(pending)return;
   pending=true;requestAnimationFrame(()=>{pending=false;render();scheduleAuto();});
 }).observe(root,{childList:true,subtree:false});
 window.CommandTableNative?.onState?.(listenState);
 window.addEventListener('ct-forge-prompt-updated',scheduleAuto);
 window.addEventListener('ct-forge-selection',scheduleAuto);
 render();
 window.solPodPreferences={open,close,get settings(){return {...prefs};},
   setAutoResolve(value){prefs.autoResolve=!!value;save();resetBatch();scheduleAuto();render();},
   stop:()=>{prefs.autoResolve=false;save();resetBatch();render();}};
})();