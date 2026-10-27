# E78 — exact EGP5 release executed; owner checkout ACTIVE

[Deployment receipt and owner steps](controlled-egp5-deployment-receipt.md).
Activefcce022d9ac76e49/schema98.417c apply CONSUMED; never replay.
Real owner purchase acceptance pending. Same approval permits grant/promotion closure.
The E77 preparation review below is historical evidence.

# EGP5 scoped combined coupon — E77, 2026-10-27

**READY FOR NEW EXACT APPROVAL. LOCAL PASS; NOT DEPLOYED OR ACTIVATED.**
Post-seal final read-only preflight **PASS**, 27Oct 13:15:15 Riyadh; all4244 sealed inputs match. Recheck before execution.

The incompatible EGP50 grant is CLOSED. Existing applicationffd191/schema97 remains
healthy; callbacks and owned receipts are retained. Selected customer has0 orders/
attempts. Public signupOPEN, purchasingOFF and PDC PAUSED.

## Exact authorization

```text
APPROVE CONTROLLED COUPON PURCHASE REPAIR 417c4b1d9e9383fa4b7a3b9003daa65cb9d17ccf1595ecd132d208f856f1476e
```

Expires **27 October 2026, 19:11:48 Riyadh**. Fresh preflight and encrypted recovery are required
again before execution. Stop on expiry, drift or an uncertain acknowledgement.
Do not replay33779, schema95, or the two already-applied coupon migrations.

| Item | Exact reviewed configuration |
| --- | --- |
| Product | mousepad WOLF / Default ×1, EGP25 |
| Manual delivery | Original EGP50 price, unchanged |
| New combined coupon | FRE5: fixed EGP25 merchandise + EGP45 delivery discount |
| Card fee / payable | EGP0 / **EGP5**,500 minor units |
| Eligibility | Exact verified customer, product and Manual company, privately bound |
| Limits | One use; expires with this packet; grant≤1h from activation, bounded by packet expiry |
| Charge budget | One order, one intention, one owner card submission, zero retries |
| Existing FRE | Entire configuration/limits/usage/delivery discount unchanged |

**EGP25 + EGP50 − EGP25 − EGP45 = EGP5.** Delivery45 is store-funded;
the order retains shipping_fee_amount50 and delivery_discount_amount45. Total
stored discount70 includes merchandise25. No delivery price or carrier row changes.

## Minimum reusable correction

Dashboard already accepts combined merchandise/delivery amounts. It lacks eligibility
controls. Isolated source `7e563bf97d3f0126ddbc85f5b842921967266540` adds optional customer,
whole-cart product and delivery-option IDs to the existing coupon editor/save path.
Blank scopes retain existing behavior. IDs are deployment configuration, never
hardcoded in application logic. Existing settings.edit RLS protects all scope fields;
customer responses omit them. A verified server-side customer identity establishes
eligibility; the address email cannot impersonate that customer.

ONLY new migration `20261027100000_scoped_combined_coupons.sql`,97→98, adds three
nullable references and changes two existing function bodies. No old row rewrite,
RLS/ACL alteration, Auth/CAPTCHA/session change, location migration or provider change.
The separate location version26190000/clean4843754 branch remains undeployed. Later
location integration needs fresh history/ordering qualification against98.

One combined coupon explicitly permits both discount components. Independent coupon
stacking stays unsupported. Existing server pricing caps merchandise by subtotal,
delivery by actual delivery fee, rejects negative/free resulting card orders and
revalidates scope/limits/prices at quote and commit. Durable order and payment
idempotency, immutable snapshots and signed/late callbacks remain authoritative.

The browser cart also retained only the aggregate discount. A small correction
preserves the delivery component across apply/remove/reload so Checkout displays
both components truthfully. Client values never determine final prices.

## Validation and guarded execution

Native13 tests/12 cases, EN/AR actual Checkout apply/remove/reapply/reload, actual
Dashboard save/readback, typecheck/build PASS. Synthetic EGP5 intention and signed
reconciliation/replay after grant revocation PASS; these are local fixtures, not a
new real provider acceptance. Seven configuration/closure cases, four migration
rollback/replay/uncertain-commit cases and ten runtime guard groups PASS/0skip.
Sixteen Caddy routes/six assets/other policy identity PASS, loopback only.

Exact proposed archive `fcce022d9ac76e49` has3029 verified entries; all1953 current
production assets remain byte-identical. Fresh encrypted97 database/full pg_restore
and ten runtime files/full-byte recovery pass. All32 deferred rows, frozen135
paths, branches/worktrees/local commits and the Storage audit remain preserved.

After exact approval: fresh preflight/recovery → candidate/assets → ONLY migration98
→ create ONE scoped one-use FRE5 row → deploy exact app and one private EGP5 grant.
No changes to site settings, Manual price, existing FRE/couriers/orders/payments.
Budget one storefront restart/one CaddySIGUSR1. Never run retired deploy scripts.
STOP on ambiguity; no automatic retry, SQL rollback or payment/refund/void action.

Normal owner steps after ACTIVE_FOR_OWNER: sign into the recovered Outlook account,
add only WOLF/Default1, confirm the real recipient and Manual50, apply **FRE5**, verify
item25/merchandise−25/delivery50/deliverydiscount−45/fee0/**payable5**, then submit your
own Paymob card once. Codex creates no hosted quote, order or intention. Report the
outcome without card/address/token details; do not retry an uncertain result.

Verify real provider transaction, signed callback, paid order/customer ownership,
FRE5 usage1 and Manual/untracked Dashboard fulfillment. Closure under the same
approval clears grant/restores edge, disables ONLY FRE5, preserves its history and
keeps app/schema/callbacks/owned reads/late reconciliation. Public purchasing opens
only under a separate explicit approval after actual controlled PASS.

Private plan/operator: `../controlled-scoped-coupon-20261027`. All32 deferred tests,
location work and VPS Storage audit remain unfinished. No Git push/merge/reset.
