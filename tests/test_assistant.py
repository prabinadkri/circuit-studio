import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from assistant_bridge import AssistantBridge


class AssistantTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name)
        self.bridge=AssistantBridge(self.root/'studio',self.root/'assistant')
        self.project={'format':'circuit-studio','version':2,'id':'b9a486ae-bc6b-4383-83ad-404792b5f769','name':'Original','schematic':'$ 1 0.000005 10 50 5 50\n'}

    def test_copy_open_edit_read_and_original_preserved(self):
        with patch.object(self.bridge,'hub') as hub:
            first=self.bridge.handle({'action':'prepare','project':self.project})
            workspace=self.bridge.path(first['workspace'])
            hub.assert_called_once_with(workspace,False)
            self.assertEqual(self.bridge.handle({'action':'result','workspace':first['workspace']})['project'],self.project)
            self.bridge.handle({'action':'open','workspace':first['workspace']})
            hub.assert_called_with(workspace,True)
            updated={**self.project,'name':'Edited'}
            (workspace/'design.circuit').write_text(json.dumps(updated))
            result=self.bridge.handle({'action':'result','workspace':first['workspace']})
            self.assertNotEqual(result['revision'],first['revision'])
            self.assertEqual(result['project']['name'],'Edited')
            self.assertEqual(self.project['name'],'Original')
            second=self.bridge.handle({'action':'prepare','project':self.project})
            self.assertNotEqual(first['workspace'],second['workspace'])
            self.assertEqual(self.bridge.read(first['workspace'])['project']['name'],'Edited')

    def test_boundary_and_invalid_results(self):
        for key in ('../escape','/tmp/out','a'*31,'z'*32,None):
            with self.assertRaises(ValueError):self.bridge.handle({'action':'result','workspace':key})
        with patch.object(self.bridge,'hub'):
            result=self.bridge.handle({'action':'prepare','project':self.project})
        path=self.bridge.path(result['workspace'])/'design.circuit'
        path.write_text('{}')
        with self.assertRaises(ValueError):self.bridge.read(result['workspace'])
        path.unlink();outside=self.root/'outside';outside.write_text(json.dumps(self.project));path.symlink_to(outside)
        with self.assertRaises(ValueError):self.bridge.read(result['workspace'])
        path.unlink();path.parent.rmdir();path.parent.symlink_to(self.root)
        with self.assertRaises(ValueError):self.bridge.read(result['workspace'])

    def test_open_errors_do_not_expose_subprocess_logs(self):
        import subprocess
        result=subprocess.CompletedProcess([],1,'secret local token','sensitive log')
        with patch('assistant_bridge.shutil.which',return_value='/fake/codehub'),patch('assistant_bridge.subprocess.run',return_value=result) as run:
            with self.assertRaisesRegex(ValueError,'Coding Hub could not open') as error:self.bridge.hub(self.root,True)
            self.assertNotIn('secret',str(error.exception));self.assertNotIn('sensitive',str(error.exception))
            self.assertEqual(run.call_args.args[0][-1],'--open')
            self.assertNotIn('shell',run.call_args.kwargs)

    def test_initial_project_and_invalid_prepare(self):
        self.assertEqual(self.bridge.handle({'action':'initial'}),{'project':None})
        for bad in ({}, {'format':'circuit-studio','version':2},None):
            with self.assertRaises(ValueError):self.bridge.handle({'action':'prepare','project':bad})
        self.assertFalse(self.bridge.root.exists())

if __name__=='__main__':unittest.main()
