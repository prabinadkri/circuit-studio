// Circuit Studio RS-274X / Excellon export, GPL-2.0-or-later.
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
 const drills=[...new Set(pads.map(p=>p.drill).filter(Boolean))].sort((a,b)=>a-b),d=['M48','; Plated through holes','METRIC,TZ',...drills.map((v,i)=>`T${String(i+1).padStart(2,'0')}C${v.toFixed(3)}`),'G90','%','G05'];
 for(const [i,size]of drills.entries()){d.push('T'+String(i+1).padStart(2,'0'));for(const p of pads.filter(p=>p.drill===size))d.push('X'+p.x.toFixed(4)+'Y'+(80-p.y).toFixed(4));}d.push('M30','');files['board-PTH.drl']=d.join('\n');
 files['board.kicad_pcb']=board.toKiCad();
 files['README.txt']='Circuit Studio fabrication export\n\n100 x 60 mm, two copper layers, 1.6 mm nominal thickness.\nPad sizes and drills come from the assigned package; SMD pads are side-specific.\nMask expansion is 0.05 mm per side; paste uses the SMD pad geometry.\nGerber uses millimeters, 4 integer / 6 fractional digits. All files share an origin.\nNo Gerber silkscreen output yet; KiCad export includes references.\nThrough vias span both layers; solid zones use 0.25 mm clearance without thermal reliefs.\nChecks cover supported connectivity, layer access, copper clearance and edges.\nVerify exact manufacturer dimensions, mask/paste rules and fabrication outputs.\n';
 return files;
}
export function gerberZip(board){return zipSync(Object.fromEntries(Object.entries(manufacturingFiles(board)).map(([n,t])=>[n,strToU8(t)])),{level:6});}
