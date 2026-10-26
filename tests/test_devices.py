import unittest
import ctypes
from pathlib import Path
from pic_backend import PicBackend,DEVICES,validate_hex
ROOT=Path(__file__).resolve().parents[1]
def firmware(model,experiment):return (ROOT/'examples/lab'/f'{model.lower()}-{experiment}.hex').read_text()
def record(address,data,kind=0):
    values=[len(data),address>>8,address&255,kind,*data]
    return ':'+''.join(f'{b:02X}' for b in values+[(-sum(values))&255])+'\n'

class LabDevices(unittest.TestCase):
    def test_all_pic_blink_and_physical_output(self):
        for key,spec in DEVICES.items():
            with self.subTest(device=key):
                b=PicBackend(ROOT);b.handle({'action':'load','device':key,'hex':firmware(spec['model'],'blink')})
                levels=set()
                for _ in range(80):
                    state=b.handle({'action':'step','count':20000})
                    p=next(p for p in state['pins'] if p['name']=='RB0');levels.add(p['value'])
                self.assertEqual(levels,{0,1})
                self.assertEqual(p['physical'],6 if key in ('pic','pic16f628a') else 33)
                self.assertFalse(p['input'])
                self.assertEqual(state['cycles'],1600000)
    def test_button_inputs_all_models(self):
        for key,spec in DEVICES.items():
            with self.subTest(device=key):
                b=PicBackend(ROOT);b.handle({'action':'load','device':key,'hex':firmware(spec['model'],'button')})
                for high in [True,False,True]:
                    state=b.handle({'action':'step','count':100,'inputs':{'RB1':high}})
                    self.assertEqual(next(p['value'] for p in state['pins'] if p['name']=='RB0'),int(high))
    def test_adc_voltage_sweep(self):
        for key in ['pic16f877a','pic18f4520','pic18f4550']:
            with self.subTest(device=key):
                b=PicBackend(ROOT);b.handle({'action':'load','device':key,'hex':firmware(DEVICES[key]['model'],'adc')})
                for volts,expected in [(0,0),(1.25,255),(2.5,511),(5,1023),(0,0)]:
                    state=b.handle({'action':'step','count':1000,'analog':{'RA0':volts}})
                    r=state['registers'];self.assertEqual((r['ADRESH']<<8)|r['ADRESL'],expected)
    def test_backend_instances_are_independent(self):
        a,b=PicBackend(ROOT),PicBackend(ROOT)
        a.handle({'action':'load','hex':firmware('PIC16F84A','blink')})
        b.handle({'action':'load','device':'pic18f4550','hex':firmware('PIC18F4550','blink')})
        self.assertEqual(a.handle({'action':'step','count':100})['cycles'],100)
        self.assertEqual(b.handle({'action':'step','count':7})['cycles'],7)
    def test_target_specific_memory_limits(self):
        high=record(0x3ffe,[0,0])+record(0,[],1)
        validate_hex(high,'pic16f877a')
        for model in ['pic','pic16f628a']:
            with self.assertRaises(ValueError):validate_hex(high,model)
        for key in DEVICES:
            bad=record(DEVICES[key]['flashBytes'],[0,0])+record(0,[],1)
            with self.subTest(device=key),self.assertRaises(ValueError):validate_hex(bad,key)
    def test_configuration_without_program_rejected(self):
        with self.assertRaises(ValueError):validate_hex(record(0x400e,[0xff,0x3f])+record(0,[],1))
    def test_pic18_byte_configuration_and_eeprom(self):
        value=record(0,[0,0])+record(0,[0,0x30],4)+record(1,[0xfc])+record(0,[0,0xf0],4)+record(0,[42])+record(0,[],1)
        validate_hex(value,'pic18f4550')
        b=PicBackend(ROOT);b.handle({'action':'load','device':'pic18f4550','hex':value})
    def test_invalid_pin_voltage_device_and_stale_session(self):
        b=PicBackend(ROOT)
        with self.assertRaises(ValueError):b.handle({'action':'load','device':'unknown','hex':''})
        old=b.handle({'action':'load','device':'pic16f877a','hex':firmware('PIC16F877A','blink')})
        b.handle({'action':'load','hex':firmware('PIC16F84A','blink')})
        for update in [{'generation':old['generation']},{'analog':{'RA0':2.5}},{'inputs':{'VDD':True}},{'inputs':{'RB1':1}}]:
            with self.assertRaises(ValueError):b.handle({'action':'step',**update})
        b.handle({'action':'load','device':'pic16f877a','hex':firmware('PIC16F877A','adc')})
        for value in [True,-1,5.1,float('nan'),float('inf'),'2.5']:
            with self.subTest(value=value),self.assertRaises(ValueError):b.handle({'action':'step','analog':{'RA0':value}})

    def test_legacy_launcher_abi(self):
        lib=ctypes.CDLL(str(ROOT/'native/libcircuitpic.so'))
        lib.cs_load.argtypes=[ctypes.c_char_p]
        lib.cs_cycles.restype=ctypes.c_ulonglong
        self.assertEqual(lib.cs_load(str(ROOT/'examples/pic16f84a-blink.hex').encode()),0)
        lib.cs_step(20000)
        self.assertEqual(lib.cs_cycles(),20000)
        # New instance loading must not replace the legacy session.
        modern=PicBackend(ROOT)
        modern.handle({'action':'load','device':'pic18f4550','hex':firmware('PIC18F4550','blink')})
        self.assertEqual(lib.cs_cycles(),20000)
