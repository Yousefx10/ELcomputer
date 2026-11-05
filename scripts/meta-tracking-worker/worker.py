"""One bounded loopback call. Install only through a separately approved release."""
import argparse,json,os,sys,urllib.error,urllib.parse,urllib.request

class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs):return None

def main():
 parser=argparse.ArgumentParser();parser.add_argument('mode',choices=['process','retention']);args=parser.parse_args()
 base=urllib.parse.urlsplit(os.environ.get('META_WORKER_ORIGIN',''))
 secret=os.environ.get('NUXT_META_WORKER_SECRET','')
 if base.scheme!='http' or base.hostname!='127.0.0.1' or not base.port or base.username or base.password or base.path not in ('','/') or base.query or base.fragment:
  raise ValueError('Invalid loopback configuration')
 if len(secret)<32 or '\n' in secret or '\r' in secret:raise ValueError('Worker configuration unavailable')
 url=urllib.parse.urlunsplit(('http',base.netloc,'/api/internal/marketing/'+args.mode,'',''))
 request=urllib.request.Request(url,data=b'{}',method='POST',headers={'Content-Type':'application/json','Authorization':'Bearer '+secret})
 opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),NoRedirect())
 with opener.open(request,timeout=20) as response:
  body=response.read(4097)
  if len(body)>4096:raise ValueError('Invalid worker response')
  result=json.loads(body)
 if args.mode=='process':
  state=result.get('state')
  if state not in ('disabled','empty','held','accepted','transient','rejected','uncertain'):raise ValueError('Invalid worker result')
  print(json.dumps({'state':state}))
 else:
  counts={k:result.get(k) for k in ['scrubbed','suppressed']}
  if any(type(v) is not int or not 0<=v<=500 for v in counts.values()):raise ValueError('Invalid retention result')
  print(json.dumps(counts))

if __name__=='__main__':
 try:main()
 except Exception:
  print('Marketing worker incomplete.',file=sys.stderr);sys.exit(1)
