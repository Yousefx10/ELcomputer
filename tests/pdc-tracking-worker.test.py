import importlib.util,pathlib,json,unittest
P=pathlib.Path(__file__).resolve().parents[1];spec=importlib.util.spec_from_file_location('tracking',P/'scripts/pdc-tracking-worker/worker.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Response:
 status=200
 def __init__(self,data):self.data=data
 def __enter__(self):return self
 def __exit__(self,*args):pass
 def read(self,n):return self.data[:n]
class Opener:
 def __init__(self,data=None):self.calls=[];self.data=data or b'{"checked":1,"failed":0,"empty":false,"provider_writes":0}'
 def open(self,request,timeout):self.calls.append((request,timeout));return Response(self.data)
class Tests(unittest.TestCase):
 def test_one_loopback_post_no_retry_private_header(self):
  op=Opener();r=m.invoke('http://127.0.0.1:3000','a'*64,op);self.assertEqual(r['checked'],1);self.assertEqual(len(op.calls),1);req,timeout=op.calls[0];self.assertEqual(req.get_method(),'POST');self.assertEqual(timeout,70);self.assertEqual(req.full_url,'http://127.0.0.1:3000/api/internal/shipping/tracking');self.assertNotIn('a'*64,json.dumps(r))
 def test_external_origins_and_redirect_denied(self):
  for origin in ['https://provider.invalid','http://localhost:3000','http://127.0.0.1:99999','http://127.0.0.1:3000/private']:
   with self.assertRaises(RuntimeError):m.invoke(origin,'a'*64,Opener())
  with self.assertRaises(RuntimeError):m.NoRedirect().redirect_request(None,None,None,None,None,None)
 def test_missing_duplicate_weak_or_wrong_worker_secret(self):
  for raw in ['','NUXT_PDC_TRACKING_WORKER_SECRET=x','NUXT_EMAIL_WORKER_SECRET='+'a'*64,'NUXT_PDC_TRACKING_WORKER_SECRET='+'a'*64+'\nNUXT_PDC_TRACKING_WORKER_SECRET='+'b'*64]:
   with self.assertRaises(RuntimeError):m.secret(raw)
 def test_redacted_bounded_response_only(self):
  for body in [b'x'*3000,b'{}',b'{"checked":true,"failed":0,"empty":false,"provider_writes":0}',b'{"checked":9,"failed":0,"empty":false,"provider_writes":0}',b'{"checked":1,"failed":0,"empty":false,"provider_writes":0,"awb":"PRIVATE"}']:
   with self.assertRaises((RuntimeError,ValueError)):m.invoke('http://127.0.0.1:3000','a'*64,Opener(body))
 def test_transport_uncertainty_never_resubmits(self):
  class Fail:
   count=0
   def open(self,*a,**kw):self.count+=1;raise TimeoutError()
  op=Fail()
  with self.assertRaises(TimeoutError):m.invoke('http://127.0.0.1:3000','a'*64,op)
  self.assertEqual(op.count,1)
 def test_disabled_portable_schedule_no_catchup_or_restart_loop(self):
  service=(P/'scripts/pdc-tracking-worker/tracking.service.in').read_text();timer=(P/'scripts/pdc-tracking-worker/tracking.timer.in').read_text()
  for directive in ['Restart=no','TimeoutStartSec=85','IPAddressDeny=any','IPAddressAllow=localhost','@RUNTIME@','@ORIGIN@']:self.assertIn(directive,service)
  self.assertIn('Persistent=false',timer);self.assertIn('OnActiveSec=60s',timer);self.assertNotIn('OnBootSec',timer)
if __name__=='__main__':unittest.main()
