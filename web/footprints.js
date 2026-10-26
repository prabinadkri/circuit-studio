import {validateFootprint} from './assets.js';
// Original parametric package geometry (millimeters). GPL-2.0-or-later.
// Generic package standards; verify manufacturer-specific variants before fabrication.
const pad=(number,x,y,width=1.8,height=1.8,drill=.8,shape='circle')=>({number:String(number),x,y,width,height,drill,shape,layers:drill?['F.Cu','B.Cu']:['F.Cu']});
const dip=n=>{const spacing=n===28||n===40?15.24:7.62;return ({id:'DIP-'+n,name:`DIP-${n} · 2.54 mm / ${spacing} mm`,revision:1,width:spacing+2,height:(n/2-1)*2.54+4,pads:Array.from({length:n},(_,i)=>i<n/2?pad(i+1,-spacing/2,(i-(n/2-1)/2)*2.54,1.8,1.8,.8,i===0?'rect':'circle'):pad(i+1,spacing/2,((n-1-i)-(n/2-1)/2)*2.54))});};
const header=n=>({id:'HDR-1x'+n,name:`Header 1×${n} · 2.54 mm`,revision:1,width:2.54,height:n*2.54,pads:Array.from({length:n},(_,i)=>pad(i+1,0,(i-(n-1)/2)*2.54,1.8,1.8,1,i===0?'rect':'circle'))});
export const FOOTPRINTS=Object.fromEntries([
 ...[8,14,16,18,20,28,40].map(dip),...[2,3,4,6,8,10].map(header),
 {id:'SOIC-8',name:'SOIC-8 · 1.27 mm / 3.9 mm body',revision:1,width:6.5,height:5,pads:Array.from({length:8},(_,i)=>pad(i+1,i<4?-2.7:2.7,((i<4?i:7-i)-1.5)*1.27,1.5,.6,0,'rect'))},
 ...[2.54,5.08,7.62,10].map(pitch=>({id:'THT-2-'+pitch,name:`Two-pin through-hole · ${pitch} mm`,revision:1,width:pitch+3,height:4,pads:[pad(1,-pitch/2,0,2,2,.8),pad(2,pitch/2,0,2,2,.8)]})),
 {id:'R-0805',name:'Resistor 0805 · 2.0 × 1.25 mm body',revision:1,width:3.8,height:2,pads:[pad(1,-.95,0,1,1.4,0,'rect'),pad(2,.95,0,1,1.4,0,'rect')]},
].map(f=>[f.id,validateFootprint({...f,license:'GPL-2.0-or-later',source:'Circuit Studio parametric package library',limitations:'Generic package geometry; verify exact manufacturer package dimensions.'})]));
export function transformedPads(part){const f=FOOTPRINTS[part.footprint],angle=(part.rotation||0)*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle);const base=f?.pads||[pad(1,-part.pitch/2,0,2,2,.8),pad(2,part.pitch/2,0,2,2,.8)];return base.map((p,i)=>{const x=p.x*(part.side==='B.Cu'?-1:1),net=part.nets[i];return {...p,id:part.ref+':'+p.number,ref:part.ref,net,x:part.x+x*cos-p.y*sin,y:part.y+x*sin+p.y*cos,rotation:part.rotation||0,layers:p.drill?['F.Cu','B.Cu']:[part.side||'F.Cu']};});}
