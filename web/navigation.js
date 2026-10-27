// View-only navigation shared by the schematic and PCB. GPL-2.0-or-later.
const editable = target => !!target?.closest?.('input,textarea,select,[contenteditable="true"],dialog');
const stop = e => { e.preventDefault(); e.stopImmediatePropagation(); };
export class WorkspaceNavigation {
 constructor({surface,controls,pan,zoom,fit,scale,active,selected=()=>true,onSelect=()=>{}}){
  Object.assign(this,{surface,controls,pan,zoom,fit,scale,active,selected,onSelect});
  this.hand=false;this.space=false;this.drag=null;this.suppressClick=false;
  surface.tabIndex=0;
  surface.setAttribute('aria-label',surface.getAttribute('aria-label')||'Schematic canvas. Space drag or middle drag to pan; F to fit.');
  const doc=surface.ownerDocument;
  // Intercept only navigation gestures, before any editing handler sees them.
  doc.addEventListener('pointerdown',e=>{
   if(e.target!==surface&&!surface.contains(e.target))return;
   if(e.button!==1&&!(e.button===0&&(this.hand||this.space))){this.suppressClick=false;return;}
   stop(e);this.drag={id:e.pointerId,x:e.clientX,y:e.clientY};this.suppressClick=true;
   surface.setPointerCapture(e.pointerId);surface.focus({preventScroll:true});this.paint();
  },true);
  doc.addEventListener('pointermove',e=>{
   if(!this.drag||e.pointerId!==this.drag.id)return;
   stop(e);this.pan(e.clientX-this.drag.x,e.clientY-this.drag.y);this.drag.x=e.clientX;this.drag.y=e.clientY;this.paint();
  },true);
  const end=e=>{if(!this.drag||e.pointerId!==this.drag.id)return;stop(e);this.cancelDrag();};
  doc.addEventListener('pointerup',end,true);doc.addEventListener('pointercancel',end,true);
  surface.addEventListener('lostpointercapture',()=>{this.drag=null;this.paint();});
  for(const type of ['mousedown','mouseup','click','dblclick','auxclick'])doc.addEventListener(type,e=>{
   if((e.target===surface||surface.contains(e.target))&&(this.suppressClick||this.hand||this.space||e.button===1))stop(e);
  },true);
  // PCB wheel zoom is view-only. Schematic keeps its existing scope/value wheel options.
  if(surface.tagName.toLowerCase()==='svg')surface.addEventListener('wheel',e=>{stop(e);this.zoom(Math.exp(-Math.max(-300,Math.min(300,e.deltaY))*.002),e.clientX,e.clientY);this.paint();},{passive:false});
  const docs=new Set([doc,document]);
  for(const d of docs){
   d.addEventListener('keydown',e=>this.key(e),true);
   d.addEventListener('keyup',e=>{if(e.code==='Space'&&this.space){this.space=false;stop(e);this.paint();}},true);
   d.defaultView.addEventListener('blur',()=>{if(d===document&&document.hasFocus()&&document.activeElement===this.surface.ownerDocument.defaultView.frameElement)return;this.space=false;this.cancelDrag();this.suppressClick=false;});
   d.addEventListener('visibilitychange',()=>{if(d.hidden){this.space=false;this.cancelDrag();}});
  }
  for(const b of controls.querySelectorAll('[data-view]'))b.addEventListener('click',()=>{
   const action=b.dataset.view;
   if(action==='pan')this.setHand(!this.hand);
   if(action==='select'){this.setHand(false);this.onSelect();}
   if(action==='in')this.zoom(1.2);
   if(action==='out')this.zoom(1/1.2);
   if(action==='fit')this.fit();
   const offsets={left:[80,0],right:[-80,0],up:[0,80],down:[0,-80]};
   if(offsets[action])this.pan(...offsets[action]);this.paint();
  });
  this.paint();
 }
 cancelDrag(){const id=this.drag?.id;this.drag=null;if(id!==undefined&&this.surface.hasPointerCapture(id))this.surface.releasePointerCapture(id);this.paint();}
 setHand(value){this.hand=value;this.space=false;this.cancelDrag();this.paint();}
 key(e){
  if(!this.active()||editable(e.target)||document.querySelector('dialog[open]')||this.surface.ownerDocument.querySelector('.gwt-DialogBox'))return;
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  if(e.code==='Space'){
   if(e.target.closest?.('button,summary,a'))return;
   stop(e);this.space=true;this.paint();return;
  }
  if(e.target.closest?.('button,summary,a'))return;
  const key=e.key.toLowerCase();
  if(key==='h'){stop(e);this.setHand(true);return;}
  if(key==='v'||key==='escape'){this.setHand(false);this.onSelect();if(key==='v')stop(e);return;}
  if(key==='f'){stop(e);this.fit();this.paint();return;}
  if(key==='+'||key==='='||key==='-'){stop(e);this.zoom(key==='-'?1/1.2:1.2);this.paint();return;}
  const offsets={ArrowLeft:[80,0],ArrowRight:[-80,0],ArrowUp:[0,80],ArrowDown:[0,-80]};
  if(e.shiftKey&&offsets[e.key]){stop(e);this.pan(...offsets[e.key]);return;}
  // Existing engine shortcuts (W, R, etc.) remain usable after hand mode.
  if(key.length===1&&!this.space)this.setHand(false);
 }
 paint(){
  const navigating=!!this.drag||this.hand||this.space;
  if(navigating){if(!this.ownsCursor)this.previousCursor=this.surface.style.cursor;this.ownsCursor=true;this.surface.style.setProperty('cursor',this.drag?'grabbing':'grab','important');}
  else if(this.ownsCursor){this.surface.style.cursor=this.previousCursor||'';this.ownsCursor=false;}
  const hint=this.controls.querySelector('.navigation-hint');if(hint)hint.textContent=this.hand?'Pan active · drag workspace · Esc to select':this.space?'Temporary pan · release Space to resume':'Space + drag to pan · scroll to zoom';
  this.surface.classList.toggle('view-panning',!!this.drag||this.hand||this.space);
  const b=this.controls.querySelector('[data-view=pan]');b?.setAttribute('aria-pressed',String(this.hand));
  this.controls.querySelector('[data-view=select]')?.setAttribute('aria-pressed',String(!this.hand&&this.selected()));
  const readout=this.controls.querySelector('[data-zoom]');if(readout)readout.textContent=Math.round(this.scale()*100)+'%';
 }
}
export function boardViewport(svg){
 const view=()=>svg.viewBox.baseVal;
 return {
  pan(dx,dy){const matrix=svg.getScreenCTM();if(!matrix)return;const v=view();svg.setAttribute('viewBox',`${v.x-dx/matrix.a} ${v.y-dy/matrix.d} ${v.width} ${v.height}`);},
  zoom(factor,cx,cy){const v=view(),m=svg.getScreenCTM();if(!m)return;const rect=svg.getBoundingClientRect();const point=new DOMPoint(cx??rect.x+rect.width/2,cy??rect.y+rect.height/2).matrixTransform(m.inverse());const width=Math.max(15,Math.min(600,v.width/factor)),ratio=width/v.width;svg.setAttribute('viewBox',`${point.x-(point.x-v.x)*ratio} ${point.y-(point.y-v.y)*ratio} ${width} ${v.height*ratio}`);},
  fit(){svg.setAttribute('viewBox','0 0 120 80');},
  scale(){return 120/view().width;}
 };
}
