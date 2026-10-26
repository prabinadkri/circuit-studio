"""Crash-isolated native simulator sessions. No native library is loaded in HTTP threads."""
import multiprocessing as mp
import threading
from pic_backend import PicBackend

def serve(connection, root):
    backend = PicBackend(root)
    try:
        while True:
            request = connection.recv()
            if request is None: break
            try: connection.send({'result': backend.handle(request)})
            except (ValueError, TypeError, OSError) as exc: connection.send({'error': str(exc)})
    except (EOFError, BrokenPipeError): pass
    finally: connection.close()

class PicWorker:
    def __init__(self, root, timeout=5):
        self.root, self.timeout = str(root), timeout
        self.lock = threading.Lock()
        self.process = self.connection = None
    def start(self):
        context = mp.get_context('spawn')
        parent, child = context.Pipe()
        process = context.Process(target=serve, args=(child, self.root), daemon=True)
        process.start(); child.close()
        self.process, self.connection = process, parent
    def close(self):
        if self.connection:
            self.connection.close(); self.connection = None
        if self.process:
            if self.process.is_alive(): self.process.terminate()
            self.process.join(timeout=1)
            if self.process.is_alive(): self.process.kill(); self.process.join(timeout=1)
            self.process = None
    def handle(self, request):
        with self.lock:
            if not self.process or not self.process.is_alive():
                self.close()
                if request.get('action') != 'load': raise ValueError('Simulator worker stopped. Reload firmware; the project is unchanged.')
                self.start()
            try:
                self.connection.send(request)
                if not self.connection.poll(self.timeout):
                    self.close(); raise ValueError('Simulator timed out. Reload firmware to restart it.')
                response = self.connection.recv()
            except (EOFError, BrokenPipeError, OSError):
                self.close(); raise ValueError('Simulator worker stopped. Reload firmware; the project is unchanged.')
            if 'error' in response: raise ValueError(response['error'])
            return response['result']

class PicSessions:
    """Bounded named sessions; separate workers and locks for independent instances."""
    def __init__(self, root, limit=8):
        self.root, self.limit = root, limit
        self.workers = {}; self.lock = threading.Lock()
    def handle(self, request):
        name = request.get('instance', 'default')
        if not isinstance(name,str) or not 1<=len(name)<=80 or not all(c.isalnum() or c in '-_' for c in name): raise ValueError('Invalid instance ID')
        with self.lock:
            if name not in self.workers:
                if len(self.workers)>=self.limit: raise ValueError('Maximum simulator sessions reached')
                self.workers[name]=PicWorker(self.root)
            worker=self.workers[name]
        return worker.handle(request)
    def close(self):
        for worker in self.workers.values(): worker.close()
