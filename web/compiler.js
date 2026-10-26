// Single-file AVR C editor and source debugger. GPL-2.0-or-later.
const $=id=>document.getElementById(id);
const SAMPLE='#include <avr/io.h>\nvolatile unsigned char count = 0;\nint main(void) {\n    DDRB = 32;\n    while (1) {\n        count++;\n        PORTB ^= 32;\n    }\n}\n';
export class CompilerPanel {
 constructor(getMCU,clock,changed,status,getContext){Object.assign(this,{getMCU,clock,changed,status,getContext});$('cSource').value=SAMPLE;
  $('buildFirmware').onclick=()=>this.build();$('cSource').oninput=()=>{this.invalidate();changed();};$('breakLine').onchange=()=>{this.configureBreakpoints();changed();};
  setInterval(()=>{if(this.debug)this.render();},200);
 }
 invalidate(){this.clock.stop();const mcu=this.getMCU();if(mcu)mcu.debug=null;this.debug=null;$('debugState').textContent='Build to enable source debugging';$('variables').replaceChildren();}
 serialize(){return {source:$('cSource').value,breakLine:Number($('breakLine').value)||0};}
 load(value){this.invalidate();$('cSource').value=value?.source??SAMPLE;$('breakLine').value=value?.breakLine||0;}
 selectLine(line){const editor=$('cSource'),lines=editor.value.split('\n'),start=lines.slice(0,line-1).reduce((n,s)=>n+s.length+1,0);editor.focus();editor.setSelectionRange(start,start+(lines[line-1]?.length||0));editor.scrollTop=Math.max(0,(line-5)*20);}
 configureBreakpoints(){const mcu=this.getMCU();if(!this.debug||mcu!==this.owner||mcu.source!==this.hex)return;const line=Number($('breakLine').value),pcs=Object.entries(this.debug.lines).filter(([pc,n])=>n===line).map(([pc])=>Number(pc));mcu.debug={breakpoints:new Set(pcs.length?[Math.min(...pcs)]:[]),paused:false,skip:null};if(line&&!pcs.length)this.status('No instruction for that source line; choose an executable line');}
 async build(){
  const source=$('cSource').value,mcu=this.getMCU(),device=mcu.spec.id,context=this.getContext(),previousHex=$('hex').value;this.clock.stop();await this.clock.idle();$('buildFirmware').disabled=true;
  try{
   const session=await(await fetch('/api/session')).json();const res=await fetch('/api/compiler',{method:'POST',headers:{'Content-Type':'application/json','X-Studio-Token':session.token},body:JSON.stringify({action:'build',device,source})}),result=await res.json();if(!res.ok)throw Error(result.error||'Build failed');
   if(context!==this.getContext()||previousHex!==$('hex').value||source!==$('cSource').value||mcu!==this.getMCU()||device!==mcu.spec.id)throw Error('Source or device changed during build; build the current editor again');
   $('compilerLog').replaceChildren();for(const diagnostic of result.diagnostics){const b=document.createElement('button');b.textContent=`Line ${diagnostic.line}: ${diagnostic.severity}: ${diagnostic.message}`;b.onclick=()=>this.selectLine(diagnostic.line);$('compilerLog').append(b);}
   if(!result.ok){this.invalidate();if(!result.diagnostics.length)$('compilerLog').textContent=result.log;this.status('Build failed · select a diagnostic to go to its line');return;}
   await mcu.load(result.hex);$('hex').value=result.hex;$('timingMode').value='coupled';this.debug=result.debug;this.owner=mcu;this.hex=result.hex;this.configureBreakpoints();this.changed();this.status('AVR C built and attached · source debugging uses Shared timeline');this.render();
  }catch(e){this.status(e.message);}finally{$('buildFirmware').disabled=false;}
 }
 render(){
  const mcu=this.getMCU();if(mcu!==this.owner||mcu.source!==this.hex){this.invalidate();return;}
  const line=this.debug.lines[String(mcu.cpu.pc)],paused=mcu.debug?.paused;$('debugState').textContent=(paused?'Breakpoint paused · ':'')+(line?'main.c:'+line:'startup/library code')+' · word PC 0x'+mcu.cpu.pc.toString(16);
  if(paused&&this.lastPause!==mcu.cpu.cycles){this.lastPause=mcu.cpu.cycles;this.selectLine(line);}
  $('variables').replaceChildren();for(const v of this.debug.variables){const bytes=Array.from(mcu.cpu.data.slice(v.address,v.address+v.size));let value=bytes.length<=4?bytes.reduceRight((n,b)=>n*256+b,0).toString():bytes.map(b=>b.toString(16).padStart(2,'0')).join(' ');const row=document.createElement('div');row.className='reading';row.textContent=v.name+' = '+value+' · 0x'+v.address.toString(16)+' · '+v.size+' byte(s)';$('variables').append(row);}
 }
}
