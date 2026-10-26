// Two-layer copper geometry. GPL-2.0-or-later; Clipper (BSL-1.0), earcut (ISC).
import ClipperLib from 'clipper-lib';
import earcut from 'earcut';
const C=ClipperLib,S=100000,EPS=1e-7;
export const layers=['F.Cu','B.Cu'];
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function pointSegment(p,a,b){const d=(b.x-a.x)**2+(b.y-a.y)**2;if(!d)return distance(p,a);const t=Math.max(0,Math.min(1,((p.x-a.x)*(b.x-a.x)+(p.y-a.y)*(b.y-a.y))/d));return distance(p,{x:a.x+t*(b.x-a.x),y:a.y+t*(b.y-a.y)});}
const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
export function segmentDistance(a,b,c,d){if(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)return 0;return Math.min(pointSegment(a,c,d),pointSegment(b,c,d),pointSegment(c,a,b),pointSegment(d,a,b));}
export function inside(p,poly){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++)if((poly[i].y>p.y)!==(poly[j].y>p.y)&&p.x<(poly[j].x-poly[i].x)*(p.y-poly[i].y)/(poly[j].y-poly[i].y)+poly[i].x)yes=!yes;return yes;}
export function linePolygonDistance(a,b,poly){if(inside(a,poly)||inside(b,poly))return 0;return Math.min(...poly.map((p,i)=>segmentDistance(a,b,p,poly[(i+1)%poly.length])));}
export function polygonDistance(a,b){if(inside(a[0],b)||inside(b[0],a))return 0;return Math.min(...a.map((p,i)=>linePolygonDistance(p,a[(i+1)%a.length],b)));}
export function padPolygon(p,conservative=false){const a=(p.rotation||0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a),scale=conservative?1/Math.cos(Math.PI/64):1;const points=p.shape==='rect'?[[-p.width/2,-p.height/2],[p.width/2,-p.height/2],[p.width/2,p.height/2],[-p.width/2,p.height/2]]:Array.from({length:64},(_,i)=>[p.width/2*scale*Math.cos(i*Math.PI/32),p.height/2*scale*Math.sin(i*Math.PI/32)]);return points.map(([x,y])=>({x:p.x+x*c-y*s,y:p.y+x*s+y*c}));}
const intPath=path=>path.map(p=>({X:Math.round(p.x*S),Y:Math.round(p.y*S)}));
const floatPath=path=>path.map(p=>({x:p.X/S,y:p.Y/S}));
function positive(path){if(!C.Clipper.Orientation(path))path.reverse();return path;}
function boolean(subject,clip,operation){const c=new C.Clipper(),tree=new C.PolyTree();c.AddPaths(subject,C.PolyType.ptSubject,true);c.AddPaths(clip,C.PolyType.ptClip,true);c.Execute(operation,tree,C.PolyFillType.pftNonZero,C.PolyFillType.pftNonZero);return tree;}
function offset(paths,delta,closed=true){const o=new C.ClipperOffset(2,.001*S),result=[];o.AddPaths(paths,C.JoinType.jtRound,closed?C.EndType.etClosedPolygon:C.EndType.etOpenRound);o.Execute(result,delta*S);return result;}
function regions(tree){const out=[];function walk(node){for(const child of node.Childs()){if(!child.IsHole())out.push({outer:floatPath(child.Contour()),holes:child.Childs().filter(c=>c.IsHole()).map(c=>floatPath(c.Contour()))});walk(child);}}walk(tree);return out;}
function regionPaths(region){const outer=positive(intPath(region.outer));return [outer,...region.holes.map(h=>positive(intPath(h)).reverse())];}
export function triangles(region){const points=[...region.outer,...region.holes.flat()],starts=[];let n=region.outer.length;for(const hole of region.holes){starts.push(n);n+=hole.length;}const indices=earcut(points.flatMap(p=>[p.x,p.y]),starts,2);const out=[];for(let i=0;i<indices.length;i+=3)out.push(indices.slice(i,i+3).map(j=>points[j]));return out;}
export function viaPad(v){return {id:v.id,ref:v.id,number:'',x:v.x,y:v.y,width:v.diameter,height:v.diameter,drill:v.drill,shape:'circle',rotation:0,layers:[...layers],net:v.net};}
export function validateCopper(b,pads){
 const finite=n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<10000,net=n=>typeof n==='string'&&n.length>0&&n.length<200||Number.isInteger(n),point=p=>p&&finite(p.x)&&finite(p.y);
 if(b.vias!==undefined&&!Array.isArray(b.vias)||b.zones!==undefined&&!Array.isArray(b.zones)||(b.vias||[]).length>1000||(b.zones||[]).length>32)throw Error('Invalid vias or zones');
 const ids=new Set(pads.map(p=>p.id));for(const v of b.vias||[]){if(!v||typeof v.id!=='string'||!/^via:[a-zA-Z0-9-]{1,64}$/.test(v.id)||ids.has(v.id)||!point(v)||!net(v.net)||!finite(v.diameter)||!finite(v.drill)||v.drill<.2||v.diameter>4||v.diameter-v.drill<.2-1e-9)throw Error('Invalid through via (minimum 0.2 mm drill / 0.1 mm annular ring)');ids.add(v.id);}
 for(const z of b.zones||[]){if(!z||typeof z.id!=='string'||ids.has(z.id)||!net(z.net)||!layers.includes(z.layer)||!Array.isArray(z.points)||z.points.length<3||z.points.length>128||!z.points.every(point)||Math.abs(C.Clipper.Area(intPath(z.points)))<S*S*.01)throw Error('Invalid copper zone');ids.add(z.id);}
}
export function copperGeometry(pads,vias,tracks,zones,points){
 const anchors=[...pads,...vias.map(viaPad)],items=anchors.map(p=>({id:p.id,net:p.net,layers:p.layers,paths:[positive(intPath(padPolygon(p)))],pad:p}));
 for(const [i,t]of tracks.entries()){const ps=points(t),net=anchors.find(p=>p.id===t.from).net;items.push({id:'track:'+i,net,layers:[t.layer],paths:offset([intPath(ps)],.25,false)});}
 const bounds=[intPath([{x:10.25,y:10.25},{x:109.75,y:10.25},{x:109.75,y:69.75},{x:10.25,y:69.75}])],fills=[];
 for(const z of zones){const base=boolean([positive(intPath(z.points))],bounds,C.ClipType.ctIntersection);let obstacles=[];for(const item of items)if(item.net!==z.net&&item.layers.includes(z.layer))obstacles.push(...offset(item.paths,.252));for(const other of zones)if(other.id!==z.id&&other.layer===z.layer&&other.net!==z.net)obstacles.push(...offset([positive(intPath(other.points))],.252));const tree=boolean(C.Clipper.PolyTreeToPaths(base),obstacles,C.ClipType.ctDifference);for(const [i,region]of regions(tree).entries()){const fill={...region,id:z.id+':'+i,net:z.net,layer:z.layer,zoneId:z.id};fills.push(fill);items.push({id:'fill:'+fill.id,net:z.net,layers:[z.layer],paths:regionPaths(region)});}}
 const parent=new Map(items.map(i=>[i.id,i.id]));const root=id=>{let r=id;while(parent.get(r)!==r)r=parent.get(r);while(parent.get(id)!==id){const n=parent.get(id);parent.set(id,r);id=n;}return r;};
 function overlaps(a,b){const tree=boolean(a.paths,b.paths,C.ClipType.ctIntersection);return C.Clipper.PolyTreeToPaths(tree).some(p=>Math.abs(C.Clipper.Area(p))>EPS*S*S);}
 const boxes=items.map(item=>{const ps=item.paths.flat();return {x1:Math.min(...ps.map(p=>p.X)),x2:Math.max(...ps.map(p=>p.X)),y1:Math.min(...ps.map(p=>p.Y)),y2:Math.max(...ps.map(p=>p.Y))};});
 for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){const a=items[i],b=items[j],x=boxes[i],y=boxes[j];if(a.net===null||a.net!==b.net||!a.layers.some(l=>b.layers.includes(l))||root(a.id)===root(b.id)||x.x2<y.x1||y.x2<x.x1||x.y2<y.y1||y.y2<x.y1)continue;if(overlaps(a,b))parent.set(root(a.id),root(b.id));}
 return {fills,root,surfaces:items.filter(i=>!i.id.startsWith('fill:')).flatMap(i=>regions(boolean(i.paths,[],C.ClipType.ctUnion)).map(r=>({...r,id:i.id,layers:i.layers})))};
}

export function withoutDrills(region,pads){const holes=pads.filter(p=>p.drill).map(p=>positive(intPath(Array.from({length:64},(_,i)=>({x:p.x+p.drill/2*Math.cos(i*Math.PI/32),y:p.y+p.drill/2*Math.sin(i*Math.PI/32)})))));return regions(boolean(regionPaths(region),holes,C.ClipType.ctDifference));}
