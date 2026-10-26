// Native PICsim session bridge. GPL-2.0-or-later.
import {makePins,inputSnapshot,renderRegisters,renderAnalogSources} from './device-ui.js';
const $=id=>document.getElementById(id);
export class PICMCU{
 constructor(getSim,status,spec){this.getSim=getSim;this.status=status;this.running=false;this.active=false;this.epoch=0;this.configure(spec);}
 configure(spec){this.clear();this.spec=spec;this.inputs={};this.analogInputs={};this.buttons=makePins(this);}
 async request(payload){if(!this.token){const r=await fetch('/api/session');if(!r.ok)throw Error('PIC backend requires the Circuit Studio launcher');const session=await r.json();if(session.apiVersion!==2)throw Error('Save your project and close/reopen Circuit Studio to finish the update.');this.token=session.token;}const r=await fetch('/api/pic',{method:'POST',headers:{'Content-Type':'application/json','X-Studio-Token':this.token},body:JSON.stringify(payload)});const data=await r.json();if(!r.ok)throw Error(data.error||'PIC backend error');return data;}
 async load(text){this.stop();const epoch=this.epoch;const state=await this.request({action:'load',device:this.spec.id,hex:text});if(epoch!==this.epoch)return;this.source=text;this.state=state;this.render();this.status(this.spec.label+' firmware loaded · '+this.spec.clockHz/1e6+' MHz oscillator');}
 releaseOutputs(){for(const pin of this.spec?.pins||[])this.getSim()?.setExtVoltage(pin.name,0);}
 syncOutputs(){const sim=this.getSim();if(!sim)return;for(const p of this.state.pins)sim.setExtVoltage(p.name,!p.input&&!p.analog&&p.value?5:0);}
 async advance(count){return this.request({action:'step',count,generation:this.state.generation,...inputSnapshot(this)});}
 async step(){if(!this.source)throw Error('Load PIC firmware first');this.stop();const epoch=this.epoch;const state=await this.advance(1);if(epoch!==this.epoch)return;this.state=state;this.syncOutputs();this.render();}
 run(){if(!this.source)throw Error('Load PIC firmware first');if(this.running)return;this.running=true;const epoch=this.epoch;const loop=async()=>{if(!this.running||epoch!==this.epoch)return;try{const state=await this.advance(20000);if(!this.running||epoch!==this.epoch)return;this.state=state;this.syncOutputs();this.render();this.timer=setTimeout(loop,20);}catch(e){this.stop();this.status('PIC stopped: '+e.message);}};loop();}
 stop(){this.running=false;this.epoch++;clearTimeout(this.timer);if(this.active)$('mcuRun').textContent='▶ Run firmware';}
 clear(){this.stop();this.releaseOutputs();this.source='';this.state={pc:0,cycles:0,pins:[],registers:{}};if(this.spec)this.render();}
 render(){if(!this.active)return;renderAnalogSources(this);$('mcuRun').textContent=this.running?'Ⅱ Pause firmware':'▶ Run firmware';$('pc').textContent='0x'+this.state.pc.toString(16).padStart(4,'0').toUpperCase();$('cycles').textContent=this.state.cycles.toLocaleString();$('cpuTime').textContent=(this.state.cycles/(this.spec.clockHz/4)).toFixed(4)+' s';this.buttons.forEach(b=>{const p=this.state.pins.find(p=>p.name===b.dataset.pin);const high=p&&!p.input&&!p.analog?p.value:this.inputs[b.dataset.pin];b.className=high?'high':'';b.textContent=b.dataset.pin+' · '+(p?.analog?'ADC':p&&!p.input?(high?'HIGH':'LOW'):'IN');});renderRegisters(this.state.registers);}
}
