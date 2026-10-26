// Configurable, explicitly powered MCU package. GPL-2.0-or-later.
import {ChipElm,Pin} from './ChipElm';
import {CircuitElm} from './CircuitElm';
import {CircuitNode} from './CircuitNode';
import {StringTokenizer} from './StringTokenizer';
import {CircuitXMLSerializer} from './CircuitXMLSerializer';
import {CircuitXMLDeserializer} from './CircuitXMLDeserializer';
import {Graphics} from './Graphics';
import {Font} from './Font';
import {EditInfo} from './EditInfo';
type PackagePin={name:string;physical:string;role:string};
const DEFAULT={device:'unconfigured',label:'MCU',clockHz:16000000,pins:[{name:'GPIO',physical:'1',role:'gpio'},{name:'VCC',physical:'2',role:'power'},{name:'GND',physical:'3',role:'ground'},{name:'RESET',physical:'4',role:'reset'}]};
export class MCUPackageElm extends ChipElm {
 profile=DEFAULT;drive:Record<string,string>={};sources:any[]=[];
 constructor(x:number,y:number);
 constructor(x:number,y:number,x2:number,y2:number,f:number,st:StringTokenizer);
 constructor(x:number,y:number,x2?:number,y2?:number,f?:number,st?:StringTokenizer){if(x2===undefined)super(x,y);else super(x,y,x2,y2!,f!,st!);this.setupPins();this.allocNodes();}
 definition(){return this.profile||DEFAULT;}
 io(){return this.definition().pins.map((p,i)=>({...p,index:i})).filter(p=>p.role==='gpio'||p.role==='analog');}
 configure(profile:any){
  if(!profile||typeof profile.device!=='string'||!/^[-a-z0-9]{1,32}$/.test(profile.device)||typeof profile.label!=='string'||profile.label.length>60||!Number.isFinite(profile.clockHz)||profile.clockHz<=0||!Array.isArray(profile.pins)||profile.pins.length<4||profile.pins.length>64)throw Error('Invalid MCU package');
  const names=new Set(),pads=new Set();for(const p of profile.pins){if(!p||typeof p.name!=='string'||!/^[-A-Za-z0-9_+]{1,16}$/.test(p.name)||typeof p.physical!=='string'||!/^[-A-Za-z0-9_+]{1,16}$/.test(p.physical)||names.has(p.name)||pads.has(p.physical)||!['gpio','analog','power','ground','reset','clock','reference','reserved'].includes(p.role))throw Error('Invalid MCU pin map');names.add(p.name);pads.add(p.physical);}
  if(!profile.pins.some((p:PackagePin)=>p.role==='ground')||!profile.pins.some((p:PackagePin)=>p.role==='power')||!profile.pins.some((p:PackagePin)=>p.role==='reset'))throw Error('MCU requires power, ground and reset pins');
  this.profile=structuredClone(profile);this.drive={};this.setupPins();this.allocNodes();this.setPoints();
 }
 setupPins(){const pins=this.definition().pins,half=Math.ceil(pins.length/2);this.sizeX=7;this.sizeY=half+2;this.pins=pins.map((p,i)=>new Pin(this,(i<half?i:pins.length-i-1)+1,i<half?ChipElm.SIDE_W:ChipElm.SIDE_E,p.physical+':'+p.name));}
 getChipName(){return this.definition().label+' · '+this.definition().clockHz/1e6+'MHz';}
 drawLabel(g:Graphics,x:number,y:number){g.setFont(new Font('normal',0,10*this.csize));const rotated=this.isFlippedXY();this.drawCenteredText(g,this.definition().label,x,rotated?y-12*this.csize:this.rectPointsY[0]+12*this.csize,true);this.drawCenteredText(g,this.definition().clockHz/1e6+' MHz · fixed',x,rotated?y+12*this.csize:this.rectPointsY[2]-12*this.csize,true);}
 getPostCount(){return this.definition().pins.length;}
 getVoltageSourceCount(){return this.io().length;}
 getInternalNodeCount(){return this.io().length;}
 getDumpType(){return 510;}
 isDigitalChip(){return false;}
 nonLinear(){return true;}
 ground(){return this.nodes[this.definition().pins.findIndex(p=>p.role==='ground')];}
 setVoltageSource(j:number,vs:any){this.sources[j]=vs;vs.setNodes(this.ground(),this.nodes[this.getPostCount()+j]);}
 stamp(){for(const [j,p] of this.io().entries()){CircuitElm.sim.stampVoltageSource(this.ground(),this.nodes[this.getPostCount()+j],this.sources[j]);CircuitElm.sim.stampNonLinear(this.nodes[p.index]);CircuitElm.sim.stampNonLinear(this.nodes[this.getPostCount()+j]);}CircuitElm.sim.stampNonLinear(this.ground());}
 doStep(){for(const [j,p] of this.io().entries()){const state=this.drive[p.name]||'Z',resistance=state==='Z'?1e12:['H','L'].includes(state)?30000:30;CircuitElm.sim.stampResistor(this.nodes[p.index],this.nodes[this.getPostCount()+j],resistance);CircuitElm.sim.updateVoltageSource(this.ground(),this.nodes[this.getPostCount()+j],this.sources[j],['1','H'].includes(state)?5:0);}}
 setDrive(name:string,state:string|null){if(state!==null&&!['0','1','Z','H','L'].includes(state))throw Error('Invalid MCU drive');if(name==='*'){this.drive={};return;}if(!this.io().some(p=>p.name===name))throw Error('Unknown MCU pin');this.drive[name]=state||'Z';}
 getMatrixConnection(a:number,b:number){return a!==b;}
 hasGroundConnection(){return false;}
 getConnection(){return false;}
 getChipEditInfo(n:number):EditInfo|null{return null;}
 dumpXml(doc:Document,elem:Element){super.dumpXml(doc,elem);CircuitXMLSerializer.dumpAttr(elem,'mp',JSON.stringify(this.definition()));}
 undumpXml(xml:CircuitXMLDeserializer){const value=xml.parseStringAttr('mp',null);if(value)this.configure(JSON.parse(value));super.undumpXml(xml);}
}
