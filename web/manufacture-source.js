// Circuit Studio RS-274X / Excellon export, GPL-2.0-or-later.
import {assemblyBOM} from './reuse.js';
import {zipSync,strToU8} from 'fflate';
import {triangles} from './copper.js';
const coordinate=v=>Math.round(v*1e6).toString();
const xy=p=>'X'+coordinate(p.x)+'Y'+coordinate(80-p.y);
export function manufacturingFiles(board){
 const issues=board.issues();if(issues.length)throw Error('Resolve board checks before exporting Gerbers: '+issues.join('; '));
 const files={},pads=board.anchors();
 function gerber(name,selected,{expand=0,tracks=false}={}){
  const apertures=new Map(),dimensions=p=>{let w=p.width+expand,h=p.height+expand;if(p.rotation%180)[w,h]=[h,w];return {shape:p.shape==='rect'?'R':'C',w,h};};
  for(const p of selected){const d=dimensions(p),key=JSON.stringify(d);if(!apertures.has(key))apertures.set(key,{...d,code:20+apertures.size});}
  const g=[`G04 Circuit Studio ${name}*`,'%FSLAX46Y46*%','%MOMM*%','%LPD*%','%ADD10C,0.500000*%',...Array.from(apertures.values(),a=>`%ADD${a.code}${a.shape},${a.w.toFixed(6)}${a.shape==='R'?'X'+a.h.toFixed(6):''}*%`),'G01*'];
  if(tracks)for(const fill of board.copper().fills.filter(f=>f.layer===name))for(const triangle of triangles(fill)){g.push('G36*',xy(triangle[0])+'D02*',...triangle.slice(1).concat(triangle[0]).map(p=>xy(p)+'D01*'),'G37*');}
  for(const p of selected){g.push('D'+apertures.get(JSON.stringify(dimensions(p))).code+'*',xy(p)+'D03*');}
  if(tracks){g.push('D10*');for(const t of board.tracks.filter(t=>t.layer===name)){const ps=board.points(t);g.push(xy(ps[0])+'D02*');for(const p of ps.slice(1))g.push(xy(p)+'D01*');}}
  return g.concat('M02*').join('\n')+'\n';
 }
 for(const [side,copper,mask,paste]of [['F','gtl','gts','gtp'],['B','gbl','gbs','gbp']]){
  const selected=pads.filter(p=>p.layers.includes(side+'.Cu'));
  files[`board-${side}.Cu.${copper}`]=gerber(side+'.Cu',selected,{tracks:true});
  files[`board-${side}.Mask.${mask}`]=gerber(side+' mask',selected,{expand:.1});
  files[`board-${side}.Paste.${paste}`]=gerber(side+' paste',selected.filter(p=>!p.drill));
 }
 files['board-Edge.Cuts.gm1']=['G04 Circuit Studio board outline*','%FSLAX46Y46*%','%MOMM*%','%ADD10C,0.050000*%','G01*','D10*',xy({x:10,y:10})+'D02*',...[{x:110,y:10},{x:110,y:70},{x:10,y:70},{x:10,y:10}].map(p=>xy(p)+'D01*'),'M02*',''].join('\n');
 for(const layer of board.layers.filter(l=>l.startsWith('In')))files['board-'+layer+'.g'+(board.layers.indexOf(layer)+1)]=gerber(layer,pads.filter(p=>p.layers.includes(layer)),{tracks:true});
 const groups=new Map();for(const p of pads.filter(p=>p.drill)){const span=p.layers[0]+'-'+p.layers.at(-1);if(!groups.has(span))groups.set(span,[]);groups.get(span).push(p);}
 for(const [span,holes]of groups){const drills=[...new Set(holes.map(p=>p.drill))].sort((a,b)=>a-b),d=['M48','; Plated holes spanning '+span,'METRIC,TZ',...drills.map((v,i)=>`T${String(i+1).padStart(2,'0')}C${v.toFixed(3)}`),'G90','%','G05'];for(const [i,size]of drills.entries()){d.push('T'+String(i+1).padStart(2,'0'));for(const p of holes.filter(p=>p.drill===size))d.push('X'+p.x.toFixed(4)+'Y'+(80-p.y).toFixed(4));}d.push('M30','');files[span==='F.Cu-B.Cu'?'board-PTH.drl':'board-'+span+'.drl']=d.join('\n');}
 files['stackup.json']=JSON.stringify({layers:board.layers,nominalThicknessMm:1.6,dielectricThickness:'Fabricator must define dielectric thicknesses for the selected process',vias:board.vias.map(v=>({id:v.id,kind:v.kind||'through',span:v.span||[board.layers[0],board.layers.at(-1)],diameter:v.diameter,drill:v.drill}))},null,2);
 files['board.kicad_pcb']=board.toKiCad();
 files['board.kicad_pro']=JSON.stringify({board:{design_settings:{rules:{min_clearance:.25,min_track_width:.5,min_through_hole_diameter:.2,min_microvia_drill:.1,min_microvia_diameter:.3,min_via_annular_width:.1}}}},null,2);
 files['README.txt']='Circuit Studio fabrication export\n\n100 x 60 mm, selected two/four-layer stack, 1.6 mm nominal thickness. See stackup.json.\nPad sizes and drills come from the assigned package; SMD pads are side-specific.\nMask expansion is 0.05 mm per side; paste uses the SMD pad geometry.\nGerber uses millimeters, 4 integer / 6 fractional digits. All files share an origin.\nNo Gerber silkscreen output yet; KiCad export includes references.\nDrill files are separated by plated layer span; blind/microvia processes require fabrication review; solid zones use 0.25 mm clearance without thermal reliefs.\nChecks cover supported connectivity, layer access, copper clearance and edges.\nVerify exact manufacturer dimensions, mask/paste rules and fabrication outputs.\n';
 return files;
}
export function gerberZip(board){return zipSync(Object.fromEntries(Object.entries(manufacturingFiles(board)).map(([n,t])=>[n,strToU8(t)])),{level:6});}

export function outputJobZip(board,{fabrication=true,bom=true,variant=null}={}){
 const issues=board.issues();if(issues.length)throw Error('Output job blocked by DRC: '+issues.join('; '));if(!fabrication&&!bom)throw Error('Select at least one output');
 const files=fabrication?manufacturingFiles(board):{};if(bom){const q=s=>'"'+String(s??'').replaceAll('"','""')+'"';files['assembly.csv']=['reference,source_id,footprint,value,populate',...assemblyBOM(board.parts,variant).map(p=>[p.reference,p.sourceId,p.footprint,p.value,p.populate?'yes':'DNP'].map(q).join(','))].join('\n');}
 files['job.json']=JSON.stringify({schema:1,variant:variant?.name||'base',layers:board.layers,checks:'passed',pairConstraints:board.pairs,routingGeometry:'Pair constraints are recorded here; importing PCB alone does not configure KiCad custom routing rules',outputs:Object.keys(files)},null,2);return zipSync(Object.fromEntries(Object.entries(files).map(([n,t])=>[n,strToU8(t)])),{level:6});
}
