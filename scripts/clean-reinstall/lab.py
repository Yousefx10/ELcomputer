#!/usr/bin/env python3
"""Complete a disposable Ubuntu lab using synthetic backend credentials only."""
import hashlib
import http.client
import json
import os
import pathlib
import subprocess
import sys
import time


def main():
    assert os.geteuid() == 0
    kit = pathlib.Path(sys.argv[1]).resolve(); cfg = json.loads((kit / 'config.json').read_text())
    assert cfg['domain'] == 'orchid.example.invalid' and cfg['supabase_project'] == 'local-fixture-only'
    marker = pathlib.Path('/var/lib/clean-storefront-install'); proof = marker / 'lab.json'
    boot = pathlib.Path('/proc/sys/kernel/random/boot_id').read_text().strip()
    def run(*args): subprocess.run(args, check=True)
    def verify_probe(record):
        conn = http.client.HTTPConnection('127.0.0.1', 8080)
        conn.request('GET', '/uploads/' + record['probe'], headers={'Host': cfg['domain']})
        r = conn.getresponse(); data = r.read(); conn.close()
        assert r.status == 200 and hashlib.sha256(data).hexdigest() == record['sha256']
    if len(sys.argv) == 3 and sys.argv[2] == '--after-reboot':
        record = json.loads(proof.read_text()); assert record['boot_id'] != boot
        for unit in [cfg['service'], 'caddy', 'storefront-fixture']:
            run('systemctl', 'is-enabled', '--quiet', unit); run('systemctl', 'is-active', '--quiet', unit)
        verify_probe(record)
        run('python3', str(kit / 'health.py'), str(kit), '--origin', 'http://127.0.0.1:8080', '--fixture')
        (marker / 'LINUX-REBOOT-PASS.json').write_text(json.dumps({'result': 'PASS', 'previous_boot_id': record['boot_id'], 'new_boot_id': boot, 'production_connected': False}) + '\n')
        print('LINUX REBOOT PASS. Export lab receipts; this does not authorize VPS reinstall.')
        return
    assert len(sys.argv) == 2 and not proof.exists()
    fixture = marker / 'fixture'; fixture.mkdir(mode=0o755)
    backend = '''from http.server import BaseHTTPRequestHandler,HTTPServer
import json
class Handler(BaseHTTPRequestHandler):
 def do_GET(self):
  value=[]
  if self.path.split('?')[0]=='/rest/v1/site_settings':
   s={'key':'default','site_name':'Local laboratory','seo_site_url':'https://orchid.example.invalid','payment_cash_enabled':False,'payment_card_enabled':False,'payment_bank_transfer_enabled':False,'payment_instapay_enabled':False,'payment_paypal_enabled':False}
   value=s if 'object' in self.headers.get('Accept','') else [s]
  self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(json.dumps(value).encode())
 def log_message(self,*args):pass
HTTPServer(('127.0.0.1',18081),Handler).serve_forever()
'''
    (fixture / 'backend.py').write_text(backend); (fixture / 'backend.py').chmod(0o644)
    guard = "const f=globalThis.fetch;globalThis.fetch=(input,init)=>{const u=new URL(typeof input==='string'||input instanceof URL?input:input.url);if(!['127.0.0.1','localhost','[::1]'].includes(u.hostname))throw Error('External lab fetch denied');return f(input,init)};\n"
    (fixture / 'guard.mjs').write_text(guard); (fixture / 'guard.mjs').chmod(0o644)
    marker.chmod(0o755)  # lab-only public fixture, no production secrets present
    unit = f'''[Unit]
After=network.target
[Service]
User={cfg['user']}
ExecStart=/usr/bin/python3 {fixture}/backend.py
Restart=on-failure
[Install]
WantedBy=multi-user.target
'''
    pathlib.Path('/etc/systemd/system/storefront-fixture.service').write_text(unit)
    values = {'NODE_ENV': 'production', 'HOST': '127.0.0.1', 'NITRO_HOST': '127.0.0.1', 'PORT': str(cfg['port']), 'NITRO_PORT': str(cfg['port']),
              'NUXT_PUBLIC_SITE_URL': 'https://' + cfg['domain'], 'NUXT_PUBLIC_SUPABASE_URL': 'http://127.0.0.1:18081',
              'NUXT_PUBLIC_SUPABASE_KEY': 'local-fixture-only', 'NUXT_SUPABASE_SERVICE_ROLE_KEY': 'local-fixture-only',
              'NUXT_UPLOADS_DIR': cfg['root'] + '/shared/uploads', 'UPLOADS_DIR': cfg['root'] + '/shared/uploads',
              'NUXT_PAYMOB_ENABLED': 'false', 'NUXT_SHIPPING_LIVE_REQUESTS_ENABLED': 'false', 'NODE_OPTIONS': '--import=' + str(fixture / 'guard.mjs')}
    env = pathlib.Path('/etc') / cfg['service'] / 'runtime.env'
    with env.open('x') as f: f.write(''.join(k + '=' + json.dumps(v) + '\n' for k, v in values.items()))
    env.chmod(0o600)
    run('python3', str(kit / 'restore-media.py'), str(kit))  # inherits public media stdin
    recovery = {'runtime_env_sha256': hashlib.sha256(env.read_bytes()).hexdigest(), 'media_manifest_sha256': hashlib.sha256((kit / 'media-manifest.json').read_bytes()).hexdigest()}
    (marker / 'recovery.json').write_text(json.dumps(recovery) + '\n')
    run('systemctl', 'daemon-reload'); run('systemctl', 'enable', '--now', 'storefront-fixture.service')
    run('python3', str(kit / 'deploy.py'), str(kit), '--activate-new-host')
    run('python3', str(kit / 'health.py'), str(kit), '--origin', 'http://127.0.0.1:8080', '--fixture')
    files = json.loads((kit / 'media-manifest.json').read_text()); first = next(iter(files)); suffix = pathlib.Path(first).suffix
    probe = 'products/restart-proof' + suffix; uploads = pathlib.Path(cfg['root']) / 'shared/uploads'
    run('runuser', '-u', cfg['user'], '--', 'cp', '--', str(uploads / first), str(uploads / probe))
    run('runuser', '-u', cfg['user'], '--', 'ln', '--', str(uploads / probe), str(uploads / 'products/.pending-hardlink-proof'))
    record = {'boot_id': boot, 'probe': probe, 'sha256': files[first]['sha256'], 'kit': str(kit)}
    verify_probe(record); run('systemctl', 'restart', cfg['service'])
    for _ in range(60):
        try: verify_probe(record); break
        except Exception: time.sleep(.5)
    else: raise AssertionError('Image did not survive application restart')
    proof.write_text(json.dumps(record, indent=2) + '\n')
    (marker / 'LINUX-FIRST-PASS.json').write_text(json.dumps({'result': 'PASS', 'systemd_units_verified': True, 'public_media_restored': len(files), 'restart_and_hardlink_pass': True, 'reboot': 'pending', 'production_connected': False}) + '\n')
    print('LAB FIRST PASS. Reboot ONLY this disposable VM, then run:')
    print('python3 ' + str(kit / 'lab.py') + ' ' + str(kit) + ' --after-reboot')


if __name__ == '__main__': main()
