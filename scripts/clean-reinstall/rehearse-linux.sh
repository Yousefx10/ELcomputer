#!/bin/bash
# ONLY a disposable local Ubuntu 24.04 VM. Never the existing VPS.
set -euo pipefail
umask 077
if [[ $# -ne 2 || "$1" != --disposable-local-lab ]]; then
  echo 'Usage: rehearse-linux.sh --disposable-local-lab /absolute/kit' >&2
  exit 1
fi
test "$(id -u)" = 0
test ! -e /etc/nginx
test ! -e /home/elcomputer/main-runtime
python3 - "$2/config.json" <<'PY'
import json,subprocess,sys,pathlib
cfg=json.loads(pathlib.Path(sys.argv[1]).read_text())
interfaces=json.loads(subprocess.check_output(['ip','-j','address']))
assert all(a.get('local') != cfg['existing_vps'] for i in interfaces for a in i.get('addr_info',[]))
PY
KIT="$2"
LAB="$(mktemp -d /var/tmp/storefront-lab.XXXXXXXX)"
cp -R "$KIT" "$LAB/kit"
python3 - "$LAB/kit" <<'PY'
import sys,pathlib,json,hashlib
k=pathlib.Path(sys.argv[1]);c=json.loads((k/'config.json').read_text());old=c['domain']
c.update(domain='orchid.example.invalid',alias='www.orchid.example.invalid',supabase_project='local-fixture-only')
(k/'config.json').write_text(json.dumps(c,indent=2)+'\n')
# Caddy fixture listens on loopback HTTP only, with the SAME routing body.
text=(k/'Caddyfile').read_text().replace(old,'orchid.example.invalid')
text=text.replace('admin off','admin off\n    auto_https off')
start=text.index('http://orchid.example.invalid,')
end=text.index(' {',start)
text=text[:start]+'http://orchid.example.invalid:8080, http://www.orchid.example.invalid:8080'+text[end:]
text=text.replace('    header {','    bind 127.0.0.1\n    header {',1)
text=text[:text.index('\nhttp:// {')]
text=text.replace('        @http protocol http\n        redir @http https://orchid.example.invalid{uri} 308\n','')
(k/'Caddyfile').write_text(text)
s={f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in k.iterdir() if f.name!='SHA256.json'}
(k/'SHA256.json').write_text(json.dumps(s,indent=2)+'\n')
PY
python3 "$LAB/kit/install.py" "$LAB/kit" --fresh-machine-id "$(cat /etc/machine-id)"
# stdin contains ONLY the authenticated public-image archive. No production env.
python3 "$LAB/kit/lab.py" "$LAB/kit"
