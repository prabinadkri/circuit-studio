import {PeripheralLab} from './peripheral-lab.js';
import {setStackup,addSpannedVia,routePair,matchLength,shoveRoute,routeLength} from './routing.js';
import {ReusePanel} from './reuse.js';
// Circuit Studio integration, GPL-2.0-or-later.
import {CompilerPanel} from './compiler.js';
import {placePackage} from './mcu-package.js';
import {Instruments} from './instruments.js';
import {CoupledRunner} from './cosim.js';
import {MCU, demoHex} from './mcu.js';
import {PICMCU} from './pic.js';
import {BoardEditor} from './pcb.js';
import {gerberZip,outputJobZip} from './manufacture.js';
import {showDevice} from './device-ui.js';
import {partIcon} from './part-icons.js';
import {uuid,reconcileDesign,validateProject,ProjectHistory,RecoveryStore} from './project.js';
import {validateLibrary,normalize,capabilityFor} from './library.js';
import {Inspector} from './workbench.js';
import {AnalysisPanel} from './analysis.js';
import {createAutomation} from './automation.js';
const catalog=validateLibrary(await (await fetch('./library.json')).json());
let design={},projectId=uuid();
const history=new ProjectHistory(),recovery=new RecoveryStore(localStorage);
let historyTimer,lastDesignDump='';
const quickTypes=new Set(['WireElm','ResistorElm','CapacitorElm','InductorElm','DCVoltageElm','GroundElm','DiodeElm','LEDElm','SwitchElm','NTransistorElm','OpAmpElm','TimerElm','LogicInputElm','AndGateElm','OrGateElm','InverterElm','OutputElm','ExtVoltageElm','LabeledNodeElm']);
let favorites=new Set();try{const saved=JSON.parse(localStorage.getItem('circuit-studio-favorites')||'[]');if(Array.isArray(saved))favorites=new Set(saved.filter(x=>typeof x==='string'));}catch{}

const response=await fetch('./devices.json');
if(!response.ok)throw Error('Device catalog unavailable');
const devices=await response.json(),deviceMap=new Map(devices.map(d=>[d.id,d]));
const $=id=>document.getElementById(id);
const frame=$('sim'); let sim, dirty=false, lastSaved='', autosaveTimer, loading=false;
const status=t=>$('status').textContent=t;
let selectedPart='';
for(const name of ['Common lab','All components','Favorites',...new Set(catalog.parts.map(p=>p.category))])$('category').append(new Option(name,name));
function renderParts(){
 const q=normalize($('search').value),category=$('category').value;
 const visible=catalog.parts.filter(p=>(category==='Favorites'?favorites.has(p.id):category==='Common lab'?!q?quickTypes.has(p.type):true:category==='All components'||p.category===category)&&normalize([p.label,p.type,...p.aliases].join(' ')).includes(q));
 $('parts').replaceChildren();
 for(const part of visible){
  const {label,type}=part,b=document.createElement('button'),name=document.createElement('span');name.textContent=label;b.dataset.part=type;b.append(partIcon(type),name);
  b.title=label+' · '+part.model.limits;b.setAttribute('aria-pressed',String(selectedPart===type));b.classList.toggle('active',selectedPart===type);
  b.onclick=()=>{if(!sim)return;capture();sim.command('main',type);selectedPart=type;$('mode').textContent=label+' · '+(type==='WireElm'?'drag between pins':'click empty space to place');renderParts();showLibraryPart(part);frame.contentWindow.focus();};$('parts').append(b);
 }
 if(!visible.length){const empty=document.createElement('p');empty.className='parts-empty';empty.textContent='No matching components. Try another name or category.';$('parts').append(empty);}
 $('partCount').textContent=visible.length+' / '+catalog.parts.length;
}
function showLibraryPart(part){$('libraryDetails').replaceChildren();const title=document.createElement('strong');title.textContent=part.label;const info=document.createElement('p');info.textContent=part.model.limits;const badge=document.createElement('p');badge.className='capability';badge.textContent='Symbol + simulation · '+(part.fixtures.length?'Placement fixture':'Electrical model unvalidated');const favorite=document.createElement('button');favorite.textContent=favorites.has(part.id)?'Remove favorite':'Add favorite';favorite.onclick=()=>{if(favorites.has(part.id))favorites.delete(part.id);else favorites.add(part.id);localStorage.setItem('circuit-studio-favorites',JSON.stringify([...favorites]));renderParts();showLibraryPart(part);};$('libraryDetails').append(title,badge,info,favorite);}
renderParts();$('search').oninput=renderParts;$('category').onchange=renderParts;

export function download(name,text,type='application/json'){const url=URL.createObjectURL(new Blob([text],{type}));let a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
const safeName=()=>($('projectName').value.trim()||'untitled').replace(/[^a-z0-9_-]/gi,'-');
const avr=new MCU(()=>sim,status,deviceMap.get('avr')),pic=new PICMCU(()=>sim,status,deviceMap.get('pic'));
let mcu=avr,device='avr',firmwareByDevice={avr:'',pic:''};
const clock=new CoupledRunner(()=>sim,()=>mcu,status);window.studioClock=clock;
const peripheralLab=new PeripheralLab(clock,()=>sim,markDirty,status,download);window.studioPeripherals=peripheralLab;
const instruments=new Instruments(clock,download,status);window.studioInstruments=instruments;
const compiler=new CompilerPanel(()=>mcu,clock,markDirty,status,()=>projectId);window.studioCompiler=compiler;
for(const d of devices){const option=document.createElement('option');option.value=d.id;option.textContent=d.label+' · '+d.clockHz/1e6+' MHz';$('device').append(option);}
function selectDevice(next,remember=true){
 if(!deviceMap.has(next))throw Error('Unsupported microcontroller: '+next);
 clock.detach();mcu.stop();mcu.active=false;mcu.releaseOutputs();
 if(remember)firmwareByDevice[device]=$('hex').value;
 device=next;const spec=deviceMap.get(device);mcu=spec.engine==='pic'?pic:avr;
 mcu.configure(spec);mcu.active=true;$('device').value=device;$('hex').value=firmwareByDevice[device]||'';showDevice(mcu);updateExperiment();
}
selectDevice('avr',false);
$('device').onchange=()=>{selectDevice($('device').value);markDirty();};
const board=new BoardEditor($('board'),status,markDirty);
const reuse=new ReusePanel(()=>sim,currentDesign,()=>board,()=>{lastDesignDump='';markDirty();capture();},status,download);window.studioReuse=reuse;
const analysis=new AnalysisPanel(()=>{markDirty();capture();},status,download);
function renderOutline(d){const select=$('componentOutline'),key=d.instances.map(e=>e.id+e.reference).join();if(select.dataset.key===key)return;const selected=select.value;select.replaceChildren(...d.instances.map(e=>new Option(e.reference+' · '+e.type.replace('Elm',''),e.id)));select.value=selected;select.dataset.key=key;}
function currentDesign(){const dump=sim.exportCircuit(false);if(dump!==lastDesignDump){design=reconcileDesign(sim.getDesignElements(),design);lastDesignDump=sim.exportCircuit(false);renderOutline(design);}return design;}
function project(){firmwareByDevice[device]=$('hex').value;const d=currentDesign();return {format:'circuit-studio',version:2,id:projectId,name:$('projectName').value,schematic:sim.exportCircuit(),design:d,library:{revision:catalog.revision,assets:d.instances.map(e=>({instanceId:e.id,libraryId:capabilityFor(catalog,e).id,revision:1,provenance:capabilityFor(catalog,e).provenance||null,footprint:e.meta?.footprint||null,padMap:e.meta?.padMap||[]}))},firmware:firmwareByDevice.avr||'',picFirmware:firmwareByDevice.pic||'',firmwareByDevice:{...firmwareByDevice},device,simulation:{mode:$('timingMode').value,quantumUs:Number($('couplingQuantum').value)},board:board.serialize(),analysis:analysis.serialize(),firmwareWorkspace:compiler.serialize(),reuse:reuse.serialize(),peripherals:peripheralLab.serialize()};}
function historyDocument(){const p=project();p.schematic=sim.exportCircuit(false);return p;}
function capture(){if(!sim||loading)return;history.capture(historyDocument());}
const inspector=new Inspector(()=>sim,currentDesign,catalog,()=>{lastDesignDump='';markDirty();capture();},status);
$('inspectOutline').onclick=()=>{const id=$('componentOutline').value;if(id){sim.selectElement(id,true);inspector.show(id);}};
$('componentOutline').onkeydown=e=>{if(e.key==='Enter')$('inspectOutline').click();};
inspector.onFirmware=id=>{if(device!==id)selectDevice(id);document.querySelector('nav [data-page=firmware]').click();};
function markDirty(){dirty=true;$('saveState').textContent='Unsaved changes';}
function checkpoint(){if(!sim||loading)return;const p=historyDocument(),text=JSON.stringify(p);if(text!==lastSaved){dirty=true;try{recovery.save(p);$('saveState').textContent='Recovered locally · unsaved file';}catch{status('Recovery storage unavailable. Save a project file.');}}}
function replaceAllowed(){return !dirty||confirm('Replace the current project? Save a file first if you need to keep it.');}
function parseProject(text){return validateProject(JSON.parse(text),deviceMap,BoardEditor.validate);}
function loadProject(p,fromHistory=false){clock.detach();peripheralLab.load(p.peripherals);compiler.load(p.firmwareWorkspace);reuse.load(p.reuse);$('timingMode').value=p.simulation?.mode||'legacy';$('couplingQuantum').value=String(p.simulation?.quantumUs||1);clock.quantum=Number($('couplingQuantum').value)*2000;loading=true;mcu.stop();sim.setSimRunning(false);projectId=p.id||uuid();design=p.design||{};lastDesignDump='';sim.importCircuit(p.schematic,false);$('projectName').value=p.name;avr.clear();pic.clear();firmwareByDevice={avr:p.firmware,pic:p.picFirmware||'',...p.firmwareByDevice};selectDevice(p.device||'avr',false);board.load(p.board);analysis.load(p.analysis);(()=>{loading=false;lastSaved=JSON.stringify(historyDocument());dirty=fromHistory;$('saveState').textContent=fromHistory?'Unsaved changes':'Project opened';if(!fromHistory)history.reset(historyDocument());inspector.show(null);$('ercResults').replaceChildren();$('ercSummary').textContent='Not run';status(fromHistory?'Project edit restored':'Project opened · firmware stopped');})();}
function travel(direction){capture();const p=history[direction]();if(p)loadProject(p,true);}
const examples=[['Voltage divider','voltdivide.txt'],['RC low-pass filter','filt-lopass.txt'],['555 oscillator','555square.txt'],['Half-wave rectifier','rectify.txt'],['Digital half adder','halfadd.txt']];
for(const [name,file] of examples){let b=document.createElement('button');b.textContent=name+' ↗';b.onclick=async()=>{if(!sim||!replaceAllowed())return;try{const res=await fetch('engine/circuitjs/circuits/'+file);if(!res.ok)throw Error('Example could not be read');mcu.stop();sim.importCircuit(await res.text(),false);sim.setSimRunning(false);$('projectName').value=name;board.clear();design={};lastDesignDump='';markDirty();capture();status(name+' loaded');}catch(e){status(e.message);}};$('examples').append(b);}
function bindSim(){if(sim)return;sim=frame.contentWindow.CircuitJS1;if(!sim)return;window.studioSim=sim;window.studioAutomation=createAutomation({sim,project,load:loadProject,validate:p=>validateProject(p,deviceMap,BoardEditor.validate),board,catalog,devices:deviceMap,setDevice:id=>{selectDevice(id);$('timingMode').value='coupled';},capture,changed:markDirty});sim.onhistorycommand=direction=>travel(direction);sim.onsvgrendered=(_,svg)=>download(safeName()+'.svg',svg,'image/svg+xml');sim.onanalyze=()=>{if(!loading)markDirty();};sim.command('main','Select');lastSaved=JSON.stringify(historyDocument());history.reset(historyDocument());historyTimer=setInterval(capture,300);frame.contentDocument.addEventListener('pointerdown',()=>{if(clock.running){clock.detach();status('Firmware paused for schematic editing. Reset CPU after changing connections.');}},true);frame.contentDocument.addEventListener('pointerup',()=>setTimeout(()=>{capture();const id=sim.getSelection();if(id){sim.selectElement(id);inspector.show(id);}},30));frame.contentDocument.addEventListener('keydown',shortcut,true);dirty=false;status('Ready · choose a component or run the example');openInitialProject();clearInterval(readyTimer);autosaveTimer=setInterval(checkpoint,4000);setInterval(updateReadings,200);}
const readyTimer=setInterval(bindSim,150);setTimeout(()=>{if(!sim)status('Engine did not load. Restart Circuit Studio and check the terminal for errors.');},20000);
function updateReadings(){if(!sim)return;const es=sim.getElements();$('count').textContent=es.length;$('time').textContent=sim.getTime().toFixed(4)+' s';$('run').textContent=sim.isRunning()?'Ⅱ Pause':'▶ Run';let resistors=es.filter(e=>e.getType()==='ResistorElm').slice(0,6);$('measurements').replaceChildren();resistors.forEach((e,i)=>{let div=document.createElement('div');div.className='reading';let label=document.createElement('span');label.textContent='R'+(i+1);let val=document.createElement('b');val.textContent=e.getVoltageDiff().toFixed(3)+' V · '+(e.getCurrent()*1000).toFixed(3)+' mA';div.append(label,val);$('measurements').append(div);});}
$('run').onclick=()=>{if(clock.running){clock.stop();return;}if(clock.source){status('Use Run firmware to resume the shared timeline, or choose Independent timing.');return;}sim?.setSimRunning(!sim.isRunning());};$('reset').onclick=()=>{clock.detach();sim?.reset();};
$('undo').onclick=()=>travel('undo');$('redo').onclick=()=>travel('redo');$('fit').onclick=()=>sim?.command('edit','centercircuit');
$('select').onclick=()=>{sim?.command('main','Select');selectedPart='';renderParts();$('mode').textContent='Select · drag to move components';};
$('new').onclick=()=>{if(!sim||!replaceAllowed())return;capture();compiler.load(null);peripheralLab.load();reuse.load();analysis.load(null);projectId=uuid();design={};lastDesignDump='';avr.clear();pic.clear();firmwareByDevice={avr:'',pic:''};$('hex').value='';board.clear();sim.importCircuit('$ 1 0.000005 10 50 5 50\n',false);sim.setSimRunning(false);$('projectName').value='Untitled circuit';markDirty();capture();};
$('save').onclick=()=>{if(!sim)return;const text=JSON.stringify(project(),null,2);download(safeName()+'.circuit',text);lastSaved=JSON.stringify(historyDocument());dirty=false;$('saveState').textContent='File exported';status('Project downloaded · schematic, firmware and PCB included');};
$('open').onclick=()=>$('file').click();$('file').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f||!sim||!replaceAllowed())return;try{if(f.size>10e6)throw Error('Project is larger than 10 MB');let t=await f.text();if(t.trim().startsWith('{'))loadProject(parseProject(t));else if(/^\s*(\$|<circuit)/.test(t)){avr.clear();pic.clear();firmwareByDevice={avr:'',pic:''};$('hex').value='';board.clear();sim.importCircuit(t,false);sim.setSimRunning(false);$('projectName').value=f.name;markDirty();}else throw Error('Choose a Circuit Studio project or CircuitJS circuit');}catch(e){status('Open failed: '+e.message);}};
$('restore').onclick=()=>{if(!sim||!replaceAllowed())return;try{const saved=recovery.read();const legacy=localStorage.getItem('circuit-studio-autosave');if(saved)loadProject(parseProject(JSON.stringify(saved.project)));else if(legacy)loadProject(parseProject(legacy));else throw Error('No recovery copy available');}catch(e){status(e.message);}};
$('projectName').oninput=markDirty;$('svg').onclick=()=>sim?.getCircuitAsSVG();$('help').onclick=()=>$('helpDialog').showModal();
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{document.querySelectorAll('nav button,.page').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.querySelectorAll('nav button').forEach(item=>item.setAttribute('aria-current',item===b?'page':'false'));$(b.dataset.page).classList.add('active');if(b.dataset.page==='schematic')frame.contentWindow.dispatchEvent(new Event('resize'));if(b.dataset.page==='pcb')board.render();if(b.dataset.page==='reuse')reuse.render();if(b.dataset.page==='mechanical')refresh3d();});
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
$('poweredMCU').onclick=async()=>{if(!sim||!replaceAllowed())return;try{const response=await fetch('demos/powered-atmega328p.circuit');if(!response.ok)throw Error('Example unavailable');const p=parseProject(await response.text());loadProject({...p,id:uuid()});markDirty();status('Powered ATmega328P example opened · Run firmware to start');}catch(e){status(e.message);}};
$('placeMCU').onclick=()=>{try{capture();clock.detach();placePackage(sim,deviceMap.get(device));$('timingMode').value='coupled';markDirty();capture();document.querySelector('nav [data-page=schematic]').click();status('MCU placed. Wire all supply/ground pins and pull reset high; attach firmware in Firmware. Clock is fixed at the displayed frequency.');}catch(e){status(e.message);}};
$('mcuRun').onclick=async()=>{try{if(mcu.running)mcu.stop();else{if(mcu.source!==$('hex').value)await mcu.load($('hex').value);if($('timingMode').value==='coupled'){if(clock.source!==mcu&&(mcu.cpu?.cycles??mcu.state.cycles)>0)await mcu.load($('hex').value);await clock.start();}else{if(sim.getDesignElements().some(e=>e.engineType==='MCUPackageElm'))throw Error('Schematic MCU packages require Shared timeline timing');clock.detach();mcu.run();sim?.setSimRunning(true);}}}catch(e){status(e.message);}};
$('mcuStep').onclick=async()=>{try{if(mcu.source!==$('hex').value)await mcu.load($('hex').value);if($('timingMode').value==='coupled'){clock.stop();await clock.idle();if(mcu.debug?.paused){mcu.debug.skip=mcu.cpu.pc;mcu.debug.paused=false;}await clock.step();mcu.render();}else await mcu.step();}catch(e){status(e.message);}};
$('mcuReset').onclick=async()=>{try{clock.detach();await mcu.load($('hex').value);}catch(e){status(e.message);}};
$('mcuCircuit').onclick=()=>{if(!sim||!replaceAllowed())return;sim.importCircuit('$ 1 0.000005 10 50 5 50\n418 160 160 160 96 0 1 40 5 0 0 0.5 '+deviceMap.get(device).demoPin+'\nr 160 160 288 160 0 330\n162 288 160 288 272 2 default-led 1 0 0 0.01\ng 288 272 288 304 0 0\n',false);$('projectName').value=deviceMap.get(device).label+' '+deviceMap.get(device).demoPin+' LED';board.clear();markDirty();status('LED circuit loaded in Circuit lab. Load Blink demo and run firmware.');};
let boardPlan=null;
$('syncBoard').onclick=()=>{if(!sim)return;try{capture();boardPlan=board.planUpdate(currentDesign().instances);const s=boardPlan.summary;$('boardChanges').textContent=`Add: ${s.added.join(', ')||'none'}\nRemove: ${s.removed.join(', ')||'none'}\nChange: ${s.changed.join(', ')||'none'}\nNet changes: ${s.netChanges.map(c=>c.ref+':'+c.pad+' '+String(c.from).slice(0,8)+' → '+String(c.to).slice(0,8)).join('; ')||'none'}\nPreserve ${s.preservedRoutes} routes; remove ${s.removedRoutes} affected routes.`;if(!board.parts.length){board.applyUpdate(boardPlan);capture();}else $('boardUpdateDialog').showModal();}catch(e){status(e.message);}};
$('applyBoardUpdate').onclick=()=>{try{board.applyUpdate(boardPlan);capture();$('boardUpdateDialog').close();}catch(e){status(e.message);}};
$('boardRotate').onclick=()=>{capture();board.rotateSelected();capture();};$('boardFlip').onclick=()=>{capture();board.flipSelected();capture();};
$('addVia').onclick=()=>{capture();board.dropVia();capture();};$('deleteVia').onclick=()=>{capture();board.deleteVia();capture();};$('pourZone').onclick=()=>{capture();board.pourLayer();capture();};$('clearZone').onclick=()=>{capture();board.clearZones();capture();};
$('boardMove').onclick=()=>board.setMode('move');$('boardRoute').onclick=()=>board.setMode('route');$('boardUndo').onclick=()=>travel('undo');$('layer').onchange=()=>board.cancelRoute();$('drc').onclick=()=>board.check();$('deleteTrack').onclick=()=>board.deleteTrack();$('exportBoard').onclick=()=>{try{if(board.sourceNetlist!==BoardEditor.fingerprint(currentDesign().instances))throw Error('Schematic changed since PCB import. Re-import schematic nets before exporting.');download(safeName()+'.kicad_pcb',board.toKiCad(),'text/plain');status('KiCad board exported. Resolve design checks and verify footprints before fabrication.');}catch(e){status(e.message);}};
window.addEventListener('beforeunload',e=>{checkpoint();if(dirty){e.preventDefault();e.returnValue='';}});
function shortcut(e){
 const typing=/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)||e.target.isContentEditable;
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();e.stopImmediatePropagation();$('save').click();return;}
 if(typing)return;
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.stopImmediatePropagation();travel(e.shiftKey?'redo':'undo');}
 if(e.key==='Escape'){board.cancelRoute();sim?.command('main','Select');selectedPart='';renderParts();$('mode').textContent='Select · drag to move';}
}
window.addEventListener('keydown',shortcut,true);
for(const [id,cmd]of [['rotate','rotateCW'],['mirror','mirrorX'],['copy','copy'],['paste','paste'],['remove','delete']])$(id).onclick=()=>{capture();sim?.command('edit',cmd);lastDesignDump='';capture();};
$('erc').onclick=()=>inspector.checks();
window.studioBoard=board;window.studioAnalysis=analysis;
window.studioProject={get:project,load:loadProject,validate:p=>validateProject(p,deviceMap,BoardEditor.validate),design:currentDesign,history,check:()=>inspector.checks()};


$('gerber').onclick=()=>{try{if(board.sourceNetlist!==BoardEditor.fingerprint(currentDesign().instances))throw Error('Schematic changed. Re-import nets before exporting.');download(safeName()+'-gerbers.zip',gerberZip(board),'application/zip');status('Gerber ZIP exported with copper, mask, outline and plated drill files.');}catch(e){status(e.message);}};

// Serialize firmware loads and steps so changing devices cannot apply stale results.
const firmwareControls=['device','loadHex','blink','mcuStep','mcuReset','mcuRun','hex','experiment'];
function firmwareOperation(fn){return async function(event){firmwareControls.forEach(id=>$(id).disabled=true);try{await fn.call(this,event);}finally{firmwareControls.forEach(id=>$(id).disabled=false);}};}
for(const id of ['blink','mcuStep','mcuReset','mcuRun'])$(id).onclick=firmwareOperation($(id).onclick);
$('hexFile').onchange=firmwareOperation($('hexFile').onchange);

async function projectRequest(payload){const session=await (await fetch('/api/session')).json();if(!session.capabilities?.includes('project-store'))throw Error('Save a file and reopen Circuit Studio to enable local project storage.');const r=await fetch('/api/projects',{method:'POST',headers:{'Content-Type':'application/json','X-Studio-Token':session.token},body:JSON.stringify(payload)});const data=await r.json();if(!r.ok)throw Error(data.error||'Project storage failed');return data;}
$('saveLocal').onclick=async()=>{try{await projectRequest({action:'save',project:project()});lastSaved=JSON.stringify(historyDocument());dirty=false;$('saveState').textContent='Saved on disk';status('Project saved atomically in the app projects folder');}catch(e){status(e.message);}};
$('localProjects').onclick=async()=>{try{const projects=await projectRequest({action:'list'});$('projectList').replaceChildren();for(const p of projects){const b=document.createElement('button');b.textContent=p.name+' · '+new Date(p.modified*1000).toLocaleString();b.onclick=async()=>{if(!replaceAllowed())return;try{loadProject(parseProject(JSON.stringify(await projectRequest({action:'load',id:p.id}))));$('projectsDialog').close();}catch(e){status(e.message);}};$('projectList').append(b);}if(!projects.length)$('projectList').textContent='No saved projects yet. Use Save locally.';$('projectsDialog').showModal();}catch(e){status(e.message);}};

let preview3d;
async function refresh3d(){try{const {BoardPreview}=await import('./board3d.js');if(!preview3d)preview3d=new BoardPreview($('board3d'),board);preview3d.refresh($('components3d').checked);}catch(e){status('3D preview unavailable: '+e.message);$('board3d').textContent='WebGL is unavailable. You can still export the geometry for another 3D viewer.';}}
$('refresh3d').onclick=refresh3d;$('components3d').onchange=refresh3d;
for(const direction of ['top','bottom','iso'])$(direction+'3d').onclick=()=>preview3d?.view(direction);
$('exportGltf').onclick=async()=>{try{const {gltf,mechanicalManifest}=await import('./board3d.js');download(safeName()+'.gltf',JSON.stringify(await gltf(board,{components:$('components3d').checked})));download(safeName()+'-mechanical.json',JSON.stringify(mechanicalManifest(board),null,2));status('glTF exported in meters with package origin manifest');}catch(e){status(e.message);}};
$('exportStl').onclick=async()=>{try{const {stl}=await import('./board3d.js');download(safeName()+'.stl',stl(board,{components:$('components3d').checked}),'model/stl');status('STL assembly exported in millimeters · approximate package bodies');}catch(e){status(e.message);}};

// Explicit file handoff: the assistant edits a copy, never the live editor buffer.
let assistantSession=null,assistantResult=null,assistantBusy=false;
async function assistantRequest(payload){const session=await(await fetch('/api/session')).json();const r=await fetch('/api/assistant',{method:'POST',headers:{'Content-Type':'application/json','X-Studio-Token':session.token},body:JSON.stringify(payload)});const data=await r.json();if(!r.ok)throw Error(data.error||'Circuit assistant unavailable');return data;}
function assistantButtons(){for(const id of ['assistantStart','assistantReopen','assistantCheck','assistantApply'])$(id).disabled=assistantBusy;$('assistantReopen').hidden=!assistantSession;$('assistantCheck').hidden=!assistantSession;}
async function assistantAction(fn){if(assistantBusy)return;assistantBusy=true;assistantButtons();try{await fn();}catch(e){$('assistantState').textContent=e.message;}finally{assistantBusy=false;assistantButtons();}}
$('assistant').onclick=()=>{if(!sim)return;$('assistantDialog').showModal();};
$('assistantStart').onclick=()=>assistantAction(async()=>{const snapshot=historyDocument();$('assistantState').textContent='Preparing your circuit workspace…';const result=await assistantRequest({action:'prepare',project:snapshot});assistantSession={...result,baseline:JSON.stringify(snapshot),projectId};assistantResult=null;$('assistantResult').hidden=true;$('assistantState').textContent='Opening Coding Hub…';await assistantRequest({action:'open',workspace:result.workspace});$('assistantState').textContent='Your circuit chat is ready in Coding Hub. Describe your changes, then return here and check for the result.';});
$('assistantReopen').onclick=()=>assistantAction(async()=>{await assistantRequest({action:'open',workspace:assistantSession.workspace});$('assistantState').textContent='Coding Hub opened with your circuit workspace.';});
$('assistantCheck').onclick=()=>assistantAction(async()=>{assistantResult=null;$('assistantResult').hidden=true;const result=await assistantRequest({action:'result',workspace:assistantSession.workspace});if(result.revision===assistantSession.revision){$('assistantResult').hidden=true;$('assistantState').textContent='No saved changes yet. Wait for Coding Hub to finish, then check again.';return;}assistantResult=parseProject(JSON.stringify(result.project));if(assistantResult.id!==assistantSession.projectId)throw Error('The assistant changed the project identity. Ask it to preserve the original project ID.');$('assistantSummary').textContent=`${assistantResult.name} · ${assistantResult.design?.instances?.length||0} schematic objects · ${assistantResult.board?.parts?.length||0} PCB components. Review the circuit after opening it; checks are reported in the Coding Hub chat.`;$('assistantResult').hidden=false;$('assistantState').textContent='A saved result is ready. Bring it into the editor or save a separate copy.';});
$('assistantApply').onclick=()=>assistantAction(async()=>{if(JSON.stringify(historyDocument())!==assistantSession.baseline)throw Error('You changed the circuit here after starting the chat. Save the edited copy instead, or start a new chat from your current circuit.');capture();loadProject(assistantResult,true);capture();$('assistantDialog').close();assistantSession=null;assistantResult=null;$('assistantResult').hidden=true;markDirty();status('Coding Hub result opened · Undo restores your previous circuit');});
$('assistantDownload').onclick=()=>{if(assistantResult)download('assistant-result.circuit',JSON.stringify(assistantResult,null,2));};
async function openInitialProject(){try{const data=await assistantRequest({action:'initial'});if(data.project)loadProject(parseProject(JSON.stringify(data.project)));}catch(e){status('Could not open startup project: '+e.message);}}

$('timingMode').onchange=()=>{clock.detach();mcu.stop();markDirty();status('Timing mode changed. Reset CPU before single-stepping a new shared timeline.');};$('couplingQuantum').onchange=()=>{clock.stop();clock.quantum=Number($('couplingQuantum').value)*2000;markDirty();};

$('instrumentRun').onclick=()=>$('mcuRun').click();

const routeAction=fn=>()=>{try{capture();fn();markDirty();capture();}catch(e){status(e.message);}};
$('setStack').onclick=routeAction(()=>setStackup(board,$('stackCount').value));
$('tuneRoute').onclick=routeAction(()=>{const i=Number($('tuneIndex').value);const length=matchLength(board,i,Number($('tuneLength').value),Number($('tuneSide').value));status('Route tuned to '+length?.toFixed(3)+' mm');});
$('createPair').onclick=routeAction(()=>{routePair(board,{positive:{from:$('pairPFrom').value,to:$('pairPTo').value},negative:{from:$('pairNFrom').value,to:$('pairNTo').value},layer:$('layer').value,gap:Number($('pairGap').value),tolerance:Number($('pairTolerance').value)});status('Constrained differential pair placed');});
$('shoveRoute').onclick=routeAction(()=>{if(!board.pending)throw Error('Start a route from a pad and add its bend points first');const n=shoveRoute(board,{...board.pending,to:$('shoveEnd').value,layer:$('layer').value});board.pending=null;status('Route placed; '+n+' existing routes moved');});
$('spanVia').onclick=routeAction(()=>{const anchor=board.anchors().find(p=>p.id===$('viaAnchor').value);if(!anchor||anchor.net===null)throw Error('Enter a connected pad or via ID for the via net');addSpannedVia(board,{id:'via:'+crypto.randomUUID(),net:anchor.net,x:Number($('viaX').value),y:Number($('viaY').value),kind:$('viaKind').value,span:[$('viaFrom').value,$('viaTo').value],diameter:Number($('viaDiameter').value),drill:Number($('viaDrill').value)});});
$('outputJob').onclick=()=>{try{if(board.sourceNetlist!==BoardEditor.fingerprint(currentDesign().instances))throw Error('Update the PCB before running an output job');download(safeName()+'-outputs.zip',outputJobZip(board,{fabrication:$('jobFab').checked,bom:$('jobBOM').checked,variant:reuse.variant()}),'application/zip');status('Checked output job exported');}catch(e){status(e.message);}};

peripheralLab.onExample=async()=>{if(!sim||!replaceAllowed())return;try{const r=await fetch('demos/peripheral-lab.circuit');if(!r.ok)throw Error('Peripheral example unavailable');loadProject(parseProject(await r.text()));markDirty();document.querySelector('nav [data-page=firmware]').click();status('Peripheral lab opened · Run firmware, then view Instruments');}catch(e){status(e.message);}};
