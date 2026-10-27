const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises');let browser;
(async()=>{
 browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome'});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.goto(process.env.STUDIO_URL);await page.waitForFunction(()=>window.studioSim?.getScopeSignals);
 const shape=()=>page.evaluate(()=>studioSim.getDesignElements().map(e=>({id:e.id,type:e.type,x:e.x,y:e.y,x2:e.x2,y2:e.y2,pins:e.pins})));
 const before=await shape(),count=await page.evaluate(()=>studioSim.getScopes().length);
 await page.locator('#openScope').click();await page.locator('#scopeSearch').fill('resistor');assert.ok(await page.locator('#scopeSignal option').count());
 const id=await page.locator('#scopeSignal').inputValue();await page.locator('#addScope').click();await page.waitForFunction(n=>studioSim.getScopes().length===n+1,count);
 assert.deepEqual(await shape(),before);assert.equal(await page.locator('#scopeTools').isVisible(),true);
 await page.evaluate(id=>studioSim.showScope(id),id);assert.equal(await page.evaluate(()=>studioSim.getScopes().length),count+1,'same signal reuses scope');
 const speed=await page.evaluate(()=>studioSim.getScopes().at(-1).speed);await page.locator('[data-scope-action="speed2"]').click();assert.ok((await page.evaluate(()=>studioSim.getScopes().at(-1).speed))<speed);
 await page.locator('#scopeRun').click();await page.waitForFunction(()=>studioSim.getTime()>0);await page.locator('#scopeRun').click();await page.waitForFunction(()=>!studioSim.isRunning());
 const downloaded=page.waitForEvent('download');await page.locator('[data-scope-action=exportcsv]').click();const csv=await fs.readFile(await (await downloaded).path(),'utf8');assert.match(csv,/Resistor V min/);
 await page.locator('[data-scope-action=properties]').click();assert.ok(await page.frameLocator('#sim').locator('dialog[open]').count());
 await page.frameLocator('#sim').getByRole('button',{name:/OK|Close/}).first().click();
 await page.screenshot({path:process.env.TEST_OUTPUT+'/schematic-scope.png'});
 await page.locator('[data-scope-action=remove]').click();await page.waitForFunction(n=>studioSim.getScopes().length===n,count);assert.deepEqual(await shape(),before);
 await page.locator('#openInstruments').click();await page.waitForFunction(()=>!document.getElementById('captureEmpty').hidden);
 assert.equal(await page.locator('#exportTrace').isDisabled(),true);await page.locator('#instrumentRun').click();assert.match(await page.locator('#captureError').textContent(),/Shared timeline/);
 await page.locator('#instrumentScope').click();assert.equal(await page.locator('#scopeDialog').evaluate(e=>e.open),true);await page.locator('#scopeDialog').getByRole('button',{name:'Cancel'}).click();
 for(const width of [1440,900,390]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:process.env.TEST_OUTPUT+'/instrument-empty.png'});
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS direct scope discovery, deduplicated signals, controls/properties, stable geometry, guided empty capture and responsive instruments');
})().catch(async e=>{console.error(e);await browser?.close();process.exitCode=1});
