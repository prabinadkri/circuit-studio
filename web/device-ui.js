// Shared firmware instruments. GPL-2.0-or-later.
const $=id=>document.getElementById(id);
export function makePins(mcu){
 return mcu.spec.pins.filter(p=>!p.analogOnly).map(p=>{
  const button=document.createElement('button');button.dataset.pin=p.name;
  button.title=`${p.name} · ${mcu.spec.package} pin ${p.physical} · ${p.function}`;
  button.onclick=()=>{mcu.inputs[p.name]=!mcu.inputs[p.name];mcu.render();};
  button.textContent=p.name;return button;
 });
}
export function showDevice(mcu){
 const spec=mcu.spec;
 $('chipModel').textContent=spec.model;
 $('chipName').textContent=spec.label;
 $('deviceSummary').textContent=`${spec.package} · ${spec.clockHz/1e6} MHz · ${spec.flashBytes/1024} KiB HEX program space · ${spec.eepromBytes} B EEPROM`;
 $('deviceNotes').textContent=spec.notes;
 $('datasheet').href=spec.source;
 $('pins').replaceChildren(...mcu.buttons);
 $('pinReference').replaceChildren();
 for(const p of spec.pins){
  const row=document.createElement('tr');
  for(const text of [p.physical,p.name,p.function||'GPIO']){const td=document.createElement('td');td.textContent=text;row.append(td);}
  $('pinReference').append(row);
 }
 $('analogInputs').replaceChildren();
 for(const pin of spec.pins.filter(p=>'analog' in p)){
  const label=document.createElement('label');label.className='analog-control';
  const name=document.createElement('span');name.textContent=pin.name;
  const input=document.createElement('input');input.type='range';input.min=0;input.max=5;input.step=.01;
  input.value=mcu.analogInputs[pin.name]??0;input.dataset.analog=pin.name;input.setAttribute('aria-label',pin.name+' voltage');
  const output=document.createElement('output');output.textContent=Number(input.value).toFixed(2)+' V';
  input.oninput=()=>{mcu.analogInputs[pin.name]=Number(input.value);output.textContent=Number(input.value).toFixed(2)+' V';};
  label.append(name,input,output);$('analogInputs').append(label);
 }
 $('analogPanel').hidden=!spec.pins.some(p=>'analog' in p);
 $('pinBridgeHelp').textContent=`External Voltage components named after a signal below receive outputs (for example ${spec.demoPin}). Labeled nodes prefixed IN_ supply digital or analog input voltages. A connected IN_ node overrides that pin’s manual control.`;
 $('mcuCircuit').textContent=`Load ${spec.demoPin} LED circuit`;
 $('hex').placeholder=`Load compiled ${spec.model} Intel HEX, or try Blink demo. Select the matching chip before loading; HEX files do not identify their target.`;
 $('serial').textContent=spec.engine==='pic'?'PIC serial monitor is not connected.':'USART0 output will appear here.';
 mcu.render();
}
export function renderRegisters(values){
 $('registers').replaceChildren();
 for(const [name,value] of Object.entries(values)){
  const item=document.createElement('span');const b=document.createElement('b');
  b.textContent='0x'+value.toString(16).padStart(2,'0').toUpperCase();item.append(document.createTextNode(name+' '),b);$('registers').append(item);
 }
}
export function inputSnapshot(mcu){
 const sim=mcu.getSim();
 const labels=new Set(sim?.getElements().filter(e=>e.getType()==='LabeledNodeElm').map(e=>e.getLabelName())||[]);
 const inputs={},analog={};
 for(const pin of mcu.spec.pins){
  const name=pin.name;
  const voltage=labels.has('IN_'+name)?sim.getNodeVoltage('IN_'+name):NaN;
  if(!pin.analogOnly)inputs[name]=Number.isFinite(voltage)?voltage>2.5:!!mcu.inputs[name];
  if('analog' in pin)analog[name]=Math.min(5,Math.max(0,Number.isFinite(voltage)?voltage:mcu.analogInputs[name]||0));
 }
 return {inputs,analog};
}

export function renderAnalogSources(mcu){
 const sim=mcu.getSim();
 const labels=new Set(sim?.getElements().filter(e=>e.getType()==='LabeledNodeElm').map(e=>e.getLabelName())||[]);
 for(const input of $('analogInputs').querySelectorAll('input')){
  const name=input.dataset.analog,connected=labels.has('IN_'+name);
  input.disabled=connected;
  const value=connected?sim.getNodeVoltage('IN_'+name):Number(input.value);
  input.nextElementSibling.textContent=value.toFixed(2)+' V'+(connected?' ↗':'');
  input.parentElement.title=connected?'Driven by schematic node IN_'+name:'Manual test voltage';
 }
}
