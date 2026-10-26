"""Versioned, checksummed offline application distribution."""
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess

ROOT=Path(__file__).resolve().parent


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def source_files(root=ROOT):
    manifest=root/'distribution.json'
    if manifest.exists():
        return json.loads(manifest.read_text())['files']
    result=subprocess.run(['git','ls-files','--cached','--others','--exclude-standard','-z'],cwd=root,capture_output=True,check=True).stdout
    files={}
    for raw in result.split(b'\0'):
        if not raw:continue
        name=os.fsdecode(raw);path=root/name
        if not path.is_file() or path.is_symlink():continue
        if name.startswith(('projects/','.test-output/','.github/')) or name=='distribution.json':continue
        files[name]={'sha256':digest(path),'mode':0o755 if path.stat().st_mode&stat.S_IXUSR else 0o644}
    return files


def verify(root,files):
    for name,record in files.items():
        path=root/name
        if Path(name).is_absolute() or '..' in Path(name).parts or path.is_symlink() or not path.resolve().is_relative_to(root.resolve()) or not path.is_file() or digest(path)!=record['sha256']:
            raise ValueError('Distribution verification failed: '+name)
