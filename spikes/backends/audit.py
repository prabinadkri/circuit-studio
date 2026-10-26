#!/usr/bin/env python3
"""Run separately installed backend feasibility probes; does not enable Studio targets."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import tempfile

ROOT=Path(__file__).resolve().parent


def run(args,**kwargs):
    return subprocess.run(list(map(str,args)),capture_output=True,text=True,check=True,timeout=60,**kwargs).stdout


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--avr-gcc',type=Path,required=True)
    parser.add_argument('--sysroot',type=Path,required=True)
    parser.add_argument('--renode',type=Path,required=True)
    parser.add_argument('--stm32-elf',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args();result={'schema':1,'classification':'feasibility only; no new editor device support','avr':[]}
    with tempfile.TemporaryDirectory(prefix='circuit-backend-audit-') as directory:
        work=Path(directory)
        binary=work/'simavr-audit'
        run(['gcc','-O2','-I'+str(args.sysroot/'usr/include'),ROOT/'simavr-audit.c',args.sysroot/'usr/lib/x86_64-linux-gnu/libsimavr.a','-l:libelf.so.1','-lm','-o',binary])
        for target in ('atmega32','atmega2560'):
            elf=work/(target+'.elf');run([args.avr_gcc,'-mmcu='+target,'-Os','-g','-o',elf,ROOT/'gpio-timing.S'])
            a=json.loads(run([binary,target,elf]).splitlines()[-1]);b=json.loads(run([binary,target,elf]).splitlines()[-1]);assert a==b
            result['avr'].append({**a,'repeatIdentical':True,'firmwareSha256':hashlib.sha256(elf.read_bytes()).hexdigest()})
        data=bytes.fromhex('7590feb29080fc');record=bytes([len(data),0,0,0])+data
        hexfile=work/'8052.hex';hexfile.write_text(':'+record.hex().upper()+f'{(-sum(record))&255:02X}'+'\n:00000001FF\n')
        commands='step 1\ndump sfr 0x90 0x90\n'+('step 2\ndump sfr 0x90 0x90\n'*10000)+'quit\n'
        log=run([args.sysroot/'usr/bin/s51','-t','C52','-X','12M','-R','1','-q','-c','-',hexfile],input=commands)
        values=re.findall(r'0x90 P1:.*?0x([0-9a-f]+)',log,re.M);ticks=re.findall(r'stepped (\d+) ticks',log)
        assert len(values)==10001 and all(int(v,16)==(254 if i%2==0 else 255) for i,v in enumerate(values))
        assert ticks==['24']+['36']*10000
        targets=run([args.sysroot/'usr/bin/s51','-H'])
        assert 'AT89S52' not in targets.upper()
        result['8052']={'backend':'uCsim 0.6.4 / SDCC 4.2.0 C52','genericCoreOnly':True,'exactAT89S52Model':False,'oscillatorHz':12000000,'testedEdges':10000,'oscillatorTicksPerEdge':36,'secondsPerEdge':3e-6,'port':'P1.0','decision':'Do not advertise AT89S52; S52 ISP/watchdog/fuses are unvalidated and no exact target is listed.'}
        elf=args.stm32_elf.resolve();sha1=hashlib.sha1(elf.read_bytes()).hexdigest();assert sha1=='2180a4018e82fcbc8821ef4330c9b5f3caf2dcdb'
        renode=args.renode.resolve();base=renode.parent/'platforms/boards/stm32f4_discovery.repl'
        platform=work/'stm32f407.repl';platform.write_text('using '+json.dumps(str(base))+'\nsram:\n    size: 0x20000\nflash:\n    size: 0x100000\nccm: Memory.MappedMemory @ sysbus 0x10000000\n    size: 0x10000\n')
        uart=work/'uart.log';script=work/'boot.resc';script.write_text('mach create "CircuitStudio-STM32F407VG-audit"\nmachine LoadPlatformDescription @'+str(platform)+'\nsysbus LoadELF @'+str(elf)+'\nsysbus.usart2 CreateFileBackend @'+str(uart)+'\nemulation RunFor "0.5"\nquit\n')
        output=run([renode,'--disable-gui','--console','--plain',script]);text=uart.read_text();assert 'Booting Zephyr OS' in text and 'Hello World! stm32f4_disco' in text
        result['stm32']={'backend':'Renode 1.17.0','target':'STM32F407VG Discovery (selected feasibility board)','flashBytes':1048576,'sramBytes':131072,'ccmBytes':65536,'firmwareSha1':sha1,'simulatedSeconds':.5,'uart':text.splitlines(),'warnings':[line.split('[WARNING]')[-1].strip() for line in output.splitlines() if '[WARNING]' in line],'decision':'Boot/UART feasibility only; no analog accuracy, radio, USB, pin package, mixed-signal timing or debugger claim.'}
    args.output.write_text(json.dumps(result,indent=2)+'\n');print('PASS exact AVR cycle/GPIO repeats, generic 8052 timing, selected STM32 boot/UART; report:',args.output)


if __name__=='__main__':main()
