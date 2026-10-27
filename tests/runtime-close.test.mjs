import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createRequire} from 'node:module';
const install=createRequire(import.meta.url)('../runtime/close.cjs');
test('unsaved close keeps editing by default and closes only on an explicit choice',()=>{
 const window={webContents:new EventEmitter()};let choice=0,shown=0,allowed=0;
 install(window,{showMessageBoxSync:(owner,options)=>{
  assert.equal(owner,window);assert.equal(options.defaultId,0);assert.equal(options.cancelId,0);
  assert.deepEqual(options.buttons,['Keep editing','Close without saving']);shown++;return choice;
 }});
 const close=()=>window.webContents.emit('will-prevent-unload',{preventDefault:()=>allowed++});
 close();assert.equal(allowed,0);choice=-1;close();assert.equal(allowed,0);
 choice=1;close();assert.equal(allowed,1);assert.equal(shown,3);
});
