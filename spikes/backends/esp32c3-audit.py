#!/usr/bin/env python3
"""Bounded ESP32-C3 direct-ELF boot/UART feasibility probe; GPL-2.0-or-later.
No external compiler needed: the fixture uses RV32I LUI, ADDI, SW and JAL.
This tests neither an ESP-IDF flash boot nor GPIO/analog/radio/USB support.
"""
import argparse,hashlib,json,struct,subprocess,tempfile
from pathlib import Path
MESSAGE=b'Circuit Studio ESP32-C3 UART probe OK\n'
def firmware():
    # lui t0,0x60000 (UART0); addi t1,zero,char; sw t1,0(t0); jal zero,0
    words=[0x600002b7]
    for c in MESSAGE:words += [(c<<20)|(6<<7)|0x13,(6<<20)|(5<<15)|(2<<12)|0x23]
    words += [0x0000006f]
    code=struct.pack('<'+'I'*len(words),*words);entry=0x40380000
    ident=b'\x7fELF\x01\x01\x01'+b'\0'*9
    header=ident+struct.pack('<HHIIIIIHHHHHH',2,243,1,entry,52,0,0,52,32,1,0,0,0)
    ph=struct.pack('<IIIIIIII',1,4096,entry,entry,len(code),len(code),5,4096)
    return (header+ph).ljust(4096,b'\0')+code

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--qemu',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
    version=subprocess.check_output([a.qemu,'--version'],text=True).splitlines()[0]
    data=firmware();logs=[]
    with tempfile.TemporaryDirectory(prefix='studio-esp32c3-audit-') as tmp:
        elf=Path(tmp)/'uart.elf';elf.write_bytes(data)
        uart=Path(tmp)/'uart.log'
        command=[str(a.qemu),'-machine','esp32c3','-display','none','-serial','file:'+str(uart),'-monitor','none','-nic','none','-icount','3','-kernel',str(elf)]
        for _ in range(2):
            process=subprocess.Popen(command,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
            try:out,err=process.communicate(timeout=2)
            except subprocess.TimeoutExpired:
                process.terminate();out,err=process.communicate(timeout=5)
            out=uart.read_bytes()
            assert MESSAGE in out, (out,err)
            logs.append(out.decode(errors='replace'))
        assert logs[0]==logs[1],logs
    report={'schema':1,'target':'ESP32-C3','backend':version,'fixture':'RV32I direct-ELF UART0 FIFO write; not ESP-IDF flash boot','firmwareSha256':hashlib.sha256(data).hexdigest(),'qemuSha256':hashlib.sha256(a.qemu.read_bytes()).hexdigest(),'repeatIdentical':True,'uart':logs[0].splitlines(),'icount':3,'timing':'8 ns per emulated instruction; not silicon cycle timing','unsupportedOrUnvalidated':['Circuit Studio schematic pin coupling','GPIO matrix','ADC/DAC analog accuracy','Wi-Fi','Bluetooth','USB','ESP-IDF bootloader and flash image','interrupt/timer timing','power and reset electrical behavior'],'decision':'Direct-ELF firmware execution candidate only. Do not enable a supported schematic device profile.'}
    a.output.write_text(json.dumps(report,indent=2)+'\n');print('PASS ESP32-C3 exact machine direct-ELF boot/UART repeats:',a.output)
if __name__=='__main__':main()
