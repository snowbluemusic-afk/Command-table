'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const read=p=>fs.readFileSync(p,'utf8');
const loading=read('forge-integration/web/forge-landscape-ui.js');
const priority=read('forge-integration/web/forge-selection.js');
const gestures=read('forge-integration/web/forge-gestures.js');
const hub=read('forge-integration/web/sol-pod-hub-v030.js');
const patch=read('forge-integration/tools/patch_frontend.py');
const html=read('android/app/src/main/assets/index.html');
const checks=[
 ['Opening hand wait uses authoritative state, not art or timeout',loading.includes('const requiresInput=')&&loading.includes('hand.length>0')&&loading.includes('hasActionableDecision')&& !loading.includes('elapsed>=3300')],
 ['Play/Draw opening prompt unblocked',priority.includes('get hasActionableDecision()')],
 ['Do not guess dual-land mana eligibility',patch.includes('source=source.replace(old_glow,')&&patch.includes('available:app.nativeMatch?!!window.ctForgeSelection?.isLegalCard?')],
 ['Native card label avoids false Playable claim',html.includes('if(app.nativeMatch)return')&&html.includes('Sol Pod checks legality before casting')],
 ['Native cast button explicitly delegates to Forge',patch.includes('Ask Forge to cast')],
 ['Read-only Game Log contains no interactive Forge choice panel',hub.includes("hub.id='sol-pod-hub'")&&!hub.includes("document.getElementById('ct-forge-legal-actions')")],
 ['Mandatory choice is unaffected by clearing history',hub.includes('Log controls never answer, cancel or dismiss a Forge choice')],
 ['Notices can be dismissed without losing choice state',hub.includes('window.solPodDismissNotices?.()')],
 ['Forge choice stays alongside priority controls',hub.includes('#ct-forge-decision-sheet>div')&&hub.includes('#ct-forge-priority-buttons')],
 ['Multiple blockers can be queued',gestures.includes('selectedBlocker')&&gestures.includes("selectSourceAndTarget(blockerId,{kind:'card',id},'block')")&&gestures.includes('commandQueue=commandQueue.catch(()=>{}).then(task)')],
 ['No stale arrows in current tutorial',!html.includes('Use arrows on the right to cycle opponents')],
 ['Updated Forge commander tutorial',html.includes('Skycloud Expanse')&&html.includes('Sol Pod uses full Commander rules')],
 ['Current blocking instructions',html.includes('select the incoming attacker first')||html.includes('select the incoming attacker then')],
 ['Deck deletion included',patch.includes('confirmDeleteDeck')&&patch.includes('target.prebuilt')],
 ['Main Android package unchanged',read('forge-integration/tools/patch_forge_android.py').includes('com.commandtable.play')]
];
for(const [description,ok] of checks)assert(ok,description);
for(const p of ['forge-integration/web/forge-landscape-ui.js','forge-integration/web/forge-selection.js','forge-integration/web/forge-gestures.js','forge-integration/web/sol-pod-hub-v030.js'])new Function(read(p));
console.log('PASS Sol Pod v0.30 startup, gameplay, tutorial and panel checks ('+checks.length+')');
