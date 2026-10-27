# E76/E77 — EGP50 grant CLOSED; EGP5 replacement requires new approval

[Current EGP5 scoped review](controlled-egp5-coupon-review.md) is authoritative.
Currentffd191/schema97 retained.33779 apply and closure are consumed. Never replay.
Earlier active-window instructions below are historical; do not pay EGP50.

# E75 — exact release executed; restricted owner checkout ACTIVE

[Deployment receipt](controlled-coupon-deployment-receipt.md) is authoritative.
Activeffd191/schema97; two coupon migrations applied once.33779 apply is CONSUMED.
Owner purchase acceptance is pending. Same approval retains fail-closed closure.
The E74 preparation review below is history; never replay apply or schema95.

# Controlled coupon purchase resume — E74, 2026-10-27

**PREPARATION COMPLETE / LOCAL PASS. NOT DEPLOYED OR ACTIVATED.**
Post-seal final read-only preflight **PASS**, 27Oct 12:32:28 Riyadh; all3435 sealed inputs and fresh production bindings match. Production writes0. Recheck again before execution.

Owner requirement OD-20261027-COUPON-RESUME-01 explicitly returns this packet to
EGP50. It supersedes the earlier EGP5 request for this attempt. The EGP5 source,
checks and incomplete recovery remain preserved. The expired81ce approval is held
unexecuted and cannot authorize this release. No activation intent exists.

## Exact new authorization

```text
APPROVE CONTROLLED COUPON PURCHASE REPAIR 33779f1054323464ab00dd4e9f12d13b8c3806b11556f7f96cadc30621a08170
```

Recovery verified **27 October2026, 12:30:11 Riyadh**.
Expires **27 October 2026, 18:30:11 Riyadh**. Stop on expiry or drift; issue a new packet.
Execution requires another fresh preflight and encrypted recovery verification.
This exact approval covers the guarded coupon release, reviewed Manual settings,
one restricted EGP50 customer grant and its closure. It never opens public sales.

| Binding | Scope |
| --- | --- |
| Current production | `11cb391b2497b703`, source `5b090772228494989b7d7eb0fbb28690ef6c8316`, schema95 |
| Proposed application | `ffd191251d1800d0`, source `df905f1b88fc53a13a6196f29cf002ff302a3809` |
| Customer | Same recovered verified ordinary Outlook customer; UUID and saved recipient bound privately |
| Item | mousepad WOLF / Default ×1, current EGP25; owner-confirmed physical availability retained |
| Coupon | Existing FRE: fixed100 capped at EGP25 merchandise; no coupon edits |
| Delivery | New approved owner-managed Manual option, EGP50; delivery discount0 |
| Total | EGP25 − EGP25 + EGP50 + card fee0 = **EGP50 /5000 minor units** |
| Budget | One durable order, one Paymob intention, one owner card submission, zero retries |
| Window | One hour beginning at successful restricted activation |
| Globals | Signup OPEN; public purchasing/Beta purchasing/Paymob initiation OFF; PDC PAUSED |

FRE's existing metadata, dates, limits and usage remain unchanged during deployment.
Usage increments only when the customer commits the accepted order. No customer
address, phone, credentials, signed links or provider secrets enter Git or chat.

## Existing work reused

The restart left the prepared application, commit and tests intact. The old recovery
contains only an incomplete20-byte encrypted dump; it is unusable and preserved.
No final plan, seal, activation intent or production mutation existed there.

All2925 archive entries match the existing readback. All1849 production assets are
retained byte-for-byte. Existing build/typecheck, ten native delivery-coupon cases,
EN/AR compiled Checkout proof, four migration rollback/replay/uncertain-commit cases
and16-route/six-asset Caddy policy proof remain valid. No completed owner acceptance
was repeated. Existing synthetic provider tests establish local behavior only.

Fresh work verifies current production/recipient/product/coupon/gates, canonical
archive readback and exact allowed source diff. Six native configuration cases and
eight runtime guard groups pass for EGP50 and zero coupon edits. Fresh encrypted95
DB full pg_restore readback and all ten runtime recovery files pass. Frozen135
paths, clean location branch, all32 deferred rows and Storage plan hashes match.
The original local canonical-path guard stop and correction remain recorded.

## Exact SQL and application scope

Apply ONLY these two pending coupon migrations, in this order:

1. `20261027004500_untracked_card_coupons.sql` — correct normal untracked CARD
   discount/coupon snapshots and once-only usage after authoritative review.
2. `20261027090000_coupon_delivery_discount.sql` — reusable opt-in delivery discount
   with zero defaults, immutable order snapshot and authoritative pricing.

Expected migration history95→97. Schema95 is already applied; never replay it.
Combined schema delta: two zero-default numeric columns, two checks and three
existing function bodies. Existing rows, grants/RLS, trigger definitions, customer
ownership and payment/callback authority remain unchanged. Delivery promotion is
**dormant at zero for every coupon**, including FRE. No EGP45 coupon edit is allowed.
The inherited Dashboard field and EN/AR checkout split remain part of the unchanged
qualified coupon artifact; no rebuild or unrelated development was introduced.

The separate location migration is `20261026190000_delivery_location_reference.sql`
at clean commit `48437549bb66f635fac544ed3bcf5e5419ba8d14`. Its version is distinct;
it is EXCLUDED. There is no duplicate migration ID. Its timestamp precedes both
coupon migrations, so later location integration requires fresh history/ordering
qualification against97. A97 count does not mean locations were deployed. Never
seed locations, renumber/edit its preserved branch or blindly run all migrations.

Application scope is authenticated full-cart coupon preview, optional exact coupon
binding in controlled grants/review/payment, delivery-discount display/settings and
owned snapshot projection. Client prices are untrusted. Existing twelve-field
coupon-free grants remain compatible. Auth/recovery/Turnstile, signed callback
processing, idempotency, late-event reconciliation and stock rules are retained.
Manual fulfillment uses provider `manual`; it creates no PDC booking job/API call.

The guarded configuration transaction changes only the three reviewed untracked
sales/ENAR delivery-message settings, creates one reviewed Manual company and
advances shipping configuration generation once. It edits no coupon, existing
courier or order. Global purchase/provider gates stay false. Activation may restart
only the storefront once and signal qualified Caddy once with SIGUSR1. Never use
retired PM2 deployment scripts. Ambiguous outcomes STOP without retry or automatic
SQL rollback. After any payment attempt, reconcile before any further charge.

## Owner checkout after approved deployment and activation

1. Wait for explicit DEPLOYED / ACTIVE_FOR_OWNER and the one-hour expiry.
2. Sign into the recovered Outlook account normally. Check the saved recipient.
3. Add only mousepad WOLF / Default ×1. Select the EGP50 Manual delivery option.
4. Apply FRE. Confirm item25, discount25, delivery50, card fee0, payable **50**.
5. Select Paymob CARD and submit your own card once. Keep card details private.
6. Report the result. Do not retry an uncertain or failed payment without review.

Codex creates no hosted quote, order or payment and never submits a card. After the
owner attempt, read-only reconciliation must prove the real provider transaction,
signed callback, paid order, correct owner, FRE once, delivery discount0 and Manual
untracked Dashboard fulfillment state. Never mark provider acceptance from a browser
redirect. Retain callbacks/owned receipts and late events when closing the grant.

## Closure and next public packet

The same authorization permits fail-closed grant/edge closure, including after seal
expiry, from a proven runtime state. Closure restores saved runtime/edge policy and
keeps the new application/SQL; no automatic app/schema downgrade or money action.
One restart and one SIGUSR1 maximum for closure. Preserve uncertain-state evidence.

Only after the real controlled PASS, prepare the separately approved public CARD
activation packet with kill switch, monitoring, genuine delivery availability and
manual refund/cancellation procedure. All32 deferred tests, location acceptance,
branches/worktrees and VPS Storage audit remain unfinished.

Private sealed operator packet: `../controlled-coupon-resume-20261027/plan.json`.
[Previous expired coupon review](controlled-coupon-purchase-review.md) is history.
