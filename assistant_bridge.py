"""Local, explicit handoff to Coding Hub. No model calls or embedded credentials."""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import threading
import uuid


class AssistantBridge:
    def __init__(self, studio, root, initial=None):
        self.studio, self.root = Path(studio), Path(root)
        self.initial = initial
        self.lock = threading.Lock()

    def path(self, key):
        if not isinstance(key, str) or not re.fullmatch(r'[0-9a-f]{32}', key):
            raise ValueError('Invalid assistant workspace')
        path = self.root / key
        if path.is_symlink() or not path.resolve().is_relative_to(self.root.resolve()):
            raise ValueError('Workspace is outside the assistant folder')
        return path

    def read(self, key):
        path = self.path(key) / 'design.circuit'
        if path.is_symlink() or not path.is_file() or path.stat().st_size > 10_000_000:
            raise ValueError('The assistant result is missing, unsafe or larger than 10 MB')
        raw = path.read_bytes()
        value = json.loads(raw)
        self.validate(value)
        return {'project': value, 'revision': hashlib.sha256(raw).hexdigest()}

    @staticmethod
    def validate(project):
        if not isinstance(project, dict) or project.get('format') != 'circuit-studio' or project.get('version') != 2 or not isinstance(project.get('schematic'), str):
            raise ValueError('Expected a Circuit Studio v2 project')

    def hub(self, workspace, open_browser):
        executable = shutil.which('codehub')
        if not executable:
            candidate = Path.home() / '.local/bin/codehub'
            if candidate.is_file(): executable = str(candidate)
        if not executable:
            raise ValueError('Coding Hub is not installed. Install it to use the circuit assistant.')
        args = [executable, 'circuit', 'workspace', '--project', str(workspace), '--studio', str(self.studio)]
        if open_browser: args.append('--open')
        try:
            result = subprocess.run(args, capture_output=True, text=True, timeout=30, check=False)
        except subprocess.TimeoutExpired:
            raise ValueError('Coding Hub took too long to open. Use Open Coding Hub to retry.') from None
        if result.returncode:
            # Do not pass arbitrary subprocess logs/session URLs to the renderer.
            raise ValueError('Coding Hub could not open the circuit workspace. Update/restart Coding Hub, then try again.')

    def handle(self, request):
        with self.lock:
            action = request.get('action')
            if action == 'initial': return {'project': self.initial}
            if action == 'prepare':
                project = request.get('project')
                self.validate(project)
                raw = (json.dumps(project, indent=2) + '\n').encode()
                if len(raw) > 10_000_000: raise ValueError('Project exceeds 10 MB')
                key = uuid.uuid4().hex
                workspace = self.path(key)
                workspace.mkdir(parents=True, mode=0o700)
                path = workspace / 'design.circuit'
                with path.open('xb') as f:
                    f.write(raw); f.flush(); os.fsync(f.fileno())
                self.hub(workspace, False)
                return {'workspace': key, 'revision': hashlib.sha256(raw).hexdigest()}
            key = request.get('workspace')
            if action == 'open':
                self.read(key)
                self.hub(self.path(key), True)
                return {'opened': True}
            if action == 'result': return self.read(key)
            raise ValueError('Unknown assistant action')
