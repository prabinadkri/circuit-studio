const {chromium}=require('playwright'),assert=require('node:assert/strict');
let browser;
(async()=>{
 browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome'});
 const page=await browser.newPage({viewport:{width:1440,height:940}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto(process.env.STUDIO_URL);await page.waitForFunction(()=>window.studioSim?.getViewport);
 const canvas=page.frameLocator('#sim').locator('canvas').first();
 const view=()=>page.evaluate(()=>studioSim.getViewport());
 const geometry=()=>page.evaluate(()=>studioSim.exportCircuit(false));
 let original=await geometry();
 async function drag(surface,button='left',space=false){const r=await surface.boundingBox();const x=r.x+r.width*.6,y=r.y+r.height*.6;await page.mouse.move(x,y);if(space)await page.keyboard.down('Space');await page.mouse.down({button});await page.mouse.move(x+65,y+38,{steps:6});await page.mouse.up({button});if(space)await page.keyboard.up('Space');}
 // Explicit hand drag changes view, never the netlist/coordinates/history.
 await page.locator('#schematicView [data-view=pan]').click();let before=await view();
 await drag(canvas);let after=await view();assert.ok(Math.abs(after.x-before.x-65)<2);assert.ok(Math.abs(after.y-before.y-38)<2);assert.equal(await geometry(),original);
 assert.equal(await canvas.evaluate(c=>getComputedStyle(c).cursor),'grab');
 // Pointer capture ends the pan even when the release is outside the iframe.
 const edge=await canvas.boundingBox();await page.mouse.move(edge.x+100,edge.y+120);await page.mouse.down();await page.mouse.move(80,30,{steps:4});await page.mouse.up();const released=await view();await page.mouse.move(edge.x+130,edge.y+140);assert.equal((await view()).x,released.x);assert.equal(await canvas.evaluate(c=>getComputedStyle(c).cursor),'grab');await page.locator('#fit').click();
 await page.locator('#select').click();assert.equal(await page.locator('#schematicView [data-view=pan]').getAttribute('aria-pressed'),'false');
 // Temporary gestures must preserve the currently selected placement tool.
 await page.locator('#search').fill('op amp');await page.locator('#parts [data-part=OpAmpElm]').click();
 before=await view();await drag(canvas,'middle');after=await view();assert.ok(after.x>before.x+60);assert.equal(after.tool,'OpAmpElm');assert.equal(await geometry(),original);
 await canvas.focus();before=await view();await drag(canvas,'left',true);after=await view();assert.ok(after.x>before.x+60);assert.equal(after.tool,'OpAmpElm');assert.equal(await geometry(),original);
 // Release Space, then placing a part still works.
 const c=await canvas.boundingBox();await page.mouse.click(c.x+70,c.y+80);assert.equal(await page.evaluate(()=>studioSim.getDesignElements().filter(e=>e.type==='OpAmpElm').length),1);
 await page.locator('#undo').click();assert.equal(await geometry(),original);
 // Keyboard navigation and zoom; input typing remains untouched.
 await page.locator('#select').click();await canvas.focus();before=await view();await page.keyboard.press('Shift+ArrowRight');assert.ok((await view()).x<before.x-70);assert.equal(await geometry(),original);
 await page.locator('#schematicView [data-view=out]').click();assert.ok((await view()).scale<before.scale);
 await page.locator('#fit').click();before=await view();await canvas.focus();await page.keyboard.press('h');assert.equal(await page.locator('#schematicView [data-view=pan]').getAttribute('aria-pressed'),'true');await page.keyboard.press('Escape');assert.equal(await page.locator('#schematicView [data-view=pan]').getAttribute('aria-pressed'),'false');
 await page.locator('#search').fill('');await page.locator('#search').pressSequentially('h f v');assert.equal(await page.locator('#search').inputValue(),'h f v');
 await page.locator('#schematicView summary').click();before=await view();await page.locator('#schematicView [data-view=left]').click();assert.ok((await view()).x>before.x+70);await page.locator('#schematicView summary').click();
 // Panels restore and provide more canvas area without losing access to their tools.
 const width=(await canvas.boundingBox()).width;await page.locator('#toggleLibrary').click();await page.locator('#toggleInspector').click();await page.waitForFunction(w=>document.querySelector('#sim').contentDocument.querySelector('canvas').getBoundingClientRect().width>w+300,width);await page.locator('#toggleLibrary').click();await page.locator('#toggleInspector').click();assert.equal(await page.locator('#libraryPanel').isVisible(),true);assert.equal(await page.locator('#inspectorPanel').isVisible(),true);
 // Board panning has no geometry/undo effect, including while a route is pending.
 await page.locator('nav [data-page=pcb]').click();await page.locator('#syncBoard').click();
 const board=page.locator('#board'),boardData=()=>page.evaluate(()=>JSON.stringify(studioBoard.serialize()));
 original=await boardData();await page.locator('#boardView [data-view=pan]').click();before=await board.getAttribute('viewBox');await drag(board);assert.notEqual(await board.getAttribute('viewBox'),before);assert.equal(await boardData(),original);
 await page.locator('#boardRoute').click();const pad=page.locator('#board [data-pad]').first();await pad.click();const pending=await page.evaluate(()=>structuredClone(studioBoard.pending));assert.ok(pending);
 await drag(board,'middle');assert.deepEqual(await page.evaluate(()=>studioBoard.pending),pending);assert.equal(await boardData(),original);
 await board.focus();await drag(board,'left',true);assert.deepEqual(await page.evaluate(()=>studioBoard.pending),pending);assert.equal(await boardData(),original);
 await page.locator('#boardView [data-view=in]').click();assert.notEqual(await board.getAttribute('viewBox'),'0 0 120 80');assert.deepEqual(await page.evaluate(()=>studioBoard.pending),pending);
 await page.locator('#boardFit').click();assert.equal(await board.getAttribute('viewBox'),'0 0 120 80');
 // Cursor-anchored board zoom retains the point under the pointer.
 const pos=await board.boundingBox(),cursor=[Math.round(pos.x+pos.width*.3),Math.round(pos.y+pos.height*.3)];await page.mouse.move(...cursor);const point=()=>board.evaluate((svg,p)=>{const q=new DOMPoint(...p).matrixTransform(svg.getScreenCTM().inverse());return {x:q.x,y:q.y};},cursor);const a=await point();await page.mouse.wheel(0,-160);await page.waitForFunction(()=>document.querySelector('#board').viewBox.baseVal.width<120);const z=await point();assert.ok(Math.abs(a.x-z.x)<.001&&Math.abs(a.y-z.y)<.001);assert.equal(await boardData(),original);
 await board.focus();await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>studioBoard.pending),null);
 await page.locator('#boardFit').click();await page.screenshot({path:process.env.TEST_OUTPUT+'/navigation-pcb.png'});
 await page.locator('nav [data-page=schematic]').click();await page.locator('#search').fill('');await page.locator('#fit').click();await page.screenshot({path:process.env.TEST_OUTPUT+'/navigation-schematic.png'});
 // Panning is navigation, so it must not detach a running shared MCU timeline.
 await page.evaluate(async()=>studioProject.load(studioProject.validate(await(await fetch('./demos/powered-atmega328p.circuit')).json())));
 await page.locator('nav [data-page=firmware]').click();await page.locator('#mcuRun').click();await page.waitForFunction(()=>studioClock.running&&studioClock.tick>0);
 await page.locator('nav [data-page=schematic]').click();await page.locator('#schematicView [data-view=pan]').click();const tick=await page.evaluate(()=>studioClock.tick);await drag(canvas);assert.equal(await page.evaluate(()=>studioClock.running),true);assert.ok(await page.evaluate(t=>studioClock.tick>t,tick));await page.evaluate(()=>studioClock.stop());
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS hand/Space/middle pan, immutable schematic and PCB, placement/undo, pending routes, keyboard/forms, panel toggles, anchored zoom and live MCU timeline');
})().catch(async e=>{console.error(e);await browser?.close();process.exitCode=1;});
