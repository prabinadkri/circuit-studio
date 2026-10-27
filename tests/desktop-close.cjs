// Run with STUDIO_ELECTRON=/path/to/electron node tests/run.cjs desktop-close.cjs.
// Real window/renderer lifecycle; only the native dialog response is automated.
const {_electron}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
let app,profile;
(async()=>{
 assert.ok(process.env.STUDIO_ELECTRON,'Set STUDIO_ELECTRON to the bundled Electron executable');
 profile=await fs.mkdtemp(path.join(os.tmpdir(),'studio-close-test-'));
 const env={...process.env,STUDIO_PROFILE:profile,STUDIO_HEADLESS:'1'};delete env.ELECTRON_RUN_AS_NODE;
 const launch=async()=>{
  app=await _electron.launch({executablePath:process.env.STUDIO_ELECTRON,args:[path.resolve(__dirname,'../runtime/desktop.cjs')],env});
  const page=await app.firstWindow();await page.waitForFunction(()=>window.studioSim?.getViewport);
  await app.evaluate(({dialog})=>{global.closePrompts=[];global.closeChoice=0;dialog.showMessageBoxSync=(_owner,options)=>{global.closePrompts.push(options);return global.closeChoice;};});
  return page;
 };
 const close=()=>app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());
 let page=await launch();
 await page.locator('#projectName').fill('Unsaved close regression');
 const circuit=await page.evaluate(()=>studioSim.exportCircuit(false));
 await close();await page.waitForTimeout(300);
 assert.equal(page.isClosed(),false);
 assert.equal(await page.locator('#projectName').inputValue(),'Unsaved close regression');
 assert.equal(await page.evaluate(()=>studioSim.exportCircuit(false)),circuit);
 assert.equal(await app.evaluate(()=>global.closePrompts.length),1);
 const options=await app.evaluate(()=>global.closePrompts[0]);
 assert.equal(options.defaultId,0);assert.equal(options.cancelId,0);
 assert.ok(await page.evaluate(()=>Object.values(localStorage).some(v=>v.includes('Unsaved close regression'))),'beforeunload writes recovery');
 await app.evaluate(()=>{global.closeChoice=1;});
 let exited=app.waitForEvent('close');await close();await exited;app=null;
 page=await launch();
 assert.ok(await page.evaluate(()=>Object.values(localStorage).some(v=>v.includes('Unsaved close regression'))),'recovery persists after reopening');
 await page.locator('#projectName').fill('Saved close regression');
 await page.locator('#saveLocal').click();await page.waitForFunction(()=>document.getElementById('saveState').textContent==='Saved on disk');
 // A saved document must close without prompting (the default response would veto it).
 exited=app.waitForEvent('close');await close();await exited;app=null;
 console.log('PASS real Electron unsaved close/cancel, explicit close, recovery across restart, and saved close');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{
 if(app){await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(w=>w.destroy())).catch(()=>{});await app.close().catch(()=>{});}
 if(profile)await fs.rm(profile,{recursive:true,force:true});
});
