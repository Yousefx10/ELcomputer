# After-Sales Stage 2 — PDC reverse logistics, local implementation, 2026-10-08

Extends Claims Core `c43b1f2`. Approval remains **ready for logistics**, with no automatic booking. Authorized staff explicitly confirm an item-return purpose and current pickup details. No production credentials/access/migration/deployment, real PDC/Vodafone request, SMS/email, refund, inventory operation or outbound replacement occurred.

## Audit and documentation authority

Reviewed AGENTS, PROJECT_STATE, CODEX_HANDOFF, Claims/policy/warranty records, PDC tracking audit/report/shipping/SMS records, customer/order snapshots, quantities/evidence, Claims states/actions/permissions/audit, PDC settings/encryption/city/status mappings, outbound jobs/history, worker, webhook, reconciliation and private labels. Existing outbound jobs have a unique **order_id** and retain paid-order/preorder/packing behavior; they cannot safely represent multiple claim bookings.

Read all ten pages of the supplied **Customer Courier Integration Test V4.pdf** (V6 technical guide, July 2026) and the six-page **Customer Webhook Integration.pdf** from the existing Downloads copies. No provider API was used to obtain them. The V6 guide documents General **1**, Reverse **3**, Exchange **5**; `from*` fields identify the shipper and `to*` fields the consignee. This implementation sends the customer pickup as shipper, saved store destination as consignee, and the separately configured Reverse type. Replacement handling never selects Exchange. Optional creation-field spelling discrepancies remain excluded from the reverse payload; existing outbound payloads are unchanged.

The documented endpoints include SaveShipmentEx, ExportPDF, GetShipmentsStatus and city/product lookups. No cancellation API is documented, so there is **no Cancel Shipment action**. No appointment date or undocumented reverse field is invented. “Pickup Scheduled” means the reverse booking was accepted, not that an appointment timestamp was supplied.

Existing status normalization is reused. Status 97 remains unknown; prior sheet/PDF illustration conflicts, repeated-status identity, response pagination and timezone limitations are retained. Real merchant product/type compatibility, provider delivery/label behavior and mappings need separate authenticated/provider acceptance before activation.

## Records and separation

**Unapplied migration:** `20261008160000_after_sales_reverse_logistics.sql`, immediately after unapplied Claims migration `20261008120000_after_sales_claims_core.sql`. Repository: **65 migration files**; production's last recorded checkpoint remains **63**, not refreshed in this task.

| Record | Stage 2 behavior |
| --- | --- |
| `shipping_claim_jobs` | Private claim-linked durable booking/label work, immutable pickup/destination/quantity/context, stable reference, provider/account identity, outcome/lease/diagnostics |
| `shipping_webhook_events.claim_shipment_job_id` | Separate reverse linkage in the existing private history; mutually exclusive with outbound `shipment_job_id` |
| `shipping_provider_settings` | `reverse_enabled=false`, separately configured `reverse_shipment_type_id=NULL` constrained to documented Reverse 3; prior settings untouched |
| Claims events/state | Courier/worker event kinds, guarded pickup/transit/receipt integration; existing decisions/evidence/purchased context retained |

No historical job creation, Approved-claim scan, notification producer or new generic job system. One partial unique index allows only one queued/creating/created/uncertain reverse job per claim. Prior failed/cancelled/returned bookings retain all references, AWBs and history. New jobs and reverse history are retained, protected against direct mutation/deletion/truncation, and recognized by the existing reset planner. Existing outbound business rows and original canonical/SMS bodies are verified preserved at the 64-migration checkpoint.

References use **ASREV- + 32 UUID hexadecimal characters**, contain no PII and are persisted before network work. Outbound future references cannot use the reserved namespace; legacy references are retained. Unique reference/AWB constraints plus a shared advisory AWB lock prevent cross-purpose identity collisions. Routing always uses persisted REF linkage and matching AWB, never AWB format alone.

## Staff initiation, policy and pickup

Stage 2 follows active Claims ownership/purchased-policy admission. It does not re-expire a timely approved case while staff handle it. Booking requires Approved, an appropriate purchased Return/Warranty resolution context, explicit `return_required=true`, reason, valid contact/address/city mapping, current revision and logistics permissions. Closed/refunded orders, unavailable ownership and conflicting bookings are refused. Return handling is refund-decision context; Warranty choices come from the purchased whitelist excluding Service Center Referral. Logistics context does not set or guarantee the final commercial resolution.

The original order contact/address safely prefills staff confirmation. City prefill requires an exact existing governorate/city/Arabic-alias match; missing mapping is left unselected, not guessed. Staff may capture an alternate current pickup using an existing mapping ID. The canonical transaction resolves its PDC city ID. Pickup, destination and approved claim quantity are immutable on each booking; later profile/order/settings edits do not rewrite them or the original order snapshot.

Existing configured product, store destination and default shipment weight are used. No merchant/token/product/city defaults are added to claim code. With no authoritative item weights, the established shipment default applies; `pieces` uses claimed quantity and the internal quantity remains explicit. No unit/QR association is inferred.

Dashboard Shipping settings now separately configure reverse enablement/type while retaining existing encrypted credentials, mode/URL, merchant product, origin/destination details, labels and outbound controls. Missing settings, runtime live-call gate, encrypted credentials/webhook readiness or required location fields yield controlled provider-not-ready behavior. The staff request then creates **no job/AWB/status change**, so enabling PDC later cannot book dormant attempts.

## Worker, retry and uncertainty

```mermaid
flowchart LR
  A[Approved claim] --> B[Staff confirms pickup]
  B --> C[Durable reverse intent]
  C --> D[Existing authenticated shipping worker]
  D --> E[Existing SaveShipmentEx adapter]
  E --> F[Exact REF and validated AWB]
  F --> G[Pickup Scheduled]
  E --> U[Uncertain result]
  U --> R[Staff recovers by stable REF]
  R --> F
```

The existing `/api/internal/shipping/process` worker handles outbound work and separate reverse jobs. Reverse creation does not depend on outbound auto-label enablement. Dashboard booking only persists intent. Existing transport/headers/encryption/official-host validation/redirect rejection are reused; reverse JSON is capped at 1 MiB with the existing 15-second request timeout. Labels use the existing 20-second transport plus a 5 MiB/signature bound.

Canonical item → claim → job locks and worker tokens prevent double claims. Intent authorization expires after ten minutes; current settings fingerprint, claim/customer/order and initiating permissions are rechecked before dispatch. Disabled/changed/expired pre-network intent becomes failed and requires explicit staff reconfirmation. Interrupted creating work becomes uncertain after its two-minute lease; it is never resubmitted automatically.

Only an exact successful reference/AWB result becomes created. The documented allMustValid single-shipment validation rejection can become definite failure; malformed/mismatched/network/timeout outcomes stay uncertain. A provider success whose durable/audit commit fails also stays recoverable rather than creating again. SQL completion is idempotent; no AWB is overwritten.

Recovery performs bounded GetShipmentsStatus by the same REF (empty AWB filter when unknown). It requires exactly one matching, valid record and commits that existing AWB before tracking. No match/ambiguous response leaves uncertainty intact; absence is never treated as proof that it is safe to create again. Current credentials may rotate within the same immutable provider account/mode/URL for recovery; changing accounts cannot redirect an old booking's lookup. Staff recovery/refresh is throttled to five minutes.

Explicit rebooking requires retry permission and the latest definite failed/cancelled/returned job ID. It creates a new identity and immutable snapshot; it preserves previous history. A controlled rebooking is allowed from pickup/transit after dated terminal courier failure; it never follows an uncertain outcome. No real provider cancellation is simulated. Live/uncertain bookings block customer cancellation and manual receipt so a courier job cannot be detached silently.

## Webhook, reconciliation and Claims states

The existing `/api/webhooks/pdc` retains secret comparison, JSON/body/time bounds, service-only persistence and REF/AWB verification. The canonical dispatcher routes reverse references to the claim transaction and other references to the unchanged outbound/SMS function. Reverse ingress never runs ordinary order PDC SMS.

| Evidence | Reverse/Claim effect |
| --- | --- |
| Verified creation response | Job created; Claim Pickup Scheduled |
| Dated normalized picked_up/in_transit/arrived_at_hub/out_for_delivery | Claim In Transit to ELcomputer |
| Dated normalized delivered, after booking | Claim Received; no inspection/resolution automation |
| Undated status observation | Tracking only; no fabricated physical milestone |
| Unknown/97/delayed/attempt/held/lost/damaged/partial/returning | Reverse history/exception only; no rejection/cancellation/receipt |
| Dated normalized cancelled/returned | Booking terminal, Claim decision unchanged; controlled rebooking may be offered |

Webhook and reconciliation share AWB + StatusID identity and canonical history. Undated reconciliation can be enriched by a dated callback once; only that dated observation emits the physical timeline/transition, avoiding duplicate logical timeline entries. Older/equal-time updates and stale snapshots cannot regress current state. Completed/terminal bookings and prior bookings cannot advance a newly rebooked claim; Received/inspection/resolution never regress to transit. Predated booking evidence cannot establish physical receipt. Histories keep original bounded labels/reasons privately; customer presentation uses normalized translations.

Staff manual receipt remains the existing reason-required, audited Claims action for legitimate walk-in/manual handling without live/uncertain courier work. It is distinct from `reverse_received`. Once Received, existing Claims inspection and policy-controlled decision workflow continues normally.

## UX, labels, permissions and privacy

Existing claim detail gets one Reverse Logistics panel, without redesigning the Center. EN/AR/RTL/mobile/desktop/Light/Dark/System show booking/latest normalized state, AWB, owned pickup summary and dated/observed history. Staff with operational access can confirm pickup, queue creation, recover/check status and prepare/download labels. Read-only roles lack mutation controls. Raw provider payloads, diagnostics, destination configuration and internal notes do not enter customer responses.

Generic ExportPDF documents labels for persisted AWBs; authorized staff explicitly queue label preparation on the same job/worker. Private paths are `shipping-labels/claims/{claim}/{job}.pdf`; label retry never recreates a shipment. Retrieval checks claim/job permission, MIME/signature/size and serves private/no-store attachment with nosniff/sandbox. A restrictive Storage prefix policy protects reverse labels even alongside broad browser rules; existing outbound paths are unchanged. Real reverse-label provider behavior remains unverified.

New default-false permissions: `claims.logistics.view`, `.create`, `.retry`, `.diagnostics`; existing Claims view remains required, and operational capabilities depend on logistics view. The new view permission gates pickup/operational details and labels; Claims viewers retain basic customer-safe shipment context. Manual receipt retains `claims.manage`. Customers read only owned safe projections and cannot create jobs, assign AWBs or call provider RPCs. New table RLS has no browser grants; canonical writes are service-only and repeat active actor/ownership/permission checks.

Staff confirmation/initiation/rebooking, recovery/refresh/label requests and worker/provider outcomes are audited with correct requesting actor or automated source. Revision/state/history/audit commit atomically; outage rolls back. Generic logs hold controlled references/state/diagnostic codes, not addresses, secrets, evidence, private notes or raw response bodies. Private operational snapshots preserve the staff reason separately.

## Validation

**Final local validation: 527 full-suite passes / one existing optional native concurrency skip; typecheck/build/diff passed.** Full suite used `node --test --test-concurrency=1 tests/*.test.mjs` to avoid the known scheduling-sensitive Paymob fixture. Stage 2 has 21 passing SQL/HTTP/security/worker cases in that final run; the separate focused Stage 2 run passed 20 before the last Storage boundary case was added. The earlier focused Claims/PDC/PDC SMS/Order SMS run passed 117, and all are included in the final full suite. Existing ERP import, source-map/chunk and preorder build warnings remain; no new duplicate-import warning was introduced. Focused tests cover actual disposable SQL and actual HTTP staff/customer/worker/webhook routes, input spoofing, policy/status/role admission, provider dormancy, immutable alternate snapshots, quantity, duplicate requests, leases/settings drift, responses/uncertainty/recovery, atomic commit outage, history retention, Storage boundaries, normalized/date/dedup/order protections, labels and outbound/SMS separation.

Stage 2 browser: **537 assertions / 110 states / 110 screenshots / 251 JSON responses**, including actual staff form → authenticated mocked worker → AWB/label → reconciliation/transit → webhook/receipt → inspection, reference recovery, permission states and all locales/widths/themes. Zero browser errors/external requests. Existing Claims browser regression: **496 assertions / 120 states / 120 screenshots / 293 JSON responses**, zero errors/external requests. Artifacts: `/tmp/elcomputer-after-sales-reverse-browser/` and `/tmp/elcomputer-claims-core-browser/`.

Authentication/Storage transport and PDC behavior are **isolated fixtures**. Real authenticated Supabase persistence/quotas, independent native PostgreSQL concurrent sessions, real PDC acceptance/webhook delivery/recovery/labels and production acceptance are **NOT VERIFIED**. PGlite concurrent promise tests verify transactional behavior/constraints, not independent native-session concurrency. No production data or session was manufactured.

## Remaining scope and stop

Separate release review must apply both ordered Claims migrations and the matching code only after authorization. Configure/approve real purchased business rules, provider settings/product/type/destination/mapping/timezone and complete authenticated/native/provider acceptance deliberately; no activation occurred here. Existing V6 pagination/repeated-status/97 ambiguities remain unresolved and conservative.

**Stage 3** may separately connect Claim milestones to central SMS/email with deliberate reverse purpose, deduplication, recipient/locale policy and enablement. No Claim notification producer, template/queue or scheduler was added. Normal outbound PDC SMS remains separate.

Refund execution, credits, inventory replacement/restock, serialized ownership/QR and outbound replacement fulfillment remain separate concerns. **STOP after Stage 2. No communications work begins.**

## Required flags

```text
PDC REVERSE LOGISTICS IMPLEMENTED: YES
APPROVED CLAIM CAN CREATE REVERSE PICKUP: YES
REVERSE PICKUP REQUIRES EXPLICIT STAFF ACTION: YES
RETURN CLAIM PDC REVERSE SUPPORTED: YES
WARRANTY CLAIM PDC REVERSE SUPPORTED: YES
ORIGINAL ORDER SHIPMENT PRESERVED: YES
REVERSE SHIPMENT HAS SEPARATE HISTORY: YES
CLAIM REVERSE TOREF STABLE: YES
PDC REF/AWB VALIDATED: YES
REVERSE SHIPMENT IDEMPOTENCY DATABASE-BACKED: YES
PDC WEBHOOK SUPPORTS REVERSE SHIPMENTS: YES
PDC RECONCILIATION SUPPORTS REVERSE SHIPMENTS: YES
PICKUP SCHEDULED CLAIM TRANSITION CONNECTED: YES
IN TRANSIT TO ELCOMPUTER TRANSITION CONNECTED: YES
RECEIVED CLAIM TRANSITION CONNECTED: YES
PDC EXCEPTIONS AUTO-REJECT CLAIM: NO
PDC EXCEPTIONS AUTO-CANCEL CLAIM: NO
REPLACEMENT OUTBOUND SHIPPING IMPLEMENTED: NO
AUTOMATIC REFUND EXECUTION CONNECTED: NO
CLAIM SMS CONNECTED: NO
CLAIM EMAIL CONNECTED: NO
REAL PDC PRODUCTION API CALLED: NO
REAL VODAFONE API CALLED: NO
REAL SMS SENT: NO
PRODUCTION MIGRATION APPLIED: NO
PRODUCTION DEPLOYED: NO
```
