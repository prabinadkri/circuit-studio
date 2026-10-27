import {setStackup,addSpannedVia,routePair,matchLength,shoveRoute} from './routing.js';
// Structured, transactional editor operations for local coding agents. GPL-2.0-or-later.
import {captureBlock} from './reuse.js';
import {placePackage,packageDefinition} from './mcu-package.js';
import {electricalCheck} from './library.js';
import {parseEngineering} from './project.js';
import {FOOTPRINTS} from './footprints.js';
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const reference=v=>typeof v==='string'&&/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(v);
export function createAutomation({sim,project,load,validate,board,catalog,devices,setDevice,capture,changed}){
 const find=key=>{const all=project().design.instances;const matches=all.filter(e=>e.id===key||e.reference===key);if(matches.length!==1)throw Error('Expected one component for '+key);return matches[0];};
 const pin=endpoint=>{if(!object(endpoint))throw Error('Endpoint requires ref and pin');const e=find(endpoint.ref);const p=e.pins.find(p=>Number.isInteger(endpoint.pin)?p.index===endpoint.pin:p.id===endpoint.pin);if(!p)throw Error('Unknown pin on '+endpoint.ref+'; inspect pins first (indices start at 0)');return p;};
 const set=(e,op)=>{
  if(op.properties!==undefined){if(!object(op.properties))throw Error('properties must map property indices to values');for(const [index,value] of Object.entries(op.properties)){if(!/^\d+$/.test(index))throw Error('Property index must be an integer');const p=sim.getProperties(e.id).find(p=>p.index===Number(index));if(!p)throw Error('Unknown editable property '+index);sim.setProperty(e.id,p.index,p.text!==null?value:typeof value==='number'?value:parseEngineering(value));}}
  if(op.meta!==undefined){if(!object(op.meta)||Object.keys(op.meta).some(k=>!['reference','footprint','padMap','noConnect'].includes(k)))throw Error('Unsupported component metadata');const meta={...e.meta,...op.meta};if(meta.reference&&!reference(meta.reference))throw Error('Invalid component reference');if(meta.footprint){const f=FOOTPRINTS[meta.footprint];if(!f||!Array.isArray(meta.padMap)||meta.padMap.length!==e.pins.length||new Set(meta.padMap).size!==meta.padMap.length||meta.padMap.some(n=>!f.pads.some(p=>p.number===n)))throw Error('Explicit valid footprint padMap required');}if(meta.noConnect&&(!Array.isArray(meta.noConnect)||meta.noConnect.some(id=>!e.pins.some(p=>p.id===id))))throw Error('No-connect entries must be pin UUIDs');sim.setMetadata(e.id,meta);}
 };
 function operation(op){
  if(!object(op))throw Error('Operation must be an object');
  if(op.op==='block-save'){const panel=window.studioReuse;if(panel.state.blocks.some(b=>b.name===op.name))throw Error('Block already exists');panel.state.blocks.push(captureBlock(sim,project().design,op.name));
  }else if(op.op==='block-place'){window.studioReuse.place(op.name,op.instance,op.x,op.y,op.ports||{});
  }else if(op.op==='mcu-package'){
   const spec=devices?.get(op.device);if(!spec)throw Error('Choose an available MCU profile');if(!reference(op.ref)||project().design.instances.some(e=>e.reference===op.ref))throw Error('Unique MCU reference required');
   const id=placePackage(sim,spec,op.x??160,op.y??96);sim.setMetadata(id,{...sim.getDesignElements().find(e=>e.id===id).meta,reference:op.ref});setDevice(op.device);
  }else if(op.op==='add'){
   if(!reference(op.ref)||project().design.instances.some(e=>e.reference===op.ref))throw Error('Unique component ref required');
   const id=sim.addElement(op.type,op.x,op.y,op.x2,op.y2);sim.setMetadata(id,{reference:op.ref});set(find(id),op);
  }else if(op.op==='set')set(find(op.ref),op);
  else if(op.op==='delete')sim.removeElement(find(op.ref).id);
  else if(op.op==='connect'){
   const a=pin(op.from),b=pin(op.to),bends=op.bends??[];
   if(!Array.isArray(bends)||bends.length>100||bends.some(p=>!object(p)))throw Error('Invalid wire bends');
   const points=[a,...bends,b];for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];if(a.x===b.x&&a.y===b.y)continue;if(a.x!==b.x&&a.y!==b.y)throw Error('Use explicit orthogonal bends for wires');sim.addElement('WireElm',a.x,a.y,b.x,b.y);}
  }else if(op.op==='board-sync'){
   const plan=board.planUpdate(project().design.instances);if(plan.unsupported?.length)throw Error('Assign packages before PCB transfer: '+plan.unsupported.join(', '));board.applyUpdate(plan);
  }else if(op.op==='board-stack'){setStackup(board,op.stack);
  }else if(op.op==='board-pair'){routePair(board,op);
  }else if(op.op==='board-tune'){matchLength(board,op.index,op.length,op.side??1);
  }else if(op.op==='board-shove'){shoveRoute(board,op);
  }else if(op.op==='board-spanned-via'){addSpannedVia(board,{...op,id:op.id||'via:'+crypto.randomUUID()});
  }else if(op.op==='board-place'){
   const p=board.parts.find(p=>p.ref===op.ref);if(!p)throw Error('Unknown PCB reference');for(const k of ['x','y','rotation','side'])if(op[k]!==undefined)p[k]=op[k];board.constructor.validate(board.serialize());board.render();
  }else if(op.op==='board-via'){
   board.addVia({id:op.id||'via:'+crypto.randomUUID(),x:op.x,y:op.y,net:op.net,diameter:op.diameter??.8,drill:op.drill??.4});
  }else if(op.op==='board-zone'){
   board.zones.push({id:op.id||'zone:'+crypto.randomUUID(),net:op.net,layer:op.layer,points:op.points});board.constructor.validate(board.serialize());board.render();
  }else if(op.op==='board-route'){
   board.tracks.push({from:op.from,to:op.to,layer:op.layer,bends:op.bends||[]});board.constructor.validate(board.serialize());board.render();
  }else throw Error('Unknown operation: '+op.op);
 }
 async function execute(request){
  if(!object(request)||request.version!==1)throw Error('Expected automation version 1');
  sim.setSimRunning(false);
  if(request.action==='catalog')return {parts:catalog.parts,footprints:FOOTPRINTS,devices:[...devices?.values()||[]].map(d=>({...d,schematic:packageDefinition(d)}))};
  if(request.action==='new'||request.action==='apply'){
   if(!Array.isArray(request.operations)||request.operations.length>500)throw Error('Provide at most 500 operations');
   const before=project(),savedHistory={entries:[...window.studioProject.history.entries],cursor:window.studioProject.history.cursor};
   try{
    if(request.action==='new'){if(typeof request.name!=='string'||!request.name.trim()||request.name.length>120)throw Error('Project name required (1–120 characters)');load({...before,id:crypto.randomUUID(),name:request.name,schematic:'$ 1 0.000005 10 50 5 50\n',design:{schema:1,instances:[],nets:[]},firmware:'',picFirmware:'',firmwareByDevice:{},board:{parts:[],tracks:[]},analysis:undefined,reuse:undefined,peripherals:undefined});}
    for(const op of request.operations)operation(op);
    if(project().design.instances.length>2000)throw Error('Automation limit: 2000 elements');
    const after=validate(project());if(electricalCheck(after.design).some(f=>f.code==='duplicate-reference'))throw Error('Duplicate component references');
    // One shared editor undo restores the entire transaction.
    window.studioProject.history.entries=savedHistory.entries;window.studioProject.history.cursor=savedHistory.cursor;capture();changed();
   }catch(error){load(before);window.studioProject.history.entries=savedHistory.entries;window.studioProject.history.cursor=savedHistory.cursor;throw error;}
  }else if(request.action==='simulate'){
   const steps=request.steps??1000,dt=request.timeStep??5e-6;
   if(!Number.isInteger(steps)||steps<1||steps>100000||!Number.isFinite(dt)||dt<1e-9||dt>.01)throw Error('Simulation needs 1–100000 steps and a timestep between 1 ns and 10 ms');
   sim.reset();sim.setSimRunning(false);sim.setMaxTimeStep(dt);for(let n=0;n<steps;n+=1000)sim.advanceSteps(Math.min(1000,steps-n));
  }else if(request.action==='svg'){
   sim.command('edit','centercircuit');return await new Promise((resolve,reject)=>{const previous=sim.onsvgrendered;const timer=setTimeout(()=>{sim.onsvgrendered=previous;reject(Error('SVG export timed out'));},5000);sim.onsvgrendered=(_,svg)=>{clearTimeout(timer);sim.onsvgrendered=previous;resolve({svg});};sim.getCircuitAsSVG();});
  }else if(request.action==='kicad'){if(board.sourceNetlist!==board.constructor.fingerprint(project().design.instances))throw Error('Schematic changed since PCB import; run board-sync before exporting');return {kicad:board.toKiCad()};}
  else if(!['inspect','check'].includes(request.action))throw Error('Unknown automation action');
  const p=project(),elements=sim.getElements();
  return {project:p,components:p.design.instances.map((e,i)=>({...e,properties:sim.getProperties(e.id),voltages:e.pins.map(p=>elements[i].getVoltage(p.index)),current:elements[i].getCurrent()})),erc:electricalCheck(p.design),drc:board.parts.length?board.issues():[],time:sim.getTime()};
 }
 return {execute};
}
