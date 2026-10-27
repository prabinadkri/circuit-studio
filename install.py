#!/usr/bin/env python3
"""Install/uninstall Circuit Studio for this Linux user; never remove user projects."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shlex
import shutil
import tempfile
from distribution import ROOT,source_files,verify,digest
from circuitctl import atomic_write


def desktop_quote(path):return '"'+str(path).replace('\\','\\\\').replace('"','\\"').replace('`','\\`').replace('$','\\$').replace('%','%%')+'"'


def legacy_shortcut(path):
    try:
        text=path.read_text()
        if 'Name=Circuit Studio\n' not in text:return False
        line=next(line[5:] for line in text.splitlines() if line.startswith('Exec='))
        command=shlex.split(line)
        if len(command)!=1 or Path(command[0]).name!='run.sh':return False
        package=Path(command[0]).parent/'package.json'
        return json.loads(package.read_text()).get('name')=='circuit-studio'
    except (ValueError,OSError,StopIteration):return False


def install(prefix,bin_dir,applications):
    files=source_files();verify(ROOT,files)
    identity=hashlib.sha256(json.dumps(files,sort_keys=True).encode()).hexdigest()[:16]
    release=prefix/'releases'/identity
    metadata=prefix/'installation.json'
    old=json.loads(metadata.read_text()) if metadata.exists() else {'application':'circuit-studio','releases':{}}
    if old.get('application')!='circuit-studio':raise ValueError('Prefix belongs to another application')
    prefix.mkdir(parents=True,exist_ok=True);release.parent.mkdir(exist_ok=True)
    if not release.exists():
        staging=Path(tempfile.mkdtemp(prefix='.install-',dir=release.parent))
        try:
            for name,record in files.items():
                target=staging/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/name,target);target.chmod(record['mode'])
            (staging/'distribution.json').write_text(json.dumps({'schema':1,'version':json.loads((ROOT/'package.json').read_text())['version'],'files':files}))
            verify(staging,files);os.replace(staging,release)
        finally:
            if staging.exists():shutil.rmtree(staging)
    else:verify(release,files)
    current=prefix/'current'
    bin_dir.mkdir(parents=True,exist_ok=True);applications.mkdir(parents=True,exist_ok=True)
    launcher=bin_dir/'circuit-studio';desktop=applications/'circuit-studio.desktop'
    script=('#!/bin/sh\nexec '+shlex.quote(str(current/'run.sh'))+' "$@"\n').encode()
    # Immutable paths prevent shells reusing an old icon cached through current/.
    icon=release/('web/icon.png' if (release/'web/icon.png').is_file() else 'web/icon.svg')
    wm_class='Circuit Studio' if (release/'runtime/electron/electron').is_file() else 'CircuitStudio'
    entry=('[Desktop Entry]\nType=Application\nName=Circuit Studio\nComment=Circuit design, firmware and PCB workbench\nExec='+desktop_quote(launcher)+'\nIcon='+str(icon)+'\nTerminal=false\nCategories=Education;Electronics;Engineering;\nStartupWMClass='+wm_class+'\n').encode()
    for path,payload in [(launcher,script),(desktop,entry)]:
        if path.exists() and str(path) not in old.get('shortcuts',{}) and path.read_bytes()!=payload and not (path==desktop and legacy_shortcut(path)):raise ValueError('Existing shortcut belongs to another installation: '+str(path))
    current=prefix/'current'
    if current.exists() and not current.is_symlink():raise ValueError('Refusing to replace non-symlink current path')
    temporary=prefix/('.current-'+identity)
    temporary.unlink(missing_ok=True);temporary.symlink_to(release.relative_to(prefix));os.replace(temporary,current)
    atomic_write(launcher,script);launcher.chmod(0o755);atomic_write(desktop,entry)
    old['releases'][identity]=files;old['current']=identity;old['shortcuts']={str(p):digest(p) for p in (launcher,desktop)}
    atomic_write(metadata,(json.dumps(old,sort_keys=True)+'\n').encode())
    return {'installed':str(release),'launcher':str(launcher),'projects':str(Path(os.environ.get('XDG_DATA_HOME',str(Path.home()/'.local/share')))/'circuit-studio/projects'),'runtime':'bundled Electron' if (release/'runtime/electron/electron').exists() else 'system Chrome/Chromium'}


def uninstall(prefix):
    metadata=prefix/'installation.json';record=json.loads(metadata.read_text())
    if record.get('application')!='circuit-studio':raise ValueError('Not a Circuit Studio installation')
    preserved=[]
    for name,checksum in record['shortcuts'].items():
        path=Path(name)
        if path.is_file() and not path.is_symlink() and digest(path)==checksum:path.unlink()
        elif path.exists():preserved.append(str(path))
    current=prefix/'current'
    if current.is_symlink() and current.resolve().parent==(prefix/'releases').resolve():current.unlink()
    for identity,files in record['releases'].items():
        if not identity.isalnum() or len(identity)!=16:raise ValueError('Invalid installation identity')
        release=prefix/'releases'/identity
        if release.is_symlink():preserved.append(str(release));continue
        for name,info in files.items():
            path=release/name
            if Path(name).is_absolute() or '..' in Path(name).parts:raise ValueError('Invalid installed file path')
            if path.is_file() and not path.is_symlink() and path.resolve().is_relative_to(release.resolve()) and digest(path)==info['sha256']:path.unlink()
            elif path.exists():preserved.append(str(path))
        (release/'distribution.json').unlink(missing_ok=True)
        for directory in sorted(release.rglob('*'),key=lambda p:len(p.parts),reverse=True):
            if directory.is_dir() and not directory.is_symlink():
                try:directory.rmdir()
                except OSError:pass
        try:release.rmdir()
        except OSError:pass
    metadata.unlink()
    try:(prefix/'releases').rmdir()
    except OSError:pass
    return {'uninstalled':True,'preservedModifiedFiles':preserved,'projects':'User projects and browser profiles are retained'}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--prefix',type=Path,default=Path(os.environ.get('XDG_DATA_HOME',str(Path.home()/'.local/share')))/'circuit-studio')
    parser.add_argument('--bin-dir',type=Path,default=Path.home()/'.local/bin')
    parser.add_argument('--applications-dir',type=Path,default=Path(os.environ.get('XDG_DATA_HOME',str(Path.home()/'.local/share')))/'applications')
    parser.add_argument('--uninstall',action='store_true')
    args=parser.parse_args()
    try:print(json.dumps(uninstall(args.prefix.absolute()) if args.uninstall else install(args.prefix.absolute(),args.bin_dir.absolute(),args.applications_dir.absolute()),indent=2))
    except (ValueError,OSError,KeyError) as error:parser.exit(2,str(error)+'\n')


if __name__=='__main__':main()
