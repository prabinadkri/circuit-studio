"""Bounded, local PIC16F84A simulation adapter; GPL-2.0-or-later."""
import ctypes
import re
from pathlib import Path
import tempfile
import threading

PINS = [('RA0',17),('RA1',18),('RA2',1),('RA3',2),('RA4',3)]+[(f'RB{i}',6+i) for i in range(8)]

def validate_hex(text):
    if not isinstance(text,str) or len(text)>100000:
        raise ValueError('Firmware must be an Intel HEX file under 100 KB')
    data_seen = eof = False
    base=0
    lines=[]
    for line in text.strip().splitlines():
        line=line.strip()
        if not line: continue
        if eof or not re.fullmatch(r':[0-9a-fA-F]+',line) or len(line)>251:
            raise ValueError('Malformed or overlong HEX record')
        try: data=bytes.fromhex(line[1:])
        except ValueError: raise ValueError('Invalid hexadecimal data')
        if len(data)<5 or len(data)!=data[0]+5 or sum(data)%256:
            raise ValueError('HEX checksum or length error')
        count,typ=data[0],data[3]
        addr=int.from_bytes(data[1:3],'big')+base
        if typ==0:
            if count%2 or addr%2: raise ValueError('PIC words need aligned, even-length data')
            allowed=any(lo<=addr and addr+count<=hi for lo,hi in [(0,2048),(0x4000,0x4008),(0x400e,0x4010),(0x4200,0x4280)])
            if not allowed: raise ValueError('HEX address is outside PIC16F84A memory')
            data_seen=True
        elif typ==1:
            if count!=0: raise ValueError('Invalid end record')
            eof=True
        elif typ==4:
            if count!=2: raise ValueError('Invalid address record')
            base=int.from_bytes(data[4:6],'big')<<16
        else: raise ValueError('Unsupported PIC HEX record type')
        lines.append(line)
    if not data_seen or not eof: raise ValueError('HEX requires data and an end record')
    return '\n'.join(lines)+'\n'

class PicBackend:
    def __init__(self, root):
        self.lib=ctypes.CDLL(str(Path(root)/'native/libcircuitpic.so'))
        self.lib.cs_load.argtypes=[ctypes.c_char_p]
        self.lib.cs_load.restype=ctypes.c_int
        self.lib.cs_step.argtypes=[ctypes.c_uint]
        self.lib.cs_step.restype=None
        self.lib.cs_pc.restype=ctypes.c_uint
        self.lib.cs_cycles.restype=ctypes.c_ulonglong
        self.lib.cs_pin.argtypes=[ctypes.c_uint]
        self.lib.cs_dir.argtypes=[ctypes.c_uint]
        self.lib.cs_input.argtypes=[ctypes.c_uint,ctypes.c_int]
        self.lib.cs_input.restype=None
        self.lock=threading.Lock()
        self.loaded=False
    def handle(self, request):
        with self.lock:
            if request.get('action')=='load':
                text=validate_hex(request.get('hex'))
                with tempfile.NamedTemporaryFile(suffix='.hex') as f:
                    f.write(text.encode('ascii'));f.flush()
                    if self.lib.cs_load(f.name.encode())!=0:
                        self.loaded=False
                        raise ValueError('PICsim rejected the firmware')
                self.loaded=True
            elif request.get('action')=='step':
                if not self.loaded: raise ValueError('Load PIC firmware first')
                count=request.get('count',1)
                if type(count)!=int or not 1<=count<=50000: raise ValueError('Invalid step count')
                values=request.get('inputs',{})
                if not isinstance(values,dict): raise ValueError('Invalid GPIO inputs')
                for label,pin in PINS:
                    if label in values:
                        if type(values[label])!=bool: raise ValueError('GPIO must be boolean')
                        self.lib.cs_input(pin,int(values[label]))
                self.lib.cs_step(count)
            else: raise ValueError('Unknown simulation action')
            return {'pc':self.lib.cs_pc(),'cycles':self.lib.cs_cycles(),'pins':[{'name':label,'value':self.lib.cs_pin(pin),'input':bool(self.lib.cs_dir(pin))} for label,pin in PINS]}
