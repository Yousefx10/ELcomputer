# Consented commerce tracking

MKT-META-01 is locally qualified. Production tracking remains inactive.
This increment is recovered onto deployed SMS source573e208/schema118. Its migration
`20261105132000_meta_commerce_tracking.sql` is candidate119, after installed SMS118.
Recheck the physical ledger before sealing; do not reuse the old provisional111.
The preserved balance111 and catalog108/109 labels are historical proposals.

Dashboard → Marketing uses existing `settings.view` and `settings.edit` permissions.
The Pixel/Dataset ID, Graph API version and optional Test Events code are editable.
The separate CAPI token uses the existing server encryption abstraction.
Its password field never receives the stored token. Failed saves retain the draft;
stale revisions fail without replacing newer settings. The existing dashboard
layout, EN/AR, RTL and color modes remain in use.

`NUXT_META_TRACKING_ENABLED=false` and `NUXT_META_DISPATCH_ENABLED=false` are defaults.
Database settings also start disabled, with no ID, token or outbox backfill.
Configure the real business values through the protected Dashboard after a
separately approved inactive installation. Keep Enable and CAPI disabled.
Never place merchant tokens in chat, Git, URLs, screenshots or release reports.

Consent is explicit. Decline and withdrawal are available from the storefront.
GPC/DNT and internal staff exclusion close capture. A random HttpOnly receipt,
its server hash and the current settings revision gate capture and dispatch.
Revocation clears user-agent and optional consented `_fbp`/`_fbc` attributes.
Expiry cleanup scrubs these attributes after180days, including while tracking is off.
Minimal immutable event receipts remain private for deduplication and audit.
No email, phone, checkout note, card field or callback query enters Meta payloads.

The browser emits PageView, ViewContent, Search, AddToCart, InitiateCheckout and
AddPaymentInfo only after consent. Search terms are omitted. Public product IDs,
quantities and values come from the server. Purchase cannot be submitted by a
browser as a normal event. Signed verified CARD funds, authorized verified
InstaPay funds, or an actual spent balance reservation and immutable debit must
already have produced the durable paid order. Under Review is unpaid.
CODOrderPlaced records `uncollected`; Purchase requires actual recorded cash
collection covering the order and a paid order. No old-order backfill occurs.

Browser and CAPI copies share event_name/event_id. Purchase identity is stable
per order; its browser receipt is claimable once. Reloads, repeated callbacks
and worker retries retain that identity. The worker leases one event, performs
one last consent/configuration check, and attempts at most five sends within
24hours. A lost acknowledgement retries that same ID. Revoked, expired and
superseded events are suppressed. Commerce is not rolled back by tracking failure.

The SDK runs only on public URLs without queries or fragments. Account,
Dashboard, API, transfer and payment-result pages never send browser events.
Purchases on those private pages use CAPI only, with the configured store origin
and sanitized `/checkout` source. This deliberately protects payment-return URLs.
CAPI matching can use the consented browser identifiers captured before checkout.

The worker templates in `scripts/meta-tracking-worker` are uninstalled.
Review their deployment-specific app user, Python path, worker path and dedicated
0600 environment file. That file contains only `META_WORKER_ORIGIN` (explicit
`http://127.0.0.1:PORT`) and a separate32+character `NUXT_META_WORKER_SECRET`.
Bind the same secret to the server privately. The worker rejects external URLs,
credentials in URLs, proxies and redirects. Process makes one request per run;
retention scrubs at most500receipts and suppresses at most500events per run.
The service template times out after30seconds. Dispatch runs every10seconds;
retention hourly. Installation and timer activation require separate exact scopes.
No production worker was installed or invoked during local qualification.

Acceptance requires the owner's real Dataset ID/token, a consented Test Events
window, verified first-party events and deduplication in Meta. Test codes and
local acceptance acknowledgements do not prove advertising attribution.
No real Meta request has been made. The primary SDK field definitions were
checked against Meta's official Business SDK; Graphv26.0 is the prepared default.

Disable the database controls and runtime dispatch before stopping the worker
under an approved shutdown scope. Preserve receipts and event identities.
Never repair uncertainty by deleting an outbox row or issuing a fresh event ID.
After any production commit, retain the additive schema and use a compatible
application rollback; never restore a database backup over new commerce activity.

4 November recovery: the reviewed deployment-specific Pixel ID is recorded in
`deployments/elcomputer/meta-readiness.json`, not reusable logic. Enter it through
Dashboard → Marketing after inactive installation. Enter the CAPI token only in
the protected password field there; stored ciphertext is never returned. Keep
both enable controls off until the separate test-event activation packet.

Selected variant IDs/prices are resolved server-side for AddToCart and Purchase.
InitiateCheckout and AddPaymentInfo use the current authenticated server quote,
including shipping/discount/fee totals, and are withheld when context is absent
or expired. Shared analytics IDs survive duplicate delivery. Public SPA navigation
records PageView; a real search query also records Search, without transmitting
the search text. Private and query-bearing URLs do not load/send the browser SDK;
consented CAPI uses a sanitized public source path. No live event acceptance is claimed.

Schema113 authenticated inquiry proof is also accepted only when its transaction,
amount, currency, integration and stored evidence match the verified paid order.
No signed callback receipt is invented for an inquiry. Unverified status checks
and unsigned browser responses still produce no Purchase.

## Pixel and Conversions API coverage

The storefront sends its own `PageView` on each route change, with the event ID the
server also sends. Two SDK flags are set before it loads. `fbq.disablePushState` stops
the automatic `PageView` on history changes, which has no shared ID and lowers coverage
in Events Manager. `fbq.allowDuplicatePageViews` stops the SDK dropping the storefront's
`PageView` as a repeat after the first page.

`InitiateCheckout` waits for the first successful quote because the server values
the event from that quote. A customer with no complete address sends it once the
address allows a quote.

