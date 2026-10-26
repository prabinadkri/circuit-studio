// Circuit Studio integration, GPL-2.0-or-later.
import {MCU, demoHex} from './mcu.js';
import {PICMCU} from './pic.js';
import {BoardEditor} from './pcb.js';
import {gerberZip} from './manufacture.js';
import {showDevice} from './device-ui.js';
const response=await fetch('./devices.json');
if(!response.ok)throw Error('Device catalog unavailable');
const devices=await response.json(),deviceMap=new Map(devices.map(d=>[d.id,d]));
const $=id=>document.getElementById(id);
const frame=$('sim'); let sim, dirty=false, lastSaved='', autosaveTimer, loading=false;
const status=t=>$('status').textContent=t;
const parts=[['Wire','WireElm','─'],['Resistor','ResistorElm','─▱─'],['Capacitor','CapacitorElm','─ǀǀ─'],['Inductor','InductorElm','∿'],['DC source','DCVoltageElm','+ −'],['Ground','GroundElm','⏚'],['Diode','DiodeElm','▷ǀ'],['LED','LEDElm','↗'],['Switch','SwitchElm','╱'],['NPN transistor','NTransistorElm','Q'],['Op amp','OpAmpElm','▷'],['555 timer','TimerElm','555'],['Logic input','LogicInputElm','0/1'],['AND gate','AndGateElm','&'],['OR gate','OrGateElm','≥1'],['NOT gate','InverterElm','¬'],['Voltage probe','OutputElm','V'],['MCU output','ExtVoltageElm','D↗'],['Node label','LabeledNodeElm','N']];
function renderParts(){let q=$('search').value.toLowerCase();$('parts').replaceChildren();for(const [label,type,icon] of parts.filter(p=>p[0].toLowerCase().includes(q))){let b=document.createElement('button');let i=document.createElement('b');i.textContent=icon;b.append(i,document.createTextNode(label));b.onclick=()=>{if(!sim)return;sim.command('main',type);$('mode').textContent=`${label} · click and drag to place`;$('parts').querySelectorAll('button').forEach(x=>x.classList.remove('active'));b.classList.add('active');frame.contentWindow.focus();};$('parts').append(b);}$('partCount').textContent=parts.length;}
renderParts();$('search').oninput=renderParts;
export function download(name,text,type='application/json'){const url=URL.createObjectURL(new Blob([text],{type}));let a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
const safeName=()=>($('projectName').value.trim()||'untitled').replace(/[^a-z0-9_-]/gi,'-');
const avr=new MCU(()=>sim,status,deviceMap.get('avr')),pic=new PICMCU(()=>sim,status,deviceMap.get('pic'));
let mcu=avr,device='avr',firmwareByDevice={avr:'',pic:''};
for(const d of devices){const option=document.createElement('option');option.value=d.id;option.textContent=d.label+' · '+d.clockHz/1e6+' MHz';$('device').append(option);}
function selectDevice(next,remember=true){
 if(!deviceMap.has(next))throw Error('Unsupported microcontroller: '+next);
 mcu.stop();mcu.active=false;mcu.releaseOutputs();
 if(remember)firmwareByDevice[device]=$('hex').value;
 device=next;const spec=deviceMap.get(device);mcu=spec.engine==='pic'?pic:avr;
 mcu.configure(spec);mcu.active=true;$('device').value=device;$('hex').value=firmwareByDevice[device]||'';showDevice(mcu);updateExperiment();
}
selectDevice('avr',false);
$('device').onchange=()=>{selectDevice($('device').value);markDirty();};
const board=new BoardEditor($('board'),status,markDirty);
function project(){firmwareByDevice[device]=$('hex').value;return {format:'circuit-studio',version:1,name:$('projectName').value,schematic:sim.exportCircuit(),firmware:firmwareByDevice.avr||'',picFirmware:firmwareByDevice.pic||'',firmwareByDevice:{...firmwareByDevice},device,board:board.serialize()};}
function markDirty(){dirty=true;}
function checkpoint(){if(!sim||loading)return;const text=JSON.stringify(project());if(text!==lastSaved){dirty=true;try{localStorage.setItem('circuit-studio-autosave',text);}catch{status('Autosave unavailable. Save your project to a file.');}}}
function replaceAllowed(){return !dirty||confirm('Replace the current project? Save a file first if you need to keep it.');}
function parseProject(text){let p=JSON.parse(text);if(p?.format!=='circuit-studio'||p.version!==1||typeof p.schematic!=='string'||typeof p.firmware!=='string'||typeof p.name!=='string')throw Error('Not a supported Circuit Studio project');if(p.picFirmware!==undefined&&typeof p.picFirmware!=='string')throw Error('Invalid PIC firmware');if(p.device!==undefined&&!deviceMap.has(p.device))throw Error('Unsupported project microcontroller');if(p.firmwareByDevice!==undefined){if(!p.firmwareByDevice||typeof p.firmwareByDevice!=='object'||Array.isArray(p.firmwareByDevice))throw Error('Invalid firmware library');for(const [key,value] of Object.entries(p.firmwareByDevice))if(!deviceMap.has(key)||typeof value!=='string'||value.length>1000000)throw Error('Invalid device firmware');}BoardEditor.validate(p.board);return p;}
function loadProject(p){loading=true;mcu.stop();sim.setSimRunning(false);sim.importCircuit(p.schematic,false);$('projectName').value=p.name;avr.clear();pic.clear();firmwareByDevice={avr:p.firmware,pic:p.picFirmware||'',...p.firmwareByDevice};selectDevice(p.device||'avr',false);board.load(p.board);setTimeout(()=>{loading=false;lastSaved=JSON.stringify(project());dirty=false;status('Project opened. Firmware is stopped; press Run firmware to load it.');},100);}
const examples=[['Voltage divider','voltdivide.txt'],['RC low-pass filter','filt-lopass.txt'],['555 oscillator','555square.txt'],['Half-wave rectifier','rectify.txt'],['Digital half adder','halfadd.txt']];
for(const [name,file] of examples){let b=document.createElement('button');b.textContent=name+' ↗';b.onclick=async()=>{if(!sim||!replaceAllowed())return;try{const res=await fetch('engine/circuitjs/circuits/'+file);if(!res.ok)throw Error('Example could not be read');mcu.stop();sim.importCircuit(await res.text(),false);sim.setSimRunning(false);$('projectName').value=name;board.clear();markDirty();status(name+' loaded');}catch(e){status(e.message);}};$('examples').append(b);}
function bindSim(){if(sim)return;sim=frame.contentWindow.CircuitJS1;if(!sim)return;window.studioSim=sim;sim.onsvgrendered=(_,svg)=>download(safeName()+'.svg',svg,'image/svg+xml');sim.onanalyze=()=>{if(!loading)markDirty();};sim.command('main','Select');lastSaved=JSON.stringify(project());dirty=false;status('Ready · choose a component or run the example');clearInterval(readyTimer);autosaveTimer=setInterval(checkpoint,4000);setInterval(updateReadings,200);}
const readyTimer=setInterval(bindSim,150);setTimeout(()=>{if(!sim)status('Engine did not load. Restart Circuit Studio and check the terminal for errors.');},20000);
function updateReadings(){if(!sim)return;const es=sim.getElements();$('count').textContent=es.length;$('time').textContent=sim.getTime().toFixed(4)+' s';$('run').textContent=sim.isRunning()?'Ⅱ Pause':'▶ Run';let resistors=es.filter(e=>e.getType()==='ResistorElm').slice(0,6);$('measurements').replaceChildren();resistors.forEach((e,i)=>{let div=document.createElement('div');div.className='reading';let label=document.createElement('span');label.textContent='R'+(i+1);let val=document.createElement('b');val.textContent=e.getVoltageDiff().toFixed(3)+' V · '+(e.getCurrent()*1000).toFixed(3)+' mA';div.append(label,val);$('measurements').append(div);});}
$('run').onclick=()=>sim?.setSimRunning(!sim.isRunning());$('reset').onclick=()=>sim?.reset();
for(const [id,item] of [['undo','undo'],['redo','redo'],['fit','centercircuit']])$(id).onclick=()=>{sim?.command('edit',item);markDirty();};
$('select').onclick=()=>{sim?.command('main','Select');$('mode').textContent='Select · drag to move components';};
$('new').onclick=()=>{if(!sim||!replaceAllowed())return;avr.clear();pic.clear();firmwareByDevice={avr:'',pic:''};$('hex').value='';board.clear();sim.importCircuit('$ 1 0.000005 10 50 5 50\n',false);sim.setSimRunning(false);$('projectName').value='Untitled circuit';markDirty();};
$('save').onclick=()=>{if(!sim)return;const text=JSON.stringify(project(),null,2);download(safeName()+'.circuit',text);lastSaved=JSON.stringify(project());dirty=false;status('Project downloaded · schematic, firmware and PCB included');};
$('open').onclick=()=>$('file').click();$('file').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f||!sim||!replaceAllowed())return;try{if(f.size>10e6)throw Error('Project is larger than 10 MB');let t=await f.text();if(t.trim().startsWith('{'))loadProject(parseProject(t));else if(/^\s*(\$|<circuit)/.test(t)){avr.clear();pic.clear();firmwareByDevice={avr:'',pic:''};$('hex').value='';board.clear();sim.importCircuit(t,false);sim.setSimRunning(false);$('projectName').value=f.name;markDirty();}else throw Error('Choose a Circuit Studio project or CircuitJS circuit');}catch(e){status('Open failed: '+e.message);}};
$('restore').onclick=()=>{if(!sim||!replaceAllowed())return;try{let t=localStorage.getItem('circuit-studio-autosave');if(!t)throw Error('No autosave is available');loadProject(parseProject(t));}catch(e){status(e.message);}};
$('projectName').oninput=markDirty;$('svg').onclick=()=>sim?.getCircuitAsSVG();$('help').onclick=()=>$('helpDialog').showModal();
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{document.querySelectorAll('nav button,.page').forEach(x=>x.classList.remove('active'));b.classList.add('active');$(b.dataset.page).classList.add('active');if(b.dataset.page==='schematic')frame.contentWindow.dispatchEvent(new Event('resize'));if(b.dataset.page==='pcb')board.render();});
$('loadHex').onclick=()=>$('hexFile').click();$('hexFile').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{if(f.size>1000000)throw Error('HEX file too large');let t=await f.text();await mcu.load(t);$('hex').value=t;markDirty();}catch(e){status(e.message);}};
function updateExperiment(){
 const spec=deviceMap.get(device),hasADC=spec.pins.some(p=>'analog' in p);
 $('experiment').querySelector('[value="adc"]').disabled=!hasADC;
 if(!hasADC&&$('experiment').value==='adc')$('experiment').value='blink';
 const kind=$('experiment').value;
 const stem=spec.engine==='avr'?'atmega328p':spec.id;
 $('demoSource').href='demos/'+stem+'-'+kind+(spec.engine==='pic'?'.asm':kind==='blink'?'.S':'.c');
 $('experimentHelp').textContent=kind==='blink'?`Blink ${spec.demoPin}. Load the LED circuit, then Load demo and Run firmware.`:kind==='button'?`Toggle ${spec.engine==='avr'?'D2':'RB1'} to drive ${spec.demoPin}. Load the LED circuit, then Load demo and Run firmware. A connected IN_ node overrides the manual input button.`:`Sweep ${spec.engine==='avr'?'A0':'RA0'} from 0 to 5 V. Load demo and run; combine ${spec.engine==='avr'?'ADCH × 256 + ADCL':'ADRESH × 256 + ADRESL'} to read the 10-bit ADC result (0–1023).`;
}
$('experiment').onchange=updateExperiment;
$('hex').oninput=()=>{mcu.clear();mcu.render();markDirty();};
$('blink').onclick=async()=>{try{
 const spec=deviceMap.get(device),kind=$('experiment').value;
 let text=demoHex;
 if(spec.engine==='pic'||kind!=='blink'){
  const stem=spec.engine==='avr'?'atmega328p':spec.id;
  const r=await fetch('demos/'+stem+'-'+kind+'.hex');if(!r.ok)throw Error('Demo firmware unavailable');text=await r.text();
 }
 $('hex').value=text;await mcu.load(text);markDirty();status(spec.label+' '+kind+' example loaded');
}catch(e){status(e.message);}};
$('mcuRun').onclick=async()=>{try{if(mcu.running)mcu.stop();else{if(mcu.source!==$('hex').value)await mcu.load($('hex').value);mcu.run();sim?.setSimRunning(true);}}catch(e){status(e.message);}};
$('mcuStep').onclick=async()=>{try{if(mcu.source!==$('hex').value)await mcu.load($('hex').value);await mcu.step();}catch(e){status(e.message);}};
$('mcuReset').onclick=async()=>{try{await mcu.load($('hex').value);}catch(e){status(e.message);}};
$('mcuCircuit').onclick=()=>{if(!sim||!replaceAllowed())return;sim.importCircuit('$ 1 0.000005 10 50 5 50\n418 160 160 160 96 0 1 40 5 0 0 0.5 '+deviceMap.get(device).demoPin+'\nr 160 160 288 160 0 330\n162 288 160 288 272 2 default-led 1 0 0 0.01\ng 288 272 288 304 0 0\n',false);$('projectName').value=deviceMap.get(device).label+' '+deviceMap.get(device).demoPin+' LED';board.clear();markDirty();status('LED circuit loaded in Circuit lab. Load Blink demo and run firmware.');};
$('syncBoard').onclick=()=>{if(!sim)return;if(board.parts.length&&!confirm('Replace PCB placement and tracks with the current schematic?'))return;try{board.fromNetlist(sim.getNetlist());}catch(e){status(e.message);}};
$('boardMove').onclick=()=>board.setMode('move');$('boardRoute').onclick=()=>board.setMode('route');$('boardUndo').onclick=()=>board.undo();$('layer').onchange=()=>board.cancelRoute();$('drc').onclick=()=>board.check();$('deleteTrack').onclick=()=>board.deleteTrack();$('exportBoard').onclick=()=>{try{if(board.sourceNetlist!==BoardEditor.fingerprint(sim.getNetlist()))throw Error('Schematic changed since PCB import. Re-import schematic nets before exporting.');download(safeName()+'.kicad_pcb',board.toKiCad(),'text/plain');status('KiCad board exported. Resolve design checks and verify footprints before fabrication.');}catch(e){status(e.message);}};
window.addEventListener('beforeunload',e=>{checkpoint();if(dirty){e.preventDefault();e.returnValue='';}});
window.addEventListener('keydown',e=>{if(e.key==='Escape')board.cancelRoute();if((e.ctrlKey||e.metaKey)&&e.key==='s'){e.preventDefault();$('save').click();}});

$('gerber').onclick=()=>{try{if(board.sourceNetlist!==BoardEditor.fingerprint(sim.getNetlist()))throw Error('Schematic changed. Re-import nets before exporting.');download(safeName()+'-gerbers.zip',gerberZip(board),'application/zip');status('Gerber ZIP exported with copper, mask, outline and plated drill files.');}catch(e){status(e.message);}};

// Serialize firmware loads and steps so changing devices cannot apply stale results.
const firmwareControls=['device','loadHex','blink','mcuStep','mcuReset','mcuRun','hex','experiment'];
function firmwareOperation(fn){return async function(event){firmwareControls.forEach(id=>$(id).disabled=true);try{await fn.call(this,event);}finally{firmwareControls.forEach(id=>$(id).disabled=false);}};}
for(const id of ['blink','mcuStep','mcuReset','mcuRun'])$(id).onclick=firmwareOperation($(id).onclick);
$('hexFile').onchange=firmwareOperation($('hexFile').onchange);
