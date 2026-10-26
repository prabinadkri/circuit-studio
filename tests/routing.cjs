const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises');let browser;
(async()=>{
 browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(process.env.STUDIO_URL);await page.waitForFunction(()=>window.studioSim);
 const result=await page.evaluate(async()=>{
  const b=studioBoard,{manufacturingFiles}=await import('./manufacture.js'),{gltf,stl,mechanicalManifest}=await import('./board3d.js');
  const part=(ref,x,y,rotation,side,nets)=>({ref,x,y,rotation,side,nets,footprint:'R-0805',type:'ResistorElm',value:'10k'});
  b.load({parts:[part('R1',19.05,30,0,'F.Cu',['one','signal']),part('R2',80.95,30,0,'F.Cu',['signal','two']),part('R3',50,19.05,90,'F.Cu',['three','signal']),part('R4',50,50.95,90,'F.Cu',['signal','four'])],tracks:[{from:'R1:2',to:'R2:1',layer:'F.Cu',bends:[]},{from:'R3:2',to:'R4:1',layer:'F.Cu',bends:[]}]});
  const same={air:b.airwires().length,issues:b.issues()};
  b.tracks[1].layer='B.Cu';const wrongLayer=b.issues();b.parts[2].side=b.parts[3].side='B.Cu';b.parts[2].rotation=b.parts[3].rotation=270;const isolated=b.airwires().length;
  b.vias=[{id:'via:crossing',x:50,y:30,net:'signal',diameter:.8,drill:.4}];const joined={air:b.airwires().length,issues:b.issues()};
  const exportVias=manufacturingFiles(b);b.snapshot();b.vias=[];b.undo();const undoVias=b.vias.length;
  // A solid front pour connects same-net pads while carving out the other-net pad/track copper.
  b.zones=[{id:'zone:front',net:'signal',layer:'F.Cu',points:[{x:12,y:12},{x:108,y:12},{x:108,y:68},{x:12,y:68}]}];
  b.constructor.validate(b.serialize());const fill=b.copper().fills.map(f=>({outer:f.outer,holes:f.holes}));const files=manufacturingFiles(b),model=await gltf(b),mesh=stl(b,{components:false}),manifest=mechanicalManifest(b),saved=b.serialize();
  // Opposite-net track crossing and copper proximity must block both exports.
  b.parts[2].nets=['three','other'];b.parts[3].nets=['other','four'];b.parts[2].side=b.parts[3].side='F.Cu';b.parts[2].rotation=b.parts[3].rotation=90;b.tracks[1].layer='F.Cu';let blockedKiCad=false,blockedGerber=false;try{b.toKiCad();}catch{blockedKiCad=true;}try{manufacturingFiles(b);}catch{blockedGerber=true;}
  b.load(saved);return {same,wrongLayer,isolated,joined,undoVias,exportVias,fill,files,model,mesh,manifest,blockedKiCad,blockedGerber};
 });
 assert.deepEqual(result.same,{air:0,issues:[]});assert.ok(result.wrongLayer.some(s=>s.includes('does not reach pad layer')));assert.equal(result.isolated,1);assert.deepEqual(result.joined,{air:0,issues:[]});assert.equal(result.undoVias,1);assert.ok(result.fill.some(f=>f.holes.length>=2));assert.equal(result.blockedKiCad,true);assert.equal(result.blockedGerber,true);assert.match(result.files['board-F.Cu.gtl'],/G36\*/);assert.match(result.files['board.kicad_pcb'],/\(via /);assert.match(result.files['board.kicad_pcb'],/\(filled_polygon /);assert.equal((result.files['board-PTH.drl'].match(/^X/gm)||[]).length,1);
 const out=process.env.TEST_OUTPUT+'/routing';await fs.mkdir(out,{recursive:true});for(const [name,data]of Object.entries(result.files))await fs.writeFile(out+'/'+name,data);await fs.writeFile(out+'/board.gltf',JSON.stringify(result.model));await fs.writeFile(out+'/board.stl',result.mesh);await fs.writeFile(out+'/mechanical.json',JSON.stringify(result.manifest,null,2));await fs.writeFile(out+'/expected-fill.json',JSON.stringify(result.fill));
 await page.locator('[data-page="pcb"]').click();await page.screenshot({path:out+'/pcb.png'});await page.locator('[data-page="mechanical"]').click();await page.waitForSelector('#board3d canvas');await page.locator('#top3d').click();await page.screenshot({path:out+'/board3d.png'});assert.deepEqual(errors,[]);await browser.close();console.log('PASS same-net intersections, layer isolation, through-via connection, pours, export gates, 3D rendering and geometry exports');
})().catch(async e=>{console.error(e);await browser?.close();process.exitCode=1;});
