# Current local extension: After-Sales Stage 2, 2026-10-08

Claim reverse bookings now use the existing PDC adapter/settings/authenticated worker/webhook/normalization and private-label transport, with separate claim-linked jobs/history and stable `ASREV-` references. Staff explicitly initiate pickup; reverse events route outside the original outbound/SMS persistence path. Original order AWBs/references/history and normal order PDC SMS remain unchanged. No provider cancellation action is invented.

Unapplied local Stage 2 migration `20261008160000_after_sales_reverse_logistics.sql` follows unapplied Claims Core. No production/provider/credential/deployment operation occurred; existing production release sections below are historical. Real provider/authenticated/native concurrency acceptance remains unverified. Full audit, documented V6 semantics, validation and boundaries: [after-sales-reverse-logistics.md](after-sales-reverse-logistics.md). **No Claim communications; STOP after Stage 2.**

# PDC shipping and customer tracking

Tracking has a committed dormant production release record. PDC → SMS is now implemented locally and awaits its separate migration/release; see [the integration policy](pdc-sms.md). No new production/provider action occurred in that local task. Read [the audit](pdc-tracking-audit.md) and [the implementation report](pdc-tracking-report.md) before activation.

## Existing system retained

The integration reuses `shipping_provider_settings`, `shipping_city_mappings`, `shipping_status_mappings`, `shipping_order_jobs` and `shipping_webhook_events`. Settings and the generic Shipping Companies panel stay in the existing dashboard. SaveShipmentEx, ExportPDF, private labels, paid-order queue triggers, worker authentication, packing, retry limits and historical references remain. The existing `to_ref` (order number or UUID fallback) is not reformatted.

Creation now requires an AWB response with the exact echoed reference; a different shipment's first response is rejected. Credential-bearing provider requests reject redirects. Optional creation-field discrepancies identified in the audit remain outside this tracking change. No queue worker, auto-label flag or production setting was activated.

## Migration

`supabase/migrations/20261005120000_pdc_customer_tracking.sql` is additive and recorded as applied during the prior dormant tracking release. It extends settings with explicit mode/timezone, lookup caches/sync times and throttling; extends existing mappings with normalized state/aliases; extends jobs with shipment state/source/observation and reconciliation time; extends history with job linkage/source/normalized state. Numeric status IDs become nullable for documented name-only API observations. Existing rows, original mapping labels/order statuses and duplicate legacy history are preserved.

A partial unique index enforces `(provider, AWB, StatusID)` for new numeric events. The existing unique event key also deduplicates name-only observations. History queries have an index. Existing shipping-table RLS and service-only grants remain; service-only transactional functions and a customer-authorized private Broadcast SELECT policy are added. No new table or general order-event ledger is introduced. Keep the additive migration if rolling back application output; do not restore the old unsafe webhook with provider delivery active.

## Webhook

The existing endpoint is repaired:

`POST https://new.elcomputer.net/api/webhooks/pdc`

It requires `Content-Type: application/json` and `X-Webhook-Secret`. It has no customer login requirement. The shared secret is distinct from Access Token and compared server-side using the existing constant-time helper. Disabled providers, missing configuration, missing/invalid secrets, malformed payloads, unknown references and AWB mismatches fail closed. HTTPS is supplied by the production Nginx/TLS endpoint; loopback HTTP is for local tests only.

Settings retrieval and processing share a 7.5-second deadline. Input is capped at 8 KiB while streaming, with a two-second upload deadline. Supabase requests receive an abort signal; the transaction bounds lock waits. Responses contain generic errors and never raw database/provider bodies, secrets or customer payloads. No external provider request runs inside the callback.

`shipping_record_pdc_event` locks the existing shipment by REF, requires its already-persisted AWB to match, resolves state, stores history and conditionally updates the current shipment in one transaction. Failures do not acknowledge success; retry cannot be swallowed by an earlier partial insert. The receiver returns 200 only after commit, including successful duplicates/stale events. If an HTTP timeout races a database commit, a later retry remains safe.

Idempotency follows PDC's AWB + StatusID requirement, excluding date/name/reason. Previously processed legacy duplicates are recognized; legacy failed inserts do not block a correct retry. A dated webhook may enrich the same undated numeric reconciliation event once without adding history or order/financial effects. Repeated deliveries after enrichment are inert. Repeat visits to the same StatusID cannot be modeled as separate webhook events without a revised vendor event identity; ID 97 particularly needs clarification.

Valid StatusDate orders history and selects current state. Older/equal-time events are retained without replacing current state. Timezone-free dates use dashboard timezone (default Africa/Cairo), never the execution host. Impossible/ambiguous local dates require an explicit offset. JavaScript normalizes precision to milliseconds. The original provider label, reason, identifier, source and UTC date remain private; large raw bodies/unsolicited fields/secrets are not persisted for new events.

## Normalization

`shipping_status_mappings` separates raw courier ID/label/aliases from normalized shipment state. Dashboard administrators can edit or add mappings, including lookup aliases. Central EN/AR presentation keys keep vendor labels/codes out of customer components. Status 97 and unsupported/reoperate statuses default to neutral `Shipment update`. Unmapped numeric events remain stored and never trigger broad order transitions. Recognized reference reasons are translated; arbitrary raw reasons are retained for staff only.

Courier events now update shipment state only. They do not change order status, payment, inventory, COD, refunds or fulfillment. Existing manually assigned or legacy order states stay intact. The Orders list keeps its existing order-status chips; Delivery shows the separate courier state, avoiding a competing order-status source.

## Reconciliation and lookups

- Existing dashboard settings add explicit production/test mode and editable URL. Exact official HTTPS hosts/paths are validated; the hostname is never rewritten automatically.
- Company/Product IDs, pickup, shipment defaults, encrypted credentials and all existing switches remain dashboard-managed. Credential replacements use existing AES-256-GCM; blank fields preserve secrets and successful saves clear the entry fields. Settings APIs return presence flags only.
- The existing server-wide `PDC_LIVE_REQUESTS_ENABLED` safety gate remains. It gates outbound calls, not authenticated incoming webhooks. Saving dashboard enablement does not silently rewrite it when this gate is off. No new environment merchant configuration is introduced.
- `POST /api/admin-shipping/lookups` uses GetProducts for connection checks. Sync fetches GetProducts/GetCities and atomically saves both caches only against the same settings revision. It preserves all 382 address aliases and configured IDs, including temporarily unavailable product choices. No automatic address rewrite/delete or shipment creation occurs.
- Canonical live IDs/names are cached from API responses, with dashboard counts/timestamps and pickup/product selection. The offline workbook is reference only. Address aliases remain the original working destination mapping; new destination aliases can be maintained as data in that existing table. This task does not redesign checkout address selection.
- Lookup attempts are database throttled to once a minute; no scheduler is added. Saving changed merchant credentials/mode/URL invalidates caches without overwriting configured merchant IDs.
- Staff use the existing Order Details PDC card's **Check courier status** button. `POST /api/admin-shipping/orders/:id/refresh` requires `dashboard.orders` and calls GetShipmentsStatus with the exact saved AWB and REF. Claims are database throttled to five minutes per shipment, including failures. No customer-triggered provider polling is added.
- GetShipmentsStatus supports the documented date/AWB/reference protocol; this feature deliberately uses narrow AWB/reference filters, not bulk date scans. A response must uniquely match both values. StatusID/StatusDate are used only if provided. Name-only states require unambiguous configured aliases; otherwise they remain unknown. Undated records are clearly marked **Status checked**, not a fabricated event time.
- Snapshot query-start time prevents an API response from replacing a callback received during the request. Webhooks remain primary; manual refresh is outage/recovery fallback. No automatic external retry or aggressive polling occurs.
- Lookup responses are limited to 1 MiB/5,000 rows and eight seconds, with strict duplicate-ID validation and redirect rejection. Documented arrays and bounded `data`/`items`/`shipments` envelopes are supported. Explicit partial pagination metadata is rejected. Undocumented pagination/production response shape needs provider confirmation before live acceptance.

## My Account and Realtime

The existing owned-order endpoint supplies a small, whitelisted shipment projection and up to 200 processed history rows, scoped to provider + original REF + saved AWB. Legacy duplicate IDs are collapsed in presentation. Sensitive raw labels/reasons, payloads, references used for matching, label paths, settings and credentials do not reach customer responses. Responses use private/no-store caching.

Order Progress combines actual placement, paid_at, packing_completed_at and courier history chronologically. Packed never implies courier pickup; processing stages are not fabricated. Order status remains a separate caption. Delivery shows PDC, AWB, normalized current state, update/observation time and recognized exception reason. No-shipment fallback remains. Customer Refresh tracking reloads local history only.

Private Supabase Broadcast topics are `shipping:order:<order UUID>`. The database sends `{ changed: true }`; active, non-anonymous owners can receive their own topic only. A coalesced signal reloads the existing authenticated API. Subscription authentication, reconnect refresh, token rotation, sign-out and unmount cleanup are handled. Public Postgres Changes/table grants are not opened. English, Arabic, RTL and existing Light/Dark/System styles are retained.

## Validation and later activation

See the report for exact final results. Focused tests use real local PostgreSQL-compatible application schema and mocked provider calls; browser checks compile the actual Vue account/settings components with isolated customer/admin/Supabase fixtures and production CSS. No live shipment is created.

For Node 22, the pre-existing provider timeout mock needs a referenced test-process handle:

```sh
NODE_OPTIONS=--import=./tests/helpers/keepTestProcessAlive.mjs node --test tests/*.test.mjs
node --test tests/pdc-tracking*.test.mjs
npm run typecheck
npm run build
git diff --check
```

The helper changes no application/payment behavior. Playwright is an external validation dependency; run the browser script with `PDC_REVIEW_PLAYWRIGHT` pointing to its local entry, and optionally `PDC_REVIEW_CHROME`/`PDC_REVIEW_ARTIFACTS`.

Later, after explicit deployment approval: review schema parity and apply only the reviewed migration; release matching application output; keep existing auto-label/worker behavior unchanged; configure server encryption and dashboard credentials/mode/timezone; verify read-only lookups and customer ownership in an isolated authenticated environment; agree status IDs/97/repeated-status identity/timezone/API shape with PDC; provide the endpoint, a securely shared independent secret and reviewed mapping file; register the webhook only after the receiver is reachable and ready. Verify duplicate/ordering callbacks with provider-coordinated safe fixtures before production acceptance. No such activation action occurred in this task.
