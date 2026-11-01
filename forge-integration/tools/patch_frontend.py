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

# Forge's priority buttons have ONE owner: forge-selection.js.
# Do not inject a second fixed overlay for the same game.prompt events.

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
   "available:!g.autoPilot&&!app.nativeMatch&&canCast(me,c)"),
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
                      "FORGE BUILT-IN · v0.14.6")
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
    "FORGE BUILT-IN · v0.14.6")
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


# Deck presentation is a view preference, not a change to saved data.
deck_polish = r"""
function ctShowStarterDecks(){return storage.getItem('ct_show_starter_decks_v1')!=='false';}
function ctIsStarter(d){return !!d.prebuilt||String(d.id||'').startsWith('prebuilt-');}
function ctSortedDecks(showStarters=true){
 const indexed=app.decks.map((d,i)=>({d,i}));
 return indexed.filter(x=>showStarters||!ctIsStarter(x.d))
 .sort((a,b)=>Number(ctIsStarter(a.d))-Number(ctIsStarter(b.d))||a.i-b.i)
 .map(x=>x.d);
}
function ctHomeDeckCards(){return ctSortedDecks(ctShowStarterDecks()).slice(0,12).map(deckCard).join('');}
"""
assert source.count("function home(){")==1
source=source.replace("function home(){",deck_polish+"\nfunction home(){")
assert source.count("const deckChoices=app.decks.map(d=>")==1
source=source.replace("const deckChoices=app.decks.map(d=>","const deckChoices=ctSortedDecks().map(d=>")
old_grid='<div class="deck-grid ct-featured-grid">'+chr(36)+'{FEATURED.map(f=>app.decks.find(d=>d.id===`prebuilt-'+chr(36)+'{f.key}`)).filter(Boolean).map(deckCard).join(\'\')}</div>'
assert source.count(old_grid)==1, "Featured deck section changed"
source=source.replace(old_grid,'<div class="deck-grid ct-featured-grid ct-home-decks">'+chr(36)+'{ctHomeDeckCards()}</div>')
old_title='<button class="text-btn" data-action="decks">All decks →</button></div>'
assert source.count(old_title)==1
source=source.replace(old_title,
 '<div class="ct-deck-heading-actions"><button class="text-btn" data-action="toggleStarterDecks">'+chr(36)+'{ctShowStarterDecks()?"Hide starter decks":"Show starter decks"}</button><button class="text-btn" data-action="decks">All decks →</button></div></div>')
old_library='<div class="deck-grid">'+chr(36)+'{app.decks.map(deckCard).join(\'\')}</div>'
assert source.count(old_library)==1
source=source.replace(old_library,
 '<div class="ct-deck-filter"><strong>Imported & custom decks first</strong><button class="secondary" data-action="toggleStarterDecks">'+chr(36)+'{ctShowStarterDecks()?"Hide starter decks":"Show starter decks"}</button></div><div class="deck-grid ct-deck-library-grid">'+chr(36)+'{ctSortedDecks(ctShowStarterDecks()).map(deckCard).join(\'\')}</div>')
assert source.count(" case 'newDeck':")==1
source=source.replace(" case 'newDeck':",
 " case 'toggleStarterDecks':storage.setItem('ct_show_starter_decks_v1',String(!ctShowStarterDecks()));render();break;\n case 'newDeck':")
deck_css="""<style id="ct-forge-decks-polish">
.ct-home-decks{grid-template-columns:repeat(auto-fill,minmax(160px,1fr))!important;gap:9px!important}
.ct-home-decks .deck-tile{height:148px!important;min-height:148px!important;border-radius:12px!important}
.ct-home-decks .ct-deck-type{top:7px;left:7px;padding:3px 5px;font-size:8px}
.ct-home-decks .ct-deck-info{padding:9px!important}
.ct-home-decks .ct-deck-info strong{font-size:13px!important}
.ct-home-decks .ct-deck-info small{font-size:10px!important;margin-top:3px}
.ct-home-decks .ct-deck-foot{margin-top:5px;padding-top:4px;font-size:8px}
.ct-deck-heading-actions{display:flex;gap:9px;align-items:center;flex-wrap:wrap}
.ct-deck-heading-actions button{min-height:32px}
.ct-deck-filter{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:7px 0 16px;flex-wrap:wrap}
.ct-deck-library-grid .deck-tile{height:175px!important;min-height:175px!important}
@media(max-width:430px){.ct-home-decks{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
</style>"""
assert source.count('</head>')==1
source=source.replace('</head>',deck_css+'</head>')


# Expand the opening hand automatically, and allow two-state hand size from
# the ribbon or empty area of the fan. Card tap remains native card inspection.
assert source.count('<div class="ct-stage ct10-stage ')==1
source=source.replace('<div class="ct-stage ct10-stage ',
 '<div class="ct-stage ct10-stage '+chr(36)+'{app.handZoom?"ct10-hand-zoom":""} '+chr(36)+'{g.phase==="mulligan"?"ct10-hand-mulligan":""} ')
assert source.count('data-action="openHand">YOUR HAND')==1
source=source.replace('data-action="openHand">YOUR HAND',
 'data-action="toggleHandZoom" aria-label="Expand or collapse hand" aria-pressed="'+chr(36)+'{!!app.handZoom}">YOUR HAND')
assert source.count('YOUR HAND <b>'+chr(36)+'{me.hand.length}</b> ⤢')==1
source=source.replace('YOUR HAND <b>'+chr(36)+'{me.hand.length}</b> ⤢',
 'YOUR HAND <b>'+chr(36)+'{me.hand.length}</b> '+chr(36)+'{app.handZoom?"−":"⤢"}')
assert source.count('<div class="ct10-hand-fan">'+chr(36)+'{hand||')==1
source=source.replace('<div class="ct10-hand-fan">'+chr(36)+'{hand||',
 '<div class="ct10-hand-fan" data-action="toggleHandZoom">'+chr(36)+'{hand||')
assert source.count(" case 'openHand':")==1
source=source.replace(" case 'openHand':",
 " case 'toggleHandZoom':app.handZoom=!app.handZoom;render();break;\n case 'openHand':")
hand_css="""<style id="ct-forge-hand-polish">
.ct10-hand-mulligan .ct10-hand-wrap,.ct10-hand-zoom .ct10-hand-wrap{
 left:5%!important;width:90%!important;bottom:3%!important;
 height:clamp(185px,44dvh,355px)!important;z-index:10!important}
.ct10-hand-mulligan .ct10-hand-ribbon,.ct10-hand-zoom .ct10-hand-ribbon{height:29px!important;font-size:13px!important}
.ct10-hand-mulligan .ct10-hand-ribbon button,.ct10-hand-zoom .ct10-hand-ribbon button{font-size:13px!important;min-height:29px}
.ct10-hand-mulligan .ct10-hand-fan,.ct10-hand-zoom .ct10-hand-fan{height:calc(100% - 29px)!important;align-items:flex-end!important}
.ct10-hand-mulligan .ct10-hand-slot,.ct10-hand-zoom .ct10-hand-slot{margin-right:clamp(-32px,-1.3vw,-10px)!important;transform:rotate(var(--tilt))!important}
.ct10-hand-mulligan .ct10-hand-slot:hover,.ct10-hand-zoom .ct10-hand-slot:hover,
.ct10-hand-mulligan .ct10-hand-slot:has(.chosen),.ct10-hand-zoom .ct10-hand-slot:has(.chosen){
 transform:translateY(-14px) scale(1.06) rotate(0deg)!important}
.ct10-hand-mulligan .ct10-hand-slot .game-card,.ct10-hand-zoom .ct10-hand-slot .game-card{
 height:clamp(165px,39dvh,320px)!important;width:clamp(115px,26dvh,225px)!important;
 max-width:25vw;box-shadow:0 12px 28px #000b}
.ct10-hand-mulligan .ct10-hand-slot .gc-nameplate strong,.ct10-hand-zoom .ct10-hand-slot .gc-nameplate strong{font-size:clamp(10px,1vw,13px)!important}
.ct10-hand-wrap .ct10-hand-ribbon button{touch-action:manipulation}
@media(orientation:portrait){
 .ct10-hand-mulligan .ct10-hand-wrap,.ct10-hand-zoom .ct10-hand-wrap{bottom:11%!important;height:clamp(180px,30dvh,265px)!important}
 .ct10-hand-mulligan .ct10-hand-slot .game-card,.ct10-hand-zoom .ct10-hand-slot .game-card{height:clamp(145px,25dvh,230px)!important;width:clamp(85px,17.5vw,145px)!important;max-width:none}
 .ct10-hand-mulligan .ct10-hand-slot,.ct10-hand-zoom .ct10-hand-slot{margin-right:-23px!important}
}
</style>"""
assert source.count('</head>')==1
source=source.replace('</head>',hand_css+'</head>')


# Forge owns spell resolution; the browser only renders the authoritative stack.
stack_old='<button class="ct10-stack" data-action="viewStack">⚡ '+chr(36)+'{esc(g.stack.at(-1).name)} · '+chr(36)+'{g.stack.length} on stack</button>'
assert source.count(stack_old)==1, "Stack markup changed"
stack_new='<aside class="ct-native-stack" aria-label="Forge spell stack"><strong>⚡ Stack · '+chr(36)+'{g.stack.length}</strong><ol>'+chr(36)+'{g.stack.slice().reverse().map((spell,i)=>`<li><b>'+chr(36)+'{i===0?"NEXT":i+1}</b><span>'+chr(36)+'{esc(spell.name||"Ability")}</span></li>`).join("")}</ol></aside>'
source=source.replace(stack_old,stack_new)
assert source.count("commandZone:cardZone(p.commandZone), priority:!!p.priority")==1
source=source.replace("commandZone:cardZone(p.commandZone), priority:!!p.priority",
 "commandZone:cardZone(p.commandZone), tokenCount:Number(p.tokenCount||0), priority:!!p.priority")
stack_css="""<style id="ct-forge-stack-polish">
.ct-native-stack{position:absolute;right:2%;top:18%;width:clamp(170px,20vw,270px);max-height:42dvh;overflow:auto;z-index:7;background:#112631ec;border:1px solid #9ed5e9;border-radius:12px;padding:9px;color:#fff4dc;box-shadow:0 7px 25px #000a}
.ct-native-stack>strong{display:block;font-size:12px;letter-spacing:.7px}
.ct-native-stack ol{margin:7px 0 0;padding:0;list-style:none;display:grid;gap:5px}
.ct-native-stack li{display:flex;gap:7px;align-items:flex-start;background:#203d48;border-left:3px solid #a0d8f4;border-radius:6px;padding:7px;font-size:11px;line-height:1.3;overflow-wrap:anywhere}
.ct-native-stack li b{font-size:9px;color:#e8bd73;flex:none}
.ct10-scene:has(.ct10-inspect) .ct-native-stack{display:none}
.ct-forge-legal-target{outline:3px solid #58ddfc!important;outline-offset:2px;box-shadow:0 0 18px #36bafaa8!important}
@media(orientation:portrait){.ct-native-stack{max-height:30dvh;width:44vw;top:18%}}
</style>"""
assert source.count('</head>')==1
source=source.replace('</head>',stack_css+'</head>')


# Token count is derived from real Forge battlefield objects, NEVER from
# UI-side guesses about what Krenko should create.
token_label='strong>'+chr(36)+'{esc(p.commander.split(\',\')[0])}</strong>'
# The badge has no extra rules: show only if Forge reported at least one token.
token_label_from='<strong>'+chr(36)+'{esc(p.commander.split(\',\')[0])}</strong>'
token_label_to=token_label_from+'<small class="ct-token-count">'+chr(36)+'{p.tokenCount>0?" · "+p.tokenCount+" token"+(p.tokenCount===1?"":"s"):""}</small>'
assert source.count(token_label_from)==1
source=source.replace(token_label_from,token_label_to)

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
