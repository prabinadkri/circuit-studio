import {validateSymbol,validateModel} from './assets.js';
// Versioned catalog adapter and electrical rules. GPL-2.0-or-later.
export function validateLibrary(catalog){
 if(catalog.schema!==1||!Array.isArray(catalog.parts))throw Error('Unsupported component library');
 const ids=new Set();for(const p of catalog.parts){if(!p.id||ids.has(p.id)||p.revision!==1||!p.symbol?.class||!p.model?.backend||!p.provenance?.license||!Array.isArray(p.fixtures))throw Error('Invalid component record');validateSymbol(p.symbol);validateModel(p.model);ids.add(p.id);}return catalog;
}
export const normalize=s=>s.toLowerCase().replace(/[\s_-]/g,'');
export function findPart(catalog,type){return catalog.parts.find(p=>p.type===type)||null;}
const aliases={DCVoltageElm:'VoltageElm',ACVoltageElm:'VoltageElm',NTransistorElm:'TransistorElm',PTransistorElm:'TransistorElm'};
export function capabilityFor(catalog,e){return findPart(catalog,e.type)||findPart(catalog,aliases[e.type])||{id:'unknown:'+e.type,revision:1,label:e.type,model:{status:'unvalidated',limits:'Imported upstream element; no Circuit Studio electrical fixture.'},fixtures:[]};}
export function pinRole(e,p){
 const name=(p.name||'').toUpperCase();
 if(e.mcu){const role=e.mcu.pins[p.index]?.role;return {power:'power-in',ground:'power-return',reset:'input',gpio:'bidirectional',analog:'input'}[role]||'passive';}
 if(e.type==='TimerElm')return ['open-drain','input','input','power-in','passive','output','input','power-return'][p.index]||'passive';
 if(/^(VCC|VDD|V\+|V-|GND|VSS)$/.test(name))return /GND|VSS|V-/.test(name)?'power-return':'power-in';
 if(/GroundElm/.test(e.type))return 'power-return';
 if(/Voltage|Rail|Battery/.test(e.type))return 'power-out';
 if(/LogicInput|ClockElm/.test(e.type))return 'output';
 if(/OpAmp/.test(e.type))return p.index===2?'analog-output':'input';
 if(/(?:And|Or|Xor|Nand|Nor|Xnor|Inverter)Gate?Elm/.test(e.type)||e.type==='InverterElm')return p.index===e.pins.length-1?'output':'input';
 if(p.output)return 'output';
 if(/OutputElm|ProbeElm/.test(e.type))return 'input';
 return 'passive';
}
export function electricalCheck(design){
 const findings=[],byPin=new Map();for(const e of design.instances)for(const p of e.pins)byPin.set(p.id,{e,p,role:pinRole(e,p)});
 const ignored=new Set();for(const e of design.instances)for(const id of e.meta?.noConnect||[])ignored.add(id);
 const add=(severity,code,message,objects)=>findings.push({severity,code,message,objects:[...new Set(objects)]});
 const real=items=>items.filter(({e})=>!/(?:Wire|RoutedWire|Ground|LabeledNode|Text|Box)Elm/.test(e.type));
 for(const net of design.nets){const items=net.pins.map(id=>byPin.get(id)).filter(Boolean),active=real(items),drives=items.filter(i=>['output','power-out','analog-output'].includes(i.role));
  const strong=items.filter(i=>i.role==='output');if(strong.length>1)add('error','output-conflict',`${strong.map(i=>i.e.reference).join(', ')} drive the same net`,strong.map(i=>i.e.id));
  for(const {e,p,role}of active){
   if(ignored.has(p.id)){if(active.length>1)add('warning','connected-nc',`${e.reference} pin ${p.name} is marked no-connect but connected`,[e.id]);continue;}
   if(active.length<2&&!items.some(i=>i.e.type==='GroundElm')&&role!=='power-out')add('warning','dangling',`${e.reference} pin ${p.name} has no connected component`,[e.id]);
   if(role==='input'&&!drives.length&&!items.some(i=>i.role==='power-return'))add('warning','floating-input',`${e.reference} input ${p.name} is floating`,[e.id]);
   if(role==='power-in'&&!drives.some(i=>i.role==='power-out'))add('error','missing-power',`${e.reference} supply ${p.name} has no power source`,[e.id]);
  }
 }
 const refs=new Map();for(const e of design.instances){if(refs.has(e.reference))add('error','duplicate-reference','Duplicate reference '+e.reference,[e.id,refs.get(e.reference)]);refs.set(e.reference,e.id);}
 return findings;
}
