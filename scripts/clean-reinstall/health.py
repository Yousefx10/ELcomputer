#!/usr/bin/env python3
"""No login, writes, retries or receipt replay. HTTP checks use no bearer token.

POST/PATCH cases deliberately verify missing-token rejection. Run on local labs
now; target checks belong to a separately approved deployment window.
"""
import argparse
import contextlib
import hashlib
import http.client
import json
import pathlib
import signal
import time
import urllib.parse


@contextlib.contextmanager
def request_deadline(seconds):
    """Bound DNS, TLS and the entire response, including trickling bodies."""
    previous = signal.getsignal(signal.SIGALRM)
    def expired(*unused): raise TimeoutError('HTTP request deadline exceeded')
    signal.signal(signal.SIGALRM, expired)
    signal.setitimer(signal.ITIMER_REAL, seconds)
    try: yield
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)
        signal.signal(signal.SIGALRM, previous)


def request(origin, path, method='GET', host=None, timeout=30):
    url = urllib.parse.urlsplit(origin)
    assert url.scheme in ['https', 'http'] and not url.username and not url.password
    cls = http.client.HTTPSConnection if url.scheme == 'https' else http.client.HTTPConnection
    conn = cls(url.hostname, url.port, timeout=timeout)
    headers = {'Host': host} if host else {}
    if method in ['POST', 'PATCH']: headers['Content-Type'] = 'application/json'
    try:
        with request_deadline(timeout):
            conn.request(method, urllib.parse.quote(path, safe='/%?=&:@-._~!()+'), body='{}' if method in ['POST', 'PATCH'] else None, headers=headers)
            response = conn.getresponse(); body = response.read()
            return response.status, dict((k.lower(), v) for k, v in response.getheaders()), body
    finally: conn.close()


def check(origin, config, mapping, media, fixture=False, timeout=900, progress=None):
    host = config['domain'] if fixture else None
    count = 0; started = time.monotonic(); last_progress = started
    total = 40 + len(media) + 2 * (len(mapping['paths']) + 2 * len(mapping['query_ids'])) + len(mapping['held_paths']) + len(mapping['held_ids'])
    stage = 'pages'
    def report(force=False):
        nonlocal last_progress
        now = time.monotonic()
        if progress and (force or count % 100 == 0 or now - last_progress >= 5):
            progress({'event': 'progress', 'stage': stage, 'http_checks': count, 'total_checks': total, 'elapsed_seconds': round(now - started, 1)})
            last_progress = now
    def enter(name):
        nonlocal stage
        stage = name; report(True)
    def passed():
        nonlocal count
        count += 1; report()
    def fetch(base, path, method='GET', host=None):
        remaining = timeout - (time.monotonic() - started)
        if remaining <= 0: raise TimeoutError('Health run deadline exceeded')
        return request(base, path, method, host, timeout=min(30, remaining))
    enter('pages')
    for path in ['/', '/ar', '/dashboard/login', '/ar/dashboard/login']:
        status, headers, body = fetch(origin, path, host=host)
        assert status == 200 and b'<html' in body, ('PAGE', path, status)
        if path == '/ar': assert b'lang="ar"' in body
        passed()
    enter('missing_token')
    id = '00000000-0000-4000-8000-000000000001'
    for method, path in [('GET', '/api/admin-products/list'), ('POST', '/api/admin-products'),
                         ('PATCH', '/api/admin-products/' + id), ('POST', '/api/admin-products/bulk'),
                         ('GET', '/api/admin-products/bulk?request_id=' + id), ('POST', '/api/admin-uploads')]:
        status, headers, body = fetch(origin, path, method, host)
        assert status == 401, ('AUTH', method, path, status)
        passed()
    enter('disabled_commerce')
    for path in ['/login', '/ar/signup', '/cart', '/checkout', '/api/checkout', '/api/payments/intentions', '/api/internal/email/process', '/api/webhooks/pdc', '/api/admin-system-reset', '/api/account/messages', '/api/chat/messages', '/api/support/tickets', '/api/admin-erp/sync']:
        for method in ['GET', 'POST']:
            assert fetch(origin, path, method, host)[0] == 403, ('DORMANT', path, method)
            passed()
    enter('private_paths')
    for path in ['/uploads/private/documents/test.png', '/.env', '/backups/archive.sql', '/uploads/settings/.pending/x.png']:
        assert fetch(origin, path, host=host)[0] == 404, ('PRIVATE', path)
        passed()
    enter('media_hashes')
    for name, entry in media.items():
        status, headers, body = fetch(origin, '/uploads/' + name, host=host)
        assert status == 200 and len(body) == entry['bytes'] and hashlib.sha256(body).hexdigest() == entry['sha256'], ('MEDIA_HASH', name)
        assert headers.get('x-content-type-options') == 'nosniff' and headers.get('content-type', '').startswith('image/')
        passed()
    enter('redirects')
    redirects = 0
    for authority in [config['domain'], config['alias']]:
        override = authority if fixture else None
        base = origin if fixture or authority == config['domain'] else origin.replace('://' + config['domain'], '://' + authority)
        cases = list(mapping['paths'].items())
        cases += [(prefix + '?post_type=product&p=' + key, value) for key, value in mapping['query_ids'].items() for prefix in ['/', '/index.php']]
        for path, target in cases:
            status, headers, body = fetch(base, path, host=override)
            assert (status, headers.get('location')) == (301, 'https://' + config['domain'] + target), ('REDIRECT', path, status)
            passed(); redirects += 1
    enter('held_urls')
    for path in mapping['held_paths'] + ['/?post_type=product&p=' + sid for sid in mapping['held_ids']]:
        assert fetch(origin, path, host=host)[0] == 503, ('HELD', path)
        passed()
    assert count == total
    return {'result': 'PASS', 'http_checks': count, 'redirect_cases': redirects, 'media_files': len(media), 'authenticated_acceptance': 'pending owner', 'production_business_writes': 0}


if __name__ == '__main__':
    a = argparse.ArgumentParser(); a.add_argument('kit'); a.add_argument('--origin', required=True); a.add_argument('--fixture', action='store_true'); a.add_argument('--timeout', type=float, default=900)
    args = a.parse_args(); kit = pathlib.Path(args.kit)
    def emit(value): print(json.dumps(value), flush=True)
    try:
        assert args.timeout > 0
        result = check(args.origin, json.loads((kit / 'config.json').read_text()), json.loads((kit / 'legacy-urls.json').read_text()), json.loads((kit / 'media-manifest.json').read_text()), args.fixture, args.timeout, emit)
    except (Exception, KeyboardInterrupt) as error:
        emit({'result': 'FAIL', 'error': type(error).__name__, 'detail': str(error)})
        raise SystemExit(1)
    emit(result)
