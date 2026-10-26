#!/usr/bin/env python3
"""Create an offline source/runtime tarball with SHA-256 manifest; no downloads."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import sys
import tarfile
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from distribution import ROOT,source_files,digest


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--electron',type=Path,help='Existing Electron dist folder to bundle')
    args=parser.parse_args()
    if args.output.exists():raise ValueError('Output already exists')
    files=source_files();paths={name:ROOT/name for name in files}
    if args.electron:
        runtime=args.electron.resolve()
        if not all((runtime/n).is_file() for n in ('electron','LICENSE','LICENSES.chromium.html','version')):raise ValueError('Incomplete Electron distribution')
        for path in sorted(runtime.rglob('*')):
            if path.is_file() and not path.is_symlink():
                name='runtime/electron/'+str(path.relative_to(runtime));paths[name]=path;files[name]={'sha256':digest(path),'mode':0o755 if path.stat().st_mode&0o111 else 0o644}
    version=json.loads((ROOT/'package.json').read_text())['version']
    manifest=json.dumps({'schema':1,'version':version,'files':files},sort_keys=True,indent=2).encode()+b'\n'
    with tarfile.open(args.output,'w:gz') as archive:
        for name,path in sorted(paths.items()):
            info=tarfile.TarInfo('circuit-studio/'+name);info.size=path.stat().st_size;info.mode=files[name]['mode'];info.mtime=0
            with path.open('rb') as f:archive.addfile(info,f)
        info=tarfile.TarInfo('circuit-studio/distribution.json');info.size=len(manifest);info.mode=0o644;archive.addfile(info,io.BytesIO(manifest))
    checksum=digest(args.output);args.output.with_suffix(args.output.suffix+'.sha256').write_text(checksum+'  '+args.output.name+'\n')
    print(json.dumps({'archive':str(args.output),'sha256':checksum,'files':len(files),'version':version,'bundledRuntime':bool(args.electron)}))


if __name__=='__main__':main()
