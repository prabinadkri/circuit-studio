"""Restricted ngspice analysis spike. No user control blocks, scripts or includes."""
import math, os, re, shutil, subprocess, tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parent
NAME=r'[A-Za-z_][A-Za-z0-9_]{0,31}'
NODE=r'(?:0|[A-Za-z_][A-Za-z0-9_]{0,31})'
NUM=r'[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?(?:[pnumkgt]|meg)?'
def number(value,low,high):
    if isinstance(value,bool):raise ValueError('Invalid analysis number')
    n=float(value)
    if not math.isfinite(n) or not low<=n<=high:raise ValueError('Analysis number outside supported range')
    return n
def validate_circuit(text):
    if not isinstance(text,str) or len(text)>32000:raise ValueError('Circuit exceeds 32 KB')
    lines=[];names=set();nodes=set();models=set();uses=[]
    for raw in text.splitlines():
        line=raw.strip()
        if not line or line.startswith('*'):continue
        m=re.fullmatch(r'\.model\s+('+NAME+r')\s+(D|NPN|PNP)\s*\(([^()]*)\)',line,re.I)
        if m:
            name,kind,params=m.groups();allowed={'D':{'is','n','rs','cjo','tt','bv','ibv'},'NPN':{'is','bf','br','vaf','var','nf','nr'},'PNP':{'is','bf','br','vaf','var','nf','nr'}}[kind.upper()]
            pairs=params.split()
            if not pairs or name.lower() in models:raise ValueError('Empty or duplicate model')
            for pair in pairs:
                kv=pair.split('=')
                if len(kv)!=2 or kv[0].lower() not in allowed or not re.fullmatch(NUM,kv[1],re.I):raise ValueError('Unsupported model parameter: '+pair)
            models.add(name.lower());lines.append(line);continue
        if line.startswith('.'):raise ValueError('Unsupported model syntax/directive: '+line.split()[0])
        tokens=line.split();kind=line[0].upper();count=3 if kind=='Q' else 2
        if kind not in 'RCLVDQ' or len(tokens)<count+2 or not re.fullmatch(NAME,tokens[0]):raise ValueError('Unsupported component syntax')
        if tokens[0].lower() in names:raise ValueError('Duplicate component name')
        names.add(tokens[0].lower());ns=tokens[1:count+1]
        if not all(re.fullmatch(NODE,n) for n in ns):raise ValueError('Invalid node name')
        nodes.update(ns);tail=' '.join(tokens[count+1:])
        if kind in 'DQ':
            if not re.fullmatch(NAME,tail):raise ValueError('Unsupported model reference')
            uses.append(tail.lower())
        elif kind=='V':
            plain=re.fullmatch(r'(?:DC\s+)?'+NUM+r'(?:\s+AC\s+'+NUM+r')?',tail,re.I)
            pulse=re.fullmatch(r'PULSE\(\s*('+NUM+r'(?:\s+'+NUM+r'){6})\s*\)',tail,re.I)
            if not plain and not pulse:raise ValueError('Unsupported voltage source syntax')
        elif not re.fullmatch(NUM,tail,re.I):raise ValueError('Unsupported passive value')
        lines.append(line)
    if not lines or len(names)>200 or len(models)>30 or '0' not in nodes:raise ValueError('Use 1–200 components and node 0 ground')
    if any(m not in models for m in uses):raise ValueError('Missing local model declaration')
    return lines,nodes,names
class AnalysisBackend:
    def __init__(self,executable=None):self.executable=executable or os.environ.get('NGSPICE') or shutil.which('ngspice') or str(ROOT/'native/ngspice')
    def run(self,request):
        lines,nodes,names=validate_circuit(request.get('circuit'))
        probes=request.get('probes',['out'])
        if not isinstance(probes,list) or not 1<=len(probes)<=8 or any(p not in nodes or p=='0' for p in probes):raise ValueError('Choose 1–8 existing non-ground nodes')
        mode=request.get('mode');cfg=request.get('settings',{})
        if mode=='dc':
            source=cfg.get('source','V1')
            if not isinstance(source,str) or source.lower() not in names or not source.upper().startswith('V'):raise ValueError('Unknown sweep voltage source')
            start=number(cfg.get('start'),-1000,1000);stop=number(cfg.get('stop'),-1000,1000);step=number(cfg.get('step'),1e-9,1000)
            if stop<=start or (stop-start)/step>10000:raise ValueError('DC sweep must contain 2–10001 points')
            command=f'dc {source} {start} {stop} {step}'
        elif mode=='tran':
            step=number(cfg.get('step'),1e-9,1);stop=number(cfg.get('stop'),1e-9,10)
            if stop<step or stop/step>10000:raise ValueError('Transient requires at most 10000 requested steps')
            command=f'tran {step} {stop} 0 {step}'
        elif mode=='ac':
            start=number(cfg.get('start'),1e-3,1e12);stop=number(cfg.get('stop'),1e-3,1e12);points=number(cfg.get('points',20),1,100)
            if stop<=start or not points.is_integer():raise ValueError('Invalid AC sweep range')
            command=f'ac dec {int(points)} {start} {stop}'
        else:raise ValueError('Choose dc, ac or tran analysis')
        deck='Circuit Studio restricted analysis\n'+'\n'.join(lines)+'\n.control\nset noaskquit\nset wr_singlescale\nset wr_vecnames\n'+command+'\nwrdata result.dat '+' '.join('v('+p+')' for p in probes)+'\nquit\n.endc\n.end\n'
        with tempfile.TemporaryDirectory(prefix='circuit-analysis-') as tmp:
            path=Path(tmp);(path/'input.cir').write_text(deck)
            try:
                # Output goes to a bounded-lifetime temporary file, not an unbounded PIPE.
                with (path/'log').open('w') as log:
                    run=subprocess.run([self.executable,'-n','-b','input.cir'],cwd=tmp,stdout=log,stderr=subprocess.STDOUT,timeout=15,env={**os.environ,'HOME':tmp,'SPICE_USERINIT_DIR':tmp})
            except FileNotFoundError:raise ValueError('ngspice unavailable. Install ngspice or set NGSPICE to its executable.')
            except subprocess.TimeoutExpired:raise ValueError('Analysis exceeded 15 seconds')
            result=path/'result.dat'
            if run.returncode or not result.exists():raise ValueError('ngspice could not solve this circuit: '+(path/'log').read_text()[-2000:])
            if result.stat().st_size>8_000_000:raise ValueError('Analysis output exceeds 8 MB')
            content=result.read_text().splitlines();columns=content[0].split();rows=[[float(v) for v in line.split()] for line in content[1:] if line.strip()]
            if len(rows)>20000 or not rows or any(len(r)!=len(columns) or not all(math.isfinite(v) for v in r) for r in rows):raise ValueError('Invalid or excessive analysis output')
            return {'backend':'ngspice','mode':mode,'columns':columns,'rows':rows,'circuit':request['circuit'],'settings':cfg,'probes':probes}
