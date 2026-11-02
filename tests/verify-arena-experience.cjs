'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=file=>fs.readFileSync(file,'utf8');
const patch=read('forge-integration/tools/patch_frontend.py');
const choice=read('forge-integration/web/forge-choice.js');
const priority=read('forge-integration/web/forge-selection.js');
const zones=read('forge-integration/web/forge-zones.js');
const hold=read('forge-integration/web/forge-card-hold.js');
const motion=read('forge-integration/web/forge-motion.js');

for(const [name,text] of Object.entries({zones,hold,motion,choice,priority})){
  assert.doesNotThrow(()=>new Function(text),name+' must parse as JavaScript');
}
assert(zones.includes("document.body.append(portal)") &&
       zones.includes("z-index:2147482800") &&
       zones.includes("cloneNode(true)") &&
       zones.includes("ct10-zone-rail.ct-zones-open .ct10-zone-drawer") &&
       zones.includes("window.CommandTableAction") &&
       zones.includes("ctFloatingZones={sync,close}"),
  'Zones must leave the battlefield stacking context with working buttons');
assert(hold.includes("390") &&
       hold.includes("suppressClick=true") &&
       hold.includes("pointercancel") &&
       hold.includes("ctCardHold="),
  'Hold preview must not cast a spell on release or break drag');
assert(motion.includes("previous?.native||!next?.native") &&
       motion.includes("const oldCards=new Map") &&
       motion.includes("old.life") &&
       motion.includes("next.stack") &&
       motion.includes("reduced-motion") &&
       motion.includes("window.ctArenaMotion"),
  'Animations must reflect committed Forge GameViews only and respect accessibility');
assert(patch.includes("for feature in ('forge-zones.js','forge-card-hold.js','forge-motion.js')") &&
       patch.includes("window.ctArenaMotion?.onState?.(before,app.game)") &&
       patch.includes("ct-native-stack ct-stack-compact") &&
       patch.includes("window.ctArenaMotion?.stackExpanded"),
  'New experience modules, compact stack and projected transitions must be embedded');
assert(patch.includes("ctNativeTiming(c).allowed&&ctNativeAffordable(c,me,g)") &&
       patch.includes("String(me.handForgeIds[i]):String(i)") &&
       patch.includes("Hand index/value render changed"),
  'Cast by stable Forge IDs and only attempt timing/mana-eligible one-tap casts');
assert(choice.includes("current.options?.length===1") &&
       choice.includes("!current.allowSkip && !current.confirm") &&
       choice.includes("current.min===1 && current.max===1") &&
       !choice.includes("game.command',{action:'resolve'"),
  'Only uniquely mandatory Forge choices may auto-advance; priority must not auto-pass');
assert(priority.includes("if(inBlock&&!ok)continue") &&
       priority.includes("No blocks") &&
       priority.includes("Attack all"),
  'Single primary combat confirmation with correctly labelled optional attack-all');
assert(priority.includes("autoManaIssued") &&
       priority.includes("buttonState.enable1") &&
       priority.includes("window.ctAutoMana!==false") &&
       patch.includes("data-action=\\"toggleAutoMana\\"")===false &&
       patch.includes('data-action="toggleAutoMana"') &&
       patch.includes("ct-auto-mana"),
  'Forge-enabled Auto mana payments must be opt-out, persisted and never auto-pass');
console.log('PASS: v0.18 Zones foreground, card hold, casting, stack, FX, safe choice handling and phase controls');
