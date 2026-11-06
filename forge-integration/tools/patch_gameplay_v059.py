#!/usr/bin/env python3
"""Add Sol Pod v0.59 UX without replacing Forge authority or earlier fixes."""
from pathlib import Path
import sys

target=Path(sys.argv[1])
source=target.read_text()
def swap(before, after, name):
    global source
    count=source.count(before)
    assert count==1, f"{name}: expected one match, found {count}"
    source=source.replace(before,after,1)

swap("  function isOrder() { return current && current.mode === 'order'; }\n  function toggle(index) {",
"""  function isOrder() { return current && current.mode === 'order'; }
  // Only two literal Yes/No options may be submitted on first tap.
  // The original choice.answer ID and native acknowledgement are unchanged.
  function quickBinary(choice=current) {
    if(!choice || choice.mode!=='single' || choice.min!==1 || choice.max!==1 ||
       choice.commanderDestination || choice.allowSkip || needsVerification)return false;
    const labels=(Array.isArray(choice.options)?choice.options:[])
      .map(item=>String(item?.label||'').trim().replace(/[.!]$/,'').toLowerCase());
    return labels.length===2 && labels.includes('yes') && labels.includes('no');
  }
  function toggle(index) {""","single-tap binary guard")
swap("""    paint();
    // A tap selects the option; Confirm choice submits it. Do not
    // immediately close the modal on a single choice: that can look like a
    // disappearing popup, and gives the player no chance to review or undo.
  }""",
"""    paint();
    // Explicit human click, then wait for authoritative Forge acknowledgement.
    if(quickBinary())void answer(false);
  }""","single-tap binary action")
swap("? 'Select the legal option you want.'",
     "? (quickBinary()?'Tap Yes or No to answer. Waiting for confirmation.':'Select the legal option you want.')",
     "single-tap copy")
swap("    ok.dataset.ctChoiceConfirm='1';\n    ok.disabled=inFlight",
     "    ok.dataset.ctChoiceConfirm='1';\n    ok.hidden=quickBinary() && !inFlight && !current.error;\n    ok.disabled=inFlight",
     "single-tap confirm")

old="""    [...items].reverse().forEach((item,i)=>{
      const tile=button(null,()=>open(key(item)),'sol-stack-tile');
      tile.dataset.top=String(i===0);
      addArt(tile,item,false);
      const copy=create('span');
      copy.append(create('b',title(item)));
      copy.append(create('small',(i===0?'NEXT · ':'')+label(item)));
      tile.append(copy);cards.append(tile);
    });"""
new="""    // Group consecutive identical entries in the rail ONLY. The reader and
    // underlying Forge stack still contain every original entry/target/ID.
    const groups=[];
    for(const item of [...items].reverse()){
      const fingerprint=[title(item),label(item),readable(item),
        targetNames(item).join('|')].join(' :: ');
      const previous=groups[groups.length-1];
      if(previous?.fingerprint===fingerprint){previous.count++;continue;}
      groups.push({item,count:1,fingerprint});
    }
    count.textContent=items.length+' active'+(groups.length<items.length?
      ' · '+groups.length+' groups':'');
    groups.forEach((group,i)=>{
      const item=group.item;
      const tile=button(null,()=>open(key(item)),'sol-stack-tile');
      tile.dataset.top=String(i===0);
      tile.setAttribute('aria-label',group.count+' pending '+title(item)+
        ' effects; open to inspect each entry');
      addArt(tile,item,false);
      const copy=create('span');
      copy.append(create('b',(group.count>1?group.count+' × ':'')+title(item)));
      copy.append(create('small',(i===0?'NEXT · ':'')+label(item)));
      tile.append(copy);cards.append(tile);
    });"""
swap(old,new,"visual stack grouping")
swap("      cards.append(create('div','No spells or abilities on the stack.','sol-pod-stack-empty'));",
"""      const entry=game()?.damageHistory?.[0];
      const message=entry?.message?
        'Last resolved · '+String(entry.message):
        'No spells or abilities on the stack.';
      const note=create('div',message,'sol-pod-stack-empty');
      note.title=message;
      cards.append(note);""","resolved Forge log feedback")

script=(Path(__file__).resolve().parent.parent/'web'/'sol-pod-hand-grid-v059.js').read_text()
assert 'window.solPodHandGrid' in script and source.count('</body>')==1
source=source.replace('</body>','<script>\n'+script+'\n</script></body>')
swap("window.SOL_POD_BUILD='0.58.0';","window.SOL_POD_BUILD='0.59.0';","build version")
swap("tag.textContent='v0.58';","tag.textContent='v0.59';","visible version")
swap("Sol Pod build version 0.58","Sol Pod build version 0.59","accessible version")
assert 'window.CommandTableAction = action' in source
assert 'GameEventPlayerDamaged' not in script
# v0.60: insert opt-in audio / Forge-guarded auto-trigger controls.
preferences=(Path(__file__).resolve().parent.parent/'web'/'sol-pod-audio-auto-v060.js').read_text()
assert 'window.solPodPreferences' in preferences and source.count('</body>')==1
source=source.replace('</body>','<script>\n'+preferences+'\n</script></body>')
swap("window.SOL_POD_BUILD='0.59.0';","window.SOL_POD_BUILD='0.60.0';","v060 build version")
swap("tag.textContent='v0.59';","tag.textContent='v0.60';","v060 build badge")
swap("Sol Pod build version 0.59","Sol Pod build version 0.60","v060 accessibility build")
# v0.61: connect user-selected AI deck NAME and Forge attachment identity.
swap('cpuDeck:app.enemyDeck,autoPilot:app.autoPilot',
     'cpuDeck:app.enemyDeck,cpuDeckName:app.enemyDeck==="random"?"":'+
     '(app.decks.find(x=>x.id===app.enemyDeck)?.name||""),autoPilot:app.autoPilot',
     'native AI deck selection')
swap('uid:String(c.id), forgeId:c.id, name:c.name, token:!!c.token, tapped:!!c.tapped,',
     'uid:String(c.id), forgeId:c.id, name:c.name, token:!!c.token, '+
     'attachedToId:c.attachedToId??null, tapped:!!c.tapped,',
     'Forge attachment identity')
# Random is the FIRST-GAME default and is visible on the launch panel. The
# existing More Options dropdown still selects a named deck for a match.
swap('Set up your game here, then choose your decks below.',
     'Choose your deck and table size. AI opponent decks are random by default; More options lets you select a specific deck.',
     'first-game random opponent copy')
swap('Choose your deck and your opponents. Each CPU takes its own turn.',
     'Choose random or specific opponent decks; each AI takes its own turn.',
     'setup copy')
# Retain the existing 12 contextual lessons and indices; change stale details.
welcome={
  'Choose a deck and select Play to begin.':
    'Choose a deck. Opponents are random by default, or selectable in More options.',
  'Highlighted playable cards appear toward the left.':
    'Search, sort and filter your hand in the full-screen browser. Forge still determines legal plays.',
  'Open YOUR HAND, tap a card, and close its preview.':
    'Open YOUR HAND, sort or search, then inspect an individual card.',
  'Phase & Priority is at the lower right; The Game Log is read-only and separate from your choices.':
    'Use the Phase & Priority controls and the separate stack viewer; identical triggers may be grouped visually.',
  'Use Pass priority when you have nothing to add.':
    'Open the stack viewer to read queued abilities. Use Pass priority if you do not want to respond.',
  'For a sacrifice ability, the permanent is sacrificed to pay its cost; it does not stay on the battlefield.':
    'For sacrifice abilities, the permanent leaves as a cost. Equipment and Auras attached to a creature appear tucked underneath it: tap its attachment badge to inspect them.',
  'Find a card with “Tap:” or “Sacrifice:” in its text.':
    'Inspect an equipped or enchanted creature to explore its attached-card stack.',
  'Recover without losing control':
    'Audio, auto-resolve and recovery',
  'Press ? to reopen this guide whenever needed.':
    'Use ⚙ for sound controls and optional trigger-only Auto-resolve. Press ? to replay this guide.',
  'If something fails or times out, use Refresh game or Cancel pending choice.':
    'In ⚙ Audio & Gameplay, set effects and ambient volume. Auto-resolve is off by default and pauses for meaningful player decisions. For errors, refresh or cancel the pending action.',
}
for before,after in welcome.items():
    swap(before,after,'current onboarding: '+before[:38])
# Restore version markers and inject the attachment UX after all other layers.

attachment_js=(Path(__file__).resolve().parent.parent/'web'/'sol-pod-attached-stacks-v061.js').read_text()
assert 'window.solPodAttachmentStacks' in attachment_js and source.count('</body>')==1
source=source.replace('</body>','<script>\n'+attachment_js+'\n</script></body>')
swap("window.SOL_POD_BUILD='0.60.0';","window.SOL_POD_BUILD='0.61.0';","v061 build version")
swap("tag.textContent='v0.60';","tag.textContent='v0.61';","v061 badge")
swap("Sol Pod build version 0.60","Sol Pod build version 0.61","v061 accessible version")
target.write_text(source)
print(f"Sol Pod v0.61 gameplay and attachments pass applied ({len(source)} characters)")
