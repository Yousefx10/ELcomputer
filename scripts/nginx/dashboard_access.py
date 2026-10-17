"""Pure, fail-closed ADM-01 renderer for the existing browse-only policy.

Deployment identity is supplied by a separately reviewed binding. This module
does no I/O and makes no authentication decisions. Nuxt/RLS remain authoritative.
"""
import hashlib
import re
from urllib.parse import urlsplit

from config_parser import parse, walk

READ_APIS = (
    '/api/admin-erp/state',
    '/api/admin-dashboard/summary',
    '/api/admin-products/list',
    '/api/admin-products/filter-options',
    '/api/admin-inventory/items',
    '/api/admin-inventory/options',
    '/api/storefront/dashboard-appearance',
    '/api/_nuxt_icon/lucide.json',
)
AUDIT_API = '/api/admin-logs'
UUID_PATH = r'^/api/admin-products/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
METHOD_GUARD = 'if ($request_method !~ ^(GET|HEAD)$) { return 405; }'
PAGE_GUARD = 'if ($uri ~ "^/(?:ar/)?(?:dashboard|account|checkout|cart|login|signup|support|email)(?:/|$)") { return 403; }'
CUSTOMER_GUARD = PAGE_GUARD.replace('dashboard|', '')


def digest(value):
    return hashlib.sha256(value.encode() if isinstance(value, str) else value).hexdigest()


def require(value, code):
    if not value:
        raise ValueError(code)


def validate_binding(binding):
    require(set(binding) == {'format', 'site_origin', 'canonical_alias', 'variable_prefix',
                            'source_sha256', 'runtime_upstream'}, 'BINDING_KEYS')
    require(binding['format'] == 1, 'BINDING_VERSION')
    origin = urlsplit(binding['site_origin'])
    host = origin.hostname or ''
    require(origin.scheme == 'https' and origin.netloc == host and not origin.path
            and not origin.query and not origin.fragment and not origin.username,
            'HTTPS_ORIGIN_REQUIRED')
    host_pattern = r'(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?'
    require(re.fullmatch(host_pattern, host) and '..' not in host, 'CANONICAL_HOST')
    alias = binding['canonical_alias']
    require(isinstance(alias, str) and re.fullmatch(host_pattern, alias)
            and '..' not in alias and alias != host, 'CANONICAL_ALIAS')
    require(re.fullmatch(r'[a-z][a-z0-9_]{2,60}', binding['variable_prefix']), 'VARIABLE_PREFIX')
    require(re.fullmatch(r'[0-9a-f]{64}', binding['source_sha256']), 'SOURCE_HASH_FORMAT')
    require(re.fullmatch(r'http://127\.0\.0\.1:[1-9][0-9]{0,4}', binding['runtime_upstream'])
            and int(binding['runtime_upstream'].rsplit(':', 1)[1]) <= 65535,
            'LOOPBACK_UPSTREAM_REQUIRED')
    return host, alias


def render(original, binding, inherited_add_headers=None):
    host, alias = validate_binding(binding)
    require(digest(original) == binding['source_sha256'], 'SOURCE_HASH_MISMATCH')
    variable = '$' + binding['variable_prefix'] + '_method_denied'
    read_variable = '$' + binding['variable_prefix'] + '_read_method_denied'
    require('$' + binding['variable_prefix'] + '_' not in original, 'VARIABLE_COLLISION')
    nodes = parse(original)
    servers = [node for node in nodes if node['name'] == 'server']
    fronts = []
    edits = []
    for server in servers:
        methods = [c for c in server['children'] if original[c['start']:c['end']] == METHOD_GUARD]
        if not methods:
            continue
        require(len(methods) == 1, 'METHOD_GUARD_COUNT')
        names = [c for c in server['children'] if c['name'] == 'server_name']
        require(len(names) == 1, 'SERVER_IDENTITY')
        public_names = set(names[0]['args']).intersection({host, alias})
        require(len(public_names) == 1, 'FRONTEND_IDENTITY')
        pages = [c for c in server['children'] if original[c['start']:c['end']] == PAGE_GUARD]
        require(len(pages) == 1, 'PAGE_GUARD_COUNT')
        edits += [(methods[0]['start'], methods[0]['end'],
                   'if (' + variable + ' = 1) { return 405; }'),
                  (pages[0]['start'], pages[0]['end'], CUSTOMER_GUARD)]
        fronts.append((server, public_names.pop()))
    require(len(fronts) == 2 and {name for _, name in fronts} == {host, alias}, 'FRONTEND_COUNT')
    front = next(server for server, name in fronts if name == host)
    roots = [c for c in front['children'] if c['name'] == 'location' and c['args'] == ['/']]
    require(len(roots) == 1, 'ROOT_LOCATION')
    root = roots[0]
    require(all(c['name'] not in {'include', 'rewrite', 'try_files', 'return', 'location',
                                'fastcgi_pass', 'uwsgi_pass', 'scgi_pass', 'grpc_pass'}
                for c in walk(root['children'])), 'UNEXPECTED_ROOT_ROUTING')
    proxies = [c for c in walk(root['children']) if c['name'] == 'proxy_pass']
    require(len(proxies) == 1 and proxies[0]['args'] == [binding['runtime_upstream']], 'RUNTIME_UPSTREAM')
    for directive in ('proxy_cache', 'proxy_store'):
        require([c['args'] for c in root['children'] if c['name'] == directive] == [['off']],
                'ROOT_CACHE_POLICY')
    denies = [c for c in front['children'] if c['name'] == 'location' and c['args'] == ['^~', '/api/']]
    require(len(denies) == 1 and len(denies[0]['children']) == 1
            and denies[0]['children'][0]['name'] == 'return'
            and denies[0]['children'][0]['args'] == ['403'], 'API_DENY_POLICY')
    additions = set(READ_APIS) | {AUDIT_API, '/dashboard', '/dashboard/', '/ar/dashboard', '/ar/dashboard/'}
    for c in front['children']:
        if c['name'] != 'location' or c in (root, denies[0]):
            continue
        args = c['args']
        require(not (args and args[-1] in additions), 'EXISTING_ROUTE_CONFLICT')
        # A pre-existing narrower API selector must never silently lose priority.
        require(not (args and args[0] not in ('~', '~*')
                     and args[-1].startswith('/api/admin-')), 'EXISTING_ADMIN_ROUTE_CONFLICT')

    # Adding a location-level header otherwise suppresses inherited security
    # headers in older Nginx. Copy the effective original header set first.
    headers = [original[c['start']:c['end']] for c in root['children'] if c['name'] == 'add_header']
    if not headers:
        headers = (list(inherited_add_headers) if inherited_add_headers is not None else
                   [original[c['start']:c['end']] for c in front['children'] if c['name'] == 'add_header'])
        for header in headers:
            parsed = parse(header)
            require(len(parsed) == 1 and parsed[0]['name'] == 'add_header'
                    and not parsed[0]['children'], 'INHERITED_HEADER_DIRECTIVE')
        inherited = '\n'.join(headers)
    else:
        inherited = ''  # Already in the copied root body.
    body = original[root['body_start']:root['end'] - 1]
    require(not any(c['name'] == 'proxy_hide_header' and c['args'] == ['Cache-Control']
                    for c in root['children']), 'CACHE_HEADER_CONFLICT')
    body += '\n' + inherited + '\nproxy_hide_header Cache-Control;\n'
    body += 'add_header Cache-Control "private, no-store" always;\n'

    def location(selector, methods):
        # macOS Nginx compares prefix/exact locations without case. Keep API
        # reachability identical to Linux rather than relying on that behavior.
        exact_path = selector[2:] if selector.startswith('= /api/') else None
        path_guard = ('if ($uri != ' + exact_path + ') { return 403; }\n') if exact_path else ''
        # Preserve any opaque server_name aliases without giving them new admin
        # access. The reviewed canonical alias redirects before location lookup.
        host_guard = 'if ($host != ' + host + ') { return 403; }\n'
        return '\nlocation ' + selector + ' {\n' + host_guard + path_guard + 'if ($request_method !~ ^(' + methods + ')$) { return 405; }\n' + body + '\n}\n'

    new = ''.join(location('= ' + path, 'GET|HEAD') for path in READ_APIS)
    new += location('= ' + AUDIT_API, 'POST')
    # Ordinary prefixes preserve existing regex security locations (hidden-file
    # denials, for example). Exact login/API paths never become filesystem reads.
    for selector in ('= /dashboard', '/dashboard/', '= /ar/dashboard', '/ar/dashboard/'):
        new += location(selector, 'GET|HEAD')
    # The nested regex is evaluated inside the existing ^~ /api/ prefix. A
    # top-level regex would be skipped by that prefix. Every other API stays 403.
    deny = '\nlocation ^~ /api/ {\n' + location('~ "' + UUID_PATH + '"', 'GET|HEAD') + '\nreturn 403;\n}\n'
    edits.append((denies[0]['start'], denies[0]['end'], deny))
    edits.append((front['body_start'], front['body_start'], '\n# ADM-01: existing authenticated dashboard only.\n' + new))
    method_map = ('# ADM-01: classify the method independently of untrusted Host/URI.\n'
                  'map $request_method ' + read_variable + ' {\n'
                  '    default 1;\n'
                  '    ~^(GET|HEAD)$ 0;\n}\n'
                  '# Exact canonical-host login audit is the sole mutation exception.\n'
                  'map "$host|$request_method|$request_uri" ' + variable + ' {\n'
                  '    default ' + read_variable + ';\n'
                  '    ~^' + re.escape(host) + '[|]POST[|]' + AUDIT_API + '$ 0;\n}\n')
    edits.append((0, 0, method_map))
    candidate = original
    for begin, end, value in sorted(edits, key=lambda item: item[0], reverse=True):
        candidate = candidate[:begin] + value + candidate[end:]
    parse(candidate)
    # Removing exactly the replacements/additions reproduces the old bytes.
    # Every other server, TLS control, SEO map and public location is untouched.
    return candidate, dict(result='PASS', source_sha256=digest(original),
                           candidate_sha256=digest(candidate),
                           canonical_origin=binding['site_origin'],
                           read_api_paths=list(READ_APIS), uuid_product_detail=True,
                           only_write_exception='POST ' + AUDIT_API,
                           application_authentication_unchanged=True,
                           runtime_rebuild_required=False, production_changes=0)
