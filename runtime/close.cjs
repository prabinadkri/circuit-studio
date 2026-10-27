// Electron does not show a browser beforeunload prompt automatically.
// Keep the renderer's recovery/save checks, and let the user decide explicitly.
module.exports=function installCloseConfirmation(window,dialog){
 window.webContents.on('will-prevent-unload',event=>{
  const choice=dialog.showMessageBoxSync(window,{
   type:'question',title:'Circuit Studio — unsaved changes',
   message:'Close Circuit Studio without saving?',
   detail:'Choose Keep editing to save your project locally or export a file before closing.',
   buttons:['Keep editing','Close without saving'],defaultId:0,cancelId:0,noLink:true
  });
  // On this event, preventDefault means allow unloading despite the page veto.
  if(choice===1)event.preventDefault();
 });
};
