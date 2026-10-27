const {chromium}=require('playwright'),assert=require('node:assert/strict');
let browser;
(async()=>{
 browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome'});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto(process.env.STUDIO_URL);await page.waitForFunction(()=>window.studioSim?.getDrawingState?.());
 const canvas=page.frameLocator('#sim').locator('canvas').first();
 const state=()=>page.evaluate(()=>studioSim.getDrawingState());
 const elements=()=>page.evaluate(()=>studioSim.getDesignElements());
 const dump=()=>page.evaluate(()=>studioSim.exportCircuit(false));
 const load=async schematic=>{await page.evaluate(s=>{const p=studioProject.get();p.schematic=s;p.design={};studioProject.load(p);studioSim.command('edit','centercircuit');},schematic);await page.waitForTimeout(350);};
 const position=async(x,y)=>{const r=await canvas.boundingBox(),v=await page.evaluate(()=>studioSim.getViewport());return [r.x+v.x+x*v.scale,r.y+v.y+y*v.scale];};
 const click=async(x,y,offset=0)=>{const p=await position(x,y);await page.mouse.click(p[0]+offset,p[1]+offset);};
 const move=async(x,y)=>page.mouse.move(...await position(x,y));
 const wires=async()=>(await elements()).filter(e=>e.type==='RoutedWireElm');
 const fixture='$ 1 0.000005 10 50 5 50\nv 96 192 96 96 0 0 40 5 0 0 0.5\ng 96 192 96 224 0\nr 320 160 320 256 0 1000\ng 320 256 320 288 0\nr 208 32 208 160 0 1000\n';
 await load(fixture);const original=await dump();
 assert.equal((await state()).grid,true);
 await page.locator('#gridVisible').click();assert.equal((await state()).grid,false);assert.equal(await dump(),original);
 await page.locator('#gridVisible').click();
 await canvas.focus();await page.keyboard.press('w');assert.equal(await page.evaluate(()=>studioSim.getViewport().tool),'RoutedWireElm');await click(96,96,3);await move(320,160);
 assert.equal((await wires()).length,0,'preview is not part of the saved circuit');
 assert.equal((await state()).target.connected,true);assert.ok((await state()).preview.length>=3,'automatic bends');
 assert.deepEqual((await state()).corners,[{x:96,y:96}],'nearby click snaps exactly to pin');
 await page.waitForFunction(()=>!document.getElementById('finishWire').disabled);await page.screenshot({path:process.env.TEST_OUTPUT+'/drawing-preview.png'});
 await click(320,160,3);let route=(await wires())[0];assert.ok(route);
 assert.equal((await state()).pending,false);
 assert.deepEqual(route.route[0],{x:96,y:96});assert.deepEqual(route.route.at(-1),{x:320,y:160});
 for(let i=1;i<route.route.length;i++)assert.ok(route.route[i].x===route.route[i-1].x||route.route[i].y===route.route[i-1].y,'orthogonal routing');
 assert.ok(route.route.every((p,i,all)=>!i||!(p.y===all[i-1].y&&p.y>80&&p.y<112&&Math.min(p.x,all[i-1].x)<208&&Math.max(p.x,all[i-1].x)>208)),'route avoids resistor body');
 await page.evaluate(()=>{studioSim.setSimRunning(false);studioSim.advanceSteps(100);});
 let els=await elements(),loadRes=els.find(e=>e.type==='ResistorElm'&&e.x===320),source=els.find(e=>e.type==='VoltageElm');
 assert.equal(loadRes.pins[0].net,source.pins[1].net,'source and load are electrically connected');
 const volts=await page.evaluate(()=>studioSim.getElements().filter(e=>e.getType()==='ResistorElm').map(e=>e.getVoltageDiff()));
 assert.ok(volts.some(v=>Math.abs(Math.abs(v)-5)<1e-6),'real solver sees 5 V across connected load');
 await page.waitForTimeout(350);await page.locator('#undo').click();assert.equal((await wires()).length,0,'one undo removes whole route');
 await page.locator('#redo').click();assert.equal((await wires()).length,1);
 const saved=await dump();await page.evaluate(()=>{const p=studioProject.get();studioProject.load(studioProject.validate(p));});
 assert.equal(await dump(),saved,'bends and identities survive project reopen');
 // Moving a component body keeps its attached automatic wire connected.
 await page.locator('#select').click();await move(320,208);await page.mouse.down();await page.waitForTimeout(180);await move(352,208);await page.mouse.up();
 els=await elements();const moved=els.find(e=>e.id===loadRes.id),attached=els.find(e=>e.id===route.id);
 assert.equal(moved.x,352);assert.deepEqual(attached.route.at(-1),{x:352,y:160});assert.equal(attached.pins[1].net,moved.pins[0].net);
 await page.locator('#undo').click();assert.equal(await dump(),saved);
 // Intermediate corner remains a preview; Backspace and Escape never mutate the circuit.
 await page.locator('#drawWire').click();await click(96,96);await click(48,32);assert.equal((await state()).corners.length,2);
 await canvas.focus();await page.keyboard.press('Backspace');assert.equal((await state()).corners.length,1);
 await page.keyboard.press('Escape');assert.equal((await state()).pending,false);assert.equal(await dump(),saved);
 // Crossing is not a junction. Finishing on a wire deliberately splits it and joins the net.
 await load('$ 1 0.000005 10 50 5 50\ng 480 288 480 320 0\nw 96 160 384 160 0\nr 192 32 192 96 0 1000\n');
 await page.locator('#drawWire').click();await move(192,96);await page.mouse.down();await move(192,224);await page.mouse.up();
 els=await elements();const crossing=els.find(e=>e.type==='RoutedWireElm'),horizontal=els.find(e=>e.type==='WireElm');
 assert.ok(crossing.route.some((p,i,a)=>i&&p.x===192&&a[i-1].x===192&&Math.min(p.y,a[i-1].y)<160&&Math.max(p.y,a[i-1].y)>160));
 assert.notEqual(crossing.pins[0].net,horizontal.pins[0].net,'crossing wires stay electrically separate');
 await click(192,32);await click(320,160);
 els=await elements();const branch=els.filter(e=>e.type==='RoutedWireElm').at(-1),split=els.filter(e=>e.type==='WireElm');
 assert.equal(split.length,2,'intentional branch splits the existing wire');
 assert.ok(split.every(e=>e.pins[0].net===branch.pins[1].net),'branch joins both halves');
 // Fine-pitch imported pins remain exact even on the standard grid.
 await load('$ 1 0.000005 10 50 5 50\nr 104 96 168 96 0 1000\nr 320 160 384 160 0 1000\n');
 await page.locator('#drawWire').click();await click(168,96,2);await click(320,160,2);
 assert.deepEqual((await wires())[0].route[0],{x:168,y:96});
 // Panning while routing leaves the pending corners and existing schematic intact.
 await click(104,96);await move(64,224);const pending=(await state()).corners,beforePan=await dump(),panStart=await position(64,224);
 await page.keyboard.down('Space');await page.mouse.down();await page.mouse.move(panStart[0]+35,panStart[1]+20,{steps:3});await page.mouse.up();await page.keyboard.up('Space');
 assert.deepEqual((await state()).corners,pending);assert.equal(await dump(),beforePan);
 await move(64,224);await page.locator('#finishWire').click();assert.equal((await wires()).length,2,'toolbar finishes the preview after leaving the canvas');
 await click(104,96);await move(64,32);await page.mouse.click(...await position(64,32),{button:'right'});assert.equal((await state()).pending,false);
 await click(104,96);await click(64,64);await move(32,32);await canvas.focus();await page.keyboard.press('Enter');
 const guided=(await wires()).at(-1);assert.ok(guided.route.some(p=>p.x===64&&p.y===64),'manual corner is retained');assert.deepEqual(guided.route.at(-1),{x:32,y:32});
 await click(104,96);await move(32,256);const completed=(await wires()).length;
 await page.evaluate(()=>studioSim.addElement('ResistorElm',512,64,576,64));
 await page.waitForFunction(()=>!studioSim.getDrawingState().pending);
 assert.equal((await wires()).length,completed,'another editing command cancels stale preview without adding a wire');
 // Drag and straight-wire fallback remain usable.
 await load('$ 1 0.000005 10 50 5 50\nr 96 96 160 96 0 1000\nr 320 160 384 160 0 1000\n');
 await page.locator('#drawWire').click();await move(160,96);await page.mouse.down();await move(320,160);await page.mouse.up();assert.equal((await wires()).length,1);
 await page.locator('#wireStyle').selectOption('straight');await move(96,96);await page.mouse.down();await move(96,224);await page.mouse.up();assert.ok((await elements()).some(e=>e.type==='WireElm'));
 // Fine grid affects new placement, not existing geometry. Grid visibility persists.
 const geometry=(await elements()).map(e=>[e.id,e.x,e.y,e.x2,e.y2]);await page.locator('#gridSpacing').selectOption('8');assert.equal((await state()).spacing,8);
 assert.deepEqual((await elements()).map(e=>[e.id,e.x,e.y,e.x2,e.y2]),geometry);
 await page.locator('#gridVisible').click();await page.reload();await page.waitForFunction(()=>window.studioSim?.getDrawingState?.());assert.equal((await state()).grid,false);
 for(const width of [1440,1024,700,390]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'drawing toolbar stays within viewport');}
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS grid, exact pin snap, automatic obstacle bends, electrical connectivity, preview/cancel, undo/reopen and drag fallback');
})().catch(async e=>{console.error(e);await browser?.close();process.exitCode=1;});
