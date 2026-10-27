# Payment exception monitoring (MON-01)

This worker observes commerce evidence. It never calls Paymob, posts a callback,
invokes a business RPC, or changes an order, payment, reservation or shipment.
Deploying it and the Dashboard field requires a separately sealed owner approval.

The systemd timer runs every five minutes, catches up after reboot, and avoids
overlapping runs. SQLite persists the successful observation time, event identities,
notification claims and 288 compact check receipts. Unscanned journal gaps are
retained separately (512 maximum). At capacity, stop and require staff review.
Do not delete state to clear a warning: that also destroys alert deduplication.

## Evidence and bounds

The worker uses the existing Supabase service credential for GET requests against
five fixed tables. It has no RPC or write transport. This credential still has its
existing database authority; the worker does not create a database read-only role.
Root-owned code, a dynamic service user, systemd credentials, and a filesystem
sandbox protect that authority. The journal group allows reading system journals;
only the reviewed application/proxy units are inspected or summarized.

Each embedded order/attempt/transaction result shares one database statement.
Global exact attempt/transaction counts detect hidden children and orphans.
Concurrent creation can produce a conservative incomplete check; a later full scan
recovers it. There is no permanent creation-time watermark that loses late events.
Limits: 40 pages of 250 orders, 500 children per relation, 4 MiB per HTTP or command
response, 10,000 journal records per unit, a 70-second worker deadline and an
80-second service timeout. Exceeding a bound is an incomplete check, never a pass.
The report never claims a transactionally consistent snapshot across all orders.

Pending/expired/cancelled attempts with no authoritative provider outcome remain
UNVERIFIED. A late signed success is checked against the current order. The legacy
merchant Inquiry API is **not configured** and is never called by this worker.
Only the existing authenticated signed-callback ledger supplies charge evidence.
Full provider history and missing provider-side transactions remain unobservable.

HTTP checks use GET only: capabilities, Cart, Login and the callback route's known
method-denial response. The callback check also compares the proxy configuration
hash. A denied GET does **not** prove POST ingress or valid HMAC processing. Existing
positive callback evidence, new signed ledger events and callback journal errors
provide the other evidence. No synthetic or replayed callback is sent.
Proxy journals provide limited error evidence; absent access logging is not proof
that every checkout request succeeded. Missing intervals are reported explicitly.

## Owner email and Dashboard

The owner changes **Payment alert email** under Dashboard → Email → Settings.
Existing `email.settings.view` / `email.settings.manage`, request protection,
revision checks and audit apply. Blank pauses email alerts and raises a warning;
checks continue. The existing Email settings save contract retires its queued
messages. No general Email worker, marketing or historical backlog is activated.

The monitor reads `config.monitor_recipient` from `email_provider_settings`.
Deployment must initialize that one field through the existing audited settings
command, using an authorized staff actor and the exact current revision. Preserve
all provider, sender, credential and activation settings. Do not use a new provider
key, select a recipient from customer records or route alerts through Auth emails.

Reuse an existing approved SMTP profile through the root-private `smtp` credential.
Require its approved host, port (465 with TLS, or 587 with mandatory STARTTLS),
sender, username and existing password. No plaintext fallback or debug logging.
If this profile is available only inside hosted Auth configuration, activation is
blocked until its existing configuration can be securely reused. A dormant Brevo
API configuration is not evidence that API sending is available.

Alerts contain counts, severity, observation time and the existing Dashboard link.
No customer names, contacts, address, amount, order/provider identifiers or secrets
enter the email. One batch covers new paid orders and changed exceptions. The
configured paid-alert start time separates existing staff backlog from new orders.

Persist a dispatch claim before SMTP. SMTP acceptance is not inbox delivery.
An ambiguous send or crash stays UNVERIFIED and is never automatically resent.
Staff must reconcile it; changing recipient does not resend an uncertain batch.
Unchanged exceptions do not send again. Resolution followed by recurrence can send
one new alert. Tests use fake transports; real test email needs explicit approval.

## Operator configuration and report

Reviewed `/etc/commerce-monitor/config.json` inputs:

```json
{
  "origin": "https://store.example.invalid",
  "application_unit": "storefront.service",
  "proxy_unit": "caddy.service",
  "manual_company_id": "REVIEWED_DEPLOYMENT_UUID",
  "manual_price": "50.00",
  "callback_get_status": 403,
  "caddy_sha256": "REVIEWED_CONFIGURATION_HASH",
  "paid_alerts_since_utc": "REVIEWED_BETA_START_TIME",
  "bootstrap_recipient": "REVIEWED_OWNER_EMAIL"
}
```

Root-only credential sources: `ledger.json` containing the existing Supabase URL
and service key, and `smtp.json` containing only the reused SMTP profile. Neither
the entire application runtime nor a customer session is copied into the worker.
All credential paths and target bindings belong in the reviewed deployment packet.

Read the last committed status without acquiring the worker lock or sending mail:

```sh
sudo python3 -I -B /opt/commerce-monitor/monitor.py report \
  --config /etc/commerce-monitor/config.json --state /var/lib/commerce-monitor
```

The command recalculates heartbeat staleness (15 minutes). `status.json` is a
private atomic snapshot; its stored timestamp must be checked when read directly.
An on-host worker cannot email during VPS or network failure. No external deadman
channel is currently configured: staff must independently verify the heartbeat
and fulfillment coverage every 15 minutes until that requirement is addressed.
This worker does not staff the business or establish merchant-side nonpayment.

The existing purchasing kill switch must remain operable. Before any application
release, qualify its binding to the new release while preserving its original
single-use budget, signed callbacks and owned order access. Never edit or rerun a
consumed activation operator. Closing purchasing is not an automatic monitor action.
