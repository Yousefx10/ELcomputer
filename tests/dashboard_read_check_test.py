"""Disposable CHECK/helper tests. Never runs root, SSH, APPLY or a live service."""
import copy
import hashlib
import http.server
import io
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import tarfile
import tempfile
import threading
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts/nginx'))
import root_dashboard_read_check as check
import bootstrap_dashboard_read_check as bootstrap
from dashboard_access import digest, render, render_reads, validate_binding
from config_parser import parse
from private_config import loaded_names, read_baseline, shadow_tree
from dashboard_access_test import fixture


def make_archive(files, extra=None):
    manifest = dict(format=1, scope='ADM-01 approved dashboard reads CHECK only',
                    files={name:check.digest(raw) for name, raw in files.items()})
    manifest_raw = json.dumps(manifest).encode()
    out = io.BytesIO()
    with tarfile.open(fileobj=out, mode='w', format=tarfile.USTAR_FORMAT) as archive:
        for name, raw in {**files, 'MANIFEST.json': manifest_raw}.items():
            info = tarfile.TarInfo(name); info.size = len(raw); info.mode = 0o600
            archive.addfile(info, io.BytesIO(raw))
        if extra:
            archive.addfile(*extra)
    return out.getvalue(), check.digest(manifest_raw)


class CheckSafetyTests(unittest.TestCase):
    def test_root_entry_and_bootstrap_refuse_nonroot_without_file_or_network_access(self):
        self.assertNotEqual(os.geteuid(), 0, 'These tests must run as a normal local user')
        for program, args in [('root_dashboard_read_check.py', ['--manifest-sha256', '0'*64]),
                              ('bootstrap_dashboard_read_check.py', ['--archive', '/no-such-fixture', '--archive-sha256', '0'*64,
                                                                    '--manifest-sha256', '0'*64, '--staging-uid', str(os.getuid())])]:
            with tempfile.TemporaryDirectory() as directory:
                before = set(Path(directory).iterdir())
                response = subprocess.run([sys.executable, '-I', '-B', str(ROOT/'scripts/nginx'/program), *args],
                                          cwd=directory, capture_output=True)
                self.assertEqual(response.returncode, 1)
                self.assertEqual(json.loads(response.stdout)['result'], 'BLOCKED')
                self.assertNotIn(b'Traceback', response.stdout + response.stderr)
                self.assertEqual(set(Path(directory).iterdir()), before)

    def test_no_apply_or_rollback_cli(self):
        for mode in ('apply', 'rollback'):
            result = subprocess.run([sys.executable, '-I', '-B', str(ROOT/'scripts/nginx/root_dashboard_read_check.py'),
                                     mode, '--manifest-sha256', '0'*64], capture_output=True)
            self.assertEqual(result.returncode, 2)

    def test_package_is_verified_in_memory_before_extracting_any_member(self):
        raw, manifest = make_archive({'safe.py': b'# reviewed fixture'})
        self.assertEqual(bootstrap.unpack_verified(raw, manifest)['safe.py'], b'# reviewed fixture')
        with self.assertRaisesRegex(ValueError, 'MANIFEST_HASH'):
            bootstrap.unpack_verified(raw, '0'*64)
        for name, kind in [('../escape.py', tarfile.REGTYPE), ('/escape.py', tarfile.REGTYPE),
                           ('nested/escape.py', tarfile.REGTYPE), ('safe.py', tarfile.REGTYPE),
                           ('symlink.py', tarfile.SYMTYPE), ('hardlink.py', tarfile.LNKTYPE), ('bootstrap.py', tarfile.REGTYPE)]:
            item = tarfile.TarInfo(name); item.mode = 0o600; item.type = kind
            invalid, manifest = make_archive({'safe.py': b'# fixture'}, (item, None))
            with self.subTest(name=name), self.assertRaisesRegex(ValueError, 'ARCHIVE_MEMBER'):
                bootstrap.unpack_verified(invalid, manifest)

    def test_archive_intake_rejects_wrong_hash_modes_and_links(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/'bundle.tar'; path.write_bytes(b'fixture'); path.chmod(0o600)
            self.assertEqual(bootstrap.archive_read(path, check.digest(b'fixture'), os.getuid()), b'fixture')
            with self.assertRaisesRegex(ValueError, 'STAGED_ARCHIVE_HASH'):
                bootstrap.archive_read(path, '0'*64, os.getuid())
            link = path.with_name('alias.tar'); link.symlink_to(path)
            with self.assertRaises(OSError): bootstrap.archive_read(link, check.digest(b'fixture'), os.getuid())
            path.chmod(0o644)
            with self.assertRaisesRegex(ValueError, 'STAGED_ARCHIVE_METADATA'):
                bootstrap.archive_read(path, check.digest(b'fixture'), os.getuid())

    def test_exclusive_private_writes_cannot_resume_an_attempt(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/'CHECK-STARTED.private.json'
            bootstrap.write_new(path, b'first attempt')
            self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600)
            with self.assertRaises(FileExistsError): bootstrap.write_new(path, b'retry')
            self.assertEqual(path.read_bytes(), b'first attempt')

    def test_accepted_receipt_only_substitutes_main_not_peer_or_runtime_bindings(self):
        legacy = dict(main_path='/fixture/main.conf', routing=dict(source_sha256='1'*64),
                      protected_configurations=[dict(file_id=check.digest('/fixture/main.conf'),sha256='1'*64,bytes=None),
                                                dict(file_id=check.digest('/fixture/peer.conf'),sha256='2'*64,bytes=99)],
                      runtime=dict(unit='independent.service', port=9001))
        receipt = dict(result='PASS',mode='apply',manifest_sha256='3'*64,replacement='replacement-acknowledged',
                       reload='acknowledged',live_configuration_changes=1,candidate_sha256='4'*64,candidate_bytes=1555)
        raw = json.dumps(receipt).encode()
        current = copy.deepcopy(legacy);current['routing']['source_sha256']='4'*64
        current['protected_configurations'][0]['sha256']='4'*64
        spec = dict(current_deployment=current, accepted_ingress=dict(apply_receipt_sha256=check.digest(raw),manifest_sha256='3'*64,
                    main_sha256='4'*64,loaded_configurations=2,unchanged_peers=1))
        value = check.accepted_deployment(spec,legacy,raw)
        self.assertEqual(value['protected_configurations'][0]['bytes'],1555)
        self.assertIsNone(current['protected_configurations'][0]['bytes'])
        for change in ('peer', 'runtime', 'old-main', 'receipt', 'ack'):
            s=copy.deepcopy(spec);r=copy.deepcopy(receipt)
            if change=='peer':s['current_deployment']['protected_configurations'][1]['sha256']='5'*64
            if change=='runtime':s['current_deployment']['runtime']['unit']='other.service'
            if change=='old-main':s['current_deployment']['routing']['source_sha256']='1'*64
            if change=='receipt':s['accepted_ingress']['apply_receipt_sha256']='0'*64
            if change=='ack':
                r['reload']='attempted';s['accepted_ingress']['apply_receipt_sha256']=check.digest(json.dumps(r).encode())
            with self.subTest(change=change),self.assertRaises(ValueError):check.accepted_deployment(s,legacy,json.dumps(r).encode())

    def test_command_scope_rejects_signals_mutations_and_shells(self):
        d=dict(nginx='/fixture/nginx',systemctl='/fixture/systemctl',ss='/fixture/ss',nginx_entry='/fixture/nginx.conf',
               runtime=dict(unit='store.service'),nginx_unit='proxy.service')
        root=Path('/fixture/review')
        self.assertTrue(check.command_allowed(['/fixture/nginx','-T'],d,root))
        self.assertTrue(check.command_allowed(['/fixture/nginx','-T','-p','/fixture','-c','/fixture/review/check-shadow/fixture/nginx.conf'],d,root))
        for argv in [[],['/fixture/nginx','-s','reload'],['/fixture/nginx','-T','-s','reload'],
                     ['/fixture/systemctl','reload','proxy.service'],['/fixture/systemctl','restart','store.service'],
                     ['/bin/sh','-c','anything'],['/fixture/nginx','-T','-p','/fixture','-c','/etc/nginx/nginx.conf']]:
            self.assertFalse(check.command_allowed(argv,d,root),argv)

    def test_runtime_inventory_detects_content_or_extra_file_drift(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory).resolve();file=root/'index.mjs';file.write_bytes(b'fixture');file.chmod(0o600)
            expected={'index.mjs':dict(type='file',mode=0o600,bytes=7,sha256=check.digest(b'fixture'))}
            check.verify_tree(root,expected,os.getuid())
            file.write_bytes(b'drift!!')
            with self.assertRaisesRegex(ValueError,'RUNTIME_TREE_DRIFT'):check.verify_tree(root,expected,os.getuid())

    def test_nginx_pid_guard_requires_existing_bound_file_and_rejects_missing_or_wrong_pid(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'nginx.pid';entry='pid "'+str(path)+'"; events {}'
            with self.assertRaises(FileNotFoundError):check.nginx_pid_snapshot(entry,424242,parse,os.getuid())
            path.write_bytes(b'424242\n');path.chmod(0o644)
            before=check.nginx_pid_snapshot(entry,424242,parse,os.getuid())
            self.assertEqual(check.nginx_pid_snapshot(entry,424242,parse,os.getuid()),before)
            with self.assertRaisesRegex(ValueError,'NGINX_PID_IDENTITY'):check.nginx_pid_snapshot(entry,111,parse,os.getuid())
            path.chmod(0o666)
            with self.assertRaisesRegex(ValueError,'NGINX_PID_METADATA'):check.nginx_pid_snapshot(entry,424242,parse,os.getuid())

    def test_commerce_probes_are_only_bounded_loopback_gets_without_credentials_or_redirects(self):
        paths=[]
        class Handler(http.server.BaseHTTPRequestHandler):
            enabled=False
            redirect=False
            def log_message(self,*args): pass
            def do_GET(self):
                paths.append((self.path,self.headers.get('Authorization'),self.headers.get('apikey')))
                if self.redirect:
                    self.send_response(302);self.send_header('Location','http://127.0.0.1:'+str(self.server.server_port)+'/unexpected');self.end_headers();return
                data={'card':{'available':False},'express':[]} if self.path=='/api/payments/capabilities' else [{'data':{'payment_cash_enabled':self.enabled}}]
                raw=json.dumps(data).encode();self.send_response(200);self.end_headers();self.wfile.write(raw)
        server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler);thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        try:
            _,binding=fixture(upstream=server.server_port)
            d=dict(routing=binding,disabled_setting_keys=['payment_cash_enabled'])
            check.disabled_commerce(d,validate_binding)
            self.assertEqual(paths,[('/api/payments/capabilities',None,None),('/api/storefront/content',None,None)])
            Handler.enabled=True
            with self.assertRaisesRegex(ValueError,'COMMERCE_SETTING_DRIFT'):check.disabled_commerce(d,validate_binding)
            Handler.redirect=True;paths.clear()
            with self.assertRaises(Exception):check.disabled_commerce(d,validate_binding)
            self.assertEqual([p[0] for p in paths],['/api/payments/capabilities'])
        finally:server.shutdown();server.server_close();thread.join()


@unittest.skipUnless(os.environ.get('DASHBOARD_REVIEW_NGINX'),'Set isolated Nginx executable')
class CompleteShadowTests(unittest.TestCase):
    def prepare(self,host='orchard.example.test',alias='www.orchard.example.test',invalid_peer=False,extra_include=False):
        temp=tempfile.TemporaryDirectory(prefix='read-check-owned-');self.addCleanup(temp.cleanup)
        root=Path(temp.name).resolve();(root/'sites').mkdir();(root/'snips').mkdir();work=root/'private-check';work.mkdir(mode=0o700)
        main=root/'sites/main.conf';entry=root/'nginx.conf';peer=root/'sites/peer.conf';headers=root/'snips/server-headers.conf';http_headers=root/'snips/http-headers.conf'
        source,binding=fixture(host,alias,edge=19001,upstream=19002)
        # fixture already includes an unrelated peer server. The extra loaded
        # peer here proves complete include coverage, not an isolated snippet.
        source=source.replace(' add_header X-Content-Type-Options nosniff always;\n','').replace(' add_header Content-Security-Policy "frame-ancestors \'self\'" always;\n','')
        source=source.replace('server_name '+host+' store-internal-alias.test;', 'server_name '+host+' store-internal-alias.test; include "'+str(headers)+'";')
        binding['variable_prefix']='independent_reads' if host.startswith('merchant') else 'orchard_reads'
        binding['source_sha256']=digest(source)
        contents={str(entry):'error_log "'+str(root/'nginx-error.log')+'"; pid "'+str(root/'nginx.pid')+'"; events {} http { access_log off; client_body_temp_path "'+str(root/'body')+'"; proxy_temp_path "'+str(root/'proxy')+'"; fastcgi_temp_path "'+str(root/'fastcgi')+'"; uwsgi_temp_path "'+str(root/'uwsgi')+'"; scgi_temp_path "'+str(root/'scgi')+'"; include "'+str(http_headers)+'"; include "'+str(root/'sites/*.conf')+'"; }',
                  str(main):source,str(peer):'INVALID PEER;' if invalid_peer else '# PRIVATE-FIXTURE-CANARY\nserver { listen 127.0.0.1:19001; server_name independent-peer.test; return 418; }',
                  str(headers):'add_header X-Frame-Options DENY always;',str(http_headers):'add_header Strict-Transport-Security "max-age=86400" always;'}
        for path,text in contents.items():Path(path).write_text(text)
        (root/'nginx.pid').write_bytes(b'424242\n')
        d=dict(main_path=str(main),nginx_entry=str(entry),config_prefix=str(root),routing=binding,nginx=os.environ['DASHBOARD_REVIEW_NGINX'])
        source_headers=check.inherited_headers(contents,d,parse,validate_binding)
        accepted,_=render(source,binding,source_headers);contents[str(main)]=accepted;main.write_text(accepted)
        binding['source_sha256']=digest(accepted)
        if extra_include:
            unreviewed=root/'sites/unreviewed.conf';unreviewed.write_text('# Unreviewed include\n')
        calls=[]
        def command(argv,label):
            calls.append((argv,label));result=subprocess.run(argv,capture_output=True,timeout=20)
            if result.returncode:raise ValueError('PRIVATE_COMMAND_FAILED')
            return result
        before={p:Path(p).read_bytes() for p in contents}
        return root,work,contents,d,command,calls,before

    def test_two_businesses_full_include_shadow_headers_and_no_live_changes(self):
        for host,alias in [('orchard.example.test','www.orchard.example.test'),('merchant.other.test','shop.other.test')]:
            with self.subTest(host=host):
                root,work,contents,d,command,calls,before=self.prepare(host,alias)
                candidate,result=check.prepare_shadow(contents,d,work,command,parse,render_reads,validate_binding,shadow_tree,loaded_names)
                self.assertEqual(result['approved_reads'],70);self.assertEqual(result['held_reads'],10)
                self.assertIn('add_header X-Frame-Options DENY always;',candidate)
                self.assertEqual({p:Path(p).read_bytes() for p in contents},before)
                self.assertEqual(len(calls),2)
                self.assertEqual(calls[-1][0][1],'-T')
                self.assertEqual(len([p for p in (work/'check-shadow').rglob('*') if p.is_file() and not p.is_symlink()]),5)
                self.assertEqual((root/'nginx.pid').read_bytes(),b'424242\n')

    def test_full_shadow_rejects_peer_syntax_failure(self):
        _,work,contents,d,command,_,before=self.prepare(invalid_peer=True)
        with self.assertRaisesRegex(ValueError,'PRIVATE_COMMAND_FAILED'):
            check.prepare_shadow(contents,d,work,command,parse,render_reads,validate_binding,shadow_tree,loaded_names)
        self.assertEqual({p:Path(p).read_bytes() for p in contents},before)

    def test_wildcard_include_expansion_cannot_admit_unreviewed_file(self):
        _,work,contents,d,command,calls,_=self.prepare(extra_include=True)
        with self.assertRaisesRegex(Exception,'INCLUDE_NOT_IN_REVIEWED_INDEX'):
            check.prepare_shadow(contents,d,work,command,parse,render_reads,validate_binding,shadow_tree,loaded_names)
        self.assertEqual(calls,[])

    def test_non_api_projection_detects_method_host_redirect_and_private_page_drift(self):
        _,_,contents,d,_,_,_=self.prepare()
        accepted=contents[d['main_path']]
        for before,after in [('return 301 https://','return 302 https://'),('account|checkout','checkout'),('GET|HEAD','GET|HEAD|POST')]:
            changed=accepted.replace(before,after)
            self.assertNotEqual(check.non_api_projection(accepted,parse),check.non_api_projection(changed,parse))


if __name__=='__main__':unittest.main(verbosity=2)
