const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
let browser;
(async()=>{
 browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1366,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto(process.env.STUDIO_URL);await page.waitForFunction(()=>window.studioSim);
 const parts=await page.locator('#parts button').evaluateAll(bs=>bs.map(b=>({type:b.dataset.part,label:b.textContent})));
 assert.equal(parts.length,19);
 const counts=()=>page.evaluate(()=>studioSim.getElements().length);
 const clear=()=>page.evaluate(()=>{studioSim.importCircuit('$ 1 0.000005 10 50 5 50\n',false);studioSim.setSimRunning(false);});
 const canvas=page.frames()[1].locator('canvas').first();
 const point=async()=>{const r=await canvas.boundingBox();return {x:r.x+r.width*.35,y:r.y+r.height*.35};};
 for(const part of parts){
  for(const gesture of ['click','drag']){
   await clear();await page.locator(`[data-part="${part.type}"]`).click();
   const p=await point();await page.mouse.move(p.x,p.y);await page.mouse.down();
   if(gesture==='drag')await page.mouse.move(p.x+100,p.y+60,{steps:8});
   await page.mouse.up();
   const expected=part.type==='WireElm'&&gesture==='click'?0:1;
   assert.equal(await counts(),expected,`${part.label}: ${gesture}`);
   if(!expected)continue;
   const types=await page.evaluate(()=>studioSim.getElements().map(e=>e.getType()));
   assert.deepEqual(types,[part.type]);
   await page.locator('#undo').click();assert.equal(await counts(),0,`${part.label}: one undo`);
   await page.locator('#redo').click();assert.equal(await counts(),1,`${part.label}: one redo`);
   const circuit=await page.evaluate(()=>studioSim.exportCircuit());
   await page.evaluate(s=>studioSim.importCircuit(s,false),circuit);
   assert.deepEqual(await page.evaluate(()=>studioSim.getElements().map(e=>e.getType())),[{DCVoltageElm:'VoltageElm',NTransistorElm:'TransistorElm'}[part.type]||part.type],`${part.label}: serialization`);
  }
 }
 console.log('PASS all 19 palette tools: click/drag, single undo/redo and serialization (wires require a drag)');
 await clear();
 for(const query of ['op amp','opamp','Op-Amp']){
  await page.locator('#search').fill(query);assert.equal(await page.locator('#parts button').count(),1);
 }
 await page.locator('[data-part="OpAmpElm"]').click();
 assert.equal(await page.locator('[data-part="OpAmpElm"]').getAttribute('aria-pressed'),'true');
 let p=await point();await page.mouse.click(p.x,p.y);await page.mouse.click(p.x+160,p.y+100);
 assert.equal(await counts(),2,'repeat op-amp placement');
 await page.locator('#search').fill('no-such-part');assert.match(await page.locator('#parts').textContent(),/No matching/);
 await page.locator('#search').fill('');
 await page.locator('#select').click();assert.equal(await page.locator('#parts [aria-pressed="true"]').count(),0);
 const dlPromise=page.waitForEvent('download');await page.locator('#save').click();
 const download=await dlPromise,file=await download.path();
 const saved=JSON.parse(await fs.readFile(file,'utf8'));assert.equal(saved.schematic,await page.evaluate(()=>studioSim.exportCircuit()));
 await page.locator('#new').click();await page.locator('#file').setInputFiles(file);
 await page.waitForFunction(()=>studioSim.getElements().length===2);
 assert.deepEqual(await page.evaluate(()=>studioSim.getElements().map(e=>e.getType())),['OpAmpElm','OpAmpElm']);
 console.log('PASS filtered palette, repeated op-amp placement, selection state and project save/reopen');
 // A cancelled, zero-size gesture must not fabricate a component when leaving the canvas.
 await clear();await page.locator('[data-part="OpAmpElm"]').click();p=await point();
 await page.mouse.move(p.x,p.y);await page.mouse.down();
 await page.mouse.move(10,10);await page.mouse.up();
 assert.equal(await counts(),0,'leaving canvas cancels a zero-size placement');
 // Default geometry must remain valid after zooming, and normal selection must not add parts.
 await page.mouse.move(p.x,p.y);await page.mouse.wheel(0,-300);await page.waitForTimeout(100);
 await page.mouse.click(p.x,p.y);assert.equal(await counts(),1,'click after zoom');
 await page.locator('#select').click();await page.mouse.click(p.x+160,p.y+100);assert.equal(await counts(),1);
 await page.waitForFunction(()=>document.querySelector('#count').textContent==='1');
 await page.screenshot({path:process.env.TEST_OUTPUT+'/opamp-placement.png'});
 assert.deepEqual(errors,[]);await browser.close();
 console.log('PASS cancellation, zoomed placement, select mode and no browser errors');
})().catch(async e=>{console.error(e);await browser?.close();process.exitCode=1;});
