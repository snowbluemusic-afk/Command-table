'use strict';
// Sol Pod v0.42 — Commander rule 903.8/903.9 bridge and modal contracts.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const load=path=>fs.readFileSync(path,'utf8');
const choice=load('forge-integration/web/forge-choice.js');
const cast=load('forge-integration/web/forge-simple-cast.js');
const dispatcher=load('forge-integration/src/main/java/forge/commandtable/CommandTableChoiceDispatcher.java');
const projection=load('forge-integration/src/main/java/forge/commandtable/CommandTableGameProjection.java');
const native=load('forge-integration/src/main/java/forge/app/CommandTableOverlay.java');
assert(native.includes('private static forge.game.card.CardView commanderInZone(PlayerView human)'),
  'Native castCommander must identify the actual commander');
assert(native.includes('if (card != null && card.isCommander()) return card;'),
  'Native command-zone lookup must be based on commander identity');
assert(native.includes('bridge.castCard(commanderInZone(human).getId());'),
  'Native command-zone casting must use the commander card ID');
assert(!native.includes('human.getCommand().get(0).getId()'),
  'First command-zone card is not necessarily the commander');
const upstreamGameAction='GameAction.stateBasedAction_Commander / PlayerControllerHuman.confirmAction';
assert(dispatcher.includes('extras.put("commanderDestination", true)'),
  'Forge Commander choice should be explicitly identified');
assert(dispatcher.includes('entry.put("label", i == 0 ? "Move to command zone" : "Keep the normal destination")'),
  'A commander-choice yes/no must display human-readable destinations');
assert(dispatcher.includes('buttons, 1, 1, null, extras'),
  'Do not lose original Forge choice and confirmed yes/no mapping');
assert(projection.includes('seat.put("commanderCasts", p.getCommanderCast(commander))'),
  'Commander tax must use Forge cast count');
assert(projection.includes('seat.put("commandZone", visibleCards(p.getCommand()))'),
  'Command-zone contents must use Forge, not local simulation');
assert(cast.includes('find(c=>c.commander);'),'Non-commander command-zone effects must not be cast');
assert(!cast.includes('find(c=>c.commander) || p?.commandZone?.[0]'),
  'Do not accidentally cast first unrelated command-zone object');
new vm.Script(choice);
new vm.Script(cast);

class El {
  constructor(tag){
    this.tag=tag.toLowerCase();this.children=[];this.parentNode=null;
    this.style={};this.dataset={};this.attrs={};this.textContent='';
    this.value='';this.className='';this.disabled=false;
  }
  append(...nodes){for(const node of nodes){node.parentNode=this;this.children.push(node);}}
  replaceChildren(...nodes){this.children=[];this.append(...nodes);}
  setAttribute(key,value){this.attrs[key]=String(value);}
  getAttribute(key){return this.attrs[key]??null;}
  focus(){}
  addEventListener(type,fn){this['on'+type]=fn;}
  querySelector(selector){
    const matches=node=>selector==='[data-ct-choice-confirm]'&&node.dataset.ctChoiceConfirm==='1'
      ||selector==='[data-ct-error]'&&node.dataset.ctError==='1'
      ||selector==='[data-ct-choice-value]'&&node.dataset.ctChoiceValue==='1';
    function find(node){if(matches(node))return node;
      for(const c of node.children){const match=find(c);if(match)return match;}return null;}
    return find(this);
  }
}
function fixtures(){
  const document={body:new El('body'),head:new El('head'),
    createElement:tag=>new El(tag),listeners:{},
    addEventListener(type,handler){(this.listeners[type]??=[]).push(handler);}};
  const all=(tag,root=document.body)=>{
    const matches=[];function visit(node){if(node.tag===tag)matches.push(node);
      node.children.forEach(visit);}visit(root);return matches;
  };
  return {document,all};
}
async function run(){
  // Native full-screen Forge choice preserves yes/no semantics. No automatic
  // commander destination is permitted, even with one choice outstanding.
  const choiceFixture=fixtures(),choiceCalls=[];
  const choiceWindow={CommandTableNative:{request:async(type,payload)=>{
    choiceCalls.push({type,payload});return {accepted:true};}}};
  vm.runInNewContext(choice,{document:choiceFixture.document,window:choiceWindow,
    setTimeout:()=>1,clearTimeout:()=>{}});
  function offerCommander(id){
    choiceWindow.CommandTableNativeReply({type:'game.choice',payload:{
      id,mode:'single',confirm:true,commanderDestination:true,min:1,max:1,
      title:'Where should your commander go? Etali, Primal Storm',
      options:[{label:'Move to command zone'},{label:'Keep the normal destination'}]
    }});
  }
  const modal=choiceFixture.document.body.children[0];
  offerCommander('cmd-to-graveyard');
  assert.equal(modal.style.display,'flex','Commander destination must open fullscreen');
  assert.equal(choiceCalls.length,0,'Forge choice must never auto-answer');
  assert(choiceFixture.all('p').some(e=>e.textContent.includes('Choose where your commander goes')));
  let buttons=choiceFixture.all('button');
  assert(buttons.some(e=>e.textContent==='Move to command zone'));
  assert(buttons.some(e=>e.textContent==='Keep the normal destination'));
  assert(buttons.find(e=>e.textContent==='Confirm choice').disabled,
    'Must require explicit ownership decision');
  buttons.find(e=>e.textContent==='Keep the normal destination').onclick();
  buttons=choiceFixture.all('button');
  assert.equal(buttons.find(e=>e.textContent==='Confirm choice').disabled,false);
  buttons.find(e=>e.textContent==='Confirm choice').onclick();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(choiceCalls.length,1);
  assert.equal(choiceCalls[0].type,'choice.answer');
  assert.equal(choiceCalls[0].payload.choiceId,'cmd-to-graveyard');
  assert.equal(JSON.stringify(choiceCalls[0].payload.indices),'[1]',
    'Declining the command-zone move must preserve Forge option index 1');
  offerCommander('cmd-to-command');
  buttons=choiceFixture.all('button');
  buttons.find(e=>e.textContent==='Move to command zone').onclick();
  choiceFixture.all('button').find(e=>e.textContent==='Confirm choice').onclick();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(JSON.stringify(choiceCalls[1].payload.indices),'[0]',
    'Accepting the command-zone move must preserve Forge option index 0');

  // The commander cast preview uses Forge-projected previous command-zone
  // casts to communicate tax and sends its real stable card ID to Forge.
  const castFixture=fixtures(),castCalls=[];
  const player={
    commander:'Etali, Primal Storm',commanderCasts:2,
    commandZone:[{id:81,name:'Commander Effect',commander:false},
      {id:42,name:'Etali, Primal Storm',commander:true,type:'Legendary Creature',
       manaCost:'4 R R',rulesText:'Whenever Etali attacks...'}],
    hand:[],handForgeIds:[],graveyardCards:[],exileCards:[]
  };
  const castWindow={
    app:{nativeMatch:true,view:'game',game:{players:[player]},sideInspect:null,modal:''},
    ctCardArtUrl:()=>'',ctForgeSafety:{checkCast:()=>({ok:true})},
    CommandTableNative:{request:async(type,payload)=>{
      castCalls.push({type,payload});return type==='game.snapshot'?{game:null}:{};}},
    ctNativeToast:()=>{},render:()=>{}
  };
  const context={document:castFixture.document,window:castWindow,
    setTimeout:()=>1,clearTimeout:()=>{}};
  vm.runInNewContext(cast,context);
  castWindow.ctSimpleCast.openCommander();
  const backdrop=castFixture.document.body.children[0];
  assert.equal(backdrop.dataset.open,'true');
  assert(castFixture.all('div').some(e=>e.className==='ct-cast-meta'
    && e.textContent.includes('Commander tax: +{4} generic (2 prior command-zone casts)')),
    'Preview must expose commander tax using Forge-provided prior cast count');
  const go=castFixture.all('button').find(e=>e.className==='ct-cast-go');
  assert(go);
  go.onclick();
  await new Promise(resolve=>setImmediate(resolve));
  assert(castCalls.some(x=>x.type==='game.command'
    && x.payload?.action==='castById' && x.payload.value===42),
    'Commander must cast the real commander, not an auxiliary command-zone effect');
  castWindow.ctSimpleCast.hide();
  player.commandZone=[{id:81,name:'Commander Effect',commander:false}];
  castWindow.ctSimpleCast.openCommander();
  assert.equal(backdrop.dataset.open,'false',
    'Do not open a false commander cast preview if commander is in graveyard');
  if(process.argv[2]){
    const html=load(process.argv[2]);
    assert(html.includes('commanderDestination'),
      'Embedded Android UI is missing full-screen commander destination treatment');
    assert(html.includes('Commander tax: +{'),
      'Embedded Android UI is missing commander tax display');
  }
  console.log('PASS Sol Pod v0.42 Commander zone choice yes/no and authoritative recast preview');
}
run().catch(err=>{console.error(err);process.exitCode=1;});
