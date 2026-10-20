#!/usr/bin/env python3
"""No login, writes, retries or receipt replay. HTTP checks use no bearer token.

POST/PATCH cases deliberately verify missing-token rejection. Run on local labs
now; target checks belong to a separately approved deployment window.
"""
import argparse
import hashlib
import http.client
import json
import pathlib
import urllib.parse


def request(origin, path, method='GET', host=None):
    url = urllib.parse.urlsplit(origin)
    assert url.scheme in ['https', 'http'] and not url.username and not url.password
    cls = http.client.HTTPSConnection if url.scheme == 'https' else http.client.HTTPConnection
    conn = cls(url.hostname, url.port, timeout=30)
    headers = {'Host': host} if host else {}
    if method in ['POST', 'PATCH']: headers['Content-Type'] = 'application/json'
    conn.request(method, urllib.parse.quote(path, safe='/%?=&:@-._~!()+'), body='{}' if method in ['POST', 'PATCH'] else None, headers=headers)
    response = conn.getresponse(); body = response.read()
    result = response.status, dict((k.lower(), v) for k, v in response.getheaders()), body
    conn.close(); return result


def check(origin, config, mapping, media, fixture=False):
    host = config['domain'] if fixture else None
    count = 0
    for path in ['/', '/ar', '/dashboard/login', '/ar/dashboard/login']:
        status, headers, body = request(origin, path, host=host)
        assert status == 200 and b'<html' in body, ('PAGE', path, status)
        if path == '/ar': assert b'lang="ar"' in body
        count += 1
    id = '00000000-0000-4000-8000-000000000001'
    for method, path in [('GET', '/api/admin-products/list'), ('POST', '/api/admin-products'),
                         ('PATCH', '/api/admin-products/' + id), ('POST', '/api/admin-products/bulk'),
                         ('GET', '/api/admin-products/bulk?request_id=' + id), ('POST', '/api/admin-uploads')]:
        status, headers, body = request(origin, path, method, host)
        assert status == 401, ('AUTH', method, path, status)
        count += 1
    for path in ['/login', '/ar/signup', '/cart', '/checkout', '/api/checkout', '/api/payments/intentions', '/api/internal/email/process', '/api/webhooks/pdc', '/api/admin-system-reset', '/api/account/messages', '/api/chat/messages', '/api/support/tickets', '/api/admin-erp/sync']:
        for method in ['GET', 'POST']:
            assert request(origin, path, method, host)[0] == 403, ('DORMANT', path, method)
            count += 1
    for path in ['/uploads/private/documents/test.png', '/.env', '/backups/archive.sql', '/uploads/settings/.pending/x.png']:
        assert request(origin, path, host=host)[0] == 404, ('PRIVATE', path)
        count += 1
    for name, entry in media.items():
        status, headers, body = request(origin, '/uploads/' + name, host=host)
        assert status == 200 and len(body) == entry['bytes'] and hashlib.sha256(body).hexdigest() == entry['sha256'], ('MEDIA_HASH', name)
        assert headers.get('x-content-type-options') == 'nosniff' and headers.get('content-type', '').startswith('image/')
        count += 1
    redirects = 0
    for authority in [config['domain'], config['alias']]:
        override = authority if fixture else None
        base = origin if fixture or authority == config['domain'] else origin.replace('://' + config['domain'], '://' + authority)
        cases = list(mapping['paths'].items())
        cases += [(prefix + '?post_type=product&p=' + key, value) for key, value in mapping['query_ids'].items() for prefix in ['/', '/index.php']]
        for path, target in cases:
            status, headers, body = request(base, path, host=override)
            assert (status, headers.get('location')) == (301, 'https://' + config['domain'] + target), ('REDIRECT', path, status)
            count += 1; redirects += 1
    for path in mapping['held_paths'] + ['/?post_type=product&p=' + sid for sid in mapping['held_ids']]:
        assert request(origin, path, host=host)[0] == 503, ('HELD', path)
        count += 1
    return {'result': 'PASS', 'http_checks': count, 'redirect_cases': redirects, 'media_files': len(media), 'authenticated_acceptance': 'pending owner', 'production_business_writes': 0}


if __name__ == '__main__':
    a = argparse.ArgumentParser(); a.add_argument('kit'); a.add_argument('--origin', required=True); a.add_argument('--fixture', action='store_true')
    args = a.parse_args(); kit = pathlib.Path(args.kit)
    result = check(args.origin, json.loads((kit / 'config.json').read_text()), json.loads((kit / 'legacy-urls.json').read_text()), json.loads((kit / 'media-manifest.json').read_text()), args.fixture)
    print(json.dumps(result))
