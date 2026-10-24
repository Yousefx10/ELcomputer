"""New sealed recovery; never reruns the consumed ingress operator."""
import argparse,hashlib,importlib.util,json,os,pathlib,shlex,subprocess

HERE=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('consumed_ingress_operator',HERE/'operator.py');legacy=importlib.util.module_from_spec(spec);spec.loader.exec_module(legacy)
def sha(data):return hashlib.sha256(data).hexdigest()
def stable(value):return json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False)
def main():
    os.umask(0o077);a=argparse.ArgumentParser();a.add_argument('mode',choices=['check','apply']);a.add_argument('directory');a.add_argument('--approved');args=a.parse_args();work=pathlib.Path(args.directory).resolve()
    p=json.loads((work/'signal-plan.json').read_text())
    if args.mode=='apply':assert args.approved==p['seal'] and not (work/'signal-execution-intent.json').exists()
    assert sha(stable({k:v for k,v in p.items() if k!='seal'}).encode())==p['seal']
    for name,value in p['tools_sha256'].items():assert sha((HERE/name).read_bytes())==value
    for name,value in p['evidence_sha256'].items():assert sha(pathlib.Path(name).read_bytes())==value
    old,_=legacy.validate(work);assert old['seal']==p['parent_seal'] and (work/'ingress-execution-intent.json').exists()
    if args.mode=='apply':
        with (work/'signal-execution-intent.json').open('x') as out:json.dump({'approved_seal':p['seal'],'automatic_retry':False},out);out.flush();os.fsync(out.fileno())
    source=(HERE/'signal-remote.py').read_text();t=old['target'];command='python3 -I -S -B -c '+shlex.quote(source)
    ssh=['ssh','-T','-o','BatchMode=yes','-o','IdentitiesOnly=yes','-o','StrictHostKeyChecking=yes','-o','HostKeyAlgorithms=ssh-ed25519','-o','UserKnownHostsFile='+t['known_hosts'],'-o','ConnectionAttempts=1','-o','ConnectTimeout=12','-o','ControlMaster=no','-i',t['identity'],'root@'+t['host'],command]
    payload={'mode':args.mode,'plan':p,'approved':args.approved,'parent_plan':old,'snapshot_source':(HERE/'remote.py').read_text()}
    result=subprocess.run(ssh,input=stable(payload),text=True,capture_output=True,timeout=100)
    receipt=json.loads(result.stdout) if result.stdout.strip() else {'result':'STOP','phase':'ssh'}
    if args.mode=='apply':
        with (work/'signal-result.json').open('x') as out:json.dump(receipt,out,indent=2);out.write('\n')
    print(json.dumps(receipt));assert result.returncode==0

if __name__=='__main__':
    try:main()
    except Exception as error:print(json.dumps({'result':'STOP','error_type':type(error).__name__,'instruction':'No signal retried. Preserve evidence.'}));raise SystemExit(1)
