# MON-01: Dashboard alerts and durable payment monitoring

The core runs without email. Do not extract or reuse Supabase Auth SMTP secrets.
The worker never invokes business RPCs, Paymob inquiry, callbacks or payment APIs.
It never marks paid, cancels, releases stock, retries or fulfills an order.

A persistent five-minute systemd timer runs one bounded worker. SQLite stores alert
identities, dispatch state, 288 compact receipts, and up to512 uncovered journal
intervals. Overlap is locked. Late callbacks remain discoverable through bounded
full ledger scans. Pending or locally expired outcomes remain UNVERIFIED.

The existing Supabase server credential permits GET-only projections over fixed
commerce tables. Database authority itself is unchanged: this is not a new read-only
SQL role. Root-owned code and systemd credentials protect the existing key; no
customer session, Auth SMTP credential or full application runtime enters the worker.

Limits:40 pages of250 orders,500 children per relation,4MiB per response,10000
journal records per unit,70-second worker deadline and80-second service timeout.
Exact global counts detect embedded truncation. Each order's embedded ledger shares
one statement; cross-order scans are not a global repeatable-read snapshot.
Concurrent insertions can cause a conservative incomplete check rather than a pass.

The worker has a locked, non-login system user. Private state/SQLite files remain0600.
A separate group-readable0640 atomic report publishes at most100 alerts/orders,
with full counts and an explicit display limit. Only the application gets the
reader group through its reviewed systemd drop-in. The group cannot write reports
or read SQLite/credentials. No public static route serves this directory.

`NUXT_PAYMENT_MONITOR_REPORT_PATH` binds the report in the application. The existing
Orders permission (`dashboard.orders`) guards the GET endpoint and Dashboard banner.
The endpoint rejects unsafe modes, symlinks, oversized/malformed files and unknown
schemas. It returns only allowlisted operational fields, with private/no-store
headers. It never runs the worker, reads credentials or modifies alert state.
The Dashboard recomputes stale heartbeat age, uses bounded visible-page polling,
and clears/remounts private state on session changes. No repeating toast is used.
Unresolved alerts remain visible; failed checks preserve last-known details.

Application health, callback proxy configuration and available journal categories
are checked. Callback GET method denial is not proof of signed POST acceptance.
No synthetic callback is sent. No merchant inquiry is configured. Proxy journals
are incomplete evidence when per-request access logging is absent.

## Core configuration

The reviewed private config includes: `origin`, `application_unit`, `proxy_unit`,
`manual_company_id`, `manual_price`, `callback_get_status`, `caddy_sha256`,
`paid_alerts_since_utc`, `report_path`, and **`email_enabled:false`**.
Deployment binds paths, IDs and the existing Supabase credential separately.
The core unit has no SMTP credential and never reads the email-recipient setting.
No SQL migration, email-settings initialization or general Email activation is needed.

Operator CLI (reads committed state without locking the worker):

```sh
sudo python3 -I -B /opt/commerce-monitor/monitor.py report \
  --config /etc/commerce-monitor/config.json --state /var/lib/commerce-monitor
```

Staff must keep Dashboard coverage and inspect fulfillment. A host-local worker
cannot notify during a full VPS/network outage. Missing/stale reports must remain
visible as warnings; the worker does not automatically close public purchasing.

## Optional email, separately approved

The Dashboard Email settings field stores one recipient using existing named
permissions, revision checks and audit. Its default is blank. Existing Email
settings save behavior retires queued messages; this contract is unchanged.
An address alone does not enable delivery. Core health does not depend on email.

If email is wanted later, the owner can configure a **separate** approved SMTP key
for monitoring through Brevo's SMTP settings, without touching the Auth key.
Keep it in a root-private configuration reference, never chat/Git. Minimum fields:
approved sender, SMTP host, port587 with mandatory STARTTLS or465 with TLS,
SMTP login and its dedicated SMTP key. SMTP keys and API keys are different.
[Official SMTP setup](https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP)
and [SMTP key management](https://help.brevo.com/hc/en-us/articles/7959631848850-Create-and-manage-your-SMTP-keys).

A separate reviewed email activation would bind that private profile and recipient
(default proposal: the owner-approved deployment address), explicitly load its
credential, and set `email_enabled:true`. No key, activation or test email is created
by core preparation/deployment. A test message still needs explicit approval.

Email payloads contain counts, severity, check time and a Dashboard link only.
No customer contact/address, order/provider identifiers, amount or secret is sent.
A persisted claim precedes SMTP. Uncertain delivery stays UNVERIFIED without an
automatic resend. Core-only historical events do not become an email backlog.

Every deployment needs a fresh exact approval. Preserve the existing single-use
purchasing kill budget across an app release; never rerun a consumed operator.

## PAY-FIRST-01 optional private checkout coverage (inactive)

`checkout_sessions_enabled:false` is the default when omitted. A separately
approved monitor installation/configuration may set it true after migration108
and its STABLE service-only GET RPC are hosted-qualified. It reads five aggregate
counts only. Verified funds without an order and additional payments are critical;
unprocessed callbacks and overdue unverified attempts require review. Age never
proves failure. RPC errors produce an incomplete check and retain old warnings.
No business write, provider request, new SMTP access, alert reset or replay is added.
The existing worker file/configuration hashes must be freshly sealed before
installation. Monitoring this new lifecycle is a prerequisite to its activation.
