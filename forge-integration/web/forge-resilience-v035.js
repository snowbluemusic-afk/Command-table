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
 style.textContent='#ct-forge-safety{box-sizing:border-box;border:2px solid #e2a878;'+
   'background:#102733f9;color:#fff0d8;border-radius:12px;padding:11px;'+
   'font:12px/1.45 system-ui;display:flex;flex-direction:column;gap:8px;'+
   'width:100%;box-shadow:0 12px 25px #0008;max-height:29dvh;overflow-y:auto}'+
   '#ct-forge-safety button{min-height:34px;padding:5px 9px;border:1px solid #d5b782;'+
   'background:#294959;color:#fff0d8;border-radius:8px;font-weight:750;'+
   'font-size:12px;cursor:pointer}'+
   '#ct-forge-safety .ct-safety-buttons{display:flex;flex-wrap:wrap;gap:6px}'+
   '#ct-forge-safety .ct-safety-heading{font-weight:850;color:#ffe0a2}'+
   '#ct-forge-safety.ct-safety-floating{position:fixed;right:10px;'+
   'top:25%;width:min(24vw,310px);z-index:21010}';
 document.head.append(style);
 function mountPanel(){
   if(!retryPanel){
     retryPanel=document.createElement('section');
     retryPanel.id='ct-forge-safety';
     retryPanel.setAttribute('role','alert');
   }
   const rail=document.getElementById('sol-pod-hub-content');
   if(rail){
     retryPanel.classList.remove('ct-safety-floating');
     if(retryPanel.parentNode!==rail)rail.prepend(retryPanel);
   }else{
     retryPanel.classList.add('ct-safety-floating');
     if(retryPanel.parentNode!==document.body)document.body.append(retryPanel);
   }
 }
 function clearPanel(){
   retryPanel?.remove();
   retryPanel=null;
 }
 function renderPanel(message){
   mountPanel();
   retryPanel.replaceChildren();
   const header=document.createElement('strong');
   header.className='ct-safety-heading';
   header.textContent='Forge interaction needs attention';
   const body=document.createElement('div');
   body.textContent=message;
   const controls=document.createElement('div');
   controls.className='ct-safety-buttons';
   const action=(label,fn)=>{
     const button=document.createElement('button');
     button.type='button';button.textContent=label;button.onclick=fn;
     controls.append(button);return button;
   };
   action('↻ Refresh game',()=>{void recover();});
   action('Cancel pending choice',()=>{void cancelAndRecover();});
   action('Dismiss',clearPanel);
   retryPanel.append(header,body,controls);
 }
 function showError(error,prefix){
   const message=(prefix?prefix+': ':'')+text(error);
   if(isGame()){
     window.solPodNotice?.(message,'error','forge-safety-'+Date.now());
     renderPanel(message);
   }else{
     window.ctNativeToast?.(message);
   }
 }
 async function recover(){
   if(!isGame()){clearPanel();return true;}
   try{
     await nativeRequest('engine.status');
     const response=await nativeRequest('game.snapshot');
     if(!response?.game)throw new Error('Forge has not returned an authoritative game state');
     window.ctReceiveForgeState?.(response.game);
     window.ctForgePriority?.refresh?.();
     window.ctForgeSelection?.refresh?.();
     unknownResult=false;
     clearPanel();
     window.solPodNotice?.('Forge game state refreshed. Review the stack, mana and current choice before continuing.','info','forge-recovered');
     return true;
   }catch(error){
     renderPanel('Refresh failed: '+text(error)+'. You can retry or cancel the pending choice.');
     return false;
   }
 }
 async function cancelAndRecover(){
   try{
     await nativeRequest('game.command',{action:'cancelCastTarget',value:null});
   }catch(error){
     renderPanel('Forge could not cancel the current choice: '+text(error)+'. Try Refresh game.');
     return false;
   }
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
   get needsRecovery(){return unknownResult;},
   get castBusy(){return castInFlight;},
   showError,clearPanel
 };
})();