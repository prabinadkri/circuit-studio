// Component inspector and navigable design checks. GPL-2.0-or-later.
import {capabilityFor,electricalCheck} from './library.js';
import {parseEngineering} from './project.js';
import {FOOTPRINTS} from './footprints.js';
const $=id=>document.getElementById(id);
function node(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
export class Inspector{
 constructor(getSim,getDesign,catalog,changed,status){Object.assign(this,{getSim,getDesign,catalog,changed,status});this.id=null;}
 show(id){const sim=this.getSim(),design=this.getDesign(),e=design.instances.find(e=>e.id===id);if(!e){this.id=null;$('inspectorBody').replaceChildren(node('p','Select a component to inspect its values, model and package.','tip'));return;}
  this.id=id;const part=capabilityFor(this.catalog,e),body=$('inspectorBody');body.replaceChildren(node('h3',e.reference+' · '+part.label),node('p',part.model.limits,'tip'));
  const field=(title,input)=>{const label=node('label',title,'property-field');label.append(input);body.append(label);};
  const reference=node('input');reference.value=e.reference;reference.setAttribute('aria-label','Component reference');reference.onchange=()=>{if(!/^[A-Za-z][A-Za-z0-9_]*$/.test(reference.value)||design.instances.some(x=>x.id!==id&&x.reference===reference.value)){this.status('Use a unique reference such as R1 or U2');return;}sim.setMetadata(id,{...sim.getDesignElements().find(x=>x.id===id).meta,reference:reference.value});this.changed();this.show(id);};field('Reference',reference);
  for(const p of sim.getProperties(id)){const input=node('input');input.value=p.text??String(p.value);input.setAttribute('aria-label',p.name);input.onchange=()=>{try{sim.setProperty(id,p.index,p.text!==null?input.value:parseEngineering(input.value));input.setCustomValidity('');this.changed();}catch(error){input.setCustomValidity(error.message);input.reportValidity();this.status(error.message);}};field(p.name.replace(/<[^>]+>/g,''),input);}
  const detail=node('button','Detailed model properties');detail.onclick=()=>sim.editElement(id);body.append(detail);
  body.append(node('h4','PCB package'));
  const packageSelect=node('select');packageSelect.setAttribute('aria-label','Footprint');packageSelect.append(new Option('No footprint assigned',''));
  for(const f of Object.values(FOOTPRINTS))if(f.pads.length>=e.pins.length)packageSelect.append(new Option(f.name,f.id));
  packageSelect.value=e.meta?.footprint||'';
  const mapping=node('input');mapping.setAttribute('aria-label','Pin to pad mapping');mapping.placeholder='Pad numbers in schematic pin order';mapping.value=(e.meta?.padMap||e.pins.map((_,i)=>String(i+1))).join(',');
  const apply=node('button','Apply package');apply.onclick=()=>{try{const f=FOOTPRINTS[packageSelect.value],map=mapping.value.split(',').map(x=>x.trim());if(f&&(map.length!==e.pins.length||new Set(map).size!==map.length||map.some(n=>!f.pads.some(p=>p.number===n))))throw Error('Map every schematic pin to a unique package pad');sim.setMetadata(id,{...sim.getDesignElements().find(x=>x.id===id).meta,footprint:f?.id||'',padMap:f?map:[]});this.changed();this.show(id);this.status(f?'Package assigned. Verify the pin order against your part datasheet.':'Package removed');}catch(error){this.status(error.message);}};
  body.append(packageSelect,mapping,apply,node('p','Package geometry does not certify the electrical model. Check physical pin order.','tip'));
  body.append(node('h4','Connections / intentional no-connect'));
  for(const p of e.pins){const label=node('label',`${p.index+1} · ${p.name} `,'pin-row'),check=node('input');check.type='checkbox';check.checked=(e.meta?.noConnect||[]).includes(p.id);check.setAttribute('aria-label',`No connect pin ${p.index+1}`);check.onchange=()=>{const ids=new Set(e.meta?.noConnect||[]);if(check.checked)ids.add(p.id);else ids.delete(p.id);sim.setMetadata(id,{...sim.getDesignElements().find(x=>x.id===id).meta,noConnect:[...ids]});this.changed();this.show(id);};label.append(check);body.append(label);}
 }
 checks(){$('ercResults').closest('details').open=true;const findings=electricalCheck(this.getDesign());$('ercResults').replaceChildren();for(const f of findings){const b=node('button',f.severity.toUpperCase()+' · '+f.message,'finding '+f.severity);b.onclick=()=>{this.getSim().command('main','Select');this.getSim().selectElement(f.objects[0],true);this.show(f.objects[0]);};$('ercResults').append(b);}if(!findings.length)$('ercResults').append(node('p','No findings in the supported electrical rules.','tip'));$('ercSummary').textContent=findings.length+' findings';return findings;}
}
