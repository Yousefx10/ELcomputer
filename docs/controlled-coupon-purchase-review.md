# E75 — coupon release deployed under the fresh33779 authorization

[Current deployment and owner steps](controlled-coupon-deployment-receipt.md).
Earlier81ce approval remains expired/unexecuted. Owner purchase acceptance pending.

# E74 — current EGP50 replacement packet

Use [the resumed sealed review](controlled-coupon-resume-review.md).
Latest owner scope is EGP50, with zero delivery discount and no coupon edit.
The earlier81ce authorization below expired and was never executed.
The new packet retains the qualified two-coupon artifact; location is excluded.

# E73 — EGP50 approval expired and extra discount changes scope

The81ce packet below expired27Oct2026 at10:05:09.143Riyadh and was never executed.
Owner requests EXTRA45 discount. Existing FRE caps25 against the25 product only.
Literal extra45 off delivery would mean5 payable;45 total discount would mean30.
Exact amount clarification is pending. No new seal, coupon edit or production
change. Current11cb/schema95/signupOPEN/purchasesOFF/PDC PAUSED verified read-only.
E72 below is historical local preparation, not current execution authorization.

# Controlled coupon repair and purchase — E72, 2026-10-27

**READY FOR REPLACEMENT EXACT APPROVAL. NOT DEPLOYED OR ACTIVATED.**
Current production remains11cb391b2497b703/source5b09077/schema95.
Signup OPEN, purchasing OFF, PDC PAUSED. Zero production writes, orders, quotes,
payment attempts, coupon uses, emails or provider calls during preparation.

## Exact replacement authorization

```text
APPROVE CONTROLLED COUPON PURCHASE REPAIR 81ce158e718fdab675381fcd811ea002f61077e05bee67dfcfc07be713831e68
```

Expires **27 October2026,10:05:09.143Riyadh**. Recovery verified04:05:09.143.
Fresh preflight and fresh encrypted DB/runtime recovery are mandatory on execution.
Stop on drift/expiry and prepare a new seal. The owner's earlier75 approval was
accompanied by the lower-price/coupon requirement; it was never executed and cannot
authorize this changed amount, coupon, application or SQL scope.

| Bound input | Exact scope |
| --- | --- |
| Customer/address | Same recovered, confirmed active ordinary Outlook customer; saved real recipient validated and privately hash-bound |
| Product/model | Existing published mousepad WOLF/Default/quantity1; owner-confirmed physical availability retained |
| Merchandise | EGP25 |
| Existing coupon | FRE; fixedEGP100/minimumEGP1; active/current uses0/unlimited; expires31Oct |
| Effective discount | Capped at merchandiseEGP25; no shipping discount |
| Manual delivery / card fee | EGP50 / EGP0 |
| Final payable | **EGP50 /5,000 minor units**, currencyEGP |
| Transaction budget | One durable order, one Paymob intention, one owner card submission, zero retries |
| Grant | Exact account/product/model/quantity/address/Manual/FRE/amount,≤1hour from activation |
| Owner role | Owner alone adds, applies coupon, orders and pays; Codex creates no hosted quote, order or payment |

No coupon creation or editing is included. Preview consumes no coupon usage.
A successful order commit consumes one use; same-command retry returns the same
order without another use. Stop on uncertain order/payment; retain original IDs.

## Confirmed defects and the smallest correction

Current ingress holds POST `/api/checkout/coupon`; the old route also accepts a
client subtotal without customer/purchase authorization. The controlled grant
rejects any coupon. A focused native test additionally proves schema95 can quote
an eligible untracked coupon but rejects commit with the special-order coupon
error. Removing only the route/application check would leave checkout broken.

The proposed source reuses one authenticated normal-checkout review helper.
Coupon Apply sends the full cart/address/delivery/method and uses the existing
server/SQL pricing and validation. Supplied subtotal/item prices are rejected.
The optional grant coupon is canonical and bound to review signatures and payment
ownership/amount checks. Original12-field no-coupon grants stay compatible.

One additive migration, `20261027004500_untracked_card_coupons.sql`, changes only
`commerce_create_normal_customer_order(uuid,jsonb,jsonb,boolean,uuid)`'s body.
It permits the already-validated coupon for normal untracked CARD orders, stores
its discount/code, subtracts merchandise discount before existing fee triggers,
and consumes usage atomically inside the existing durable cart transaction.
Original rows, function ownership/ACLs, schema/RLS and grants stay unchanged.
Preorder and tracked-backorder coupon restrictions remain. No stock is fabricated.

**Database migration count95→96 is the coupon correction only.** It does not
apply, edit, seed, replace or accept the existing separate schema96 location work.
That branch remains clean at48437549bb66f635fac544ed3bcf5e5419ba8d14. Later location
integration must be requalified against the then-current database/source history.
Migration95 is already consumed and must never be replayed.

## Artifact and operational scope

Proposed source `381addedd69c411e4b4171ceeaa7daeeae598284`; release
`f4d6716b13ffeace`. Full2,925-entry archive readback PASS; all1,849 current client
assets retained with identical hashes. Password recovery/Turnstile/customer session
isolation code and the original32 deferred rows remain intact.

After approval: recheck all sealed inputs, target,95 history, protected projections,
recipient, product, FRE record and gates; take/read back fresh encrypted recovery.
Stage/extract the exact archive and qualify an inactive loopback app/asset edge
before any SQL/runtime change. Apply only the new coupon migration once. Then
commit the reviewed Manual company, inventory-untracked mode and approved EN/AR
delivery text, with only the required shipping-generation increment.

Bind the new one-hour coupon grant, activate the exact application and add only
the qualified checkout exception plus authenticated coupon POST. Maximum1 main
app restart and1 CaddySIGUSR1; no automatic retry/rollback. Global public/Beta/
Paymob-initiation switches remainfalse; request-local CARD access follows all
scope/Auth checks. Signup remains OPEN. No new Auth/config/email/provider action.

Manual company selection exits before PDC validation, PDC order eligibility
rejects Manual, and outbound runtime barriers remainfalse. No PDC API requests,
booking, refund, void or cancellation money action are authorized.

This approval also permits closing the private grant on paid result, owner stop
or expiry: restore runtime/edge holds,≤1 app restart/1 SIGUSR1, no SQL rollback or
app downgrade. Keep signing credentials, callback ingress, owned receipts/status
and late-event reconciliation. Expiry stops new checkout/initiation independently;
an existing provider intention or late callback must reconcile under original IDs.

## Qualification and evidence boundaries

Local:9 native coupon tests(8 cases), actual EN/AR checkout payload/EGP50 display,
5 migration-operator tests,7 configuration tests,8 remote guards, typecheck/build
PASS; zero skipped. Covers canonical scope/legacy compatibility, fake browser
financial data, expiry/minimum/usage limits, review-coupon binding, repeat-safe
usage, exact50 synthetic intention, no stock/PDC jobs, migration footprint/rollback,
uncertain COMMIT/no retry and replay refusal. Initial failures remain private.
Caddy16 routes/six assets/full other adapted policy and cache preservation PASS.

Fresh encrypted schema95 DB authenticated full pg_restore readback and10 runtime
files full-byte readback PASS. This is local/read-only readiness, not hosted coupon,
real payment or Dashboard acceptance. No completed Auth/provider acceptance repeated.
Broader DTR-08/public coupon acceptance remains unfinished; all32 rows are preserved.

Private packet: `../controlled-coupon-purchase-20261027/plan.json`.
Operator modes: `check`, `apply`, `close`; mutation requires this exact seal and
one-shot intents. Preserve STOP evidence; ambiguous SQL/install/restart states need
inspection and, if necessary, a new exact recovery. No blind rerun or compensation.

## Owner steps after Codex confirms activation

1. Sign into the same recovered account; keep its saved real address unchanged.
2. Add one mousepad WOLF, Default model. Remove other cart items.
3. Select Owner-managed delivery EGP50 and CARD; enter FRE and press Apply.
4. Review merchandise25, coupon−25, delivery50, cardfee0 and **totalEGP50**.
   Stop if recipient, code, item, method, discount or total differs.
5. Place the order once; submit your own card once through Paymob. Stop on
   uncertainty and retain the original reference. Share no card/password/address.
6. Report submission finished. Codex verifies real provider transaction/signed
   callback, coupon/amount/one use, owned paid order and Manual/untracked Dashboard
   fulfillment, then closes the grant. A redirect is not payment acceptance.

After actual controlled PASS, prepare the separate PUBLIC purchasing packet with
genuine delivery availability, emergency kill switch, monitoring and the existing
manual cancellation/reimbursement procedure. Public Beta coupons remain excluded
until separately reviewed/authorized. No public activation is authorized here.
Preserve local location selectors,32 deferrals, Git worktrees and Storage audit.
