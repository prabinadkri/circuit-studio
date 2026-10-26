// Schematic pin maps for the eight existing profiles. GPL-2.0-or-later.
export function packageDefinition(spec){
 let extra=[];
 const p=(physical,name,role)=>({physical:String(physical),name,role});
 if(spec.id==='atmega328p')extra=[p(1,'RESET','reset'),p(7,'VCC','power'),p(8,'GND','ground'),p(9,'XTAL1','clock'),p(10,'XTAL2','clock'),p(20,'AVCC','power'),p(21,'AREF','reference'),p(22,'GND2','ground')];
 else if(spec.id==='avr'||spec.id==='nano')extra=[p('5V','VCC','power'),p('GND','GND','ground'),p('RESET','RESET','reset'),p('AREF','AREF','reference')];
 else if(spec.package==='DIP-18')extra=[p(4,'MCLR','reset'),p(5,'VSS','ground'),p(14,'VDD','power'),p(15,'OSC2','clock'),p(16,'OSC1','clock')];
 else {extra=[p(1,'MCLR','reset'),p(11,'VDD','power'),p(12,'VSS','ground'),p(13,'OSC1','clock'),p(14,'OSC2','clock'),p(31,'VSS2','ground'),p(32,'VDD2','power')];if(spec.id==='pic18f4550')extra.push(p(18,'VUSB','reserved'));}
 const pins=[...spec.pins.map(pin=>p(pin.physical,pin.name,pin.analogOnly?'analog':'gpio')),...extra];if(spec.package.startsWith('DIP'))pins.sort((a,b)=>Number(a.physical)-Number(b.physical));
 return {device:spec.id,label:spec.label,clockHz:spec.clockHz,pins};
}
export function checkPackage(e,spec){
 if(JSON.stringify(e.mcu)!==JSON.stringify(packageDefinition(spec)))throw Error('MCU package does not match the selected device and fixed backend clock; place the selected profile again');
}
export function placePackage(sim,spec,x=160,y=96){
 if(sim.getDesignElements().some(e=>e.engineType==='MCUPackageElm'))throw Error('One MCU package per coupled project is supported');
 const id=sim.addElement('MCUPackageElm',x,y,x+224,y);sim.configureMCU(id,packageDefinition(spec));
 const footprint=spec.id==='atmega328p'?'DIP-28-N':spec.package.startsWith('DIP')?spec.package:null;
 sim.setMetadata(id,{reference:'MCU1',device:spec.id,clockHz:spec.clockHz,...(footprint?{footprint,padMap:packageDefinition(spec).pins.map(p=>p.physical)}:{})});sim.selectElement(id,true);return id;
}
