'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const load=path=>fs.readFileSync(path,'utf8');
const gest=load('forge-integration/web/forge-gestures.js');
const selection=load('forge-integration/web/forge-selection.js');
const patch=load('forge-integration/tools/patch_frontend.py');
const layout=load('forge-integration/web/sol-pod-layout-v029.js');
const notice=load('forge-integration/web/sol-pod-notifications-v029.js');
for(const [name,js] of [['gestures',gest],['Forge choices',selection],['layout',layout],['notices',notice]]){
 try{new Function(js);}catch(error){throw new Error('Invalid JS '+name+': '+error.message);}
}
const checks=[
 ['Two-tap blockers use one Forge command',gest.includes('selectedBlockTarget')&&gest.includes("selectSourceAndTarget(id,{kind:'card',id:chosen},'block')")],
 ['Rapid Forge combat assignments queue',gest.includes('commandQueue=commandQueue.catch(()=>{}).then(task)')],
 ['Block assignments verified using CombatView',gest.includes('(c.blockerIds||[]).some(id=>Number(id)===sourceId)')],
 ['Previous independent blocker cardId calls removed',!gest.includes("command={action:'cardId',value:cardId}")],
 ['Open lane zoom on either side',patch.includes('zoomBoardRow')&&patch.includes('solBoardZoom')],
 ['Zones beside lower-left player health',layout.includes('.ct10-zone-rail')&&layout.includes('bottom:1.4%')],
 ['Zones float upward over field',layout.includes('#ct-floating-zones .ct-floating-panel')&&layout.includes('bottom:13%')],
 ['Unified right-hand notifications',notice.includes("host.id='sol-pod-notices'")&&notice.includes('right:1%')],
 ['Notices individually dismissible',notice.includes("setAttribute('data-dismiss-notice',key)")&&notice.includes('dismiss(key)')],
 ['Mana tap routed to Forge cardId',patch.includes('window.ctForgePriority?.isManaPayment')&&patch.includes('cardId')],
 ['Mana refresh button',selection.includes('Refresh mana')&&selection.includes('syncChoices()')],
 ['No fake mana payments',!notice.includes('game.command')&&!layout.includes('game.command')],
 ['Native authoritative game UI preserved',patch.includes('ctHydrateForgeState')],
 ['No second priority dock',!notice.includes("ct-forge-priority-buttons'")],
 ['Package retained',load('forge-integration/tools/patch_forge_android.py').includes('com.commandtable.play')]
];
for(const [name,ok] of checks)assert(ok,name+' did not pass');
console.log('PASS v0.29 interaction, notification and mana wiring ('+checks.length+' checks)');
