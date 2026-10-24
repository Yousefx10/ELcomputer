"""Execute only a sealed, separately approved Caddy ingress change."""
import argparse,base64,hashlib,importlib.util,json,os,pathlib,shlex,subprocess,sys

HERE=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('reviewed_pdc_ingress',HERE/'ingress.py')
ingress=importlib.util.module_from_spec(spec);spec.loader.exec_module(ingress)
patch,block=ingress.patch,ingress.block
def sha(data): return hashlib.sha256(data).hexdigest()
def stable(value): return json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False)
def validate(work):
    p=json.loads((work/'ingress-plan.json').read_text()); body={k:v for k,v in p.items() if k!='seal'}
    assert sha(stable(body).encode())==p['seal']
    for name,value in p['tools_sha256'].items(): assert sha((HERE/name).read_bytes())==value
    for path,value in p['evidence_sha256'].items(): assert sha(pathlib.Path(path).read_bytes())==value
    original=(work/'Caddyfile.before.private').read_bytes(); candidate=(work/'Caddyfile.candidate.private').read_bytes()
    assert sha(original)==p['baseline_caddy_sha256'] and sha(candidate)==p['candidate_caddy_sha256']
    assert patch(original.decode(),p['target']['port']).encode()==candidate
    return p,candidate
def main():
    os.umask(0o077)
    a=argparse.ArgumentParser(); a.add_argument('mode',choices=['check','apply']); a.add_argument('directory'); a.add_argument('--approved'); args=a.parse_args()
    work=pathlib.Path(args.directory).resolve()
    # Deny a wrong or consumed approval before SSH or a new intent.
    visible=json.loads((work/'ingress-plan.json').read_text())
    if args.mode=='apply': assert args.approved==visible['seal'] and not (work/'ingress-execution-intent.json').exists()
    p,candidate=validate(work); t=p['target']
    if args.mode=='apply':
        with (work/'ingress-execution-intent.json').open('x') as out: json.dump({'approved_seal':p['seal'],'automatic_retry':False},out); out.flush(); os.fsync(out.fileno())
    source=(HERE/'remote.py').read_text(); command='python3 -I -S -B -c '+shlex.quote(source)
    ssh=['ssh','-T','-o','BatchMode=yes','-o','IdentitiesOnly=yes','-o','StrictHostKeyChecking=yes','-o','HostKeyAlgorithms=ssh-ed25519','-o','UserKnownHostsFile='+t['known_hosts'],'-o','ConnectionAttempts=1','-o','ConnectTimeout=12','-o','ControlMaster=no','-i',t['identity'],'root@'+t['host'],command]
    payload={'mode':args.mode,'plan':p,'approved':args.approved,'candidate':base64.b64encode(candidate).decode(),'addition':block(t['port'])}
    result=subprocess.run(ssh,input=stable(payload),text=True,capture_output=True,timeout=100)
    receipt=json.loads(result.stdout) if result.stdout.strip() else {'result':'STOP','phase':'ssh'}
    if args.mode=='apply':
        with (work/'ingress-result.json').open('x') as out: json.dump(receipt,out,indent=2);out.write('\n')
    print(json.dumps(receipt)); assert result.returncode==0

if __name__=='__main__':
    try: main()
    except Exception as error:
        print(json.dumps({'result':'STOP','error_type':type(error).__name__,'instruction':'No action retried. Preserve evidence.'})); raise SystemExit(1)
