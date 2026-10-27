// Visible access to the engine's timestep-sampled oscilloscope. GPL-2.0-or-later.
export class SchematicScopes {
 constructor({getSim,getDesign,catalog,capture,changed,status,go,run}){
  Object.assign(this,{getSim,getDesign,catalog,capture,changed,status,go});
  this.$=id=>document.getElementById(id);const $=this.$;
  $('openScope').onclick=() => this.open();$('instrumentScope').onclick=()=>this.open();
  $('addScope').onclick=()=>this.show($('scopeSignal').value);
  $('scopeSearch').oninput=()=>this.signals();
  $('scopeRun').onclick=run;
  for(const b of $('scopeTools').querySelectorAll('[data-scope-action]'))b.onclick=()=>{
   try{capture();getSim().scopeAction(Number($('activeScope').value),b.dataset.scopeAction);capture();this.refresh();}
   catch(e){status(e.message);}
  };
  setInterval(()=>{if(document.getElementById('schematic').classList.contains('active'))this.refresh();},300);
 }
 label(id){const e=this.getDesign().instances.find(e=>e.id===id);return e?`${e.reference} · ${this.catalog.parts.find(p=>p.type===e.type)?.label||e.type.replace(/Elm$/,'').replace(/([a-z])([A-Z])/g,'$1 $2')}`:'Scope';}
 open(id){
  if(!this.getSim())return;this.$('scopeError').textContent='';this.$('scopeSearch').value='';this.signals(id);
  this.$('scopeDialog').showModal();this.$('scopeSearch').focus();
 }
 signals(preferred){
  const $=this.$,sim=this.getSim(),old=preferred||$('scopeSignal').value||sim.getSelection(),q=$('scopeSearch').value.toLowerCase();
  const signals=sim.getScopeSignals().map(s=>({...s,label:this.label(s.id)})).filter(s=>s.label.toLowerCase().includes(q));
  $('scopeSignal').replaceChildren(...signals.map(s=>new Option(s.label,s.id)));
  $('scopeSignal').value=signals.some(s=>s.id===old)?old:signals[0]?.id||'';
  $('addScope').disabled=!signals.length;$('scopeEmpty').hidden=!!signals.length;
 }
 show(id){
  try{this.capture();const index=this.getSim().showScope(id);this.capture();this.changed();
   this.$('scopeDialog').close();this.go('schematic');this.refresh();this.$('activeScope').value=String(index);
   this.status('Oscilloscope opened below the circuit. Run to capture; Properties controls scales, signals and measurements.');
  }catch(e){this.$('scopeError').textContent=e.message;this.status(e.message);}
 }
 refresh(){
  const sim=this.getSim();if(!sim)return;const $=this.$,scopes=sim.getScopes(),values=scopes.map(s=>[s.index,this.label(s.id)]),select=$('activeScope');
  const signature=JSON.stringify(values);if(select.dataset.options!==signature){const old=select.value;select.replaceChildren(...values.map(([i,label])=>new Option(label,String(i))));if(values.some(([i])=>String(i)===old))select.value=old;select.dataset.options=signature;}
  $('scopeTools').hidden=!scopes.length;
  $('scopeRun').textContent=sim.isRunning()||window.studioClock?.running?'Pause capture':'Run capture';
 }
}
