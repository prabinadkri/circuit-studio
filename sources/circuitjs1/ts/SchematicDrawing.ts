// Circuit Studio drawing gestures and view grid. GPL-2.0-or-later.
import {Point} from './Point';
import {WireRouter} from './WireRouter';
import {RoutedWireElm} from './RoutedWireElm';

export class SchematicDrawing {
 grid=true;
 private corners: Point[]=[];
 private legs: Point[][]=[];
 private preview: Point[]=[];
 private target: {point:Point,connected:boolean}|null=null;
 private pressed: {x:number,y:number,starting:boolean}|null=null;
 private message='';
 constructor(private app:any){
  const canvas=app.ui.cv as HTMLCanvasElement;
  canvas.addEventListener('mousedown',e=>{
   if(!this.active()||e.button!==0||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey)return;
   this.update(e);if(!this.target)return;this.stop(e);canvas.focus();
   this.pressed={x:e.clientX,y:e.clientY,starting:!this.corners.length};
   if(!this.corners.length)this.corners=[this.target.point];
   this.app.repaint();
  },true);
  canvas.addEventListener('mousemove',e=>{if(this.active()){this.update(e);if(this.corners.length)this.stop(e);}},true);
  canvas.addEventListener('mouseup',e=>{
   if(!this.pressed||e.button!==0)return;
   const press=this.pressed;this.pressed=null;this.stop(e);this.update(e);
   if(!this.target)return;
   const dragged=Math.hypot(e.clientX-press.x,e.clientY-press.y)>4;
   if(press.starting&&!dragged)return;
   if(dragged||this.target.connected)this.finish();else this.corner();
  },true);
  for(const type of ['click','dblclick','contextmenu'])canvas.addEventListener(type,e=>{
   if(!this.active())return;
   this.stop(e);
   if(type==='contextmenu')this.cancel();
   if(type==='dblclick')this.finish();
  },true);
  canvas.addEventListener('mouseleave',()=>{this.pressed=null;if(!this.corners.length){this.target=null;this.preview=[];}app.repaint();});
  window.addEventListener('blur',()=>{this.pressed=null;});
 }
 private stop(e:Event){e.preventDefault();e.stopImmediatePropagation();}
 private active(){return this.app.ui.mouseModeStr==='RoutedWireElm'&&!this.app.ui.isReadOnly()&&!this.app.modalDialogIsShowing()&&!this.app.ui.cv.classList.contains('view-panning');}
 state(){return {grid:this.grid,spacing:this.app.gridSize,pending:!!this.corners.length,corners:this.corners.map(p=>({x:p.x,y:p.y})),preview:this.preview.map(p=>({x:p.x,y:p.y})),target:this.target?{x:this.target.point.x,y:this.target.point.y,connected:this.target.connected}:null,message:this.message};}
 configure(options:{grid?:boolean,spacing?:number}){
  if(options.grid!==undefined)this.grid=!!options.grid;
  if(options.spacing===8||options.spacing===16){this.cancel();this.app.menus.smallGridCheckItem.setState(options.spacing===8);this.app.setGrid();}
  this.app.repaint();
 }
 cancel(){this.corners=[];this.legs=[];this.preview=[];this.target=null;this.pressed=null;this.message='';this.app.repaint();}
 back(){
  if(this.corners.length<=1){this.cancel();return;}
  this.corners.pop();this.legs.pop();this.preview=[];this.message='Last corner removed';this.app.repaint();
 }
 private update(e:MouseEvent){
  const r=this.app.ui.cv.getBoundingClientRect(),sx=e.clientX-r.left,sy=e.clientY-r.top;
  if(!this.app.circuitArea.contains(sx,sy)){this.target=null;this.preview=[];return;}
  const m=this.app.mouse,x=m.inverseTransformX(sx),y=m.inverseTransformY(sy);
  let point=new Point(this.app.snapGrid(x),this.app.snapGrid(y)),connected=false,best=(10/this.app.transform[0])**2;
  // Prefer exact pin coordinates even when an imported part uses the finer grid.
  for(const elm of this.app.elmList)for(let i=0;i<elm.getPostCount();i++){
   const p=elm.getPost(i),d=(p.x-x)**2+(p.y-y)**2;
   if(d<=best){best=d;point=new Point(p.x,p.y);connected=true;}
  }
  if(!connected)for(const elm of this.app.elmList){
   if(!elm.isWireElm())continue;
   const points=elm.routePoints||[elm.getPost(0),elm.getPost(1)];
   for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i];
    const p=a.x===b.x?new Point(a.x,this.app.snapGrid(y)):a.y===b.y?new Point(this.app.snapGrid(x),a.y):point;
    const d=(p.x-x)**2+(p.y-y)**2;
    if(d<=best&&elm.pointOnWireInterior(p.x,p.y)){best=d;point=p;connected=true;}
   }
  }
  if(this.target?.point.x===point.x&&this.target?.point.y===point.y&&this.preview.length)return;
  this.target={point,connected};this.preview=[];this.message='';
  if(this.corners.length){
   const from=this.corners[this.corners.length-1];
   if(from.x!==point.x||from.y!==point.y){
    this.preview=this.route(from,point);
    if(this.preview.length<2)this.message='No clear route. Add a corner around the obstacle.';
   }
  }
  this.app.repaint();
 }
 private route(from:Point,to:Point):Point[]{
  const step=[from.x,from.y,to.x,to.y].every(n=>n%this.app.gridSize===0)?this.app.gridSize:8;
  // Bound interactive routing work, independently of distant schematic objects.
  const bounds={x:Math.min(from.x,to.x)-64,y:Math.min(from.y,to.y)-64,width:Math.abs(to.x-from.x)+128,height:Math.abs(to.y-from.y)+128};
  if((bounds.width/step+8)*(bounds.height/step+8)>250000)return [];
  const wire={x:from.x,y:from.y,x2:to.x,y2:to.y,getPostCount:()=>0,getPost:()=>from,addRoutingObstacle:()=>{}};
  const router=new WireRouter();router.initGrid(wire,step,this.app.elmList,bounds);
  const points=router.routeWire(from.x,from.y,to.x,to.y);
  if(points.length<2||points[0].x!==from.x||points[0].y!==from.y||points.at(-1)!.x!==to.x||points.at(-1)!.y!==to.y)return [];
  return points;
 }
 private corner(){
  if(this.preview.length<2)return;
  this.legs.push(this.preview);this.corners.push(this.preview[this.preview.length-1]);this.preview=[];this.app.repaint();
 }
 finish(){
  if(!this.active()||!this.corners.length)return;
  if(this.target&&this.message)return;
  const legs=[...this.legs,...(this.preview.length>1?[this.preview]:[])];
  if(!legs.length)return;
  const points=legs.flatMap((leg,i)=>i?leg.slice(1):leg).map(p=>new Point(p.x,p.y));
  if(points[0].x===points.at(-1)!.x&&points[0].y===points.at(-1)!.y)return;
  this.app.undoManager.pushUndo();
  // Only intentional endpoints join existing wires; ordinary crossings stay separate.
  this.app.mouse.splitAt(points[0].x,points[0].y);
  const end=points.at(-1)!;this.app.mouse.splitAt(end.x,end.y);
  const wire=new RoutedWireElm(points);this.app.elmList.push(wire);
  this.app.ensureStudioIds();this.app.needAnalyze();this.app.unsavedChanges=true;
  this.app.undoManager.writeRecoveryToStorage();this.cancel();
 }
 drawGrid(ctx:CanvasRenderingContext2D){
  if(!this.grid)return;
  const t=this.app.transform,s=t[0],area=this.app.circuitArea;
  let step=this.app.gridSize;while(step*s<9)step*=2;
  const left=-t[4]/s,top=-t[5]/s,right=(area.width-t[4])/s,bottom=(area.height-t[5])/s;
  ctx.save();ctx.beginPath();ctx.rect(left,top,right-left,bottom-top);ctx.clip();
  for(let x=Math.ceil(left/step)*step;x<=right;x+=step)for(let y=Math.ceil(top/step)*step;y<=bottom;y+=step){
   ctx.fillStyle=x%(step*4)===0&&y%(step*4)===0?'#91a1b8':'#bec9d8';ctx.fillRect(x-.6/s,y-.6/s,1.2/s,1.2/s);
  }
  ctx.restore();
 }
 drawPreview(ctx:CanvasRenderingContext2D){
  if(!this.active()){if(this.app.ui.mouseModeStr!=='RoutedWireElm'&&this.corners.length)this.cancel();return;}
  const scale=this.app.transform[0];ctx.save();ctx.strokeStyle=this.message?'#b45337':'#3269b5';ctx.lineWidth=2/scale;
  ctx.setLineDash([5/scale,3/scale]);
  for(const points of [...this.legs,this.preview]){
   ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();
  }
  ctx.setLineDash([]);
  for(const p of this.corners){ctx.fillStyle='#3269b5';ctx.fillRect(p.x-3/scale,p.y-3/scale,6/scale,6/scale);}
  if(this.target){const p=this.target.point;ctx.beginPath();ctx.arc(p.x,p.y,(this.target.connected?6:4)/scale,0,Math.PI*2);ctx.stroke();}
  ctx.restore();
 }
}
