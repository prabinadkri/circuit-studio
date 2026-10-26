"""Atomic project-file storage with an independently valid previous revision."""
import json, os, re, tempfile
from pathlib import Path
import threading
class ProjectStore:
    def __init__(self, root): self.root=Path(root); self.lock=threading.Lock()
    def path(self, key):
        if not isinstance(key,str) or not re.fullmatch(r'[0-9a-f-]{36}',key): raise ValueError('Invalid project ID')
        return self.root/(key+'.circuit')
    def save(self, project):
        if not isinstance(project,dict) or project.get('format')!='circuit-studio' or project.get('version')!=2: raise ValueError('Expected a version 2 project')
        path=self.path(project.get('id')); payload=json.dumps(project).encode()
        if len(payload)>10_000_000: raise ValueError('Project exceeds 10 MB')
        with self.lock:
            self.root.mkdir(parents=True,exist_ok=True)
            temp=None
            try:
                with tempfile.NamedTemporaryFile(dir=self.root,delete=False) as f:
                    temp=Path(f.name); f.write(payload); f.flush(); os.fsync(f.fileno())
                if path.exists():
                    try: json.loads(path.read_text()); valid=True
                    except (OSError,ValueError): valid=False
                    if valid:
                        backup=path.with_suffix('.previous'); os.replace(path,backup)
                os.replace(temp,path)
                fd=os.open(self.root,os.O_RDONLY)
                try: os.fsync(fd)
                finally: os.close(fd)
            finally:
                if temp and temp.exists(): temp.unlink()
        return {'id':project['id'],'name':project.get('name','Untitled'),'saved':True}
    def load(self,key):
        path=self.path(key)
        with self.lock:
            for p in [path,path.with_suffix('.previous')]:
                try:return json.loads(p.read_text())
                except (OSError,ValueError):pass
        raise ValueError('Project not found or unreadable')
    def list(self):
        if not self.root.exists():return []
        result=[]
        for key in {p.stem for ext in ['*.circuit','*.previous'] for p in self.root.glob(ext)}:
            try:
                data=self.load(key);p=self.path(key)
                if not p.exists():p=p.with_suffix('.previous')
                result.append({'id':data['id'],'name':data.get('name','Untitled'),'modified':p.stat().st_mtime})
            except (OSError,ValueError,KeyError):pass
        return sorted(result,key=lambda p:p['modified'],reverse=True)
