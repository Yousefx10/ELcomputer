# Coupon policy activation review — 6 November 2026

Configuration-only. App2a1fb3c96f391f40/sourcee2663ea/schema121 stay unchanged.
Fixed/percentage/delivery discounts, capacity and redemption SQL are already
installed; four current-native checks and nine portable overlay cases pass.
The public coupon endpoint already returns401/private-no-store. No engine rebuild,
Caddy change or migration is needed. Positive hosted coupon acceptance is pending.

Beta currently omits allow_coupons, which rejects a coupon by default. A protected
additive systemd EnvironmentFile sets only the existing policy's allow_coupons=true.
Every other policy field is preserved. The SMS-guarded base runtime file remains
byte-identical, preserving pilot worker/source/receipts/quota/expiry and marketingOFF.

Existing saved offers are unchanged:

| Offer | Current restriction | Limit/expiry |
|---|---|---|
|95percent merchandise +EGP50delivery discount|Unscoped customer/product/shipping/category|No usage/per-customer cap; ends30November22:27Riyadh|
|EGP74fixed, minimumEGP10|One existing customer; identity private|No usage/per-customer cap; ends6November22:29Riyadh|

The broad95percent offer is an explicit commercial review point. The owner can
approve these saved terms or change the real Dashboard offer before a fresh seal.
No coupon rows, usage counters or historical order snapshots are edited here.
Expired offers remain expired. A submitted uncertain one-use coupon retains its
capacity reservation; this activation does not weaken commercial guards.

Exact approval:

```
APPROVE COUPON POLICY ONLY SCHEMA121 ACTIVATION 237943b9d13d70d5df27d591f1d2f8b4f97e06d75bd0b2e66ef1070af44f6f97
```

Start before6November02:29:00Riyadh; expires02:44:00. Scope: two new protected
configuration files; one daemon-reload and app restart; existing MON/email/PDC/SMS
timers pause/resume once each≤180seconds. ZeroSQL/provider/financial/coupon-row/
Caddy/runtime-base/SMS-budget or credential changes. The current base-runtime and
service recovery preimages match authenticated encrypted full-readback backups.
No database restore is authorized; the operator's database connections are read-only.

Read-only preflight passes against actual121, current engine/functions/history,
exact saved offers and configuration flags. Existing genuine financial activity can
append normally; it is not erased or treated as provider finality. Sealed inputs,
exclusive attempts, no retry after staging and no automatic rollback remain enforced.

Private packet: logs/activation-register-20261106/coupons/plan.json.
Operator: node logs/activation-register-20261106/coupons/operator.mjs.
After approval: apply once; check effective environment/coupons capability/private
routes, preserved SMS runtime/worker and next naturalMON. Do not fabricate a paid
order or use a real coupon preview to claim production acceptance during installation.

**One next action:** approve the exact saved-offer activation scope above.
