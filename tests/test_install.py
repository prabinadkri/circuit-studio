import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import install
from distribution import digest


class InstallTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name);self.source=self.root/'source';self.source.mkdir()
        for name,text in [('run.sh','#!/bin/sh\nexit 0\n'),('package.json','{"version":"test"}'),('web/icon.svg','<svg/>')]:
            path=self.source/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_text(text)
        self.files={str(p.relative_to(self.source)):{'sha256':digest(p),'mode':0o755 if p.name=='run.sh' else 0o644} for p in self.source.rglob('*') if p.is_file()}
        self.prefix=self.root/'app';self.bin=self.root/'bin';self.apps=self.root/'applications'
        self.root_patch=patch.object(install,'ROOT',self.source);self.root_patch.start();self.addCleanup(self.root_patch.stop)
        self.file_patch=patch.object(install,'source_files',return_value=self.files);self.file_patch.start();self.addCleanup(self.file_patch.stop)

    def test_offline_install_idempotence_uninstall_preserves_projects_and_modified_files(self):
        result=install.install(self.prefix,self.bin,self.apps)
        release=Path(result['installed']);self.assertTrue((release/'run.sh').is_file());self.assertTrue((self.prefix/'current').is_symlink())
        self.assertEqual(install.install(self.prefix,self.bin,self.apps)['installed'],result['installed'])
        (self.prefix/'projects').mkdir();saved=self.prefix/'projects/my.circuit';saved.write_text('user project')
        (release/'package.json').write_text('user modified source')
        outcome=install.uninstall(self.prefix)
        self.assertTrue(outcome['uninstalled']);self.assertEqual(saved.read_text(),'user project');self.assertTrue((release/'package.json').exists());self.assertFalse((self.bin/'circuit-studio').exists());self.assertFalse((self.prefix/'current').exists())

    def test_bad_manifest_does_not_install(self):
        (self.source/'run.sh').write_text('corrupt')
        with self.assertRaises(ValueError):install.install(self.prefix,self.bin,self.apps)
        self.assertFalse((self.prefix/'current').exists())

    def test_unrelated_shortcut_is_not_replaced(self):
        self.bin.mkdir();launcher=self.bin/'circuit-studio';launcher.write_text('other application')
        with self.assertRaises(ValueError):install.install(self.prefix,self.bin,self.apps)
        self.assertEqual(launcher.read_text(),'other application');self.assertFalse((self.prefix/'current').exists())

    def test_uninstall_does_not_follow_changed_subdirectory_symlink(self):
        result=install.install(self.prefix,self.bin,self.apps);release=Path(result['installed'])
        outside=self.root/'outside';outside.mkdir();(outside/'icon.svg').write_text('<svg/>')
        (release/'web/icon.svg').unlink();(release/'web').rmdir();(release/'web').symlink_to(outside,target_is_directory=True)
        install.uninstall(self.prefix);self.assertTrue((outside/'icon.svg').exists())


if __name__=='__main__':unittest.main()
