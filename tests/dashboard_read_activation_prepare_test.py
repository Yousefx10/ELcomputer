"""Unprivileged evidence-gate fixtures; never runs a production/root entry."""
import ast
import copy
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'scripts/nginx'))
import prepare_dashboard_read_activation as prepare
import root_dashboard_read_check as check
import dashboard_access as renderer
import config_parser as parser
from dashboard_read_roles_test import setup

SOURCES = ROOT/'scripts/nginx'
UID, GID = os.getuid(), os.getgid()


def encoded(value): return (json.dumps(value, sort_keys=True)+'\n').encode()
def private(path, value):
    path.write_bytes(value if isinstance(value,bytes) else encoded(value));path.chmod(0o600)


class PreparationTests(unittest.TestCase):
    def fixture(self, host='orchard.example.test', alias='www.orchard.example.test', symlink=False):
        temp=tempfile.TemporaryDirectory(prefix='read-activation-owned-');self.addCleanup(temp.cleanup)
        base=Path(temp.name).resolve();bundle=base/'private-check';bundle.mkdir(mode=0o700)
        cfg=base/'configs';cfg.mkdir();(cfg/'sites').mkdir();main=cfg/'sites/main.conf';entry=cfg/'nginx.conf';pid=cfg/'pid'
        pid.write_bytes(b'424242\n');pid.chmod(0o644)
        source,binding,contract=setup(host,alias)
        if symlink:
            actual=cfg/'main.actual';actual.write_text(source);actual.chmod(0o644);main.symlink_to(actual)
        else:main.write_text(source);main.chmod(0o644)
        files={str(main):source,str(entry):'pid "'+str(pid)+'"; events {} http { include "'+str(main)+'"; }'}
        for i in range(21):files[str(cfg/('peer-'+str(i)+'.conf'))]='# synthetic peer '+str(i)+'\n'
        for path,text in files.items():
            if path!=str(main):Path(path).write_text(text);Path(path).chmod(0o644)
        rows=[dict(file_id=prepare.digest(p),sha256=prepare.digest(t),bytes=None if p==str(main) else len(t.encode()),uid=UID,mode='0o644') for p,t in files.items()]
        deployment=dict(config_prefix=str(cfg),main_path=str(main),nginx_entry=str(entry),routing=binding,protected_configurations=rows)
        spec=dict(format=1,current_deployment=deployment,auxiliary_contract=contract)
        ctx=dict(files=files,main=str(main),entry=str(entry),prefix=str(cfg),approved_files={r['file_id']:r['sha256'] for r in rows})
        candidate,_=renderer.render_reads(source,binding,auxiliary_contract=contract,configuration=ctx)
        expected=dict(result='PASS',mode='CHECK',preimage_sha256=prepare.digest(source),candidate_sha256=prepare.digest(candidate),candidate_bytes=len(candidate.encode()),policy_sha256=prepare.digest((SOURCES/'dashboard_read_policy.json').read_bytes()),approved_get_patterns=70,held_get_patterns=10,loaded_configurations=23,unchanged_peers=22,complete_private_shadow_validation='PASS',non_api_policy_unchanged=True,runtime_unchanged=True,nginx_pid_unchanged=True,live_configuration_changes=0,nginx_reloads=0,service_operations=0,checked_at_utc='2026-10-18T13:01:47.204575+00:00')
        package={n:(SOURCES/n).read_bytes() for n in ['atomic_config.py','config_parser.py','dashboard_access.py','dashboard_read_policy.json','private_config.py','root_dashboard_read_check.py']}
        package.update({'CHECK-PLAN.json':encoded({'fixture':'CHECK only'}),'APPLY-ROLLBACK-PLAN.json':encoded({'fixture':'not executable'})})
        package['DEPLOYMENT.json']=encoded(spec)
        manifest=dict(format=1,scope='ADM-01 approved dashboard reads CHECK only',deployment_sha256=prepare.digest(package['DEPLOYMENT.json']),files={n:prepare.digest(raw) for n,raw in package.items()})
        package['MANIFEST.json']=encoded(manifest)
        for name,raw in package.items():private(bundle/name,raw)
        bootstrap=(ROOT/'scripts/nginx/bootstrap_dashboard_read_check.py').read_bytes();private(bundle/'bootstrap.py',bootstrap)
        private(bundle/'CHECK-PASS.private.json',expected);private(bundle/'accepted.before.conf',source.encode());private(bundle/'checked.candidate.conf',candidate.encode())
        s=main.stat();meta=dict(path=str(main),resolved_path=str(main.resolve()),symlink_target=os.readlink(main) if symlink else None,stat_fingerprint=[s.st_dev,s.st_ino,s.st_size,s.st_uid,s.st_gid,stat.S_IMODE(s.st_mode),s.st_mtime_ns],source_sha256=prepare.digest(source),xattrs_base64={})
        private(bundle/'accepted.before.metadata.private.json',meta)
        dump=b''.join(b'# configuration file '+p.encode()+b':\n'+t.encode()+b'\n' for p,t in files.items());private(bundle/'4-accepted-live-index.stdout.private',dump)
        plan=dict(format=1,check_manifest_sha256=prepare.digest(package['MANIFEST.json']),check_deployment_sha256=prepare.digest(package['DEPLOYMENT.json']),check_bootstrap_sha256=prepare.digest(bootstrap),expected_receipt=expected)
        return base,bundle,plan,files,main,pid

    def saved(self,bundle,binding):return prepare.verify_saved(bundle,binding,UID,GID)

    def test_two_stores_saved_proof_live_metadata_pid_and_no_mutations(self):
        for host,alias,symlink in [('orchard.example.test','www.orchard.example.test',False),('merchant.other.test','shop.other.test',True)]:
            base,bundle,binding,files,main,pid=self.fixture(host,alias,symlink)
            before={p:p.read_bytes() for p in base.rglob('*') if p.is_file()}
            saved=self.saved(bundle,binding)
            result=prepare.prove_candidate(saved,renderer,check,parser)
            with patch.object(os,'listxattr',lambda *a:[],create=True):snapshots=prepare.collect_live(saved)
            self.assertEqual(len(snapshots),23);self.assertEqual(result['approved_reads'],70)
            self.assertEqual(snapshots[str(main)]['symlink_target'],os.readlink(main) if symlink else None)
            self.assertEqual(prepare.pid_evidence(files[saved['deployment']['nginx_entry']],check,parser,UID)['master_pid'],424242)
            self.assertEqual({p:p.read_bytes() for p in before},before)

    def test_receipt_flags_counts_types_and_candidate_are_exact(self):
        _,bundle,binding,_,_,_=self.fixture();original=copy.deepcopy(binding['expected_receipt'])
        for key,value in [('result','BLOCKED'),('mode','apply'),('candidate_sha256','0'*64),('candidate_bytes',1),('non_api_policy_unchanged',1),('runtime_unchanged',False),('nginx_reloads',1),('held_get_patterns',0),('checked_at_utc','later')]:
            receipt={**original,key:value};private(bundle/'CHECK-PASS.private.json',receipt)
            with self.subTest(key=key),self.assertRaisesRegex(ValueError,'CHECK_RECEIPT'):self.saved(bundle,binding)
        private(bundle/'CHECK-PASS.private.json',original)

    def test_preimage_and_candidate_byte_drift_rejected(self):
        _,bundle,binding,_,_,_=self.fixture()
        for name,code in [('accepted.before.conf','SOURCE_IDENTITY'),('checked.candidate.conf','CANDIDATE_IDENTITY')]:
            path=bundle/name;raw=path.read_bytes();private(path,raw+b'\n')
            with self.subTest(name=name),self.assertRaisesRegex(ValueError,code):self.saved(bundle,binding)
            private(path,raw)

    def test_manifest_and_frozen_source_changes_rejected(self):
        _,bundle,binding,_,_,_=self.fixture()
        path=bundle/'dashboard_access.py';raw=path.read_bytes();private(path,raw+b'\n')
        with self.assertRaisesRegex(ValueError,'CHECK_FILE_HASH'):self.saved(bundle,binding)
        private(path,raw)
        with self.assertRaisesRegex(ValueError,'CHECK_MANIFEST'):self.saved(bundle,{**binding,'check_manifest_sha256':'0'*64})

    def test_saved_peer_contents_and_index_rejected(self):
        _,bundle,binding,_,_,_=self.fixture();path=bundle/'4-accepted-live-index.stdout.private';raw=path.read_bytes()
        private(path,raw.replace(b'# synthetic peer 0',b'# drifted peer zero'))
        with self.assertRaisesRegex(ValueError,'SNAPSHOT_HASH'):self.saved(bundle,binding)
        private(path,raw+b'# configuration file /unreviewed.conf:\n# extra\n')
        with self.assertRaisesRegex(ValueError,'SNAPSHOT_INDEX'):self.saved(bundle,binding)

    def test_private_permissions_links_and_limits(self):
        base,bundle,binding,_,_,_=self.fixture();path=bundle/'CHECK-PASS.private.json';raw=path.read_bytes()
        path.chmod(0o644)
        with self.assertRaisesRegex(ValueError,'PRIVATE_METADATA'):self.saved(bundle,binding)
        path.chmod(0o600)
        with self.assertRaisesRegex(ValueError,'FILE_LIMIT'):prepare.private_read(path,UID,GID,limit=1)
        target=base/'receipt';private(target,raw);path.unlink();path.symlink_to(target)
        with self.assertRaisesRegex(ValueError,'PRIVATE_SYMLINK'):self.saved(bundle,binding)

    def test_private_workspace_metadata_and_module_shadow_rejected(self):
        base,bundle,binding,_,_,_=self.fixture();bundle.chmod(0o755)
        with self.assertRaisesRegex(ValueError,'PRIVATE_WORKSPACE'):self.saved(bundle,binding)
        bundle.chmod(0o700);(bundle/'json').mkdir()
        with self.assertRaisesRegex(ValueError,'UNEXPECTED_MODULE_PATH'):self.saved(bundle,binding)

    def test_recovery_source_path_and_stat_binding_rejected(self):
        _,bundle,binding,_,_,_=self.fixture();path=bundle/'accepted.before.metadata.private.json';meta=json.loads(path.read_bytes())
        for key,value in [('source_sha256','0'*64),('path','/unexpected/main'),('stat_fingerprint',meta['stat_fingerprint'][:2])]:
            private(path,{**meta,key:value})
            with self.subTest(key=key),self.assertRaisesRegex(ValueError,'RECOVERY_METADATA'):self.saved(bundle,binding)
        private(path,meta)

    def test_current_peer_hash_and_mode_drift_fail(self):
        _,bundle,binding,files,_,_=self.fixture();saved=self.saved(bundle,binding)
        peer=next(Path(p) for p in files if 'peer-0.conf' in p)
        with patch.object(os,'listxattr',lambda *a:[],create=True):
            peer.write_text('# wrong body\n')
            with self.assertRaisesRegex(ValueError,'CURRENT_METADATA|CURRENT_HASH'):prepare.collect_live(saved)
            peer.write_text(files[str(peer)]);peer.chmod(0o666)
            with self.assertRaisesRegex(ValueError,'CURRENT_METADATA'):prepare.collect_live(saved)

    def test_current_main_target_or_xattrs_cannot_rebase(self):
        _,bundle,binding,_,main,_=self.fixture(symlink=True);saved=self.saved(bundle,binding)
        with patch.object(os,'listxattr',lambda *a:[],create=True):
            saved['source_metadata']['resolved_path']='/unreviewed/target'
            with self.assertRaisesRegex(ValueError,'RECOVERY_METADATA'):prepare.collect_live(saved)
            saved['source_metadata']['resolved_path']=str(main.resolve())
            saved['source_metadata']['xattrs_base64']={'synthetic':'AAAA'}
            with self.assertRaisesRegex(ValueError,'RECOVERY_METADATA'):prepare.collect_live(saved)

    def test_source_to_candidate_relation_not_only_receipt_fields(self):
        _,bundle,binding,_,_,_=self.fixture();saved=self.saved(bundle,binding);saved['candidate']+=b'\n'
        with self.assertRaisesRegex(ValueError,'SOURCE_TO_CANDIDATE'):prepare.prove_candidate(saved,renderer,check,parser)

    def test_pid_file_must_exist_be_bound_and_restrictive(self):
        _,bundle,binding,files,_,pid=self.fixture();entry=files[self.saved(bundle,binding)['deployment']['nginx_entry']]
        for raw in [b'1\n',b'0\n',b'424242 garbage',b'00042\n']:
            pid.write_bytes(raw)
            with self.subTest(raw=raw),self.assertRaisesRegex(ValueError,'NGINX_PID'):prepare.pid_evidence(entry,check,parser,UID)
        pid.write_bytes(b'424242\n');pid.chmod(0o666)
        with self.assertRaisesRegex(ValueError,'NGINX_PID'):prepare.pid_evidence(entry,check,parser,UID)

    def test_exclusive_outputs_and_no_resume(self):
        base,_,_,_,_,_=self.fixture();p=base/'attempt.json'
        prepare.write_new(p,{'first':True})
        with self.assertRaises(FileExistsError):prepare.write_new(p,{'retry':True})
        self.assertEqual(json.loads(p.read_bytes()),{'first':True});self.assertEqual(stat.S_IMODE(p.stat().st_mode),0o600)

    def test_nonroot_entry_has_no_file_command_or_network_effect(self):
        self.assertNotEqual(UID,0)
        with tempfile.TemporaryDirectory() as tmp:
            before=set(Path(tmp).iterdir())
            result=subprocess.run([sys.executable,'-I','-B',str(ROOT/'scripts/nginx/prepare_dashboard_read_activation.py'),'--binding-sha256','0'*64],cwd=tmp,capture_output=True)
            self.assertEqual(result.returncode,1);report=json.loads(result.stdout)
            self.assertEqual(report['failing_check'],'ROOT_REQUIRED');self.assertEqual(set(Path(tmp).iterdir()),before)
            self.assertNotIn(b'Traceback',result.stdout+result.stderr)

    def test_no_apply_rollback_or_command_execution_entry(self):
        path=ROOT/'scripts/nginx/prepare_dashboard_read_activation.py';source=path.read_text();tree=ast.parse(source)
        imports={n.names[0].name for n in ast.walk(tree) if isinstance(n,ast.Import)}
        self.assertFalse(imports.intersection({'subprocess','socket','urllib','http'}))
        calls={ast.unparse(n.func) for n in ast.walk(tree) if isinstance(n,ast.Call)}
        self.assertFalse(calls.intersection({'os.replace','os.rename','os.unlink','os.remove','check.main','check.prepare_shadow','check.runtime_state'}))
        for mode in ['apply','rollback']:
            result=subprocess.run([sys.executable,'-I','-B',str(path),mode,'--binding-sha256','0'*64],capture_output=True)
            self.assertEqual(result.returncode,2)


if __name__=='__main__':unittest.main(verbosity=2)
