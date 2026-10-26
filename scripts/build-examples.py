#!/usr/bin/env python3
"""Recompile the checked-in lab firmware with gputils and AVR-GCC.
Set GPASM, GPASM_INCLUDE, AVR_GCC or AVR_OBJCOPY for a local toolchain.
GPL-2.0-or-later.
"""
import os
from pathlib import Path
import subprocess
import tempfile
ROOT=Path(__file__).resolve().parents[1]
LAB=ROOT/'examples/lab'
with tempfile.TemporaryDirectory() as tmp:
    for src in sorted(LAB.iterdir()):
        target=Path(tmp)/src.stem
        if src.suffix=='.asm':
            args=[os.environ.get('GPASM','gpasm')]
            if os.environ.get('GPASM_INCLUDE'):args+=['-I',os.environ['GPASM_INCLUDE']]
            subprocess.run(args+['-o',str(target.with_suffix('.hex')),str(src)],check=True)
        elif src.suffix in ('.c','.S'):
            args=[os.environ.get('AVR_GCC','avr-gcc'),'-mmcu=atmega328p','-Os','-DF_CPU=16000000UL']
            if src.suffix=='.S':args+=['-nostdlib']
            subprocess.run(args+[str(src),'-o',str(target.with_suffix('.elf'))],check=True)
            subprocess.run([os.environ.get('AVR_OBJCOPY','avr-objcopy'),'-O','ihex','-R','.eeprom',str(target.with_suffix('.elf')),str(target.with_suffix('.hex'))],check=True)
        else:continue
        src.with_suffix('.hex').write_text(target.with_suffix('.hex').read_text())
with tempfile.TemporaryDirectory() as tmp:
    elf=Path(tmp)/'scheduler.elf'
    subprocess.run([os.environ.get('AVR_GCC','avr-gcc'),'-mmcu=atmega328p','-Os','-DF_CPU=16000000UL',str(ROOT/'spikes/pwm-adc.c'),'-o',str(elf)],check=True)
    subprocess.run([os.environ.get('AVR_OBJCOPY','avr-objcopy'),'-O','ihex','-R','.eeprom',str(elf),str(ROOT/'web/demos/scheduler-pwm-adc.hex')],check=True)
    generated=ROOT/'web/demos/scheduler-pwm-adc.hex'
    generated.write_text(generated.read_text())
print('Lab firmware rebuilt. Run npm run build to publish assets.')
