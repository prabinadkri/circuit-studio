// Schematic drawing controls. GPL-2.0-or-later.
export function drawingControls({sim,selectWire,capture,active}){
 const $=id=>document.getElementById(id);let preferences={};
 try{preferences=JSON.parse(localStorage.getItem('circuit-studio-drawing')||'{}')||{};}catch{}
 $('wireStyle').value=preferences.style==='straight'?'straight':'auto';
 sim.configureDrawing({grid:preferences.grid!==false});
 const save=()=>{try{localStorage.setItem('circuit-studio-drawing',JSON.stringify({grid:sim.getDrawingState().grid,style:$('wireStyle').value}));}catch{}};
 const wire=()=>selectWire($('wireStyle').value==='straight'?'WireElm':'RoutedWireElm');
 const finish=()=>{capture();sim.finishWire();capture();paint();};
 $('drawWire').onclick=wire;
 $('wireStyle').onchange=()=>{save();wire();};
 $('gridVisible').onclick=()=>{sim.configureDrawing({grid:!sim.getDrawingState().grid});save();paint();};
 $('gridSpacing').onchange=()=>{capture();sim.configureDrawing({spacing:Number($('gridSpacing').value)});capture();paint();};
 $('finishWire').onclick=finish;$('cancelWire').onclick=()=>{sim.cancelWire();paint();};
 function paint(){
  const state=sim.getDrawingState(),tool=sim.getViewport().tool,isWire=['WireElm','RoutedWireElm'].includes(tool);
  if(isWire)$('wireStyle').value=tool==='WireElm'?'straight':'auto';
  $('drawWire').setAttribute('aria-pressed',String(isWire));
  $('gridVisible').setAttribute('aria-pressed',String(state.grid));
  $('gridSpacing').value=String(state.spacing);
  $('finishWire').disabled=$('cancelWire').disabled=!state.pending;
  return state;
 }
 function key(e){
  if(!active()||e.altKey||e.ctrlKey||e.metaKey)return false;
  if(e.target.closest?.('input,textarea,select,button,summary,a,[contenteditable="true"]'))return false;
  const state=sim.getDrawingState(),key=e.key.toLowerCase();
  if(key==='w')wire();
  else if(state.pending&&key==='enter')finish();
  else if(state.pending&&key==='backspace')sim.undoWireCorner();
  else return false;
  e.preventDefault();e.stopImmediatePropagation();paint();return true;
 }
 paint();return {paint,key};
}
