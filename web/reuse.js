// Hierarchical snapshot blocks and assembly variants. GPL-2.0-or-later.
const name=v=>typeof v==='string'&&/^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(v);
const decode=s=>s.replaceAll('&quot;','"').replaceAll('&apos;',"'").replaceAll('&lt;','<').replaceAll('&amp;','&');
const encode=s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll("'",'&apos;').replaceAll('<','&lt;');
const xml=s=>{const d=new DOMParser().parseFromString(s,'text/xml');if(d.querySelector('parsererror')||d.documentElement.tagName!=='cir')throw Error('Invalid block schematic');return d;};
const allowed=new Set(['WireElm','GroundElm','ResistorElm','CapacitorElm','PolarCapacitorElm','InductorElm','DCVoltageElm','VoltageElm','ACVoltageElm','CurrentElm','SwitchElm','DiodeElm','LEDElm','OpAmpElm','LabeledNodeElm','OutputElm','ProbeElm','NTransistorElm','PTransistorElm','TransistorElm','TimerElm','AndGateElm','OrGateElm','InverterElm']);
export function validateReuse(r){
 if(r===undefined)return;
 if(!r||r.version!==1||!Array.isArray(r.blocks)||r.blocks.length>32||!Array.isArray(r.variants)||r.variants.length>32||typeof r.active!=='string')throw Error('Invalid reusable design');
 const ids=new Set();for(const b of r.blocks){if(!name(b.name)||ids.has(b.name)||typeof b.schematic!=='string'||b.schematic.length>500000||!Array.isArray(b.ports)||b.ports.length>128||!b.ports.every(name)||new Set(b.ports).size!==b.ports.length)throw Error('Invalid circuit block');ids.add(b.name);}
 const variants=new Set();for(const v of r.variants){if(!name(v.name)||variants.has(v.name)||!Array.isArray(v.dnp)||v.dnp.length>10000||v.dnp.some(id=>typeof id!=='string')||!v.values||typeof v.values!=='object'||Array.isArray(v.values)||Object.entries(v.values).some(([id,s])=>typeof s!=='string'||s.length>120))throw Error('Invalid assembly variant');variants.add(v.name);}
 if(r.active&&!variants.has(r.active))throw Error('Unknown assembly variant');
}
export function captureBlock(sim,design,blockName){
 if(!name(blockName))throw Error('Use a block name starting with a letter, up to 32 letters/digits/underscores');
 if(!design.instances.length||design.instances.length>500)throw Error('A block needs 1–500 objects');
 const unsupported=design.instances.filter(e=>!allowed.has(e.type));if(unsupported.length)throw Error('Block snapshot does not support '+[...new Set(unsupported.map(e=>e.type))].join(', '));
 const doc=xml(sim.exportCircuit(false));if([...doc.documentElement.children].some(n=>!n.hasAttribute('sid')&&['dm','tm','mm','rlm','clm','ccm'].includes(n.tagName)))throw Error('Reusable blocks currently require built-in device models');for(const n of [...doc.documentElement.children])if(!n.hasAttribute('sid'))n.remove();
 for(const e of design.instances){const node=[...doc.documentElement.children].find(n=>n.getAttribute('sid')===e.id);const meta={...e.meta,reference:e.reference};node.setAttribute('smeta',encode(JSON.stringify(meta)));}
 const ports=[...doc.querySelectorAll('[stype="LabeledNodeElm"]')].map(n=>decode(n.getAttribute('te')||''));if(!ports.every(name))throw Error('Block label names must be letters/digits/underscores, starting with a letter');
 return {name:blockName,schematic:new XMLSerializer().serializeToString(doc),ports:[...new Set(ports)]};
}
export function instantiateBlock(sim,block,prefix,dx,dy,connections={}){
 if(!name(prefix)||![dx,dy].every(n=>Number.isInteger(n)&&n%8===0&&Math.abs(n)<50000))throw Error('Unique instance name and grid offsets (multiples of 8) required');
 const elements=sim.getDesignElements();if(elements.some(e=>e.meta?.hierarchy?.split('/')[0]===prefix||e.meta?.reference?.startsWith(prefix+'_')))throw Error('Instance name already exists');
 const doc=xml(block.schematic),root=xml(sim.exportCircuit(false));if(Object.keys(connections).some(k=>!block.ports.includes(k))||Object.values(connections).some(v=>!name(v)))throw Error('Connect only declared ports to valid parent net names');
 const nodes=[...doc.documentElement.children];if(!nodes.length||nodes.length>500)throw Error('Invalid block size');
 const bounds=ns=>{const pts=ns.flatMap(n=>{const p=(n.getAttribute('x')||'').split(' ').map(Number);if(p.length!==4||p.some(v=>!Number.isFinite(v)))throw Error('Invalid block geometry');return[{x:p[0],y:p[1]},{x:p[2],y:p[3]}];});return {left:Math.min(...pts.map(p=>p.x)),right:Math.max(...pts.map(p=>p.x)),top:Math.min(...pts.map(p=>p.y)),bottom:Math.max(...pts.map(p=>p.y))};};
 const b=bounds(nodes);if(elements.some(e=>Math.max(e.x,e.x2)>=b.left+dx-16&&Math.min(e.x,e.x2)<=b.right+dx+16&&Math.max(e.y,e.y2)>=b.top+dy-16&&Math.min(e.y,e.y2)<=b.bottom+dy+16))throw Error('Block overlaps existing circuit. Choose a clear offset');
 const ids=new Map(),pinIds=new Map();for(const n of nodes){ids.set(n.getAttribute('sid'),crypto.randomUUID());for(const id of (n.getAttribute('sp')||'').split(',').filter(Boolean))pinIds.set(id,crypto.randomUUID());}
 for(const n of nodes){
  if(!allowed.has(decode(n.getAttribute('stype')||n.tagName+'Elm')))throw Error('Unsupported block component');
  const meta=JSON.parse(decode(n.getAttribute('smeta')||'{}'));meta.reference=prefix+'_'+(meta.reference||'U'+ids.size);meta.hierarchy=prefix+(meta.hierarchy?'/'+meta.hierarchy:'');meta.block=block.name;
  if(meta.reference.length>160)throw Error('Hierarchy reference is too long');if(meta.noConnect)meta.noConnect=meta.noConnect.map(id=>pinIds.get(id)).filter(Boolean);
  n.setAttribute('sid',ids.get(n.getAttribute('sid')));n.setAttribute('sp',(n.getAttribute('sp')||'').split(',').filter(Boolean).map(id=>pinIds.get(id)).join(','));n.setAttribute('smeta',encode(JSON.stringify(meta)));
  n.setAttribute('x',n.getAttribute('x').split(' ').map((v,i)=>Number(v)+(i%2?dy:dx)).join(' '));
  if(n.getAttribute('stype')==='LabeledNodeElm'){const label=decode(n.getAttribute('te')||'');n.setAttribute('te',encode(connections[label]||prefix+'__'+label));}
  root.documentElement.appendChild(root.importNode(n,true));
 }
 if(elements.length+nodes.length>2000)throw Error('Design limit: 2000 objects');sim.importCircuit(new XMLSerializer().serializeToString(root),false);sim.setSimRunning(false);return [...ids.values()];
}
export function assemblyBOM(parts,variant){return parts.map(p=>({reference:p.ref,sourceId:p.sourceId,footprint:p.footprint,value:variant?.values[p.sourceId]??p.value,populate:!variant?.dnp.includes(p.sourceId),pads:[...p.padMap||[]],nets:[...p.nets]}));}
export class ReusePanel{
 constructor(getSim,getDesign,getBoard,change,status,download){Object.assign(this,{getSim,getDesign,getBoard,change,status,download});this.load();const $=id=>document.getElementById(id);this.$=$;
  const action=fn=>()=>{try{fn();this.change();this.render();}catch(e){this.status(e.message);}};
  $('saveBlock').onclick=action(()=>{const b=captureBlock(getSim(),getDesign(),$('blockName').value);if(this.state.blocks.some(t=>t.name===b.name))throw Error('Use a new block name for a new snapshot');this.state.blocks.push(b);this.status('Block snapshot saved; named nodes are ports, ground remains common');});
  $('placeBlock').onclick=action(()=>this.place($('blockChoice').value,$('blockInstance').value,Number($('blockX').value),Number($('blockY').value),Object.fromEntries([...$('blockPorts').querySelectorAll('input')].filter(i=>i.value).map(i=>[i.dataset.port,i.value]))));
  $('blockChoice').onchange=()=>this.ports();
  $('newVariant').onclick=action(()=>{const value=$('variantName').value;if(!name(value)||this.state.variants.some(v=>v.name===value))throw Error('Unique variant name required');this.state.variants.push({name:value,dnp:[],values:{}});this.state.active=value;});
  $('variantChoice').onchange=action(()=>{this.state.active=$('variantChoice').value;});
  $('exportBOM').onclick=()=>{try{const board=getBoard();if(board.sourceNetlist!==board.constructor.fingerprint(getDesign().instances))throw Error('Update PCB from schematic before exporting an assembly BOM');const rows=assemblyBOM(board.parts,this.variant());const q=v=>'"'+String(v).replaceAll('"','""')+'"';download('assembly-'+(this.state.active||'base')+'.csv',['reference,source_id,footprint,value,populate',...rows.map(r=>[r.reference,r.sourceId,r.footprint,r.value,r.populate?'yes':'DNP'].map(q).join(','))].join('\n'),'text/csv');}catch(e){status(e.message);}};
 }
 load(state){validateReuse(state);this.state=structuredClone(state||{version:1,blocks:[],variants:[],active:''});if(this.$)this.render();}
 serialize(){return structuredClone(this.state);}
 variant(){return this.state.variants.find(v=>v.name===this.state.active);}
 place(blockName,prefix,x,y,ports={}){const block=this.state.blocks.find(b=>b.name===blockName);if(!block)throw Error('Save or select a block first');return instantiateBlock(this.getSim(),block,prefix,x,y,ports);}
 ports(){const box=this.$('blockPorts');box.replaceChildren();const block=this.state.blocks.find(b=>b.name===this.$('blockChoice').value);for(const p of block?.ports||[]){const label=document.createElement('label');label.textContent=p+' → ';const input=document.createElement('input');input.dataset.port=p;input.placeholder='Private to this instance';input.setAttribute('aria-label','Parent net for '+p);label.append(input);box.append(label);}}
 render(){const $=this.$;if(!$)return;const chosen=$('blockChoice').value;$('blockChoice').replaceChildren(...this.state.blocks.map(b=>new Option(b.name,b.name)));if(this.state.blocks.some(b=>b.name===chosen))$('blockChoice').value=chosen;this.ports();$('variantChoice').replaceChildren(new Option('Base assembly',''),...this.state.variants.map(v=>new Option(v.name,v.name)));$('variantChoice').value=this.state.active;
 const list=$('hierarchyTree');list.replaceChildren();const design=this.getSim()?this.getDesign():{instances:[]};const paths=[...new Set(design.instances.map(e=>e.meta?.hierarchy||'Root'))];for(const path of paths){const details=document.createElement('details'),s=document.createElement('summary');s.textContent=path;details.append(s);for(const e of design.instances.filter(e=>(e.meta?.hierarchy||'Root')===path)){const b=document.createElement('button');b.textContent=e.reference;b.onclick=()=>{this.getSim().selectElement(e.id,true);document.querySelector('nav [data-page=schematic]').click();};details.append(b);}list.append(details);}
 const table=$('variantParts');table.replaceChildren();const v=this.variant();for(const p of this.getBoard().parts){const row=document.createElement('div'),label=document.createElement('label'),check=document.createElement('input'),value=document.createElement('input');check.type='checkbox';check.checked=!v?.dnp.includes(p.sourceId);check.disabled=!v;label.append(check,document.createTextNode(p.ref+' · '+p.footprint));value.value=v?.values[p.sourceId]??p.value;value.disabled=!v;value.maxLength=120;value.setAttribute('aria-label','Assembly value for '+p.ref);check.onchange=()=>{v.dnp=v.dnp.filter(id=>id!==p.sourceId);if(!check.checked)v.dnp.push(p.sourceId);this.change();};value.onchange=()=>{v.values[p.sourceId]=value.value;this.change();};row.append(label,value);table.append(row);}
 }
}
