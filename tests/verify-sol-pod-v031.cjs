'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const file=p=>fs.readFileSync(p,'utf8');
const choices=file('forge-integration/web/forge-choice.js');
const hub=file('forge-integration/web/sol-pod-hub-v030.js');
const ux=file('forge-integration/web/sol-pod-ux-v031.js');
const patch=file('forge-integration/tools/patch_frontend.py');
const selection=file('forge-integration/web/forge-selection.js');
for(const [name,src] of [['Forge mandatory choices',choices],['right-side hub',hub],['v0.31 layout',ux],['native selection',selection]]){
 try{new Function(src)}catch(err){throw Error('Invalid '+name+': '+err.message);}
}
const tests=[
 ['Full-screen mandatory choices',choices.includes("'width:min(94vw,1000px)'")&&ux.includes('max-height:94dvh!important')],
 ['Decision panel no longer forced to 22% rail',hub.includes('#ct-forge-decision-sheet{inset:0!important;width:100vw!important')],
 ['Choice card labels readable',choices.includes('data-ct-choice-list')||choices.includes("list.dataset.ctChoiceList='1'")],
 ['Choices and text persist through engine replay',choices.includes("incoming?.id===current?.id")&&choices.includes('if(!inFlight)paint()')],
 ['Choice submission checks acknowledgement',choices.includes("response.accepted !== true")&&choices.includes('answerGeneration')],
 ['Slow Forge choices show recoverable state',choices.includes('Refresh Sol Pod status')&&choices.includes('14000')&&choices.includes("request('engine.status')")],
 ['Mandatory choices cannot be cleared as notices',hub.includes('Log controls never answer, cancel or dismiss a Forge choice')],
 ['No accidental tap on empty hand',patch.includes("fan_toggle='<div class=\"ct10-hand-fan\" data-action=\"toggleHandZoom\">'")],
 ['Explicit expand and close hand label',patch.includes('ENLARGE HAND')&&patch.includes('CLOSE HAND')],
 ['Mulligan does not enlarge empty hand',patch.includes('g.phase===\"mulligan\"&&me.hand.length>0')],
 ['Compact hand keeps cards interactive',ux.includes('ct10-hand-slot .game-card')&&ux.includes('pointer-events:auto')],
 ['Expanded cards scroll without overlapping',ux.includes('scroll-snap-type:x proximity')&&ux.includes('margin-right:0!important')],
 ['Remove obsolete combat bubble',patch.includes("source=source.replace(old_combat,'')")],
 ['Universal Forge legal target choices remain accessible',selection.includes('panel.style.display=playing') && selection.includes('chooseCard:(id)')],
 ['Stack stays separate from notification rail',!hub.includes('contents.append(stack)') &&
   !hub.includes('for(const prior of [...contents.querySelectorAll')],
 ['Forge still authors combat and priority',file('forge-integration/src/main/java/forge/commandtable/CommandTableForgeInput.java').includes('human().selectCard')],
];
for(const [name,success] of tests)assert(success,'FAIL '+name);
console.log('PASS Sol Pod v0.31 decision/hand/stability source checks ('+tests.length+')');
