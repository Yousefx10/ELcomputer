import http.server,json,os,pathlib,subprocess,threading,unittest

WORKER=pathlib.Path(__file__).resolve().parents[1]/'scripts/meta-tracking-worker/worker.py'
SECRET='LOCAL_WORKER_SECRET_NO_PROVIDER_'+'x'*32

class Tests(unittest.TestCase):
 def setUp(self):
  self.calls=[];owner=self
  class Handler(http.server.BaseHTTPRequestHandler):
   def log_message(self,*args):pass
   def do_POST(self):
    owner.calls.append((self.path,self.headers.get('Authorization')))
    if self.path.endswith('retention'):data={'scrubbed':1,'suppressed':2,'untrusted':'do not log'}
    else:data={'state':'accepted','token':'do not log'}
    if owner.redirect:self.send_response(302);self.send_header('Location','https://example.invalid/events');self.end_headers();return
    self.send_response(200);self.end_headers();self.wfile.write(json.dumps(data).encode())
  self.redirect=False;self.server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler)
  self.thread=threading.Thread(target=self.server.serve_forever,daemon=True);self.thread.start()
 def tearDown(self):self.server.shutdown();self.server.server_close();self.thread.join()
 def run_worker(self,mode='process',**overrides):
  env={'PATH':os.environ['PATH'],'META_WORKER_ORIGIN':'http://127.0.0.1:'+str(self.server.server_port),'NUXT_META_WORKER_SECRET':SECRET,**overrides}
  return subprocess.run(['python3','-I','-S','-B',str(WORKER),mode],env=env,capture_output=True,text=True,timeout=5)
 def test_one_loopback_request_and_safe_output(self):
  r=self.run_worker();self.assertEqual(r.returncode,0,r.stderr);self.assertEqual(json.loads(r.stdout),{'state':'accepted'});self.assertEqual(self.calls,[('/api/internal/marketing/process','Bearer '+SECRET)])
 def test_retention_has_bounded_counts(self):
  r=self.run_worker('retention');self.assertEqual(r.returncode,0,r.stderr);self.assertEqual(json.loads(r.stdout),{'scrubbed':1,'suppressed':2})
 def test_external_origins_and_missing_secret_never_connect(self):
  for value in ['https://example.invalid','http://example.invalid:3000','http://127.0.0.1:3000/?secret=x','http://name:password@127.0.0.1:3000']:
   r=self.run_worker(META_WORKER_ORIGIN=value);self.assertNotEqual(r.returncode,0);self.assertNotIn('password',r.stderr)
  self.assertNotEqual(self.run_worker(NUXT_META_WORKER_SECRET='short').returncode,0);self.assertEqual(self.calls,[])
 def test_redirect_never_forwards_secret(self):
  self.redirect=True;r=self.run_worker();self.assertNotEqual(r.returncode,0);self.assertEqual(len(self.calls),1);self.assertNotIn(SECRET,r.stderr)

if __name__=='__main__':unittest.main()
