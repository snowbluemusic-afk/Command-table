'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('forge-integration/web/forge-gestures.js','utf8');

function buildHarness({phase,sourceId,targetKind,targetId,legal=true}) {
  const docEvents=new Map(),winEvents=new Map(),requests=[];
  const game={phaseDetail:phase,phase:'combat',winner:null,
    players:[{forgeId:1,battlefield:[{forgeId:sourceId,creature:legal}]},{forgeId:2}],combat:[{cardId:201,defenderId:1,blockerIds:[]}]};
  const card={
    getAttribute:n=>n==='data-value'?'0:'+sourceId:null,
    closest:selector=>selector.includes('ct10-lane-own.ct10-creatures')?card:null,
    classList:{add(){},remove(){}},contains(){return false;}
  };
  const enemy={
    getAttribute:n=>n==='data-ct-forge-player-id'?'2':null,
    closest:selector=>selector.includes('[data-ct-forge-player-id]')?enemy:null,
    classList:{add(){},remove(){}}
  };
  const attacker={
    getAttribute:n=>n==='data-value'?'1:201':null,
    closest:selector=>selector.includes('.ct10-lane-opp.ct10-creatures')?attacker:null,
    classList:{add(){},remove(){}}
  };
  let elementAt=targetKind==='player'?enemy:attacker;
  function elem(){
    return {style:{},attrs:{},classList:{add(){},remove(){}},
      setAttribute(n,v){this.attrs[n]=v;},
      getAttribute(n){return this.attrs[n]||null;},
      append(){},appendChild(){},replaceChildren(){},
      set textContent(v){this.text=String(v);},
      get textContent(){return this.text||'';}
    };
  }
  const doc={
    createElement:elem,createElementNS:elem,
    body:elem(),head:elem(),querySelectorAll:()=>[],getElementById:()=>null,
    elementFromPoint:()=>elementAt,
    addEventListener(type,fn){(docEvents.get(type)||docEvents.set(type,[]).get(type)).push(fn);}
  };
  const win={
    app:{nativeMatch:true,view:'game',game,modal:null,sideInspect:null},
    ctForgeSelection:{version:0,isLegalCard:id=>legal&&Number(id)===sourceId,
      isLegalPlayer:id=>Number(id)===2},
    addEventListener(type,fn){(winEvents.get(type)||winEvents.set(type,[]).get(type)).push(fn);},
    removeEventListener(type,fn){winEvents.set(type,(winEvents.get(type)||[]).filter(x=>x!==fn));},
    dispatch(type,detail){for(const fn of winEvents.get(type)||[])fn({detail});},
    ctReceiveForgeState(){},
    announce(){},
    CommandTableNative:{
      request:async(type,payload)=>{
        requests.push({type,payload});
        if(type==='game.snapshot')return {game:{}};
        // The batch combat command handles both choices inside Forge.
        return {};
      }
    }
  };
  const context={document:doc,window:win,innerWidth:800,innerHeight:500,
    setTimeout,clearTimeout,requestAnimationFrame:fn=>{fn();return 1;}};
  vm.runInNewContext(source,context,{timeout:1000});
  function emit(type,ev){
    for(const fn of docEvents.get(type)||[])fn(ev);
  }
  const event=(x,y)=>({pointerId:1,clientX:x,clientY:y,button:0,
    target:card,cancelable:true,preventDefault(){},stopImmediatePropagation(){}});
  return {emit,event,requests,win,card,enemy,attacker,setDrop:el=>{elementAt=el;}};
}
async function tick(){await new Promise(resolve=>setImmediate(resolve));}

(async()=>{
  {
    const h=buildHarness({phase:'COMBAT_DECLARE_ATTACKERS',sourceId:101,
      targetKind:'player',targetId:2});
    h.emit('pointerdown',h.event(180,310));
    h.emit('pointermove',h.event(210,190));
    h.emit('pointerup',h.event(210,190));
    await tick();
    assert.deepEqual(JSON.parse(JSON.stringify(h.requests.filter(x=>x.type==='game.command').map(x=>x.payload))),
      [{action:'combat.attack',value:{attackerId:101,defenderId:2}}]);
  }
  {
    const h=buildHarness({phase:'COMBAT_DECLARE_BLOCKERS',sourceId:103,
      targetKind:'card',targetId:201});
    h.emit('pointerdown',h.event(180,310));
    h.emit('pointermove',h.event(230,180));
    h.emit('pointerup',h.event(230,180));
    await tick();
    assert.deepEqual(JSON.parse(JSON.stringify(h.requests.filter(x=>x.type==='game.command').map(x=>x.payload))),
      [{action:'combat.block',value:{attackerId:201,blockerId:103}}]);
  }
  {
    const h=buildHarness({phase:'COMBAT_DECLARE_ATTACKERS',sourceId:101,
      targetKind:'player',targetId:2});
    h.emit('pointerdown',h.event(180,310));
    h.emit('pointerup',h.event(180,310));
    await tick();
    assert.equal(h.requests.length,0,'Tap must stay owned by ordinary card click handler');
  }
  {
    const h=buildHarness({phase:'COMBAT_DECLARE_ATTACKERS',sourceId:101,
      targetKind:'player',targetId:2,legal:false});
    h.emit('pointerdown',h.event(180,310));
    h.emit('pointermove',h.event(210,190));
    h.emit('pointerup',h.event(210,190));
    await tick();
    assert.equal(h.requests.length,0,'Never submit an illegal Forge source');
  }
  // Current blocker-first UX: tap YOUR eligible blocker, then the attacking
  // creature. This sends one atomic Forge combat.block assignment.
  {
    const h=buildHarness({phase:'COMBAT_DECLARE_BLOCKERS',sourceId:103,
      targetKind:'card',targetId:201});
    h.emit('click',{...h.event(180,310),target:h.card});
    await tick();
    assert.equal(h.requests.filter(x=>x.type==='game.command').length,0,
      'Choosing the blocker alone must not consume a Forge game action');
    h.emit('click',{...h.event(230,180),target:h.attacker});
    await tick();
    assert.deepEqual(JSON.parse(JSON.stringify(h.requests.filter(x=>x.type==='game.command').map(x=>x.payload))),
      [{action:'combat.block',value:{attackerId:201,blockerId:103}}]);
  }
  // Tap attackers individually: does not invoke Forge's Alpha Strike shortcut.
  {
    const h=buildHarness({phase:'COMBAT_DECLARE_ATTACKERS',sourceId:101,
      targetKind:'player',targetId:2});
    h.emit('click',h.event(180,310));
    await tick();
    assert.deepEqual(JSON.parse(JSON.stringify(h.requests.filter(x=>x.type==='game.command').map(x=>x.payload))),
      [{action:'cardId',value:101}]);
  }
  console.log('PASS: individual Forge attacks, multi-target block order, direct taps, non-creature guard');
})().catch(error=>{console.error(error);process.exitCode=1;});
