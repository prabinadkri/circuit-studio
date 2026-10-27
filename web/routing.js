// Conservative, transactional routing tools. GPL-2.0-or-later.
import {segmentDistance,padPolygon,linePolygonDistance} from './copper.js';
export const STACKUPS={two:['F.Cu','B.Cu'],four:['F.Cu','In1.Cu','In2.Cu','B.Cu']};
export const routeLength=points=>points.slice(1).reduce((s,p,i)=>s+Math.hypot(p.x-points[i].x,p.y-points[i].y),0);
const clone=v=>structuredClone(v);
const clearanceIssues=board=>board.issues().filter(s=>!s.includes('unrouted net'));
function transaction(board,fn){const saved=board.serialize();try{fn();board.constructor.validate(board.serialize());const issues=clearanceIssues(board);if(issues.length)throw Error(issues.join('; '));board.onChange();board.render();board.check();}catch(e){board.load(saved);throw e;}}
export function setStackup(board,key){const layers=STACKUPS[key];if(!layers)throw Error('Choose two or four copper layers');if(board.tracks.some(t=>!layers.includes(t.layer))||board.zones.some(t=>!layers.includes(t.layer))||board.vias.some(v=>(v.span||[]).some(l=>!layers.includes(l))))throw Error('Remove internal copper and vias before reducing layer count');board.layers=[...layers];board.onChange();board.render();}
export function addSpannedVia(board,v){const layers=board.layers||STACKUPS.two,start=layers.indexOf(v.span?.[0]),end=layers.indexOf(v.span?.[1]);if(start<0||end<=start)throw Error('Via span must follow stack order');if(v.kind==='micro'&&(end-start!==1||start!==0&&end!==layers.length-1))throw Error('Microvia must join adjacent layers from an outer surface');transaction(board,()=>board.vias.push(clone(v)));}
export function matchLength(board,index,target,side=1){
 const track=board.tracks[index];if(!track||![1,-1].includes(side)||!Number.isFinite(target))throw Error('Select a route and target length');const points=board.points(track),length=routeLength(points),extra=target-length;if(extra<-.0001||extra>80)throw Error('Target must add 0–80 mm');if(extra<.0001)return;
 const candidates=points.slice(1).map((p,i)=>({i,a:points[i],b:p,length:Math.hypot(p.x-points[i].x,p.y-points[i].y)})).filter(s=>s.length>=4&&(s.a.x===s.b.x||s.a.y===s.b.y)).sort((a,b)=>b.length-a.length);
 if(!candidates.length)throw Error('Length tuning needs an axis-aligned segment at least 4 mm long');
 const s=candidates[0],ux=(s.b.x-s.a.x)/s.length,uy=(s.b.y-s.a.y)/s.length,nx=-uy*side,ny=ux*side,h=extra/2;
 const a={x:s.a.x+ux*s.length/3,y:s.a.y+uy*s.length/3},b={x:s.a.x+ux*s.length*2/3,y:s.a.y+uy*s.length*2/3};
 const next=[...points.slice(0,s.i+1),a,{x:a.x+nx*h,y:a.y+ny*h},{x:b.x+nx*h,y:b.y+ny*h},b,...points.slice(s.i+1)];
 // A folded path must not cross or nearly touch itself; such a loop would not have the intended electrical length.
 for(let i=1;i<next.length;i++)for(let j=i+2;j<next.length;j++)if(segmentDistance(next[i-1],next[i],next[j-1],next[j])<.75-1e-8)throw Error('Tuning would fold copper onto itself; choose a larger increment or another side');
 transaction(board,()=>{track.bends=next.slice(1,-1);});return routeLength(board.points(track));
}
function offsetPath(points,offset){const lines=points.slice(1).map((p,i)=>{const a=points[i],d=Math.hypot(p.x-a.x,p.y-a.y);if(d<.01)throw Error('Pair path contains a zero-length segment');return {x:(p.x-a.x)/d,y:(p.y-a.y)/d};});return points.map((p,i)=>{const a=lines[Math.max(0,i-1)],b=lines[Math.min(i,lines.length-1)],nx=-a.y-b.y,ny=a.x+b.x,den=1+a.x*b.x+a.y*b.y;if(den<.2)throw Error('Pair bends are too sharp');return {x:p.x+offset*nx/den,y:p.y+offset*ny/den};});}
export function routePair(board,{positive,negative,layer,center=[],gap=.3,tolerance=.1}){
 if(!Number.isFinite(gap)||gap<.25||gap>10||!Number.isFinite(tolerance)||tolerance<0||tolerance>10)throw Error('Pair gap ≥0.25 mm and length tolerance 0–10 mm required');
 const anchors=board.anchors(),get=id=>{const p=anchors.find(p=>p.id===id);if(!p)throw Error('Unknown pair pad '+id);return p;},[a,b,c,d]=[get(positive.from),get(positive.to),get(negative.from),get(negative.to)];
 if(a.net===null||c.net===null||a.net!==b.net||c.net!==d.net||a.net===c.net)throw Error('Pair requires two distinct connected nets');
 const path=[{x:(a.x+c.x)/2,y:(a.y+c.y)/2},...center,{x:(b.x+d.x)/2,y:(b.y+d.y)/2}],half=(gap+.5)/2;
 let p=offsetPath(path,half),n=offsetPath(path,-half);const near=(p,q)=>Math.hypot(p.x-q.x,p.y-q.y)<.001;if(!near(p[0],a)){[p,n]=[n,p];}if(!near(p[0],a)||!near(p.at(-1),b)||!near(n[0],c)||!near(n.at(-1),d))throw Error('Pair endpoints must match the selected gap and path normals');
 if(Math.abs(routeLength(p)-routeLength(n))>tolerance)throw Error('Pair exceeds length mismatch tolerance');
 const id=crypto.randomUUID();transaction(board,()=>{board.tracks.push({...positive,layer,bends:p.slice(1,-1),pair:id},{...negative,layer,bends:n.slice(1,-1),pair:id});board.pairs.push({id,gap,tolerance});});return id;
}
export function shoveRoute(board,route){
 // Preserve route endpoints and fixed pads/vias. Search bounded orthogonal detours
 // for each conflicting existing route; refuse instead of producing illegal copper.
 const anchors=board.anchors(),get=id=>anchors.find(p=>p.id===id),a=get(route.from),b=get(route.to);if(!a||!b||a.net===null||a.net!==b.net)throw Error('Route endpoints must share a net');
 const ps=[a,...route.bends||[],b],conflicts=board.tracks.filter(t=>t.layer===route.layer&&get(t.from).net!==a.net&&board.points(t).slice(1).some((p,i)=>ps.slice(1).some((q,j)=>segmentDistance(board.points(t)[i],p,ps[j],q)<.75)));
 if(conflicts.some(t=>t.pair))throw Error('Shove cannot move a constrained pair; move it explicitly');
 transaction(board,()=>{
  board.tracks.push({...clone(route),bends:clone(route.bends||[])});
  for(const t of conflicts){const original=clone(t.bends),from=get(t.from),to=get(t.to);let found=false;const box={x1:Math.min(...ps.map(p=>p.x)),x2:Math.max(...ps.map(p=>p.x)),y1:Math.min(...ps.map(p=>p.y)),y2:Math.max(...ps.map(p=>p.y))};
   for(const margin of [1,2,4,8,12]){const paths=[...[-1,1].map(sign=>{const y=sign<0?box.y1-margin:box.y2+margin;return [{x:from.x,y},{x:to.x,y}];}),...[-1,1].map(sign=>{const x=sign<0?box.x1-margin:box.x2+margin;return [{x,y:from.y},{x,y:to.y}];})];
    for(const bends of paths){t.bends=bends;const other=board.tracks.filter(o=>o!==t);let bad=false;const path=board.points(t);for(const o of other)if(o.layer===t.layer&&get(o.from).net!==get(t.from).net){const q=board.points(o);if(path.slice(1).some((p,i)=>q.slice(1).some((r,j)=>segmentDistance(path[i],p,q[j],r)<.75)))bad=true;}
     if(path.some(p=>p.x<10.5||p.x>109.5||p.y<10.5||p.y>69.5))bad=true;for(const pad of anchors)if(pad.net!==from.net&&pad.layers.includes(t.layer)&&path.slice(1).some((p,i)=>linePolygonDistance(path[i],p,padPolygon(pad,true))<.5))bad=true;
     if(!bad){found=true;break;}}
    if(found)break;
   }if(!found){t.bends=original;throw Error('No legal shove within the bounded search');}
  }
 });return conflicts.length;
}
