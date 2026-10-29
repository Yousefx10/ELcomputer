> E135,29October2026: the separate approved Paymob shape audit completed once (auth201/paid-control GET200), with no `transactions` field in the matched response. [Receipt and next contract question](paymob-paid-control-shape-review.md). No COD activation/PDC call, app or financial change; PDC cash-unit confirmation still missing. Current MON has four unverified warnings, no critical alert; historical warning evidence retained.

> E134,29October2026: COD still BLOCKED; no written PDC units answer or activation. The separate Paymob7dc4 approval expired unexecuted. Its [refreshed read-only packet](paymob-paid-control-shape-review.md) now binds the current four MON warnings, zero critical; no report/history/financial/provider change. The E133 three-warning counts below are the historical03:22 observation.

# CX-COD-01 activation readiness — E133, 29 October 2026

**COD ACTIVATION BLOCKED.** The missing evidence is PDC's written production
`shipments[].cod` currency-scale contract. The installed safeguards are intact.
No application source, production configuration or provider state changed.

The [exact provider question](pdc-cod-unit-confirmation-request.md) is drafted,
unsent. It asks whether EGP200.35 is `200.35` or `20035`, including precision and
production account/service applicability. Current code sends decimal major units.
The supplied Test PDF calls `cod` a number and illustrates only zero. It cannot
resolve the scale. No live PDC documentation/API request was made.

## Current evidence

Read-only qualification at **03:22:34.509 Riyadh** confirmed production
`9aa61b64c2c5cf9f/schema103`, source `8d75404`, appPID72557/CaddyPID26652.
The schema/security contract matches the sealed schema103 baseline. Seven relevant
source files match the qualified, installed schema101 COD/PDC source `e47e9a7`.
Nine dispatch/cash function hashes and restricted ACLs were captured. No code rebuild,
database migration or replay of old schema101 operators is needed for this review.

CARD-only checkout and Manual EGP50 remain live. The Manual courier's COD flag is
false, its collection provider is `manual`, and the inactive cash fee is EGP0.
PDC COD is false; the narrow staff-COD runtime switch and all global outbound gates
are off. PDC's stored `is_enabled:true` is configuration presence, not permission
to send requests. Automatic labels and reverse shipments are false.

MON-01 is enabled/active/waiting with complete reports and zero critical exceptions.
Its three warnings remain: two overdue-payment-unverified and one
terminal-payment-unverified. Mismatch/duplicate/ownership counters remain zero;
the two overdue payment outcomes remain unverified. The original emergency-close
budget remains1, unused. No monitoring report/history/dedup reset occurred.

## Installed safeguards reviewed

| Boundary | Evidence and retained behavior |
| --- | --- |
| Staff authority | Existing booking API requires an active admin with Orders permission, bounded action-only input and fresh authorization before outbound work. Customer/client COD amounts are rejected. Browser roles cannot execute service-only dispatch/cash RPCs. |
| Approval and packing | SQL eligibility requires ready-to-deliver status, approved/not-required review, completed quantity packing and validated private packing video. Tracked orders retain real serial allocation. The installed101 exception permits ordinary approved untracked COD without invented stock. |
| Explicit courier selection | Manual courier must explicitly select PDC cash collection. COD coverage, cached destination/product and provider capability are checked. The narrow switch permits staff booking/PDF only; it does not enable queue automation, recovery, lookups, tracking or reverse shipments. |
| Full final cash | SQL derives COD from saved `total_amount - amount_paid` in integer minor units, with receipt/balance checks. The serializer currently divides by100. Declared goods value is separate. No browser amount or fee-only substitute is trusted. Verified prepaid CARD has zero COD. |
| Duplicate create prevention | Order-first locks, one job/order, stable original reference, unique dispatch/AWB, durable dispatch marker before HTTP, attempt/token/lease/config fencing and a single non-retrying SaveShipmentEx call. An expired lease cannot reopen an attempted create. |
| Uncertain outcomes | Timeout, ambiguous reply or previous dispatch without an AWB remains uncertain. No second create. Address/cash/status edits are guarded while unresolved. Label retry requires an existing AWB and never creates another shipment. |
| Money recognition | Booking, AWB, dispatch and delivery do not mark cash paid or post Treasury. Confirmed collection needs a receipt/reference/date and bounded amount, idempotency, order locks and audit. Remittance requires separate Treasury authority, full matched evidence and unique reconciliation. |

Sources are the existing booking API, `pdcOrderShipping.js`, `pdcShipping.js`,
`pdcLookups.js`, safe-dispatch SQL, schema101 bridge and normal-COD collection SQL.
The current database functions/ACLs match the installed schema103 baseline.

One original CARD EGP2 job and private dispatch remain **uncertain**, attempt1,
dispatch-started, no AWB. Their original reference remains bound and quarantined.
The narrow COD switch cannot enable their recovery. An absent AWB or prior HTTP500
does not prove no shipment exists. Provider reconciliation of that original incident
remains separate; never retry/rebook automatically or attribute its cause to cash units.

## Reused qualification and evidence limits

Retained schema101 logs show **64 native/API checks and 13 scoped-gate checks PASS**,
including full-balance serialization, packing, access, one dispatch, uncertain outcomes,
collection/remittance separation and CARD protections. The amount-only receipt has
two passes contained in that scoped qualification. These suites, typecheck and build
were **reused, not rerun**. Source/schema bindings were freshly checked instead.

Real COD booking, collection and remittance provider acceptance remain **NOT
EXERCISED**. The old generic HTTP500 cause remains unknown. Local safeguards are not
proof of a successful provider booking. Owner address-book/location/navbar visual
acceptance remains **PENDING**. All deferred tests, DTR-33/STOR-01 and other preserved
work remain open. No completed UI deployment or broad test suite was repeated.

Private evidence: `../cod-pdc-readiness-20261029/` contains current host/schema/settings,
safe job/function projections, PDF hashes and seven source bindings. All33 opening
worktrees/HEADs and unrelated pending-file hashes are preserved. No new worktree,
app-source edit, Git push, credential export, production write or provider call.

## Smallest remaining plan

1. Obtain PDC's written answer to the exact EGP200.35 example. Keep COD off meanwhile.
2. If PDC confirms decimal EGP, retain the installed serializer and schema103.
   **No application deployment or migration is needed.** If it confirms piastres or
   another format, qualify only the necessary portable amount conversion before
   preparing an application-only release. Never guess or change declared value.
3. Once the contract is qualified, prepare a fresh activation packet on the then-current
   production baseline. Set the existing cash fee to EGP50, retain delivery EGP50,
   enable COD/PDC collection on the exact Manual row, enable PDC COD capability and
   add cash to the existing CARD methods. Enable only the narrow staff-COD switch.
   These are separately approved production settings/runtime changes and one app
   restart; global PDC gates, automatic booking/reverse/recovery stay off.
4. Guard the exact existing rows/runtime/schema, CARD, MON warnings, callback routes,
   credentials and original kill budget. Obtain fresh backups/readbacks and focused
   activation preflight. Stop on drift, expiry, partial write or uncertain outcome;
   no retry, automatic rollback or old approval reuse. No synthetic stock/order,
   automatic shipment, collection receipt or Treasury entry belongs in activation.
5. Provider booking acceptance needs a separately authorized eligible order and
   staff approval/packing. Confirm the saved full cash amount before the first create;
   preserve its reference, stop on ambiguity and reconcile before any further create.
   Collection/remittance need actual verified evidence, never a booking result.

**No COD activation approval is issued while the provider contract is missing.**
The schema101 deployment and LOC/navbar approvals are consumed; old COD activation
packets are held/expired and cannot authorize current production changes.

As requested, the independent [Paymob paid-control shape audit](paymob-paid-control-shape-review.md)
is prepared for a separate read-only approval. It has no COD/PDC dependency and cannot
enable Pay Again, reconcile money or settle either unpaid exception. After Inquiry
qualification, preserve the order: safe Pay Again/method changes, remaining PDC tracking,
customer transactional emails, SEO/legacy redirects, then remaining deferred work.
