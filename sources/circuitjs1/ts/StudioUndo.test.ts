import {it,expect} from 'vitest';
import {UndoManager} from './UndoManager';
it('skips duplicate current snapshots and preserves redo',()=>{
 let circuit='<circuit><resistor/></circuit>';
 const app:any={transform:[1,0,0,1,0,0],dumpCircuit:()=>circuit,loader:{readCircuit:(s:string)=>{circuit=s;}},menus:{undoItem:{setEnabled:()=>{}},redoItem:{setEnabled:()=>{}}}};
 const undo=new UndoManager(app);
 undo.pushUndo();
 circuit='<circuit><resistor/><capacitor/></circuit>';
 undo.pushUndo();
 undo.doUndo();
 expect(circuit).toBe('<circuit><resistor/></circuit>');
 undo.doRedo();
 expect(circuit).toBe('<circuit><resistor/><capacitor/></circuit>');
});
