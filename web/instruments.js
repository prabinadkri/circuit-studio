// Time-aligned scope and logic inspection of the coupled run. GPL-2.0-or-later.
import {TICK_HZ} from './digital.js';
const $=id=>document.getElementById(id),ns='http://www.w3.org/2000/svg';
function element(tag,attrs,text){const e=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;return e;}
function options(select,values){const signature=JSON.stringify(values);if(select.dataset.options===signature)return;const old=select.value;select.replaceChildren(...values.map(v=>new Option(v,v)));if(values.includes(old))select.value=old;select.dataset.options=signature;}
export class Instruments {
 constructor(clock,download,status){this.clock=clock;this.download=download;this.status=status;
  $('armTrace').onclick=()=>{try{clock.trace.arm($('triggerChannel').value,$('triggerEdge').value,Number($('triggerLevel').value));clock.freezeAfter=$('freezeTrace').checked?Number($('traceWindow').value)*1000:null;this.render();}catch(e){status(e.message);}};
  $('freezeTrace').onchange=()=>{clock.freezeAfter=$('freezeTrace').checked?Number($('traceWindow').value)*1000:null;};
  $('exportTrace').onclick=()=>download('simulation-trace.csv',clock.trace.csv(),'text/csv');
  for(const id of ['scopeChannel','logicChannel','traceWindow','cursorA','cursorB'])$(id).onchange=()=>{if(id==='traceWindow')clock.freezeAfter=$('freezeTrace').checked?Number($('traceWindow').value)*1000:null;this.render();};
  $('tracePlot').onclick=e=>{if(!this.bounds)return;const transform=e.currentTarget.getScreenCTM();if(!transform)return;const point=new DOMPoint(e.clientX,e.clientY).matrixTransform(transform.inverse()),x=Math.max(80,Math.min(960,point.x));const tick=this.bounds.start+(x-80)/880*(this.bounds.end-this.bounds.start);$(this.nextCursor?'cursorB':'cursorA').value=(Math.max(0,tick)/2000).toFixed(3);this.nextCursor=!this.nextCursor;this.render();};
  setInterval(()=>{if($('instruments').classList.contains('active'))this.render();},300);
 }
 render(){
  const trace=this.clock.trace,analog=[...trace.analogChannels],digital=[...trace.last.keys()];
  options($('scopeChannel'),analog);options($('logicChannel'),digital);options($('triggerChannel'),[...digital,...analog]);
  const widthUs=Number($('traceWindow').value);if(!Number.isFinite(widthUs)||widthUs<=0||widthUs>1e6){this.status('Time window must be 0–1,000,000 µs');return;}
  const window=widthUs*2000,now=this.clock.tick;
  const end=trace.triggeredAt!==null?Math.max(window,trace.triggeredAt+window/2):Math.max(window,now),start=Math.max(0,end-window);this.bounds={start,end};
  const svg=$('tracePlot');svg.replaceChildren();const x=t=>80+880*(t-start)/(end-start);
  for(let i=0;i<=10;i++){const at=start+(end-start)*i/10;svg.append(element('line',{x1:x(at),x2:x(at),y1:32,y2:350,stroke:'#dce5e1'}),element('text',{x:x(at),y:380,'text-anchor':'middle'},(at/2000).toFixed(1)));}
  const channel=$('scopeChannel').value,samples=trace.samples.filter(s=>s.tick>=start&&s.tick<=end&&Number.isFinite(s.values[channel]));
  let min=0,max=5;for(const s of samples){min=Math.min(min,s.values[channel]);max=Math.max(max,s.values[channel]);}const y=v=>235-(v-min)/(max-min)*170;
  svg.append(element('text',{x:12,y:25},channel||'No analog channel'),element('text',{x:12,y:64},max.toFixed(2)+' V'),element('text',{x:12,y:235},min.toFixed(2)+' V'));
  // Min/max per screen column preserves excursions without huge SVG paths.
  const columns=new Map();for(const s of samples){const col=Math.floor(x(s.tick)),v=s.values[channel],range=columns.get(col)||[v,v];range[0]=Math.min(range[0],v);range[1]=Math.max(range[1],v);columns.set(col,range);}
  if(columns.size){const points=[...columns].flatMap(([col,[low,high]])=>[`${col},${y(low)}`,`${col},${y(high)}`]).join(' ');svg.append(element('polyline',{points,fill:'none',stroke:'#16846a','stroke-width':1.5}));}
  const logic=$('logicChannel').value,events=trace.events.filter(e=>e.channel===logic&&e.tick<=end);let previous=events.filter(e=>e.tick<=start).at(-1)?.value??'Z',at=start;const point=[];const level=v=>v==='1'||v==='H'?280:v==='0'||v==='L'?330:305;
  let column=-1;const dense=new Set();
  for(const e of events){if(e.tick<start)continue;const col=Math.floor(x(e.tick));if(col===column){dense.add(col);at=e.tick;previous=e.value;continue;}column=col;point.push(`${x(at)},${level(previous)}`,`${x(e.tick)},${level(previous)}`);at=e.tick;previous=e.value;}
  point.push(`${x(at)},${level(previous)}`,`${x(Math.min(end,now))},${level(previous)}`);svg.append(element('text',{x:12,y:265},logic||'No digital channel'),element('polyline',{points:point.join(' '),fill:'none',stroke:'#476ac7','stroke-width':1.5}));
  for(const col of dense)svg.append(element('line',{x1:col,x2:col,y1:280,y2:330,stroke:'#476ac7','stroke-opacity':.4}));
  if(now<end){svg.append(element('rect',{x:x(Math.max(start,now)),y:32,width:Math.max(0,x(end)-x(Math.max(start,now))),height:318,fill:'#eef1f4','fill-opacity':.7}),element('text',{x:x(Math.max(start,now))+8,y:80},'Not captured'));}
  const a=Number($('cursorA').value)*2000,b=Number($('cursorB').value)*2000;
  if(!Number.isFinite(a)||!Number.isFinite(b)){this.status('Cursors must be finite times');return;}
  for(const [tick,label,color] of [[a,'A','#a26418'],[b,'B','#a26418'],[trace.triggeredAt,'Trigger','#a22a65']])if(tick!==null&&tick>=start&&tick<=end)svg.append(element('line',{x1:x(tick),x2:x(tick),y1:25,y2:350,stroke:color,'stroke-dasharray':'5 4'}),element('text',{x:x(tick)+5,y:label==='Trigger'?25:45,fill:color},label));
  const m=trace.measure(channel,Math.min(a,b),Math.max(a,b)),logicMeasure=trace.measure(logic,Math.min(a,b),Math.max(a,b));
  $('traceMeasurements').textContent=`Δt ${(m.duration*1e6).toFixed(3)} µs · range ${m.min===null?'—':m.min.toFixed(3)+'…'+m.max.toFixed(3)+' V'} · frequency ${logicMeasure.frequency===null?'—':logicMeasure.frequency.toFixed(2)+' Hz'}`;
  $('traceSummary').textContent=`Shared time ${(now/TICK_HZ).toFixed(6)} s · ${trace.events.length} transitions · ${trace.samples.length} analog samples · ${trace.dropped} older records discarded${this.clock.omittedLabels?' · '+this.clock.omittedLabels+' voltage channels outside the 64-channel limit':''}`+(trace.triggeredAt!==null?` · triggered at ${(trace.triggeredAt/2000).toFixed(3)} µs`:trace.trigger?' · waiting for trigger':'');
 }
}
