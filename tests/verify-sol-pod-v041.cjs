'use strict';
// Behavioural regression for Forge's full-screen combat-damage decision.
// No browser libraries: emulate the decision DOM and submit to a fake native bridge.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const choice=fs.readFileSync('forge-integration/web/forge-choice.js','utf8');
const dispatcher=fs.readFileSync(
  'forge-integration/src/main/java/forge/commandtable/CommandTableChoiceDispatcher.java','utf8');
assert(dispatcher.includes('case "assignCombatDamage"'),
  'Combat damage must continue through Forge');
assert(dispatcher.includes('if (assignedTotal != ticket.requiredTotal)'),
  'Native Forge choice validation must still reject incorrect allocation totals');
new vm.Script(choice,{filename:'forge-choice.js'});

class El {
  constructor(tag) {
    this.tag=tag.toLowerCase();this.children=[];this.parentNode=null;
    this.style={};this.dataset={};this.attrs={};this.textContent='';
    this.value='';this.disabled=false;
  }
  append(...nodes){for(const node of nodes){node.parentNode=this;this.children.push(node);}}
  replaceChildren(...nodes){this.children=[];this.append(...nodes);}
  setAttribute(key,value){this.attrs[key]=String(value);}
  querySelector(query) {
    const matches=node=>
      (query==='[data-ct-choice-confirm]' && node.dataset.ctChoiceConfirm==='1') ||
      (query==='[data-ct-error]' && node.dataset.ctError==='1') ||
      (query==='[data-ct-choice-value]' && node.dataset.ctChoiceValue==='1');
    function visit(node) {
      if(matches(node))return node;
      for(const child of node.children){const found=visit(child);if(found)return found;}
      return null;
    }
    return visit(this);
  }
}
const document={body:new El('body'),head:new El('head'),createElement:tag=>new El(tag)};
const calls=[];
const window={CommandTableNative:{request:async(type,payload)=>{
  calls.push({type,payload});return {accepted:true};
}}};
vm.runInNewContext(choice,{window,document,setTimeout:()=>1,clearTimeout:()=>{}},
  {filename:'forge-choice.js'});
function all(tag) {
  const output=[];
  function visit(element){
    if(element.tag===tag)output.push(element);
    element.children.forEach(visit);
  }
  visit(document.body);return output;
}
function offer(id,amount=7,minEach=0) {
  window.CommandTableNativeReply({type:'game.choice',payload:{
    id,mode:'allocation',title:'Assign '+amount+' combat damage from Etali, Primal Storm',
    amount,minEach,min:0,max:3,unit:'combat damage',
    options:[{label:'Goblin Sledder'},{label:'Iron Myr'},{label:'Defending player'}]
  }});
}
function confirmButton(){
  const button=all('button').find(e=>e.textContent==='Confirm choice');
  assert(button,'Forge damage choice must show Confirm choice');
  return button;
}
function update(inputs,index,value){
  inputs[index].value=value;
  inputs[index].oninput();
}
async function main() {
  offer('damage-7');
  const inputs=all('input'),confirm=confirmButton();
  assert.equal(inputs.length,3);
  assert.equal(confirm.disabled,true,'Incomplete total must disable confirmation');
  update(inputs,0,'7');
  assert.equal(confirm.disabled,false,'7/0/0 should enable Confirm immediately');
  assert.equal(all('input')[0],inputs[0],'Do not rebuild focused input/keyboard');
  assert(all('div').some(e=>e.textContent==='Total: 7 · 0 remaining'),
    'Counter should agree with enabled confirmation');
  update(inputs,0,'3');
  assert.equal(confirm.disabled,true,'3/0/0 is incomplete');
  update(inputs,1,'4');
  assert.equal(confirm.disabled,false,'3/4/0 is valid');
  update(inputs,1,'');
  assert.equal(confirm.disabled,true,'Blank numbers must not be silently zeroed');
  update(inputs,1,'4');
  assert.equal(confirm.disabled,false);
  update(inputs,2,'1');
  assert.equal(confirm.disabled,true,'Over-assignment must disable Confirm');
  update(inputs,2,'0');
  assert.equal(confirm.disabled,false,'Returning to exact total must re-enable');
  update(inputs,1,'4.5');
  assert.equal(confirm.disabled,true,'Fractions are invalid');
  update(inputs,1,'4');
  assert.equal(confirm.disabled,false);
  update(inputs,1,'-1');
  assert.equal(confirm.disabled,true,'Negative damage is invalid');
  update(inputs,1,'4');
  assert.equal(confirm.disabled,false);
  confirm.onclick();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(calls.length,1,'One confirmation must send one Forge answer');
  assert.equal(calls[0].type,'choice.answer');
  assert.equal(calls[0].payload.choiceId,'damage-7');
  assert.equal(JSON.stringify(calls[0].payload.allocation),
    JSON.stringify({'0':3,'1':4,'2':0}),
    'Original Forge-recipient indices and exact numeric amounts must be preserved');
  assert.equal(calls[0].payload.cancelled,false);
  // Generic Forge amount distribution uses the same component, with mandatory
  // minimum-per-recipient values. These must not be broken by the damage fix.
  offer('generic-min-one',3,1);
  const minInputs=all('input'),minConfirm=confirmButton();
  assert.equal(minConfirm.disabled,false,'1/1/1 is valid at creation');
  update(minInputs,0,'0');
  assert.equal(minConfirm.disabled,true,'Forge minimum-per-recipient must apply');
  update(minInputs,0,'1');
  assert.equal(minConfirm.disabled,false);
  offer('zero-total',0,0);
  assert.equal(confirmButton().disabled,false,'Zero total is valid with all-zero recipients');
  const bundled=process.argv[2];
  if(bundled) {
    const html=fs.readFileSync(bundled,'utf8');
    assert(html.includes('function allocationStatus()'),
      'Embedded Android HTML must include allocation validation');
    assert(html.includes("ok.dataset.ctChoiceConfirm='1'"),
      'Embedded Android UI must update the same confirm button');
  }
  console.log('PASS Sol Pod v0.41: combat damage confirmation, keyboard focus, '+
    'invalid inputs, minEach and Forge payload');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
