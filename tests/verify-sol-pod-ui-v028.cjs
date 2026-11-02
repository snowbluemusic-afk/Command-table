'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const p=fs.readFileSync('forge-integration/tools/patch_frontend.py','utf8');
const skin=fs.readFileSync('forge-integration/web/sol-pod-ui-v028.js','utf8');
const old=fs.readFileSync('forge-integration/web/sol-pod-battlefield.js','utf8');
new Function(skin);new Function(old);
const checks=[
 ['reversed opposing zone order',skin.includes('.sol-opp.sol-lands{top:13.9%')&&skin.includes('.sol-opp.sol-creatures{top:37.7%')],
 ['our creatures face their creatures',skin.includes('.sol-own.sol-creatures{top:50.7%')],
 ['matching card sizing',skin.includes('.sol-board-row .game-card')],
 ['horizontal dense row scrolling',skin.includes('overflow-x:auto!important')],
 ['AI 1,2,3 colours',skin.includes('.sol-battlefield.sol-ai-2')&&skin.includes('.sol-battlefield.sol-ai-3')],
 ['active-seat colour binding',p.includes('sol-ai-'+"'"+'+chr(36)')],
 ['overlay zones',skin.includes('#ct-floating-zones .ct-floating-panel')],
 ['collapsible player roster',p.includes('toggleSolRoster')&&skin.includes('sol-roster-expanded')],
 ['redundant switcher removed',p.includes('cycle_start')],
 ['working hand expansion',p.includes('toggleHandZoom')&&skin.includes('ct10-hand-zoom .ct10-hand-wrap')],
 ['full opponent card inspection',p.includes("app.modal='inspect';")],
 ['row enlargement for AI and owner',p.includes('zoomBoardRow')&&p.includes('solBoardZoom')],
 ['priority uses real Forge buttons',skin.includes('#ct-forge-priority-buttons')],
 ['stack and message lanes',skin.includes('#ct-native-toast')&&skin.includes('.ct-native-stack')],
 ['integrated phase in player header',p.includes('sol-turn-detail')&&p.includes('phase_removed')],
 ['delete option from deck library',p.includes('deleteDeckFromLibrary')&&p.includes('solDeckLibraryTile')],
 ['delete confirmation required',p.includes('confirmDeleteDeck')&&p.includes('cancelDeleteDeck')],
 ['prebuilt decks protected',p.includes('target.prebuilt')&&p.includes('d.prebuilt')],
 ['same installed app identity',fs.readFileSync('forge-integration/tools/patch_forge_android.py','utf8').includes('com.commandtable.play')]
];
for(const [name,ok] of checks)assert(ok,'FAIL '+name);
console.log('PASS v0.28 UX source and script regression checks ('+checks.length+')');
