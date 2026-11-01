#!/usr/bin/env python3
"""Replace simulator interaction with a real Forge GameView-backed presentation."""
from pathlib import Path
import sys
source = Path(sys.argv[1]).read_text()
# Fix the recovered prototype's first-script boot blocker: the approximation
# declaration was accidentally joined onto a // comment.
boot_bug = "training approximations.  const approximation"
assert source.count(boot_bug) == 1, "Card-data startup source changed"
source = source.replace(boot_bug, "training approximations.\n  const approximation")
target = Path(sys.argv[2])
needle = "function applyAuthoritativeGame(state) {"
assert source.count(needle) == 1, "Frontend game-state integration point changed"
adapter = r"""
function ctHydrateForgeState(raw) {
  if(!raw || !Array.isArray(raw.players)) throw new Error('Invalid Forge snapshot');
  window.ctForgePlayers=raw.players.map(p=>({id:p.id,name:p.name}));
  const ps = raw.players.map((p,i) => {
    const cardZone = z => {
      const zone=Array.isArray(z) ? z : [];
      for(const c of zone) if(c.name && c.type && !c.faceDown) {
        window.ctForgeCards ||= Object.create(null);
        window.ctForgeCards[c.name.toLowerCase()] = {
          id:c.name.toLowerCase().replace(/[^a-z0-9]+/g,'-'),
          name:c.name, type:c.type, cost:c.manaCost||'',
          text:c.rulesText||'', power:c.power, toughness:c.toughness,
          identity:[], colors:[], keywords:[], implemented:true, effect:'forge'
        };
      }
      return zone;
    };
    const battlefield = cardZone(p.battlefield).map(c=>({
      uid:String(c.id), forgeId:c.id, name:c.name, tapped:!!c.tapped,
      counters:0, damage:0, summoned:false, commander:!!c.commander,
      creature:c.creature, land:c.land, attacking:!!c.attacking, blocking:!!c.blocking,
      power:c.power, toughness:c.toughness
    }));
    const cmd = cardZone(p.commandZone).find(c=>c.commander)?.name ||
                cardZone(p.commandZone)[0]?.name || p.commander || 'Commander';
    return {
      id:'P'+(i+1), forgeId:p.id, name:i===0?'You':p.name,
      commander:p.commanderName||cmd, life:p.life, cpu:!!p.isAI, dead:!!p.hasLost,
      commanderCasts:p.commanderCasts||0, commanderDamage:p.commanderDamage||{},
      hand:cardZone(p.hand).map(c=>c.name),
      handForgeIds:cardZone(p.hand).map(c=>c.id),
      library:Array(Math.max(0,p.libraryCount||0)).fill('Unknown card'),
      battlefield, graveyard:cardZone(p.graveyard).map(c=>c.name),
      exile:cardZone(p.exile).map(c=>c.name), landPlays:p.landPlays||0, spellsThisTurn:0,
      commandZone:cardZone(p.commandZone), priority:!!p.priority
    };
  });
  const active=Math.max(0,raw.players.findIndex(p=>p.id===raw.activePlayer));
  const phaseValue=String(raw.phase||'MAIN1').toUpperCase();
  const phase=phaseValue.includes('MAIN1')?'main1':phaseValue.includes('MAIN2')?'main2':
    phaseValue.includes('COMBAT')?'combat':phaseValue.includes('END')?'end':phaseValue.toLowerCase();
  return {
    native:true, players:ps, active, turn:raw.turn||1, phase,
    stack:(Array.isArray(raw.stack)?raw.stack:[]).map((item,i)=>
      typeof item==='string'?{id:i,name:item}:item),
    combat:Array.isArray(raw.combat)?raw.combat:[],
    pending:null, waiting:null, log:[], autoPilot:false, autoPaused:false,
    winner:raw.gameOver ? (raw.winner || 'Game ended') : null
  };
}
"""
source=source.replace(needle,adapter+"\n"+needle)
# Unknown imported cards are rendered using authoritative card data
# from Forge, not the small hardcoded training-card database.
assert source.count("const card = name => CardData.byName(name)")==1
source=source.replace("const card = name => CardData.byName(name)",
                      "const card = name => (window.ctForgeCards?.[String(name).toLowerCase()] || CardData.byName(name))")

# Forge's card type is authoritative for the battlefield. Old prototype cards
# still use the local metadata classification in training mode.
source=source.replace("p.battlefield.filter(x=>isCreature(card(x.name)))",
                      "p.battlefield.filter(x=>x.creature===undefined?isCreature(card(x.name)):x.creature)")
source=source.replace("p.battlefield.filter(x=>!isCreature(card(x.name)))",
                      "p.battlefield.filter(x=>x.creature===undefined?!isCreature(card(x.name)):!x.creature)")

source=source.replace("app.game={...state,native:true};app.savedGame=null;",
                      "app.game=ctHydrateForgeState(state);app.savedGame=null;")
# Native matches MUST NOT run their own rules; route card taps and phase actions to Forge.
source=source.replace(" 'toggleAutoPilot','pauseAutoPilot'\n]);",
                      " 'permanent','cancelCastTarget','concede','quitGame','targetPlayer','selectStack'\n]);")
# Leave a native match by conceding in Forge before discarding its UI state.
source=source.replace(
 ".then(result=>{if(result?.game){applyAuthoritativeGame(result.game);render();}})",
 ".then(async result=>{if(act==='quitGame'){app.nativeMatch=false;app.game=null;app.savedGame=null;window.ctForgeChoice?.close();setView('home');return;}const latest=result?.game?result:await CommandTableNative.request('game.snapshot');if(latest?.game){applyAuthoritativeGame(latest.game);if(app.view==='game')render();}})")

# Safety check: never allow a native match to fall through to the JS simulator.
source=source.replace(" const g=app.game,p=g?.players[0],active=g&&turnPlayer();switch(act){",
                      """  if(app.nativeMatch && app.view==='game' &&
      !new Set(['focusPlayer','togglePod','menuGame','inspect','inspectFull','inspectCommander','inspectPlayer','showHandCard','openHand','previousHand','nextHand','selectHand','closeModal','cycleOpponent','viewStack','viewHistory','helpCurrent','back','nativePrompts','quitGame','clearSideInspect','dismiss','rotateMatch','togglePod']).has(act)) {
    announce('This action must be handled by Forge: '+act); return;
  }
 const g=app.game,p=g?.players[0],active=g&&turnPlayer();switch(act){""")
source=source.replace('data-action="menuGame" aria-label="Options">⚙</button>',
                      'data-action="menuGame" aria-label="Options">⚙</button><button data-action="nativePrompts" title="Advanced Forge decisions">⚖</button>')
# Native fallback prompts, explicitly temporary during integration.
source=source.replace("case 'artwork':setView('artwork');",
                      "case 'nativePrompts': window.AndroidBridge?.showNativePrompts?.();break;case 'artwork':setView('artwork');")

# Supply selected card / actual Forge target IDs, never guessed JS rule identifiers.
action_value = r"""
function ctNativeActionValue(act, v) {
  if(act==='playInspected'||act==='castSelected') {
    const name=act==='playInspected'?app.sideInspect:app.inspect;
    const me=app.game?.players?.[0];
    if(!name||!me)return -2;
    const idx=me.hand.findIndex(n=>n.toLowerCase()===String(name).toLowerCase());
    if(idx>=0)return idx;
    if(String(name).toLowerCase()===String(me.commander).toLowerCase())return -1;
    return -2;
  }
  if(act==='chooseCastTarget' && typeof v==='string') {
    const parts=v.split(':');
    const p=app.game?.players.find(x=>x.id===parts[1]);
    if(parts[0]==='player') return 'player:'+(p?.forgeId??parts[1]);
    if(parts[0]==='perm') return 'perm:'+(p?.forgeId??parts[1])+':'+parts[2];
  }
  return v??null;
}
"""
assert source.count("function action(act,v){")==1
source=source.replace("function action(act,v){",action_value+"\nfunction action(act,v){")
assert source.count("CommandTableNative.request('game.command',{action:act,value:v??null})")==1
source=source.replace("CommandTableNative.request('game.command',{action:act,value:v??null})",
                      "CommandTableNative.request('game.command',{action:act,value:ctNativeActionValue(act,v)})")

assert 'if(app.nativeMatch && app.view' in source, 'Simulator fallback guard missing'
assert 'ctNativeActionValue(act,v)' in source, 'Native action payload translation missing'
# Forge initializes assets asynchronously on first Android launch; retry the handshake.
assert source.count("void CommandTableNative.refreshStatus();")==1
source=source.replace("void CommandTableNative.refreshStatus();",
    "void CommandTableNative.refreshStatus().then(async ok=>{if(ok&&CommandTableNative.capabilities?.matchActive){try{const p=await CommandTableNative.request('game.snapshot');if(p?.game){app.nativeMatch=true;applyAuthoritativeGame(p.game);app.view='game';app.modal='';render();}}catch(e){announce('Could not restore active game: '+e.message);}}}); setInterval(()=>{if(!CommandTableNative.ready) void CommandTableNative.refreshStatus().then(ok=>{if(ok)render();});},3000);")
# Do not silently play the JavaScript simulator if embedded Forge is unavailable.
assert source.count(" const check=validate(d);if(!check.valid)")==1
source=source.replace(" const check=validate(d);if(!check.valid)",
    " if(window.CommandTableEngine && !CommandTableNative.ready) return announce('Forge is still loading the rules and card resources. Try again once the engine is ready.');\n const check=validate(d);if(!check.valid)")

# A Forge session may emit state before its initial start request returns.
# Mark it as native before invoking HostedMatch, never run JS rules in between.
assert source.count("   app.notice='Starting native Forge match…';render();")==1
source=source.replace("   app.notice='Starting native Forge match…';render();",
                      "   app.nativeMatch=true;app.notice='Starting Forge Commander match…';render();")
assert source.count(".catch(error=>announce(`Forge could not start this game: ${error.message}`));")==1
source=source.replace(".catch(error=>announce(`Forge could not start this game: ${error.message}`));",
                      ".catch(error=>{app.nativeMatch=false;announce(`Forge could not start this game: ${error.message}`);});")

# Repair ONLY bundled starter lists before any Forge match begins.
# Forge evaluates oracle-text mana symbols and Commander deck legality.
# Imported/user-edited decks are never automatically repaired.
repair_script = r"""
async function ctRepairStarterDecks() {
  const starters=app.decks.filter(d=>d.prebuilt===true && d.cards?.length===99);
  let fixes=0;
  const failed=new Map();
  for(const d of starters) {
    try {
      const result=await CommandTableNative.request('deck.repairPrebuilt',{
        deck:{name:d.name,commander:d.commander,main:d.cards}
      });
      if(result?.valid!==true || !Array.isArray(result.main)||result.main.length!==99) {
        failed.set(d.id,result?.reason||'Forge could not validate the starter');
        continue;
      }
      if(Array.isArray(result.replacements)&&result.replacements.length) {
        d.cards=result.main;
        fixes+=result.replacements.length;
        persist();
      }
    } catch(error) {
      failed.set(d.id,error?.message||String(error));
    }
  }
  const selected=app.decks.find(d=>d.id===(app.matchDeck||app.decks[0]?.id));
  if(selected?.prebuilt && failed.has(selected.id)) {
    throw new Error(selected.name+' is not legal: '+failed.get(selected.id));
  }
  if(fixes) {
    app.notice='Forge repaired '+fixes+' off-colour cards in the included starter decks.';
    persist();
    render();
  }
  return app.decks.filter(d=>!failed.has(d.id)).map(deck=>({
    name:deck.name,commander:deck.commander,main:deck.cards
  }));
}
"""
assert source.count("function startGame(){")==1, "Match start location changed"
source=source.replace("function startGame(){",repair_script+"\nfunction startGame(){")
assert source.count("   const allDecks = app.decks.map(deck=>({name:deck.name,commander:deck.commander,main:deck.cards}));")==1
source=source.replace("   const allDecks = app.decks.map(deck=>({name:deck.name,commander:deck.commander,main:deck.cards}));",
                      "   // Repair starter decks using Forge before creating opponent deck payloads.")
assert source.count("   void CommandTableNative.request('match.start',{")==1
source=source.replace("   void CommandTableNative.request('match.start',{",
                      "   void ctRepairStarterDecks().then(allDecks => CommandTableNative.request('match.start',{")
assert source.count("   }).then(payload=>{")==1
source=source.replace("   }).then(payload=>{","   })).then(payload=>{")
# Enter the actual Command Table board as soon as an authoritative state
# arrives. Forge can deliver a game.state before it acknowledges match.start.
state_listener = "try {applyAuthoritativeGame(message); if(app.view==='game') render();}"
assert source.count(state_listener)==1, "Native match state listener changed"
source=source.replace(state_listener,
    """try {
     applyAuthoritativeGame(message);
     app.view='game';app.modal='';app.notice='';
     render();
   }""")

# Forge's first GameView callback can also be lost while native dialogs or
# initial asset activities are transitioning. Poll the authoritative snapshot
# for a bounded period instead of remaining forever on the home screen.
watch_script = r"""
async function ctWatchNativeMatchStart() {
  for(let attempt=0;attempt<40;attempt++) {
    await new Promise(done=>setTimeout(done,1000));
    if(!app.nativeMatch || app.view==='game')return;
    try {
      const result=await CommandTableNative.request('game.snapshot');
      if(result?.game?.players?.length>=2) {
        applyAuthoritativeGame(result.game);
        app.view='game';app.modal='';app.notice='';render();
        return;
      }
    }catch(error){ /* Forge may still be preparing game state */ }
  }
  if(app.nativeMatch && app.view!=='game') {
    app.nativeMatch=false;
    announce('Forge match start timed out before a playable board was created. No deck data was changed.');
  }
}
"""
assert source.count("function startGame(){")==1
source=source.replace("function startGame(){",watch_script+"\nfunction startGame(){")
start_request = "void ctRepairStarterDecks().then(allDecks => CommandTableNative.request('match.start',{"
assert source.count(start_request)==1,"Starter match request changed"
source=source.replace(start_request,
    "void ctRepairStarterDecks().then(allDecks => {void ctWatchNativeMatchStart(); return CommandTableNative.request('match.start',{")
end_request = "   })).then(payload=>{"
assert source.count(end_request)==1, "Starter match acknowledgment changed"
source=source.replace(end_request,"   });}).then(payload=>{")

# Forge already includes tokens in the GameView. Keep those distinct permanents
# in Command Table instead of treating them as missing deck cards.
assert source.count("uid:String(c.id), forgeId:c.id, name:c.name, tapped:!!c.tapped,")==1
source=source.replace("uid:String(c.id), forgeId:c.id, name:c.name, tapped:!!c.tapped,",
                      "uid:String(c.id), forgeId:c.id, name:c.name, token:!!c.token, tapped:!!c.tapped,")
assert source.count("return smallCard(c,{tapped:x.tapped,counters:x.counters,bonus,selected:")==1
source=source.replace("return smallCard(c,{tapped:x.tapped,counters:x.counters,bonus,selected:",
                      "return smallCard(c,{tapped:x.tapped,token:!!x.token,counters:x.counters,bonus,selected:")
assert source.count("const classes=['game-card',kind,opts.tapped?'tapped':'',")==1
source=source.replace("const classes=['game-card',kind,opts.tapped?'tapped':'',",
                      "const classes=['game-card',kind,opts.tapped?'tapped':'',opts.token?'ct-token-permanent':'',")
token_css='<style>.ct-token-permanent{position:relative}.ct-token-permanent:after{content:"TOKEN";position:absolute;top:3px;right:3px;background:#18382d;color:#a8edcf;border:1px solid #589b7a;border-radius:5px;padding:1px 4px;font:700 9px system-ui;pointer-events:none}</style>'
assert source.count("</head>")==1
source=source.replace("</head>",token_css+"</head>")

# Render Forge's live priority prompt over the existing Command Table board.
# Buttons call Forge IGameController methods; they do not advance the JS simulator.
prompt_script = r"""
<script>
(function() {
  let prompt = {};
  const oldReceive = window.CommandTableNativeReply;
  const panel = document.createElement('section');
  panel.id = 'command-table-forge-choice';
  panel.setAttribute('aria-live', 'polite');
  Object.assign(panel.style, {
    position:'fixed', bottom:'calc(env(safe-area-inset-bottom) + 46px)',
    left:'8px', right:'8px', maxWidth:'700px', margin:'auto', zIndex:'9999',
    background:'#14252dee', border:'1px solid #c8a77a', borderRadius:'14px',
    padding:'12px', boxShadow:'0 10px 40px #000c', display:'none',
    fontFamily:'system-ui', color:'#f5e8cf'
  });
  const message=document.createElement('div');
  Object.assign(message.style,{fontSize:'13px',lineHeight:'1.4',marginBottom:'8px',maxHeight:'66px',overflow:'auto'});
  panel.append(message);
  const row=document.createElement('div');
  Object.assign(row.style,{display:'flex',gap:'8px'});
  panel.append(row);
  const playersRow=document.createElement('div');
  Object.assign(playersRow.style,{display:'none',gap:'6px',marginTop:'8px',flexWrap:'wrap'});
  panel.append(playersRow);
  const confirm=document.createElement('button'), cancel=document.createElement('button');
  const advanced=document.createElement('button');
  for(const b of [confirm,cancel,advanced]) {
    Object.assign(b.style,{borderRadius:'9px',minHeight:'42px',padding:'8px 12px',
      border:'1px solid #99836c',background:'#263d42',color:'#f8e5c4',fontWeight:'700',flex:'1'});
    row.append(b);
  }
  confirm.textContent='Continue';cancel.textContent='Cancel';advanced.textContent='More choices';
  advanced.onclick=()=>window.AndroidBridge?.showNativePrompts?.();
  async function act(name,value) {
    try { await CommandTableNative.request('game.command',{action:name,value}); }
    catch(e){ if(typeof announce==='function') announce('Forge: '+e.message); }
  }
  confirm.onclick=()=>act('resolve');
  cancel.onclick=()=>act('cancelCastTarget');
  function update() {
    let playing=false;
    try{playing=!!app.nativeMatch && app.view==='game';}catch(e){}
    const visible=playing && (prompt.message || prompt.label1 || prompt.label2);
    panel.style.display=visible?'block':'none';
    message.textContent=prompt.message || 'Choose how to respond';
    confirm.textContent=prompt.label1||'Continue';
    cancel.textContent=prompt.label2||'Cancel';
    confirm.disabled=prompt.enable1===false;
    cancel.disabled=prompt.enable2===false;
    confirm.style.opacity=confirm.disabled?'.4':'1';
    cancel.style.opacity=cancel.disabled?'.4':'1';
    const asksForPlayer=/choose.*(player|opponent)|target.*(player|opponent)|attack.*(player|opponent)|defending player/i.test(prompt.message||'');
    playersRow.style.display=visible&&asksForPlayer?'flex':'none';
    playersRow.replaceChildren();
    if(asksForPlayer) for(const p of window.ctForgePlayers||[]) {
      const b=document.createElement('button');
      b.textContent='Target '+p.name;
      Object.assign(b.style,{padding:'8px',border:'1px solid #b9a077',borderRadius:'8px',
        background:'#34454b',color:'#fff',flex:'1',fontSize:'12px'});
      b.onclick=()=>act('targetPlayer',p.id);
      playersRow.append(b);
    }
  }
  document.body.append(panel);
  window.CommandTableNativeReply=function(value) {
    let event;
    try {event=typeof value==='string'?JSON.parse(value):value;}catch(e){}
    if(event && event.type==='game.prompt') {
      Object.assign(prompt,event.payload||{});
      update();return;
    }
    return oldReceive(value);
  };
  setInterval(update,500);
})();
</script>
"""
assert source.endswith("</body></html>"), "Expected complete Command Table document"
source=source.replace("</body></html>",prompt_script+"</body></html>")


# Native taps on any battlefield permanent must go to Forge for legal
# targeting/blocker choices. The training simulator keeps its original actions.
assert source.count("action:app.pendingCast?(targetable?'chooseCastTarget':'inspect'):(mine?'permanent':'inspect')")==1
source=source.replace(
    "action:app.pendingCast?(targetable?'chooseCastTarget':'inspect'):(mine?'permanent':'inspect')",
    "action:app.nativeMatch?'permanent':(app.pendingCast?(targetable?'chooseCastTarget':'inspect'):(mine?'permanent':'inspect'))")
assert source.count("value:app.pendingCast&&targetable?target:mine?x.uid:c.name")==1
source=source.replace("value:app.pendingCast&&targetable?target:mine?x.uid:c.name",
                      "value:app.nativeMatch?x.uid:(app.pendingCast&&targetable?target:mine?x.uid:c.name)")

# All castability/availability decisions belong to Forge in a native match.
# The old training-only canCast() must never disable legal imported cards.
gates = [
  ("!g.autoPilot&&(idx>=0||cmd)&&canCast(human,c,cmd)",
   "!g.autoPilot&&(idx>=0||cmd)&&(app.nativeMatch||canCast(human,c,cmd))"),
  ("!g.autoPilot&&(p.hand.some(x=>equalName(x,name))||cmd)&&canCast(p,c,cmd)",
   "!g.autoPilot&&(p.hand.some(x=>equalName(x,name))||cmd)&&(app.nativeMatch||canCast(p,c,cmd))"),
  ("available:!g.autoPilot&&canCast(me,c)",
   "available:!g.autoPilot&&(app.nativeMatch||canCast(me,c))"),
  ("const playable=canCast(p,c),canPlay=playable&&c.implemented&&!app.game?.autoPilot;",
   "const playable=app.nativeMatch||canCast(p,c),canPlay=app.nativeMatch?true:playable&&c.implemented&&!app.game?.autoPilot;"),
  ("can=g&&p&&(inHand||cmd)&&canCast(p,c,cmd)",
   "can=g&&p&&(inHand||cmd)&&(app.nativeMatch||canCast(p,c,cmd))"),
  ("if(!canCast(p,c,fromCommander)){announce('Not enough mana or cannot cast at this time.');return;}",
   "if(!app.nativeMatch&&!canCast(p,c,fromCommander)){announce('Not enough mana or cannot cast at this time.');return;}")
]
for before,after in gates:
    assert before in source, "Native castability gate changed: "+before
    source=source.replace(before,after)


# Real Commander legality checks from Forge; no misleading native "unsupported" warning.
source=source.replace(
  '<button class="secondary" data-action="findCommander">Find commander metadata online ↗</button>',
  '<button class="secondary" data-action="findCommander">Find commander metadata online ↗</button>'
  '<button class="secondary" data-action="checkForgeDeck">Validate with Forge ✓</button>')
source=source.replace(
  '<strong>${check.unsupported}</strong><small>Unsupported</small>',
  '<strong>${window.CommandTableEngine?"Forge":check.unsupported}</strong><small>${window.CommandTableEngine?"Rules engine":"Unsupported"}</small>')
source=source.replace(
  'Online discoveries can be saved to decks but are not playable until their rules are implemented.',
  'Imported cards are checked against the Forge Commander rules engine before play.')
source=source.replace("case 'nativePrompts': window.AndroidBridge?.showNativePrompts?.();break;",
"""case 'checkForgeDeck': {
   const deck=app.decks.find(x=>x.id===app.editing);
   if(!deck){announce('Choose a deck first');break;}
   if(!CommandTableNative.ready){announce('Forge is still loading its card database');break;}
   void CommandTableNative.request('deck.validate',{
     deck:{name:deck.name,commander:deck.commander,main:deck.cards}
   }).then(v=>announce(v.valid?'Legal Commander deck':('Forge: '+v.reason)))
     .catch(e=>announce('Forge validation failed: '+e.message));
   break;
 }
 case 'nativePrompts': window.AndroidBridge?.showNativePrompts?.();break;""")


# Imports are local-first: do not query Scryfall when the full Forge catalog is
# bundled. Save immediately and let the Forge catalog hydrate missing card metadata
# in the background, even when the device is offline during the first launch.
import_hook = " if(unknown.length){\n   let unresolved=unknown;"
assert source.count(import_hook) == 1, "Importer network lookup changed"
source=source.replace(import_hook,
  """ if(unknown.length){
   if(window.CommandTableEngine){
     app.notice='Deck saved. Card details will be resolved from the installed Forge catalog; no online lookup is required.';
     render();
     void window.CommandTableCatalog?.resolveSavedDecks();
     return;
   }
   let unresolved=unknown;""")

# The small training-card cache is NOT authoritative for native deck legality.
# Show a neutral pending verdict until the user requests Forge validation.
source=source.replace(
  "function editView(){const d=app.decks.find(x=>x.id===app.editing);if(!d){app.view='decks';return decksView();}const check=validate(d),",
  "function editView(){const d=app.decks.find(x=>x.id===app.editing);if(!d){app.view='decks';return decksView();}const check=window.CommandTableEngine?{issues:[],unsupported:0}:validate(d),")
source=source.replace(
  '✓ Meets basic 100-card singleton and colour rules.',
  '${window.CommandTableEngine?"Use Validate with Forge for an authoritative Commander legality check.":"✓ Meets basic 100-card singleton and colour rules."}')
source=source.replace(
  'Unsupported cards remain deck-only until Forge integration.',
  'Imported cards will be validated against the complete Forge rules engine.')

source=source.replace("TABLETOP ALPHA · 0.11.0",
                      "FORGE BUILT-IN · v0.14.4")
# The setup page must not show warnings from the prototype's card cache.
setup_check="check=d?validate(d):{valid:false}"
source=source.replace(setup_check,
  "check=CommandTableNative.ready?"
  "{valid:!!d&&d.cards.length===99,unsupported:0}:"
  "(d?validate(d):{valid:false})")
# The home page must allow real imported decks, not require the limited
# training-card catalog to mark every card as simulated.
home_gate = "const ready=!!selected&&check.valid&&check.unsupported===0&&commander.implemented;"
assert source.count(home_gate)==1, "Home deck playability gate changed"
source=source.replace(home_gate,
  "const ready=!!selected&&(CommandTableNative.ready?"
  "(selected.cards.length===99&&!!selected.commander):"
  "(check.valid&&check.unsupported===0&&commander.implemented));")
# The training autopilot is not the real Forge AI opponent mode.
source=source.replace('data-action="setPlayMode" data-value="watch"',
  'data-action="setPlayMode" data-value="watch" ${CommandTableNative.ready?\'disabled title="Requires a separate AI human controller"\':\'\'}')
source=source.replace(" if (CommandTableNative.ready) {\\n   // Forge must validate",
  " if (CommandTableNative.ready) {\\n   app.autoPilot=false;\\n   // Forge must validate")

# Native Forge informational messages must appear in Command Table, never
# trigger Forge's modal message box or replace the board.
notice_receive = "    if (data.type === 'game.state') {for (const fn of onState) fn(data.payload);return;}"
assert source.count(notice_receive) == 1, "Native reply protocol changed"
source=source.replace(notice_receive,
    notice_receive + "\n    if (data.type === 'game.notice') {app.notice=String(data.payload?.message||'').slice(0,1500);render();return;}")
# The old escape hatch showed Forge's native screens; keep every action in the
# Command Table rules UI and direct users to the in-app legal choice panel.
source=source.replace("case 'nativePrompts': window.AndroidBridge?.showNativePrompts?.();break;",
    "case 'nativePrompts': announce('Select a legal Forge card or target from the Command Table choice panel.');break;")
# Never expose a button which silently changes rendering engines.
source=source.replace("  advanced.onclick=()=>window.AndroidBridge?.showNativePrompts?.();",
    "  advanced.style.display='none';")

# The training UI shows its own turn buttons; Forge is the sole gameplay
# controller in real matches. Removing duplicates also frees the hand area.
assert source.count("function turnControls(g,active,self){")==1
source=source.replace("function turnControls(g,active,self){",
    "function turnControls(g,active,self){if(app.nativeMatch)return '';")
native_entry="if(app.nativeMatch && NATIVE_GAME_COMMANDS.has(act)) {"
assert source.count(native_entry)==1
source=source.replace(native_entry,
    native_entry+"\n   if(['castSelected','playInspected','quitGame'].includes(act)){app.modal='';render();}")
assert source.count("⊞ Pod")==1
source=source.replace("⊞ Pod","▦")
assert source.count("overview?'Focus':'▦'")==1
source=source.replace("overview?'Focus':'▦'","overview?'▣':'▦'")
source=source.replace('aria-label="Pod overview"','aria-label="Toggle pod overview" title="Show all players"')
menu_btn='<button data-action="menuGame" aria-label="Options">⚙</button>'
assert source.count(menu_btn)>=1
source=source.replace(menu_btn,
    '<button data-action="rotateMatch" aria-label="Rotate battlefield" title="Portrait / landscape">⤾</button>'+menu_btn)
source=source.replace("TABLETOP ALPHA · 0.11.0",
    "FORGE BUILT-IN · v0.14.4")
pod_css = """
<style id="ct-forge-game-ux">
.ct10-top-tools{gap:5px!important;flex-wrap:nowrap!important}
.ct10-top-tools .ct10-phase-badge{max-width:calc(100% - 180px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ct10-top-tools button{flex:0 0 34px!important;min-width:34px!important;width:34px!important;height:34px!important;font-size:19px!important;line-height:1!important;white-space:nowrap!important}
.ct10-overview{inset:11% 3% 16% 3%!important;width:auto!important;height:auto!important;overflow-y:auto!important;padding:10px!important;background:#0d2026f3!important}
.ct10-overview .ct-pod-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;grid-auto-rows:minmax(132px,1fr)!important;gap:9px!important;min-height:0!important}
.ct10-overview .ct-pod-seat{min-width:0;min-height:125px}
@media(max-width:370px){.ct10-top-tools .ct10-phase-badge{font-size:9px!important;letter-spacing:0!important;padding:6px!important}}
@media(orientation:landscape) and (max-height:650px){
 .ct10-top-tools .ct10-phase-badge{max-width:calc(100% - 190px)}
 .ct10-overview{inset:12% 3% 12% 3%!important}
 .ct10-overview .ct-pod-grid{grid-template-columns:repeat(4,minmax(0,1fr))!important;grid-auto-rows:minmax(105px,1fr)!important}
}
</style>
"""
assert source.count("</head>")==1
source=source.replace("</head>",pod_css+"</head>")

# All add-on scripts must use the SAME native match session and state.
# The recovered core is wrapped in an IIFE, so expose a controlled bridge.
runtime_export = """window.CommandTableNative = CommandTableNative;
window.app = app;
window.render = render;
window.applyAuthoritativeGame = applyAuthoritativeGame;
window.announce = announce;
window.CommandTableAction = action;
"""
assert source.count("window.CommandTableEngineStatus = () =>")==1
source=source.replace("window.CommandTableEngineStatus = () =>",
                      runtime_export+"window.CommandTableEngineStatus = () =>")

# Command Table's complete Forge choice UI replaces most old native
# selection dialogs and returns only authoritative option indices.
choice_js = (Path(__file__).resolve().parent.parent / 'web' / 'forge-choice.js').read_text()
assert 'window.ctForgeChoice' in choice_js
assert source.count('</body></html>') == 1
source=source.replace('</body></html>', '<script>\n'+choice_js+'\n</script></body></html>')
selection_js = (Path(__file__).resolve().parent.parent / 'web' / 'forge-selection.js').read_text()
assert 'window.ctForgeSelection' in selection_js
source=source.replace('</body></html>', '<script>\n'+selection_js+'\n</script></body></html>')
catalog_js = (Path(__file__).resolve().parent.parent / 'web' / 'forge-catalog.js').read_text()
assert 'CommandTableCatalog' in catalog_js
source=source.replace('</body></html>', '<script>\n'+catalog_js+'\n</script></body></html>')
# The sideload app has its full Forge catalog locally; no server dependency.
source=source.replace('Online discoveries can be saved to decks but are not playable until their rules are implemented.',
                      'Search the complete Forge card database included with Command Table. No extra download required.')
target.parent.mkdir(parents=True,exist_ok=True)
target.write_text(source)
print(f'Patched Command Table HTML: {len(source)} characters')
