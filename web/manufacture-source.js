// Circuit Studio RS-274X and Excellon exports. GPL-2.0-or-later.
import {zipSync,strToU8} from 'fflate';
const coordinate=v=>Math.round(v*1e6).toString();
const xy=p=>'X'+coordinate(p.x)+'Y'+coordinate(80-p.y);
function start(name){return [`G04 Circuit Studio - ${name}*`,'%FSLAX46Y46*%','%MOMM*%','%LPD*%','%ADD10C,0.500000*%','%ADD11C,2.000000*%','%ADD12C,2.100000*%','%ADD13C,0.050000*%','G01*'];}
export function manufacturingFiles(board){
 const issues=board.issues();if(issues.length)throw Error('Resolve board checks before exporting Gerbers: '+issues.join('; '));
 const files={};const pads=board.pads();
 for(const [layer,extension]of [['F.Cu','gtl'],['B.Cu','gbl']]){let g=start(layer);g.push('D11*');for(const p of pads)g.push(xy(p)+'D03*');g.push('D10*');for(const t of board.tracks.filter(t=>t.layer===layer)){const ps=board.points(t);g.push(xy(ps[0])+'D02*');for(const p of ps.slice(1))g.push(xy(p)+'D01*');}g.push('M02*');files['board-'+layer+'.'+extension]=g.join('\n')+'\n';}
 for(const [side,ext]of [['F','gts'],['B','gbs']]){let g=start(side+' mask');g.push('D12*');for(const p of pads)g.push(xy(p)+'D03*');g.push('M02*');files['board-'+side+'.Mask.'+ext]=g.join('\n')+'\n';}
 let edge=start('Edge.Cuts');edge.push('D13*',xy({x:10,y:10})+'D02*');for(const p of [{x:110,y:10},{x:110,y:70},{x:10,y:70},{x:10,y:10}])edge.push(xy(p)+'D01*');edge.push('M02*');files['board-Edge.Cuts.gm1']=edge.join('\n')+'\n';
 files['board-PTH.drl']=['M48','; Circuit Studio plated through holes','METRIC,TZ','T01C0.800','G90','%','G05','T01',...pads.map(p=>'X'+p.x.toFixed(4)+'Y'+(80-p.y).toFixed(4)),'M30',''].join('\n');
 files['board.kicad_pcb']=board.toKiCad();
 files['README.txt']='Circuit Studio fabrication export\n\nTwo copper layers; 100 x 60 mm outline; 1.6 mm nominal board thickness.\nThrough-hole pads: 2 mm diameter, 0.8 mm plated drill. Tracks: 0.5 mm.\nSolder mask openings: 2.1 mm diameter. No silkscreen or paste layers.\nGerber units: millimeters, 4 integer / 6 fractional digits, absolute coordinates.\nAll layers and drills use the same coordinate origin and Y direction.\n\nBasic local checks passed. Inspect Gerbers and verify footprint dimensions,\ncomponent polarity, hole sizes, and manufacturer capabilities before ordering.\nThese generic footprints are not a validated manufacturer part library.\n';
 return files;
}
export function gerberZip(board){return zipSync(Object.fromEntries(Object.entries(manufacturingFiles(board)).map(([n,t])=>[n,strToU8(t)])),{level:6});}
