// Bounded conservative coupling with timestamped output exchange. GPL-2.0-or-later.
import {checkPackage} from './mcu-package.js';
import {TICK_HZ,resolveDigital,threshold,TraceStore} from './digital.js';
export class CoupledRunner {
 constructor(getSim,getMCU,status){Object.assign(this,{getSim,getMCU,status});this.trace=new TraceStore();this.running=false;this.epoch=0;this.tick=0;this.quantum=2000;this.source=null;this.pending=[];}
 stop(){this.running=false;this.epoch++;clearTimeout(this.timer);if(this.source)this.source.running=false;}
 detach(){this.stop();this.getSim()?.setDigitalDrive('*',null);if(this.source){this.source.coupled=false;this.source.clock=null;}this.source=null;this.signature=null;this.prepared=false;}
 identity(source){return source.cpu||source.state.generation;}
 prepare(){
  const sim=this.getSim(),source=this.getMCU();if(!sim||!source.source)throw Error('Load firmware first');
  const signature=this.identity(source),dump=sim.exportCircuit(false);
  if(this.prepared&&this.source===source&&this.signature===signature&&this.dump===dump)return;
  this.detach();this.source=source;this.signature=signature;source.clock=this;source.coupled=true;
  // A coupled session starts from reset, never from an unrelated analog time.
  const cycles=source.cpu?.cycles??source.state.cycles;if(cycles!==0)throw Error('Reset CPU before starting a new coupled session');
  this.tick=0;this.pending=[];this.trace.reset(true);this.logic=new Map();sim.reset();sim.setSimRunning(false);
  this.elements=sim.getDesignElements();this.labelNames=sim.getElements().filter(e=>e.getType()==='LabeledNodeElm').map(e=>e.getLabelName());this.omittedLabels=Math.max(0,this.labelNames.length-64);this.labelNames=this.labelNames.slice(0,64);
  this.packages=this.elements.filter(e=>e.engineType==='MCUPackageElm');if(this.packages.length>1)throw Error('One MCU package per simulation is supported');
  this.package=this.packages[0];if(this.package)checkPackage(this.package,source.spec);
  this.ports=this.elements.filter(e=>e.engineType==='ExtVoltageElm').map(e=>({...e,index:0,key:e.id,name:sim.getProperties(e.id)[0]?.text}));
  const names=new Set(source.spec.pins.map(p=>p.name));this.ports=this.ports.filter(e=>names.has(e.name));
  if(this.package)this.ports.push(...this.package.mcu.pins.flatMap((p,i)=>['gpio','analog'].includes(p.role)?[{...this.package,name:p.name,index:i,key:this.package.id+':'+p.name,pins:[this.package.pins[i]]}]:[]));
  this.drive=source.outputStates();for(const p of this.ports)sim.setDigitalDrive(p.key,this.drive[p.name]??'Z');
  this.cyclesHz=source.spec.clockHz/(source.spec.engine==='pic'?4:1);this.ticksPerCycle=TICK_HZ/this.cyclesHz;
  if(!Number.isInteger(this.ticksPerCycle))throw Error('Clock does not fit the shared timeline');
  this.elements=sim.getDesignElements();this.ports=this.ports.map(p=>({...p,pins:[this.elements.find(e=>e.id===p.id).pins[p.index]]}));this.dump=sim.exportCircuit(false);this.origin=0;if(this.package){sim.advanceTo(1e-6);this.tick=this.origin=2000;this.checkPower();}this.record(this.tick);this.sample(this.tick);this.prepared=true;
 }
 inputs(){
  const sim=this.getSim(),source=this.source,elements=sim.getElements(),inputs={},analog={};
  const names=new Set(elements.filter(e=>e.getType()==='LabeledNodeElm').map(e=>e.getLabelName()));
  for(const p of source.spec.pins){
   const port=this.ports.find(e=>e.name===p.name);let v;
   if(names.has('IN_'+p.name))v=sim.getNodeVoltage('IN_'+p.name);
   else if(port)v=elements[this.elements.findIndex(e=>e.id===port.id)]?.getVoltage(port.index);
   if(Number.isFinite(v)){
    const value=threshold(v,this.logic.get(p.name)??'X');this.logic.set(p.name,value);
    if(!p.analogOnly)inputs[p.name]=value==='1';if('analog' in p)analog[p.name]=Math.min(5,Math.max(0,v));
   }else{if(!p.analogOnly)inputs[p.name]=!!source.inputs[p.name];if('analog' in p)analog[p.name]=source.analogInputs[p.name]??0;}
  }return {inputs,analog};
 }
 record(tick){
  for(const [name,state] of Object.entries(this.drive))this.trace.event(tick,name,state);
  const nets=new Map();for(const p of this.ports){const key=p.pins[0].net;if(!nets.has(key))nets.set(key,[]);nets.get(key).push(this.drive[p.name]??'Z');}
  for(const [net,states] of nets)this.trace.event(tick,'NET:'+net,resolveDigital(states));
 }
 sample(tick){const values={};const sim=this.getSim();for(const name of this.labelNames)values['V('+name+')']=sim.getNodeVoltage(name);this.trace.sample(tick,values);}
 checkPower(){
  if(!this.package)return;const e=this.getSim().getElements()[this.elements.findIndex(e=>e.id===this.package.id)];
  for(const [i,p] of this.package.mcu.pins.entries()){const v=e.getVoltage(i);if(p.role==='power'&&(v<4.5||v>5.5))throw Error(p.name+' requires a stable 5 V supply');if(p.role==='ground'&&Math.abs(v)>.1)throw Error(p.name+' must connect to ground');if(p.role==='reset'&&v<3)throw Error(p.name+' is low: release reset and reset the firmware before continuing');}
 }
 async idle(){if(this.inflight)await this.inflight;}
 async step(count=1){
  if(this.inflight)throw Error('A coupling interval is still finishing');
  let release;this.inflight=new Promise(resolve=>release=resolve);try{
  if(!Number.isInteger(count)||count<1||count>1000)throw Error('Choose 1–1000 coupling intervals');
  this.prepare();const epoch=this.epoch,source=this.source,signature=this.signature,sim=this.getSim();
  for(let i=0;i<count;i++){
   let target=this.tick+this.quantum;if(!Number.isSafeInteger(target))throw Error('Simulation time limit reached');
   const result=await this.source.advanceCoupled(Math.floor((target-this.origin)/this.ticksPerCycle),this.inputs());
   if(source!==this.source||signature!==this.identity(source))return;
   if(result.paused)target=Math.max(this.tick,this.origin+result.cycles*this.ticksPerCycle);
   this.pending.push(...result.events.map(e=>({tick:this.origin+e.cycle*this.ticksPerCycle,pins:e.pins})));
   this.pending.sort((a,b)=>a.tick-b.tick);
   while(this.pending.length&&this.pending[0].tick<=target){
    const edge=this.pending.shift();if(edge.tick<this.tick)throw Error('Backend returned a past event');
    sim.advanceTo(edge.tick/TICK_HZ);
    this.drive=edge.pins;for(const p of this.ports)sim.setDigitalDrive(p.key,this.drive[p.name]??'Z');
    this.record(edge.tick);
   }
   sim.advanceTo(target/TICK_HZ);this.tick=target;this.checkPower();this.sample(target);
   if(result.paused){this.stop();this.source.render();return;}
   if(epoch!==this.epoch)return;
   if(this.trace.triggeredAt!==null&&this.freezeAfter!==null&&Number.isFinite(this.freezeAfter)&&target>=this.trace.triggeredAt+this.freezeAfter){this.stop();return;}
  }
  }finally{this.inflight=null;release();}
 }
 async start(){
  await this.idle();
  if(this.running)return;this.prepare();if(this.source.debug?.paused){this.source.debug.skip=this.source.cpu.pc;this.source.debug.paused=false;}this.running=true;this.source.running=true;const epoch=this.epoch;
  const loop=async()=>{if(!this.running||epoch!==this.epoch)return;try{await this.step(this.source.spec.engine==='pic'?8:200);if(epoch!==this.epoch)return;this.source.render();this.timer=setTimeout(loop,0);}catch(e){if(epoch!==this.epoch)return;this.stop();this.status('Coupled simulation stopped: '+e.message);}};
  loop();
 }
}
