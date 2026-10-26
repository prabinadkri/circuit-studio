"""Bounded AVR C builds with source lines and global-symbol debug information."""
import os
import re
import shutil
import subprocess
import signal
import sys
import tempfile
from pathlib import Path

class CompilerBackend:
    def tools(self):
        prefix=os.environ.get('CIRCUIT_STUDIO_AVR_BIN')
        if not prefix:
            local=Path.home()/'.local/share/circuit-studio/toolchains/avr/usr/bin'
            prefix=str(local) if (local/'avr-gcc').is_file() else None
        names=['gcc','objcopy','objdump','nm']
        tools={n:str(Path(prefix)/('avr-'+n)) if prefix else shutil.which('avr-'+n) for n in names}
        return tools if all(p and Path(p).is_file() for p in tools.values()) else None
    def run(self,request):
        tools=self.tools()
        if request.get('action')=='status':return {'available':bool(tools),'target':'ATmega328P','language':'C','debug':'source lines and global/static RAM symbols'}
        if request.get('action')!='build':raise ValueError('Unknown compiler action')
        if not tools:raise ValueError('Install gcc-avr, avr-libc and binutils-avr to compile AVR C; HEX loading remains available')
        if request.get('device') not in ('avr','nano','atmega328p'):raise ValueError('Integrated C compiler/debugger currently supports ATmega328P profiles')
        source=request.get('source')
        if not isinstance(source,str) or not source.strip() or len(source)>64000:raise ValueError('C source must contain 1–64000 characters')
        # The build has no shell, user flags, plugins or build scripts. Restrict
        # preprocessor file reads to the toolchain's standard headers.
        clean=re.sub(r"/\*.*?\*/|//[^\n]*", " ", source, flags=re.S)
        for line in clean.splitlines():
            if re.match(r"\s*#",line) and not re.match(r"\s*#\s*(include|define|undef|if|ifdef|ifndef|elif|else|endif|error|warning)\b",line):raise ValueError("Unsupported preprocessor directive")
            if re.match(r'\s*#\s*(include|include_next|import|embed)\b',line):
                if not re.fullmatch(r'\s*#\s*include\s*<(?:avr/[a-z0-9_]+|util/[a-z0-9_]+|stdint|stdbool|stddef|stdlib|string|math|stdio|limits|inttypes)\.h>\s*',line):raise ValueError('Use an AVR or standard toolchain header; custom includes are not supported')
        if re.search(r'\b(?:asm|__asm|__asm__)\b',source) or re.search(r'\\\r?\n',source) or '\x00' in source:raise ValueError('Inline assembly and escaped physical lines are not supported by the integrated C editor')
        def run(args,cwd):
            # A fresh interpreter applies limits before exec; no preexec callback
            # is run inside the threaded HTTP server's forked process.
            limit_code=("import os,resource,sys;"
                        "resource.setrlimit(resource.RLIMIT_AS,(536870912,536870912));"
                        "resource.setrlimit(resource.RLIMIT_CPU,(20,20));"
                        "resource.setrlimit(resource.RLIMIT_FSIZE,(8388608,8388608));"
                        "resource.setrlimit(resource.RLIMIT_NOFILE,(64,64));"
                        "os.execv(sys.argv[1],sys.argv[1:])")
            with tempfile.TemporaryFile() as output:
                process=subprocess.Popen([sys.executable,'-c',limit_code,*args],cwd=cwd,
                    stdin=subprocess.DEVNULL,stdout=output,stderr=subprocess.STDOUT,
                    start_new_session=True,env={**os.environ,'LC_ALL':'C'})
                try:process.wait(timeout=20)
                except subprocess.TimeoutExpired as e:
                    os.killpg(process.pid,signal.SIGKILL);process.wait()
                    raise ValueError('Compiler exceeded the 20 second build limit') from e
                output.seek(0);data=output.read(2_000_001)
                if len(data)>2_000_000:raise ValueError('Compiler output exceeded 2 MB')
                return process.returncode,data.decode('utf-8','replace')
        with tempfile.TemporaryDirectory(prefix='circuit-build-') as tmp:
            root=Path(tmp);(root/'main.c').write_text(source)
            code,log=run([tools['gcc'],'-mmcu=atmega328p','-DF_CPU=16000000UL','-std=gnu11','-O0','-gdwarf-2','-Wall','-Wextra','-o','main.elf','main.c'],tmp)
            diagnostics=[]
            for line in log.splitlines():
                match=re.match(r'main.c:(\d+):(\d+):\s*(warning|error|fatal error|note):\s*(.*)',line)
                if match:diagnostics.append(dict(zip(('line','column','severity','message'),[int(match[1]),int(match[2]),match[3],match[4]])))
            if code:return {'ok':False,'log':log[-32000:],'diagnostics':diagnostics}
            code,detail=run([tools['objcopy'],'-O','ihex','-R','.eeprom','main.elf','main.hex'],tmp)
            if code:raise ValueError('HEX conversion failed: '+detail[-2000:])
            code,disassembly=run([tools['objdump'],'-d','-l','main.elf'],tmp)
            if code:raise ValueError('Debug disassembly failed')
            lines={};line_number=None
            for line in disassembly.splitlines():
                m=re.search(r'(?:^|/)main.c:(\d+)',line)
                if m:line_number=int(m[1]);continue
                m=re.match(r'\s*([0-9a-f]+):\s+(?:[0-9a-f]{2}\s)+',line)
                if m and line_number:lines[str(int(m[1],16)//2)]=line_number
                elif re.match(r'^[0-9a-f]+ <',line):line_number=None
            code,symbols=run([tools['nm'],'-S','--defined-only','main.elf'],tmp)
            if code:raise ValueError('Symbol extraction failed')
            variables=[]
            for line in symbols.splitlines():
                m=re.fullmatch(r'([0-9a-f]+) ([0-9a-f]+) ([bBdD]) ([A-Za-z_][A-Za-z0-9_]*)',line)
                if m:
                    address=int(m[1],16)-0x800000;size=int(m[2],16)
                    if 0x100<=address<0x900 and 1<=size<=64:variables.append({'name':m[4],'address':address,'size':size})
            return {'ok':True,'hex':(root/'main.hex').read_text(),'log':log[-32000:],'diagnostics':diagnostics,'debug':{'lines':lines,'variables':variables,'source':source,'device':request['device']}}
