"""Real studio HTTP/UI, with only external browser launching replaced in tests."""
import functools,json,sys,threading,signal,tempfile
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from launch import Handler,ROOT
from assistant_bridge import AssistantBridge
from http.server import ThreadingHTTPServer
from project_store import ProjectStore

with tempfile.TemporaryDirectory() as temporary:
    root=Path(temporary)
    server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT/'web')))
    server.local_host=f'127.0.0.1:{server.server_port}';server.cs_token='fixture-only'
    server.projects=ProjectStore(root/'projects');server.assistant=AssistantBridge(ROOT,root/'assistant')
    def hub(path,open_browser):
        (path/'fixture-opened').write_text(str(open_browser))
    server.assistant.hub=hub
    signal.signal(signal.SIGTERM,lambda *_:threading.Thread(target=server.shutdown,daemon=True).start())
    print(json.dumps({'url':'http://'+server.local_host+'/','root':str(root)}),flush=True)
    try:server.serve_forever()
    finally:server.server_close()
