#!/usr/bin/env python3
"""Fresh offline install, real bundled-engine/backend smoke, and retained-project uninstall."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import subprocess
import sys


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source',type=Path,required=True)
    parser.add_argument('--work',type=Path,required=True)
    parser.add_argument('--report',type=Path,required=True)
    args=parser.parse_args();root=args.source.resolve();work=args.work.resolve();work.mkdir(exist_ok=False)
    env={**os.environ,'XDG_DATA_HOME':str(work/'data')};env.pop('CHROME_BIN',None);env.pop('ELECTRON_RUN_AS_NODE',None)
    def run(*command,cwd=root):return subprocess.run(list(map(str,command)),cwd=cwd,env=env,capture_output=True,text=True,check=True,timeout=90)
    prefix=work/'app'
    installed=json.loads(run(sys.executable,root/'install.py','--prefix',prefix,'--bin-dir',work/'bin','--applications-dir',work/'applications').stdout)
    app=Path(installed['installed']);project=work/'data/circuit-studio/projects/release.circuit';project.parent.mkdir(parents=True)
    created=json.loads(run(sys.executable,app/'circuitctl.py','new','--project',project,'--plan',app/'examples/automation/voltage-divider.json').stdout)
    simulation=json.loads(run(sys.executable,app/'circuitctl.py','simulate','--project',project).stdout)
    resistor=next(e for e in simulation['components'] if e['reference']=='R2')
    assert abs(resistor['voltages'][0]-2.5)<1e-8 and abs(resistor['current']-.00025)<1e-10
    checks={}
    for name in ('test_pic.py','test_devices.py','test_analysis.py','test_workers_store.py','test_clock.py','test_compiler.py'):
        result=run(sys.executable,'-m','unittest','discover','-s','tests','-p',name,cwd=app)
        checks[name]=result.stderr.splitlines()[-4:]
    mcu_plan=work/'mcu-plan.json';mcu_plan.write_text(json.dumps({'version':1,'name':'MCU smoke','operations':[{'op':'mcu-package','device':'atmega328p','ref':'U1','x':160,'y':96}]}))
    mcu_file=project.parent/'mcu.circuit'
    mcu=json.loads(run(sys.executable,app/'circuitctl.py','new','--project',mcu_file,'--plan',mcu_plan).stdout)
    mcu_inspect=json.loads(run(sys.executable,app/'circuitctl.py','inspect','--project',mcu_file).stdout)
    chip=next(e for e in mcu_inspect['components'] if e['reference']=='U1');assert len(chip['pins'])==28 and chip['mcu']['device']=='atmega328p'
    hashes={name:hashlib.sha256((app/name).read_bytes()).hexdigest() for name in ['launch.py','circuitctl.py','install.py','web/asset-manifest.json']}
    payload=project.read_bytes();removed=json.loads(run(sys.executable,app/'install.py','--prefix',prefix,'--uninstall').stdout)
    assert removed['uninstalled'] and project.read_bytes()==payload and not (work/'bin/circuit-studio').exists() and not (prefix/'current').exists()
    report={'schema':1,'platform':platform.platform(),'runtime':installed['runtime'],'network':'Desktop renderer blocks all non-local network requests; tests use only bundled files/local backend','freshInstall':True,'configuredMCUPackagePins':len(chip['pins']),'dividerVolts':resistor['voltages'][0],'dividerAmps':resistor['current'],'backendChecks':checks,'uninstallRetainedProject':True,'criticalFileSha256':hashes}
    args.report.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))


if __name__=='__main__':main()
