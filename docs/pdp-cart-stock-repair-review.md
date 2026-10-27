> Historical E79 packet: approval RECORDED and preflight PASS, but NOT DEPLOYED.
> Both original deadlines expired27Oct2026 at14:21:33Riyadh. Never replay its operator.
> Continue only through the separately approved [E80 recovery](pdp-cart-repair-recovery-review.md).

# PDP/cart stock and capability repair — E79

**ROOT CAUSE CONFIRMED / WOLF ELIGIBLE / LOCAL PASS / NOT DEPLOYED.**
Post-seal final read-only preflight **PASS**, 27Oct 14:03:46 Riyadh; all5044 inputs match.

Current productionfcce022d9ac76e49/source7e563bf/schema98. Public signupOPEN,
public purchasingOFF/PDC PAUSED. No production changes during this investigation.

## Exact owner authorization

```text
APPROVE PDP CART REPAIR a40b16c9cc83aa2ab3288516c5ecaf9ed088d91892d9658497e6bdc750fa5d53
```

Expires **27 October 2026,14:21:33.006 Riyadh**, matching the ORIGINAL417c purchase grant.
Execution must finish within that window. No expiry extension or new grant.
After expiry STOP and prepare fresh exact authorization; never reuse this seal.

Approved proposed artifact `a402cf24a9685e0d`, source
`113b3131c3de3af44b7d101ea9591cce5ecba1d6`, schema98 unchanged. Deployment only switches the
application and restarts storefront once. ZERO SQL, stock, coupon, settings, address,
runtime or Caddy changes. Original FRE5 eligibility, price5, one-charge budget,
fixed cart/review key and expiry remain unchanged. Fresh preflight and fresh encrypted
recovery are mandatory again at execution. No order/payment/provider call by Codex.

## Confirmed causes

`app/composables/useCart.js` → `normalizeCartItem` forcibly removes the supplied
out-of-stock allowance when `is_serialized` is true. PDP already recognizes the
approved `inventory_tracking_required=false` normal-sales mode and passes allowance
true. Cart resets it tofalse; `addItem` then sees stock0 and returns exactly
“This product is currently out of stock.” This occurs in the client before adding
the item or submitting any quote/order/payment request. It is a code defect.

Read-only production proves WOLF published/normal/serialized, Default active, price25,
warehouse assigned, actual recorded product/model/allocated stock0. Inventory tracking
false, CARD enabled/fee0, built-in ERP, Manual enabled/provider manual/price50. FRE5
active,25 merchandise+45 delivery, one use/usage0, correct three eligibility scopes.
No Dashboard product/configuration change is needed. Do not invent recorded stock
or change serialization to work around this client defect.

Selected customer has **0 server cart commands,0 quotes,0 orders,0 Paymob attempts,
0 payment transactions**. Browser local storage was not inspected. The owner reports
stopping before payment; independent database evidence agrees. No customer address,
password, session, reset link, token or card details were requested/exposed.

Capability snapshots initially contain denial while the authenticated capability
request is unresolved. PDP displays that as “Purchasing is currently unavailable,”
then enables after the lookup. This is an unknown/loading state, not a resolved
rejection. Fix uses explicit account-bound pending/resolved status; Classic/Premium
PDPs and product cards show neutral EN/AR “Checking availability…” with disabled
buttons until resolved. Denial, failures, account changes and expiry remain closed.

## Minimum local change and validation

Cart normalization/restoration now reuses the same cached site stock policy as PDP.
Normal untracked serialized items retain stock0 and can enter cart. Tracked serialized
checks, Coming Soon restrictions, preorder caps and customer cart ownership remain.
Server quote/final order/payment validation is unchanged and authoritative.
No deployment-specific customer/product/coupon IDs are hardcoded in application code.

Five stock-policy/access/isolation tests, eight real PDP-controller/button/cart browser
tests in Classic/Premium EN/AR and thirteen native zero-stock CARD/FRE5 transaction
regression tests PASS/0skip. Apply/add/reload/duplicate handling, denied/expired/public
access, quote5, immutable order5, one synthetic intention500 and signed late replay
are covered. Provider tests are LOCAL fixtures; real payment acceptance remains pending.
Typecheck/build PASS.3133 archive entries/all2057 current assets exact readback PASS.
Eight operator guards/16 Caddy routes/six old+new assets PASS. Route policy is byte-
identical; deployment writes no runtime/Caddy. Candidate grant is disabled privately.
Fresh encrypted98 DB/full pg_restore and ten runtime files/full-byte recovery PASS.
Original local query/path/preflight guard stops are preserved; none mutated production.

Anonymous checkout currently302 to `/login?redirect=/checkout` through its existing
customer-auth middleware; closed edge returns403. Preflight distinguishes those
states. This correction changes only operational verification, not Auth or routing.

## Owner steps after separately approved deployment

Reload normally as the verified Outlook customer; add only WOLF/Default1, confirm
saved recipient and Manual50, apply FRE5 and verify **25+50−25−45+fee0=EGP5**. Pay once
privately before the ORIGINAL14:21:33 deadline. Report outcome; do not retry.
Codex then verifies actual provider/signed callback/paid order ownership/Manual
untracked fulfillment before the separate PUBLIC purchasing packet.

The same repair approval permits fail-closed closure after deployment, also after
expiry: restore the captured closed runtime/edge, keep repaired app/schema, disable
ONLY FRE5 and retain its history, signed callbacks/owned receipts/late reconciliation.
No automatic rollback/retry/refund/void/order cancellation. Closure is one restart+
oneSIGUSR1 and a guarded one-row promotion disable. Old417c closure expects the old
application; after this repair use the new sealed closure operator instead.

All32 deferred rows, frozen135 paths, location branch4843754/version26190000,
branches/worktrees/local commits and VPS Storage audit are preserved/unfinished.
No Git merge/reset/rebase/push. Private packet: `../controlled-pdp-cart-repair-20261027`.
