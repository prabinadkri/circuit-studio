#!/usr/bin/env python3
"""Circuit Studio automation: JSON plans executed by the real, isolated editor engine."""
import argparse
import contextlib
import fcntl
import functools
import hashlib
import http.server
import json
import os
from pathlib import Path
import secrets
import signal
import shutil
import subprocess
import sys
import tempfile
import threading
import time

ROOT = Path(__file__).resolve().parent
LIMIT = 10_000_000


def revision(data):
    return hashlib.sha256(data).hexdigest()


def read_json(path):
    data = Path(path).read_bytes()
    if len(data) > LIMIT:
        raise ValueError('File exceeds 10 MB')
    return json.loads(data)


def atomic_write(path, data):
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as f:
            temporary = Path(f.name)
            f.write(data)
            f.flush()
            os.fsync(f.fileno())
        os.replace(temporary, path)
        fd = os.open(path.parent, os.O_RDONLY)
        try:
            os.fsync(fd)
        finally:
            os.close(fd)
    finally:
        if temporary and temporary.exists():
            temporary.unlink()


def run_engine(request, project=None, timeout=45):
    """No node/npm or network services: use the installed Chromium runtime."""
    bundled=ROOT/'runtime/electron/electron'
    browser = os.environ.get('CHROME_BIN') or (str(bundled) if bundled.is_file() else None) or next((shutil.which(x) for x in ('google-chrome', 'chromium', 'chromium-browser') if shutil.which(x)), None)
    if not browser:
        raise ValueError('Install Chrome/Chromium or set CHROME_BIN to its executable')
    done = threading.Event()
    token = secrets.token_urlsafe(32)
    result = {}

    class Handler(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def end_headers(self):
            self.send_header('Referrer-Policy', 'no-referrer')
            self.send_header('X-Content-Type-Options', 'nosniff')
            super().end_headers()

        def answer(self, value, status=200):
            payload = json.dumps(value).encode()
            self.send_response(status)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(payload)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(payload)

        def do_GET(self):
            if self.headers.get('Host') != host:
                return self.answer({'error': 'Invalid host'}, 403)
            if self.path == '/automation-job':
                # Only the secret URL receives the project payload; no external page can read it.
                return self.answer({'error': 'Not found'}, 404)
            if self.path == '/automation-job?' + token:
                return self.answer({'request': request, 'project': project})
            if self.path == '/automation-driver?' + token:
                code = '''<!doctype html><meta charset="utf-8"><iframe id="editor" src="/" style="width:1440px;height:960px;border:0"></iframe><script type="module">
const token=location.search.slice(1),frame=document.getElementById('editor');
try {
 const job=await(await fetch('/automation-job?'+token)).json();
 const start=Date.now();while(!frame.contentWindow.studioAutomation){if(Date.now()-start>20000)throw Error('Editor startup timed out');await new Promise(r=>setTimeout(r,25));}
 const w=frame.contentWindow;
 if(job.project)w.studioProject.load(w.studioProject.validate(job.project));
 const result=await w.studioAutomation.execute(job.request);
 await fetch('/automation-result',{method:'POST',headers:{'Content-Type':'application/json','X-Automation-Token':token},body:JSON.stringify({result})});
} catch(e) {await fetch('/automation-result',{method:'POST',headers:{'Content-Type':'application/json','X-Automation-Token':token},body:JSON.stringify({error:e.message})});}
</script>'''.encode()
                self.send_response(200)
                self.send_header('Content-Type', 'text/html; charset=utf-8')
                self.send_header('Content-Length', str(len(code)))
                self.end_headers()
                self.wfile.write(code)
                return
            return super().do_GET()

        def do_POST(self):
            if self.path != '/automation-result' or self.headers.get('Host') != host or self.headers.get('Origin') != 'http://' + host or self.headers.get('X-Automation-Token') != token:
                return self.answer({'error': 'Invalid automation session'}, 403)
            try:
                length = int(self.headers.get('Content-Length', '0'))
                if not 0 < length <= 40_000_000:
                    raise ValueError('Invalid result length')
                value = json.loads(self.rfile.read(length))
                if not isinstance(value, dict) or not ('result' in value or 'error' in value):
                    raise ValueError('Invalid result')
                result.update(value)
                self.answer({'ok': True})
                done.set()
            except (ValueError, TypeError) as error:
                self.answer({'error': str(error)}, 400)

    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(ROOT / 'web')))
    server.daemon_threads = True
    host = f'127.0.0.1:{server.server_port}'
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        with tempfile.TemporaryDirectory(prefix='circuitctl-') as profile:
            with open(Path(profile) / 'browser.log', 'w+') as log:
                command = [browser, '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-component-update', '--disable-sync', '--disable-extensions', '--disable-dev-shm-usage', '--window-size=1460,1000', '--user-data-dir=' + profile, 'http://' + host + '/automation-driver?' + token]
                if Path(browser)==bundled:
                    command=[browser,str(ROOT/'runtime/desktop.cjs'),'--headless','--disable-gpu','--disable-dev-shm-usage']
                env={**os.environ,'STUDIO_URL':'http://'+host+'/automation-driver?'+token,'STUDIO_PROFILE':profile,'STUDIO_HEADLESS':'1'}
                proc = subprocess.Popen(command, stdout=log, stderr=log, start_new_session=True,env=env)
                try:
                    deadline = time.monotonic() + timeout
                    while not done.wait(.1):
                        if proc.poll() is not None:
                            raise ValueError('Chromium exited before the editor was ready')
                        if time.monotonic() >= deadline:
                            raise ValueError('Circuit operation timed out; original file is unchanged')
                finally:
                    with contextlib.suppress(ProcessLookupError):
                        os.killpg(proc.pid, signal.SIGTERM)
                    try:
                        proc.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        proc.kill()
                        proc.wait()
                    with contextlib.suppress(ProcessLookupError):
                        os.killpg(proc.pid, signal.SIGKILL)
                    time.sleep(.1)
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)
    if 'error' in result:
        raise ValueError(result['error'])
    return result['result']


def execute(action, path=None, plan=None, expected=None, steps=1000, time_step=5e-6):
    request = {'version': 1, 'action': action}
    if action in ('new', 'apply'):
        if not isinstance(plan, dict) or plan.get('version') != 1:
            raise ValueError('Plan must be an object with version: 1')
        request.update({k: plan[k] for k in ('name', 'operations') if k in plan})
    if action == 'simulate':
        request.update(steps=steps, timeStep=time_step)
    if action == 'catalog':
        return run_engine(request)
    if path is None:
        raise ValueError('--project is required')
    path = Path(path).absolute()
    if path.is_symlink() or path.suffix != '.circuit':
        raise ValueError('Project must be a regular .circuit file, not a symlink')
    mutation = action in ('new', 'apply')
    with contextlib.ExitStack() as stack:
        if mutation:
            lock = stack.enter_context(open(os.open(path.with_name('.' + path.name + '.lock'), os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600), 'a'))
            fcntl.flock(lock, fcntl.LOCK_EX)
        if action == 'new':
            if path.exists():
                raise ValueError('Project already exists; use apply with its expected revision')
            original = None
        else:
            original = path.read_bytes()
            if len(original) > LIMIT:
                raise ValueError('Project exceeds 10 MB')
            if action == 'apply' and (not expected or expected != revision(original)):
                raise ValueError('Revision conflict: inspect the current project and use its revision')
        result = run_engine(request, json.loads(original) if original else None)
        if mutation:
            latest = path.read_bytes() if path.exists() else None
            if path.is_symlink() or latest != original:
                raise ValueError('Project changed during the operation; no result was written')
            payload = (json.dumps(result['project'], indent=2, allow_nan=False) + '\n').encode()
            if len(payload) > LIMIT:
                raise ValueError('Generated project exceeds 10 MB')
            if original is not None:
                atomic_write(path.with_suffix('.circuit.previous'), original)
            atomic_write(path, payload)
            result['revision'] = revision(payload)
        else:
            result['revision'] = revision(original)
        result['file'] = str(path)
        result.pop('project', None)
        return result


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=('catalog', 'new', 'apply', 'inspect', 'check', 'simulate', 'svg', 'kicad'))
    parser.add_argument('--project', type=Path, help='Portable .circuit project file')
    parser.add_argument('--plan', type=Path, help='Version 1 JSON edit plan')
    parser.add_argument('--expected-revision', help='SHA-256 revision returned by inspect; required for apply')
    parser.add_argument('--output', type=Path, help='Write an SVG or KiCad artifact (refuses existing files)')
    parser.add_argument('--steps', type=int, default=1000)
    parser.add_argument('--time-step', type=float, default=5e-6)
    args = parser.parse_args(argv)
    try:
        if args.output and args.action not in ('svg', 'kicad'):
            raise ValueError('--output is only supported for svg and kicad')
        result = execute(args.action, args.project, read_json(args.plan) if args.plan else None, args.expected_revision, args.steps, args.time_step)
        if args.output:
            with args.output.open('x') as f:
                f.write(result.pop(args.action))
            result['output'] = str(args.output.absolute())
        print(json.dumps(result, indent=2, allow_nan=False))
        return 1 if args.action == 'check' and (any(f['severity'] == 'error' for f in result['erc']) or result['drc']) else 0
    except (OSError, ValueError, TypeError, KeyError) as error:
        print(json.dumps({'error': str(error)}), file=sys.stderr)
        return 2


if __name__ == '__main__':
    sys.exit(main())
