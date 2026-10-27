#!/usr/bin/env python3
"""MON-01. GET-only commerce observation; local state and owner email only.

No Paymob inquiry, callback POST, business RPC, order/payment/stock mutation.
Reports contain operational references, never customer contact details or secrets.
"""
import argparse
import collections
import datetime as dt
import decimal
import email.message
import fcntl
import hashlib
import json
import os
import pathlib
import re
import signal
import smtplib
import sqlite3
import ssl
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

VERSION = 1
UTC = dt.timezone.utc
MAX_BYTES = 4 * 1024 * 1024
MAX_PAGES = 40
PAGE = 250
MAX_CHILDREN = 500
MAX_EVENTS = 50000
ORDER_FIELDS = ('id,user_id,order_number,status,payment_status,payment_method,'
                'total_amount,amount_paid,currency,created_at,updated_at,paid_at,'
                'is_preorder,card_checkout_verified,packing_completed_at,'
                'shipping_company_id,stock_fulfillment_state')
ATTEMPT_FIELDS = ('id,order_id,provider,method,mode,amount_minor,currency,status,'
                  'provider_order_id,error_code,expires_at,created_at,updated_at')
TX_FIELDS = 'id,attempt_id,provider,transaction_id,status,created_at,updated_at'
SELECT = (ORDER_FIELDS + ',payment_attempts(' + ATTEMPT_FIELDS +
          ',payment_transactions(' + TX_FIELDS + '))')
SENSITIVE = re.compile(r'authorization|bearer\s|cookie|access_token|refresh_token|client_secret|hmac=|sk_live_|pk_live_', re.I)
PATTERNS = {
    'callback_reconciliation': r'Callback could not be reconciled|Payment context mismatch',
    'callback_signature': r'Invalid callback signature',
    'checkout_failure': r'This purchase is unavailable|Could not confirm checkout',
    'unhandled': r'\[request error\]|unhandledRejection|uncaughtException|\[unhandled\]',
    'upstream': r'dial tcp.*connection refused|upstream.*(?:unavailable|timeout)',
    'incomplete_response': r'reading from backend.*(?:closed|canceled)|connection reset by peer',
}


class Stop(Exception):
    """Closed, non-sensitive reason codes only."""


def stamp():
    return dt.datetime.now(UTC).isoformat()


def when(value):
    return dt.datetime.fromisoformat(value.replace('Z', '+00:00')).astimezone(UTC)


def fingerprint(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def address(value):
    if not isinstance(value, str) or len(value) > 254 or not re.fullmatch(
            r'[A-Za-z0-9!#$%&\'*+\-/=?^_`{|}~]+(?:\.[A-Za-z0-9!#$%&\'*+\-/=?^_`{|}~]+)*@'
            r'[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+', value):
        raise Stop('NOTIFICATION_RECIPIENT_INVALID')
    return value.lower()


def https_origin(value):
    u = urllib.parse.urlsplit(value)
    if u.scheme != 'https' or not u.hostname or u.username or u.password or u.port or u.path not in ('', '/') or u.query or u.fragment:
        raise Stop('HTTPS_ORIGIN_REQUIRED')
    return value.rstrip('/')


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def get(url, headers=None):
    """Only GET. TLS verification retained, redirects and environment proxies refused."""
    req = urllib.request.Request(url, headers=headers or {}, method='GET')
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    try:
        response = opener.open(req, timeout=8)
    except urllib.error.HTTPError as response:
        return response.code, b'', dict(response.headers)
    with response:
        data = response.read(MAX_BYTES + 1)
        if len(data) > MAX_BYTES:
            raise Stop('HTTP_RESPONSE_BOUND')
        return response.status, data, dict(response.headers)


class Ledger:
    def __init__(self, credential, transport=get):
        self.origin = https_origin(credential['url'])
        self.key = credential['service_role_key']
        self.transport = transport

    def read(self, table, params, counted=False):
        if table not in ('customer_orders', 'payment_attempts', 'payment_transactions', 'email_provider_settings', 'commerce_shipping_companies'):
            raise Stop('READ_TABLE_DENIED')
        code, body, headers = self.transport(self.origin + '/rest/v1/' + table + '?' + urllib.parse.urlencode(params),
                                    {'apikey': self.key, 'Authorization': 'Bearer ' + self.key, 'Accept': 'application/json', 'Prefer': 'count=exact'})
        if code not in (200, 206):
            raise Stop('LEDGER_UNAVAILABLE')
        rows = json.loads(body)
        if not isinstance(rows, list):
            raise Stop('LEDGER_RESPONSE_INVALID')
        if counted:
            value = next((v for k, v in headers.items() if k.lower() == 'content-range'), '')
            if not re.fullmatch(r'(?:\*|\d+-\d+)/\d+', value):
                raise Stop('LEDGER_COUNT_UNAVAILABLE')
            return rows, int(value.split('/')[1])
        return rows

    def orders(self):
        # Full bounded scan avoids expiring a pending exception or losing an old
        # order's late callback behind a creation-time watermark. Each embedded
        # order/attempt/transaction projection shares one PostgreSQL statement.
        rows, last = [], None
        for _ in range(MAX_PAGES):
            params = {'select': SELECT, 'payment_method': 'eq.card', 'order': 'id.asc', 'limit': str(PAGE),
                      'payment_attempts.provider': 'eq.paymob', 'payment_attempts.limit': str(MAX_CHILDREN + 1),
                      'payment_attempts.payment_transactions.limit': str(MAX_CHILDREN + 1)}
            if last:
                params['id'] = 'gt.' + last
            page, remaining = self.read('customer_orders', params, counted=True)
            if len(page) > PAGE:
                raise Stop('LEDGER_PAGE_BOUND')
            for o in page:
                if not re.fullmatch(r'[a-f0-9-]{36}', o['id']) or (last is not None and o['id'] <= last):
                    raise Stop('LEDGER_ORDER_INVALID')
                children = o['payment_attempts']
                if len(children) > MAX_CHILDREN or any(len(a['payment_transactions']) > MAX_CHILDREN for a in children):
                    raise Stop('LEDGER_CHILD_BOUND')
                last = o['id']
            rows.extend(page)
            if len(page) == remaining:
                # Cross-check global exact counts so a server-level embedded
                # row cap cannot silently hide attempts or signed transactions.
                # Concurrent creation can cause a conservative incomplete run;
                # the next full scan observes it without advancing a cursor.
                for table, found in (('payment_attempts', sum(len(o['payment_attempts']) for o in rows)),
                                     ('payment_transactions', sum(sum(t['provider'] == 'paymob' for t in a['payment_transactions']) for o in rows for a in o['payment_attempts']))):
                    _, total = self.read(table, {'select': 'id', 'provider': 'eq.paymob', 'limit': '1'}, counted=True)
                    if found != total:
                        raise Stop('LEDGER_COVERAGE_INCOMPLETE')
                return rows
            if not page or len(page) > remaining:
                raise Stop('LEDGER_PAGE_INCOMPLETE')
        raise Stop('LEDGER_SCAN_BOUND')

    def recipient(self):
        rows = self.read('email_provider_settings', {'select': 'config', 'id': 'eq.brevo', 'limit': '2'})
        if len(rows) != 1:
            raise Stop('NOTIFICATION_SETTINGS_MISSING')
        value = rows[0]['config'].get('monitor_recipient', '')
        return address(value) if value else ''

    def manual(self, company_id, expected_price):
        rows = self.read('commerce_shipping_companies', {'select': 'is_active,checkout_enabled,provider,client_shipping_price',
                                                        'id': 'eq.' + company_id, 'limit': '2'})
        return len(rows) == 1 and rows[0]['is_active'] and rows[0]['checkout_enabled'] and rows[0]['provider'] == 'manual' and decimal.Decimal(str(rows[0]['client_shipping_price'])) == decimal.Decimal(str(expected_price))


def inspect_orders(orders, now):
    issues, staff, stats = [], [], collections.Counter()
    provider_orders = collections.defaultdict(set)
    seen_tx = collections.defaultdict(set)

    def issue(o, code, severity='WARNING', proof='LOCAL_LEDGER'):
        issues.append({'key': fingerprint([o['id'], code]), 'code': code, 'severity': severity,
                       'order': o.get('order_number', ''), 'provider_evidence': proof})

    for o in orders:
        live = [a for a in o['payment_attempts'] if a['mode'] == 'live' and a['provider'] == 'paymob']
        eligible = live or (o['card_checkout_verified'] and not o['is_preorder'])
        if not eligible:
            continue
        stats['orders'] += 1
        successes, attempts_succeeded = set(), False
        for a in live:
            stats['attempt_' + a['status']] += 1
            if a['order_id'] != o['id']:
                issue(o, 'ATTEMPT_ORDER_MISMATCH', 'CRITICAL')
            if decimal.Decimal(str(a['amount_minor'])) != decimal.Decimal(str(o['total_amount'])) * 100 or a['currency'] != o['currency']:
                issue(o, 'PAYMENT_AMOUNT_MISMATCH', 'CRITICAL')
            if a['provider_order_id']:
                provider_orders[str(a['provider_order_id'])].add(o['id'])
            attempts_succeeded |= a['status'] == 'succeeded'
            transaction_success = False
            for t in a['payment_transactions']:
                stats['transaction_' + t['status']] += 1
                if t['attempt_id'] != a['id'] or t['provider'] != a['provider']:
                    issue(o, 'TRANSACTION_ATTEMPT_MISMATCH', 'CRITICAL')
                seen_tx[str(t['transaction_id'])].add(o['id'])
                if t['status'] == 'succeeded':
                    successes.add(str(t['transaction_id']))
                    transaction_success = True
                    if a['status'] != 'succeeded':
                        issue(o, 'SIGNED_SUCCESS_ATTEMPT_MISMATCH', 'CRITICAL', 'SIGNED_CALLBACK_LEDGER')
            if a['status'] == 'succeeded' and not transaction_success:
                issue(o, 'SUCCESS_WITHOUT_SIGNED_TRANSACTION', 'CRITICAL')
            if a['status'] in ('initiated', 'pending'):
                deadline = when(a['expires_at']) if a['expires_at'] else when(a['created_at']) + dt.timedelta(minutes=30)
                if deadline < now:
                    # Expiry proves no payment outcome. Never mark failed or release stock.
                    issue(o, 'OVERDUE_PAYMENT_UNVERIFIED', proof='UNVERIFIED')
            elif a['status'] in ('expired', 'cancelled', 'failed') and a['provider_order_id'] and not a['payment_transactions']:
                issue(o, 'TERMINAL_PAYMENT_UNVERIFIED', proof='UNVERIFIED')
        settled = o['payment_status'] == 'paid' and decimal.Decimal(str(o['amount_paid'])) == decimal.Decimal(str(o['total_amount']))
        if (successes or attempts_succeeded) and not settled:
            issue(o, 'CHARGED_BUT_UNPAID_EVIDENCE', 'CRITICAL', 'SIGNED_CALLBACK_LEDGER' if successes else 'LOCAL_LEDGER')
        if settled and not successes:
            issue(o, 'PAID_WITHOUT_SIGNED_SUCCESS', 'CRITICAL')
        if len(successes) > 1:
            issue(o, 'MULTIPLE_SUCCESSFUL_CHARGES', 'CRITICAL', 'SIGNED_CALLBACK_LEDGER')
        if not o['user_id']:
            issue(o, 'ORDER_OWNER_MISSING', 'CRITICAL')
        if not live and o['payment_status'] == 'pending' and when(o['created_at']) + dt.timedelta(minutes=5) < now:
            issue(o, 'CHECKOUT_ATTEMPT_MISSING', proof='UNVERIFIED')
        if settled and o['status'] not in ('cancelled', 'completed', 'delivered', 'refunded'):
            staff.append({'key': fingerprint([o['id'], 'PAID_ORDER']), 'order': o['order_number'],
                          'status': o['status'], 'stock_fulfillment_state': o['stock_fulfillment_state'], 'paid_at': o['paid_at']})
        if settled and o['status'] == 'pending_payment':
            issue(o, 'PAID_ORDER_NOT_PROCESSING', 'CRITICAL')
    for values, code in ((provider_orders, 'DUPLICATE_PROVIDER_ORDER'), (seen_tx, 'DUPLICATE_TRANSACTION_REFERENCE')):
        for owners in values.values():
            if len(owners) > 1:
                for o in orders:
                    if o['id'] in owners:
                        issue(o, code, 'CRITICAL')
    # Multiple overdue attempts on the same order are one staff exception.
    return list({x['key']: x for x in issues}.values()), staff, dict(stats)


def command(args):
    try:
        r = subprocess.run(args, capture_output=True, timeout=6, check=False)
        if r.returncode or len(r.stdout) > MAX_BYTES:
            raise Stop('JOURNAL_OR_SERVICE_UNAVAILABLE')
        return r.stdout
    except (OSError, subprocess.TimeoutExpired):
        raise Stop('JOURNAL_OR_SERVICE_UNAVAILABLE') from None


def journal(unit, since, until):
    if not re.fullmatch(r'[A-Za-z0-9_.@-]+\.service', unit):
        raise Stop('UNIT_INVALID')
    fmt = lambda value: when(value).strftime('%Y-%m-%d %H:%M:%S.%f UTC')
    raw = command(['journalctl', '--quiet', '--no-pager', '--output=json', '-n', '10001', '--unit=' + unit,
                   '--since=' + fmt(since), '--until=' + fmt(until)])
    lines = raw.splitlines()
    if len(lines) > 10000:
        raise Stop('JOURNAL_SCAN_BOUND')
    counts = collections.Counter()
    for line in lines:
        row = json.loads(line)
        message = row.get('MESSAGE', '')
        if not isinstance(message, str) or SENSITIVE.search(message):
            counts['sensitive_records_omitted'] += 1
            continue
        for category, pattern in PATTERNS.items():
            if re.search(pattern, message, re.I):
                counts[category] += 1
    return dict(counts)


def operational(config, since, now, transport=get, caddy_reader=None):
    origin = https_origin(config['origin'])
    problems, health = [], {}
    for path, expected in (('/api/payments/capabilities', 200), ('/cart', 200), ('/login', 200),
                           ('/api/payments/paymob/webhook', config['callback_get_status'])):
        try:
            status, data, _ = transport(origin + path)
            health[path] = status
            ok = status == expected
            if path == '/api/payments/capabilities' and ok:
                value = json.loads(data)
                ok = value.get('card', {}).get('available') is True and value['card'].get('initiationAvailable') is True and value['card'].get('mode') == 'live' and value.get('purchase', {}).get('available') is True
            if not ok:
                problems.append({'code': 'CALLBACK_INGRESS_PROBE' if 'webhook' in path else 'PUBLIC_CHECKOUT_HEALTH', 'severity': 'CRITICAL', 'key': fingerprint(['http', path])})
        except (OSError, ValueError, Stop):
            problems.append({'code': 'PUBLIC_ENDPOINT_UNAVAILABLE', 'severity': 'CRITICAL', 'key': fingerprint(['http', path])})
    if caddy_reader is None:
        credentials = pathlib.Path(os.environ['CREDENTIALS_DIRECTORY'])
        caddy_reader = (credentials / 'caddy-config').read_bytes
    caddy_matches = hashlib.sha256(caddy_reader()).hexdigest() == config['caddy_sha256']
    if not caddy_matches:
        problems.append({'key': 'callback-config', 'code': 'CALLBACK_PROXY_CONFIGURATION_CHANGED', 'severity': 'CRITICAL'})
    logs = {}
    for unit in (config['application_unit'], config['proxy_unit']):
        status = command(['systemctl', 'show', unit, '--property=ActiveState', '--value']).strip()
        if status != b'active':
            problems.append({'key': fingerprint(['service', unit]), 'code': 'SERVICE_INACTIVE', 'severity': 'CRITICAL'})
        counts = journal(unit, since, now)
        logs[unit] = counts
        for kind in ('callback_reconciliation', 'checkout_failure', 'unhandled', 'upstream'):
            if counts.get(kind):
                # Authentication/grant rejection alone is not proof that public
                # checkout is broken. Probe failure or signed ledger mismatch
                # establishes critical evidence; log categories require review.
                problems.append({'key': fingerprint(['journal', unit, kind]), 'code': 'JOURNAL_' + kind.upper(), 'severity': 'WARNING'})
    return problems, {'http': health, 'journal_categories': logs,
                      'callback_configuration_matches': caddy_matches,
                      'callback_probe': 'Configuration preservation plus GET method denial; POST ingress untested until a real callback',
                      'proxy_visibility': 'Available journals only; per-request access logs may be absent'}


class State:
    def __init__(self, directory, readonly=False):
        self.root = pathlib.Path(directory)
        self.lock = None
        if readonly:
            self.db = sqlite3.connect((self.root / 'state.sqlite3').resolve().as_uri() + '?mode=ro', uri=True, timeout=3)
            return
        self.root.mkdir(mode=0o700, parents=True, exist_ok=True)
        self.lock = (self.root / 'lock').open('a')
        try:
            fcntl.flock(self.lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            self.lock.close()
            raise Stop('RUN_ALREADY_ACTIVE') from None
        self.db = sqlite3.connect(self.root / 'state.sqlite3', timeout=3)
        self.db.execute('pragma synchronous=FULL')
        self.db.executescript('''create table if not exists meta(key text primary key,value text not null);
        create table if not exists events(key text primary key,fingerprint text not null,active integer not null,dispatch text not null,updated text not null);
        create table if not exists checks(seq integer primary key,observed text not null,summary text not null);
        create table if not exists gaps(key text primary key,details text not null);
        ''')

    def close(self):
        self.db.close()
        if self.lock:
            self.lock.close()

    def read(self, key):
        row = self.db.execute('select value from meta where key=?', (key,)).fetchone()
        return json.loads(row[0]) if row else None

    def put(self, key, value):
        self.db.execute('insert into meta values(?,?) on conflict(key) do update set value=excluded.value', (key, json.dumps(value)))

    def stage(self, events, now, complete=True, email_enabled=True):
        """Unchanged events do not alert; recurrence after resolution does.

        Event history is bounded by refusing intake, never by deleting dedup keys
        and sending old alerts again. A full store requires staff migration.
        """
        added = []
        self.changed_keys = set()
        with self.db:
            new_keys = {e['key'] for e in events} - {row[0] for row in self.db.execute('select key from events')}
            if self.db.execute('select count(*) from events').fetchone()[0] + len(new_keys) > MAX_EVENTS:
                raise Stop('STATE_CAPACITY_REVIEW_REQUIRED')
            current = set()
            for event in events:
                key, mark = event['key'], fingerprint(event)
                current.add(key)
                old = self.db.execute('select fingerprint,active,dispatch from events where key=?', (key,)).fetchone()
                if not old or old[0] != mark or not old[1]:
                    if email_enabled:
                        added.append(key)
                    self.changed_keys.add(key)
                    self.db.execute('insert into events values(?,?,1,?,?) on conflict(key) do update set fingerprint=excluded.fingerprint,active=1,dispatch=excluded.dispatch,updated=excluded.updated', (key, mark, 'ready' if email_enabled else 'dashboard_only', now))
                elif old[2] == 'ready' and email_enabled:
                    added.append(key)
            if complete:
                for (key,) in self.db.execute('select key from events where active=1').fetchall():
                    if key not in current:
                        self.db.execute('update events set active=0,updated=? where key=?', (now, key))
        return sorted(set(added))

    def dispatch(self, keys, recipient, message, sender):
        if not keys:
            return 'unchanged'
        if not recipient or sender is None:
            return 'not_configured'
        # Claim before the network boundary. A crash after claim cannot trigger
        # an automatic duplicate. SMTP has no exactly-once acknowledgement;
        # ambiguous delivery stays UNVERIFIED for staff, never silently retried.
        with self.db:
            for key in keys:
                self.db.execute("update events set dispatch='uncertain' where key=? and dispatch='ready'", (key,))
        try:
            sender(recipient, message)
            result = 'accepted'  # SMTP acceptance, not verified inbox delivery.
        except Exception:
            result = 'uncertain'
        with self.db:
            for key in keys:
                self.db.execute('update events set dispatch=? where key=?', (result, key))
        return result

    def report(self):
        value = self.read('report') or {'status': 'WARNING', 'last_successful_check': None}
        last = value.get('last_successful_check')
        value['heartbeat_stale'] = not last or (dt.datetime.now(UTC) - when(last)).total_seconds() > 900
        if value['heartbeat_stale'] and value.get('status') != 'CRITICAL':
            value['status'] = 'WARNING'
        value['unverified_notification_events'] = self.db.execute("select count(*) from events where dispatch='uncertain'").fetchone()[0]
        value['retained_checks'] = self.db.execute('select count(*) from checks').fetchone()[0]
        value['unscanned_journal_gap_count'] = self.db.execute('select count(*) from gaps').fetchone()[0]
        if value['unverified_notification_events'] and value.get('email_enabled') is True and value.get('status') != 'CRITICAL':
            value['status'] = 'WARNING'
        return value


def smtp_sender(credential):
    """Reuse approved SMTP credentials only. No Auth mail/RPC as an alert proxy."""
    host, port = credential['host'], credential['port']
    if not re.fullmatch(r'[A-Za-z0-9.-]+', host) or port not in (465, 587):
        raise Stop('SMTP_CONFIGURATION_INVALID')
    origin = address(credential['sender'])
    context = ssl.create_default_context()

    def send(recipient, text):
        message = email.message.EmailMessage()
        message['From'], message['To'] = origin, address(recipient)
        message['Subject'] = 'Store payment monitoring needs attention'
        message.set_content(text)
        client = smtplib.SMTP_SSL(host, port, timeout=8, context=context) if port == 465 else smtplib.SMTP(host, port, timeout=8)
        try:
            if port == 587:
                client.ehlo()
                client.starttls(context=context)
                client.ehlo()
            client.login(credential['username'], credential['password'])
            client.send_message(message)
        finally:
            try:
                client.quit()
            except Exception:
                client.close()
    return send


def run(config, ledger, state, collect=operational, sender=None, now=None):
    now = now or dt.datetime.now(UTC)
    at = now.isoformat()
    prior = state.read('last_successful_check')
    previous_report = state.read('report') or {}
    email_enabled = config.get('email_enabled') is True
    issues, staff, stats, health, complete = [], [], {}, {}, False
    uncovered = None
    try:
        orders = ledger.orders()
        issues, staff, stats = inspect_orders(orders, now)
        recipient = ledger.recipient() if email_enabled else ''
        if not ledger.manual(config['manual_company_id'], config['manual_price']):
            issues.append({'key': 'manual', 'code': 'MANUAL_DELIVERY_UNAVAILABLE', 'severity': 'CRITICAL'})
        since = prior or (now - dt.timedelta(minutes=15)).isoformat()
        # Ledger rescan is global. Journal catch-up is bounded separately; never
        # silently label an unscanned interval covered after extended downtime.
        if when(since) < now - dt.timedelta(minutes=15):
            capped = (now - dt.timedelta(minutes=15)).isoformat()
            uncovered = {'from_utc': since, 'to_utc': capped}
            since = capped
        op, health = collect(config, since, at)
        issues.extend(op)
        complete = True
    except Exception as error:
        recipient = state.read('last_recipient') if email_enabled else ''
        if recipient is None:
            recipient = address(config['bootstrap_recipient']) if config.get('bootstrap_recipient') else ''
        reason = str(error) if isinstance(error, Stop) and re.fullmatch('[A-Z_]+', str(error)) else 'DATA_OR_TRANSPORT_FAILURE'
        issues.append({'key': 'monitor-check', 'code': 'MONITOR_CHECK_INCOMPLETE', 'severity': 'CRITICAL', 'reason': reason})
    gap = round((now - when(prior)).total_seconds()) if prior else None
    if gap is not None and gap > 900:
        issues.append({'key': fingerprint(['missed-check', prior]), 'code': 'MISSED_MONITORING_INTERVAL', 'severity': 'WARNING'})
    channel_ready = bool(email_enabled and recipient and sender)
    if email_enabled and not channel_ready:
        issues.append({'key': 'notification-config', 'code': 'OWNER_NOTIFICATION_NOT_CONFIGURED', 'severity': 'WARNING'})
    status = 'CRITICAL' if any(x['severity'] == 'CRITICAL' for x in issues) else 'WARNING' if issues else 'HEALTHY'
    paid_to_alert = [x for x in staff if x['paid_at'] and when(x['paid_at']) >= when(config['paid_alerts_since_utc'])]
    events = issues + [{'key': x['key'], 'order': x['order'], 'code': 'PAID_ORDER_REQUIRES_STAFF', 'severity': 'INFO'} for x in paid_to_alert]
    keys = state.stage(events, at, complete=complete, email_enabled=email_enabled)
    visible_issues = [{**{k: v for k, v in x.items() if k != 'key'}, 'id': x['key']} for x in issues]
    visible_staff = [{**{k: v for k, v in x.items() if k != 'key'}, 'id': x['key']} for x in staff]
    if not complete:
        # Preserve last-known unresolved details; an unavailable source cannot
        # resolve an exception or make a staff order disappear from Dashboard.
        visible_issues = list({x['id']: x for x in previous_report.get('exceptions', []) + visible_issues}.values())
        visible_staff = visible_staff or previous_report.get('staff_attention', [])
    report = {'version': VERSION, 'status': status, 'observed_utc': at,
              'last_successful_check': at if complete else prior,
              'previous_successful_check': prior, 'gap_seconds': gap,
              'unscanned_journal_interval': uncovered,
              'complete': complete, 'new_alert_events': len(state.changed_keys), 'statistics': stats if complete else previous_report.get('statistics', {}),
              'new_paid_order_count': sum(x['key'] in state.changed_keys for x in paid_to_alert),
              'staff_attention': visible_staff,
              'exceptions': visible_issues,
              'health': health, 'merchant_inquiry': 'NOT_CONFIGURED',
              'provider_pending_outcomes': 'UNVERIFIED', 'notification_configured': channel_ready,
              'email_enabled': email_enabled,
              'next_check_due_utc': (now + dt.timedelta(minutes=5)).isoformat(),
              'business_writes': 0, 'provider_inquiry_calls': 0}
    text = ('Payment monitoring: ' + status + '\nCheck: ' + at +
            '\nNew operational events: ' + str(len(keys)) + '\nUnresolved exceptions: ' + str(len(issues)) +
            '\nPaid orders requiring staff: ' + str(len(staff)) + '\nOpen Dashboard: ' +
            https_origin(config['origin']) + '/dashboard/orders\nProvider-uncertain payments require merchant evidence.\n')
    report['notification_dispatch'] = state.dispatch(keys, recipient, text, sender) if email_enabled else 'disabled'
    if report['notification_dispatch'] == 'uncertain':
        report['status'] = 'WARNING' if status == 'HEALTHY' else status
    with state.db:
        if complete:
            state.put('last_successful_check', at)
            state.put('last_recipient', recipient)
        state.put('report', report)
        summary = {k: report[k] for k in ('observed_utc', 'status', 'complete', 'last_successful_check', 'new_paid_order_count', 'notification_dispatch')}
        summary['exception_counts'] = dict(collections.Counter(x['code'] for x in issues))
        state.db.execute('insert into checks(observed,summary) values(?,?)', (at, json.dumps(summary)))
        state.db.execute('delete from checks where seq <= (select max(seq)-288 from checks)')
        if uncovered:
            # Coalesce extended downtime under its last-success checkpoint.
            # At capacity stop recording new gaps explicitly; never erase them.
            key = fingerprint(['gap', prior])
            if state.db.execute('select count(*) from gaps').fetchone()[0] >= 512 and not state.db.execute('select 1 from gaps where key=?', (key,)).fetchone():
                raise Stop('GAP_HISTORY_CAPACITY')
            state.db.execute('insert or replace into gaps values(?,?)', (key, json.dumps(uncovered)))
    if config.get('report_path'):
        try:
            publish_dashboard(state.report(), config['report_path'])
        except (OSError, Stop):
            # A failed publication is not a successful monitoring delivery.
            # Keep the old Dashboard snapshot and its original timestamp.
            report['status'], report['complete'], report['last_successful_check'] = 'CRITICAL', False, prior
            report['exceptions'].append({'id': 'dashboard-publication', 'code': 'DASHBOARD_REPORT_UNAVAILABLE', 'severity': 'CRITICAL'})
            with state.db:
                state.put('last_successful_check', prior)
                state.put('report', report)
                state.db.execute('update checks set summary=? where seq=(select max(seq) from checks)',
                                 (json.dumps({'observed_utc': at, 'status': 'CRITICAL', 'complete': False,
                                              'reason': 'DASHBOARD_REPORT_UNAVAILABLE'}),))
    # Atomically publish a private operator report. CLI recalculates stale heartbeat.
    temp = state.root / 'status.tmp'
    temp.write_text(json.dumps(state.report(), sort_keys=True, indent=2) + '\n')
    os.chmod(temp, 0o600)
    os.replace(temp, state.root / 'status.json')
    return state.report()


def publish_dashboard(report, destination):
    """Separate read-only publication; SQLite and credential files stay private."""
    path = pathlib.Path(destination)
    if not path.is_absolute() or '..' in path.parts:
        raise Stop('REPORT_PATH_INVALID')
    value = {k: report.get(k) for k in ('version', 'status', 'observed_utc', 'last_successful_check',
             'complete', 'new_paid_order_count', 'new_alert_events', 'next_check_due_utc',
             'retained_checks', 'unscanned_journal_gap_count', 'email_enabled', 'notification_configured')}
    value['exception_count'] = len(report['exceptions'])
    value['staff_attention_count'] = len(report['staff_attention'])
    value['exceptions'] = [{k: x[k] for k in ('id', 'code', 'severity', 'order', 'provider_evidence') if k in x}
                           for x in report['exceptions'][:100]]
    value['staff_attention'] = [{k: x[k] for k in ('id', 'order', 'status', 'stock_fulfillment_state') if k in x}
                                for x in report['staff_attention'][:100]]
    value['display_limited'] = value['exception_count'] > 100 or value['staff_attention_count'] > 100
    temp_name = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', dir=path.parent, prefix='.status-', delete=False) as target:
            temp_name = target.name
            json.dump(value, target, separators=(',', ':'))
            target.flush()
            os.fsync(target.fileno())
            os.fchmod(target.fileno(), 0o640)
        os.replace(temp_name, path)
        temp_name = None
        fd = os.open(path.parent, os.O_RDONLY)
        try:
            os.fsync(fd)
        finally:
            os.close(fd)
    finally:
        if temp_name:
            os.unlink(temp_name)


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=('check', 'report'))
    parser.add_argument('--config', required=True)
    parser.add_argument('--state', required=True)
    args = parser.parse_args()
    state = None
    try:
        state = State(args.state, readonly=args.mode == 'report')
        if args.mode == 'report':
            result = state.report()
        else:
            signal.signal(signal.SIGALRM, lambda *_: (_ for _ in ()).throw(Stop('RUN_DEADLINE')))
            signal.alarm(70)
            config = json.loads(pathlib.Path(args.config).read_text())
            credentials = pathlib.Path(os.environ['CREDENTIALS_DIRECTORY'])
            ledger = Ledger(json.loads((credentials / 'ledger').read_text()))
            smtp = credentials / 'smtp'
            sender = smtp_sender(json.loads(smtp.read_text())) if config.get('email_enabled') is True and smtp.exists() else None
            result = run(config, ledger, state, sender=sender)
        print(json.dumps(result, sort_keys=True))
        return 0 if result.get('complete', False) else 1
    except Exception:
        print(json.dumps({'status': 'CRITICAL', 'code': 'MONITOR_STOPPED', 'secrets_exported': False}))
        return 1
    finally:
        if state:
            state.close()


if __name__ == '__main__':
    raise SystemExit(main())
