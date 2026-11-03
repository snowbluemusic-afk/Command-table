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
    native:true, players:ps, active, turn:raw.turn||1, phase, phaseDetail:String(raw.phase||''),
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
                      " 'permanent','cardId','castCommander','castById','cancelCastTarget','concede','quitGame','targetPlayer','selectStack'\n]);")
# Leave a native match by conceding in Forge before discarding its UI state.
source=source.replace(
 ".then(result=>{if(result?.game){applyAuthoritativeGame(result.game);render();}})",
 ".then(async result=>{if(act==='quitGame'){app.nativeMatch=false;app.game=null;app.savedGame=null;window.ctForgeChoice?.close();setView('home');return;}const latest=result?.game?result:await CommandTableNative.request('game.snapshot');if(latest?.game){applyAuthoritativeGame(latest.game);if(app.view==='game')render();}})")

# Safety check: never allow a native match to fall through to the JS simulator.
source=source.replace(" const g=app.game,p=g?.players[0],active=g&&turnPlayer();switch(act){",
                      """  if(app.nativeMatch && app.view==='game' &&
      !new Set(['focusPlayer','togglePod','menuGame','inspect','inspectFull','inspectCommander','inspectPlayer','showHandCard','openHand','previousHand','nextHand','selectHand','closeModal','cycleOpponent','viewStack','viewHistory','helpCurrent','back','nativePrompts','quitGame','clearSideInspect','dismiss','rotateMatch','togglePod','toggleHandZoom','inspectBoardPermanent','toggleZones']).has(act)) {
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
    // Forge's stable zone IDs survive hand reordering and never confuse
    // command-zone cards with out-of-range hand indices.
    const handIndex=me.hand.findIndex(n=>n.toLowerCase()===String(name).toLowerCase());
    if(handIndex>=0)return me.handForgeIds?.[handIndex]??null;
    const commandCard=me.commandZone?.find(c=>c.commander||
      String(c.name).toLowerCase()===String(name).toLowerCase());
    if(commandCard)return commandCard.id;
    return null;
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
                      "CommandTableNative.request('game.command',{action:(act==='castSelected'||act==='playInspected')?'castById':act,value:ctNativeActionValue(act,v)})")

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
                      "FORGE BUILT-IN · v0.19.0")
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
    native_entry+"\n   if(['castSelected','playInspected','castById','castCommander','cardId','quitGame'].includes(act)){app.modal='';app.sideInspect=null;app.inspectOwner=null;app.inspectForgeId=null;render();}")
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
    "FORGE BUILT-IN · v0.19.0")
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
stack_new='<details class="ct-native-stack ct-stack-compact" aria-label="Forge spell stack" '+chr(36)+'{window.ctArenaMotion?.stackExpanded?"open":""}><summary>⚡ '+chr(36)+'{g.stack.length} on stack · <span>'+chr(36)+'{esc(g.stack.at(-1)?.name||"Ability")}</span>⌄</summary><ol>'+chr(36)+'{g.stack.slice().reverse().map((spell,i)=>`<li><b>'+chr(36)+'{i===0?"NEXT":i+1}</b><span>'+chr(36)+'{esc(spell.name||"Ability")}</span></li>`).join("")}</ol></details>'
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
window.ctNativeToast = ctNativeToast;
window.ctReceiveForgeState = ctReceiveForgeState;
window.CommandTableAction = action;
window.ctCardArtUrl = name => artUrl(card(name));
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
# v0.16 gesture layer loads after the authoritative Forge selection bridge.
gestures_js = (Path(__file__).resolve().parent.parent / 'web' / 'forge-gestures.js').read_text()
assert 'window.ctDirectCombat' in gestures_js
source=source.replace('</body></html>', '<script>\n'+gestures_js+'\n</script></body></html>')
# Foreground Zones, non-blocking hold-to-read, Forge-confirmed animation.
for feature in ('forge-zones.js','forge-card-hold.js','forge-motion.js','forge-graveyard.js','forge-art-loading.js'):
    feature_js=(Path(__file__).resolve().parent.parent / 'web' / feature).read_text()
    assert 'window.ct' in feature_js, 'Experience module export missing: '+feature
    source=source.replace('</body></html>', '<script>\n'+feature_js+'\n</script></body></html>')
# v0.19: The centered native cast sheet owns hand and commander cast clicks.
cast_preview_js=(Path(__file__).resolve().parent.parent / 'web' / 'forge-simple-cast.js').read_text()
assert 'window.ctSimpleCast' in cast_preview_js
source=source.replace('</body></html>', '<script>\n'+cast_preview_js+'\n</script></body></html>')
# The sideload app has its full Forge catalog locally; no server dependency.
source=source.replace('Online discoveries can be saved to decks but are not playable until their rules are implemented.',
                      'Search the complete Forge card database included with Command Table. No extra download required.')
# Native interaction continuity: Forge can emit several state messages while
# completing one action. The legacy adapter tore down and recreated the entire
# battlefield on *every* message, clearing in-progress inspection each time.
# Coalesce identical/rapid states but never delay the first game screen.
smooth_runtime = r"""
let ctForgeLastSignature = '';
let ctForgeRenderTimer = null;
function ctReceiveForgeState(state) {
  if(!state || !Array.isArray(state.players)) return;
  const signature=JSON.stringify(state);
  if(app.view==='game' && signature===ctForgeLastSignature) return;
  ctForgeLastSignature=signature;
  const alreadyPlaying=app.view==='game';
  const before=app.game;
  const previousPhase=String(before?.phaseDetail||'');
  applyAuthoritativeGame(state);
  // The animation layer reads ONLY two confirmed Forge projections.
  window.ctArenaMotion?.onState?.(before,app.game);
  const declaration=/COMBAT_DECLARE_(ATTACKERS|BLOCKERS)/.test(String(app.game?.phaseDetail||''));
  if(declaration && !/COMBAT_DECLARE_(ATTACKERS|BLOCKERS)/.test(previousPhase)){
    app.sideInspect=null;
    if(['inspect','permanent'].includes(app.modal))app.modal='';
  }
  if(!alreadyPlaying) {
    app.view='game';app.modal='';app.notice='';
    render();
    return;
  }
  // Preserve open card inspector / hand browser through native state updates.
  // Render at most once per short interaction frame, with the newest GameView.
  if(ctForgeRenderTimer!==null) return;
  ctForgeRenderTimer=setTimeout(()=>{
    ctForgeRenderTimer=null;
    if(!app.nativeMatch || app.view!=='game')return;
    if(app.modal==='hand' && !app.game?.players?.[0]?.hand?.length)app.modal='';
    render();
    window.ctForgePriority?.refresh?.();
    window.ctForgeSelection?.refresh?.();
  },90);
}
let ctForgeToastTimer=null;
function ctNativeToast(message){
  const txt=String(message||'').trim().slice(0,350);
  if(!txt)return;
  if(app.view!=='game'){announce(txt);return;}
  let notice=document.getElementById('ct-native-toast');
  if(!notice){
    notice=document.createElement('div');notice.id='ct-native-toast';
    notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
    notice.style.cssText='position:fixed;top:calc(env(safe-area-inset-top) + 49px);left:50%;transform:translateX(-50%);max-width:min(70vw,620px);max-height:70px;overflow:auto;z-index:210010;background:#283830f5;border:1px solid #a98e65;border-radius:11px;padding:9px 15px;color:#f5e7d6;box-shadow:0 5px 20px #0009;font:600 12px system-ui;text-align:center;pointer-events:auto';
    notice.onclick=()=>{notice.style.display='none';};
    document.body.append(notice);
  }
  notice.textContent=txt;
  notice.style.display='block';
  if(ctForgeToastTimer!==null)clearTimeout(ctForgeToastTimer);
  ctForgeToastTimer=setTimeout(()=>{notice.style.display='none';ctForgeToastTimer=null;},3700);
}
"""
assert source.count("function applyAuthoritativeGame(state) {")==1
source=source.replace("function applyAuthoritativeGame(state) {",
                      smooth_runtime+"\nfunction applyAuthoritativeGame(state) {")
old_listener="""     applyAuthoritativeGame(message);
     app.view='game';app.modal='';app.notice='';
     render();"""
assert source.count(old_listener)==1, 'Native game.state listener changed'
source=source.replace(old_listener, "      ctReceiveForgeState(message);")
old_command="if(latest?.game){applyAuthoritativeGame(latest.game);if(app.view==='game')render();}"
assert source.count(old_command)==1, 'Native command snapshot callback changed'
source=source.replace(old_command,"if(latest?.game)ctReceiveForgeState(latest.game);")
old_watch="applyAuthoritativeGame(result.game);\n        app.view='game';app.modal='';app.notice='';render();"
assert source.count(old_watch)==1, 'Initial game snapshot watcher changed'
source=source.replace(old_watch,"ctReceiveForgeState(result.game);")
old_notice="if (data.type === 'game.notice') {app.notice=String(data.payload?.message||'').slice(0,1500);render();return;}"
assert source.count(old_notice)==1
source=source.replace(old_notice,"if (data.type === 'game.notice') {ctNativeToast(data.payload?.message);return;}")
# A common on-device false affordance: the card preview showed Cast/play
# for a sorcery-speed artifact while the opponent was taking their turn.
# This is a conservative TIMING hint, not an independent legality/rules
# engine. Forge alone still checks costs, permissions, alternate casts, etc.
timing_helper = r"""
function ctNativeTiming(c){
  if(!app.nativeMatch)return {allowed:true,reason:''};
  const g=app.game,p=g?.players?.[0];
  if(!g||!p)return {allowed:false,reason:'Game is loading'};
  if(!p.priority)return {allowed:false,reason:'Waiting for priority'};
  const type=String(c?.type||'');
  const oracle=String(c?.text||'');
  const land=/\bLand\b/i.test(type);
  const instant=/\bInstant\b/i.test(type);
  const special=/\bflash\b|as though (?:it|they) had flash|any time you could cast an instant/i.test(oracle);
  const main=g.active===0&&(g.phase==='main1'||g.phase==='main2')&&
    !g.stack?.length;
  if(land){
    if(!main)return {allowed:false,reason:'Play lands during your main phase'};
    if(Number(p.landPlays||0)>=1)return {allowed:false,reason:'Land already played this turn'};
  } else if(!instant && !special && type && !main){
    return {allowed:false,reason:'Wait for your main phase to cast this card'};
  }
  return {allowed:true,reason:''};
}
"""
assert source.count("function immersiveInspect(){")==1
source=source.replace("function immersiveInspect(){",
    timing_helper+"\nfunction immersiveInspect(){")
timing_old="const castable=!g.autoPilot&&(p.hand.some(x=>equalName(x,name))||cmd)&&(app.nativeMatch||canCast(p,c,cmd));"
assert source.count(timing_old)==1, 'Inspector casting gate changed'
source=source.replace(timing_old,
    "const castable=!g.autoPilot&&(p.hand.some(x=>equalName(x,name))||cmd)&&(app.nativeMatch?ctNativeTiming(c).allowed:canCast(p,c,cmd));")
browser_old="const playable=app.nativeMatch||canCast(p,c),canPlay=app.nativeMatch?true:playable&&c.implemented&&!app.game?.autoPilot;"
assert source.count(browser_old)==1, 'Hand browser gate changed'
source=source.replace(browser_old,
    "const timing=ctNativeTiming(c);const playable=app.nativeMatch?timing.allowed:canCast(p,c),canPlay=app.nativeMatch?timing.allowed:playable&&c.implemented&&!app.game?.autoPilot;")
# Do not present a mana/phase error when the rules engine rejected a cast for
# another reason; show the strictly local timing hint only.
foot_old="!c.implemented?'Deck-only card':'Not enough mana or wrong phase'"
assert source.count(foot_old)==1
source=source.replace(foot_old,
    "!c.implemented?'Deck-only card':app.nativeMatch?(timing.reason||'Forge checks mana and legality'):'Not enough mana or wrong phase'")

# Note: explicit user actions (menu/pod/modal) still render immediately;
# only authoritative Forge updates are coalesced.


# Native UX corrections: local inspection must never be forwarded as a
# numeric card selection. Forge is authoritative for drag/drop.
inspect_case = r""" case 'inspectBoardPermanent':{
   const [seat,uid]=String(v||'').split(':',2);
   const owner=Number(seat);
   const perm=app.game?.players?.[owner]?.battlefield?.find(c=>String(c.uid)===uid);
   if(!perm){ctNativeToast('This card is no longer on the battlefield');break;}
   app.inspect=perm.name;app.sideInspect=perm.name;
   app.inspectForgeId=Number.isInteger(Number(perm.forgeId))?Number(perm.forgeId):null;
   app.inspectOwner=owner;app.selectedCard=perm.name;
   if(!matchMedia('(orientation:landscape)').matches)app.modal='inspect';
   render();break;
  }
  case 'toggleZones':app.zonesOpen=!app.zonesOpen;render();break;
  case 'permanent':"""
assert source.count(" case 'permanent':")==1
source=source.replace(" case 'permanent':",inspect_case)
old_target="action:app.nativeMatch?'permanent':(app.pendingCast?(targetable?'chooseCastTarget':'inspect'):(mine?'permanent':'inspect')),value:app.nativeMatch?x.uid:(app.pendingCast&&targetable?target:mine?x.uid:c.name)"
assert source.count(old_target)==1, 'Battlefield card mapping changed'
new_target="""action:app.nativeMatch?((window.ctForgeSelection?.isLegalCard?.(x.forgeId)||(idx===0&&window.ctForgePriority?.isManaPayment&&!x.tapped&&(x.land||/Artifact/i.test(String(card(x.name)?.type||'')))))?'cardId':'inspectBoardPermanent'):(app.pendingCast?(targetable?'chooseCastTarget':'inspect'):(mine?'permanent':'inspect')),value:app.nativeMatch?((window.ctForgeSelection?.isLegalCard?.(x.forgeId)||(idx===0&&window.ctForgePriority?.isManaPayment&&!x.tapped&&(x.land||/Artifact/i.test(String(card(x.name)?.type||'')))))?String(x.forgeId):idx+':'+x.uid):(app.pendingCast&&targetable?target:mine?x.uid:c.name)"""
source=source.replace(old_target,new_target)
# The player sees the card on first tap; interacting with the permanent
# is a separate, deliberate action through its authoritative Forge ID.
preview_anchor='<button class="secondary" data-action="inspectFull" data-value="'+chr(36)+'{esc(c.name)}">Full details</button>'
assert source.count(preview_anchor)==1
activate='<span class="ct-native-permanent-action">'+chr(36)+'{app.nativeMatch&&app.inspectOwner===0&&Number.isInteger(app.inspectForgeId)&&app.game?.players?.[0]?.priority?`<button class="secondary" data-action="cardId" data-value="'+chr(36)+'{app.inspectForgeId}">Activate / interact ↗</button>`:""}</span>'
source=source.replace(preview_anchor,activate+preview_anchor)
# Native game.command resolves the drag, never simulator beginCastFromDrag.
old_drop="if(e.clientY < innerHeight-155&&d.y-e.clientY>42)beginCastFromDrag(d.commander,d.index);"
assert source.count(old_drop)==1, 'Native drag handler changed'
new_drop="""if(e.clientY < innerHeight-155&&d.y-e.clientY>42){
  if(app.nativeMatch){
    const index=d.commander?-1:d.index;
    const me=app.game?.players?.[0];
    const stableId=d.commander
      ? (me?.commandZone?.find(c=>c.commander)?.id ?? me?.commandZone?.[0]?.id)
      : me?.handForgeIds?.[index];
    if(!Number.isInteger(Number(stableId))) {
      ctNativeToast('Card is no longer in your hand or command zone');
      return;
    }
    void CommandTableNative.request('game.command',{action:'castById',value:stableId})
      .then(async()=>{
        try{const snap=await CommandTableNative.request('game.snapshot');
          if(snap?.game)ctReceiveForgeState(snap.game);}catch(_){}
      })
      .catch(error=>ctNativeToast('Could not play that card: '+(error?.message||String(error))));
  }else beginCastFromDrag(d.commander,d.index);
}"""
source=source.replace(old_drop,new_drop)
assert source.count("case 'toggleHandZoom':app.handZoom=!app.handZoom;render();break;")==1


# Dedicated battlefield zones: creatures mid-board, lands at the back,
# artifacts/enchantments/planeswalkers to the right. Commander and secondary
# zones live in a collapsible left drawer; never remove Forge permanents.
old_lane=""" const isCreat=type==='creatures';
 const perms=p.battlefield.filter(x=>isCreature(card(x.name))===isCreat);"""
assert source.count(old_lane)==1
source=source.replace(old_lane, """ const isCreat=type==='creatures';
 const perms=p.battlefield.filter(x=>{
  const c=card(x.name),kind=String(c?.type||'');
  const creature=x.creature===undefined?isCreature(c):x.creature;
  const land=x.land===undefined?/\\bLand\\b/i.test(kind):x.land;
  return type==='creatures'?creature:type==='lands'?land:!creature&&!land;
 });""")
old_zone="@@DLR@@{isCreat?'Creatures':'Lands & support'}"
assert source.count(old_zone.replace('@@DLR@@',chr(36)))==1
source=source.replace(old_zone.replace('@@DLR@@',chr(36)),
  chr(36)+"{type==='creatures'?'Creatures':type==='lands'?'Lands':'Artifacts · Enchantments · Planeswalkers'}")
assert source.count("""<div class="ct10-opp-support">@@D@@{immersiveLane(enemy,focus,'support')}</div>""".replace('@@D@@',chr(36)))==1
source=source.replace("""<div class="ct10-opp-support">@@D@@{immersiveLane(enemy,focus,'support')}</div>""".replace('@@D@@',chr(36)),
  """<div class="ct10-opp-lands">@@D@@{immersiveLane(enemy,focus,'lands')}</div>
   <div class="ct10-opp-support">@@D@@{immersiveLane(enemy,focus,'support')}</div>""".replace('@@D@@',chr(36)))
assert source.count("""<div class="ct10-own-support">@@D@@{immersiveLane(me,0,'support')}</div>""".replace('@@D@@',chr(36)))==1
source=source.replace("""<div class="ct10-own-support">@@D@@{immersiveLane(me,0,'support')}</div>""".replace('@@D@@',chr(36)),
  """<div class="ct10-own-lands">@@D@@{immersiveLane(me,0,'lands')}</div>
   <div class="ct10-own-support">@@D@@{immersiveLane(me,0,'support')}</div>""".replace('@@D@@',chr(36)))
scene_head='<div class="ct10-scene" data-dropzone="battlefield">'
assert source.count(scene_head)==1
drawer=r"""<div class="ct10-zone-rail @@D@@{app.zonesOpen?'ct-zones-open':''}">
  <button class="ct-zone-toggle" data-action="toggleZones" aria-expanded="@@D@@{!!app.zonesOpen}" aria-label="Show command zone, graveyard, exile and library">☰ Zones</button>
  <aside class="ct10-zone-drawer">
   <strong>YOUR ZONES</strong>
   <div>♛ Commander <span>@@D@@{esc(me.commander.split(',')[0])}</span></div>
   <div>↻ Commander tax <b>@@D@@{Number(me.commanderCasts||0)*2}</b></div>
   <div>▤ Library <b>@@D@@{me.library.length}</b></div>
   <div>♜ Graveyard <b>@@D@@{me.graveyard.length}</b></div>
   <div>◇ Exile <b>@@D@@{me.exile.length}</b></div>
  </aside>
 </div>""".replace('@@D@@',chr(36))
source=source.replace(scene_head,scene_head+drawer)
# Native selection model decides which hand and battlefield cards can be
# selected *now*. No JavaScript mana guess is allowed to claim legality.
availability="available:!g.autoPilot&&!app.nativeMatch&&canCast(me,c)"
assert source.count(availability)==1
source=source.replace(availability,
  "available:app.nativeMatch?!!window.ctForgeSelection?.isLegalCard?.(me.handForgeIds?.[i]):!g.autoPilot&&canCast(me,c)")
# Make owner/inspection explicit when selecting a hand card, so an old
# permanent's Activate button cannot appear on an unrelated card preview.
assert source.count("case 'selectHand':if(!p?.hand?.length)break;")==1
source=source.replace("case 'selectHand':if(!p?.hand?.length)break;",
 "case 'selectHand':app.inspectForgeId=null;app.inspectOwner=null;if(!p?.hand?.length)break;")
# Render native state above any stale training-only metadata warning.
assert source.count('function immersiveInspect(){')==1
source=source.replace('function immersiveInspect(){',
 'function immersiveInspect(){')
board_css="""<style id="ct-commander-board-zones-v0148">
.ct10-opp-lands,.ct10-own-lands{position:absolute;display:flex;align-items:center;min-width:0;min-height:0}
.ct10-opp-lands{left:11%;top:13%;width:32%;height:14%}
.ct10-opp-support{left:70%!important;top:13%!important;width:24%!important;height:14%!important}
.ct10-opp-creatures{left:32%!important;top:28%!important;width:56%!important}
.ct10-own-creatures{left:32%!important;top:49%!important;width:56%!important}
.ct10-own-lands{left:13%;top:69%;width:36%;height:14%}
.ct10-own-support{left:69%!important;top:67%!important;width:26%!important;height:14%!important}
.ct10-lane.ct10-lands{border-top:1px dashed #c4b07a37}
.ct10-lane.ct10-support{background:#132d2d55;border-radius:7px;border-right:2px solid #b7a77770}
.ct10-lane.ct10-support .game-card{width:clamp(42px,5.2vw,83px)!important}
.ct10-zone-rail{position:absolute;left:7px;top:36%;z-index:22;display:flex;align-items:flex-start;gap:7px;pointer-events:none}
.ct10-zone-rail button{pointer-events:auto}
.ct-zone-toggle{border:1px solid #b7a679;border-radius:9px;background:#132b32f0;color:#efdbaf;font-weight:800;padding:9px 7px;writing-mode:vertical-rl;font-size:11px;letter-spacing:1px}
.ct10-zone-drawer{display:none;background:#112830f8;border:1px solid #c4aa77;border-radius:12px;padding:12px;min-width:190px;max-width:220px;box-shadow:0 10px 30px #000b;pointer-events:auto;color:#fff2db;font-size:12px}
.ct-zones-open .ct10-zone-drawer{display:grid;gap:9px}
.ct10-zone-drawer strong{font-size:12px;letter-spacing:1px;color:#ecbf82}
.ct10-zone-drawer div{display:flex;justify-content:space-between;gap:8px}
.ct10-zone-drawer span{max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ct10-our-turn .ct10-phase-badge{border-color:#e8b971!important;color:#ffe0a8!important;box-shadow:0 0 16px #e8b9714b!important}
.ct10-their-turn .ct10-phase-badge{border-color:#81bddf!important;color:#a0d9ff!important;box-shadow:0 0 18px #4695d655!important}
.ct10-their-turn .ct10-focused-opponent{filter:drop-shadow(0 0 12px #56adf84b)}
.ct10-our-turn .ct10-own-player{filter:drop-shadow(0 0 12px #d6aa585e)}
.ct10-stage .game-card.available{outline:2px solid #5fd8fc!important;outline-offset:1px;box-shadow:0 0 19px #36bcf8a9!important}
@media(orientation:portrait){.ct10-opp-support,.ct10-own-support{left:75%!important;width:23%!important}.ct10-opp-lands,.ct10-own-lands{left:11%;width:38%}.ct10-zone-rail{top:39%}}
</style>"""
assert source.count('</head>')==1
source=source.replace('</head>',board_css+'</head>')

# The decorative centre star obscures cards in the combat row.
assert source.count('<span>✦</span>')==1, 'Centreboard ornament changed'
source=source.replace('<span>✦</span>','')


# Authoritative end-of-game feedback: the GameView signals completion; no
# player-side algorithm may decide when someone won or lost.
result_helper = r"""
function ctNativeEndOverlay(g) {
  if(!app.nativeMatch || !g?.native || g.winner===null)return '';
  const me=g.players?.[0],winner=String(g.winner||'').trim();
  const ownName=String(me?.forgeName||me?.name||'').trim();
  const won=!me?.dead && (winner.toLowerCase()===ownName.toLowerCase() ||
      g.players.slice(1).every(p=>p.dead));
  const lost=!!me?.dead || (winner && winner!=='Game ended' && !won);
  const title=won?'Victory!':lost?'Defeat':'Match finished';
  const subtitle=won?'Your Commander claimed the table.':
      lost?'The opposing Commander claimed the table.':'The Forge match has ended.';
  return @@BT@@<div class="ct-native-game-end" role="dialog" aria-modal="true" aria-label="@@D@@{title}">
     <div class="ct-native-result-card">
       <span class="ct-native-end-crest">@@D@@{won?'✦':lost?'◇':'✧'}</span>
       <span class="ct-native-end-label">COMMAND TABLE · MATCH COMPLETE</span>
       <h2>@@D@@{title}</h2><p>@@D@@{subtitle}</p>
       <div class="ct-native-final-life">You @@D@@{me?.life??0} ♥ <span>·</span> Turn @@D@@{g.turn}</div>
       <button class="primary" data-action="leaveFinishedGame">Back to decks / Play again</button>
     </div>
   </div>@@BT@@;
}
""".replace('@@BT@@',chr(96)).replace('@@D@@',chr(36))
assert source.count('function gameView(){')==1
source=source.replace('function gameView(){',result_helper+'\nfunction gameView(){')
assert source.count("  "+chr(36)+"{immersiveInspect()}")==1
source=source.replace("  "+chr(36)+"{immersiveInspect()}",
  "  "+chr(36)+"{immersiveInspect()}\n  "+chr(36)+"{ctNativeEndOverlay(g)}")
assert source.count("id:'P'+(i+1), forgeId:p.id, name:i===0?'You':p.name,")==1
source=source.replace("id:'P'+(i+1), forgeId:p.id, name:i===0?'You':p.name,",
  "id:'P'+(i+1), forgeId:p.id, forgeName:p.name, name:i===0?'You':p.name,")
assert source.count("case 'toggleZones':app.zonesOpen=!app.zonesOpen;render();break;")==1
source=source.replace("case 'toggleZones':app.zonesOpen=!app.zonesOpen;render();break;",
  "case 'leaveFinishedGame':{window.ctForgeChoice?.close?.();window.ctForgePriority?.reset?.();window.ctForgeSelection?.reset?.();app.nativeMatch=false;app.game=null;app.savedGame=null;setView('home');break;}\n  case 'toggleZones':app.zonesOpen=!app.zonesOpen;render();break;")
assert source.count("'toggleHandZoom','inspectBoardPermanent','toggleZones'")==1
source=source.replace("'toggleHandZoom','inspectBoardPermanent','toggleZones'",
                      "'toggleHandZoom','inspectBoardPermanent','toggleZones','leaveFinishedGame'")
result_css = """<style id="ct-game-complete-v0149">
.ct10-scene>.ct-native-game-end{z-index:999!important}
.ct-native-game-end{position:absolute;inset:0;z-index:999!important;display:flex;justify-content:center;align-items:center;background:#07131cd8;backdrop-filter:blur(7px);pointer-events:auto}
.ct-native-result-card{border:1px solid #e7b974;background:radial-gradient(circle at 50% -35%,#466c6880,#14282cef 62%);box-shadow:0 24px 80px #000e;border-radius:19px;padding:clamp(17px,3vw,38px);color:#f6ead4;text-align:center;width:min(90%,430px)}
.ct-native-end-crest{display:block;color:#eebd79;font-size:46px;text-shadow:0 0 20px #dbac8b}
.ct-native-end-label{font-size:10px;letter-spacing:2px;font-weight:800;color:#ddbe87}
.ct-native-result-card h2{margin:9px 0;font-family:Georgia,serif;font-size:clamp(35px,5vw,58px);color:#fff1d6}
.ct-native-result-card p{margin:9px 0 16px;font-size:15px}
.ct-native-final-life{display:flex;justify-content:center;gap:10px;font-size:14px;color:#e5cb9a;margin-bottom:20px}
.ct-native-result-card button{width:100%;padding:14px 12px;min-height:48px}
</style>"""
assert source.count('</head>')==1
source=source.replace('</head>',result_css+'</head>')


# Use Forge's explicit selection first. If no selection is published, display
# an advisory mana glow ONLY for costs payable by visible untapped basic lands
# and simple fixed mana costs. Forge still decides legal casting.
affordability_helper = r"""
function ctNativeAffordable(c,me,g){
 if(!app.nativeMatch||!c||!me||!g||!ctNativeTiming(c).allowed)return false;
 const type=String(c.type||'');
 if(/\bLand\b/i.test(type))return true;
 const raw=String(c.cost||'').toUpperCase().trim();
 if(!raw||raw.includes('X')||raw.includes('/')||raw.includes('P')||raw.includes('Y'))return false;
 const braceSymbols=[...raw.matchAll(/\{([^}]+)\}/g)].map(m=>m[1]);
 const symbols=braceSymbols.length?braceSymbols:(raw.match(/\d+|[WUBRGCS]/g)||[]);
 if(!symbols.length||symbols.some(x=>!/^(\d+|[WUBRGCS])$/.test(x)))return false;
 const mana=[];
 const basic={PLAINS:'W',ISLAND:'U',SWAMP:'B',MOUNTAIN:'R',FOREST:'G',WASTES:'C'};
 for(const perm of me.battlefield||[]){
   if(perm.tapped||!perm.land)continue;
   const name=String(perm.name||'').toUpperCase();
   const land=Object.entries(basic).find(([k])=>
     new RegExp('(^|[^A-Z])'+k+'($|[^A-Z])').test(name));
   if(land)mana.push(land[1]);
 }
 let generic=0;const colors=[];
 for(const symbol of symbols){
   if(/^\d+$/.test(symbol))generic+=Number(symbol);
   else if(symbol==='S')return false;
   else colors.push(symbol);
 }
 // Spend colored sources first, then check the generic remaining.
 for(const color of colors){
   const index=mana.indexOf(color);
   if(index<0)return false;
   mana.splice(index,1);
 }
 return mana.length>=generic;
}
"""
assert source.count('function gameView(){')==1
source=source.replace('function gameView(){',
  affordability_helper+'\nfunction gameView(){')
old_available="available:app.nativeMatch?!!window.ctForgeSelection?.isLegalCard?.(me.handForgeIds?.[i]):!g.autoPilot&&canCast(me,c)"
assert source.count(old_available)==1,'Native hand affordance changed'
source=source.replace(old_available,
  "available:app.nativeMatch?(!!window.ctForgeSelection?.isLegalCard?.(me.handForgeIds?.[i])||ctNativeAffordable(c,me,g)):!g.autoPilot&&canCast(me,c)")
# Correctness: neither highlights nor preview heuristics ever call Forge's
# controller or move a card. The existing native command remains sole writer.


# Expose the actual command zone and a dedicated Forge casting action.
# Never guess which hand index contains a commander.
commander_case="case 'castCommander':"
assert source.count("case 'toggleZones':app.zonesOpen=!app.zonesOpen;render();break;")==1
# Native actions are already intercepted by NATIVE_GAME_COMMANDS.
zone_line="   <div>♛ Commander <span>@@D@@{esc(me.commander.split(',')[0])}</span></div>".replace('@@D@@',chr(36))
assert source.count(zone_line)==1
cast_line="""   <div class="ct-commander-zone-card"><span>♛ @@D@@{esc(me.commander.split(',')[0])}</span>
     <button data-action="inspectCommander" aria-label="View commander">View</button>
     @@D@@{app.nativeMatch&&me.commandZone?.length?@@BT@@<button class="ct-cast-commander" data-action="castCommander" data-drag-commander="true" aria-label="Cast commander or drag onto battlefield from command zone">Cast commander ↗</button>@@BT@@:''}</div>""".replace('@@D@@',chr(36)).replace('@@BT@@',chr(96))
source=source.replace(zone_line,cast_line)
# A tap on the commander portrait should surface the command-zone preview,
# not a training-only card popup with no way to actually cast the card.
portrait="data-action=\"inspectCommander\"><img"
assert source.count(portrait)==1
source=source.replace(portrait,"data-action=\"inspectCommander\" title=\"Tap for commander actions\"><img")
# A commander may be in command zone but absent from hand; do not show a
# misleading cast affordance if Forge does not list that actual card.
inspector_old="const castable=!g.autoPilot&&(p.hand.some(x=>equalName(x,name))||cmd)&&(app.nativeMatch?ctNativeTiming(c).allowed:canCast(p,c,cmd));"
assert source.count(inspector_old)==1
inspector_new="""const castable=!g.autoPilot&&(p.hand.some(x=>equalName(x,name))||
      (app.nativeMatch?p.commandZone?.some(z=>equalName(z.name,name)):cmd))&&
      (app.nativeMatch?ctNativeTiming(c).allowed:canCast(p,c,cmd));"""
source=source.replace(inspector_old,inspector_new)
# In the modal inspector the castSelected button also resolves via stable
# card IDs in ctNativeActionValue.
commander_css="""<style id="ct-command-zone-v0150">
.ct-commander-zone-card{display:flex!important;align-items:center!important;flex-wrap:wrap;gap:6px!important}
.ct-commander-zone-card span{flex:1 1 100%;min-width:0;font-weight:700}
.ct-commander-zone-card button{flex:1;background:#203a41;color:#f7d9a3;border:1px solid #af976f;border-radius:8px;padding:8px 6px;font-size:11px;min-height:33px}
.ct-commander-zone-card .ct-cast-commander{background:#e2b36c;color:#172a2e;font-weight:800}
</style>"""
assert source.count('</head>')==1
source=source.replace('</head>',commander_css+'</head>')


# Surface Forge's current combat state clearly. This is a view on the actual
# CombatView / Selection data, not an independent attack/block rules system.
combat_helper=r"""
function ctNativeCombatGuide(g){
 if(!app.nativeMatch||!g||g.phase!=='combat')return '';
 const detail=String(g.phaseDetail||'').toUpperCase();
 const legal=window.ctForgeSelection?.legalCards||[];
 const atk=Array.isArray(g.combat)?g.combat:[];
 const defending=atk.some(x=>String(x.defenderId)===String(g.players?.[0]?.forgeId));
 const attackersStage=/ATTACKERS/.test(detail);
 const blockersStage=/BLOCKERS/.test(detail);
 const damageStage=/DAMAGE/.test(detail);
 const lines=atk.map(x=>{
   const defender=g.players?.find(p=>String(p.forgeId)===String(x.defenderId));
   const blockers=(x.blockerIds||[]).map(id=>
     g.players.flatMap(p=>p.battlefield).find(c=>String(c.forgeId)===String(id))?.name||
     'Blocker');
   return '<div class="ct-combat-pair"><span>⚔ '+esc(x.cardName||'Attacker')+
     '</span><b>→ '+esc(defender?.name||'target')+'</b>'+
     (blockers.length?'<small>🛡 '+esc(blockers.join(', '))+'</small>':'')+'</div>';
 }).join('');
 let title='Combat';
 let hint='Forge controls the attack and blocking steps.';
 if(attackersStage){
   title=g.active===0?'Declare attackers':'Opponent declaring attackers';
   hint=g.active===0
     ? 'Tap a glowing creature or drag it to an opponent. Undo retracts; Next confirms.'
     : 'Opponents choose attackers. Watch the highlighted cards and attack targets.';
 }else if(blockersStage){
   title=defending?'Defend — declare blockers':'Declare blockers';
   hint=defending
     ? 'Tap an attacking creature, then one or more blockers; alternatively drag blockers onto attackers.'
     : 'The defending player chooses blockers. Your attacking creatures are shown below.';
 }else if(damageStage){
   title='Combat damage';
   hint='Review attacking creatures and blockers. Resolve to apply damage in Forge.';
 }else if(atk.length){
   title=defending?'You are under attack':'Attack in progress';
   hint='Attacker → defender. Any blockers are shown beneath each attack.';
 }
 // Avoid covering opponent creatures and lands during attack/block decisions.
 // The small contextual Forge action dock provides the phase instruction.
 if(attackersStage||blockersStage)return '';
 return '<aside class="ct-native-combat-guide" role="status" aria-label="Combat step">'+
   '<header><span>⚔ '+esc(title)+'</span></header>'+
   '<p>'+esc(hint)+'</p>'+
   (lines?'<div class="ct-combat-pairs">'+lines+'</div>':'')+
   '</aside>';
}
"""
assert source.count('function gameView(){')==1
source=source.replace('function gameView(){',combat_helper+'\nfunction gameView(){')
needle='<div class="ct10-midline @@D@@{attack?@@BT@@ct10-midline-combat@@BT@@:@@BT@@@@BT@@}">'.replace('@@D@@',chr(36)).replace('@@BT@@',chr(96))
# Keep guidance within the scene and outside individual card lanes.
assert source.count('<div class="ct10-midline ')==1
source=source.replace('<div class="ct10-midline ',
  chr(36)+'{ctNativeCombatGuide(g)}\n   <div class="ct10-midline ',1)
# Distinguish actively attacking or defending cards without changing Forge
# tap semantics. These styles also work in multiplayer.
orig='return smallCard(c,{tapped:x.tapped,token:!!x.token,counters:x.counters,bonus,selected:'
assert source.count(orig)==1
source=source.replace(orig,
 'return smallCard(c,{tapped:x.tapped,token:!!x.token,attacking:!!x.attacking,blocking:!!x.blocking,counters:x.counters,bonus,selected:')
card_class="opts.selected?'chosen':'',opts.available?'available':''"
assert source.count(card_class)==1
source=source.replace(card_class,
  "opts.selected?'chosen':'',opts.attacking?'ct-native-attacker':'',opts.blocking?'ct-native-blocker':'',opts.available?'available':''")
combat_css="""<style id="ct-forge-combat-guidance-v0150">
.ct-native-combat-guide{position:absolute;z-index:19;top:14%;left:1.4%;width:clamp(185px,29vw,380px);max-height:31%;overflow:auto;background:#0e2530ed;border:1px solid #d9a96d9e;border-left:3px solid #f4b368;border-radius:11px;padding:9px 11px;color:#f9efd9;pointer-events:auto;box-shadow:0 9px 28px #0009}
.ct-native-combat-guide header{display:flex;align-items:center;justify-content:space-between;gap:7px;font-weight:850;font-size:clamp(11px,1.1vw,15px);color:#ffd39b}
.ct-native-combat-guide header small{font-size:10px;color:#a8c6c9;font-weight:600;text-align:right}
.ct-native-combat-guide p{margin:5px 0 0;color:#e7ddcd;font-size:clamp(10px,.95vw,13px);line-height:1.35}
.ct-combat-pairs{display:grid;gap:4px;max-height:78px;overflow:auto;margin-top:8px}
.ct-combat-pair{display:flex;align-items:center;flex-wrap:wrap;gap:5px;font-size:11px;border-top:1px solid #bfa57739;padding-top:3px}
.ct-combat-pair b{color:#ffcc89;font-weight:700}
.ct-combat-pair small{color:#8bd6e5;flex-basis:100%;padding-left:8px}
.ct10-lane .game-card.ct-native-attacker{outline:3px solid #ffad54!important;outline-offset:2px;box-shadow:0 0 18px #fb903cdd!important}
.ct10-lane .game-card.ct-native-blocker{outline:3px solid #7bd9ff!important;outline-offset:2px;box-shadow:0 0 18px #7bd9ffbc!important}
.ct10-lane .game-card.ct-forge-legal-target{outline:3px solid #c1f9ff!important;outline-offset:3px;box-shadow:0 0 23px #61d7f5dd!important;animation:ct-combat-legal 1.6s ease-in-out infinite alternate}
@keyframes ct-combat-legal{from{filter:brightness(1)}to{filter:brightness(1.24)}}
@media(max-height:550px) and (orientation:landscape){.ct-native-combat-guide{top:13%;max-height:27%;width:clamp(170px,24vw,310px);padding:6px 9px}.ct-native-combat-guide p{font-size:11px}}
@media(orientation:portrait){.ct-native-combat-guide{left:2%;top:14%;width:45%;max-height:27%}}
</style>"""
assert source.count('</head>')==1
source=source.replace('</head>',combat_css+'</head>')


# Fix the on-device affordance mismatch: untapped mana rocks are absent from
# the visual mana estimate even when Forge can tap them during a cast.
# This preview is conservative and *not* a replacement for Forge legality.
rocks_old="""  if(land)mana.push(land[1]);
 }
 let generic=0;const colors=[];"""
assert source.count(rocks_old)==1
source=source.replace(rocks_old,"""  if(land) {mana.push(land[1]);continue;}
   const key=String(perm.name||'').trim().toLowerCase();
   // Artifacts are only counted untapped and when the card itself is not a
   // creature. Colored-rock legality remains in Forge.
   if(perm.creature)continue;
   if(key==='sol ring')mana.push('C','C');
   else if(['arcane signet','commanders sphere',"commander's sphere",
       'chromatic lantern'].includes(key))mana.push('*');
   else if(['mind stone','thought vessel','prismatic lens',
       'everflowing chalice','war room'].includes(key))mana.push('C');
 }
 let generic=0;const colors=[];""")
rock_colored="""   const index=mana.indexOf(color);
   if(index<0)return false;
   mana.splice(index,1);"""
assert source.count(rock_colored)==1
source=source.replace(rock_colored,"""   let index=mana.indexOf(color);
   if(index<0)index=mana.indexOf('*');
   if(index<0)return false;
   mana.splice(index,1);""")
# Avoid false confidence on unconventional sources; the only green glow is
# affordable-as-shown, with actual game choices still Forge-authoritative.

# A commander starts in the LEFT drawer rather than the bottom hand; the
# old hand drag gesture only accepted upward movement, so dragging the
# commander rightward onto the battlefield never committed.
commander_drop="if(e.clientY < innerHeight-155&&d.y-e.clientY>42){"
assert source.count(commander_drop)==1
source=source.replace(commander_drop,
  "if((e.clientY < innerHeight-155&&d.y-e.clientY>42) || (d.commander && e.clientX-d.x>80 && e.clientY<innerHeight-90)){")

# The legacy JS attack list is empty during native Forge play. Use the
# authoritative Selection.chosen IDs for clear selected-attacker/blocker state.
old_selected="selected:mine&&app.attackers.includes(x.uid)"
assert source.count(old_selected)==1
source=source.replace(old_selected,
  "selected:app.nativeMatch?!!window.ctForgeSelection?.isSelectedCard?.(x.forgeId):mine&&app.attackers.includes(x.uid)")

# v0.16: make opponent badges and pod seats Forge targeting surfaces.
import re
dollar=chr(36)
for class_name in ('ct10-opponent-badge','ct-pod-seat'):
    pattern=r'(<div class="'+class_name+r' [^"]+)(">)'
    assert len(re.findall(pattern,source))==1, 'Player marker not found: '+class_name
    source=re.sub(pattern,r'\1 data-ct-forge-player-id="'+dollar+r'{p.forgeId}"\2',source,count=1)
# The defender may be the human player, not only one of the opponents.
assert source.count('<div class="ct10-own-player">')==1
source=source.replace('<div class="ct10-own-player">',
    '<div class="ct10-own-player" data-ct-forge-player-id="'+dollar+'{me.forgeId}">')
# A player-target action must never fall through to the training simulator.
native_set="'permanent','cardId','castCommander','castById'"
assert source.count(native_set)==1, 'Native command allowlist changed'
source=source.replace(native_set,
    "'permanent','cardId','selectPlayer','castCommander','castById'")
assert source.count('</head>')==1
source=source.replace('</head>',"""<style id="ct-legal-defender-v0160">
.ct10-opponent-badge.ct-forge-legal-player,
.ct-pod-seat.ct-forge-legal-player{
 border:2px solid #66d7fa!important;
 box-shadow:0 0 17px #50d0fdac!important;
 cursor:pointer}
</style></head>""")

# v0.19: restoring predictable tap-to-preview. All hand cards keep
# the original selectHand action as a fallback. forge-simple-cast.js
# intercepts the click to open the centered Cast/Cancel view.
quick_hand="smallCard(c,{action:'selectHand',value:String(i),dragIndex:"
assert source.count(quick_hand)==1, 'Hand card renderer changed'
# The legacy training-card database can return a stale 'Not simulated'
# message while the embedded Forge engine is already playing that card.
# Avoid claiming a fully simulated Forge card is deck-building-only.
unknown_inspect="esc(c.text||c.type||'')"
assert source.count(unknown_inspect)==1, 'Card inspector text renderer changed'
source=source.replace(unknown_inspect,
  "esc(app.nativeMatch&&!c.implemented?'Card text is loading; Forge handles the rules.':(c.text||c.type||''))")

# Keep casting to ONE explicit path for this stability release. Remove
# hand/command-zone drag-to-cast affordances from the generated HTML.
# The combat drag gestures remain unaffected.
hand_drag="dragIndex:g.autoPilot?undefined:i"
assert source.count(hand_drag)==1, 'Hand markup drag reference changed'
source=source.replace(hand_drag,"dragIndex:undefined")
assert source.count('data-drag-commander="true"')==2
source=source.replace('data-drag-commander="true"','')
# v0.19: no one-tap cast. Card taps always open the centered preview;
# only its Cast button submits an authoritative Forge card ID.
assert source.count(quick_hand)==1
ux_css="""<style id="ct-arena-flow-v018">
.ct-native-stack.ct-stack-compact{right:2%!important;top:18%!important;
 width:clamp(140px,20vw,265px)!important;max-height:40dvh!important;
 padding:0!important;overflow:auto!important;z-index:10!important;
 background:#112631dc!important}
.ct-native-stack.ct-stack-compact summary{display:flex;gap:6px;align-items:center;
 padding:9px 11px;cursor:pointer;list-style:none;color:#e7f4eb;
 font-size:11px;font-weight:750;white-space:nowrap;overflow:hidden}
.ct-native-stack.ct-stack-compact summary::-webkit-details-marker{display:none}
.ct-native-stack.ct-stack-compact summary span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis}
.ct-native-stack.ct-stack-compact ol{padding:0 7px 9px!important;max-height:29dvh;overflow:auto}
#ct-forge-priority-buttons{box-shadow:0 5px 19px #0008!important}
#ct-forge-priority-buttons button{touch-action:manipulation}
.ct10-stage .ct10-hand-slot .game-card.available{outline:2px solid #64d8ef!important;box-shadow:0 0 13px #40bedea3!important}
.ct10-stage .ct10-lane .game-card.ct-forge-legal-target{cursor:pointer}
</style>"""
assert source.count('</head>')==1
source=source.replace('</head>',ux_css+'</head>')

# Forge auto mana is on by default for Arena-like casting, but optional.
# Only an ENABLED "Auto" button from Forge may trigger a payment.
assert source.count('window.CommandTableAction = action;')==1
source=source.replace('window.CommandTableAction = action;',
 """window.CommandTableAction = action;
try{window.ctAutoMana=localStorage.getItem('ct-auto-mana')!=='off';}
catch(_){window.ctAutoMana=true;}""")
auto_button='<button class="secondary full" data-action="viewHistory">Match history</button>'
assert source.count(auto_button)==1
source=source.replace(auto_button,
  '<button class="secondary full" data-action="toggleAutoMana">Auto-tap mana: '+
  chr(36)+'{window.ctAutoMana?"On":"Off"}</button>'+auto_button)
native_allow="'toggleHandZoom','inspectBoardPermanent','toggleZones','leaveFinishedGame'"
assert source.count(native_allow)==1
source=source.replace(native_allow,
  "'toggleHandZoom','inspectBoardPermanent','toggleZones','leaveFinishedGame','toggleAutoMana'")
zone_case="case 'toggleZones':app.zonesOpen=!app.zonesOpen;render();break;"
assert source.count(zone_case)==1
source=source.replace(zone_case,
  """case 'toggleAutoMana':{
    window.ctAutoMana=!window.ctAutoMana;
    try{localStorage.setItem('ct-auto-mana',window.ctAutoMana?'on':'off');}catch(_){}
    render();break;
  }
  """+zone_case)

# v0.21: Select mulligan cards in Forge and keep the stack inspector dismissible.
inspector_fallback="const g=app.game,name=app.sideInspect||g.stack.at(-1)?.name;"
assert source.count(inspector_fallback)==1, 'Inspector template changed'
source=source.replace(inspector_fallback,
  "const g=app.game,name=app.nativeMatch?app.sideInspect:(app.sideInspect||g.stack.at(-1)?.name);")
# When the mulligan controller reports chosen card IDs, highlight those
# exact cards in hand. Do not fall back to the simulator's app.selected.
hand_selection="selected:app.selected===i,available:"
assert source.count(hand_selection)==1, 'Hand selection template changed'
source=source.replace(hand_selection,
  "selected:app.nativeMatch?!!window.ctForgeSelection?.isSelectedCard?.(me.handForgeIds?.[i]):app.selected===i,available:")
ribbon="Tap to inspect · Drag to cast"
assert source.count(ribbon)==1, 'Hand ribbon template changed'
source=source.replace(ribbon,
  '${app.nativeMatch&&window.ctForgePriority?.isBottoming?"Tap cards to bottom · Press OK":"Tap to inspect · Open to cast"}')

# v0.22: The public graveyard/exile zones were only counters. Add readable
# cards without executing any game action or changing Forge's rules.
grave_anchor='<div>♜ Graveyard <b>'+chr(36)+'{me.graveyard.length}</b></div>'
exile_anchor='<div>◇ Exile <b>'+chr(36)+'{me.exile.length}</b></div>'
assert source.count(grave_anchor)==1 and source.count(exile_anchor)==1, 'Zones drawer changed'
source=source.replace(grave_anchor,
    '<button type="button" class="ct-zone-entry" data-ct-zone-view="graveyard" aria-label="Browse your graveyard">♜ Graveyard <b>'+chr(36)+'{me.graveyard.length}</b></button>')
source=source.replace(exile_anchor,
    '<button type="button" class="ct-zone-entry" data-ct-zone-view="exile" aria-label="Browse your exile">◇ Exile <b>'+chr(36)+'{me.exile.length}</b></button>')
source=source.replace('</head>',"""<style id="ct-zone-readable">
.ct10-zone-drawer .ct-zone-entry{display:flex;justify-content:space-between;gap:10px;width:100%;border:1px solid #bd9e694f;background:#28434b85;border-radius:9px;color:#fbe8c8;padding:10px 8px;cursor:pointer;font:650 12px system-ui;touch-action:manipulation}
.ct10-zone-drawer .ct-zone-entry:active{background:#486572}
</style></head>""")
# A mandatory discard also requires hand taps to reach Forge. The native
# prompt and Selection own the exact number of cards and confirmation.
old_hint=chr(36)+'{app.nativeMatch&&window.ctForgePriority?.isBottoming?"Tap cards to bottom · Press OK":"Tap to inspect · Open to cast"}'
new_hint=chr(36)+'{app.nativeMatch&&window.ctForgePriority?.isHandChoice?(window.ctForgePriority?.handInstruction||"Tap cards to select · Press OK"):"Tap to inspect · Open to cast"}'
assert source.count(old_hint)==1, 'Native hand ribbon changed'
source=source.replace(old_hint,new_hint)

# v0.24: landscape-only matches, startup card art and real Forge AI watch seat.
import re
visual_js=(Path(__file__).resolve().parent.parent / 'web' / 'forge-landscape-ui.js').read_text()
assert source.count('</body>')==1
source=source.replace('</body>','<script>\n'+visual_js+'\n</script></body>')
assert source.count("app.nativeMatch=true;app.notice='Starting Forge Commander match…';render();")==1
source=source.replace("app.nativeMatch=true;app.notice='Starting Forge Commander match…';render();",
                      "app.nativeMatch=true;window.ctMatchLoading?.show();app.notice='Starting Forge Commander match…';render();")
landscape_gate="const mode=app.view==='game' && app.landscapeMatches?'landscape':'portrait';"
assert source.count(landscape_gate)==1
source=source.replace(landscape_gate,
    "const mode=(app.view==='game'||window.ctMatchLoading?.active)?'landscape':'portrait';")
render_end="root.innerHTML=shell(view);syncNativeOrientation();scheduleAuto();}"
assert source.count(render_end)==1
source=source.replace(render_end,
    "root.innerHTML=shell(view);syncNativeOrientation();scheduleAuto();if(app.view==='game')window.ctMatchLoading?.ready();if(app.nativeMatch&&app.autoPilot)ctWatchForgeMatch();}")
source,n1=re.subn(r'<button data-action="rotateMatch" aria-label="Rotate battlefield"[^<]*</button>','',source)
assert n1==1, 'Top game rotation control changed'
source,n2=re.subn(r'<button class="secondary full" data-action="rotateMatch">.*?</button>','',source)
assert n2==1, 'Match options rotation control changed'
source,n3=re.subn(r'<div class="ct-orientation-choice"><span>Game screen</span>.*?</div>',
                  '<div class="ct-orientation-choice"><span>Game screen</span><strong>Landscape during matches</strong></div>',source)
assert n3==1, 'Setup orientation preference changed'
assert source.count("case 'rotateMatch':app.landscapeMatches=!app.landscapeMatches;")==1
source=source.replace("case 'rotateMatch':app.landscapeMatches=!app.landscapeMatches;",
                      "case 'rotateMatch':app.landscapeMatches=true;")
source=source.replace("active===me&&!g.autoPilot?'ct10-our-turn':'ct10-their-turn'",
                      "active===me?'ct10-our-turn':'ct10-their-turn'")
watch_disabled=chr(36)+"""{CommandTableNative.ready?'disabled title="Requires a separate AI human controller"':''}"""
assert source.count(watch_disabled)>=1, 'Watch mode flag changed'
source=source.replace(' '+watch_disabled,'')
# Prior patch versions may or may not contain the old simulator reset.
source=source.replace("app.autoPilot=false;","",1)
assert source.count("function scheduleAuto(){")==1
source=source.replace("function scheduleAuto(){","function scheduleAuto(){if(app.nativeMatch)return;")
assert source.count("autoPilot:false, autoPaused:false,")==1
source=source.replace("autoPilot:false, autoPaused:false,",
                      "autoPilot:!!ps[0]?.cpu, autoPaused:false,")
source,n4=re.subn(r'<button class="secondary full" data-action="toggleAutoPilot">.*?</button>',
  '<p class="ct-watch-mode-note">Watch mode is selected before the match; changing controllers requires a new match.</p>',source)
assert n4==1, 'Native watch mode option changed'
source=re.sub(r"(app\.nativeMatch=false;)(\s*announce\('Forge match start timed out)",
              r"\1window.ctMatchLoading?.hide();\2",source)
# Catch errors when a deck is rejected rather than leaving the loading veil visible.
error_catch=".catch(error=>{app.nativeMatch=false;announce("
assert source.count(error_catch)==1, 'Forge startup error handler changed'
source=source.replace(error_catch,
  ".catch(error=>{app.nativeMatch=false;window.ctMatchLoading?.hide();announce(")
poller=r"""
let ctForgeWatchPolling=false;
async function ctWatchForgeMatch(){
 if(ctForgeWatchPolling || !app.nativeMatch || !app.autoPilot || app.view!=='game')return;
 ctForgeWatchPolling=true;
 try{
  while(app.nativeMatch && app.autoPilot && app.view==='game' && app.game?.winner===null){
   await new Promise(done=>setTimeout(done,900));
   if(!app.nativeMatch||!app.autoPilot||app.view!=='game')break;
   try{
    const state=await CommandTableNative.request('game.snapshot');
    if(state?.game)ctReceiveForgeState(state.game);
   }catch(error){ /* A transition between games may temporarily lack a view. */ }
  }
 }finally{ctForgeWatchPolling=false;}
}
"""
assert source.count("function ctReceiveForgeState(state) {")==1
source=source.replace("function ctReceiveForgeState(state) {",poller+"\nfunction ctReceiveForgeState(state) {")


# v0.25: native match menus must dispatch navigation/help; never fall into
# Forge's gameplay guard. All events are UI-only and cannot alter game rules.
menu_allow="'viewHistory','helpCurrent','back'"
assert source.count(menu_allow)==1, 'Native menu guard changed'
source=source.replace(menu_allow,
    "'viewHistory','allHelp','showTutorial','helpTopic','tutorialNext','tutorialBack','closeTutorial','dismissLesson','resetTips','helpCurrent','back'")
# The modal's history was reading the JS training simulation's empty log
# (native GameViews intentionally contain no JS move log).
history_expr="(app.game?.log||[]).map(t=>"
assert source.count(history_expr)==1, 'Match history template changed'
source=source.replace(history_expr,
    "(app.nativeMatch?(window.ctForgeMatchHistory||[]):(app.game?.log||[])).map(t=>")
# Only events actually visible in Forge's authoritative GameView are recorded.
# We do not infer spells, targets, rules or outcomes from the browser.
history_runtime=r"""
window.ctForgeMatchHistory=window.ctForgeMatchHistory||[];
function ctRecordNativeHistory(previous,current){
 if(!current?.native)return;
 const history=window.ctForgeMatchHistory;
 const log=text=>{if(history[0]!==text)history.unshift(text);if(history.length>70)history.length=70;};
 if(!previous?.native){
  log('Commander match started');
  return;
 }
 if(current.turn!==previous.turn||current.active!==previous.active){
  log('Turn '+current.turn+' · '+(current.players?.[current.active]?.name||'Player')+' active');
 }
 for(let i=0;i<(current.players?.length||0);i++){
  const now=current.players[i],before=previous.players?.[i];
  if(!before)continue;
  if(now.life!==before.life)log(now.name+' · Life '+before.life+' → '+now.life);
  const old=new Set((before.battlefield||[]).map(c=>String(c.forgeId)));
  for(const card of now.battlefield||[]){
   if(!old.has(String(card.forgeId)))log(now.name+' · '+card.name+' entered battlefield');
  }
 }
 const earlier=new Set((previous.stack||[]).map(c=>String(c.id)));
 for(const item of current.stack||[])if(!earlier.has(String(item.id))){
  log('Stack · '+String(item.name||'Ability'));
 }
}
"""
assert source.count('function ctReceiveForgeState(state) {')==1
source=source.replace('function ctReceiveForgeState(state) {',
                      history_runtime+'\nfunction ctReceiveForgeState(state) {')
state_marker='  applyAuthoritativeGame(state);\n  // The animation layer'
assert source.count(state_marker)==1, 'State history insertion changed'
source=source.replace(state_marker,
                      '  applyAuthoritativeGame(state);\n  ctRecordNativeHistory(before,app.game);\n  // The animation layer')
start_marker="window.ctMatchLoading?.show();app.notice='Starting Forge Commander match…';render();"
assert source.count(start_marker)==1, 'Startup history reset changed'
source=source.replace(start_marker,
   "window.ctForgeMatchHistory=[];window.ctMatchLoading?.show();app.notice='Starting Forge Commander match…';render();")
# Focused landscape menus should not claim the Forge session is saved by the
# old training simulator. Help and modal dismissals must remain interactive.
source=source.replace('Matches save automatically on this device.',
                      'Forge is managing this match. You can return to the table at any time.')

# v0.26: keep the active opponent at the top of the table. Manual cycling
# remains available for inspecting other opponents during the current turn.
pod_focus_helper=r"""
function ctFocusActiveOpponent(previous,current){
 if(!current?.native || !Array.isArray(current.players))return;
 const active=Number(current.active);
 const valid=index=>Number.isInteger(index)&&index>0&&index<current.players.length
   &&!current.players[index]?.dead;
 const changed=!previous?.native || Number(previous.active)!==active ||
   Number(previous.turn)!==Number(current.turn);
 // Focus the active opponent on every seat/turn transition, even if the user
 // manually inspected another seat on the previous turn. Never steal focus
 // from manual inspection during the same turn.
 if(changed && valid(active)){
   app.focusPlayer=active;
   app.tableMode='focus';
   app.sideInspect=null;
 }else if(!valid(app.focusPlayer)){
   app.focusPlayer=current.players.findIndex((p,i)=>i>0&&!p.dead);
   if(app.focusPlayer<1)app.focusPlayer=1;
 }
}
"""
assert source.count("function ctReceiveForgeState(state) {")==1
source=source.replace("function ctReceiveForgeState(state) {",
                      pod_focus_helper+"\nfunction ctReceiveForgeState(state) {")
history_hook="  ctRecordNativeHistory(before,app.game);\n  // The animation layer"
assert source.count(history_hook)==1, 'Pod auto-focus insertion point changed'
source=source.replace(history_hook,
   "  ctRecordNativeHistory(before,app.game);\n  ctFocusActiveOpponent(before,app.game);\n  // The animation layer")
# Visible player badge comes from focused board. The active seat must be in
# focus whenever a Forge turn transition lands, but cycling within the turn
# must not mutate the Forge active player.

# Sol Pod brand system: keep existing data storage keys for backwards-compatible
# deck libraries. Only change visible identity and app icon.
brand_svg=(Path(__file__).resolve().parent.parent / 'branding' / 'sol-pod-mark.svg').read_text()
assert source.count('<span class="brand-icon">✦</span>')==1
source=source.replace('<span class="brand-icon">✦</span>',
    '<span class="brand-icon sol-pod-icon">'+brand_svg+'</span>')
source=source.replace('<strong>COMMAND TABLE</strong>','<strong>SOL POD</strong>')
source=source.replace('Commander, on your terms','Commander · Build · Play · Pods')
source=source.replace('<title>Command Table</title>','<title>Sol Pod</title>')
source=source.replace('Command Table loading…','Sol Pod loading…')
source=source.replace('YOUR COMMANDER TABLE','WELCOME TO SOL POD')
source=source.replace('Command Table is','Sol Pod is')
source=source.replace('</head>','''<style id="sol-pod-brand">
.brand-icon.sol-pod-icon{background:none!important;border:0!important;box-shadow:none!important;padding:0!important;overflow:visible!important}
.sol-pod-icon svg{display:block;width:100%;height:100%;max-width:100%;max-height:100%}
.brand strong{letter-spacing:1.4px}
</style></head>''')


# v0.27: Sol Pod three-zone battlefield. This runs after legacy layout patches.
pod_helpers=r"""
function solPodPermanentRows(p,idx,type){
 const perms=(p.battlefield||[]).filter(x=>{
  const c=card(x.name),kind=String(c?.type||'');
  const creature=x.creature===undefined?isCreature(c):x.creature;
  const land=x.land===undefined?/\bLand\b/i.test(kind):x.land;
  return type==='creatures'?creature:type==='lands'?land:!creature&&!land;
 });
 const labels={creatures:'CREATURES',support:'ARTIFACTS & ENCHANTMENTS',lands:'LANDS'};
 const icons={creatures:'⚔',support:'✧',lands:'◈'};
 return '<div class="sol-board-row '+(idx===0?'sol-own':'sol-opp')+' sol-'+type+'">'+
  '<div class="sol-zone-label"><span>'+icons[type]+'</span><strong>'+labels[type]+
  ' <small>('+perms.length+')</small></strong></div>'+immersiveLane(p,idx,type)+'</div>';
}
function solPodRoster(g,focus){
 return '<nav class="sol-roster" aria-label="Pod players">'+g.players.map((p,i)=>{
  const active=Number(g.active)===i,selected=focus===i;
  const label=i===0?'You':p.name||('AI '+i);
  const action=i===0?'inspectPlayer':'focusPlayer';
  return '<button type="button" data-action="'+action+'" data-value="'+i+'" '+
   'class="'+(active?'sol-roster-active ':'')+(selected?'sol-roster-focused ':'')+'" '+
   'aria-label="'+esc(label)+(active?' — active turn':'')+'" '+(p.dead?'disabled':'')+'>'+
   '<img data-art-name="'+esc(p.commander)+'" src="'+esc(artUrl(card(p.commander),"art_crop"))+
   '" alt="" onerror="this.style.display=\'none\'">'+
   '<strong>'+esc(label)+'</strong><span class="sol-roster-life">♥ '+p.life+'</span></button>';
 }).join('')+'</nav>';
}
"""
assert source.count("function gameView(){")==1
source=source.replace("function gameView(){",pod_helpers+"\nfunction gameView(){")
stage_fragment='<div class="ct-stage ct10-stage '
assert source.count(stage_fragment)==1
source=source.replace(stage_fragment,'<div class="ct-stage ct10-stage sol-battlefield ')
scene_fragment='<div class="ct10-scene" data-dropzone="battlefield">'
assert source.count(scene_fragment)==1
brand_marker='<div class="sol-game-brand">'+brand_svg+'<strong>SOL POD</strong></div>'
source=source.replace(scene_fragment,scene_fragment+brand_marker)
for which,owner,seat in [('opp','enemy','focus'),('own','me','0')]:
 for kind in ('creatures','support','lands'):
  original='<div class="ct10-'+which+'-'+kind+'">'+chr(36)+'{immersiveLane('+owner+','+seat+",'"+kind+"')}</div>"
  new=chr(36)+'{solPodPermanentRows('+owner+','+seat+",'"+kind+"')}"
  assert source.count(original)==1,'Cannot find battle lane '+which+' '+kind
  source=source.replace(original,new)
focus_badge='<div class="ct10-focused-opponent">'+chr(36)+'{immersiveOppBadge(enemy,focus)}</div>'
assert source.count(focus_badge)==1
source=source.replace(focus_badge,focus_badge+chr(36)+'{solPodRoster(g,focus)}')
zone_toggle='</button>\n  <aside class="ct10-zone-drawer">'
assert source.count(zone_toggle)==1,'Zones drawer structure changed'
zone_buttons=r"""</button>
  <div class="sol-zone-shortcuts">
   <button type="button" data-action="openHand"><span>♧ Hand</span><b>@@D@@{me.hand.length}</b></button>
   <button type="button" data-action="toggleZones"><span>▤ Library</span><b>@@D@@{me.library.length}</b></button>
   <button type="button" data-ct-zone-view="graveyard"><span>♜ Graveyard</span><b>@@D@@{me.graveyard.length}</b></button>
   <button type="button" data-ct-zone-view="exile"><span>✧ Exile</span><b>@@D@@{me.exile.length}</b></button>
   <button type="button" data-action="inspectCommander"><span>♛ Command</span><b>1</b></button>
  </div>
  <aside class="ct10-zone-drawer">""".replace('@@D@@',chr(36))
source=source.replace(zone_toggle,zone_buttons)
pod_style=(Path(__file__).resolve().parent.parent/'web'/'sol-pod-battlefield.js').read_text()
assert 'window.solPodBattlefield' in pod_style
assert source.count('</body>')==1
source=source.replace('</body>','<script>\n'+pod_style+'\n</script></body>')


# v0.28: readable symmetrical boards, protected deck deletion, immersive inspection.
import re
stage_prefix='<div class="ct-stage ct10-stage sol-battlefield '
assert source.count(stage_prefix)==1
source=source.replace(stage_prefix,stage_prefix+chr(36)+'{app.solRosterOpen?"sol-roster-expanded":""} sol-ai-'+chr(36)+'{Math.max(1,focus)} ')
assert source.count('<span class="ct10-phase-badge">')==1
source,n=re.subn(r'<span class="ct10-phase-badge">.*?</span>','',source,count=1)
assert n==1
focus_title='<div class="ct10-focused-opponent">'+chr(36)+'{immersiveOppBadge(enemy,focus)}</div>'
assert source.count(focus_title)==1
phase='<div class="sol-turn-detail">'+chr(36)+'{esc(active.name)} · '+chr(36)+'{esc(g.phase==="main1"?"Main phase":g.phase==="main2"?"Second main":g.phase.replace(/_/g," "))} · T'+chr(36)+'{g.turn}</div>'
source=source.replace(focus_title,
 '<div class="ct10-focused-opponent">'+chr(36)+'{immersiveOppBadge(enemy,focus)}'+phase+'</div>')
cycle_start='  '+chr(36)+'{!overview&&opponents.length>1?'
cycle_end='</div>'+chr(96)+':'+chr(39)*2+'}'
idx=source.find(cycle_start)
assert idx>=0,'Carousel marker missing'
end=source.find(cycle_end,idx)
assert end>=idx,'Carousel end missing'
source=source[:idx]+source[end+len(cycle_end):]
roster_start="'<nav class=\"sol-roster\" aria-label=\"Pod players\">'"
assert source.count(roster_start)==1
source=source.replace(roster_start,
  """'<nav class="sol-roster" aria-label="Pod players">'+
   '<button class="sol-roster-toggle" type="button" data-action="toggleSolRoster" aria-expanded="'+
   (!!app.solRosterOpen)+'">'+(app.solRosterOpen?'▣ Hide players':'☷ Players · '+g.players.length+' ▾')+'</button>'""")
act=" case 'toggleHandZoom':app.handZoom=!app.handZoom;render();break;"
assert source.count(act)==1
source=source.replace(act," case 'toggleSolRoster':app.solRosterOpen=!app.solRosterOpen;render();break;\n"+
 " case 'toggleHandZoom':app.handZoom=!app.handZoom;app.modal='';render();break;")
guard_marker="'toggleHandZoom','inspectBoardPermanent','toggleZones','leaveFinishedGame','toggleAutoMana'"
assert source.count(guard_marker)==1
source=source.replace(guard_marker,guard_marker+",'toggleSolRoster'")
old_inspection="app.inspectOwner=owner;app.selectedCard=perm.name;\n   if(!matchMedia('(orientation:landscape)').matches)app.modal='inspect';"
assert source.count(old_inspection)==1
source=source.replace(old_inspection,
 "app.inspectOwner=owner;app.selectedCard=perm.name;app.sideInspect=null;\n   app.modal='inspect';")
deck_wrap=r"""
function solDeckLibraryTile(d){
 return '<div class="sol-deck-tile-wrap">'+deckCard(d)+
 (d.prebuilt?'':'<button class="sol-deck-tile-delete" type="button" data-action="deleteDeckFromLibrary" data-value="'+
 esc(d.id)+'" aria-label="Delete '+esc(d.name)+'">Delete</button>')+'</div>';
}
"""
assert source.count('function decksView(){')==1
source=source.replace('function decksView(){',deck_wrap+'\nfunction decksView(){')
old_grid='<div class="deck-grid ct-deck-library-grid">'+chr(36)+'{ctSortedDecks(ctShowStarterDecks()).map(deckCard).join('+chr(39)+chr(39)+')}</div>'
assert source.count(old_grid)==1
source=source.replace(old_grid,
 '<div class="deck-grid ct-deck-library-grid">'+chr(36)+'{ctSortedDecks(ctShowStarterDecks()).map(solDeckLibraryTile).join('+chr(39)+chr(39)+')}</div>')
old_button='<button class="danger-btn" data-action="deleteDeck">Delete</button>'
assert source.count(old_button)==1
source=source.replace(old_button,
 chr(36)+'{!d.prebuilt?'+chr(96)+'<button class="danger-btn" data-action="deleteDeck">Delete deck</button>'+chr(96)+':""}')
old_delete=" case 'deleteDeck':{if(!window.confirm('Delete this deck from the device?'))break;app.decks=app.decks.filter(x=>x.id!==app.editing);app.matchDeck=app.decks[0]?.id;persist();setView('decks');break;}"
assert source.count(old_delete)==1
source=source.replace(old_delete,
 """ case 'deleteDeckFromLibrary':app.pendingDeleteDeckId=v;app.modal='confirmDeleteDeck';render();break;
 case 'deleteDeck':app.pendingDeleteDeckId=app.editing;app.modal='confirmDeleteDeck';render();break;
 case 'cancelDeleteDeck':app.pendingDeleteDeckId=null;app.modal='';render();break;
 case 'confirmDeleteDeck':{
  const target=app.decks.find(x=>x.id===app.pendingDeleteDeckId);
  if(!target||target.prebuilt){app.pendingDeleteDeckId=null;app.modal='';announce('Preinstalled decks are protected.');break;}
  app.decks=app.decks.filter(x=>x.id!==target.id);
  if(app.matchDeck===target.id)app.matchDeck=app.decks[0]?.id||null;
  if(app.editing===target.id)app.editing=null;
  app.pendingDeleteDeckId=null;app.modal='';persist();setView('decks');
  announce('Deleted '+target.name);break;
 }""")
modal_anchor=" if(app.modal==='restoreBackup'){"
assert source.count(modal_anchor)==1
source=source.replace(modal_anchor,
 """ if(app.modal==='confirmDeleteDeck'){
  const target=app.decks.find(d=>d.id===app.pendingDeleteDeckId);
  inside='<div class="sol-delete-confirm"><h2>Delete imported or custom deck?</h2><p>Delete '+
    '<strong>'+esc(target?.name||'this deck')+'</strong> from this device? This cannot be undone. '+
    'Other decks and your Forge card library will not be changed.</p>'+
    '<div class="sol-delete-actions"><button class="secondary" data-action="cancelDeleteDeck">Cancel</button>'+
    '<button class="danger-btn" data-action="confirmDeleteDeck" '+(!target||target.prebuilt?'disabled':'')+
    '>Delete deck</button></div></div>';
 }
"""+modal_anchor)
v28=(Path(__file__).resolve().parent.parent/'web'/'sol-pod-ui-v028.js').read_text()
assert 'window.solPodUi28' in v28
assert source.count('</body>')==1
source=source.replace('</body>','<script>\n'+v28+'\n</script></body>')


# Dense battlefields can be inspected at readable size without distorting
# tap/drag gestures on the main Forge battlefield. Both sides work identically.
label_start="'<div class=\"sol-zone-label\"><span>'+icons[type]"
label_end="' <small>('+perms.length+')</small></strong></div>'+immersiveLane(p,idx,type)"
assert source.count(label_start)==1 and source.count(label_end)==1
source=source.replace(label_start,
 """'<button type="button" class="sol-zone-label" data-action="zoomBoardRow" data-value="'+
 idx+':'+type+'" aria-label="Enlarge '+labels[type]+'"><span>'+icons[type]""")
source=source.replace(label_end,
 "' <small>('+perms.length+')</small></strong></button>'+immersiveLane(p,idx,type)")
guard_anchor="'toggleSolRoster'"
assert source.count(guard_anchor)>=1
# Only game action guard, not the stage or button, needs this action.
allow_line="'toggleHandZoom','inspectBoardPermanent','toggleZones','leaveFinishedGame','toggleAutoMana','toggleSolRoster'"
assert source.count(allow_line)==1
source=source.replace(allow_line,allow_line+",'zoomBoardRow'")
game_actions=" case 'toggleSolRoster':app.solRosterOpen=!app.solRosterOpen;render();break;"
assert source.count(game_actions)==1
source=source.replace(game_actions,
 """ case 'zoomBoardRow':{
  const [seat,kind]=String(v||'').split(':');
  const idx=Number(seat);
  if(!Number.isInteger(idx)||idx<0||idx>=(app.game?.players?.length||0))break;
  if(!['lands','support','creatures'].includes(kind))break;
  app.solZoomRow={seat:idx,kind};app.modal='solBoardZoom';render();break;
 }
"""+game_actions)
modal_anchor=" if(app.modal==='confirmDeleteDeck'){"
assert source.count(modal_anchor)==1
source=source.replace(modal_anchor,
 """ if(app.modal==='solBoardZoom'){
  const info=app.solZoomRow,seat=info?.seat,kind=info?.kind;
  const owner=app.game?.players?.[seat];
  const filtered=(owner?.battlefield||[]).filter(x=>{
   const c=card(x.name),t=String(c.type||'');
   const creature=x.creature===undefined?isCreature(c):x.creature;
   const land=x.land===undefined?/\\bLand\\b/i.test(t):x.land;
   return kind==='creatures'?creature:kind==='lands'?land:!creature&&!land;
  });
  inside='<div class="sol-board-zoom"><h2>'+esc(seat===0?'Your battlefield':owner?.name||'Opponent')+
   ' · '+esc(kind==='support'?'Artifacts & enchantments':kind)+'</h2>'+
   '<p>Tap any permanent for its full card details. Swipe to see more cards.</p>'+
   '<div class="sol-board-zoom-cards">'+(filtered.length?filtered.map(x=>{
    const c=card(x.name);
    return '<button data-action="inspectBoardPermanent" data-value="'+seat+':'+esc(x.uid)+'">'+
      '<img data-art-name="'+esc(c.name)+'" src="'+esc(artUrl(c))+
      '" alt="'+esc(c.name)+'" onerror="this.style.display=\\'none\\'">'+
      '<strong>'+esc(c.name)+'</strong></button>';
   }).join(''):'<p>No permanents in this row.</p>')+'</div></div>';
 }
"""+modal_anchor)

# v0.29 - unified UI notifications and lower-left player Zones positioning.
for script_name in ('sol-pod-layout-v029.js','sol-pod-notifications-v029.js'):
    script=(Path(__file__).resolve().parent.parent/'web'/script_name).read_text()
    assert source.count('</body>')==1
    source=source.replace('</body>','<script>\n'+script+'\n</script></body>')
# The visual listener re-attaches to any fresh card-art status element after
# a Forge GameView re-render; it never sends gameplay commands.
render_hook="root.innerHTML=shell(view);syncNativeOrientation();scheduleAuto();if(app.view==='game')window.ctMatchLoading?.ready();if(app.nativeMatch&&app.autoPilot)ctWatchForgeMatch();}"
assert source.count(render_hook)==1, 'Native render hook changed'
source=source.replace(render_hook,
    "root.innerHTML=shell(view);syncNativeOrientation();scheduleAuto();if(app.view==='game')window.ctMatchLoading?.ready();if(app.nativeMatch&&app.autoPilot)ctWatchForgeMatch();window.solPodSyncNotices?.();}")

# Native in-game notices belong in the single dismissible right rail; suppress
# the old full-shell notice without affecting import/deck-editor feedback.
announce_marker="function announce(message){app.notice=message;render();}"
assert source.count(announce_marker)==1
source=source.replace(announce_marker,
 "function announce(message){if(app.nativeMatch&&window.solPodNotice){window.solPodNotice(message,/error|failed|cannot|rejected/i.test(String(message))?'error':'info');return;}app.notice=message;render();}")


# v0.30: abandon guessed "playable" mana highlights; only a current Forge
# selection is authoritative. Lands with non-free abilities (Skycloud Expanse)
# must NEVER be counted as free colored sources by the UI.
old_glow="available:app.nativeMatch?(!!window.ctForgeSelection?.isLegalCard?.(me.handForgeIds?.[i])||ctNativeAffordable(c,me,g)):!g.autoPilot&&canCast(me,c)"
assert source.count(old_glow)==1, 'v0.29 highlighted-card logic changed'
source=source.replace(old_glow,
  "available:app.nativeMatch?!!window.ctForgeSelection?.isLegalCard?.(me.handForgeIds?.[i]):!g.autoPilot&&canCast(me,c)")
# Keep a casting affordance but explicitly defer legal costs, abilities and
# targets to Forge. Do not imply that the app has already verified mana.
cast_heading='<button class="primary" data-action="playInspected">Cast / play ↗</button>'
assert source.count(cast_heading)==1
source=source.replace(cast_heading,
  '<button class="primary" data-action="playInspected">'+chr(36)+'{app.nativeMatch?"Ask Forge to cast":"Cast / play"} ↗</button>')
cast_modal='<button class="primary full" data-action="castSelected">'+chr(36)+"{isLand(c)?'Play land':cmd?'Cast commander':'Cast spell'}</button>"
assert source.count(cast_modal)==1
source=source.replace(cast_modal,
 '<button class="primary full" data-action="castSelected">'+chr(36)+'{app.nativeMatch?"Ask Forge to cast":isLand(c)?"Play land":cmd?"Cast commander":"Cast spell"}</button>')
# Render Forge's actual decision badges and the Sol Pod information hub
# after all previous layered styles and event adapters.
hub=(Path(__file__).resolve().parent.parent/'web'/'sol-pod-hub-v030.js').read_text()
assert 'window.solPodHub' in hub
assert source.count('</body>')==1
source=source.replace('</body>','<script>\n'+hub+'\n</script></body>')


# v0.31 — no more accidental hand expansion or tutorial combat bubble.
fan_toggle='<div class="ct10-hand-fan" data-action="toggleHandZoom">'
assert source.count(fan_toggle)==1, 'Hand fan toggle moved'
source=source.replace(fan_toggle,'<div class="ct10-hand-fan">')
hand_title=chr(36)+'{app.handZoom?"−":"⤢"}'
assert source.count(hand_title)==1
source=source.replace(hand_title,
  chr(36)+'{app.handZoom?"✕ CLOSE HAND":"⤢ ENLARGE HAND"}')
# The initial mulligan phase does not imply the opening hand has arrived.
# Avoid expanding an empty hand over Forge's Play/Draw choice.
old_mulligan='g.phase==="mulligan"?"ct10-hand-mulligan":""'
assert source.count(old_mulligan)==1
source=source.replace(old_mulligan,
  'g.phase==="mulligan"&&me.hand.length>0?"ct10-hand-mulligan":""')
old_combat=chr(36)+'{ctNativeCombatGuide(g)}'
assert source.count(old_combat)==1
# Actual Forge combat lines/priority remain; the generic combat explanation
# is redundant and was obscuring the upper-left AI battlefield.
source=source.replace(old_combat,'')
v31=(Path(__file__).resolve().parent.parent/'web'/'sol-pod-ux-v031.js').read_text()
assert 'sol-pod-ux-v031' in v31 and source.count('</body>')==1
source=source.replace('</body>','<script>\n'+v31+'\n</script></body>')


# v0.32: move the Hand toggle beside Zones and let card taps only inspect cards.
# Keep the compact hand count passive rather than overlaying playable zones.
old_hand_toggle='<button data-action="toggleHandZoom" aria-label="Expand or collapse hand" aria-pressed="'+chr(36)+'{!!app.handZoom}">YOUR HAND <b>'+chr(36)+'{me.hand.length}</b> '+chr(36)+'{app.handZoom?"✕ CLOSE HAND":"⤢ ENLARGE HAND"}</button>'
assert source.count(old_hand_toggle)==1, 'v0.31 hand ribbon changed'
source=source.replace(old_hand_toggle,
 '<span class="sol-hand-count">YOUR HAND <b>'+chr(36)+'{me.hand.length}</b></span>')
hand_wrap='<div class="ct10-hand-wrap">'
assert source.count(hand_wrap)==1, 'Hand layout anchor changed'
source=source.replace(hand_wrap,
 '<button type="button" class="sol-hand-toggle" data-action="toggleHandZoom" aria-pressed="'+chr(36)+'{!!app.handZoom}">'+chr(36)+'{app.handZoom?"✕ Hide hand":"▤ Enlarge hand"}</button>\n  '+hand_wrap)
tutorial_old='Tap YOUR HAND to enlarge your cards.'
assert source.count(tutorial_old)==1, 'How to Play hand directions changed'
source=source.replace(tutorial_old,
 'Use Enlarge hand beside Zones to browse cards. Press Hide hand to return to the board.')
block_tutorial='select the incoming attacker first, then one of your untapped eligible creatures.'
assert source.count(block_tutorial)==1, 'How to Play blocker directions changed'
source=source.replace(block_tutorial,
 'select your untapped blocker first, then tap the attacking creature it will block.')
block_intro='select the incoming attacker then a legal untapped blocker'
if source.count(block_intro)==1:
 source=source.replace(block_intro,
  'select one of your untapped blockers then the attacking creature')
v32=(Path(__file__).resolve().parent.parent/'web'/'sol-pod-ux-v032.js').read_text()
assert 'sol-pod-ux-v032' in v32 and source.count('</body>')==1
source=source.replace('</body>','<script>\n'+v32+'\n</script></body>')


# v0.33: keep compact hand completely on-screen alongside the two bottom
# buttons. Do not change the expanded hand or the Forge engine handlers.
v33=(Path(__file__).resolve().parent.parent/'web'/'sol-pod-ux-v033.js').read_text()
assert 'sol-pod-ux-v033' in v33 and source.count('</body>')==1
source=source.replace('</body>','<script>\n'+v33+'\n</script></body>')


# v0.34: keep original Forge hand indices and card IDs unchanged while sorting
# only the visual hand presentation. Never sort during mulligan or an active
# choice/discard prompt: positions and choices must remain stable to the player.
old_hand='const hand=me.hand.map((n,i)=>{'
assert source.count(old_hand)==1, 'Hand renderer changed'
new_hand="""const mayRankHand=app.nativeMatch&&g.phase!=='mulligan'&&!g.autoPilot&&
  !window.ctForgeChoice?.hasPending&&!window.ctForgePriority?.isHandChoice&&
  !app.pendingCast&&!/discard|mulligan|choose|order|target/i.test(
    String(window.ctForgeSelection?.prompt||''));
 const handOrder=me.hand.map((n,i)=>({n,i,ready:mayRankHand&&
   !!window.ctForgeSelection?.isLegalCard?.(me.handForgeIds?.[i])}));
 if(mayRankHand)handOrder.sort((a,b)=>Number(b.ready)-Number(a.ready)||a.i-b.i);
 const hand=handOrder.map(({n,i},visualIndex)=>{"""
source=source.replace(old_hand,new_hand)
tilt='const c=card(n),offset=i-(me.hand.length-1)/2;'
assert source.count(tilt)==1
source=source.replace(tilt,'const c=card(n),offset=visualIndex-(me.hand.length-1)/2;')
# Existing card actions keep value:String(i) and dragIndex:i, where i is the
# original hand index. --order should follow visual position, not Forge index.
original_style='--order:'+chr(36)+'{i}'
assert source.count(original_style)==1
source=source.replace(original_style,'--order:'+chr(36)+'{visualIndex}')
# Replace the duplicate "Enlarge hand" chrome with one tappable YOUR HAND
# button (with count) alongside Zones; compact hand tray becomes cards only.
old_toggle='<button type="button" class="sol-hand-toggle" data-action="toggleHandZoom" aria-pressed="'+chr(36)+'{!!app.handZoom}">'+chr(36)+'{app.handZoom?"✕ Hide hand":"▤ Enlarge hand"}</button>'
assert source.count(old_toggle)==1, 'v0.33 external hand toggle changed'
new_toggle='<button type="button" class="sol-hand-toggle sol-hand-pill" data-action="toggleHandZoom" aria-label="Toggle expanded hand" aria-pressed="'+chr(36)+'{!!app.handZoom}">▤ YOUR HAND <b>'+chr(36)+'{me.hand.length}</b> '+chr(36)+'{app.handZoom?"✕":"⤢"}</button>'
source=source.replace(old_toggle,new_toggle)
old_count='<span class="sol-hand-count">YOUR HAND <b>'+chr(36)+'{me.hand.length}</b></span>'
assert source.count(old_count)==1
source=source.replace(old_count,'<span class="sol-hand-hint">Tap to inspect · Open to cast</span>')
# Let YOUR HAND collapse a mulligan hand too; start with it expanded until the
# player explicitly closes it. Reset the preference after the mulligan phase.
old_mulligan='g.phase==="mulligan"&&me.hand.length>0?"ct10-hand-mulligan":""'
assert source.count(old_mulligan)==1
source=source.replace(old_mulligan,
 'g.phase==="mulligan"&&me.hand.length>0&&!app.mulliganHandClosed?"ct10-hand-mulligan":""')
old_action="case 'toggleHandZoom':app.handZoom=!app.handZoom;app.modal='';render();break;"
assert source.count(old_action)==1
source=source.replace(old_action,
 "case 'toggleHandZoom':if(app.game?.phase==='mulligan'){app.mulliganHandClosed=!app.mulliganHandClosed;app.handZoom=false;}else{app.handZoom=!app.handZoom;app.mulliganHandClosed=false;}app.modal='';render();break;")
# Source of the tutorial can be stale because previous releases instructed
# users to use a standalone button, now replaced by the YOUR HAND pill.
old_help='Use Enlarge hand beside Zones to browse cards. Press Hide hand to return to the board.'
assert source.count(old_help)==1
source=source.replace(old_help,
 'Tap YOUR HAND beside Zones to browse your cards. Tap it again to return to the board.')
v34=(Path(__file__).resolve().parent.parent/'web'/'sol-pod-ux-v034.js').read_text()
assert 'sol-pod-ux-v034' in v34 and source.count('</body>')==1
source=source.replace('</body>','<script>\n'+v34+'\n</script></body>')

target.parent.mkdir(parents=True,exist_ok=True)
target.write_text(source)
print(f'Patched Command Table HTML: {len(source)} characters')
