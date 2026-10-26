import unittest
from pathlib import Path
from pic_backend import PicBackend
ROOT=Path(__file__).resolve().parents[1]

def firmware():
    # PIC16F84A: configure RB0 output, then BSF / BCF / GOTO.
    words=[0x1683,0x1006,0x1283,0x0186,0x1406,0x1006,0x2804]
    data=[len(words)*2,0,0,0]+[b for w in words for b in (w&255,w>>8)]
    data+=[-sum(data)&255]
    return ':'+''.join(f'{b:02X}' for b in data)+'\n:02400E00F93F78\n:00000001FF\n'

class ClockTests(unittest.TestCase):
    def test_native_pic_preserves_10000_edges_across_batch_sizes(self):
        def run(batch):
            backend=PicBackend(ROOT);backend.handle({'action':'load','hex':firmware()})
            events=[]
            for _ in range(24000//batch):
                result=backend.handle({'action':'trace','count':batch})
                events.extend((e['cycle'],e['pins']['RB0']) for e in result['events'])
            return events,result['cycles']
        first,cycles=run(1000);second,_=run(100)
        self.assertEqual(first,second);self.assertEqual(cycles,24000);self.assertGreater(len(first),10000)
        transitions=[e for e in first if e[1] in ('0','1')]
        self.assertTrue(all(b[0]-a[0] in (1,3) for a,b in zip(transitions[2:],transitions[3:])))

    def test_pic16_ra4_is_open_drain(self):
        words=[0x1683,0x1205,0x1283,0x1605,0x1205,0x2803]
        data=[len(words)*2,0,0,0]+[b for w in words for b in (w&255,w>>8)]
        data+=[-sum(data)&255]
        hex=':'+''.join(f'{b:02X}' for b in data)+'\n:02400E00F93F78\n:00000001FF\n'
        backend=PicBackend(ROOT);backend.handle({'action':'load','hex':hex})
        result=backend.handle({'action':'trace','count':50})
        states={e['pins']['RA4'] for e in result['events']}
        self.assertEqual(states,{'Z','0'})

    def test_watchdog_reset_cannot_rewind_shared_clock(self):
        backend=PicBackend(ROOT);backend.handle({'action':'load','hex':firmware().replace(':02400E00F93F78\n','')})
        times=[]
        for n in range(12):
            state=backend.handle({'action':'trace','count':2000})
            self.assertEqual(state['cycles'],(n+1)*2000)
            times.extend(e['cycle'] for e in state['events'])
        self.assertEqual(times,sorted(times));self.assertLess(state['coreCycles'],state['cycles'])

    def test_invalid_trace_limit_does_not_change_inputs_or_time(self):
        backend=PicBackend(ROOT);backend.handle({'action':'load','hex':firmware()})
        with self.assertRaises(ValueError):backend.handle({'action':'trace','count':2001,'inputs':{'RB1':True}})
        state=backend.handle({'action':'step','count':1})
        self.assertEqual(state['cycles'],1)

if __name__=='__main__':unittest.main()
