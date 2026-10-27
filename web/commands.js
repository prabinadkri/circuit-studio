// Searchable entry points into the existing workbench actions. GPL-2.0-or-later.
export function commandSearch({dialog,input,results,count,trigger,commands}){
 let matches=[],returnFocus,restoreFocus=true;
 const buttons=()=>[...results.querySelectorAll('button')];
 function render(){
  const terms=input.value.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  matches=commands.filter(c=>terms.every(t=>`${c.label} ${c.group} ${c.keywords||''}`.toLocaleLowerCase().includes(t)));
  results.replaceChildren();
  for(const command of matches){
   const button=document.createElement('button'),label=document.createElement('span'),group=document.createElement('small');
   button.type='button';label.textContent=command.label;group.textContent=command.group;
   button.append(label,group);button.disabled=command.available?!command.available():false;
   button.onclick=()=>{restoreFocus=false;dialog.close();returnFocus?.focus({preventScroll:true});command.run();};results.append(button);
  }
  count.textContent=matches.length?`${matches.length} commands · ↑ ↓ to browse · Enter to choose`:'No matching commands. Try “pan”, “components” or “save”.';
 }
 function open(){
  if(document.querySelector('dialog[open]')||document.getElementById('sim')?.contentDocument?.querySelector('.gwt-DialogBox'))return;
  restoreFocus=true;returnFocus=document.activeElement;input.value='';render();dialog.showModal();input.focus();
 }
 trigger.addEventListener('click',open);input.addEventListener('input',render);
 dialog.addEventListener('close',()=>{if(restoreFocus)returnFocus?.focus({preventScroll:true});});
 dialog.addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();dialog.close();return;}
  const enabled=buttons().filter(b=>!b.disabled),index=enabled.indexOf(document.activeElement);
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){
   e.preventDefault();if(!enabled.length)return;
   const next=e.key==='ArrowDown'?(index+1)%enabled.length:index<0?enabled.length-1:(index-1+enabled.length)%enabled.length;
   enabled[next].focus();
  }else if(e.key==='Enter'&&e.target===input){e.preventDefault();enabled[0]?.click();}
 });
 return {open};
}
