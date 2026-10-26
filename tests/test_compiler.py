import os
import unittest
from compiler_backend import CompilerBackend

class CompilerTests(unittest.TestCase):
    def test_discovery_is_explicit(self):
        result=CompilerBackend().run({'action':'status'})
        self.assertIs(type(result['available']),bool)
        self.assertEqual(result['target'],'ATmega328P')
    @unittest.skipUnless(CompilerBackend().tools(),'AVR-GCC not installed')
    def test_diagnostics_and_real_debug_symbols(self):
        backend=CompilerBackend()
        bad=backend.run({'action':'build','device':'avr','source':'int main(void) {\n not valid;\n}\n'})
        self.assertFalse(bad['ok']);self.assertEqual(bad['diagnostics'][0]['line'],2)
        good=backend.run({'action':'build','device':'nano','source':'volatile unsigned char counter;\nint main(void) {\n counter++;\n while(1) {}\n}\n'})
        self.assertTrue(good['ok']);self.assertTrue(good['hex'].endswith(':00000001FF\n'))
        self.assertIn(3,good['debug']['lines'].values());self.assertEqual(good['debug']['variables'][0]['name'],'counter')
    @unittest.skipUnless(CompilerBackend().tools(),'AVR-GCC not installed')
    def test_rejects_other_targets_and_external_file_directives(self):
        backend=CompilerBackend()
        for source in ['#include "/etc/passwd"',' #/**/include "/etc/passwd"','#define FILE "/etc/passwd"\n#include FILE','#pragma GCC dependency "/etc/passwd"','int main(){asm(".incbin \\"/etc/passwd\\"");}','#include\\\n "/etc/passwd"']:
            with self.subTest(source=source),self.assertRaises(ValueError):backend.run({'action':'build','device':'avr','source':source})
        with self.assertRaises(ValueError):backend.run({'action':'build','device':'pic','source':'int main(){}'})
