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
      !new Set(['focusPlayer','togglePod','menuGame','inspect','inspectFull','inspectCommander','inspectPlayer','showHandCard','openHand','previousHand','nextHand','selectHand','closeModal','cycleOpponent','viewStack','viewHistory','helpCurrent','back','nativePrompts','quitGame','clearSideInspect']).has(act)) {
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
                      "COMMANDER · FORGE RULES")
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
