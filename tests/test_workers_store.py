import json, tempfile, unittest, uuid
from pathlib import Path
from unittest.mock import patch
from pic_worker import PicWorker, PicSessions
from project_store import ProjectStore
ROOT=Path(__file__).resolve().parents[1]
HEX=(ROOT/'examples/pic16f84a-blink.hex').read_text()
class WorkerTests(unittest.TestCase):
 def test_crash_recovery_and_isolation(self):
  sessions=PicSessions(ROOT)
  try:
   a=sessions.handle({'action':'load','hex':HEX,'instance':'a'})
   b=sessions.handle({'action':'load','hex':HEX,'instance':'b'})
   x=sessions.handle({'action':'step','count':100,'instance':'a','generation':a['generation']})
   y=sessions.handle({'action':'step','count':1,'instance':'b','generation':b['generation']})
   self.assertEqual((x['cycles'],y['cycles']),(100,1))
   sessions.workers['a'].process.kill();sessions.workers['a'].process.join()
   with self.assertRaisesRegex(ValueError,'Reload firmware'):sessions.handle({'action':'step','count':1,'instance':'a'})
   self.assertEqual(sessions.handle({'action':'step','count':1,'instance':'b'})['cycles'],2)
   fresh=sessions.handle({'action':'load','hex':HEX,'instance':'a'})
   self.assertEqual(fresh['cycles'],0)
   self.assertNotEqual(a['generation'],fresh['generation'])
  finally:sessions.close()
 def test_worker_timeout(self):
  w=PicWorker(ROOT)
  try:
   w.handle({'action':'load','hex':HEX})
   with patch.object(w.connection,'poll',return_value=False):
    with self.assertRaisesRegex(ValueError,'timed out'):w.handle({'action':'step','count':1})
   self.assertIsNone(w.process)
  finally:w.close()
class StoreTests(unittest.TestCase):
 def test_atomic_failure_and_recovery(self):
  with tempfile.TemporaryDirectory() as tmp:
   store=ProjectStore(tmp);key=str(uuid.uuid4());p={'format':'circuit-studio','version':2,'id':key,'name':'first'}
   store.save(p);self.assertEqual(store.load(key)['name'],'first')
   original=__import__('os').replace
   def interrupted(src,dst):
    if str(dst).endswith('.circuit'):raise OSError('interrupted rename')
    return original(src,dst)
   with patch('project_store.os.replace',side_effect=interrupted):
    with self.assertRaises(OSError):store.save({**p,'name':'lost'})
   self.assertEqual(store.load(key)['name'],'first')
   store.save({**p,'name':'second'});self.assertEqual(store.load(key)['name'],'second')
   self.assertEqual(store.list()[0]['id'],key)
   with self.assertRaises(ValueError):store.load('../../private')

class WorkerProjectTests(unittest.TestCase):
 def test_worker_failure_preserves_saved_project_and_repeatable_steps(self):
  with tempfile.TemporaryDirectory() as tmp:
   store=ProjectStore(tmp);key=str(uuid.uuid4());project={'format':'circuit-studio','version':2,'id':key,'name':'Crash recovery','schematic':'unchanged','board':{'parts':[],'tracks':[]}}
   store.save(project);w=PicWorker(ROOT)
   try:
    w.handle({'action':'load','hex':HEX});first=w.handle({'action':'step','count':1000})
    w.handle({'action':'load','hex':HEX});second=w.handle({'action':'step','count':1000})
    for field in ['cycles','pc','pins','registers']:
     if field in first:self.assertEqual(first[field],second[field])
    w.process.kill();w.process.join()
    with self.assertRaises(ValueError):w.handle({'action':'step','count':1})
    self.assertEqual(store.load(key),project)
   finally:w.close()
