'use strict';
// Sol Pod v0.58: damage audit is sourced from the actual Forge GameLog,
// never calculated from post-combat creature power or the visible life delta.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
const projection=read('forge-integration/src/main/java/forge/commandtable/CommandTableGameProjection.java');
const patch=read('forge-integration/tools/patch_frontend.py');
const trace=read('forge-integration/web/forge-rules-trace-v040.js');
const build=read('forge-integration/web/sol-pod-build-v053.js');
new vm.Script(trace);new vm.Script(build);
for(const marker of [
  'liveGame.getGameLog().getAllEntries()',
  'GameLogEntryType.DAMAGE',
  'GameLogEntryType.LIFE',
  'GameLogEntryType.COMBAT',
  'entry.message()',
  'source.isFaceDown()',
  'out.put("damageHistory",recentDamage)'
])assert(projection.includes(marker),'Missing actual Forge public game log: '+marker);
assert(patch.includes('damageHistory:Array.isArray(raw.damageHistory)?raw.damageHistory:[]') &&
       patch.includes('log:(Array.isArray(raw.damageHistory)?raw.damageHistory:[])') &&
       patch.includes('String(e.message||\'\')'),
       'Match history must render the exact resolved Forge messages, not inferred damage');
assert(!patch.includes('const combatDamage='),'No frontend combat damage simulator should be introduced');

let onState=null;
const win={
  CommandTableNative:{onState:fn=>{onState=fn;},request:async()=>({})},
  CommandTableNativeReply:()=>{},
  solPodNotice:()=>{}
};
const ctx={window:win,document:{addEventListener(){}},
  Date,Map,Set,Number,Array,String,JSON,Promise,navigator:{}};
vm.runInNewContext(trace,ctx,{filename:'forge-rules-trace-v040.js'});
assert.equal(typeof onState,'function','The Forge state observer is not attached');
const p=(id,name,life)=>({id,name,life,libraryCount:60,
  graveyard:[],exile:[],battlefield:[],handCount:5});
const raw=(life,damageHistory)=>({
  turn:7,phase:'COMBAT_DAMAGE',players:[p(1,'Defender',life),p(2,'Krenko',40)],
  stack:[],damageHistory,gameOver:false,winner:null
});
onState(raw(35,[
 {index:50,kind:'COMBAT',message:'Krenko was blocked',sourceId:102,sourceName:'Krenko'}
]));
const events=[
 {index:50,kind:'COMBAT',message:'Krenko was blocked',sourceId:102,sourceName:'Krenko'},
 {index:51,kind:'DAMAGE',message:'Goblin A deals 3 combat damage to Defender',sourceId:103,sourceName:'Goblin A'},
 {index:52,kind:'DAMAGE',message:'Goblin B deals 2 combat damage to Defender',sourceId:104,sourceName:'Goblin B'},
 {index:53,kind:'DAMAGE',message:'Some effect deals 2 noncombat damage to Defender',sourceId:105,sourceName:'Some effect'},
 {index:54,kind:'LIFE',message:'Defender life changed from 35 to 28'}
];
onState(raw(28,events));
const recorded=win.ctRulesTrace.events;
assert.equal(recorded.filter(x=>x.kind==='forge-damage').length,3,
  'All three actual Forge damage source entries must be recorded separately');
assert(recorded.some(x=>x.kind==='forge-life'&&x.message.includes('35 to 28')),
  'Actual Forge life change must appear separately from damage');
assert(recorded.some(x=>x.kind==='zone'&&x.zone==='life'&&x.delta===-7),
  'Observed life delta must be retained without claiming that it was all combat damage');
assert(recorded.some(x=>x.kind==='forge-damage'&&x.sourceId===105),
  'Noncombat damage must not disappear from the source breakdown');
onState(raw(28,events));
assert.equal(win.ctRulesTrace.events.filter(x=>x.kind==='forge-damage').length,3,
  'Repeated snapshots must not duplicate native damage entries');
const report=win.ctRulesTrace.report();
assert(report.includes('Some effect deals 2 noncombat damage')&&
       report.includes('Exact resolved rules-engine history entry'),
       'The copyable rules trace must preserve the engine sources verbatim');
if(process.argv[2]){
 const html=read(process.argv[2]);
 assert(html.includes("SOL_POD_BUILD='0.63.0'")&&
        html.includes('damageHistory:Array.isArray(raw.damageHistory)?raw.damageHistory:[]')&&
        html.includes('Some effect deals 2 noncombat damage')===false,
        'Packaged APK must contain the real damage log adapter, not a test fixture');
}
console.log('PASS Sol Pod v0.58: Forge-resolved damage sources, exact life delta, no duplicate logs or JS damage rules');
