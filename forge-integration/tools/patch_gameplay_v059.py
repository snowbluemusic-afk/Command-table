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
target.write_text(source)
print(f"Sol Pod v0.59 interaction pass applied ({len(source)} characters)")
