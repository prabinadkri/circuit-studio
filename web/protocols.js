// Digital lab protocol models, instruction-timestamp driven. GPL-2.0-or-later.
import {TICK_HZ,resolveDigital} from './digital.js';
export class Journal{constructor(limit=2000){this.limit=limit;this.rows=[];this.dropped=0;}add(row){if(this.rows.length===this.limit){this.rows.shift();this.dropped++;}this.rows.push(row);}}
const bit=s=>s==='0'||s===0||s===false?0:s==='1'||s==='H'||s==='Z'||s===1||s===true?1:null;
export class UART8N1{
 constructor(baud,emit=()=>{}){if(![9600,115200].includes(baud))throw Error('UART supports 9600 or 115200, 8N1');this.period=TICK_HZ/baud;this.emit=emit;this.level=1;this.frame=null;}
 update(tick,state){const next=bit(state);if(next===null)throw Error('UART line contention');this.advance(tick);if(this.level===1&&next===0&&!this.frame)this.frame={start:tick,next:tick+this.period/2,index:-1,value:0};this.level=next;}
 advance(tick){while(this.frame&&this.frame.next<=tick){const f=this.frame;if(f.index===-1&&this.level!==0){this.frame=null;break;}if(f.index>=0&&f.index<8)f.value|=this.level<<f.index;if(f.index===8){this.emit({tick:Math.round(f.next),protocol:'UART',value:f.value,error:this.level?'':'framing'});this.frame=null;break;}f.index++;f.next=f.start+(f.index+1.5)*this.period;}}
}
export class SPIByteSlave{
 constructor(mode=0,emit=()=>{}){if(!Number.isInteger(mode)||mode<0||mode>3)throw Error('SPI mode 0–3 required');this.mode=mode;this.emit=emit;this.cpol=mode>>1;this.cpha=mode&1;this.cs=1;this.clock=this.cpol;this.response=0xa5;this.count=0;this.value=0;this.miso='Z';}
 update(tick,cs,clock,mosi){[cs,clock,mosi]=[cs,clock,mosi].map(bit);if([cs,clock,mosi].includes(null))throw Error('SPI line contention');if(cs){if(!this.cs&&this.count)this.emit({tick,protocol:'SPI',error:'incomplete byte',bits:this.count});this.miso='Z';this.count=0;this.value=0;}else if(this.cs){this.count=0;this.value=0;this.miso=this.cpha?'0':String(this.response>>7&1);}else if(clock!==this.clock){const leading=clock!==this.cpol,sample=this.cpha?!leading:leading;if(sample){this.value=this.value<<1|mosi;this.count++;if(this.count===8){this.emit({tick,protocol:'SPI',mode:this.mode,mosi:this.value,miso:this.response});this.response=this.value;this.count=0;this.value=0;}}else this.miso=String(this.response>>(7-this.count)&1);}this.cs=cs;this.clock=clock;return this.miso;}
}
export class EEPROM24LC256{
 constructor(){this.bytes=new Uint8Array(32768).fill(255);this.pointer=0;this.busyUntil=0;this.pending=new Map();this.addressBytes=[];this.writeProtect=false;}
 start(read,tick){if(tick<this.busyUntil)return false;this.readMode=read;this.addressBytes=[];return true;}
 write(value){if(this.addressBytes.length<2){this.addressBytes.push(value);if(this.addressBytes.length===2)this.pointer=(this.addressBytes[0]<<8|value)&32767;}else{if(!this.writeProtect)this.pending.set(this.pointer,value);this.pointer=this.pointer&~63|(this.pointer+1)&63;}return true;}
 read(){const value=this.bytes[this.pointer];this.pointer=(this.pointer+1)&32767;return value;}
 stop(tick){if(this.pending.size){for(const [address,value]of this.pending)this.bytes[address]=value;this.pending.clear();this.busyUntil=tick+Math.round(.005*TICK_HZ);}}
}
export class SSD1306{
 constructor(){this.pixels=new Uint8Array(1024);this.on=false;this.invert=false;this.column=0;this.page=0;this.mode=2;this.columns=[0,127];this.pages=[0,7];this.command=null;this.args=[];}
 start(read){this.control=null;return !read;}
 write(value){if(this.control===null){if(value!==0&&value!==0x40)return false;this.control=value;return true;}if(this.control===0x40){this.pixels[this.page*128+this.column]=value;if(++this.column>this.columns[1]){this.column=this.columns[0];if(this.mode===0&&++this.page>this.pages[1])this.page=this.pages[0];}return true;}
 const counts={0x20:1,0x21:2,0x22:2,0x81:1,0x8d:1,0xa8:1,0xd3:1,0xd5:1,0xd9:1,0xda:1,0xdb:1};if(this.command!==null){this.args.push(value);if(this.args.length===counts[this.command]){if(this.command===0x20){if(![0,2].includes(value))return false;this.mode=value;}if(this.command===0x21){if(this.args[0]>this.args[1]||this.args[1]>127)return false;this.columns=[...this.args];this.column=this.columns[0];}if(this.command===0x22){if(this.args[0]>this.args[1]||this.args[1]>7)return false;this.pages=[...this.args];this.page=this.pages[0];}this.command=null;}return true;}
 if(value in counts){this.command=value;this.args=[];}else if(value===0xae||value===0xaf)this.on=value===0xaf;else if(value===0xa6||value===0xa7)this.invert=value===0xa7;else if(value>=0xb0&&value<=0xb7)this.page=value&7;else if(value<=15)this.column=(this.column&112)|value;else if(value>=16&&value<=23)this.column=(this.column&15)|((value&7)<<4);else if(![0xa0,0xa1,0xa4,0xc0,0xc8].includes(value)&&!(value>=0x40&&value<=0x7f))return false;return true;}
 read(){return 255;}stop(){}
}
export class HD44780{
 constructor(){this.ddram=new Uint8Array(128).fill(32);this.cgram=new Uint8Array(64);this.address=0;this.cg=false;this.on=false;this.increment=true;this.high=null;this.four=false;this.enable=0;this.busyUntil=0;}
 update(tick,enable,rs,nibble){enable=bit(enable);rs=bit(rs);if(this.enable===1&&enable===0){if(tick<this.busyUntil){this.enable=enable;return;}if(!this.four){if(nibble===2){this.four=true;this.high=null;}else this.command(nibble<<4,tick);}else if(this.high===null)this.high={rs,nibble};else{const b=this.high.nibble<<4|nibble;const data=this.high.rs;this.high=null;if(data){const memory=this.cg?this.cgram:this.ddram;memory[this.address%memory.length]=b;this.address=(this.address+(this.increment?1:127))%memory.length;this.busyUntil=tick+74000;}else this.command(b,tick);}}this.enable=enable;}
 command(b,tick){this.busyUntil=tick+(b===1||b===2?3040000:74000);if(b===1){this.ddram.fill(32);this.address=0;this.cg=false;}else if(b===2){this.address=0;this.cg=false;}else if(b&128){this.address=b&127;this.cg=false;}else if(b&64){this.address=b&63;this.cg=true;}else if((b&0xf8)===8)this.on=!!(b&4);else if((b&0xfc)===4)this.increment=!!(b&2);}
 text(){return [0,64].map(offset=>String.fromCharCode(...this.ddram.slice(offset,offset+16)));}
}
export class I2CBus{
 constructor(targets,emit=()=>{},stretchTicks=0){this.targets=targets;this.emit=emit;this.stretchTicks=stretchTicks;this.sda='Z';this.scl='Z';this.previous={scl:1,sda:1};this.phase='idle';this.stretchUntil=0;this.bits=0;}
 update(tick,masterClock,masterData){
  if(tick>=this.stretchUntil)this.scl='Z';const resolved=()=>({scl:bit(resolveDigital([masterClock,this.scl,'H'])),sda:bit(resolveDigital([masterData,this.sda,'H']))});let bus=resolved();if(bus.scl===null||bus.sda===null)throw Error('I2C bus contention; use open-drain pins and pull-ups');const prev=this.previous;
  if(prev.scl&&bus.scl&&prev.sda!==bus.sda){if(bus.sda===0){this.phase='rx';this.address=true;this.bits=0;this.value=0;this.sda='Z';this.emit({tick,protocol:'I2C',event:'START'});}else{this.target?.stop(tick);this.target=null;this.phase='idle';this.sda='Z';this.emit({tick,protocol:'I2C',event:'STOP'});}}
  else if(!prev.scl&&bus.scl){
   if(this.phase==='rx'){this.value=(this.value||0)<<1|bus.sda;if(++this.bits===8){const v=this.value;this.bits=0;this.value=0;if(this.address){this.target=this.targets.get(v>>1);this.read=!!(v&1);this.ack=!!this.target?.start(this.read,tick);this.address=false;}else this.ack=!!this.target?.write(v,tick);this.emit({tick,protocol:'I2C',event:'BYTE',value:v,ack:this.ack});this.phase='ack-setup';}}
   else if(this.phase==='ack')this.phase='ack-done';
   else if(this.phase==='tx'){if(++this.bits===8){this.emit({tick,protocol:'I2C',event:'READ',value:this.value});this.phase='tx-release';}}
   else if(this.phase==='master-ack'){this.ack=bus.sda===0;this.emit({tick,protocol:'I2C',event:this.ack?'ACK':'NACK'});this.phase='master-ack-done';}
  }else if(prev.scl&&!bus.scl){
   if(this.phase==='ack-setup'){this.sda=this.ack?'0':'Z';this.phase='ack';if(this.ack&&this.stretchTicks){this.scl='0';this.stretchUntil=tick+this.stretchTicks;this.emit({tick,protocol:'I2C',event:'STRETCH',until:this.stretchUntil});}}
   else if(this.phase==='ack-done'){this.sda='Z';if(!this.ack)this.phase='idle';else if(this.read)this.transmit();else this.phase='rx';}
   else if(this.phase==='tx')this.sda=(this.value>>(7-this.bits)&1)?'Z':'0';
   else if(this.phase==='tx-release'){this.sda='Z';this.phase='master-ack';}
   else if(this.phase==='master-ack-done'){if(this.ack)this.transmit();else{this.phase='idle';this.sda='Z';}}
  }
  this.previous=resolved();return {scl:this.scl,sda:this.sda};
 }
 transmit(){this.phase='tx';this.bits=0;this.value=this.target.read();this.sda=(this.value&128)?'Z':'0';}
}
export function validatePeripherals(p){if(p===undefined)return;if(!p||p.version!==1||typeof p.enabled!=='boolean'||![9600,115200].includes(p.baud)||!Number.isInteger(p.spiMode)||p.spiMode<0||p.spiMode>3||![0,10,100].includes(p.stretchUs)||!p.pins||Object.keys(p.pins).sort().join(',')!==Object.keys(defaultPeripherals().pins).sort().join(',')||Object.values(p.pins).some(s=>typeof s!=='string'||!/^(D(?:[0-9]|1[0-3])|A[0-5]|R[A-E][0-7])$/.test(s))||new Set(Object.values(p.pins)).size!==13)throw Error('Invalid peripheral lab settings');}
export const defaultPeripherals=()=>({version:1,enabled:false,baud:9600,spiMode:0,stretchUs:0,pins:{uart:'D1',scl:'A5',sda:'A4',cs:'D10',sck:'D13',mosi:'D11',miso:'D12',en:'D2',rs:'D3',d4:'D4',d5:'D5',d6:'D6',d7:'D7'}});
