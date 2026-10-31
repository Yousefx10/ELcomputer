# Bounded PDC tracking

SHIP-08 / SHIP-10. Candidate107 builds on deployed label source4238e92/schema106.
Local qualification is distinct from deployment, activation and genuine provider acceptance.
Existing GetShipmentsStatus/dated filters, status mappings, private history, immutable
AWB/REF dispatch proof, staff authority and owned-order endpoints are reused.

## Inactive release boundary

One additive106→107 migration; all106 historical migrations are unchanged. Existing
provider credentials, pricing, COD fee, booking/label controls, Email, MON and all order/
payment/collection/refund records remain unchanged. No new background process starts
from application boot. New runtime defaults are all OFF:

- NUXT_PDC_TRACKING_REQUESTS_ENABLED
- NUXT_PDC_TRACKING_WORKER_ENABLED
- NUXT_PDC_WEBHOOK_ENABLED

NUXT_PDC_TRACKING_WORKER_SECRET is absent until a separate approved activation.
Existing global PDC booking gates stay OFF; the existing narrow staff booking gate
is preserved. Tracking has its own read-only gate and cannot enable booking, labels,
lookups, pickup or reverse operations. No fees or merchant/account identity are coded
into this implementation. Current server-authoritative settings govern commerce.

## Polling and durable limits

Only a normal shipment whose saved AWB/order/REF matches the private created-dispatch
ledger and a production account identity can be polled. Current account/base URL/
mode must still match. Cancelled orders, uncertain/unassigned or unverified/manual
AWBs, terminal shipments, suspended failures and over-age automatic checks are excluded.
Verified pending-label shipments remain trackable; label failure never recreates them.
Future booking/recovery stamps the actual local AWB verification time. Existing rows
are not backfilled; an old genuine booking may display without an invented date.

The provider row locks atomic claims across all worker instances and manual refreshes.
A bounded array of at most500 reserved request times enforces strict rolling minute/
hour/day quotas. Reservation occurs before provider access and survives failure,
process exit and restart. A two-minute per-shipment token/lease prevents overlapping
checks; an expired token cannot finish a newer check. Lost acknowledgements are not
immediately retried. No provider write utility is imported into the tracking engine.

Defaults:15-minute shipment interval,2 requests/minute,20/hour,100/day,3 per batch,
one concurrent request,8 failures before automatic pause,90-day automatic horizon,
one-hour stale threshold. Configurable hard ceilings are5/minute,60/hour,500/day,
5/batch and2 concurrent. Minimum interval/failure cooldown is5 minutes. Each claim
checks the provider policy again; authorization/account configuration are rechecked
before the provider read and before ingestion. A worker starts no more work after
20seconds; each transport/database step has a timeout. Provider HTTP is bounded to
8seconds/1MiB, redirects refused and exact unique AWB+Ref required.

Failures use capped exponential backoff, up to24hours. Automatic checks pause after
the configured failure limit; an explicit staff check may recover after the saved
due time, with all quotas/leases still enforced. Success clears failure telemetry,
updates last successful check and schedules the configured interval. No tight retry
loop, automatic booking or uncertainty replay exists. The portable caller makes
one loopback HTTP request with no redirects/proxy/retry and prints aggregate counts
only. Its systemd timer wakes every60seconds, does not catch up missed runs, and
cannot run a second copy while the oneshot is active. Templates are prepared only;
no service/timer is installed or activated by the application release.

## One ingestion path

Polling and authenticated callbacks use the existing atomic event dispatcher and
AWB+StatusID identity. The outbound core retains exact REF/AWB/private dispatch proof,
unique history, query-start chronology and dated-callback enrichment. Name-only
unchanged snapshots deduplicate too. Bounded raw status/code/reason/time/source stay
in private history; arbitrary payload/recipient data and secrets are not stored.

A progress watermark rejects lower-phase or contradictory terminal projections.
Conflicting/out-of-order raw evidence stays private with its disposition; higher
phase evidence with contradictory chronology is withheld. Customers receive accepted
milestones only. Numeric ID/label contradictions (including the vendor illustration5/Shipped conflict) are withheld in private conflict evidence; a terminal status also requires a configured matching label. An already deduplicated contradictory identity needs reviewed evidence/mapping recovery, not automatic reinterpretation. Unknown mappings remain neutral; ambiguous97 is not guessed.
A repeated StatusID is one event under the vendor contract, not proof of a new visit.
The same registered shared secret cannot establish a new callback identity on replay.

Shipping ingestion never changes order/payment/refund/COD/Treasury/inventory state.
Delivered is carrier evidence, not cash collection or settlement. Existing SMS/Email
settings are not activated. Private realtime publishes only {changed:true}; customers
reload their authorized stored endpoint, never GetShipmentsStatus directly.

## Staff and customer presentation

Dashboard shows AWB, normalized state, successful check/update time, stale/error data,
next due check and raw private history with timestamps/source/conflict disposition.
Manual refresh requires current Orders authority and is subject to the same policy,
lease, cooldown and quotas. HTTP resubmission is disabled. Existing label and booking
controls are retained. Customer My Account shows placement, actual packing/payment
proof where already authorized, verified booking and actual accepted carrier events.
No intermediate scan, delivery time or payment success is invented.

Customer projection removes private diagnostics, raw text, notes and provider identity.
Ownership and current account status are checked before reads and again before return.
A binding hash ties the read job to the verified metadata. Unverified AWBs/history
are withheld. Unavailable tracking does not erase the owned order; it returns an
honest unavailable state. EN/AR/RTL, responsive layouts and existing themes remain.
The account refresh and private Broadcast reload read stored data only.

## Webhook contract and acceptance

The existing vendor guide specifies HTTPS POST/application/json, X-Webhook-Secret,
AWB/REF/StatusID/CustomerStatusName/ReasonName/StatusDate, acknowledgement within
10seconds and AWB+StatusID idempotency. No HMAC signature is invented. The existing
handler uses an independent encrypted minimum32-character secret, timing-safe check,
bounded8KiB/2second body and7.5second deadline. The new runtime callback gate remains
OFF. Authentication precedes parsing; no provider request occurs in a callback.
Replay, duplicates, wrong bindings, out-of-order events and polling/callback races
are qualified locally against the same stored ingestion and private projection.

Live registration/account mapping/timezone/authenticated callback acceptance remain
unverified. Optional webhook cutover needs separate registration/security evidence
and owner approval. Polling works with webhook processing OFF and does not wait for it.

## Activation, disable and deferred acceptance

Deployment approval covers only the inactive migration/application. A later separately
sealed activation must bind the installed107 archive, independent worker secret,
current policy and original emergency controls; install reviewed caller/units and
open only the tracking runtime/policy gates. Callback activation is separate.
No generic PDC flag, auto-label flag or booking worker is enabled.

Emergency tracking disable: stop/disable the dedicated tracking timer first; under
separate authorized operations set tracking_policy.enabled=false. In-flight reads
recheck that gate before ingestion, and leases expire without immediate replay.
Keep booking/CARD/COD/Email/MON controls unchanged. Runtime/key removal or app rollback
requires its own reviewed approval; never auto-restore a database or replay migration.
Native rollback validates the uncommitted transaction only. The additive schema may
remain if an older app must be restored under a fresh exact recovery.

First genuine AWB acceptance remains pending: actual provider response/timezone/
status mappings, scheduled and manual checks, stored customer timeline, real callback
when registered, and the label PDF/physical printer/barcode acceptance from DTR-21.
No synthetic production order/shipment is needed. Historical uncertain booking and
cancelled COD remain quarantined/excluded. No pickup development. After independent
tracking/webhook readiness, proceed directly to SEO/legacy redirects, historical
WooCommerce migration and UI. Paymob awaits the reply; detailed settlement/ERP LAST.
