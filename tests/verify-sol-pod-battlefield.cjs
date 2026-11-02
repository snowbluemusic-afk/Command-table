'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const frontend=fs.readFileSync('forge-integration/tools/patch_frontend.py','utf8');
const css=fs.readFileSync('forge-integration/web/sol-pod-battlefield.js','utf8');
assert(frontend.includes('solPodPermanentRows(p,idx,type)'), 'Three-zone renderer missing');
assert(frontend.includes('solPodRoster(g,focus)'), 'Pod roster missing');
for(const side of ['own','opp']){
 for(const kind of ['lands','support','creatures']){
  assert(css.includes('.sol-'+side+'.sol-'+kind),side+' '+kind+' not positioned');
 }
}
assert(frontend.includes('solPodPermanentRows('+"'"), 'Row markup should use the renderer');
assert(css.includes('#ct-forge-priority-buttons:not(.ct-forge-pregame)'),
 'Responsive dock must restyle real Forge priority buttons');
assert(css.includes('.sol-board-row>.ct10-lane'),
 'Forge card selection must remain in original lane elements');
assert(css.includes('.sol-zone-shortcuts'),
 'Zone actions must remain accessible outside the priority control');
assert(frontend.includes('data-ct-zone-view="graveyard"')&&frontend.includes('data-ct-zone-view="exile"'),
 'Graveyard and exile must be reachable from the main board');
assert(!css.includes('onclick='), 'Do not build fake priority event handlers');
new Function(css);
console.log('PASS Sol Pod six zone rows, pod roster, real priority buttons and JS syntax');
