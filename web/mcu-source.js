// ATmega328P execution and GPIO bridge. GPL-2.0-or-later; AVR8js is MIT.
import {CPU, avrInstruction, AVRIOPort, portBConfig, portCConfig, portDConfig, AVRTimer, timer0Config, timer1Config, timer2Config, AVRUSART, usart0Config, AVREEPROM, EEPROMMemoryBackend, eepromConfig, AVRADC, adcConfig, PinState} from 'avr8js';
import {makePins,inputSnapshot,renderRegisters,renderAnalogSources} from './device-ui.js';
const $=id=>document.getElementById(id);
export function parseHex(text){const bytes=new Uint8Array(32768);bytes.fill(255);let base=0,seen=false,end=false;for(const [i,line] of text.trim().split(/\r?\n/).entries()){const s=line.trim();if(!s)continue;if(end)throw Error('Data follows HEX end record');if(!/^:[0-9a-f]+$/i.test(s)||s.length%2!==1)throw Error(`Invalid HEX at line ${i+1}`);const data=Uint8Array.from(s.slice(1).match(/../g),v=>parseInt(v,16));if(data.length!==data[0]+5||(data.reduce((a,b)=>a+b,0)&255)!==0)throw Error(`HEX length/checksum error at line ${i+1}`);const addr=(data[1]<<8)|data[2],type=data[3],len=data[0];if(type===0){if(base+addr+len>bytes.length)throw Error('Firmware exceeds ATmega328P 32 KB flash');bytes.set(data.slice(4,4+len),base+addr);seen=true;}else if(type===1){if(len!==0)throw Error('Invalid EOF');end=true;}else if(type===4||type===2){if(len!==2)throw Error('Invalid address record');base=((data[4]<<8)|data[5])*(type===4?65536:16);}else if(type!==3&&type!==5)throw Error('Unsupported HEX record '+type);}if(!seen||!end)throw Error('HEX needs program data and an end-of-file record');return new Uint16Array(bytes.buffer);}
// Hand-assembled AVR: DDRB5 output, PORTB5 toggle, three-register delay loop.
const blinkWords=[0x9a25,0x9a2d,0xe287,0xef9f,0xefaf,0x95aa,0xf7f1,0x959a,0xf7d9,0x958a,0xf7c1,0x982d,0xe287,0xef9f,0xefaf,0x95aa,0xf7f1,0x959a,0xf7d9,0x958a,0xf7c1,0xcfeb];
function toHex(words){let bytes=words.flatMap(v=>[v&255,v>>8]),lines=[];for(let i=0;i<bytes.length;i+=16){let d=bytes.slice(i,i+16),a=[d.length,i>>8,i&255,0,...d];a.push((-a.reduce((x,y)=>x+y,0))&255);lines.push(':'+a.map(x=>x.toString(16).padStart(2,'0')).join('').toUpperCase());}return lines.join('\n')+'\n:00000001FF\n';}
export const demoHex=toHex(blinkWords);
export class MCU{
 constructor(getSim,status,spec){this.getSim=getSim;this.status=status;this.active=false;this.running=false;this.source='';this.configure(spec);setInterval(()=>this.render(),100);}
 configure(spec){this.clear();this.spec=spec;this.inputs={};this.analogInputs={};this.buttons=makePins(this);}
 portFor(name){if(name.startsWith('A'))return [this.portC,Number(name.slice(1))];const n=Number(name.slice(1));return [n<8?this.portD:this.portB,n<8?n:n-8];}
 load(text){
  const program=parseHex(text);this.clock?.detach();this.stop();this.source=text;this.debug=null;this.cpu=new CPU(program,this.spec.ramBytes);
  this.portB=new AVRIOPort(this.cpu,portBConfig);this.portC=new AVRIOPort(this.cpu,portCConfig);this.portD=new AVRIOPort(this.cpu,portDConfig);
  this.timers=[timer0Config,timer1Config,timer2Config].map(t=>new AVRTimer(this.cpu,t));
  this.eeprom=new AVREEPROM(this.cpu,new EEPROMMemoryBackend(1024),eepromConfig);
  this.adc=new AVRADC(this.cpu,adcConfig);this.uart=new AVRUSART(this.cpu,usart0Config,this.spec.clockHz);
  $('serial').textContent='';this.uart.onByteTransmit=b=>{$('serial').textContent=($('serial').textContent+String.fromCharCode(b)).slice(-12000);};
  for(const port of [this.portB,this.portC,this.portD])port.addListener(()=>{if(this.coupledCapture)this.coupledCapture(this.cpu.cycles,this.outputStates());else if(!this.coupled)this.syncOutputs();});
  this.render();this.status(this.spec.label+' firmware loaded · '+text.trim().split('\n').length+' HEX records');
 }
 outputStates(){const states={};for(const pin of this.spec.pins){if(pin.analogOnly)continue;const [port,n]=this.portFor(pin.name);states[pin.name]=['0','1','Z','H'][port.pinState(n)];}return states;}
 advanceCoupled(target,inputs){
  if(!this.cpu)throw Error('Load firmware first');
  this.coupled=true;for(const [name,value] of Object.entries(inputs.inputs)){const [port,n]=this.portFor(name);port.setPin(n,value);}
  for(const p of this.spec.pins)if('analog' in p)this.adc.channelValues[p.analog]=inputs.analog[p.name]??0;
  const events=[];let paused=false;this.coupledCapture=(cycle,pins)=>events.push({cycle,pins});
  try{while(this.cpu.cycles<target){if(this.debug?.breakpoints.has(this.cpu.pc)&&this.debug.skip!==this.cpu.pc){this.debug.paused=true;paused=true;break;}if(this.debug)this.debug.skip=null;const start=events.length;avrInstruction(this.cpu);this.cpu.tick();for(let i=start;i<events.length;i++)events[i].cycle=this.cpu.cycles;}}
  finally{this.coupledCapture=null;}
  return {cycles:this.cpu.cycles,pins:this.outputStates(),events,paused};
 }
 clear(){this.clock?.detach();this.stop();this.releaseOutputs();this.source='';this.cpu=null;this.portB=null;this.portC=null;this.portD=null;if(this.spec)this.render();}
 releaseOutputs(){for(const pin of this.spec?.pins||[])if(!pin.analogOnly)this.getSim()?.setExtVoltage(pin.name,0);}
 syncOutputs(){const sim=this.getSim();if(!sim||!this.cpu)return;for(const pin of this.spec.pins){if(pin.analogOnly)continue;const [port,n]=this.portFor(pin.name),state=port.pinState(n);sim.setExtVoltage(pin.name,state===PinState.High||state===PinState.InputPullUp?5:0);}}
 syncInputs(){const {inputs,analog}=inputSnapshot(this);for(const [name,value] of Object.entries(inputs)){const [port,n]=this.portFor(name);port.setPin(n,value);}for(const p of this.spec.pins)if('analog' in p)this.adc.channelValues[p.analog]=analog[p.name];}
 step(){if(!this.cpu)throw Error('Load firmware first');this.stop();this.syncInputs();avrInstruction(this.cpu);this.cpu.tick();this.syncOutputs();this.render();}
 run(){if(!this.cpu)throw Error('Load firmware first');if(this.running)return;this.running=true;const loop=()=>{if(!this.running)return;try{this.syncInputs();const end=this.cpu.cycles+160000;while(this.cpu.cycles<end){avrInstruction(this.cpu);this.cpu.tick();}this.syncOutputs();this.timer=setTimeout(loop,0);}catch(e){this.stop();this.status('Firmware stopped: '+e.message);}};loop();}
 stop(){this.clock?.stop();this.running=false;clearTimeout(this.timer);if(this.active)$('mcuRun').textContent='▶ Run firmware';}
 render(){
  if(!this.active)return;
  renderAnalogSources(this);
  $('mcuRun').textContent=this.running?'Ⅱ Pause firmware':'▶ Run firmware';
  $('pc').textContent='0x'+(this.cpu?.pc??0).toString(16).padStart(4,'0').toUpperCase();
  $('cycles').textContent=(this.cpu?.cycles??0).toLocaleString();$('cpuTime').textContent=((this.cpu?.cycles??0)/this.spec.clockHz).toFixed(4)+' s';
  this.buttons.forEach(b=>{const name=b.dataset.pin;const [port,n]=this.portFor(name);const state=this.cpu?port.pinState(n):PinState.Input;
   const high=state===PinState.High||state===PinState.InputPullUp||state===PinState.Input&&this.inputs[name];
   b.className=high?'high':'';b.textContent=name+' · '+(state<2?(high?'HIGH':'LOW'):'IN');});
  const registers={};for(const [name,addr] of Object.entries({DDRB:0x24,PORTB:0x25,DDRC:0x27,PORTC:0x28,DDRD:0x2a,PORTD:0x2b,TCNT0:0x46,ADCL:0x78,ADCH:0x79,SREG:0x5f}))registers[name]=this.cpu?.data[addr]??0;renderRegisters(registers);
 }
}
