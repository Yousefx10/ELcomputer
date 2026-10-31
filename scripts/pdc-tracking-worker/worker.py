"""One bounded loopback request. Scheduling/retries are owned by reviewed systemd and DB leases."""
import argparse,json,pathlib,re,sys,urllib.request
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs):raise RuntimeError('REDIRECT_DENIED')
def secret(raw):
 values=[line.split('=',1)[1].strip().strip('"').strip("'") for line in raw.splitlines() if line.startswith('NUXT_PDC_TRACKING_WORKER_SECRET=')]
 if len(values)!=1 or not re.fullmatch('[a-f0-9]{64}',values[0]):raise RuntimeError('PRIVATE_TRACKING_CREDENTIAL_REQUIRED')
 return values[0]
def invoke(origin,value,opener=None):
 match=re.fullmatch(r'http://127\.0\.0\.1:([1-9][0-9]{0,4})',origin)
 if not match or int(match[1])>65535:raise RuntimeError('LOOPBACK_ONLY')
 if not re.fullmatch('[a-f0-9]{64}',value):raise RuntimeError('PRIVATE_TRACKING_CREDENTIAL_REQUIRED')
 request=urllib.request.Request(origin+'/api/internal/shipping/tracking',data=b'{}',method='POST',headers={'Content-Type':'application/json','x-pdc-tracking-secret':value})
 with (opener or urllib.request.build_opener(urllib.request.ProxyHandler({}),NoRedirect())).open(request,timeout=70) as response:
  if response.status!=200:raise RuntimeError('TRACKING_OUTCOME_UNVERIFIED')
  raw=response.read(2049)
 if len(raw)>2048:raise RuntimeError('RESPONSE_LIMIT')
 result=json.loads(raw)
 if set(result)!={'checked','failed','empty','provider_writes'}:raise RuntimeError('RESPONSE_SCHEMA')
 if any(type(result[k]) is not int or not 0<=result[k]<=5 for k in ['checked','failed']) or result['checked']+result['failed']>5 or type(result['empty']) is not bool or type(result['provider_writes']) is not int or result['provider_writes']!=0 or result['empty']!=(result['checked']+result['failed']==0):raise RuntimeError('RESPONSE_SCHEMA')
 return {'result':'TRACKING_BATCH_RECORDED','checked':result['checked'],'failed':result['failed'],'empty':result['empty'],'http_retries':0}
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--runtime',required=True);parser.add_argument('--origin',required=True);args=parser.parse_args()
 path=pathlib.Path(args.runtime);st=path.lstat()
 if path.is_symlink() or not path.is_file() or st.st_uid!=0 or st.st_mode&0o077:raise RuntimeError('ROOT_PRIVATE_RUNTIME_REQUIRED')
 print(json.dumps(invoke(args.origin,secret(path.read_text()))))
if __name__=='__main__':
 try:main()
 except Exception:print(json.dumps({'result':'TRACKING_OUTCOME_UNVERIFIED','http_retries':0,'automatic_resubmit':False}));sys.exit(1)
