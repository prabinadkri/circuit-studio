import test from 'node:test';import assert from 'node:assert/strict';
import {resolveDigital,openDrain,threshold,TraceStore,TICK_HZ} from '../web/digital.js';
test('strong/weak/Z and open-drain resolution is independent of ordering',()=>{
 for(const [drivers,value] of [[[],'Z'],[['Z','Z'],'Z'],[['H','Z'],'1'],[['H','0'],'0'],[['L','1'],'1'],[['0','1'],'X'],[['H','L'],'X']]){assert.equal(resolveDigital(drivers),value);assert.equal(resolveDigital([...drivers].reverse()),value);}
 assert.equal(resolveDigital(['H',openDrain(1),openDrain(0)]),'0');assert.equal(resolveDigital(['H',openDrain(1),openDrain(1)]),'1');assert.throws(()=>resolveDigital(['bad']));
});
test('generic hysteretic thresholds preserve the last valid value in the undefined band',()=>{assert.equal(threshold(1.4),'0');assert.equal(threshold(3.1),'1');assert.equal(threshold(2),'X');assert.equal(threshold(2,'1'),'1');assert.equal(threshold(2,'0'),'0');assert.throws(()=>threshold(NaN));});
test('trigger, cursor measurements, CSV and bounded loss accounting',()=>{
 const trace=new TraceStore(8);trace.arm('V(out)','rising',2.5);trace.sample(0,{'V(out)':0});trace.sample(20,{'V(out)':3});assert.equal(trace.triggeredAt,20);
 trace.arm('D0');trace.event(0,'D0','0');trace.event(10,'D0','1');trace.event(20,'D0','0');trace.event(30,'D0','1');assert.equal(trace.triggeredAt,10);
 assert.deepEqual(trace.measure('D0',0,40),{duration:40/TICK_HZ,min:null,max:null,frequency:TICK_HZ/20});assert.equal(trace.measure('V(out)',0,40).max,3);
 assert.match(trace.csv(),/analog,"V\(out\)",3/);assert.throws(()=>trace.event(1,'D0','0'));
 for(let n=4;n<20;n++)trace.event(n*10,'D0',n%2?'1':'0');assert.equal(trace.events.length,8);assert.equal(trace.dropped,12);
});

test('analog capture bounds frames and channel width',()=>{const trace=new TraceStore();for(let i=0;i<21000;i++)trace.sample(i,{v:i});assert.equal(trace.samples.length,20000);assert.equal(trace.samples[0].tick,1000);assert.equal(trace.dropped,1000);assert.throws(()=>trace.sample(21001,Object.fromEntries(Array.from({length:65},(_,i)=>['v'+i,i]))));});
