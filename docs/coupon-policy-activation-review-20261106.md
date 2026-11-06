# Execution outcome — DEPLOYED / CONSUMED_COMPLETE

Seal6a3e29a9 was used once at02:45Riyadh,6November. One unrestricted offer is
inactive; coupon engineON; app/source/schema unchanged. Postflight and next naturalMON
passed. [Deployment receipt](coupon-schema121-activation-receipt-20261106.md).
The approval below is historical and cannot be used again.

---

# Corrected coupon activation review — 6 November 2026

**READY / UNAPPROVED.** Fresh read-only preflight passed against app
2a1fb3c96f391f40/sourcee2663ea/schema121 and naturalMON02:30Riyadh.
No production write or coupon activation has occurred. No application build or
migration is required. The prior237943b9packet is superseded, unexecuted and expired.

## Explicit commercial change

Disable exactly the saved unrestricted **95% merchandise + EGP50 delivery** offer:
its `is_active` changes **true → false**. No eligibility, price, usage limit,
per-customer limit, expiry, code, usage counter or other column changes. The row
remains stored. This offer cannot be used for new server-validated coupon claims
until the owner separately approves its eligibility and a fresh exact activation.
Existing submitted financial evidence and order snapshots are retained.

Preserve the **EGP74 fixed / minimum EGP10** offer for its one eligible customer,
with its existing limits and6November22:29expiry. Both expired historical offers
and all coupon/redemption records remain intact. No coupon codes or customer
identities are printed in this review.

## Exact technical scope

1. One guarded transaction updates one exact fingerprinted coupon row, changing
   only `is_active` to false. Schema121 and its migration ledger stay unchanged.
   Current coupon table has no user update triggers; all other fields/rows are
   compared before commit. An encrypted current coupon backup passed authenticated
   full readback. A commit-intent ledger and one-use apply marker precede mutation.
2. Then install two protected configuration files enabling only Beta
   `allow_coupons=true`. Preserve every other Beta value and the SMS-guarded base
   runtime byte for byte. No base-runtime rewrite or credentials changes.
3. One systemd daemon-reload/app restart. Existing MON/email/PDC/SMS timers pause
   and resume once each, within180seconds. App archive/source/schema stay unchanged.
4. Zero provider calls, paid sends, real orders/payment attempts, shipping, Meta,
   marketing, SMS quota/window, Caddy, payment settings or financial-history changes.

If the commercial transaction commits but configuration fails, stop and retain
its honest partial state. No replay, automatic rollback or broad re-enable is
permitted. New exact approval would be required after independent reconciliation.

## Focused verification

-9 native checks pass, including current production function identities, stale
preimage rejection, atomic rollback, exact one-column preservation, disabled-offer
rejection for general/eligible customers, authenticated customer eligibility,
EGP176.70 quote →17670payment minor units, callback replay/usage protection,
product/carrier/category rules, historical expiry and existing usage caps.
-9 portable configuration cases pass; only `allow_coupons` changes.
-The4previous current-source pricing/capacity/redemption checks are reused.
-Initial sandbox/runtime and synthetic fixture failures remain saved; they required
no application correction. Historical PDC failures and accepted P0 stay untouched.
-Positive hosted customer coupon acceptance follows installation. No production
preview or synthetic paid order was used to claim acceptance.

## Fresh one-use approval

```
APPROVE COUPONS WITH ONE OFFER DISABLED SCHEMA121 ACTIVATION 6a3e29a9ea04e3270e220634ef12f85fb53b8ada93df67ba7317aa90f04ae60c
```

Start before **6 November 03:29:34 Riyadh**; expires **6 November 03:44:34 Riyadh**.
The approval explicitly covers **one commercial offer deactivation** plus the
coupon policy configuration/restart above. It does not approve the unrestricted
offer's eligibility or any regular SMS charges.

Private executable packet: `logs/activation-register-20261106/coupons-safe/`.
After the exact owner reply: record approval, apply once, verify coupon postimages,
effective environment, private routes, preserved SMS runtime and next naturalMON.

**One next action:** approve the exact corrected coupon packet above.
