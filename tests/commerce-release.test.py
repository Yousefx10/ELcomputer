import importlib.util, json, pathlib, sys, tempfile, unittest
from unittest.mock import patch

HERE=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('commerce_remote',HERE/'scripts/commerce-release/remote.py')
remote=importlib.util.module_from_spec(spec);spec.loader.exec_module(remote)

class ReleaseGuards(unittest.TestCase):
    def test_approval_required_before_every_mutating_mode(self):
        plan={'format':1,'target':{'host':'fixture.invalid'}};plan['seal']=remote.digest(plan)
        for mode in ['prepare','stage','provision','candidate','activate']:
            with self.subTest(mode=mode),patch.object(sys,'argv',['remote.py',mode,json.dumps(plan),'--approved','0'*64]),patch.object(remote,'paths',side_effect=AssertionError('MUTATION WAS REACHED')) as paths:
                with self.assertRaises(AssertionError):remote.main()
                paths.assert_not_called()

    def test_environment_is_parsed_without_execution_or_key_rewriting(self):
        raw=b'URL="https://fixture.invalid"\nSECRET="literal$(touch /not-executed)"\nPORT="3000"\n'
        with patch.object(remote.subprocess,'run',side_effect=AssertionError('EXECUTION FORBIDDEN')):
            values=remote.env_values(raw)
        self.assertEqual(values['SECRET'],'literal$(touch /not-executed)')
        self.assertEqual(values['PORT'],'3000')
        with self.assertRaises(AssertionError):remote.env_values(b'PORT=3000\nPORT=4000\n')

    def test_foreign_root_is_rejected_before_reading_host_state(self):
        with self.assertRaises(AssertionError):remote.paths({'target':{'root':'/home/retired','service':'storefront','user':'storefront'}})

    def test_activation_failure_retains_both_releases_and_never_restarts_caddy_or_rolls_back(self):
        with tempfile.TemporaryDirectory(prefix='owned-commerce-') as directory:
            root=pathlib.Path(directory).resolve();old=root/'releases/old';new=root/'releases/new'
            old.mkdir(parents=True);new.mkdir();(old/'saved').write_text('old');(new/'saved').write_text('new')
            (root/'current').symlink_to(old);stage=root/'private';stage.mkdir();(stage/'candidate-pass.json').write_text('{}')
            target={'service':'fixture','port':12345};p={'target':target,'release_id':'new','before':{'current':str(old),'caddy_pid':456,'main_pid':123,'caddy_sha256':'x','unit_sha256':'x','updated_env_sha256':'x'}}
            def command(args,timeout=30):return '456' if 'caddy.service' in args else '123'
            with patch.object(remote,'paths',return_value=(target,root,stage)),patch.object(remote,'sha',return_value='x'),patch.object(remote,'command',side_effect=command),patch.object(remote,'probe_http',return_value=False),patch.object(remote.time,'sleep'),patch.object(remote.subprocess,'run') as calls:
                with self.assertRaises(AssertionError):remote.activate(p)
            self.assertEqual((root/'current').resolve(),new)
            self.assertTrue((stage/'activation-intent.json').is_file())
            self.assertEqual((old/'saved').read_text(),'old');self.assertEqual((new/'saved').read_text(),'new')
            self.assertEqual(calls.call_count,1)
            self.assertEqual(calls.call_args.args[0],['systemctl','restart','fixture.service'])

    def test_vendor_decoder_has_no_network_and_no_external_autodetection(self):
        config=json.loads((HERE/'scripts/commerce-release/decoder.json').read_text())
        self.assertEqual(config['version'],'8.0.3')
        self.assertIn('--disable-network',config['configure']);self.assertIn('--disable-autodetect',config['configure'])
        self.assertIn('--enable-protocol=file',config['configure'])
        self.assertEqual(config['signing_fingerprint'],'FCF986EA15E6E293A5644F10B4322F04D67658D8')

if __name__=='__main__':unittest.main()
