const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
let browser;
(async()=>{
 browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome'});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto(process.env.STUDIO_URL);await page.waitForFunction(()=>window.studioSim);
 await page.locator('[data-page="firmware"]').click();
 assert.equal(await page.locator('#device option').count(),8);
 const specs=await page.evaluate(()=>fetch('devices.json').then(r=>r.json()));
 const savedHex={};
 const waitReady=()=>page.waitForFunction(()=>!document.querySelector('#mcuRun').disabled);
 const reg=async name=>parseInt(await page.locator('#registers span').filter({hasText:new RegExp('^'+name+' ')}).locator('b').textContent(),16);
 const waitPin=async(name,level)=>page.waitForFunction(({name,level})=>document.querySelector(`[data-pin="${name}"]`).textContent.includes(level),{name,level});
 for(const spec of specs){
  await page.locator('#device').selectOption(spec.id);
  await page.locator('#experiment').selectOption('button');
  await page.locator('#blink').click();await waitReady();
  savedHex[spec.id]=await page.locator('#hex').inputValue();
  const input=spec.engine==='avr'?'D2':'RB1';
  await page.locator(`[data-pin="${input}"]`).click();
  await page.locator('#mcuRun').click();await waitReady();await waitPin(spec.demoPin,'HIGH');
  await page.locator(`[data-pin="${input}"]`).click();await waitPin(spec.demoPin,'LOW');
  await page.locator('#mcuRun').click();await waitReady();
  assert.equal(await page.locator('#pinReference tr').count(),spec.pins.length);
  const expectedADC=spec.pins.filter(p=>'analog' in p).length;
  assert.equal(await page.locator('#analogInputs input').count(),expectedADC);
  if(expectedADC){
   await page.locator('#experiment').selectOption('adc');await page.locator('#blink').click();await waitReady();
   const analog=spec.engine==='avr'?'A0':'RA0';
   await page.locator(`[data-analog="${analog}"]`).fill('2.5');
   await page.locator('#mcuRun').click();await waitReady();
   const hi=spec.engine==='avr'?'ADCH':'ADRESH',lo=spec.engine==='avr'?'ADCL':'ADRESL';
   await page.waitForFunction(({hi,lo})=>{
    const values=Object.fromEntries([...document.querySelectorAll('#registers span')].map(el=>[el.firstChild.textContent.trim(),parseInt(el.querySelector('b').textContent,16)]));
    return values[hi]*256+values[lo]>=510;
   },{hi,lo});
   await page.locator('#mcuRun').click();await waitReady();
   const adc=(await reg(hi))*256+(await reg(lo));assert.ok(adc>=510&&adc<=513,`${spec.id}: ADC ${adc}`);
   savedHex[spec.id]=await page.locator('#hex').inputValue();
  }else assert.ok(await page.locator('#experiment option[value="adc"]').isDisabled());
  console.log('PASS '+spec.label+' input/output, pin reference'+(expectedADC?', ADC midpoint':''));
 }
 // Nano ADC6/ADC7 exist without output drivers.
 await page.locator('#device').selectOption('nano');
 assert.equal(await page.locator('[data-pin="A7"]').count(),0);
 await page.locator('#hexFile').setInputFiles('examples/lab/nano-adc7.hex');await waitReady();
 await page.locator('[data-analog="A7"]').fill('5');
 await page.locator('#mcuRun').click();await waitReady();
 await page.waitForFunction(()=>[...document.querySelectorAll('#registers span')].some(e=>e.textContent==='ADCH 0x03'));
 await page.locator('#mcuRun').click();await waitReady();assert.equal((await reg('ADCH'))*256+await reg('ADCL'),1023);
 savedHex.nano=await page.locator('#hex').inputValue();
 console.log('PASS classic Nano analog-only A7 converts to full-scale without a digital pin');
 // Browser and native bridge must agree on a live schematic voltage.
 await page.locator('#device').selectOption('pic16f877a');
 await page.locator('#experiment').selectOption('adc');await page.locator('#blink').click();await waitReady();
 await page.evaluate(()=>{studioSim.importCircuit('$ 1 0.000005 10 50 5 50\nR 160 160 160 96 0 0 40 1.25 0 0 0.5\n207 160 160 208 160 0 IN_RA0\n',false);studioSim.setSimRunning(true);});
 await page.locator('[data-analog="RA0"]').fill('5');
 await page.locator('#mcuRun').click();await waitReady();
 await page.waitForFunction(()=>[...document.querySelectorAll('#registers span')].some(e=>e.textContent==='ADRESL 0xFF'));
 await page.locator('#mcuRun').click();await waitReady();
 assert.equal((await reg('ADRESH'))*256+await reg('ADRESL'),255);
 console.log('PASS schematic IN_RA0 voltage overrides the manual analog slider');
 assert.ok(await page.locator('[data-analog="RA0"]').isDisabled());
 await page.locator('#firmware .mcu-layout').evaluate(el=>el.scrollTop=0);
 await page.screenshot({path:process.env.TEST_OUTPUT+'/lab-devices.png'});
 const promise=page.waitForEvent('download');await page.locator('[data-page="schematic"]').click();await page.locator('#save').click();
 const download=await promise,filename=await download.path();const project=JSON.parse(await fs.readFile(filename,'utf8'));
 assert.equal(Object.keys(project.firmwareByDevice).length,8);
 await page.locator('#new').click();await page.locator('#file').setInputFiles(filename);await page.waitForTimeout(200);
 await page.locator('[data-page="firmware"]').click();
 for(const spec of specs){await page.locator('#device').selectOption(spec.id);assert.equal(await page.locator('#hex').inputValue(),savedHex[spec.id]);}
 console.log('PASS eight firmware payloads and selected target survive a project round trip');
 // The ATmega328P has 2 KiB SRAM and resets the stack at RAMEND.
 const memory=await page.evaluate(async()=>{const {MCU,demoHex}=await import('./mcu.js');const spec=(await fetch('devices.json').then(r=>r.json()))[0];const cpu=new MCU(()=>null,()=>{},spec);cpu.load(demoHex);return {sram:cpu.cpu.sramBytes,sp:cpu.cpu.SP};});
 assert.deepEqual(memory,{sram:2048,sp:0x8ff});
 // Assembler-built AVR demo matches the built-in instruction image.
 const identical=await page.evaluate(async()=>{const {parseHex,demoHex}=await import('./mcu.js');const compiled=await fetch('demos/atmega328p-blink.hex').then(r=>r.text());return parseHex(compiled).every((word,i)=>word===parseHex(demoHex)[i]);});
 assert.equal(identical,true);assert.deepEqual(errors,[]);
 console.log('PASS assembler-built AVR example matches built-in demo; no browser errors');
 await browser.close();
})().catch(async error=>{console.error(error);await browser?.close();process.exitCode=1;});
