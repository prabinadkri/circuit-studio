// Circuit Studio integration API, GPL-2.0-or-later.
import type { CirSim } from './CirSim';
export class StudioAPI {
 constructor(private app: CirSim) {}
 elements(): any[] {
  this.app.ensureStudioIds();
  if(this.app.analyzeFlag){this.app.sim.analyzeCircuit();this.app.analyzeFlag=false;}
  if(this.app.sim.needsStamp)this.app.sim.preStampAndStampCircuit();
  return this.app.elmList.map((e:any)=>({
   id:e.studioId,type:e.studioType||e.getClassName(),engineType:e.getClassName(),
   value:String(e.resistance??e.capacitance??e.inductance??e.maxVoltage??''),
   meta:structuredClone(e.studioMeta),x:e.x,y:e.y,x2:e.x2,y2:e.y2,
   pins:Array.from({length:e.getPostCount()},(_,i)=>({id:e.studioPins[i],index:i,name:e.pins?.[i]?.text||String(i+1),output:!!e.pins?.[i]?.output,net:e.nodes[i]?.index??-1,x:e.getPost(i)?.x,y:e.getPost(i)?.y})),
   info:e.getInfoJS(),selected:e.isSelected(),
  }));
 }
 advanceSteps(count:number):number {
  if(!Number.isInteger(count)||count<1||count>10000)throw Error('Step count must be 1–10000');
  if(this.app.simRunning)throw Error('Pause the circuit before deterministic stepping');
  if(this.app.analyzeFlag){this.app.sim.analyzeCircuit();this.app.analyzeFlag=false;}
  if(this.app.sim.needsStamp)this.app.sim.preStampAndStampCircuit();
  const before=this.app.sim.t;this.app.sim.runCircuit(true,count);
  if(this.app.stopMessage)throw Error(this.app.stopMessage);
  return this.app.sim.t-before;
 }
 find(id:string):any {const e=this.app.elmList.find((e:any)=>e.studioId===id);if(!e)throw Error('Component no longer exists');return e;}
 add(type:string,x:number,y:number,x2:number,y2:number):string {
  if(!this.catalog().some(e=>e.type===type))throw Error('Unknown library component: '+type);
  for(const n of [x,y,x2,y2])if(!Number.isInteger(n)||Math.abs(n)>100000||n%8)throw Error('Coordinates must be multiples of 8 within ±100000');
  if(x===x2&&y===y2)throw Error('Component endpoints must differ');
  const e=this.app.constructElement(type,x,y);if(!e)throw Error('Component cannot be constructed');
  e.studioType=type;e.x2=x2;e.y2=y2;e.setPoints();
  if(e.creationFailed()){e.delete();throw Error('Component requires configuration in the editor');}
  this.app.undoManager.pushUndo();this.app.elmList.push(e);e.draggingDone();
  this.app.ensureStudioIds();this.app.needAnalyze();this.app.unsavedChanges=true;this.app.repaint();return e.studioId;
 }
 remove(id:string):void {
  const e=this.find(id);this.app.undoManager.pushUndo();e.delete();
  this.app.elmList.splice(this.app.elmList.indexOf(e),1);this.app.needAnalyze();this.app.unsavedChanges=true;this.app.repaint();
 }
 select(id:string,center=false):void {
  const e=this.find(id);this.app.mouse.clearSelection();e.setSelected(true);
  this.app.mouse.setMouseElm(e);
  if(center){const t=this.app.transform;t[4]=this.app.circuitArea.width/2-(e.x+e.x2)/2*t[0];t[5]=this.app.circuitArea.height/2-(e.y+e.y2)/2*t[3];}
  this.app.repaint();
 }
 metadata(id:string,meta:any):void {
  const e=this.find(id);this.app.undoManager.pushUndo();
  e.studioMeta=JSON.parse(JSON.stringify(meta));this.app.unsavedChanges=true;this.app.repaint();
 }
 properties(id:string):any[] {
  const e=this.find(id),out=[];
  for(let i=0;i<64;i++){const p=e.getEditInfo(i);if(!p)break;
   if(p.choice||p.checkbox||p.button||p.textArea||p.widget||p.loadFile)continue;
   out.push({index:i,name:p.name,text:p.text,value:p.value,positive:p.positive,nonNegative:p.nonNegative,integer:p.integer});
  }return out;
 }
 setProperty(id:string,index:number,value:string|number):void {
  const e=this.find(id),p=e.getEditInfo(index);if(!p||p.choice||p.checkbox||p.button||p.widget||p.loadFile)throw Error('Use detailed properties for this field');
  if(p.text!==null){if(typeof value!=='string'||value.length>4096)throw Error('Invalid text');p.text=value;p.textf=document.createElement('input');p.textf.value=value;}
  else{if(typeof value!=='number'||!Number.isFinite(value)||p.positive&&value<=0||p.nonNegative&&value<0||p.integer&&!Number.isInteger(value))throw Error('Value is outside the supported range');p.value=value;}
  this.app.undoManager.pushUndo();e.setEditValue(index,p);if(p.error)throw Error(p.error);
  e.setPoints();this.app.needAnalyze();this.app.unsavedChanges=true;this.app.repaint();
 }
 edit(id:string):void {this.app.commands.doEdit(this.find(id));}
 selection():string|null {return this.app.mouse.getMouseElm()?.studioId??this.app.elmList.find((e:any)=>e.isSelected())?.studioId??null;}
 catalog():any[] {return this.app.ui.mainMenuItemNames.map((name:string,i:number)=>({type:name,label:this.app.ui.mainMenuItems[i].getLabel?.()||name})).filter((p:any)=>p.type.endsWith('Elm'));}
}
