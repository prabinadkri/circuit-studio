// Bundled desktop runtime. Renderer has no Node.js access. GPL-2.0-or-later.
const {app,BrowserWindow,session,shell,dialog}=require('electron');
const path=require('node:path');
const url=process.env.STUDIO_URL;
if(!url||!/^http:\/\/127\.0\.0\.1:\d+\//.test(url)){console.error('A local Circuit Studio URL is required');app.exit(2);}
else {
 if(process.env.STUDIO_PROFILE)app.setPath('userData',process.env.STUDIO_PROFILE);
 app.setName('Circuit Studio');
 if(process.platform==='linux')app.setDesktopName('circuit-studio.desktop');
 app.whenReady().then(()=>{
  const origin=new URL(url).origin;
  session.defaultSession.setPermissionRequestHandler((_web,_permission,callback)=>callback(false));
  session.defaultSession.webRequest.onBeforeRequest((details,callback)=>{let allowed=false;try{const u=new URL(details.url);allowed=u.origin===origin||['blob:','data:','devtools:'].includes(u.protocol);}catch{}callback({cancel:!allowed});});
  const window=new BrowserWindow({title:'Circuit Studio',icon:path.join(__dirname,'../web/icon.png'),show:process.env.STUDIO_HEADLESS!=='1',width:1440,height:940,minWidth:900,minHeight:650,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true}});
  require('./close.cjs')(window,dialog);
  window.setMenuBarVisibility(false);
  window.webContents.setWindowOpenHandler(({url})=>{if(/^https:\/\//.test(url)&&process.env.STUDIO_HEADLESS!=='1')shell.openExternal(url);return {action:'deny'};});
  window.webContents.on('will-navigate',(event,target)=>{if(new URL(target).origin!==origin)event.preventDefault();});
  window.loadURL(url);
 });
 app.on('window-all-closed',()=>app.quit());
}
