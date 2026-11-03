/* Sol Pod v0.35 — Forge interaction safety, not a substitute for Forge rules.
 * Handles failed, timed-out and rejected commands across casting, mana,
 * targeting, abilities and stack interactions. Never retries a mutating
 * request blindly: a timed-out command may still be executing in Forge.
 */
(()=>{
 'use strict';
 if(typeof CommandTableNative==='undefined'||!CommandTableNative?.request)return;
 const nativeRequest=CommandTableNative.request.bind(CommandTableNative);
 let unknownResult=false;
 let castInFlight=false;
 let retryPanel=null;
 let recoveryBusy=false;
 let lastFailure='';
 let nativeChoiceWaiting=false;
 const hasRequiredChoice=()=>!!window.ctForgeChoice?.hasPending || nativeChoiceWaiting;
 const text=value=>String(value?.message||value||'Forge did not respond');
 const isCasting=payload=>payload?.action==='castById'||
   payload?.action==='castCommander'||payload?.action==='castSelected';
 const isGame=()=>!!window.app?.nativeMatch&&window.app?.view==='game';
 const currentPlayer=()=>window.app?.game?.players?.[0];
 function checkCast(card){
   if(!isGame())return {ok:false,reason:'Start a Forge match to play this card.'};
   if(unknownResult)return {ok:false,reason:'The previous Forge action is not confirmed. Refresh the game before another cast.'};
   if(castInFlight)return {ok:false,reason:'Forge is already processing a cast. Finish or cancel that interaction first.'};
   const game=window.app?.game,me=currentPlayer();
   if(!me||!game)return {ok:false,reason:'The current game state is unavailable. Refresh Forge.'};
   if(game.winner!=null)return {ok:false,reason:'The match has ended.'};
   if(game.phase==='mulligan')return {ok:false,reason:'Complete your opening-hand decision before casting.'};
   if(window.ctForgeChoice?.hasPending)return {ok:false,reason:'Finish the required Forge choice before casting another card.'};
   if(window.ctForgePriority?.isHandChoice)return {ok:false,reason:'Finish the discard or hand selection first.'};
   if(window.ctForgePriority?.isManaPayment)return {ok:false,reason:'Complete or cancel the current mana payment first.'};
   if(window.ctDirectCombat?.pending>0)return {ok:false,reason:'Finish pending combat assignments first.'};
   if(!me.priority)return {ok:false,reason:'You do not currently have priority to cast spells.'};
   if(card?.id!=null){
     const id=Number(card.id);
     const inHand=(me.handForgeIds||[]).some(v=>Number(v)===id);
     const inCommand=(me.commandZone||[]).some(v=>Number(v.id)===id);
     if(!inHand&&!inCommand)return {ok:false,reason:'That exact card is no longer in your hand or command zone.'};
   }
   // Spell legality, alternative costs, taxes and ability mana are NOT
   // guessed here. Forge remains the only source of truth.
   return {ok:true};
 }
 const style=document.createElement('style');
 style.id='ct-forge-safety-style';
 // Required recovery must never be mounted into the collapsed Game Log.
 // Keep the popup above cast preview (z=2147483200) and below Forge's
 // mandatory choice only after explicitly handing control back to that choice.
 style.textContent=[
   '#ct-forge-safety{position:fixed;inset:0;z-index:2147483600;',
   'box-sizing:border-box;background:#020814ed;backdrop-filter:blur(6px);',
   'display:flex;align-items:center;justify-content:center;',
   'padding:clamp(8px,2dvh,22px);font:14px/1.5 system-ui;color:#fff0d8}',
   '#ct-forge-safety .ct-safety-dialog{width:min(92vw,730px);',
   'max-height:94dvh;overflow:auto;box-sizing:border-box;',
   'border:2px solid #e2a878;border-radius:18px;',
   'background:linear-gradient(135deg,#18353e,#091922);',
   'box-shadow:0 22px 80px #000d;padding:clamp(13px,4dvh,28px);',
   'display:flex;flex-direction:column;gap:12px}',
   '#ct-forge-safety .ct-safety-heading{font:bold clamp(22px,4vw,32px) Georgia,serif;',
   'color:#ffe0a2}',
   '#ct-forge-safety .ct-safety-details{white-space:pre-wrap;color:#e3e9e7;',
   'overflow-wrap:anywhere;max-height:31dvh;overflow:auto}',
   '#ct-forge-safety .ct-safety-buttons{display:flex;flex-wrap:wrap;gap:10px}',
   '#ct-forge-safety button{min-height:44px;padding:10px 16px;',
   'border:1px solid #d5b782;border-radius:10px;cursor:pointer;',
   'background:#294959;color:#fff0d8;font:bold 14px system-ui;flex:1}',
   '#ct-forge-safety button:first-child{background:#e4bc78;color:#112633}',
   '#ct-forge-safety button:disabled{opacity:.6;cursor:wait}',
   '@media(orientation:landscape) and (max-height:450px){',
   '#ct-forge-safety .ct-safety-dialog{padding:12px;gap:7px}',
   '#ct-forge-safety .ct-safety-heading{font-size:22px}',
   '#ct-forge-safety .ct-safety-details{max-height:19dvh}',
   '#ct-forge-safety button{min-height:36px;padding:7px 10px}}'
 ].join('');
 document.head.append(style);
 function mountPanel(){
   if(!retryPanel){
     retryPanel=document.createElement('section');
     retryPanel.id='ct-forge-safety';
     retryPanel.setAttribute('role','dialog');
     retryPanel.setAttribute('aria-modal','true');
     retryPanel.setAttribute('aria-label','Forge gameplay recovery requires your action');
   }
   // The Game Log has display:none when collapsed. Never attach interactive
   // recovery controls there or inside a clipped HUD/stack container.
   if(retryPanel.parentNode!==document.body)document.body.append(retryPanel);
   // A stale cast preview must not reappear above/below recovery.
   window.ctSimpleCast?.hide?.();
 }
 function clearPanel(){
   retryPanel?.remove();
   retryPanel=null;
   recoveryBusy=false;
 }
 function renderPanel(message){
   lastFailure=message;
   mountPanel();
   retryPanel.replaceChildren();
   const dialog=document.createElement('div');
   dialog.className='ct-safety-dialog';
   const header=document.createElement('strong');
   header.className='ct-safety-heading';
   header.textContent='Forge needs your attention';
   const body=document.createElement('div');
   body.className='ct-safety-details';
   body.textContent=message;
   const hint=document.createElement('div');
   hint.textContent=hasRequiredChoice()
     ? 'A Forge choice is waiting. Open it to continue the game.'
     : 'Refresh checks Forge without replaying a spell. Cancel requests cancellation of the current action; it does not automatically cast again.';
   const controls=document.createElement('div');
   controls.className='ct-safety-buttons';
   const action=(label,fn)=>{
     const button=document.createElement('button');
     button.type='button';button.textContent=label;
     button.onclick=()=>{if(!recoveryBusy)void fn();};
     button.disabled=recoveryBusy;
     controls.append(button);return button;
   };
   action('↻ Refresh Forge status',recover);
   if(hasRequiredChoice()){
     action('Open required Forge choice',async()=>{
       // Replay only the current decision; never answer it automatically.
       try{await nativeRequest('engine.status');}catch(_){}
       clearPanel();
     });
   }else{
     action('Cancel pending action',cancelAndRecover);
   }
   action('Review battlefield',async()=>{clearPanel();});
   dialog.append(header,body,hint,controls);
   retryPanel.append(dialog);
 }
 function showError(error,prefix){
   const message=(prefix?prefix+': ':'')+text(error);
   if(isGame()){
     // Actionable recovery is never just a passive Game Log entry.
     renderPanel(message);
   }else{
     window.ctNativeToast?.(message);
   }
 }
 async function recover(){
   if(!isGame()){clearPanel();return true;}
   if(recoveryBusy)return false;
   recoveryBusy=true;
   renderPanel('Checking the live Forge game. No card is being cast again…');
   try{
     const status=await nativeRequest('engine.status');
     nativeChoiceWaiting=!!status?.choicePending;
     const response=await nativeRequest('game.snapshot');
     if(!response?.game)throw new Error('Forge has not returned an authoritative game state');
     window.ctReceiveForgeState?.(response.game);
     window.ctForgePriority?.refresh?.();
     window.ctForgeSelection?.refresh?.();
     if(hasRequiredChoice()){
       recoveryBusy=false;
       renderPanel('Forge is waiting for a required choice. Open that choice to continue.');
       return false;
     }
     if(status?.castInProgress){
       recoveryBusy=false;
       renderPanel('Forge still has the previous cast in progress. Do not press Cast again. You can request cancellation or review the battlefield.');
       return false;
     }
     // The native command has stopped processing and the authoritative
     // snapshot was retrieved. Never blindly replay a timed-out cast.
     unknownResult=false;
     clearPanel();
     window.solPodNotice?.('Forge status refreshed. Review the stack and card zone before trying another action.','info','forge-recovered');
     return true;
   }catch(error){
     recoveryBusy=false;
     renderPanel('Unable to refresh Forge: '+text(error)+'. No spell has been submitted again.');
     return false;
   }
 }
 async function cancelAndRecover(){
   if(!isGame()){clearPanel();return false;}
   if(recoveryBusy)return false;
   if(hasRequiredChoice()){
     renderPanel('Forge is waiting for a required decision. Open that choice; cancellation may not be legal.');
     return false;
   }
   recoveryBusy=true;
   renderPanel('Requesting cancellation from Forge. Checking the result…');
   try{
     await nativeRequest('game.command',{action:'cancelCastTarget',value:null});
   }catch(error){
     recoveryBusy=false;
     renderPanel('Forge did not confirm cancellation: '+text(error)+'. Refresh before trying to cast again.');
     return false;
   }
   recoveryBusy=false;
   return recover();
 }
 CommandTableNative.request=function(type,payload={}){
   if(type==='game.command'&&isCasting(payload)){
     const status=checkCast({id:payload.value});
     if(!status.ok){
       const error=new Error(status.reason);
       error.code='FORGE_PREFLIGHT';
       showError(error,'Action unavailable');
       return Promise.reject(error);
     }
     castInFlight=true;
   }
   const cast=type==='game.command'&&isCasting(payload);
   let submitted;
   try{ submitted=nativeRequest(type,payload); }
   catch(error){if(cast)castInFlight=false;return Promise.reject(error);}
   return Promise.resolve(submitted).catch(error=>{
     if(type==='game.command'){
       // A response timeout tells us nothing about whether Forge committed
       // the operation. Require a snapshot before another cast attempt.
       if(error?.code==='FORGE_TIMEOUT')unknownResult=true;
       showError(error,error?.code==='FORGE_TIMEOUT'?
         'Forge response timed out — do not repeat the action yet':'Forge rejected the action');
     }
     throw error;
   }).finally(()=>{if(cast)castInFlight=false;});
 };
 window.ctForgeSafety={
   checkCast,recover,cancelAndRecover,
   get recoveryVisible(){return !!retryPanel;},
   get needsRecovery(){return unknownResult;},
   get castBusy(){return castInFlight;},
   showError,clearPanel
 };
})();