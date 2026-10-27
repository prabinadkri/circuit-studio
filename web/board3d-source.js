// Board and procedural package preview. GPL-2.0-or-later; Three.js MIT.
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {STLExporter} from 'three/addons/exporters/STLExporter.js';
import {FOOTPRINTS} from './footprints.js';
import {withoutDrills} from './copper.js';
const vec=p=>new THREE.Vector2(p.x,-p.y);
const material=color=>new THREE.MeshStandardMaterial({color,roughness:.65,metalness:.1,side:THREE.DoubleSide});
function shape(points,holes=[]){const s=new THREE.Shape(points.map(vec));for(const h of holes)s.holes.push(new THREE.Path(h.map(vec)));return s;}
function extrude(s,depth,z,mat){const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:false,curveSegments:24}),mat);mesh.position.z=z;return mesh;}
export function boardScene(board,{components=true}={}){
 if(board.vias.some(v=>v.span&&(v.span[0]!==board.layers[0]||v.span[1]!==board.layers.at(-1))))throw Error('Mechanical preview/export of blind or microvia cavities is not implemented');
 const root=new THREE.Group();root.name='Circuit Studio assembly';root.userData={units:'millimeter',coordinateSystem:'x=PCB x, y=-PCB y, z=height; board top z=0',thickness:1.6,modelFidelity:'Procedural package envelopes, not manufacturer mechanical models'};
 const gold=material(0xc6a34e),substrate=material(0x205e48),body=material(0x343b47),silver=material(0xadb9c6),pads=board.anchors();
 const outline=shape([{x:10,y:10},{x:110,y:10},{x:110,y:70},{x:10,y:70}]);
 for(const p of pads.filter(p=>p.drill)){const hole=new THREE.Path();hole.absarc(p.x,-p.y,p.drill/2,0,Math.PI*2,true);outline.holes.push(hole);}
 const pcb=extrude(outline,1.6,-1.6,substrate);pcb.name='PCB substrate 100x60x1.6 mm';root.add(pcb);
 for(const surface of [...board.copper().surfaces,...board.copper().fills.map(f=>({...f,layers:[f.layer]}))])for(const region of withoutDrills(surface,pads))for(const layer of surface.layers){const mesh=extrude(shape(region.outer,region.holes),.035,layer==='F.Cu'?0:layer==='B.Cu'?-1.635:-1.6*board.layers.indexOf(layer)/(board.layers.length-1),gold);mesh.name=surface.id+' '+layer;root.add(mesh);}
 if(components)for(const p of board.parts){const f=FOOTPRINTS[p.footprint],height=p.footprint?.startsWith('DIP')?3.2:p.footprint?.startsWith('HDR')?6:p.footprint==='SOIC-8'?1.5:p.footprint==='R-0805'?.6:2.5;const group=new THREE.Group();group.name=p.ref;group.userData={reference:p.ref,footprint:p.footprint,sourceId:p.sourceId||null,pcbOrigin:[p.x,p.y],rotation:p.rotation||0,side:p.side||'F.Cu',geometry:'Approximate package envelope'};group.position.set(p.x,-p.y,p.side==='B.Cu'?-1.6:0);group.rotation.z=-(p.rotation||0)*Math.PI/180;if(p.side==='B.Cu')group.rotation.y=Math.PI;const width=p.footprint==='SOIC-8'?3.9:p.footprint==='R-0805'?2:f?.width||p.pitch+2,heightXY=p.footprint==='R-0805'?1.25:f?.height||3.4;const component=new THREE.Mesh(new THREE.BoxGeometry(width,heightXY,height),body);component.position.z=height/2+.1;group.add(component);const marker=new THREE.Mesh(new THREE.SphereGeometry(.35,12,8),silver);marker.position.set(-width/2+.6,heightXY/2-.6,height+.1);group.add(marker);root.add(group);}
 root.updateMatrixWorld(true);return root;
}
export async function gltf(board,options){const root=boardScene(board,options);root.scale.setScalar(.001);root.userData.units='meter';root.userData.coordinateSystem='x=PCB x/1000, y=-PCB y/1000, z=height/1000';root.updateMatrixWorld(true);const value=await new GLTFExporter().parseAsync(root,{binary:false});dispose(root);return value;}
export function stl(board,options){const root=boardScene(board,options),result=new STLExporter().parse(root);dispose(root);return result;}
export function mechanicalManifest(board){return {schema:1,units:'mm',bounds:{x:[10,110],y:[10,70],z:[-1.6,0]},thickness:1.6,drills:board.anchors().filter(p=>p.drill).map(p=>({id:p.id,x:p.x,y:p.y,diameter:p.drill})),components:board.parts.map(p=>({reference:p.ref,footprint:p.footprint,origin:[p.x,p.y,p.side==='B.Cu'?-1.6:0],rotation:p.rotation||0,side:p.side||'F.Cu'})),limits:'Procedural envelopes only; STL uses mm; glTF uses meters and negates PCB Y. No STEP or manufacturer body certification.'};}
function dispose(root){const materials=new Set();root.traverse(o=>{o.geometry?.dispose();if(o.material)materials.add(o.material);});for(const m of materials)m.dispose();}
export class BoardPreview{
 constructor(container,board){this.container=container;this.board=board;this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x111b27);this.camera=new THREE.PerspectiveCamera(40,1,.1,2000);this.camera.up.set(0,0,1);this.camera.position.set(150,-150,120);this.renderer=new THREE.WebGLRenderer({antialias:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));container.replaceChildren(this.renderer.domElement);this.renderer.domElement.setAttribute('aria-label','Interactive 3D board preview. Drag to orbit, scroll to zoom. Use view buttons for keyboard navigation.');this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.target.set(60,-40,0);this.controls.addEventListener('change',()=>this.draw());this.scene.add(new THREE.HemisphereLight(0xffffff,0x58667a,3));const light=new THREE.DirectionalLight(0xffffff,4);light.position.set(40,-30,120);this.scene.add(light);this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(container);this.refresh();}
 resize(){const w=this.container.clientWidth,h=this.container.clientHeight;if(!w||!h)return;this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h);this.draw();}
 refresh(components=true){if(this.assembly){this.scene.remove(this.assembly);dispose(this.assembly);}this.assembly=boardScene(this.board,{components});this.scene.add(this.assembly);this.controls.update();this.resize();}
 view(direction){this.camera.position.copy(new THREE.Vector3(...({top:[60,-40,180],bottom:[60,-40,-180],iso:[150,-150,120]}[direction]||[150,-150,120])));this.controls.target.set(60,-40,0);this.controls.update();this.draw();}
 draw(){this.renderer.render(this.scene,this.camera);}
}
