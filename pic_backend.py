"""Bounded local PIC simulation adapter; GPL-2.0-or-later."""
import ctypes
import json
import math
import re
from pathlib import Path
import secrets
import tempfile
import threading
import weakref

DEVICES = {d['id']: d for d in json.loads((Path(__file__).parent/'web/devices.json').read_text()) if d['engine']=='pic'}

def validate_hex(text, device='pic'):
    if device not in DEVICES:
        raise ValueError('Unsupported PIC device')
    spec=DEVICES[device]
    if not isinstance(text,str) or len(text)>100000:
        raise ValueError('Firmware must be an Intel HEX file under 100 KB')
    if spec['family']=='PIC16':
        ranges=[(0,spec['flashBytes']),(0x4000,0x4008),(0x400e,0x4010),(0x4200,0x4200+spec['eepromBytes']*2)]
    else:
        ranges=[(0,spec['flashBytes']),(0x200000,0x200008),(0x300000,0x30000e),(0xf00000,0xf00000+spec['eepromBytes']),(0x310000,0x310000+spec['eepromBytes'])]
    program_seen=eof=False
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
        offset=int.from_bytes(data[1:3],'big')
        addr=offset+base
        if typ==0:
            if not count or offset+count>65536: raise ValueError('Invalid data record range')
            if spec['family']=='PIC16' and (count%2 or addr%2):
                raise ValueError('PIC16 words need aligned, even-length data')
            if not any(lo<=addr and addr+count<=hi for lo,hi in ranges):
                raise ValueError('HEX address is outside '+spec['model']+' memory')
            if addr<spec['flashBytes']: program_seen=True
        elif typ==1:
            if count!=0 or offset!=0: raise ValueError('Invalid end record')
            eof=True
        elif typ==4:
            if count!=2 or offset!=0: raise ValueError('Invalid address record')
            base=int.from_bytes(data[4:6],'big')<<16
        else: raise ValueError('Unsupported PIC HEX record type')
        lines.append(line.upper())
    if not program_seen or not eof: raise ValueError('HEX requires program data and an end record')
    return '\n'.join(lines)+'\n'

class PicBackend:
    def __init__(self, root):
        self.lib=ctypes.CDLL(str(Path(root)/'native/libcircuitpic.so'))
        ptr=ctypes.c_void_p
        signatures={
            'cs2_create':([],ptr),'cs2_destroy':([ptr],None),
            'cs2_load':([ptr,ctypes.c_char_p,ctypes.c_char_p,ctypes.c_uint],ctypes.c_int),
            'cs2_step':([ptr,ctypes.c_uint],None),
            'cs2_pc':([ptr],ctypes.c_uint),'cs2_cycles':([ptr],ctypes.c_ulonglong),
            'cs2_input':([ptr,ctypes.c_uint,ctypes.c_int],None),
            'cs2_analog':([ptr,ctypes.c_uint,ctypes.c_float],None),
            **{name:([ptr,ctypes.c_uint],ctypes.c_int) for name in ['cs2_pin','cs2_dir','cs2_type','cs2_ram']},
        }
        for name,(args,result) in signatures.items():
            fn=getattr(self.lib,name);fn.argtypes=args;fn.restype=result
        self.context=self.lib.cs2_create()
        if not self.context: raise OSError('Could not allocate PIC simulator')
        self._cleanup=weakref.finalize(self,self.lib.cs2_destroy,self.context)
        self.lock=threading.Lock()
        self.loaded=False
        self.device='pic'
        self.generation=None
        self.elapsed_cycles=0
    def handle(self, request):
        with self.lock:
            if request.get('action')=='load':
                device=request.get('device','pic')
                if not isinstance(device,str) or device not in DEVICES: raise ValueError('Unsupported PIC device')
                text=validate_hex(request.get('hex'),device)
                spec=DEVICES[device]
                self.loaded=False
                with tempfile.NamedTemporaryFile(suffix='.hex') as f:
                    f.write(text.encode('ascii'));f.flush()
                    if self.lib.cs2_load(self.context,spec['model'].encode(),f.name.encode(),spec['clockHz'])!=0:
                        raise ValueError('PICsim rejected the firmware')
                self.device=device
                self.generation=secrets.token_hex(16)
                self.loaded=True
                self.elapsed_cycles=0
            elif request.get('action') in ('step','trace'):
                if not self.loaded: raise ValueError('Load PIC firmware first')
                if request.get('generation',self.generation)!=self.generation:
                    raise ValueError('PIC session changed in another window. Reload firmware.')
                count=request.get('count',1)
                if type(count)!=int or not 1<=count<=50000: raise ValueError('Invalid step count')
                if request.get('action')=='trace' and count>2000:raise ValueError('Trace batch exceeds 2000 instruction cycles')
                values=request.get('inputs',{})
                analog=request.get('analog',{})
                pins={p['name']:p for p in DEVICES[self.device]['pins']}
                if not isinstance(values,dict) or not isinstance(analog,dict): raise ValueError('Invalid GPIO inputs')
                # Validate all input before changing the native state.
                for name,value in values.items():
                    if name not in pins or type(value)!=bool: raise ValueError('GPIO must be a supported pin and boolean')
                for name,value in analog.items():
                    if name not in pins or 'analog' not in pins[name] or type(value) not in (int,float) or not math.isfinite(value) or not 0<=value<=5:
                        raise ValueError('ADC input must be a supported pin and a voltage from 0 to 5 V')
                for name,value in values.items():self.lib.cs2_input(self.context,pins[name]['physical'],int(value))
                for name,value in analog.items():self.lib.cs2_analog(self.context,pins[name]['physical'],value)
                events=[]
                if request.get('action')=='trace':
                    previous=self.pin_states()
                    for _ in range(count):
                        self.lib.cs2_step(self.context,1)
                        self.elapsed_cycles+=1
                        current=self.pin_states()
                        if current!=previous:
                            events.append({'cycle':self.elapsed_cycles,'pins':current});previous=current
                else:
                    self.lib.cs2_step(self.context,count)
                    self.elapsed_cycles+=count
            else: raise ValueError('Unknown simulation action')
            spec=DEVICES[self.device]
            return {'device':self.device,'generation':self.generation,'pc':self.lib.cs2_pc(self.context),'cycles':self.elapsed_cycles,'coreCycles':self.lib.cs2_cycles(self.context),
                'registers':{name:self.lib.cs2_ram(self.context,addr) for name,addr in spec['registers'].items()},
                'drives':self.pin_states(),
                'events':events if request.get('action')=='trace' else [],
                'pins':[{'name':p['name'],'physical':p['physical'],'value':self.lib.cs2_pin(self.context,p['physical']),
                         'input':bool(p.get('inputOnly') or self.lib.cs2_dir(self.context,p['physical'])),
                         'analog':self.lib.cs2_type(self.context,p['physical']) in (4,5)} for p in spec['pins']]}

    def pin_states(self):
        states={}
        for p in DEVICES[self.device]['pins']:
            n=p['physical']
            states[p['name']]='Z' if p.get('inputOnly') or self.lib.cs2_dir(self.context,n) or self.lib.cs2_type(self.context,n) in (4,5) else ('Z' if p.get('openDrain') else '1') if self.lib.cs2_pin(self.context,n) else '0'
            if states[p['name']]=='Z' and p['name'].startswith('RB') and DEVICES[self.device]['family']=='PIC16' and not self.lib.cs2_ram(self.context,0x81)&0x80:states[p['name']]='H'
        return states
