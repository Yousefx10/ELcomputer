import importlib.util, json, pathlib, sys, tempfile, unittest
from unittest.mock import patch

HERE=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('live_remote',HERE/'scripts/live-sales-release/remote.py')
remote=importlib.util.module_from_spec(spec);spec.loader.exec_module(remote)

class LiveReleaseGuards(unittest.TestCase):
    def test_all_mutations_reject_wrong_approval_before_target_access(self):
        plan={'format':1,'target':{'host':'fixture.invalid'}};plan['seal']=remote.digest(plan)
        for mode in ['prepare','stage','provision','candidate','activate']:
            with self.subTest(mode=mode),patch.object(sys,'argv',['remote.py',mode,json.dumps(plan),'--approved','0'*64]),patch.object(remote,'paths') as paths:
                with self.assertRaises(AssertionError):remote.main()
                paths.assert_not_called()

    def test_environment_preserves_literal_secrets_without_shell_execution(self):
        raw=b'KEY="literal$(touch /not-executed)"\nPORT="3000"\n'
        with patch.object(remote.subprocess,'run',side_effect=AssertionError('execution forbidden')):
            self.assertEqual(remote.env_values(raw)['KEY'],'literal$(touch /not-executed)')
        with self.assertRaises(AssertionError):remote.env_values(b'PORT=3000\nPORT=4000\n')

    def test_only_document_path_and_false_gate_are_added_for_two_stores(self):
        for root in ['/srv/store-one','/srv/store-two']:
            target={'documents_dir':root+'/shared/private/shipping-documents'}
            self.assertEqual(remote.env_values(remote.additions(target)),{'NUXT_SHIPPING_DOCUMENTS_DIR':target['documents_dir'],'NUXT_PAYMOB_LIVE_REQUESTS_ENABLED':'false'})
            target.update(root=root,user='fixture',packing_dir=root+'/shared/private/packing-videos')
            sandbox=remote.sandbox(target)
            self.assertIn('--property=ProtectSystem=strict',sandbox)
            self.assertIn('--property=ReadWritePaths='+root+'/shared/uploads '+target['packing_dir']+' '+target['documents_dir'],sandbox)

    def test_source_drift_is_not_ignored_as_capacity_or_timestamp(self):
        before={'observed_utc':'a','free_bytes':123,'current':'old','media':{'sha256':'abc'}}
        self.assertEqual(remote.stable(before),remote.stable({**before,'observed_utc':'b','free_bytes':456}))
        self.assertNotEqual(remote.stable(before),remote.stable({**before,'media':{'sha256':'changed'}}))

    def test_failed_activation_retains_evidence_and_old_release_without_retry(self):
        with tempfile.TemporaryDirectory(prefix='owned-live-release-') as directory:
            root=pathlib.Path(directory).resolve();old=root/'releases/old';new=root/'releases/new'
            old.mkdir(parents=True);new.mkdir();(old/'saved').write_text('old');(new/'saved').write_text('new')
            (root/'current').symlink_to(old);stage=root/'private';stage.mkdir();(stage/'candidate-pass.json').write_text('{}')
            target={'service':'fixture','port':12345};before={'current':str(old),'nuxt':{'MainPID':'123'},'caddy':{'MainPID':'456'},'recovery_files':{}}
            p={'target':target,'release_id':'new','before':before}
            with patch.object(remote,'paths',return_value=(target,root,stage)),patch.object(remote,'service',side_effect=lambda name:before['caddy'] if name=='caddy.service' else before['nuxt']),patch.object(remote,'probe_http',return_value=False),patch.object(remote.time,'sleep'),patch.object(remote.subprocess,'run') as calls:
                with self.assertRaises(AssertionError):remote.activate(p)
            self.assertEqual((root/'current').resolve(),new)
            self.assertTrue((stage/'activation-intent.json').is_file())
            self.assertEqual((old/'saved').read_text(),'old');self.assertEqual((new/'saved').read_text(),'new')
            self.assertEqual(calls.call_count,1);self.assertEqual(calls.call_args.args[0],['systemctl','restart','fixture.service'])
            with patch.object(remote,'paths',return_value=(target,root,stage)):
                with self.assertRaises(AssertionError):remote.activate(p)

if __name__=='__main__':unittest.main()
