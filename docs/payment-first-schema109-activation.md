> E195: the exact activation was applied once and is CONSUMED_COMPLETE.
> Payment-first CARD is ACTIVE; owner confirms Card+Cash options load.
> [Actual execution receipt](payment-first-schema109-activation-receipt.md).
> No new approval is needed for closeout; never replay this consumed packet.

# Existing CARD core activation on schema109 — E194, 2 November 2026

**READY / SEALED / UNAPPROVED. No activation performed.**

The owner confirmed “Products load normally.” Public P0 recovery acceptance is
complete. App81f6206b393714ae/source7b33 remains installed with database109after the
separately approved one-function catalog correction. All earlier approvals remain
spent. The old core108activation draft is retained unsealed and unexecuted.
This packet reuses its implementation and qualified operating procedure.

## Exact change requiring approval

1. Call the existing service-only `commerce_payment_checkout_configure` once with
   the bound active owner, revision0and enabledtrue. This creates enabled_since,
   revision1and one audit row. It performs no historical backfill.
2. Change onlyNUXT_PAYMENT_FIRST_ENABLED andNUXT_PUBLIC_PAYMENT_FIRST_ENABLED totrue.
3. Restart the same deployed application once. Pause/resume the existing MON,
   Email and PDC timers once while their current callers finish. Never invoke a
   worker manually, terminate a caller or replay a provider request.

No app deployment, migration, Caddy change/signal, credential change, provider
probe, test order, charge, refund or fund credit is included. The restart is a
brief intake transition. Existing cart/session/payment evidence stays durable.
Old cached clients may need to reload; the database prevents legacy unpaid CARD
orders after enabled_since rather than accepting a stale confirmation silently.
Existing orders and signed callbacks remain supported. This is an explicit
activation of the already installed flow, not a new payment-method deployment.

Future authenticated customer CARD confirmations use the existing Paymob
Intention/hosted Redirect path. A verified matching live payment creates exactly
one paid order. Failed, abandoned, pending or unverified attempts create no normal
order. Duplicate/late callbacks retain their truth and do not duplicate an order.
COD remains its separate confirmation path, unpaid/awaiting collection, using the
current server-authoritative EGP10fee. The operator makes no Paymob request; later
real customers' explicit CARD payments continue under the approved commerce flow.

## Evidence and precise limits

| Check | Result |
| --- | --- |
| Existing core on actual109fixture, callback/HMAC/privacy/concurrency/uncertainty |23PASS |
| Control/RBAC/revision/audit/disable/late verified funds/COD; actual operator SQL transaction |10PASS |
| Scope, one-use, expiry, failure restoration, schema108rejection and preserved gap binding |20PASS |
| Exact deployed build, inactive/active/disabled local HTTP modes |3PASS; secrets absent, private401/no-store/no-referrer, COD retained |
| Fresh database and17runtime files |20:32:24UTC encrypted full authenticated restore/readback PASS |
| Hosted schema109compatibility and existing catalog correction |PASS; integrity issue counts0; private controls/counts0 |
| Final sealed read-only preflight |PASS 2026-11-02T20:37:59.996Z |
| Owner signed-in Payment activity |Previously accepted empty page; no real/private-foreign record acceptance inferred |
| Owner public recovery |Products load normally; no product-save or real-payment acceptance inferred |

All33SQL/HTTP cases and20guards are local/disposable. All3runtime modes used the
actual deployed Nitro build with loopback fixtures. No artificial paid order,
email, shipment or hosted customer mutation was created. No new app typecheck or
build is required because no application bytes change; earlier build/asset and
browser evidence stays retained. Actual genuine payment-first end-to-end customer
acceptance remains a future event, not a claim derived from a fixture.

The original108migration and its deployed payment functions are unchanged. The
only109migration is the already approved catalog exception correction. Its exact
PT409body and actual migration history are required by readiness. Original
InstaPay221000and balanceNov2candidate SQL and feature sourceffc1a30stay untouched.
Their future sequence numbers are110and111if installed in order.

## Monitoring and caller evidence

The fresh plan pins the seven original UNVERIFIEDpayment warning identities and
three journal gaps, with zero critical findings. No warning, gap, uncertain order
or provider evidence was manually cleared or reconciled. The temporary missed
interval ended naturally after regular MON checks resumed; its outage record is
retained in the E192receipt.

A later JOURNAL_UPSTREAM warning caused the exact-drift guard to STOP during
preparation. Read-only journal evidence shows Caddy aborting writes to a remote
client; it does not show a refused backend connection. The broad pattern matches
an upstream field followed by a client-write timeout. It was reviewed, retained
and later ended naturally in MON. No regex, Caddy, timeout or logging setting was
changed. Initial7- and8-warning preparation bindings and all STOP evidence remain
archived. The final packet pins the actual current seven-warning state; another
change still stops execution. A future postflight drift needs evidence review,
not a warning clear or automatic new baseline.

Two natural tracking caller ticks,20:13:02and20:26:42UTC, reported a closed generic
unverified outcome. Their exact underlying cause is not established; no speculative
provider result or retry is claimed. Following20:27:40and20:28:44scheduled runs
recorded checked0/failed0/emptytrue, with0eligible AWBs. No provider request or
manual worker was made. Caller failure evidence remains preserved, and fresh
preflight continues to require successful current callers. Do not reopen or use
the historical uncertain shipment as a test. Tracking investigation/provider work
is not expanded by this activation packet.

## Approval and one-use operation

```text
APPROVE PAYMENT-FIRST SCHEMA109 CORE ACTIVATION e0d17db79a1cdbf933cccfdd5bd2ddb404fe4eeb7f5a71f0df81446c53e6452d
```

Expires **2026-11-02T22:36:17.701Z / 01:36:17 Riyadh, 03 November 2026**.
The operator requires at least three minutes remaining before an apply begins.
The private frozen packet is:
`/Users/imac/Documents/ELcomputer/payment-first-core109-activation-20261102/plan.json`.

No activation-attempt or remote activation stage has been created. After exact
owner approval, run the pinnedNode22.23.1operator check, then apply the exact full
approval phrase once. Recheck target/release/source, frozen inputs, backups,
settings revision, schema/function/RLS/Auth/history, worker state and current MON
identities/gaps. Any failed or uncertain apply is held for evidence review, never
blindly retried or automatically rolled back. Old sealed helpers and approvals
are reused only as frozen library/budget evidence, never as mutation authority.

After activation, verify loaded runtime and one restart, the control/audit receipt,
CARD/COD capabilities and owner-scoped private endpoints without starting payment.
Observe the next natural MON and callers; do not invoke them. Preserve all old
payment warnings/gaps. A genuine future purchase may provide end-to-end provider
acceptance under its own actual customer confirmation; no synthetic transaction
is part of this seal.

## Emergency disable and recovery

The packet includes one existing SQL-only disable for a critical payment/privacy/
monitoring failure or explicit owner request. Use the exact activated seal and a
recognized reason with the sealed operator's disable mode. It changes enabledtrue
revision1tofalse/revision2with one audit, keeps enabled_since and runtime flags,
and does not restart the app. New prepaid claims stop while COD, private history,
valid callbacks and late verified success remain supported.

Never restore runtime flags tofalse after the activation boundary, replay an
uncertain charge, infer a refund or roll back a database over later customers.
An incomplete activation requires a fresh state-bound recovery; no completed
receipt is manufactured. Original public purchasing/COD/Email emergency fences
and their existing budgets remain available and are not renewed by this packet.

## Other methods remain separately gated

| Method | Current boundary |
| --- | --- |
| Existing CARD |This packet alone enables payment-first using the qualified hosted Redirect |
| Apple Pay |Owner reports Paymob handles merchant activation; actual offered-method evidence still pending. No generic certificate/domain demand or repeat inquiry |
| Pixel CARD |Existing SDK1.2.8preparation retained locally/OFF; actual merchant3DS and embedded-flow acceptance pending |
| InstaPay |Original local candidate preserved/OFF;110inactive release, verified recipient/private proof controls and bank review still required |
| Egyptian wallets |Actual merchant integration ID and authenticated flow evidence pending;OFF |
| Account balance |Local ledger candidate preserved/OFF;111and legitimate funding/reconciliation/terms remain separately required |
| Google Pay |OFFby owner decision |

Detailed PDC settlements/ERP remain LAST. Historical metadata, UI/SEO work,
worktrees and all deferred cases remain preserved. One current feature at a time.

**ONE next action:** approve the exact existing-CARD core activation above.
