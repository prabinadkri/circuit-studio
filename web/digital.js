// Deterministic digital resolution and trace storage. GPL-2.0-or-later.
export const TICK_HZ=2_000_000_000; // 0.5 ns; integral periods for the supported clocks.
export function resolveDigital(drivers){
 const active=drivers.filter(d=>d!=='Z');
 if(active.some(d=>!['0','1','H','L'].includes(d)))throw Error('Unknown drive state');
 const strong=active.filter(d=>d==='0'||d==='1'),values=new Set(strong.length?strong:active.map(d=>d==='H'?'1':'0'));
 return values.size>1?'X':values.size?[...values][0]:'Z';
}
export function openDrain(value){if(![0,1,'0','1','Z'].includes(value))throw Error('Invalid open-drain value');return value===0||value==='0'?'0':'Z';}
export function threshold(voltage,previous='X',supply=5){
 if(!Number.isFinite(voltage)||!Number.isFinite(supply)||supply<=0)throw Error('Invalid pin voltage');
 if(voltage<=.3*supply)return '0';if(voltage>=.6*supply)return '1';
 return previous==='0'||previous==='1'?previous:'X';
}
class Ring {
 constructor(limit){this.limit=limit;this.data=new Array(limit);this.head=0;this.length=0;this.cache=null;}
 push(value){const full=this.length===this.limit;if(full){this.data[this.head]=value;this.head=(this.head+1)%this.limit;}else{this.data[(this.head+this.length)%this.limit]=value;this.length++;}this.cache=null;return full;}
 last(){return this.length?this.data[(this.head+this.length-1)%this.limit]:undefined;}
 array(){if(!this.cache)this.cache=Array.from({length:this.length},(_,i)=>this.data[(this.head+i)%this.limit]);return this.cache;}
}
export class TraceStore {
 constructor(limit=200000){if(!Number.isInteger(limit)||limit<1||limit>1000000)throw Error('Invalid capture limit');this.limit=limit;this.reset();}
 reset(preserveTrigger=false){const trigger=preserveTrigger?this.trigger:null;this._events=new Ring(this.limit);this._samples=new Ring(Math.min(this.limit,20000));this.analogChannels=new Set();this.dropped=0;this.last=new Map();this.trigger=trigger;this.triggeredAt=null;}
 get events(){return this._events.array();}
 get samples(){return this._samples.array();}
 arm(channel,edge='rising',level=2.5){if(typeof channel!=='string'||!channel||!['rising','falling'].includes(edge)||!Number.isFinite(level))throw Error('Invalid trigger');this.trigger={channel,edge,level};this.triggeredAt=null;}
 event(tick,channel,value){
  if(!Number.isSafeInteger(tick)||tick<0)throw Error('Invalid timestamp');
  if(this._events.length&&tick<this._events.last().tick)throw Error('Trace time went backwards');
  const previous=this.last.get(channel);if(previous===value)return;
  if(this._events.push({tick,channel,value}))this.dropped++;this.last.set(channel,value);
  if(this.trigger?.channel===channel&&this.triggeredAt===null){
   if(this.trigger.edge==='rising'&&previous==='0'&&value==='1'||this.trigger.edge==='falling'&&previous==='1'&&value==='0')this.triggeredAt=tick;
  }
 }
 sample(tick,values){
  if(!Number.isSafeInteger(tick)||tick<0||Object.keys(values).length>64||Object.values(values).some(v=>!Number.isFinite(v)))throw Error('Invalid sample');
  if(this._samples.length&&tick<this._samples.last().tick)throw Error('Sample time went backwards');
  for(const channel of Object.keys(values))this.analogChannels.add(channel);
  const previous=this._samples.last();
  if(this.trigger&&this.triggeredAt===null&&previous){const {channel,edge,level}=this.trigger,a=previous.values[channel],b=values[channel];if(Number.isFinite(a)&&Number.isFinite(b)&&(edge==='rising'?a<level&&b>=level:a>level&&b<=level))this.triggeredAt=tick;}
  if(this._samples.push({tick,values:{...values}}))this.dropped++;
 }
 measure(channel,a,b){
  if(!Number.isFinite(a)||!Number.isFinite(b)||b<a)throw Error('Choose ordered cursor times');
  const samples=this.samples.filter(s=>s.tick>=a&&s.tick<=b&&Number.isFinite(s.values[channel]));
  const rising=[];let previous;for(const e of this.events){if(e.channel!==channel)continue;if(e.tick>=a&&e.tick<=b&&previous==='0'&&e.value==='1')rising.push(e);previous=e.value;}
  return {duration:(b-a)/TICK_HZ,min:samples.length?samples.reduce((n,s)=>Math.min(n,s.values[channel]),Infinity):null,max:samples.length?samples.reduce((n,s)=>Math.max(n,s.values[channel]),-Infinity):null,frequency:rising.length>1&&rising.at(-1).tick>rising[0].tick?(rising.length-1)*TICK_HZ/(rising.at(-1).tick-rising[0].tick):null};
 }
 csv(){const escape=s=>'"'+String(s).replaceAll('"','""')+'"';return ['time_s,tick,kind,channel,value',...this.events.map(e=>[e.tick/TICK_HZ,e.tick,'digital',escape(e.channel),e.value].join(',')),...this.samples.flatMap(s=>Object.entries(s.values).map(([channel,v])=>[s.tick/TICK_HZ,s.tick,'analog',escape(channel),v].join(',')))].join('\n')+'\n';}
}
