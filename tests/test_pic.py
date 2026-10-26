import unittest
from pathlib import Path
from pic_backend import PicBackend,validate_hex
ROOT=Path(__file__).resolve().parents[1]
class PicTests(unittest.TestCase):
    def test_invalid_checksum(self):
        with self.assertRaises(ValueError):validate_hex(':020000000000FF\n:00000001FF')
    def test_missing_eof(self):
        with self.assertRaises(ValueError):validate_hex(':020000000000FE')
    def test_address_out_of_bounds(self):
        with self.assertRaises(ValueError):validate_hex(':021000000000EE\n:00000001FF')
    def test_real_blink_firmware(self):
        backend=PicBackend(ROOT)
        backend.handle({'action':'load','hex':(ROOT/'examples/pic16f84a-blink.hex').read_text()})
        levels=set()
        for _ in range(80):
            state=backend.handle({'action':'step','count':20000})
            levels.add(next(p['value'] for p in state['pins'] if p['name']=='RB0'))
        self.assertEqual(levels,{0,1})
        self.assertEqual(state['cycles'],1600000)
    def test_step_limit(self):
        backend=PicBackend(ROOT)
        backend.handle({'action':'load','hex':(ROOT/'examples/pic16f84a-blink.hex').read_text()})
        with self.assertRaises(ValueError):backend.handle({'action':'step','count':50001})
if __name__=='__main__':unittest.main()
