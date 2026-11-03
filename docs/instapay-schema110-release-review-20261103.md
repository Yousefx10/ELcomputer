> **CURRENT E197,3November2026:** Production81f6206b/schema110. InstaPay installed INACTIVE; CARD/COD preserved. Original5d25operator CONSUMED_STOP after acknowledged SQL commit; independent read-only/natural-worker closeout PASS. [Actual receipt](instapay-schema110-installation-receipt-20261103.md). No replay or new approval. Earlier READY/approval instructions below are historical.

# InstaPay110 inactive installation — E196, 3 November 2026

**HANDOVER RECOVERED. LOCAL PASS. Installation READY / SEALED / UNAPPROVED.**
Production remains **81f6206b393714ae / schema109 / source7b33ed0**.
Payment-first CARD is active. No installation or financial action was performed.
Owner communication is English, always. Customer and staff screens remain EN/AR.

Owner decision `OD-20261103-CODEX1-PAY-CONT-01` continues the shared workspace.
Payments remain first: inactive InstaPay, then qualified provider methods.
Preserve all UI/catalog candidates; settlement/ERP remains last.

## Current evidence

Fresh read-only host, database and public/private HTTP checks passed on 3 November
Riyadh time. The sealed preflight receipt in the private packet gives exact UTC.
The original activation runtime, certificate, processes, 17 files, emergency
fences and scheduled callers match their approved installed state.

- CARD core: enabled, revision1, original activation boundary retained.
- Private payment-first sessions/attempts/funds: zero at the recovered checkpoint.
- Four payment-integrity counts and five private MON aggregates: zero.
- MON: seven original UNVERIFIED warnings, three journal gaps, zero critical.
- CARD/COD remain offered. The Dashboard COD fee remains EGP10.00.
- Customer Email and bounded PDC tracking remain enabled. Automatic booking is OFF.
- Private Payment activity still reaches application Auth with no-store/no-referrer.
  Existing owner acceptance covers the empty page and payment-method display.
  No new authenticated foreign-record or paid-transaction acceptance is inferred.

| Method | Current result | Remaining condition |
| --- | --- | --- |
| Payment-first CARD | ACTIVE; hosted Redirect preserved | First genuine verified payment, one paid order and customer return remain PENDING |
| InstaPay | READY for inactive schema110 installation; OFF | Separate verified recipient, private VPS storage/ingress, hosted roles and activation |
| Embedded Pixel | Existing local1.2.8 qualification preserved; OFF | Separate app release and real merchant3DS/issuer/device acceptance |
| Apple Pay | Owner reports merchant eligibility and provider-managed setup | Actual activation/merchant offer remains unverified; no new owner certificate/domain task inferred |
| Egyptian wallets | No configured extra merchant integration mapping | Actual supported integration ID and qualified authentication/callback flow |
| Account balance | Existing immutable-ledger candidate locally qualified; OFF | Legitimate funding, reconciliation, refunds/terms and operating acceptance |
| Google Pay | DISABLED | Preserve the owner's decision |

No Paymob account session or merchant-offer response is available here. An empty
extra-method map does not establish whether hosted CARD checkout can offer Apple
Pay after provider activation. No provider probe, inquiry or support message was
sent. The [Paymob wizard](https://wizard.paymob.com/) describes guide selection
separately from merchant activation; it is not this merchant's activation receipt.

## Reused implementation and narrow correction

The deployed application already contains private transfer APIs, receipt validation,
customer/staff screens and runtime gates. Reuse it without an app build or cutover.
Original worktrees `payment-first-checkout-20261101` and `payment-launch-20261102`
remain unchanged. The pinned Pixel asset SHA256 was checked again against
`082c4b1b76425af80bb6cd98e795e06667fc9b07c34cdb9340c1caa88924373d`.

The original `20261101221000_manual_instapay_checkout.sql` was preserved byte-for-byte.
The packet contains a reviewed derivative of that same unapplied migration.
It is migration **110**, after the installed109 version `20261101220500`.
Account balance remains a separate candidate111 if installed after this migration.

Only the candidate comment and four permanent-conflict SQLSTATEs differ from the
original. These now use `P0001`, the installed transfer handler's existing HTTP409
business-error contract. Actual PostgREST14.18 requests terminate without transaction
retries. The catalog's deployed `PT409` correction remains unchanged. An intermediate
PT409-only transfer experiment was superseded because the installed transfer error
adapter does not recognize it. Its local evidence is retained, not release evidence.

## Exact installation scope

One atomic SQL migration and one migration-history row:

1. Add four private RLS tables and one disabled, blank settings row.
2. Add the existing service-only transfer/review/proof RPCs and immutable evidence.
3. Apply the qualified14 shared-function changes for pricing, reads, verified-funds
   order creation, paid-email eligibility, packing eligibility and reset retention.
4. Notify PostgREST to reload its schema after commit.

**Zero app deployments/restarts, runtime/Caddy/timer/settings changes, existing
business-row writes, recipient assertions, uploads, transfer approvals, funding,
provider calls, bookings or payment activation.** Existing scheduled workers continue.
The new blank settings row is installation metadata, not bank configuration.

InstaPay remains unavailable through both runtime and database controls.
No transfer evidence, ordinary unpaid sales order or synthetic financial event is
created. Exactly one paid order follows authorized, independently verified bank
credit; a receipt upload alone remains Under Review.

## Qualification and limits

| Evidence | Result |
| --- | --- |
| Actual PostgreSQL17.11 core/transfer and application HTTP |45 Node results PASS, zero failures/skips; includes parent test containers |
| Actual installer/rollback/scope/replay/core-disable adapter |8 Node results PASS, zero failures/skips |
| Actual PostgREST14.18, eight simultaneous permanent conflicts |All terminate; pool reads remain healthy; no settings/business changes |
| Installed HTTP conflict translation |HTTP409; revision remains unchanged |
| Exact migration footprint and DDL rollback |150 fixture projections preserved;14 changed functions match current production dependencies/ACL/owners |
| Existing deployed Nitro build with inactive110 readiness |CARD/COD/core retained; transfer unavailable; private401/no-store/no-referrer; secrets absent |
| Fresh encrypted database and runtime backup |Authenticated full pg_restore readback and17-file byte readback PASS |
| Missing-approval CLI guard |Rejected before an attempt marker or production connection |
| Sealed production read-only preflight |PASS; actual109/core active, same seven warnings/three gaps, zero critical |

The SQL-only change does not invalidate the saved browser matrices or application
typecheck/build. Those were not repeated. Physical Safari, genuine3DS, hosted
transfer attachments/roles, real bank funds and live balance acceptance remain
unexercised. Local fixtures never substitute for those evidence tiers.
All50 existing worktree heads/statuses and the original35 deferred rows are preserved.

## Exact separate approval

```text
APPROVE INSTAPAY SCHEMA110 SQL-ONLY INACTIVE INSTALLATION 5d25ed197cb80de0de666f7fa289834548d4e7835f80b8ddca3e3ce1163b0429
```

Expires **2026-11-02T23:22:30.316Z / 02:22:30.316 Riyadh, 3 November 2026**.
This authorizes only the inactive installation above when explicitly approved.
Fresh authorization is required by the owner's deployment instruction and
[AGENTS.md](../AGENTS.md). Previous approvals remain consumed.

Private packet:
`/Users/imac/Documents/ELcomputer/instapay-schema110-release-20261103`.
`plan.json`, `approval.json`, `OPERATOR.md` and `sealed-preflight.log` bind its scope.
The packet is external to old main's application lineage; never deploy main to
install it. No Git commit or push is needed or performed by this preparation.

Before execution, recheck frozen input hashes, approval expiry, exact migration
history, active CARD boundary, host files/processes, current MON identities/gaps,
configured fees and caller health. Any drift stops. The first apply attempt is
exclusive and consumed even on STOP. An uncertain commit requires read-only ledger
inspection and separate recovery; never retry or automatically downgrade.

## Recovery and subsequent activation

Before commit, the transaction rolls back on failed guards. After commit, retain
the installed inactive schema and all subsequent evidence. Do not restore an old
database over customer activity. This migration grants no activation or refund.

The original public-purchasing/COD/Email fences remain unchanged. The original
single-use SQL-only CARD core-disable budget is not renewed. Its old SQL adapter
assumes109 and manual-installed=false. The new `disableCoreOn` adapter is qualified
against actual110 and manual-installed=true. If separately authorized, the operator
must first consume the ORIGINAL remote disable fence, call this adapter once, and
finish the ORIGINAL receipt. It retains enabled_since/runtime, COD, callbacks and
late verified funds. Never replay the completed activation or use this installation
approval for a disable. No emergency action was exercised.

After installation, a separate reviewed scope must configure genuine recipient
details and short EN/AR instructions, private VPS proof paths/permissions, backups
and retention, and exact authenticated ingress. No Supabase Storage file bytes.
Then qualify customer/foreign ownership and named review/verify staff roles on the
hosted application. Configure no bank identity from guesses. Activation remains
OFF until those controls and operating acceptance pass under separate authorization.

## First genuine CARD acceptance procedure — prepared, not authorized

The owner must separately authorize an exact real purchase, amount and time window.
Use an intended purchase with server-reviewed stock, delivery and total; invent no
product, coupon or amount. The owner submits once and enters card/OTP details.
The agent makes no charge or provider request.

Inspect durable server/provider callback evidence afterward: correct owner, live
mode, EGP amount, one verified primary payment and exactly one paid order. Verify
owned order visibility and purchased cart-line cleanup. Check transactional Email
as a separate delivery observation; do not repeat the completed Brevo test.
Failure/abandonment must leave no ordinary order and preserve the cart. Uncertainty
retains private evidence and stops retries, replacement intentions and refunds.
There is no real-transaction acceptance in this packet.

**ONE next action:** approve only the exact inactive schema110 installation above.
