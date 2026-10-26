// Versioned design documents, topology identities and recovery. GPL-2.0-or-later.
export const uuid=()=>crypto.randomUUID();
export function validateProject(p,devices,validateBoard){
 if(!p||p.format!=='circuit-studio'||![1,2].includes(p.version)||typeof p.schematic!=='string'||p.schematic.length>8e6||typeof p.firmware!=='string'||typeof p.name!=='string')throw Error('Not a supported Circuit Studio project');
 if(p.picFirmware!==undefined&&typeof p.picFirmware!=='string')throw Error('Invalid PIC firmware');
 if(p.device!==undefined&&!devices.has(p.device))throw Error('Unsupported microcontroller');
 if(p.firmwareByDevice!==undefined){if(!p.firmwareByDevice||typeof p.firmwareByDevice!=='object'||Array.isArray(p.firmwareByDevice))throw Error('Invalid firmware library');for(const [k,v]of Object.entries(p.firmwareByDevice))if(!devices.has(k)||typeof v!=='string'||v.length>1e6)throw Error('Invalid device firmware');}
 if(p.analysis!==undefined){const a=p.analysis;if(!a||typeof a.circuit!=='string'||a.circuit.length>32000||!['dc','ac','tran'].includes(a.mode))throw Error('Invalid saved analysis');if(a.result){const r=a.result;if(!Array.isArray(r.columns)||r.columns.length>20||!r.columns.every(c=>typeof c==='string')||!Array.isArray(r.rows)||r.rows.length>20000||!r.rows.length||r.rows.some(row=>!Array.isArray(row)||row.length!==r.columns.length||!row.every(Number.isFinite)))throw Error('Invalid analysis results');}}
 validateBoard(p.board);
 if(p.version===2){
  const isId=x=>typeof x==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(x);
  if(!isId(p.id)||!p.design||!Array.isArray(p.design.instances)||!Array.isArray(p.design.nets)||p.design.instances.length>10000)throw Error('Invalid version 2 design');
  const ids=new Set(),pins=new Set(),nets=new Set();
  for(const e of p.design.instances){if(!isId(e.id)||ids.has(e.id)||!Array.isArray(e.pins)||typeof e.type!=='string')throw Error('Duplicate or invalid instance identity');ids.add(e.id);for(const pin of e.pins){if(!isId(pin.id)||pins.has(pin.id))throw Error('Duplicate or invalid pin identity');pins.add(pin.id);}}
  const connected=new Set();for(const net of p.design.nets){if(!isId(net.id)||nets.has(net.id)||!Array.isArray(net.pins))throw Error('Invalid net identity');nets.add(net.id);for(const pin of net.pins){if(!pins.has(pin)||connected.has(pin))throw Error('Invalid net membership');connected.add(pin);}}
  for(const e of p.design.instances)for(const pin of e.pins)if(pin.netId!==null&&(!nets.has(pin.netId)||!p.design.nets.find(n=>n.id===pin.netId).pins.includes(pin.id)))throw Error('Unresolved pin net');
 }

 return p;
}
export function reconcileDesign(elements,previous={}){
 const old=new Map((previous.instances||[]).map(e=>[e.id,e]));
 const usedRefs=new Set(elements.map(e=>e.meta?.reference||old.get(e.id)?.reference).filter(Boolean));
 const refFor=e=>{let ref=e.meta?.reference||old.get(e.id)?.reference;if(ref)return ref;const prefix=/Resistor|Pot/.test(e.type)?'R':/Capacitor/.test(e.type)?'C':/Inductor/.test(e.type)?'L':/Diode|LED/.test(e.type)?'D':/Voltage|Rail|Battery|Current/.test(e.type)?'V':/Transistor|Mosfet|Jfet/.test(e.type)?'Q':/Wire|Ground|Label|Output|Probe/.test(e.type)?'N':'U';let i=1;while(usedRefs.has(prefix+i))i++;ref=prefix+i;usedRefs.add(ref);return ref;};
 const groups=new Map();for(const e of elements)for(const p of e.pins){if(p.net<0)continue;if(!groups.has(p.net))groups.set(p.net,[]);groups.get(p.net).push(p.id);}
 const oldNets=previous.nets||[],used=new Set();
 // Match strongest overlap first. On split one child retains the old identity;
 // on merge one old identity wins. Unrelated nets never inherit each other's ID.
 const candidates=[];for(const [solver,pins]of groups)for(const n of oldNets){const shared=n.pins.filter(id=>pins.includes(id)).length;if(shared)candidates.push({solver,n,shared});}
 candidates.sort((a,b)=>b.shared-a.shared||a.n.id.localeCompare(b.n.id)||a.solver-b.solver);
 const matched=new Map();for(const c of candidates)if(!matched.has(c.solver)&&!used.has(c.n.id)){matched.set(c.solver,c.n);used.add(c.n.id);}
 const nets=[...groups].map(([solver,pins])=>({id:matched.get(solver)?.id||uuid(),name:solver===0?'GND':matched.get(solver)?.name||'',solver,pins:[...pins].sort()}));
 const netBySolver=new Map(nets.map(n=>[n.solver,n.id]));
 return {schema:1,sheetId:previous.sheetId||uuid(),instances:elements.map(({info,selected,...e})=>({...e,reference:refFor(e),pins:e.pins.map(p=>({...p,netId:netBySolver.get(p.net)||null}))})),nets};
}
export class ProjectHistory{
 constructor(limit=100){this.limit=limit;this.entries=[];this.cursor=-1;}
 reset(p){this.entries=[JSON.stringify(p)];this.cursor=0;}
 capture(p){const s=JSON.stringify(p);if(this.entries[this.cursor]===s)return false;this.entries.splice(this.cursor+1);this.entries.push(s);if(this.entries.length>this.limit)this.entries.shift();this.cursor=this.entries.length-1;return true;}
 undo(){if(this.cursor<=0)return null;return JSON.parse(this.entries[--this.cursor]);}
 redo(){if(this.cursor>=this.entries.length-1)return null;return JSON.parse(this.entries[++this.cursor]);}
}
function checksum(s){let n=2166136261;for(let i=0;i<s.length;i++)n=Math.imul(n^s.charCodeAt(i),16777619);return (n>>>0).toString(16);}
export class RecoveryStore{
 constructor(storage,prefix='circuit-studio-recovery'){this.storage=storage;this.prefix=prefix;}
 save(project){const current=this.read(),revision=(current?.revision||0)+1,text=JSON.stringify(project),data=JSON.stringify({revision,savedAt:new Date().toISOString(),checksum:checksum(text),text});this.storage.setItem(this.prefix+'-'+revision%2,data);return revision;}
 read(){const valid=[];for(const slot of [0,1])try{const e=JSON.parse(this.storage.getItem(this.prefix+'-'+slot));if(e&&Number.isSafeInteger(e.revision)&&typeof e.text==='string'&&checksum(e.text)===e.checksum)valid.push({...e,project:JSON.parse(e.text)});}catch{}return valid.sort((a,b)=>b.revision-a.revision)[0]||null;}
}
export function parseEngineering(value){
 const m=String(value).trim().match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*([pnuµμmkKMGT]?)(?:\s*(?:ohms?|Ω|[FfVvAaHhSs]|Hz))?$/);
 if(!m)throw Error('Enter a number such as 10k, 4.7 µF or 0.001');
 const scale={p:1e-12,n:1e-9,u:1e-6,'µ':1e-6,'μ':1e-6,m:1e-3,k:1e3,K:1e3,M:1e6,G:1e9,T:1e12,'':1};const n=Number(m[1])*scale[m[2]];if(!Number.isFinite(n))throw Error('Number is outside the supported range');return n;
}
