'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('forge-integration/web/forge-simple-cast.js','utf8');
function createHarness(reject=false){
  const events=new Map(),requests=[],status=[];
  function el(tag){
    return {
      tag,style:{},dataset:{},children:[],attrs:{},className:'',
      setAttribute(key,val){this.attrs[key]=val;},
      getAttribute(key){return this.attrs[key]??null;},
      append(...children){this.children.push(...children);},
      replaceChildren(...children){this.children=[...children];},
      focus(){},
      querySelector(){return null;},
      get textContent(){return this.text||'';},
      set textContent(v){this.text=v;}
    };
  }
  const doc={
    head:el('head'),body:el('body'),createElement:el,
    addEventListener(type,callback){
      if(!events.has(type))events.set(type,[]);
      events.get(type).push(callback);
    }
  };
  const app={nativeMatch:true,view:'game',modal:'',sideInspect:null,
    game:{phase:'main1',players:[{
      hand:['Arcane Signet','Arcane Signet'],
      handForgeIds:[41,42],
      commandZone:[{id:211,name:'Bruna, Light of Alabaster',commander:true,
        manaCost:'{3}{W}{W}{U}',type:'Legendary Creature — Angel',rulesText:'Flying and vigilance.'}]
    }]}};
  const win={app,
    ctForgeCards:{'arcane signet':{name:'Arcane Signet',type:'Artifact',
      cost:'{2}',text:'Tap: Add one mana of any color in your commander identity.'}},
    ctCardArtUrl:name=>'https://images.example.invalid/'+encodeURIComponent(name),
    ctNativeToast:text=>status.push(text),
    announce:text=>status.push(text),
    render:()=>{},
    ctReceiveForgeState:()=>{},
    CommandTableNative:{
      request:async(method,payload)=>{
        requests.push({method,payload});
        if(reject&&method==='game.command')throw new Error('No priority or mana available');
        return method==='game.snapshot'?{game:{players:[]}}:{};
      }
    }
  };
  vm.runInNewContext(source,{document:doc,window:win,console,setTimeout,clearTimeout},{timeout:1000});
  const overlay=()=>doc.body.children.find(x=>x.id==='ct-cast-preview');
  const find=(root,predicate)=>{
    if(predicate(root))return root;
    for(const c of root?.children||[]){const f=find(c,predicate);if(f)return f;}
    return null;
  };
  const buttons=()=>({
    cast:find(overlay(),x=>x.className==='ct-cast-go'),
    cancel:find(overlay(),x=>x.className==='ct-cast-cancel'),
    error:find(overlay(),x=>x.className==='ct-cast-error')
  });
  function tap(source){
    const target={closest:selector=>{
      if(selector.startsWith('.ct10-hand-slot'))return source==='hand'?hand:null;
      if(selector.startsWith('.ct-commander-zone-card'))return source==='commander'?commander:null;
      return null;
    }};
    const event={target,stopped:false,preventDefault(){this.stopped=true;},
      stopImmediatePropagation(){this.stopped=true;}};
    for(const fn of events.get('click')||[])fn(event);
    return event;
  }
  // v0.19 intentionally removes drag-to-cast attributes. A hand card must
  // still select its correct copy from the slot position in the DOM.
  const slot={parentElement:null};
  slot.parentElement={children:[{},slot]};
  const hand={getAttribute:key=>null,closest:selector=>
    selector.includes('.ct10-hand-slot')?slot:null};
  const commander={getAttribute:()=>null};
  return {tap,buttons,overlay,requests,status,win};
}
(async()=>{
  const h=createHarness();
  const event=h.tap('hand');
  assert(event.stopped,'Tapping hand must suppress legacy direct-cast click');
  assert.equal(h.overlay().dataset.open,'true','Centered card sheet must open');
  assert.equal(h.requests.length,0,'Tapping a card must NOT submit a cast');
  assert.equal(h.buttons().cast.textContent,'Cast');
  const rules=h.overlay().children[0].children[1].children.find(x=>x.className==='ct-cast-rules');
  assert.match(rules.textContent,/Add one mana/,'Full card rules must be available');
  await h.buttons().cast.onclick();
  assert.equal(h.overlay().dataset.open,'false');
  assert.deepEqual(JSON.parse(JSON.stringify(h.requests[0])),
    {method:'game.command',payload:{action:'castById',value:42}},
    'Duplicate card copies must cast by their exact Forge ID');
  assert.equal(h.requests[1].method,'game.snapshot');
  const mulligan=createHarness();
  mulligan.win.app.game.phase='mulligan';
  mulligan.win.ctForgePriority={isHandChoice:true,refresh:()=>{}};
  const tapped=mulligan.tap('hand');
  await Promise.resolve();
  assert(tapped.stopped,'Mulligan selection must suppress the preview');
  assert.equal(mulligan.overlay().dataset.open,'false');
  assert.deepEqual(JSON.parse(JSON.stringify(mulligan.requests[0])),
    {method:'game.command',payload:{action:'cardId',value:42}},
    'Mulligan card choice must use Forge selectCard, not castById');
  const discard=createHarness();
  discard.win.ctForgePriority={isHandChoice:true,refresh:()=>{}};
  const discardTap=discard.tap('hand');
  await Promise.resolve();
  assert(discardTap.stopped,'Discard selection must suppress casting');
  assert.equal(discard.overlay().dataset.open,'false',
    'Faithless Looting discard must not show Cast');
  assert.deepEqual(JSON.parse(JSON.stringify(discard.requests[0])),
    {method:'game.command',payload:{action:'cardId',value:42}},
    'Discard must select one exact Forge hand card instance');
  const cancelled=createHarness();
  cancelled.tap('hand');
  cancelled.buttons().cancel.onclick();
  assert.equal(cancelled.requests.length,0,'Cancel must not cast');
  const cmd=createHarness();
  cmd.tap('commander');
  assert.equal(cmd.buttons().cast.textContent,'Cast');
  await cmd.buttons().cast.onclick();
  assert.deepEqual(JSON.parse(JSON.stringify(cmd.requests[0].payload)),
    {action:'castById',value:211});
  const failure=createHarness(true);
  failure.tap('hand');
  await failure.buttons().cast.onclick();
  assert.equal(failure.overlay().dataset.open,'true',
    'A rejected cast must display an error and allow retry');
  assert.match(failure.buttons().error.textContent,/No priority or mana/);
  assert(source.indexOf("request=window.CommandTableNative.request('game.command'") <
       source.indexOf("try{window.render?.();}"),
    'A card must reach the Android bridge BEFORE any render that could throw');
  assert(source.includes('Forge is still processing') &&
       source.includes('Forge could not cast this card:'),
    'Slow or rejected Forge casts must never be silent');
  assert(source.includes("action:'castById',value:choice.id"),
    'Casting must use the exact Forge card instance');
  assert(source.includes('ctNativeToast'),
    'Cast acknowledgements should be visible to the player');
  assert(source.includes('Forge checks timing, mana, targets'));

  console.log('PASS: mulligan selection, cast preview, cancel, duplicate IDs, commander and errors');
})().catch(error=>{console.error(error);process.exitCode=1;});
