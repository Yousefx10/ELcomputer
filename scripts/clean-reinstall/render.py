#!/usr/bin/env python3
"""Render one reviewed single-site deployment. No network or target changes."""
import argparse
import ipaddress
import json
import pathlib
import re


def validate(config, mapping):
    assert config['format'] == 1
    for name in ['domain', 'alias']:
        assert re.fullmatch(r'[a-z0-9]+(?:[.-][a-z0-9]+)+', config[name])
    assert config['domain'] != config['alias']
    assert config['root'] == '/srv/' + config['service']
    assert re.fullmatch(r'[a-z][a-z0-9-]{2,24}', config['service'])
    assert re.fullmatch(r'[a-z][a-z0-9-]{2,24}', config['user'])
    assert 1024 < config['port'] < 65536
    assert config['node_version'] == '22.23.1'
    assert config['caddy_version'] == '2.11.7'
    for name in ['paths', 'query_ids']:
        for source, target in mapping[name].items():
            assert source.startswith('/') if name == 'paths' else source.isdigit()
            assert target.startswith('/') and not target.startswith('//')
            assert not any(c in source + target for c in '\r\n{}\\"')
            assert target.split('?')[0] not in mapping['paths']
    assert not set(mapping['paths']) & set(mapping['held_paths'])
    assert not set(mapping['query_ids']) & set(mapping['held_ids'])


def render(config, mapping, fixture_port=None):
    validate(config, mapping)
    domain, alias = config['domain'], config['alias']
    origin = 'https://' + domain
    q = lambda value: json.dumps(str(value), ensure_ascii=False)
    lines = ['{', '    admin off']
    if fixture_port:
        assert 1024 < fixture_port < 65536
        lines += ['    auto_https off']
    lines += ['}', '']
    sites = f'http://{domain}:{fixture_port}, http://{alias}:{fixture_port}' if fixture_port else f'http://{domain}, http://{alias}, https://{domain}, https://{alias}'
    lines += [sites + ' {']
    if fixture_port:
        lines += ['    bind 127.0.0.1']
    lines += ['    header {', '        -Server', '        X-Content-Type-Options nosniff', '        Referrer-Policy strict-origin-when-cross-origin', '        X-Frame-Options SAMEORIGIN', '    }',
              '    @sensitive path /api/admin* /dashboard /dashboard/* /ar/dashboard /ar/dashboard/*',
              '    header @sensitive Cache-Control "private, no-store"',
              '    @tls protocol https',
              '    header @tls Strict-Transport-Security "max-age=31536000"',
              '    route {']
    # Both authorities and protocols resolve legacy links directly to HTTPS apex.
    # Caddy's {path} is URL-decoded; tested with UTF-8 and percent escapes.
    lines += ['        map {path} {legacy_path} {', '            default ""']
    lines += ['            ' + q(k) + ' ' + q(v) for k, v in mapping['paths'].items()]
    lines += ['        }', '        map {query.p} {legacy_id} {', '            default ""']
    lines += ['            ' + q(k) + ' ' + q(v) for k, v in mapping['query_ids'].items()]
    lines += ['        }', '        @legacy_path expression `{legacy_path} != ""`', '        redir @legacy_path ' + origin + '{legacy_path} 301',
              '        @legacy_id {', '            path / /index.php', '            query post_type=product', '            expression `{legacy_id} != ""`', '        }',
              '        redir @legacy_id ' + origin + '{legacy_id} 301',
              '        @held_path path ' + ' '.join(q(p) for p in mapping['held_paths']),
              '        respond @held_path "Unavailable" 503',
              '        @held_id {', '            path / /index.php', '            query post_type=product', '            query p=' + ' p='.join(mapping['held_ids']), '        }',
              '        respond @held_id "Unavailable" 503',
              '        @alias host ' + alias, '        redir @alias ' + origin + '{uri} 301']
    if not fixture_port:
        lines += ['        @http protocol http', '        redir @http ' + origin + '{uri} 308']
    # Deliberate browse-only controls replace the former broad API allowlist.
    # All administrator HTTP methods reach the existing application guards.
    lines += ['        @dormant path_regexp dormant ^/(ar/)?(account|cart|checkout|login|signup|support|email)(/|$)',
              '        respond @dormant "Unavailable" 403',
              '        @commerce path /api/checkout /api/checkout/* /api/payments /api/payments/* /api/internal /api/internal/* /api/webhooks /api/webhooks/* /api/customer-* /api/account /api/account/* /api/support /api/support/* /api/chat /api/chat/* /api/cart /api/cart/* /api/admin-system-reset /api/admin-system-reset/* /api/admin-erp/sync',
              '        respond @commerce "Unavailable" 403',
              '        @private path_regexp private (?i)(^|/)(\\.[^/]*|private|backups?)(/|$)',
              '        respond @private "Not found" 404',
              '        reverse_proxy 127.0.0.1:' + str(config['port']) + ' {',
              '            lb_try_duration 0',
              '            transport http {', '                dial_timeout 5s', '            }',
              '        }', '    }', '}', '']
    if not fixture_port:
        lines += ['http:// {', '    respond "Unknown site" 421', '}', '']
    return '\n'.join(lines)


def units(config):
    root, service = config['root'], config['service']
    app = f'''[Unit]
Description=Nuxt storefront
After=network-online.target
Wants=network-online.target
StartLimitIntervalSec=120
StartLimitBurst=3

[Service]
Type=simple
User={config['user']}
Group={config['user']}
WorkingDirectory={root}/current
EnvironmentFile=/etc/{service}/runtime.env
ExecStart=/opt/node-v{config['node_version']}-linux-x64/bin/node {root}/current/server/index.mjs
Restart=on-failure
RestartSec=10
TimeoutStopSec=30
KillSignal=SIGTERM
UMask=0027
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict
ReadWritePaths={root}/shared/uploads
RestrictSUIDSGID=true
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
'''
    caddy = '''[Unit]
Description=Caddy HTTPS reverse proxy
After=network-online.target
Wants=network-online.target
StartLimitIntervalSec=120
StartLimitBurst=3

[Service]
Type=notify
User=caddy
Group=caddy
ExecStart=/usr/local/bin/caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
TimeoutStopSec=5
KillMode=mixed
Restart=on-failure
RestartSec=10
LimitNOFILE=1048576
AmbientCapabilities=CAP_NET_BIND_SERVICE
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict
ReadWritePaths=/var/lib/caddy
Environment=XDG_DATA_HOME=/var/lib/caddy XDG_CONFIG_HOME=/var/lib/caddy

[Install]
WantedBy=multi-user.target
'''
    return app, caddy


if __name__ == '__main__':
    a = argparse.ArgumentParser()
    a.add_argument('config'); a.add_argument('mapping'); a.add_argument('output')
    a.add_argument('--fixture-port', type=int)
    args = a.parse_args()
    cfg, mappings = json.loads(pathlib.Path(args.config).read_text()), json.loads(pathlib.Path(args.mapping).read_text())
    output = pathlib.Path(args.output); output.mkdir(mode=0o700)
    (output / 'Caddyfile').write_text(render(cfg, mappings, args.fixture_port))
    app, caddy = units(cfg)
    (output / (cfg['service'] + '.service')).write_text(app)
    (output / 'caddy.service').write_text(caddy)
