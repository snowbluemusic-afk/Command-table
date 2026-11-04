/* Sol Pod v0.51: attachment activation handoff.
 * The native card ability/cast must run first. Legal attachment targets come
 * from Forge selection only. Never infer legality from the card description.
 */
(() => {
 'use strict';
 let intent=null,busy=false;
 const current=()=>{
  if(!intent)return null;
  const game=window.app?.game;
  if(!window.app?.nativeMatch || !game || game.gameOver){intent=null;return null;}
  if(Number(game.turn||0)!==Number(intent.turn||0) &&
     !(window.ctForgeSelection?.legalTargets||[]).length){intent=null;return null;}
  return intent;
 };
 function begin(options){
  if(!options||!window.app?.nativeMatch)return;
  intent={sourceId:Number(options.sourceId)||null,
   name:String(options.name||'Attachment'),
   kind:options.kind==='aura'?'aura':'equipment',
   turn:Number(window.app?.game?.turn||0)};
 }
 function finish(){intent=null;}
 function closeCardInspect(){
  const app=window.app;
  if(!app)return;
  if(app.modal==='inspect')app.modal='';
  app.sideInspect=null;
  app.inspectForgeId=null;
  app.inspectOwner=null;
  try{window.render?.();}catch(_){}
 }
 document.addEventListener('click',event=>{
  if(!window.app?.nativeMatch||window.app?.view!=='game'||busy)return;
  // Both the compact inspection panel and the large Full details modal
  // expose an Activate control. The large modal uses a different wrapper;
  // intercept BOTH to avoid losing the target prompt behind that modal.
  const element=event.target.closest?.(
   '.ct-native-permanent-action [data-action="cardId"],'+
   '.ct-native-activated-action [data-action="cardId"]'
  );
  if(!element)return;
  const id=Number(element.getAttribute('data-value'));
  const card=window.app?.game?.players?.[0]?.battlefield?.find(
    c=>Number(c.forgeId)===id);
  if(!card||!Number.isInteger(id)||id<=0)return;
  // The old inspector stayed modal-open when the native cardId was selected,
  // suppressing the full-screen legal target picker. Treat this action as a
  // handoff to the engine and close ONLY the inspection UI.
  event.preventDefault();event.stopImmediatePropagation();
  if(/\bEquipment\b/i.test(String(card.type||''))){
   begin({sourceId:id,name:card.name,kind:'equipment'});
  }else finish();
  busy=true;
  closeCardInspect();
  (async()=>{
   try{
    await window.CommandTableNative.request('game.command',{
     action:'cardId',value:id
    });
    const snap=await window.CommandTableNative.request('game.snapshot').catch(()=>null);
    if(snap?.game)window.ctReceiveForgeState?.(snap.game);
    window.ctFullscreenTargets?.refresh?.();
    window.ctForgeRequiredAction?.refresh?.();
   }catch(error){
    finish();
    window.ctForgeSafety?.showError?.(error,'Unable to activate this card in Sol Pod');
   }finally{busy=false;}
  })();
 },true);
 window.ctAttachmentFlow={
  begin,finish,current,
  get busy(){return busy;}
 };
})();
