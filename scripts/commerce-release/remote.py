#!/usr/bin/env python3
"""Pinned existing-host release operations. Only inspect/assets are read-only.

Mutating modes require the plan digest and exclusive intent. No reinstall,
Caddy edit/restart, SQL, automatic rollback, pruning or business requests.
"""
import argparse, hashlib, http.client, importlib.util, json, os, pathlib, pwd, re, shutil, stat, subprocess, tarfile, time

def sha(path): return hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()
def digest(value): return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
def command(argv,timeout=30): return subprocess.check_output(argv,text=True,timeout=timeout,stderr=subprocess.PIPE).strip()
def checked_dir(path):
    assert path.is_dir() and not path.is_symlink()
def paths(p):
    t=p['target']; root=pathlib.Path(t['root']); assert re.fullmatch('/srv/[a-z][a-z0-9-]{2,24}',str(root))
    assert re.fullmatch('[a-z][a-z0-9-]{2,24}',t['service']) and re.fullmatch('[a-z][a-z0-9-]{2,24}',t['user'])
    assert root.name==t['service'];checked_dir(root);checked_dir(root/'releases');checked_dir(root/'shared/uploads')
    assert t['packing_dir']==str(root/'shared/private/packing-videos')
    assert p['release_id']=='preflight' or re.fullmatch('[a-f0-9]{16}',p['release_id'])
    assert re.fullmatch('/opt/commerce-tools/ffprobe-[0-9.]+-[a-f0-9]{12}/ffprobe',t['probe_path'])
    assert pathlib.Path('/etc/machine-id').read_text().strip()==t['machine_id'] and os.geteuid()==0
    return t,root,pathlib.Path('/var/lib/commerce-releases')/p['release_id']
def env_values(raw):
    # systemd's existing quoted environment is parsed, never sourced by a shell.
    import shlex
    values={}
    for line in raw.decode().splitlines():
        if line.strip() and not line.lstrip().startswith('#'):
            name,value=line.split('=',1);parsed=shlex.split(value);assert len(parsed)<=1 and name not in values;values[name]=parsed[0] if parsed else ''
    return values
def inspect(p):
    t,root,stage=paths(p); current=root/'current';assert current.is_symlink();release=current.resolve();assert release.parent==root/'releases'
    env=pathlib.Path('/etc')/t['service']/'runtime.env';s=env.lstat();assert stat.S_ISREG(s.st_mode) and s.st_uid==0 and stat.S_IMODE(s.st_mode)==0o600
    raw=env.read_bytes();values=env_values(raw)
    assert values['NODE_ENV']=='production'
    for key in ['HOST','NITRO_HOST']:assert values[key]=='127.0.0.1'
    for key in ['PORT','NITRO_PORT']:assert values[key]==str(t['port'])
    assert command([t['node'],'--version'])=='v22.23.1'
    assert values['NUXT_PUBLIC_SUPABASE_URL']=='https://'+t['project_ref']+'.supabase.co'
    for key in ['NUXT_PAYMOB_ENABLED','NUXT_SHIPPING_LIVE_REQUESTS_ENABLED','PDC_LIVE_REQUESTS_ENABLED']:assert values[key]=='false'
    assert values['NUXT_UPLOADS_DIR']==str(root/'shared/uploads')
    addition=('NUXT_PACKING_VIDEOS_DIR="'+t['packing_dir']+'"\nNUXT_PACKING_VIDEO_PROBE_PATH="'+t['probe_path']+'"\n').encode()
    assert not any(key in values for key in ['NUXT_PACKING_VIDEOS_DIR','NUXT_PACKING_VIDEO_PROBE_PATH']),'Packing configuration already exists; review it'
    unit=pathlib.Path('/etc/systemd/system')/(t['service']+'.service');drop=pathlib.Path(str(unit)+'.d/commerce-packing.conf');assert not drop.exists()
    files={}
    for f in sorted((root/'shared/uploads').rglob('*')):
        assert not f.is_symlink()
        if f.is_file():files[str(f.relative_to(root/'shared/uploads'))]=sha(f)
    assert command(['systemctl','is-active',t['service']+'.service'])=='active'
    assert command(['systemctl','is-active','caddy.service'])=='active'
    return {'current':str(release),'verified':json.loads((release/'VERIFIED.json').read_text()),'env_sha256':sha(env),
      'updated_env_sha256':hashlib.sha256(raw+(b'' if raw.endswith(b'\n') else b'\n')+addition).hexdigest(),
      'unit_sha256':sha(unit),'caddy_sha256':sha('/etc/caddy/Caddyfile'),'extractor_sha256':sha(t['extractor']),
      'media_sha256':digest(files),'media_files':len(files),'free_bytes':shutil.disk_usage(root).free,
      'ffmpeg_policy':command(['apt-cache','policy','ffmpeg']),
      'build_dependencies':command(['apt-get','-s','--no-install-recommends','--no-upgrade','install','build-essential']),
      'unit':unit.read_text(),
      'node_version':'22.23.1','main_pid':int(command(['systemctl','show',t['service']+'.service','-p','MainPID','--value'])),
      'caddy_pid':int(command(['systemctl','show','caddy.service','-p','MainPID','--value']))}
def baseline(p):
    state=inspect(p)
    for key in ['current','env_sha256','unit_sha256','caddy_sha256','extractor_sha256','main_pid','caddy_pid']:assert state[key]==p['before'][key],'Runtime changed: '+key
    assert state['free_bytes']>max(512*1024*1024,p['archive_bytes']*4)
    return state
def prepare(p):
    current=baseline(p);t,root,stage=paths(p);stage.parent.mkdir(mode=0o700,exist_ok=True);stage.mkdir(mode=0o700)
    (stage/'plan.json').write_text(json.dumps(p,sort_keys=True)+'\n');(stage/'plan.json').chmod(0o600)
    (stage/'live-before.json').write_text(json.dumps(current)+'\n')
    return {'staging':str(stage)}
def stage_release(p):
    baseline(p);t,root,stage=paths(p);assert sha(stage/'release.tar.gz')==p['archive_sha256']
    inventory=json.loads((stage/'inventory.json').read_text());assert digest(inventory)==p['inventory_sha256']
    spec=importlib.util.spec_from_file_location('retained_extractor',t['extractor']);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    destination=root/'releases'/p['release_id'];module.extract_release(stage/'release.tar.gz',destination,inventory)
    (destination/'OUTPUT-INVENTORY.json').write_text(json.dumps(inventory)+'\n')
    (destination/'VERIFIED.json').write_text(json.dumps({'archive_sha256':p['archive_sha256'],'commit':p['application_commit'],'plan_sha256':p['seal']})+'\n')
    (stage/'staged.json').write_text(json.dumps({'release':str(destination)})+'\n')
    return {'release':str(destination)}
def provision(p):
    baseline(p);t,root,stage=paths(p);assert (stage/'staged.json').is_file()
    # Build the pinned, authenticated upstream decoder with only local-file
    # protocols and required video decoders. The distro's older ffmpeg is unused.
    source=stage/p['decoder']['filename'];assert sha(source)==p['decoder']['sha256']
    assert sha(stage/'decoder-check.webm')==p['decoder_fixture_sha256']
    simulation=command(['apt-get','-s','--no-install-recommends','--no-upgrade','install','build-essential'])
    assert re.search(r'\b0 upgraded, \d+ newly installed, 0 to remove',simulation),'Compiler installation would upgrade/remove existing packages'
    assert simulation==p['before']['build_dependencies'],'Dependency plan changed'
    with (stage/'packages.log').open('xb') as log:
        subprocess.run(['apt-get','install','--yes','--no-install-recommends','--no-upgrade','build-essential'],check=True,stdin=subprocess.DEVNULL,stdout=log,stderr=subprocess.STDOUT,timeout=240,env={**os.environ,'DEBIAN_FRONTEND':'noninteractive','NEEDRESTART_SUSPEND':'1','NEEDRESTART_MODE':'l','LC_ALL':'C'})
    build=pathlib.Path('/var/tmp')/('commerce-decoder-'+p['release_id']);build.mkdir(mode=0o700)
    with tarfile.open(source) as tar:
        members=tar.getmembers()
        assert members and all((m.isfile() or m.isdir()) and pathlib.PurePosixPath(m.name).parts[0]=='ffmpeg-'+p['decoder']['version'] and '..' not in pathlib.PurePosixPath(m.name).parts for m in members)
        assert sum(m.size for m in members)<200000000
        tar.extractall(build,filter='data')
    builder=pwd.getpwnam('nobody')
    for directory,subdirs,files in os.walk(build):
        os.chown(directory,builder.pw_uid,builder.pw_gid)
        for name in files:os.chown(pathlib.Path(directory)/name,builder.pw_uid,builder.pw_gid)
    source_dir=build/('ffmpeg-'+p['decoder']['version'])
    with (stage/'decoder-build.log').open('xb') as log:
        subprocess.run(['runuser','-u','nobody','--','./configure',*p['decoder']['configure']],cwd=source_dir,check=True,stdout=log,stderr=subprocess.STDOUT,timeout=120)
        subprocess.run(['runuser','-u','nobody','--','make','-j2','ffprobe'],cwd=source_dir,check=True,stdout=log,stderr=subprocess.STDOUT,timeout=600)
    binary=source_dir/'ffprobe';assert binary.is_file() and not binary.is_symlink() and binary.stat().st_size<32000000
    base=pathlib.Path('/opt/commerce-tools')
    if not base.exists():base.mkdir(mode=0o755);base.chmod(0o755)
    assert not base.is_symlink() and base.stat().st_uid==0 and not base.stat().st_mode&0o022
    destination=pathlib.Path(t['probe_path']);destination.parent.mkdir(mode=0o755);destination.parent.chmod(0o755)
    shutil.copyfile(binary,destination);destination.chmod(0o755)
    probe=json.loads(command([str(destination),'-v','error','-show_program_version','-of','json']))
    assert probe['program_version']['version']==p['decoder']['version']
    frames=json.loads(command([str(destination),'-v','error','-protocol_whitelist','file','-show_frames','-select_streams','v:0','-of','json',str(stage/'decoder-check.webm')]))
    assert frames['frames']
    account=pwd.getpwnam(t['user'])
    for directory in [root/'shared/private',pathlib.Path(t['packing_dir'])]:
        assert not directory.exists() and not directory.is_symlink(),'Private path already exists; preserve and review'
        directory.mkdir(mode=0o700);os.chown(directory,account.pw_uid,account.pw_gid)
    env=pathlib.Path('/etc')/t['service']/'runtime.env';raw=env.read_bytes();backup=stage/'runtime.env.before';backup.write_bytes(raw);backup.chmod(0o600)
    addition=('NUXT_PACKING_VIDEOS_DIR="'+t['packing_dir']+'"\nNUXT_PACKING_VIDEO_PROBE_PATH="'+t['probe_path']+'"\n').encode()
    updated=raw+(b'' if raw.endswith(b'\n') else b'\n')+addition;assert hashlib.sha256(updated).hexdigest()==p['before']['updated_env_sha256']
    temporary=env.with_name('runtime.env.commerce-next');assert not temporary.exists();temporary.write_bytes(updated);temporary.chmod(0o600);temporary.replace(env)
    drop=pathlib.Path('/etc/systemd/system')/(t['service']+'.service.d');drop.mkdir(mode=0o755,exist_ok=True)
    with (drop/'commerce-packing.conf').open('x') as f:f.write('[Service]\nReadWritePaths='+t['packing_dir']+'\n')
    subprocess.run(['systemd-analyze','verify','/etc/systemd/system/'+t['service']+'.service'],check=True,timeout=30,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    subprocess.run(['systemctl','daemon-reload'],check=True,timeout=30)
    (stage/'provisioned.json').write_text(json.dumps({'env_sha256':sha(env),'probe_sha256':sha(t['probe_path'])})+'\n')
    return {'private_root':t['packing_dir'],'decoder':'PASS','base_unit_unchanged':sha('/etc/systemd/system/'+t['service']+'.service')==p['before']['unit_sha256']}
def probe_http(port):
    connection=http.client.HTTPConnection('127.0.0.1',port,timeout=3)
    try:
        connection.request('GET','/api/admin-products/list');response=connection.getresponse();return response.status==401
    finally:connection.close()
def candidate(p):
    t,root,stage=paths(p);assert (stage/'provisioned.json').is_file();unit='commerce-candidate-'+p['release_id'];release=root/'releases'/p['release_id'];port=t['candidate_port']
    import socket
    with socket.socket() as sock:sock.bind(('127.0.0.1',port))
    env=stage/'candidate.env';raw=(pathlib.Path('/etc')/t['service']/'runtime.env').read_bytes()
    # A single EnvironmentFile supplies candidate ports; Environment= cannot
    # override a conflicting EnvironmentFile assignment in systemd.
    raw=re.sub(rb'^(?:NITRO_PORT|PORT)=.*\n?',b'',raw,flags=re.M)
    env.write_bytes(raw+('PORT="'+str(port)+'"\nNITRO_PORT="'+str(port)+'"\n').encode());env.chmod(0o600)
    args=['systemd-run','--quiet','--unit='+unit,'--property=User='+t['user'],'--property=Group='+t['user'],
      '--property=WorkingDirectory='+str(release),'--property=EnvironmentFile='+str(env),'--property=NoNewPrivileges=true',
      '--property=PrivateTmp=true','--property=ProtectHome=true','--property=ProtectSystem=strict','--property=RestrictSUIDSGID=true',
      '--property=ReadWritePaths='+str(root/'shared/uploads')+' '+t['packing_dir'],'--property=UMask=0027',
      t['node'],str(release/'server/index.mjs')]
    subprocess.run(args,check=True,timeout=30)
    ready=False
    try:
        for _ in range(30):
            try:
                if probe_http(port):ready=True;break
            except (OSError,http.client.HTTPException):pass
            time.sleep(1)
        assert ready,'Candidate failed readiness; existing application remains selected'
        # Actual service-user and sandbox file/decoder probes, without orders.
        subprocess.run(['runuser','-u',t['user'],'--','test','-r',str(release/'server/index.mjs')],check=True,timeout=10)
        smoke=pathlib.Path(t['packing_dir'])/('.release-probe-'+p['release_id'])
        script="import pathlib,os,subprocess; p=pathlib.Path("+repr(str(smoke))+"); f=p.open('xb'); f.write(b'isolated release probe'); f.flush(); os.fsync(f.fileno()); f.close(); assert p.read_bytes()==b'isolated release probe'; p.unlink(); subprocess.run(["+repr(t['probe_path'])+",'-v','error','-show_program_version','-of','json'],check=True,stdout=subprocess.DEVNULL)"
        subprocess.run(['systemd-run','--quiet','--wait','--collect','--unit='+unit+'-files',
          '--property=User='+t['user'],'--property=Group='+t['user'],
          '--property=NoNewPrivileges=true','--property=PrivateTmp=true','--property=ProtectHome=true',
          '--property=ProtectSystem=strict','--property=RestrictSUIDSGID=true',
          '--property=ReadWritePaths='+t['packing_dir'],'--property=UMask=0077',
          '/usr/bin/python3','-c',script],check=True,timeout=30,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        (stage/'candidate-pass.json').write_text(json.dumps({'port':port,'ready':True})+'\n')
        return {'candidate':'PASS','existing_current':str((root/'current').resolve())}
    finally:subprocess.run(['systemctl','stop',unit+'.service'],check=True,timeout=30)
def activate(p):
    t,root,stage=paths(p);assert (stage/'candidate-pass.json').is_file();assert (root/'current').resolve()==pathlib.Path(p['before']['current'])
    assert int(command(['systemctl','show','caddy.service','-p','MainPID','--value']))==p['before']['caddy_pid']
    assert int(command(['systemctl','show',t['service']+'.service','-p','MainPID','--value']))==p['before']['main_pid']
    assert sha('/etc/caddy/Caddyfile')==p['before']['caddy_sha256']
    assert sha('/etc/systemd/system/'+t['service']+'.service')==p['before']['unit_sha256']
    assert sha('/etc/'+t['service']+'/runtime.env')==p['before']['updated_env_sha256']
    with (stage/'activation-intent.json').open('x') as f:json.dump({'old':p['before']['current'],'new':str(root/'releases'/p['release_id'])},f)
    link=root/('current.commerce-'+p['release_id']);assert not link.exists() and not link.is_symlink();link.symlink_to(root/'releases'/p['release_id']);link.replace(root/'current')
    subprocess.run(['systemctl','restart',t['service']+'.service'],check=True,timeout=60)
    ready=False
    for _ in range(30):
        try:
            if probe_http(t['port']):ready=True;break
        except (OSError,http.client.HTTPException):pass
        time.sleep(1)
    assert ready,'STOP: preserve artifacts for manual recovery; never restart/reapply automatically'
    assert command(['systemctl','is-active',t['service']+'.service'])=='active'
    main_pid=int(command(['systemctl','show',t['service']+'.service','-p','MainPID','--value']))
    assert main_pid!=p['before']['main_pid'] and pathlib.Path('/proc/'+str(main_pid)+'/cwd').resolve()==root/'releases'/p['release_id']
    assert command(['systemctl','is-active','caddy.service'])=='active'
    assert int(command(['systemctl','show','caddy.service','-p','MainPID','--value']))==p['before']['caddy_pid']
    files={str(f.relative_to(root/'shared/uploads')):sha(f) for f in sorted((root/'shared/uploads').rglob('*')) if f.is_file()}
    assert digest(files)==json.loads((stage/'live-before.json').read_text())['media_sha256'],'Public media changed during the maintenance window'
    (stage/'activated.json').write_text(json.dumps({'current':str((root/'current').resolve()),'verified':True})+'\n')
    return {'activated':True,'main_pid':main_pid,'current':str((root/'current').resolve()),'caddy_unchanged':sha('/etc/caddy/Caddyfile')==p['before']['caddy_sha256']}
def main():
    os.umask(0o077);a=argparse.ArgumentParser();a.add_argument('mode',choices=['inspect','assets','prepare','stage','provision','candidate','activate']);a.add_argument('plan');a.add_argument('--approved');args=a.parse_args();p=json.loads(args.plan)
    if args.mode not in ['inspect','assets']:
        seal=p.pop('seal');assert digest(p)==seal and args.approved==seal,'Exact plan approval digest required';p['seal']=seal
    if args.mode=='inspect':result=inspect(p)
    elif args.mode=='assets':
        t,root,_=paths(p)
        with tarfile.open(fileobj=__import__('sys').stdout.buffer,mode='w|gz') as archive:
            for f in sorted((root/'current/public/_nuxt').rglob('*')):
                assert not f.is_symlink()
                if f.is_file() and str(f.relative_to(root/'current/public/_nuxt'))!='builds/latest.json':archive.add(f,arcname=str(f.relative_to(root/'current/public')),recursive=False)
        return
    else:result=globals()[{'stage':'stage_release'}.get(args.mode,args.mode)](p)
    print(json.dumps(result))
if __name__=='__main__':
    try:main()
    except Exception as error:
        print(json.dumps({'result':'STOP','error_type':type(error).__name__,'message':'Preserve release evidence; no automatic retry or rollback.'}));raise SystemExit(1)
