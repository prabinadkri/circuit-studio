#!/usr/bin/env python3
"""Register this folder in the Linux applications menu. No administrator access."""
from pathlib import Path
import os
root=Path(__file__).resolve().parent
target=Path(os.environ.get('XDG_DATA_HOME',str(Path.home()/'.local/share')))/'applications'
target.mkdir(parents=True,exist_ok=True)
def quoted(s):return '"'+str(s).replace('\\','\\\\').replace('"','\\"').replace('`','\\`').replace('$','\\$')+'"'
entry=target/'circuit-studio.desktop'
entry.write_text('[Desktop Entry]\nType=Application\nName=Circuit Studio\nComment=Integrated circuit, firmware and PCB workbench\nExec='+quoted(root/'run.sh')+'\nIcon='+str(root/'web/icon.svg')+'\nTerminal=false\nCategories=Education;Electronics;Engineering;\nStartupWMClass=CircuitStudio\n')
print('Installed applications-menu shortcut:',entry)
