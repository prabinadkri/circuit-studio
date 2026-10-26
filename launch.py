#!/usr/bin/env python3
"""Run Circuit Studio locally. No external services or administrator access needed."""
import argparse
import json
import secrets
from pic_worker import PicSessions
from project_store import ProjectStore
from analysis_backend import AnalysisBackend
import functools
import http.server
import os
from pathlib import Path
import shutil
import subprocess
import sys
import threading

ROOT = Path(__file__).resolve().parent
class Handler(http.server.SimpleHTTPRequestHandler):
    def json_response(self, data, code=200):
        payload=json.dumps(data).encode()
        self.send_response(code)
        self.send_header('Content-Type','application/json')
        self.send_header('Content-Length',str(len(payload)))
        self.send_header('Cache-Control','no-store')
        self.end_headers()
        self.wfile.write(payload)
    def do_GET(self):
        if self.path=='/api/session':
            if self.headers.get('Host')!=self.server.local_host:
                return self.json_response({'error':'Invalid host'},403)
            return self.json_response({'token':self.server.cs_token,'apiVersion':2,'capabilities':['project-store','isolated-pic','ngspice-analysis']})
        super().do_GET()
    def do_POST(self):
        if self.path not in ('/api/pic','/api/projects','/api/analysis'): return self.json_response({'error':'Not found'},404)
        if self.headers.get('Host')!=self.server.local_host or self.headers.get('Origin')!='http://'+self.server.local_host or self.headers.get('X-Studio-Token')!=self.server.cs_token:
            return self.json_response({'error':'Invalid local session'},403)
        try:
            length=int(self.headers.get('Content-Length','0'))
            if not 0<length<=(10_000_000 if self.path=='/api/projects' else 120000): raise ValueError('Request too large or empty')
            request=json.loads(self.rfile.read(length))
            if not isinstance(request,dict): raise ValueError('Expected a JSON object')
            if self.path=='/api/projects':
                action=request.get('action')
                if action=='save': result=self.server.projects.save(request.get('project'))
                elif action=='list': result=self.server.projects.list()
                elif action=='load': result=self.server.projects.load(request.get('id'))
                else: raise ValueError('Unknown project action')
            elif self.path=='/api/analysis':
                if not self.server.analysis_lock.acquire(blocking=False):raise ValueError('An analysis is already running')
                try:result=AnalysisBackend().run(request)
                finally:self.server.analysis_lock.release()
            else:
                with self.server.pic_init_lock:
                    if self.server.pic is None: self.server.pic=PicSessions(ROOT)
                result=self.server.pic.handle(request)
        except (ValueError,TypeError,OSError) as exc:
            return self.json_response({'error':str(exc)},400)
        self.json_response(result)
    def log_message(self, fmt, *args):
        if str(args[1]) not in ('200', '304'):
            super().log_message(fmt, *args)
    def end_headers(self):
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        super().end_headers()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--serve', action='store_true', help='Serve only, without opening the desktop window')
    parser.add_argument('--port', type=int, default=18765)
    args = parser.parse_args()
    handler = functools.partial(Handler, directory=str(ROOT / 'web'))
    try:
        server = http.server.ThreadingHTTPServer(('127.0.0.1', args.port), handler)
    except OSError as exc:
        sys.exit(f'Cannot start on port {args.port}: {exc}. Close the existing Circuit Studio instance or use --port NUMBER.')
    server.cs_token=secrets.token_urlsafe(32)
    server.local_host=f'127.0.0.1:{server.server_port}'
    server.pic=None
    server.pic_init_lock=threading.Lock()
    server.analysis_lock=threading.Lock()
    server.projects=ProjectStore(Path(os.environ.get('CIRCUIT_STUDIO_PROJECTS',str(ROOT/'projects'))))
    url = f'http://127.0.0.1:{server.server_port}/'
    print(f'Circuit Studio: {url}', flush=True)
    if args.serve:
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
        finally:
            if server.pic: server.pic.close()
            server.server_close()
        return
    browser = next((shutil.which(x) for x in ['google-chrome', 'chromium', 'chromium-browser', 'microsoft-edge'] if shutil.which(x)), None)
    if not browser:
        server.server_close()
        sys.exit('Install Chrome or Chromium, or use ./run.sh --serve and open the printed URL in your browser.')
    state = Path(os.environ.get('XDG_DATA_HOME', str(Path.home() / '.local/share'))) / 'circuit-studio'
    state.mkdir(parents=True, exist_ok=True)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        with (state / 'browser.log').open('a') as log:
            subprocess.run([browser, f'--app={url}', f'--user-data-dir={state / "profile"}', '--class=CircuitStudio', '--no-first-run', '--no-default-browser-check', '--window-size=1440,940'], stdout=log, stderr=log, check=True)
    except subprocess.CalledProcessError:
        print(f'Browser could not start. See {state / "browser.log"}', file=sys.stderr)
    finally:
        server.shutdown()
        if server.pic: server.pic.close()
        server.server_close()
if __name__ == '__main__':
    main()
