import copy
import datetime as dt
import importlib.util
import json
import pathlib
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('monitor', pathlib.Path(__file__).with_name('monitor.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
NOW = dt.datetime(2026, 10, 27, 19, 0, tzinfo=dt.timezone.utc)
CONFIG = {'origin': 'https://store.example.invalid', 'manual_company_id': 'manual', 'manual_price': '50.00', 'paid_alerts_since_utc': '2026-01-01T00:00:00Z', 'email_enabled': True}


def order(paid=True, suffix='1'):
    oid = '00000000-0000-0000-0000-' + suffix.zfill(12)
    aid = 'a-' + suffix
    return {'id': oid, 'user_id': 'OWNER-CANARY', 'order_number': 'ORDER-' + suffix,
            'status': 'processing' if paid else 'pending_payment', 'payment_status': 'paid' if paid else 'pending',
            'payment_method': 'card', 'total_amount': '5.00', 'amount_paid': '5.00' if paid else '0.00', 'currency': 'EGP',
            'created_at': '2026-10-27T17:00:00Z', 'updated_at': '2026-10-27T17:00:00Z',
            'paid_at': '2026-10-27T17:00:00Z' if paid else None, 'card_checkout_verified': True,
            'is_preorder': False, 'stock_fulfillment_state': 'untracked', 'packing_completed_at': None,
            'payment_attempts': [{'id': aid, 'order_id': oid, 'provider': 'paymob', 'method': 'card', 'mode': 'live',
                                  'amount_minor': 500, 'currency': 'EGP', 'status': 'succeeded' if paid else 'pending',
                                  'provider_order_id': 'provider-' + suffix, 'error_code': None,
                                  'expires_at': '2026-10-27T17:30:00Z', 'created_at': '2026-10-27T17:00:00Z',
                                  'updated_at': '2026-10-27T17:00:00Z', 'payment_transactions': [
                                      {'id': 't-' + suffix, 'attempt_id': aid, 'provider': 'paymob',
                                       'transaction_id': 'tx-' + suffix, 'status': 'succeeded'}] if paid else []}]}


class FakeLedger:
    def __init__(self, rows):
        self.rows = rows
        self.target = 'operator@example.invalid'

    def orders(self):
        return copy.deepcopy(self.rows)

    def recipient(self):
        return self.target

    def manual(self, *_):
        return True


def operations(*_):
    return [], {'fixture': True}


class MonitorTests(unittest.TestCase):
    def test_overdue_does_not_mean_failed_or_paid(self):
        original = order(False)
        result = m.inspect_orders([original], NOW)
        self.assertEqual(result[0][0]['code'], 'OVERDUE_PAYMENT_UNVERIFIED')
        self.assertEqual(result[0][0]['provider_evidence'], 'UNVERIFIED')
        self.assertEqual(original, order(False))
        original['payment_attempts'][0]['expires_at'] = '2026-10-27T20:00:00Z'
        self.assertEqual(m.inspect_orders([original], NOW)[0], [])
        original['payment_attempts'][0]['status'] = 'expired'
        result = m.inspect_orders([original], NOW)[0]
        self.assertEqual(result[0]['code'], 'TERMINAL_PAYMENT_UNVERIFIED')
        self.assertEqual(result[0]['provider_evidence'], 'UNVERIFIED')

    def test_signed_success_unpaid_and_duplicate_charges_are_critical(self):
        o = order()
        o['amount_paid'], o['payment_status'] = '0', 'pending'
        tx = copy.deepcopy(o['payment_attempts'][0]['payment_transactions'][0])
        tx['transaction_id'] = 'second-transaction'
        o['payment_attempts'][0]['payment_transactions'].append(tx)
        issues = {x['code']: x for x in m.inspect_orders([o], NOW)[0]}
        self.assertEqual(issues['CHARGED_BUT_UNPAID_EVIDENCE']['severity'], 'CRITICAL')
        self.assertEqual(issues['MULTIPLE_SUCCESSFUL_CHARGES']['severity'], 'CRITICAL')

    def test_decimal_amount_currency_owner_and_missing_callback(self):
        o = order()
        o['payment_attempts'][0]['amount_minor'] = 501
        o['payment_attempts'][0]['payment_transactions'] = []
        o['user_id'] = None
        codes = {x['code'] for x in m.inspect_orders([o], NOW)[0]}
        self.assertTrue({'PAYMENT_AMOUNT_MISMATCH', 'ORDER_OWNER_MISSING', 'PAID_WITHOUT_SIGNED_SUCCESS',
                         'SUCCESS_WITHOUT_SIGNED_TRANSACTION'} <= codes)

    def test_paid_staff_alert_survives_restart_without_repetition(self):
        sent, ledger = [], FakeLedger([order()])
        with tempfile.TemporaryDirectory() as root:
            state = m.State(root)
            first = m.run(CONFIG, ledger, state, operations, lambda *args: sent.append(args), NOW)
            self.assertEqual(first['new_paid_order_count'], 1)
            self.assertEqual(first['notification_dispatch'], 'accepted')
            self.assertNotIn('OWNER-CANARY', json.dumps(first))
            self.assertNotIn('ORDER-', sent[0][1])
            state.close()
            state = m.State(root)
            ledger.rows[0]['status'] = 'dispatched'
            second = m.run(CONFIG, ledger, state, operations, lambda *args: sent.append(args), NOW + dt.timedelta(minutes=5))
            self.assertEqual(second['new_paid_order_count'], 0)
            self.assertEqual(second['notification_dispatch'], 'unchanged')
            self.assertEqual(len(sent), 1)
            state.close()

    def test_delivery_crash_is_uncertain_and_never_automatically_resent(self):
        with tempfile.TemporaryDirectory() as root:
            state = m.State(root)
            keys = state.stage([{'key': 'x', 'code': 'X'}], NOW.isoformat())
            def crash(*_):
                raise KeyboardInterrupt()
            with self.assertRaises(KeyboardInterrupt):
                state.dispatch(keys, 'owner@example.invalid', 'counts only', crash)
            state.close()
            state = m.State(root)
            self.assertEqual(state.stage([{'key': 'x', 'code': 'X'}], NOW.isoformat()), [])
            self.assertEqual(state.report()['unverified_notification_events'], 1)
            state.close()

    def test_resolution_and_recurrence_alert_once_again(self):
        with tempfile.TemporaryDirectory() as root:
            state = m.State(root)
            event = {'key': 'x', 'code': 'UNVERIFIED'}
            keys = state.stage([event], NOW.isoformat())
            state.dispatch(keys, 'a@example.invalid', 'text', lambda *_: None)
            self.assertEqual(state.stage([event], NOW.isoformat()), [])
            state.stage([], NOW.isoformat())
            self.assertEqual(state.stage([event], NOW.isoformat()), ['x'])
            state.close()

    def test_incomplete_check_keeps_unresolved_events_and_last_success(self):
        with tempfile.TemporaryDirectory() as root:
            state, ledger = m.State(root), FakeLedger([order(False)])
            first = m.run(CONFIG, ledger, state, operations, now=NOW)
            with patch.object(ledger, 'orders', side_effect=RuntimeError('SECRET-CANARY')):
                failed = m.run(CONFIG, ledger, state, operations, now=NOW + dt.timedelta(minutes=20))
            self.assertFalse(failed['complete'])
            self.assertEqual(failed['last_successful_check'], first['last_successful_check'])
            self.assertNotIn('SECRET-CANARY', json.dumps(failed))
            self.assertIn('MISSED_MONITORING_INTERVAL', [x['code'] for x in failed['exceptions']])
            self.assertEqual(state.db.execute("select active from events where key=?", (m.fingerprint([order(False)['id'], 'OVERDUE_PAYMENT_UNVERIFIED']),)).fetchone()[0], 1)
            state.close()

    def test_missing_channel_queues_without_send_then_uses_updated_recipient(self):
        with tempfile.TemporaryDirectory() as root:
            state, ledger = m.State(root), FakeLedger([order()])
            ledger.target = ''
            result = m.run(CONFIG, ledger, state, operations, now=NOW)
            self.assertFalse(result['notification_configured'])
            sent = []
            ledger.target = 'changed@example.invalid'
            m.run(CONFIG, ledger, state, operations, lambda *args: sent.append(args), NOW + dt.timedelta(minutes=5))
            self.assertEqual(sent[0][0], ledger.target)
            self.assertEqual(len(sent), 1)
            state.close()

    def test_global_coverage_and_server_caps_fail_closed(self):
        o = order()
        urls = []
        def transport(url, headers):
            urls.append(url)
            if '/customer_orders?' in url:
                return 200, json.dumps([o]).encode(), {'Content-Range': '0-0/1'}
            return 206, b'[{"id":"only"}]', {'content-range': '0-0/2'}
        ledger = m.Ledger({'url': 'https://database.example.invalid', 'service_role_key': 'SECRET-CANARY'}, transport)
        with self.assertRaisesRegex(m.Stop, 'LEDGER_COVERAGE_INCOMPLETE'):
            ledger.orders()
        self.assertTrue(all('/rest/v1/' in url for url in urls))
        with self.assertRaisesRegex(m.Stop, 'READ_TABLE_DENIED'):
            ledger.read('rpc/commerce_expire_unpaid_card_orders', {})

    def test_small_server_page_is_not_treated_as_end(self):
        rows = [order(suffix='1'), order(suffix='2')]
        def transport(url, headers):
            if '/customer_orders?' in url:
                next_page = 'id=gt.' in url
                return 200, json.dumps([rows[int(next_page)]]).encode(), {'Content-Range': '0-0/' + ('1' if next_page else '2')}
            return 200, b'[{"id":"only"}]', {'Content-Range': '0-0/2'}
        ledger = m.Ledger({'url': 'https://database.example.invalid', 'service_role_key': 'canary'}, transport)
        self.assertEqual(len(ledger.orders()), 2)

    def test_child_limit_overlap_lock_capacity_and_stale_report(self):
        with tempfile.TemporaryDirectory() as root:
            state = m.State(root)
            with self.assertRaisesRegex(m.Stop, 'RUN_ALREADY_ACTIVE'):
                m.State(root)
            with patch.object(m, 'MAX_EVENTS', 1):
                with self.assertRaisesRegex(m.Stop, 'STATE_CAPACITY'):
                    state.stage([{'key': '1'}, {'key': '2'}], NOW.isoformat())
            with state.db:
                state.put('report', {'status': 'HEALTHY', 'last_successful_check': '2000-01-01T00:00:00Z'})
            self.assertTrue(state.report()['heartbeat_stale'])
            self.assertEqual(state.report()['status'], 'WARNING')
            read = m.State(root, readonly=True)
            self.assertTrue(read.report()['heartbeat_stale'])
            read.close()
            state.close()

    def test_existing_backlog_is_reported_without_new_public_paid_order_alert(self):
        with tempfile.TemporaryDirectory() as root:
            state = m.State(root)
            config = {**CONFIG, 'paid_alerts_since_utc': '2026-10-27T18:00:00Z'}
            sent = []
            result = m.run(config, FakeLedger([order()]), state, operations, lambda *args: sent.append(args), NOW)
            self.assertEqual(result['new_paid_order_count'], 0)
            self.assertEqual(len(result['staff_attention']), 1)
            self.assertEqual(sent, [])
            state.close()

    def test_receipts_are_bounded_and_unscanned_gap_survives_restart(self):
        with tempfile.TemporaryDirectory() as root:
            state = m.State(root)
            ledger = FakeLedger([])
            m.run(CONFIG, ledger, state, operations, now=NOW)
            result = m.run(CONFIG, ledger, state, operations, now=NOW + dt.timedelta(hours=2))
            self.assertIsNotNone(result['unscanned_journal_interval'])
            self.assertEqual(result['unscanned_journal_gap_count'], 1)
            for n in range(300):
                m.run(CONFIG, ledger, state, operations, now=NOW + dt.timedelta(hours=2, minutes=5*(n+1)))
            self.assertEqual(state.report()['retained_checks'], 288)
            state.close()
            state = m.State(root, readonly=True)
            self.assertEqual(state.report()['unscanned_journal_gap_count'], 1)
            state.close()

    def test_critical_health_and_proxy_configuration_are_observed_using_get_only(self):
        config = {**CONFIG, 'callback_get_status': 403, 'application_unit': 'app.service',
                  'proxy_unit': 'proxy.service', 'caddy_sha256': m.hashlib.sha256(b'approved').hexdigest()}
        urls = []
        def transport(url):
            urls.append(url)
            return (403 if 'webhook' in url else 200), b'{"card":{"available":false}}', {}
        with patch.object(m, 'command', return_value=b'active'), patch.object(m, 'journal', return_value={}):
            issues, health = m.operational(config, NOW.isoformat(), NOW.isoformat(), transport, lambda: b'changed')
        codes = {x['code'] for x in issues}
        self.assertIn('PUBLIC_CHECKOUT_HEALTH', codes)
        self.assertIn('CALLBACK_PROXY_CONFIGURATION_CHANGED', codes)
        self.assertEqual(len(urls), 4)
        self.assertEqual(health['http']['/api/payments/paymob/webhook'], 403)

    def test_smtp_requires_tls_before_login_and_sanitizes_failure(self):
        credential = {'host': 'smtp.example.invalid', 'port': 587, 'sender': 'sender@example.invalid',
                      'username': 'user', 'password': 'SMTP-SECRET-CANARY'}
        with patch.object(m.smtplib, 'SMTP') as mock:
            mock.return_value.starttls.side_effect = RuntimeError('TLS denied')
            with self.assertRaises(RuntimeError):
                m.smtp_sender(credential)('owner@example.invalid', 'aggregate counts')
            mock.return_value.login.assert_not_called()
            mock.return_value.send_message.assert_not_called()
        credential['port'] = 25
        with self.assertRaisesRegex(m.Stop, 'SMTP_CONFIGURATION_INVALID'):
            m.smtp_sender(credential)

    def test_notification_and_origin_injection_rejected(self):
        for value in ['owner@example.invalid\r\nBcc: x@y.com', 'a,b@example.invalid', 'Name <a@example.invalid>', 'a..b@example.invalid', 'a@localhost']:
            with self.assertRaises(m.Stop):
                m.address(value)
        for value in ['http://example.invalid', 'https://user:secret@example.invalid', 'https://example.invalid/other', 'https://example.invalid?x=1']:
            with self.assertRaises(m.Stop):
                m.https_origin(value)

    def test_journal_never_exports_raw_customer_or_credential_data(self):
        raw = b'\n'.join(json.dumps(row).encode() for row in [
            {'MESSAGE': 'Callback could not be reconciled'},
            {'MESSAGE': 'cookie=SECRET-CANARY This purchase is unavailable'},
            {'MESSAGE': 'INNOCENT-CUSTOMER-CANARY Error happened'},
        ])
        with patch.object(m, 'command', return_value=raw):
            value = m.journal('app.service', NOW.isoformat(), NOW.isoformat())
        self.assertEqual(value['callback_reconciliation'], 1)
        self.assertEqual(value['sensitive_records_omitted'], 1)
        self.assertNotIn('CANARY', json.dumps(value))

    def test_dashboard_monitor_does_not_require_or_read_email_configuration(self):
        with tempfile.TemporaryDirectory() as root:
            state, ledger = m.State(root), FakeLedger([order(False)])
            config = {**CONFIG, 'email_enabled': False, 'report_path': str(pathlib.Path(root)/'dashboard.json')}
            with patch.object(ledger, 'recipient', side_effect=AssertionError('No email configuration read')):
                result = m.run(config, ledger, state, operations, lambda *_: self.fail('No email send'), NOW)
            self.assertEqual(result['notification_dispatch'], 'disabled')
            self.assertNotIn('OWNER_NOTIFICATION_NOT_CONFIGURED', [x['code'] for x in result['exceptions']])
            published = json.loads(pathlib.Path(config['report_path']).read_text())
            self.assertEqual(published['exception_count'], 1)
            self.assertEqual(published['exceptions'][0]['provider_evidence'], 'UNVERIFIED')
            self.assertEqual(pathlib.Path(config['report_path']).stat().st_mode & 0o777, 0o640)
            self.assertTrue(all(row[0]=='dashboard_only' for row in state.db.execute('select dispatch from events')))
            state.close()
            state = m.State(root)
            result = m.run(config, ledger, state, operations, now=NOW+dt.timedelta(minutes=5))
            self.assertEqual(result['new_alert_events'], 0)
            self.assertEqual(result['exception_count'] if 'exception_count' in result else len(result['exceptions']), 1)
            state.close()

    def test_disabled_email_is_not_a_health_failure_and_creates_no_email_backlog(self):
        with tempfile.TemporaryDirectory() as root:
            state, ledger = m.State(root), FakeLedger([order()])
            config = {**CONFIG, 'email_enabled': False}
            live = dt.datetime.now(dt.timezone.utc)
            result = m.run(config, ledger, state, operations, now=live)
            self.assertEqual(result['status'], 'HEALTHY')
            self.assertEqual(result['new_paid_order_count'], 1)
            sent=[]
            result = m.run(CONFIG, ledger, state, operations, lambda *args:sent.append(args), live+dt.timedelta(minutes=5))
            self.assertEqual(sent, [])
            self.assertEqual(result['notification_dispatch'], 'unchanged')
            state.close()

    def test_incomplete_dashboard_check_preserves_last_known_exceptions(self):
        with tempfile.TemporaryDirectory() as root:
            state, ledger = m.State(root), FakeLedger([order(False)])
            config={**CONFIG,'email_enabled':False}
            m.run(config, ledger, state, operations, now=NOW)
            with patch.object(ledger,'orders',side_effect=OSError('SECRET-CANARY')):
                result=m.run(config, ledger, state, operations, now=NOW+dt.timedelta(minutes=5))
            self.assertFalse(result['complete'])
            self.assertIn('OVERDUE_PAYMENT_UNVERIFIED',[x['code'] for x in result['exceptions']])
            self.assertNotIn('SECRET-CANARY',json.dumps(result))
            state.close()

    def test_failed_dashboard_publication_does_not_advance_success_heartbeat(self):
        with tempfile.TemporaryDirectory() as root:
            state, ledger = m.State(root), FakeLedger([])
            config={**CONFIG,'email_enabled':False,'report_path':str(pathlib.Path(root)/'dashboard.json')}
            first=m.run(config, ledger, state, operations, now=NOW)
            before=pathlib.Path(config['report_path']).read_bytes()
            with patch.object(m,'publish_dashboard',side_effect=PermissionError('PRIVATE-PATH-CANARY')):
                result=m.run(config, ledger, state, operations, now=NOW+dt.timedelta(minutes=5))
            self.assertFalse(result['complete']);self.assertEqual(result['status'],'CRITICAL')
            self.assertEqual(result['last_successful_check'],first['last_successful_check'])
            self.assertEqual(pathlib.Path(config['report_path']).read_bytes(),before)
            self.assertNotIn('PRIVATE-PATH-CANARY',json.dumps(result))
            state.close()


if __name__ == '__main__':
    unittest.main()
