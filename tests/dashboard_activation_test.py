"""Focused operator tests. Native Nginx tests use only owned disposable paths.

Reload/service/process/database transports are simulations. No production inputs,
network targets, credentials, root, SSH or systemctl are executed.
"""
import copy
import datetime as dt
import hashlib
import io
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import tarfile
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts/nginx'))
import dashboard_activation as activation
import bootstrap_dashboard_activation as intake
import atomic_config as atomic
import config_parser as parser
import dashboard_access as renderer
import prepare_dashboard_read_activation as prepare
import root_dashboard_read_check as check
from dashboard_read_roles_test import setup
import dashboard_read_activation_prepare_test as fixture_helpers
import dashboard_read_roles_test as roles

UID, GID = os.getuid(), os.getgid()
NATIVE = os.environ.get('DASHBOARD_REVIEW_NGINX')


def fake_runtime(generation=0):
    return dict(master=dict(pid=424242, start_ticks=100), boot_id='owned-boot',
                service=dict(unit='owned-fixture.service'), application=dict(pid=777, start_ticks=42),
                workers=[dict(pid=1000 + generation, start_ticks=200 + generation,
                              uid=[UID] * 4, gid=[GID] * 4, executable='/owned/nginx', cgroup='owned')])


class OperatorTests(unittest.TestCase):
    def setUp(self):
        self.assertNotEqual(UID, 0, 'Never run these fixtures as root')
        # macOS lacks Linux fd xattr APIs. Model xattrs per inode explicitly;
        # Linux root/xattr operation remains a production acceptance condition.
        self.attrs = {}
        def key(path):
            s = os.fstat(path) if isinstance(path, int) else Path(path).stat()
            return s.st_dev, s.st_ino
        funcs = dict(listxattr=lambda p: list(self.attrs.get(key(p), {})),
                     getxattr=lambda p, n: self.attrs[key(p)][n],
                     setxattr=lambda p, n, v: self.attrs.setdefault(key(p), {}).__setitem__(n, v),
                     removexattr=lambda p, n: self.attrs[key(p)].__delitem__(n))
        for name, func in funcs.items():
            p = patch.object(os, name, func, create=True);p.start();self.addCleanup(p.stop)

    def authorization(self):
        now = activation.utc()
        binding = dict(private_activation_evidence_sha256='a'*64, production_project_ref='owned-project',
                       database_verifier_sha256='b'*64, settings_preimage_sha256='c'*64,
                       database_schema_sha256='d'*64, check=dict(expected_receipt=dict(candidate_sha256='e'*64,preimage_sha256='f'*64)))
        auth = dict(format=1, mode='apply', operator_manifest_sha256='1'*64, private_activation_evidence_sha256='a'*64,
                    execution_authorized=True,nginx_reloads_max=1,
                    candidate_sha256='e'*64,preimage_sha256='f'*64, nonce='2'*64,
                    not_before_utc=(now-dt.timedelta(seconds=1)).isoformat(), expires_at_utc=(now+dt.timedelta(seconds=180)).isoformat(),
                    business_fingerprint_sha256='3'*64)
        receipt = dict(result='PASS',mode='ACTIVATION_DATABASE_READONLY',nonce='2'*64,production_writes=0,
                       project_ref='owned-project',vetted_verifier_sha256='b'*64,settings_preimage_sha256='c'*64,
                       business_fingerprint_sha256='3'*64,schema_sha256='d'*64,observed_at_utc=now.isoformat(),completed_at_utc=now.isoformat(),
                       **{k:True for k in ['read_only','schema_migrations_rls_grants_exact','catalog_settings_publication_exact','zero_stock_orders_storage','commerce_signup_disabled']})
        return binding, auth, receipt, now

    def test_fresh_owner_authorization_and_exact_database_proof(self):
        b, a, r, now = self.authorization()
        activation.validate_fresh_state(a,r,b,'1'*64,'apply',now)

    def test_schema_catalog_commerce_identity_type_nonce_and_state_fail_closed(self):
        b, a, r, now = self.authorization()
        changes=[('project_ref','other'),('vetted_verifier_sha256','0'*64),('settings_preimage_sha256','0'*64),
                 ('nonce','4'*64),('business_fingerprint_sha256','4'*64),('schema_sha256','4'*64),
                 ('production_writes',True),('schema_migrations_rls_grants_exact',False),('catalog_settings_publication_exact',False),
                 ('zero_stock_orders_storage',False),('commerce_signup_disabled',1),('read_only',False)]
        for key,value in changes:
            with self.subTest(key=key),self.assertRaises(activation.GateError):
                activation.validate_fresh_state(a,{**r,key:value},b,'1'*64,'apply',now)

    def test_expired_future_and_excessive_authorization_windows_stop(self):
        b,a,r,now=self.authorization()
        for change in [dict(expires_at_utc=(now-dt.timedelta(seconds=1)).isoformat()),
                       dict(not_before_utc=(now+dt.timedelta(seconds=1)).isoformat()),
                       dict(expires_at_utc=(now+dt.timedelta(seconds=901)).isoformat()),dict(mode='rollback'),dict(execution_authorized=False)]:
            with self.subTest(change=change),self.assertRaises(activation.GateError):
                activation.validate_fresh_state({**a,**change},r,b,'1'*64,'apply',now)
        for age in (-1,301):
            rr={**r,'observed_at_utc':(now-dt.timedelta(seconds=age)).isoformat()}
            with self.assertRaises(activation.GateError):activation.validate_fresh_state(a,rr,b,'1'*64,'apply',now)

    def test_worker_acceptance_requires_new_generation_and_stable_master(self):
        activation.confirm_workers(fake_runtime(),fake_runtime(1))
        for after in [fake_runtime(),{**fake_runtime(1),'boot_id':'reboot'},
                      {**fake_runtime(1),'master':dict(pid=999,start_ticks=101)}]:
            with self.assertRaises(activation.GateError):activation.confirm_workers(fake_runtime(),after)
        after=fake_runtime(1);after['workers'][0]['uid']=[0]*4
        with self.assertRaises(activation.GateError):activation.confirm_workers(fake_runtime(),after)

    def test_systemd_execution_parser_keeps_semicolons_and_ignores_timestamps(self):
        value='{ path=/owned/nginx ; argv[]=/owned/nginx -g daemon on; master_process on; -s reload ; ignore_errors=no ; start_time=old ; }'
        self.assertEqual(activation.service_execution(value),[('/owned/nginx ','/owned/nginx -g daemon on; master_process on; -s reload ','no')])

    def test_command_allowlist_and_exactly_one_reload(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory).resolve();d=dict(nginx='/owned/nginx',systemctl='/owned/systemctl',ss='/owned/ss',nginx_entry='/owned/nginx.conf',nginx_unit='owned.service',runtime=dict(unit='owned-app.service'))
            calls=[]
            def transport(argv):calls.append(argv);return subprocess.CompletedProcess(argv,0,b'',b'')
            op=activation.Operation(root,d,'apply','1'*64,transport)
            for argv in [['/bin/sh','-c','x'],['/owned/systemctl','restart','owned-app.service'],['/owned/nginx','-s','reload']]:
                with self.assertRaises(activation.GateError):op.command(argv,'bad')
            with self.assertRaises(activation.GateError):op.reload()
            op.mark('installed-validated');op.reload_armed=True;op.reload()
            self.assertEqual(calls,[['/owned/systemctl','reload','owned.service']])
            with self.assertRaises(activation.GateError):op.reload()
            verify=activation.Operation(root,d,'verify','1'*64,transport);verify.reload_armed=True;verify.events=['installed-validated']
            with self.assertRaises(activation.GateError):verify.reload()

    def test_reload_timeout_records_uncertainty_and_cannot_retry(self):
        with tempfile.TemporaryDirectory() as directory:
            d=dict(systemctl='/owned/systemctl',nginx_unit='owned.service')
            def timeout(argv):raise subprocess.TimeoutExpired(argv,45,output=b'partial')
            op=activation.Operation(Path(directory),d,'apply','1'*64,timeout)
            op.mark('installed-validated');op.reload_armed=True
            with self.assertRaises(activation.GateError):op.reload()
            self.assertTrue(op.disposition()['reload_attempted']);self.assertFalse(op.disposition()['reload_acknowledged'])
            with self.assertRaises(activation.GateError):op.reload()
            self.assertTrue(list(Path(directory).glob('*.stdout.private')))

    def test_authenticate_exact_private_receipts_and_import_dependencies(self):
        base,bundle,plan,_,_,_=fixture_helpers.PreparationTests.fixture(self)
        saved=prepare.verify_saved(bundle,plan,UID,GID)
        prep=base/'prepare';prep.mkdir(mode=0o700)
        activation.durable_new(prep/'prepare.py',b'# owned program')
        activation.durable_new(prep/'PREPARATION.json',b'{"owned":true}')
        evidence=dict(verified_evidence=saved['evidence'],expected_receipt=plan['expected_receipt'],
                      candidate_sha256=activation.digest(saved['candidate']),candidate_bytes=len(saved['candidate']),
                      apply_authorized=False,rollback_authorized=False)
        raw=activation.encoded(evidence);activation.durable_new(prep/'APPLY-EVIDENCE.private.json',raw)
        report=dict(result='PASS',mode='PREPARE_EVIDENCE');activation.durable_new(prep/'PREPARATION-PASS.private.json',report)
        binding=dict(check={**plan,'check_workspace':str(bundle)},preparation_workspace=str(prep),private_activation_evidence_sha256=activation.digest(raw),
                     preparation_program_sha256=activation.digest(b'# owned program'),preparation_binding_sha256=activation.digest(b'{"owned":true}'),
                     expected_preparation_receipt_sha256=activation.digest(activation.encoded(report)),expected_preparation_receipt=report,
                     private_check_hashes={n:saved['evidence'][n]['sha256'] for n in ['CHECK-PASS.private.json','accepted.before.metadata.private.json','4-accepted-live-index.stdout.private']})
        self.assertEqual(activation.authenticate(binding,UID,GID)['candidate'],saved['candidate'])
        for key in ['private_activation_evidence_sha256','expected_preparation_receipt_sha256']:
            with self.subTest(key=key),self.assertRaises(activation.GateError):activation.authenticate({**binding,key:'0'*64},UID,GID)
        bad=copy.deepcopy(binding);bad['private_check_hashes']['CHECK-PASS.private.json']='0'*64
        with self.assertRaises(activation.GateError):activation.authenticate(bad,UID,GID)

    def test_private_writes_no_overwrite_symlink_or_resume(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'marker';activation.durable_new(path,b'first')
            with self.assertRaises(FileExistsError):activation.durable_new(path,b'again')
            link=path.with_name('alias');link.symlink_to(path)
            with self.assertRaises(FileExistsError):activation.durable_new(link,b'overwrite')
            self.assertEqual(path.read_bytes(),b'first')

    def test_package_and_fresh_control_drift_is_rechecked_at_barriers(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory).resolve()
            files={'owned.py':b'# immutable operator','BINDING.json':b'{}'}
            for n,raw in files.items():activation.durable_new(root/n,raw)
            activation.durable_new(root/'bootstrap.py',b'# intake')
            activation.durable_new(root/'DATABASE-STATE.private.json',b'{"fresh":true}')
            manifest=dict(files={n:activation.digest(raw) for n,raw in files.items()},bootstrap_sha256=activation.digest(b'# intake'))
            raw=activation.encoded(manifest);activation.durable_new(root/'MANIFEST.json',raw)
            controls={'DATABASE-STATE.private.json':activation.digest(b'{"fresh":true}')}
            activation.sealed_inputs_unchanged(root,activation.digest(raw),controls,UID,GID)
            for name in ['owned.py','BINDING.json','DATABASE-STATE.private.json']:
                path=root/name;before=path.read_bytes();path.write_bytes(before+b' ')
                with self.subTest(name=name),self.assertRaises(activation.GateError):
                    activation.sealed_inputs_unchanged(root,activation.digest(raw),controls,UID,GID)
                path.write_bytes(before)

    def test_linux_process_identity_and_worker_scan_ignore_init_and_unrelated_zombies(self):
        with tempfile.TemporaryDirectory() as directory:
            proc=Path(directory);(proc/'1').mkdir();(proc/'2').mkdir()
            fields=['Z','1']+['0']*17+['10']
            (proc/'2/stat').write_text('2 (unrelated zombie) '+' '.join(fields))
            exe=proc/'owned-nginx';exe.write_bytes(b'owned')
            def process(pid,ppid,command):
                p=proc/str(pid);p.mkdir()
                fields=['S',str(ppid)]+['0']*17+['12345']
                (p/'stat').write_text(str(pid)+' (worker name) '+' '.join(fields))
                (p/'status').write_text('Uid:\t'+('\t'.join([str(UID)]*4))+'\nGid:\t'+('\t'.join([str(GID)]*4))+'\n')
                (p/'cmdline').write_bytes(command.encode()+b'\x00');(p/'cgroup').write_text('0::/owned\n');(p/'exe').symlink_to(exe)
            process(42,1,'nginx: master process /owned/nginx');process(43,42,'nginx: worker process')
            record=activation.process_record(42,proc)
            self.assertEqual(record['start_ticks'],12345);self.assertEqual(record['uid'],[UID]*4)
            self.assertEqual([r['pid'] for r in activation.workers(42,proc)],[43])
            with self.assertRaises(activation.GateError):activation.process_record(1,proc)

    def test_linux_runtime_service_binary_pid_environment_and_inventory_bindings(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory).resolve();proc=root/'proc';proc.mkdir();release=root/'release';release.mkdir()
            node_dir=root/'node-runtime';node_dir.mkdir();node=node_dir/'node';node.write_bytes(b'owned-node');node.chmod(0o755)
            current=root/'current';current.symlink_to(release)
            def file(name,raw=b'owned',mode=0o644):
                path=root/name;path.write_bytes(raw);path.chmod(mode);return str(path)
            nginx=file('nginx',mode=0o755);systemctl=file('systemctl',mode=0o755);ss=file('ss',mode=0o755)
            unit=file('nginx.service');appunit=file('app.service');retry=file('retry.conf')
            environment=file('environment',b'OWNED=true\n',0o600);start=file('start.json',b'{}',0o600)
            tree=dict(release={},node={'node':dict(type='file',mode=0o755,bytes=10,sha256=activation.digest(b'owned-node'))})
            inventory=file('inventory.json',json.dumps(tree).encode(),0o600)
            pid=file('nginx.pid',b'42\n');entry='pid "'+pid+'"; events {} http {}'
            runtime=dict(expected_pid=44,uid=UID,inventory=inventory,inventory_sha256=activation.digest(Path(inventory).read_bytes()),
                         release=str(release),node=str(node),node_directory=str(node_dir),current_link=str(current),
                         environment=environment,start_receipt=start,unit_path=appunit,retry_dropin=retry)
            d=dict(nginx=nginx,systemctl=systemctl,ss=ss,nginx_unit='owned.service',runtime=runtime,nginx_entry='/owned/nginx.conf',config_prefix=str(root))
            saved=dict(deployment=d,files={'/owned/nginx.conf':entry})
            boot=proc/'sys/kernel/random';boot.mkdir(parents=True);(boot/'boot_id').write_text('owned-boot')
            def process(pid,ppid,command,executable):
                p=proc/str(pid);p.mkdir();fields=['S',str(ppid)]+['0']*17+['12345']
                (p/'stat').write_text(str(pid)+' (owned process) '+' '.join(fields))
                (p/'status').write_text('Uid:\t'+('\t'.join([str(UID)]*4))+'\nGid:\t'+('\t'.join([str(GID)]*4))+'\n')
                (p/'cmdline').write_bytes(command.encode()+b'\x00');(p/'cgroup').write_text('0::/owned.service\n')
                (p/'exe').symlink_to(executable);(p/'environ').write_bytes(b'OWNED=true\x00')
            process(42,1,'nginx: master process '+nginx,nginx);process(43,42,'nginx: worker process',nginx);process(44,1,'owned-node',node)
            properties=dict(Id='owned.service',LoadState='loaded',ActiveState='active',SubState='running',MainPID='42',
                            FragmentPath=unit,DropInPaths='',ControlGroup='/owned.service',Type='forking',NeedDaemonReload='no',
                            ExecStart='{ path='+nginx+' ; argv[]='+nginx+' ; ignore_errors=no ; start_time=old ; }',
                            ExecReload='{ path='+nginx+' ; argv[]='+nginx+' -s reload ; ignore_errors=no ; start_time=old ; }')
            def command(argv,label):
                raw='\n'.join(k+'='+v for k,v in properties.items()).encode()
                return subprocess.CompletedProcess(argv,0,raw if argv[0]==systemctl else b'',b'owned-build')
            with patch.object(check,'runtime_state',return_value=dict(nginx=dict(MainPID='42'),application=dict(MainPID='44'))):
                facts=activation.runtime_facts(saved,command,UID,proc)
                self.assertEqual(facts,json.loads(json.dumps(facts)), 'Runtime facts must survive the owner receipt boundary exactly')
                self.assertEqual(facts['master']['pid'],42);self.assertEqual(facts['workers'][0]['pid'],43)
                Path(unit).write_bytes(b'unit-drift')
                self.assertNotEqual(activation.stable_runtime(facts),activation.stable_runtime(activation.runtime_facts(saved,command,UID,proc)))
                properties['NeedDaemonReload']='yes'
                with self.assertRaisesRegex(activation.GateError,'NGINX_SERVICE'):activation.runtime_facts(saved,command,UID,proc)
                properties['NeedDaemonReload']='no';Path(pid).write_bytes(b'99\n')
                with self.assertRaisesRegex(ValueError,'NGINX_PID_IDENTITY'):activation.runtime_facts(saved,command,UID,proc)
                Path(pid).write_bytes(b'42\n');properties['ExecReload']=properties['ExecReload'].replace('-s reload','-s stop')
                with self.assertRaisesRegex(activation.GateError,'SERVICE_RELOAD_CONTRACT'):activation.runtime_facts(saved,command,UID,proc)
                properties['ExecReload']=properties['ExecReload'].replace('-s stop','-s reload');Path(inventory).write_bytes(b'{}')
                with self.assertRaisesRegex(activation.GateError,'RUNTIME_INVENTORY'):activation.runtime_facts(saved,command,UID,proc)

    def test_nonroot_entries_stop_without_any_effect(self):
        for program,args in [('root_dashboard_read_activate.py',['--manifest-sha256','0'*64]),
                             ('bootstrap_dashboard_activation.py',['--archive','/not-a-fixture','--archive-sha256','0'*64,'--manifest-sha256','0'*64,'--mode','verify','--staging-uid','1002','--staging-gid','1004'])]:
            with tempfile.TemporaryDirectory() as directory:
                r=subprocess.run([sys.executable,'-I','-B',str(ROOT/'scripts/nginx'/program),*args],cwd=directory,capture_output=True)
                self.assertEqual(r.returncode,1);self.assertEqual(json.loads(r.stdout)['result'],'BLOCKED')
                self.assertEqual(list(Path(directory).iterdir()),[]);self.assertNotIn(b'Traceback',r.stdout+r.stderr)

    def test_intake_rejects_wrong_mode_hash_and_unsafe_members(self):
        def archive(name='safe.py',kind=tarfile.REGTYPE):
            files={'safe.py':b'# fixture'};m=dict(format=1,purpose='Exact dashboard ingress activation',mode='verify',files={n:activation.digest(r) for n,r in files.items()})
            manifest=activation.encoded(m);out=io.BytesIO()
            with tarfile.open(fileobj=out,mode='w') as t:
                for n,raw in {**files,'MANIFEST.json':manifest}.items():
                    info=tarfile.TarInfo(n);info.mode=0o600;info.size=len(raw);t.addfile(info,io.BytesIO(raw))
                if name!='safe.py' or kind!=tarfile.REGTYPE:
                    info=tarfile.TarInfo(name);info.mode=0o600;info.type=kind;t.addfile(info)
            return out.getvalue(),activation.digest(manifest)
        raw,sha=archive();self.assertEqual(intake.unpack_verified(raw,sha,'verify')['safe.py'],b'# fixture')
        for mode in ['apply','rollback']:
            with self.assertRaises(ValueError):intake.unpack_verified(raw,sha,mode)
        with self.assertRaises(ValueError):intake.unpack_verified(raw,'0'*64,'verify')
        for name,kind in [('../escape',tarfile.REGTYPE),('/absolute',tarfile.REGTYPE),('link',tarfile.SYMTYPE),('safe.py',tarfile.LNKTYPE),('bootstrap.py',tarfile.REGTYPE)]:
            raw,sha=archive(name,kind)
            with self.subTest(name=name),self.assertRaises(ValueError):intake.unpack_verified(raw,sha,'verify')


@unittest.skipUnless(NATIVE,'Set the owned native Nginx executable')
class NativeOperatorTests(OperatorTests):
    # Do not inherit the ordinary tests twice in discovery.
    def fixture(self,host='orchard.example.test',alias='www.orchard.example.test'):
        temp=tempfile.TemporaryDirectory(prefix='activation-owned-');self.addCleanup(temp.cleanup)
        base=Path(temp.name).resolve();cfg=base/'config';cfg.mkdir();main=cfg/'main.conf';actual=cfg/'main.actual';entry=cfg/'nginx.conf'
        original,routing,contract=setup(host,alias)
        actual.write_text(original);actual.chmod(0o644);main.symlink_to(actual)
        pid=cfg/'nginx.pid';pid.write_bytes(b'424242\n');pid.chmod(0o644)
        text='error_log "'+str(base/'error.log')+'"; pid "'+str(pid)+'"; events {} http { access_log off; '
        for name in ['client_body','proxy','fastcgi','uwsgi','scgi']:text+=name+'_temp_path "'+str(base/name)+'"; '
        text+='include "'+str(main)+'"; include "'+str(cfg/'peer-*.conf')+'"; }'
        entry.write_text(text);entry.chmod(0o644)
        files={str(main):original,str(entry):text}
        for i in range(21):
            path=cfg/('peer-'+str(i)+'.conf');path.write_text('# owned peer '+str(i)+'\n');path.chmod(0o644);files[str(path)]=path.read_text()
        rows=[dict(file_id=activation.digest(p),sha256=activation.digest(t),bytes=len(t.encode()),uid=UID,mode='0o644') for p,t in files.items()]
        d=dict(main_path=str(main),nginx_entry=str(entry),config_prefix=str(cfg),routing=routing,protected_configurations=rows,
               nginx=NATIVE,systemctl='/owned/systemctl',ss='/owned/ss',nginx_unit='owned.service',runtime=dict(unit='owned-app.service'))
        ctx=dict(files=files,main=str(main),entry=str(entry),prefix=str(cfg),approved_files={r['file_id']:r['sha256'] for r in rows})
        candidate,_=renderer.render_reads(original,routing,auxiliary_contract=contract,configuration=ctx)
        saved=dict(deployment=d,files=files,source=original.encode(),candidate=candidate.encode(),spec=dict(auxiliary_contract=contract))
        os.setxattr(actual,'user.owned-security',b'preserved')
        saved['private_evidence']=dict(current_configuration_snapshots={p:prepare.live_snapshot(p,rows[i]) for i,p in enumerate(files)})
        return base,saved

    def operation(self,base,saved,mode='apply',fail=None):
        root=base/mode;root.mkdir(mode=0o700);state={'generation':0,'calls':[]}
        def transport(argv):
            state['calls'].append(argv)
            if argv==['/owned/systemctl','reload','owned.service']:
                state['generation']+=1
                return subprocess.CompletedProcess(argv,0,b'',b'')
            if fail and fail(argv):return subprocess.CompletedProcess(argv,1,b'',b'owned failure')
            actual=argv
            if argv==[NATIVE,'-T']:actual=[NATIVE,'-T','-p',str(base),' -c'.strip(),saved['deployment']['nginx_entry']]
            return subprocess.run(actual,capture_output=True,timeout=15)
        return activation.Operation(root,saved['deployment'],mode,('1' if mode=='apply' else '2')*64,transport),state

    def switch(self,base,saved,mode='apply',installed=None,barrier_fault=None,pre_reload_fault=None,fail=None,worker_fault=False):
        op,state=self.operation(base,saved,mode,fail)
        source,target=(saved['source'],saved['candidate']) if mode=='apply' else (saved['candidate'],saved['source'])
        def runtime():return fake_runtime(0 if worker_fault else state['generation'])
        def barrier():
            activation.configurations(saved,installed)
            if barrier_fault:barrier_fault()
        def pre_reload(installed):
            if pre_reload_fault:pre_reload_fault()
        result=activation.switch_once(saved,op,barrier,runtime,target,source,dict(before=fake_runtime(),delay_seconds=0),lambda:None,pre_reload)
        return result,op,state

    def test_native_full_23_file_apply_and_independent_rollback_two_stores(self):
        for host,alias in [('orchard.example.test','www.orchard.example.test'),('merchant.other.test','shop.other.test')]:
            base,saved=self.fixture(host,alias);main=Path(saved['deployment']['main_path']);link=os.readlink(main)
            peers={p:Path(p).read_bytes() for p in saved['files'] if p!=str(main)}
            applied,op,state=self.switch(base,saved)
            self.assertEqual(main.read_bytes(),saved['candidate']);self.assertEqual(os.readlink(main),link)
            self.assertEqual(sum(a[:2]==['/owned/systemctl','reload'] for a in state['calls']),1)
            self.assertTrue(applied['worker_acceptance_confirmed'])
            self.assertEqual(os.getxattr(main,'user.owned-security'),b'preserved')
            rolled,_,calls=self.switch(base,saved,'rollback',applied['installed'])
            self.assertEqual(main.read_bytes(),saved['source']);self.assertEqual(os.readlink(main),link)
            self.assertTrue(rolled['worker_acceptance_confirmed']);self.assertEqual({p:Path(p).read_bytes() for p in peers},peers)
            self.assertEqual(stat.S_IMODE(main.stat().st_mode),0o644)

    def test_native_shadow_error_stops_before_replacement_or_reload(self):
        base,saved=self.fixture();before=Path(saved['deployment']['main_path']).read_bytes()
        with self.assertRaises(activation.GateError):self.switch(base,saved,fail=lambda a:'-c' in a)
        self.assertEqual(Path(saved['deployment']['main_path']).read_bytes(),before)
        self.assertFalse((base/'apply/reload-attempted.private.json').exists())

    def test_native_peer_symlink_mode_and_xattr_drift_stop_before_swap(self):
        for kind in ['peer','mode','xattr','symlink']:
            base,saved=self.fixture();main=Path(saved['deployment']['main_path']);before=main.read_bytes()
            if kind=='peer':Path(next(p for p in saved['files'] if 'peer-0.conf' in p)).write_text('# changed\n')
            if kind=='mode':main.chmod(0o666)
            if kind=='xattr':os.setxattr(main,'user.owned-security',b'changed')
            if kind=='symlink':
                other=base/'other';other.write_bytes(before);main.unlink();main.symlink_to(other)
            with self.subTest(kind=kind),self.assertRaises(Exception):self.switch(base,saved)
            self.assertEqual(main.read_bytes(),before);self.assertFalse((base/'apply/replacement-attempted.private.json').exists())

    def test_native_swap_barrier_stops_and_preserves_pending_file(self):
        base,saved=self.fixture();calls=[0]
        def fault():
            calls[0]+=1
            if calls[0]==3:raise activation.GateError('OWNED_BARRIER_DRIFT')
        with self.assertRaises(activation.GateError):self.switch(base,saved,barrier_fault=fault)
        self.assertEqual(Path(saved['deployment']['main_path']).read_bytes(),saved['source'])
        self.assertEqual(len(list((base/'config').glob('.dashboard-access-*.pending'))),1)
        self.assertFalse((base/'apply/reload-attempted.private.json').exists())

    def test_native_atomic_rename_failure_preserves_ambiguous_attempt_without_reload(self):
        base,saved=self.fixture()
        with patch.object(atomic.os,'replace',side_effect=OSError('owned rename failure')):
            with self.assertRaises(OSError):self.switch(base,saved)
        self.assertEqual(Path(saved['deployment']['main_path']).read_bytes(),saved['source'])
        self.assertTrue((base/'apply/replacement-attempted.private.json').exists())
        self.assertFalse((base/'apply/replacement-acknowledged.private.json').exists())
        self.assertFalse((base/'apply/reload-attempted.private.json').exists())
        self.assertEqual(len(list((base/'config').glob('.dashboard-access-*.pending'))),1)

    def test_native_installed_syntax_failure_never_reloads_or_rolls_back(self):
        base,saved=self.fixture()
        with self.assertRaises(activation.GateError):self.switch(base,saved,fail=lambda a:a==[NATIVE,'-T'])
        self.assertEqual(Path(saved['deployment']['main_path']).read_bytes(),saved['candidate'])
        self.assertTrue((base/'apply/replacement-acknowledged.private.json').exists())
        self.assertFalse((base/'apply/reload-attempted.private.json').exists())

    def test_native_stale_state_at_reload_barrier_stops_after_install(self):
        base,saved=self.fixture()
        def stale():raise activation.GateError('STALE_STATE')
        with self.assertRaises(activation.GateError):self.switch(base,saved,pre_reload_fault=stale)
        self.assertEqual(Path(saved['deployment']['main_path']).read_bytes(),saved['candidate'])
        self.assertFalse((base/'apply/reload-attempted.private.json').exists())

    def test_native_ack_without_new_workers_stops_after_one_reload(self):
        base,saved=self.fixture()
        with self.assertRaisesRegex(activation.GateError,'WORKER_ACCEPTANCE_UNCONFIRMED'):self.switch(base,saved,worker_fault=True)
        self.assertEqual(Path(saved['deployment']['main_path']).read_bytes(),saved['candidate'])
        self.assertTrue((base/'apply/reload-acknowledged.private.json').exists())
        self.assertFalse((base/'apply/worker-acceptance-confirmed.private.json').exists())

    def test_native_complete_orchestration_requires_separate_rollback_receipt_and_fresh_approval(self):
        base,saved=self.fixture();binding,auth,db,now=self.authorization()
        binding['check']['expected_receipt'].update(candidate_sha256=activation.digest(saved['candidate']),preimage_sha256=activation.digest(saved['source']))
        saved['evidence']={'owned':'unchanged'};saved['private_evidence']['nginx_pid']=dict(master_pid=424242)
        auth.update(candidate_sha256=activation.digest(saved['candidate']),preimage_sha256=activation.digest(saved['source']))
        binding['workspaces']={mode:str(base/mode) for mode in ['apply','rollback']}
        reviewed=dict(result='PASS',mode='ACTIVATION_ROOT_READONLY',observed_at_utc=now.isoformat(),runtime=fake_runtime(),private_activation_evidence_sha256='a'*64,public_baseline={})
        state={'generation':0,'calls':[]}
        def transport(argv):
            state['calls'].append(argv)
            if argv==['/owned/systemctl','reload','owned.service']:
                state['generation']+=1;return subprocess.CompletedProcess(argv,0,b'',b'')
            if argv==[NATIVE,'-T']:argv=[NATIVE,'-T','-p',str(base),'-c',saved['deployment']['nginx_entry']]
            return subprocess.run(argv,capture_output=True,timeout=15)
        actual_read=prepare.private_read
        def local_private(path,*args,**kwargs):return actual_read(path,UID,GID)
        applied=None
        for mode in ['apply','rollback']:
            root=base/mode;root.mkdir(mode=0o700)
            receipt_raw=activation.encoded(db);state_raw=activation.encoded(reviewed)
            a={**auth,'mode':mode,'operator_manifest_sha256':('1' if mode=='apply' else '2')*64,
               'database_receipt_sha256':activation.digest(receipt_raw),'root_state_sha256':activation.digest(state_raw)}
            if mode=='rollback':
                a.update(apply_receipt_sha256=activation.digest(applied),apply_manifest_sha256='1'*64)
                activation.durable_new(root/'APPLY-RECEIPT.private.json',applied)
            a_raw=activation.encoded(a)
            for name,raw in [('AUTHORIZATION.json',a_raw),('DATABASE-STATE.private.json',receipt_raw),('ROOT-STATE.private.json',state_raw)]:activation.durable_new(root/name,raw)
            with patch.object(activation,'authenticate',return_value=saved),patch.object(activation,'runtime_facts',side_effect=lambda *args:fake_runtime(state['generation'])),\
                 patch.object(activation,'probes'),patch.object(check,'disabled_commerce'),patch.object(prepare,'private_read',side_effect=local_private),\
                 patch.object(activation,'sealed_inputs_unchanged'),\
                 patch.object(activation.Operation,'execute',staticmethod(transport)),patch.object(activation.time,'sleep'):
                result=activation.run(root,mode,binding,('1' if mode=='apply' else '2')*64,activation.digest(a_raw))
            self.assertEqual(result['result'],'INFRASTRUCTURE_PASS');self.assertFalse(result['full_acceptance'])
            self.assertTrue(result['database_post_verification_required'])
            if mode=='apply':applied=(root/'APPLY-RECEIPT.private.json').read_bytes()
        self.assertEqual(Path(saved['deployment']['main_path']).read_bytes(),saved['source'])
        self.assertEqual(sum(a[:2]==['/owned/systemctl','reload'] for a in state['calls']),2)

    def test_native_held_routes_head_audit_and_terminal_backend_smoke(self):
        # Reuse the established fixture setup, without running its earlier audit.
        for host,alias in [('orchard.example.test','www.orchard.example.test'),('merchant.other.test','shop.other.test')]:
            owned=type('OwnedSmoke',(roles.AuxiliaryReadsNginxTests,),dict(site_host=host,site_alias=alias))
            owned.setUpClass()
            try:
                count=0
                for row in renderer.read_policy()['routes']:
                    path=row['path'].replace(':id','00000000-0000-4000-8000-000000000001').replace(':sessionId','00000000-0000-4000-8000-000000000001').replace(':token','owned-token')
                    self.assertEqual(owned.request(path)[0],403 if row['decision']=='hold' else 401)
                    expected_head=403 if row['decision']=='hold' else 401 if 'HEAD' in row['methods'] else 405
                    self.assertEqual(owned.request(path,'HEAD')[0],expected_head)
                    if row['decision']=='hold':count+=1
                self.assertEqual(count,10)
                self.assertEqual(owned.request('/dashboard/login','HEAD')[0],200)
                self.assertEqual(owned.request('/api/admin-logs','POST')[0],401)
                self.assertEqual(owned.request('/api/admin-logs?extra=1','POST')[0],405)
                for path in ['/','/api/admin-orders','/index.php']:
                    self.assertEqual(activation.response('http://'+host+':'+str(owned.legacy)+path,'127.0.0.1')[0],404)
                    owned.legacy_requests+=1
                self.assertEqual(owned.canary.hits,0)
            finally:owned.tearDownClass()


# Shared setup, without rerunning the inherited generic suite in the native class.
for name in list(OperatorTests.__dict__):
    if name.startswith('test_') and name not in NativeOperatorTests.__dict__:
        setattr(NativeOperatorTests,name,None)


if __name__=='__main__':unittest.main(verbosity=2)
