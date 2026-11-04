/* v0.24: landscape battlefield and match boot screen. UI only; Forge owns rules. */
(() => {
 'use strict';
 const css=document.createElement('style');
 css.id='ct-landscape-game-v024';
 css.textContent=[
 '#ct-match-loading{position:fixed;inset:0;z-index:300050;display:grid;place-items:center;background:radial-gradient(ellipse at 50% 35%,#18454a,#091b25 56%,#030b11);color:#f2e4cb;font-family:system-ui;text-align:center}',
 '#ct-match-loading[hidden]{display:none!important}',
 '.ct-loading-content{display:flex;flex-direction:column;align-items:center;gap:13px;padding:16px;max-width:94vw}',
 '.ct-loading-deck{width:90px;height:126px;border:3px solid #c7a56f;border-radius:9px;background:radial-gradient(circle at center,#c99754 0 8%,#1c5160 9% 14%,#101c29 15% 40%,#b18c51 41% 43%,#122b37 44%);box-shadow:0 0 0 5px #112730,0 0 0 7px #c5a77980,0 17px 36px #000b;position:relative;animation:ct-loading-float 1.7s ease-in-out infinite}',
 '.ct-loading-deck:before{content:"✦";position:absolute;inset:0;display:grid;place-items:center;font-size:41px;color:#f3d49b;text-shadow:0 0 25px #edbc6e}',
 '.ct-loading-deck:after{content:"";position:absolute;inset:9px;border:1px solid #b7d6cc7a;border-radius:5px}',
 '.ct-loading-title{font:600 clamp(22px,3vw,34px) Georgia,serif;letter-spacing:.5px}',
 '.ct-loading-message{font-size:13px;color:#bbd0cd}',
 '.ct-loading-track{width:200px;height:4px;background:#39545d;border-radius:5px;overflow:hidden}',
 '.ct-loading-track:after{content:"";display:block;width:38%;height:100%;background:#eac080;border-radius:5px;animation:ct-loading-sweep 1.1s ease-in-out infinite alternate}',
 '@keyframes ct-loading-float{50%{transform:translateY(-8px) rotate(3deg)}}',
 '@keyframes ct-loading-sweep{from{transform:translateX(-80%)}to{transform:translateX(260%)}}',
 '@media(prefers-reduced-motion:reduce){.ct-loading-deck,.ct-loading-track:after{animation:none}}',
 '.ct10-stage .ct10-lane .game-card{width:clamp(60px,7.4vw,113px)!important;height:clamp(77px,19.5dvh,147px)!important;max-height:98%!important;flex:0 0 auto!important}',
 '.ct10-stage .ct10-lane.ct10-support .game-card{width:clamp(53px,6.3vw,98px)!important;height:clamp(70px,17dvh,128px)!important}',
 '.ct10-opp-creatures,.ct10-own-creatures{height:20%!important;left:30%!important;width:58%!important}',
 '.ct10-stage .ct10-lane .gc-nameplate strong{font-size:clamp(9px,.9vw,12px)!important}',
 '.ct10-their-turn .ct10-scene:before{content:""!important;position:absolute;left:0;right:0;top:0;height:48%;background:linear-gradient(180deg,#3d9ad025,#257eb31d 68%,transparent);border-bottom:2px solid #80caff99;box-shadow:inset 0 8px 28px #67bfff28;pointer-events:none;z-index:0}',
 '.ct10-their-turn .ct10-focused-opponent .ct10-opponent-badge{border-color:#a1dfff!important;box-shadow:0 0 28px #4dc3ff8f!important}',
 '.ct10-their-turn .ct10-opp-creatures .game-card,.ct10-their-turn .ct10-opp-lands .game-card{box-shadow:0 6px 18px #0009,0 0 9px #83cefa77!important}',
 '.ct10-our-turn .ct10-scene:before{content:""!important;position:absolute;inset:49% 0 0;background:linear-gradient(0deg,#d9ad5b1b,transparent 75%);border-top:2px solid #dcbb7855;pointer-events:none;z-index:0}',
 '@media(orientation:landscape){.modal-backdrop:has([data-action="quitGame"]){align-items:center!important;padding:8px 15px!important}.modal-backdrop:has([data-action="quitGame"]) .modal{display:grid;grid-template-columns:1fr 1fr;gap:7px 12px;width:min(690px,86vw);max-height:calc(100dvh - 16px);padding:14px 20px;overflow-y:auto!important}.modal-backdrop:has([data-action="quitGame"]) .modal h2,.modal-backdrop:has([data-action="quitGame"]) .modal p{grid-column:1/-1;margin:0 0 2px}.modal-backdrop:has([data-action="quitGame"]) .modal h2{font-size:20px}.modal-backdrop:has([data-action="quitGame"]) .modal button.full{min-height:38px;width:100%;padding:6px 9px;margin:0;font-size:12px}.modal-backdrop:has([data-action="quitGame"]) .modal .close-modal{position:absolute;top:7px;right:7px}.modal-backdrop:has([data-action="quitGame"]) .modal button[data-action="quitGame"]{grid-column:1/-1}}',
 '@media(orientation:landscape) and (max-height:430px){.ct10-stage .ct10-lane .game-card{width:clamp(51px,6.5vw,88px)!important;height:clamp(59px,18dvh,80px)!important}.ct10-stage .ct10-lane.ct10-support .game-card{width:clamp(48px,5.6vw,76px)!important;height:clamp(53px,15dvh,69px)!important}.modal-backdrop:has([data-action="quitGame"]) .modal{padding:9px 14px;gap:4px 8px}}'
 ].join('');
 document.head.append(css);
 const screen=document.createElement('section');
 screen.id='ct-match-loading';
 screen.hidden=true;
 screen.setAttribute('role','status');
 screen.setAttribute('aria-live','polite');
 screen.innerHTML='<div class="ct-loading-content"><div class="ct-loading-deck" aria-hidden="true"></div>'+
  '<div class="ct-loading-title">Sol Pod · Preparing the battlefield</div>'+
  '<div class="ct-loading-message">Shuffling decks and loading card artwork…</div>'+
  '<div class="ct-loading-track" aria-hidden="true"></div>'+
  '<div class="ct-loading-recovery" hidden style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">'+
  '<button type="button" id="ct-loading-retry" style="padding:9px 14px;border:1px solid #d3b47b;background:#213d4b;color:#f9e2ae;border-radius:9px">Refresh Sol Pod</button>'+
  '<button type="button" id="ct-loading-exit" style="padding:9px 14px;border:1px solid #9babb0;background:#25333f;color:white;border-radius:9px">Back to decks</button></div></div>';
 document.body.append(screen);
 let active=false,token=0,startTime=0,checkingToken=-1,openingWait=false;
 const message=screen.querySelector('.ct-loading-message');
 const recovery=screen.querySelector('.ct-loading-recovery');
 screen.querySelector('#ct-loading-retry').onclick=async()=>{
   message.textContent='Checking Sol Pod and restoring any pending opening decision…';
   try{
     await window.CommandTableNative?.request?.('engine.status');
     const result=await window.CommandTableNative?.request?.('game.snapshot');
     if(result?.game)window.ctReceiveForgeState?.(result.game);
   }catch(error){message.textContent='Sol Pod did not respond: '+(error?.message||String(error));}
 };
 screen.querySelector('#ct-loading-exit').onclick=()=>{
   hide();
   if(typeof action==='function')action('quitGame');
 };
 function show(){
  token++;active=true;startTime=Date.now();checkingToken=-1;openingWait=false;
  message.textContent='Shuffling decks and loading card artwork…';
  recovery.hidden=true;recovery.style.display='none';
  screen.hidden=false;
  try{window.AndroidBridge?.setOrientation?.('landscape');}catch(_){}
 }
 function hide(){active=false;openingWait=false;token++;checkingToken=-1;screen.hidden=true;}
 // A mulligan/starting-player handoff with NO valid player buttons is a
 // loading state, not an "Opening decision" with an empty footer.
 function waitForOpening(){
   if(window.app?.view!=='game'||window.app?.game?.phase!=='mulligan')return;
   if(!active)show();
   openingWait=true;
   message.textContent='Preparing your next Sol Pod decision…';
   ready();
 }
 function ready(){
  if(!active)return;
  const current=token;
  if(checkingToken===current)return;
  checkingToken=current;
  function check(){
   if(!active||current!==token)return;
   if(typeof app==='undefined'||app.view!=='game'){checkingToken=-1;return;}
   const game=app.game;
   const hand=game?.players?.[0]?.hand||[];
   const opening=game?.phase==='mulligan'||game?.turn===0;
   // A dealt opening hand does not prove that Forge's next buttons
   // have been published. Wait for a real actionable decision.
   const requiresInput=!!window.ctForgePriority?.hasActionableDecision ||
     window.ctForgeChoice?.hasPending===true ||
     window.ctForgeRequiredAction?.required===true;
   if(requiresInput||(!opening&&game?.native&&game?.players?.length)){
     hide();return;
   }
   const elapsed=Date.now()-startTime;
   if(elapsed>20000){recovery.hidden=false;recovery.style.display='flex';}
   message.textContent=openingWait?
     (elapsed>8000?'Sol Pod is still preparing your next choice…':
       'Preparing your next Sol Pod decision…'):
     (elapsed>8000?'Sol Pod is preparing your opening hand. The game will appear when ready…':
       'Shuffling decks and preparing your opening hand…');
   // No 3-second timeout: the real Forge game state controls readiness.
   setTimeout(check,180);
  }
  requestAnimationFrame(()=>setTimeout(check,100));
 }
 window.ctMatchLoading={show,ready,hide,waitForOpening,
    get active(){return active;},
    get awaitingOpening(){return openingWait;}};
})();