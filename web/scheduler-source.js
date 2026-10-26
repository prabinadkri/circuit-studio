// Feasibility fixture, not the main firmware runner. GPL-2.0-or-later.
import {CPU,avrInstruction,AVRIOPort,portDConfig,AVRTimer,timer0Config,AVRADC,adcConfig,PinState} from 'avr8js';
import {parseHex} from './mcu-source.js';
export const schedulerCircuit='$ 1 0.000001 10 50 5 50\n418 160 160 160 96 0 1 40 5 0 0 0.5 PWM\nr 160 160 288 160 0 1000\nc 288 160 288 272 0 0.000001 0\ng 288 272 288 304 0 0\n207 288 160 352 160 4 OUT\n';
export class SchedulerFixture{
 constructor(sim,hex){this.sim=sim;sim.setSimRunning(false);sim.importCircuit(schedulerCircuit,false);sim.setSimRunning(false);sim.getDesignElements();this.cpu=new CPU(parseHex(hex));this.port=new AVRIOPort(this.cpu,portDConfig);this.timer=new AVRTimer(this.cpu,timer0Config);this.adc=new AVRADC(this.cpu,adcConfig);this.trace=[];this.tick=0;this.previous=0;this.edges=[];}
 step(count){for(let n=0;n<count;n++){
  // Both domains see inputs at the start of the quantum. Edges are committed
  // at its end, so neither can consume the other's future values.
  const v=this.sim.getNodeVoltage('OUT');this.adc.channelValues[0]=v;
  const target=(this.tick+1)*16;
  while(this.cpu.cycles<target){avrInstruction(this.cpu);this.cpu.tick();}
  this.sim.advanceSteps(1);
  const output=this.port.pinState(6)===PinState.High?5:0;
  if(output!==this.previous){this.edges.push([this.tick+1,output]);this.previous=output;}
  this.sim.setExtVoltage('PWM',output);this.tick++;
  if(this.tick%100===0)this.trace.push([this.tick*1e-6,this.sim.getNodeVoltage('OUT'),this.cpu.data[0x78]+256*this.cpu.data[0x79]]);
 }return this.trace;}
}
