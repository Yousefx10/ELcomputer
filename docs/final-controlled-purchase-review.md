# E72 — EGP75 packet superseded; coupon-scoped EGP50 packet prepared

Owner requested a coupon/lower total with the75 approval. That operator was never
executed. Current authoritative [replacement review](controlled-coupon-purchase-review.md)
binds FRE/EGP50, a focused app/SQL correction and a new exact seal. Production is
unchanged11cb/schema95; signupOPEN/purchasingOFF/PDC PAUSED. Do not reuse the75 seal.
All E71 and earlier preparation below is historical, not current authorization.

# Final controlled purchase — E71, 2026-10-27

**CONTROLLED PURCHASE: READY FOR EXACT APPROVAL. Actual purchase: PENDING.**
Production remains `11cb391b2497b703`, source `5b09077`, schema95.
Public signup OPEN; public purchasing OFF; PDC PAUSED. No production changes,
orders, checkout reviews, payment attempts or provider calls during preparation.

## Exact authorization

```text
APPROVE CONTROLLED CUSTOMER PURCHASE d2314973ea37625e7fd662b0e7c55bbd0d4050cf3c8bf2d38364367822663e93
```

Recovery evidence verified27Oct03:31:26.486Riyadh; expires **09:31:26.486Riyadh**.
Run a fresh read-only preflight and fresh encrypted recovery before execution.
Stop on drift, missing evidence or expiry; issue a new exact packet instead.
The prior recovery/deployment approvals remain consumed and must never be replayed.

| Binding | Sealed scope |
| --- | --- |
| Customer | The selected recovered, verified ordinary Outlook account; exact UUID private |
| Recipient | Owner-saved real recipient/mobile/city/governorate/Egypt validated; exact normalized address hash private, no temporary QA marker |
| Product | Existing published mousepad WOLF, Default model, quantity1 |
| Availability | Owner-confirmed physical catalog availability; no stock count or inventory receipt fabricated |
| Merchandise / delivery / card fee | EGP25 / Owner-managed Manual EGP50 / EGP0 |
| Payable amount | EGP75 exactly; currencyEGP;7,500 minor units; no coupon |
| Budget | One durable cart/order, one Paymob intention, one owner card submission, zero retries |
| Duration | At most one hour, beginning during authorized activation |
| Operator | Owner alone adds, orders and pays; Codex creates no order/quote/payment |

The selected customer has0 existing orders/payment attempts. Profile details remain
private and must stay unchanged for this grant. The owner confirms the destination
in checkout; an incorrect destination requires a new binding and exact approval.

## Authorized changes after approval

One serializable, drift-guarded transaction sets only
`inventory_tracking_required=false` and the reviewed EN/AR delivery-information
strings. It creates the separately reviewed Manual company at EGP50 with its28
compatibility coverage values. The existing shipping-configuration trigger increments
only the shipping generation once. Preserve the PDC company/settings and all other
rows, schema, accounts, confirmed emails, permissions and payment settings.
The Manual company's shipping/return cost columns use existing zero defaults;
these are not a carrier quote or a claim about actual delivery cost.

Install one private grant binding customer/product/model/quantity/address/amount/
Manual company and the existing unused durable command. Global public, Beta and
Paymob-initiation flags remain false; request-local CARD access follows the exact
scope checks. Add only the qualified narrow normal-checkout route exception.
No app deployment, migrations, Auth settings, emails, provider action or stock
creation. Activation permits at most1 app restart and1 CaddySIGUSR1, no retries.

Manual checkout exits before PDC delivery validation; PDC order eligibility rejects
Manual companies. The paid-order queue catches that rejection and creates no PDC
job. Both outbound runtime barriers stay false. No PDC API calls are authorized.

## Evidence and closure

Independent native PostgreSQL configuration qualification:6 cases(7 with parent),
all PASS/0skip. Atomic rollback, pre-commit evidence failure, database/address drift,
unreviewed trigger effect and ambiguous COMMIT without retry/rollback are covered.
Remote/runtime/expiry/signal guards:8 PASS/0skip. Initial local fixture and guard
stops remain preserved; none touched production. Prior Caddy15-route/six-asset proof
is reused against byte-identical current/proposed policy, with every other adapted
route preserved. Completed signup/recovery/isolation/Paymob/asset acceptance tests
were not repeated.

Fresh encrypted schema95 database: full authenticated decryption and pg_restore
readback PASS. Runtime:10 files, authenticated full-byte readback PASS. Sealed1833
inputs,145 protected projections and1849 assets verified. Current release/runtime,
Caddy, media/private files, signup and purchasing barriers match the bound baseline.
Local/read-only qualification does not establish a real purchase or Dashboard pass.

This approval also permits normal closure on paid result, owner stop or expiry:
clear only this grant, restore the original edge policy, at most1 app restart and
1 CaddySIGUSR1. No SQL rollback or data restoration. Callback ingress, credentials,
owned receipt/status routes and late-event reconciliation remain available.
Expiry independently refuses new checkout/payment initiation; an existing provider
intention or late callback keeps its original identity and must still reconcile.
Do not create a replacement order/charge, void/refund or rebook on uncertainty.

Private packet: `../controlled-purchase-activation-20261027/plan.json`.
Independent operator: `purchase-operator.mjs`; modes `check`, `apply`, `close`.
The apply/close modes require this exact seal and one-shot intents. No automatic
retry or rollback; preserve any STOP and inspect the actual phase before recovery.

## Owner checkout after Codex confirms activation

1. Sign into the same selected account. Keep the saved real address unchanged.
2. Open `/products/mousepad-wolf`; add one Default model. Remove other cart items.
3. Select Owner-managed delivery EGP50 and CARD. Review the real recipient and
   exact EGP75 total; use no coupon. Stop if any binding or amount differs.
4. Place the order once, open Paymob, submit your own card once. On timeout or
   uncertainty, stop; retain the original order/payment reference without retrying.
5. Report that submission finished, without card details. Codex verifies the actual
   provider transaction/signed callback, EGP75 paid order, correct customer ownership,
   immutable Manual/untracked snapshot and actual Dashboard fulfillment state.
   A browser redirect alone does not establish success.

## Dropdown follow-up and public opening

Owner reminder: Profile city/governorate dropdowns remain missing on deployed95.
LOC-01 has dependent EN/AR selectors locally in separate schema96; they are not
hosted or accepted. Preserve that work and DTR-19; do not ship/seed96 for this grant.

Only after controlled PASS prepare a separate PUBLIC purchasing activation packet
with genuine delivery availability, emergency kill switch, monitoring and the
[documented manual remedy](public-beta-minimum-launch.md#minimum-cancellation-and-reimbursement).
No public activation is authorized here. Preserve all32 deferred rows, schema96,
Git branches/worktrees, original provider incident and deferred VPS Storage audit.

<details>
<summary>Historical E67–E70 preparation — superseded by E71 above</summary>

# Final controlled purchase — E67, 2026-10-27

## E70 — recovery accepted; purchase draft refreshed, recipient still missing

[Owner recovery acceptance PASS](password-recovery-acceptance-receipt.md): password
update and new-password login accepted as owner-reported functional smoke-test
results. Current app11cb391b2497b703/schema95 and restrictive gates read-only PASS.
At02:59 Riyadh, mousepad WOLF/Default1 still costs25; approved Manual50/cardfee0
keeps proposedEGP75. Selected customer has0 orders/attempts; the real saved address/
mobile is still missing. Owner saves My Profile next; no recovery retest or email.
New unsigned draft: `../controlled-purchase-after-recovery-20261027/`, current11cb
binding and previous unused durable command retained. No purchase seal, order,
payment or production configuration change. Original preparation below is history.

E68 update: [password recovery redemption](password-recovery-repair-review.md) is
now the immediate public-launch blocker. Previous recovery acceptance covered
email delivery only. Complete the separately approved repair and ONE owner private
reset/password/new login before the selected customer saves the recipient below.
Product/Manual/proposedEGP75 scope remains; no purchase authorization exists.

**CONTROLLED PURCHASE: BLOCKED — saved recipient details are missing.**
No activation seal has been issued. No production configuration, order, payment,
account, shipment or provider action occurred during preparation.

## Selected scope

| Input | Current result |
| --- | --- |
| Application / schema | `81becf54218a8e14` /95; deployment acceptance retained |
| Product | `mousepad WOLF`, Default model, quantity1 |
| Merchandise | EGP25; published, normal selling, active positive-price model |
| Fulfillment availability | Owner's catalog-wide physical availability confirmation retained; no recorded-stock requirement or fabricated balances |
| Customer | Existing verified active ordinary Outlook account; exact identity remains in the private packet |
| Recipient | No saved address/city/governorate/country or valid Egyptian mobile at01:45 Riyadh recheck |
| Delivery | Approved owner-managed Manual company, EGP50; still a draft, not installed |
| Card fee / coupon | Current EGP0 card fee / no coupon permitted |
| Proposed payable total | EGP75 /7,500 minor units; server review follows approved configuration and recipient binding |
| Public purchasing / PDC | OFF / PAUSED |

The older Yahoo account labelled B also lacks a recipient. The owner identified
two alternative accounts; only the Outlook candidate exists as a verified active
new-platform ordinary customer. Use that account, subject to the owner's private
profile save. Do not create another account or change the owner/A profile.

The owner must save the real recipient name, Egyptian mobile, address lines,
city, governorate and Egypt through the existing account profile. No password,
token, full address or card details belong in chat or Git. After the save,
re-read only that customer and bind the exact normalized address hash, including
line2. Reject any temporary `Signup isolation` delivery marker.

## Prepared configuration and restrictions

The future exact activation must include only these approved business changes:

- Create the separate Manual company from the existing reviewed draft, with
  EGP50 customer delivery, approved all-area coverage and checkout enabled.
  Preserve the PDC company and all provider settings/barriers.
- Set `inventory_tracking_required=false` for schema95 normal CARD sales.
  Bind both existing approved EN/AR delivery-information strings. The SQL requires
  them; empty current strings cannot produce a valid untracked checkout.
- Install one private grant binding the selected account/product/model/quantity1,
  Manual company, normalized address hash, exact7,500-minor-unit amount and fixed
  durable cart command. Window≤1hour; global public/Beta/Paymob switches stay off.
- Budget: one order, one Paymob intention, one owner card submission, zero retries.
  The owner performs every order/payment action. Uncertainty retains the original
  command/order/attempt; no replacement charge or diagnostic purchase.

The exact application already enforces the normal storefront grant on quote,
commit, shipping and payment initiation. Request-local Paymob availability follows
scope/Auth checks; it does not enable other customers or products. Preserve RLS,
transactional receipts, signed callback authority and owned late-event reads.

Current Manual/PDC safeguards were reviewed without provider requests:
`private.pdc_checkout_delivery` returns before PDC validation for Manual companies;
`private.pdc_order_eligibility` rejects non-PDC companies. Outbound processing and
booking additionally require the unchanged false shipping runtime gate. Neither
checkout nor this proposal changes PDC flags, jobs or the uncertain incident.

## Qualification and evidence limits

Fresh production read-only inspection at01:35:50 Riyadh matched the active release,
loaded runtime, Caddy process/configuration, output inventory and file hashes.
Catalog/account/settings inspection used read-only database transactions. No live
quote RPC was called, since it can persist a checkout review.

New local16 recipient/scope/configuration guards PASS, zero skipped. The exact
Caddy2.11.7 adapter shows only one added route on each existing listener; removing
those routes matches the entire current adapted policy. Local15 routing cases,
six retained/current asset hashes/cache and latest metadata cache PASS, with zero
external requests. Existing callbacks, receipts, private routes, asset fallback and
HTTPS-only PDC inbound policy are preserved. Fixture expectation failures and one
initial recipient-line1 guard failure are retained privately and corrected locally.

These are local preparation/read-only observations. They do not activate a grant,
install Manual delivery, establish a hosted purchase, or repeat accepted signup,
Turnstile, A/B isolation, real Paymob/callback or schema95 asset acceptance.
The activation/closure operator, fresh encrypted recovery and exact final seal
must be qualified against the completed recipient and current production state.
Never present an unsigned draft hash as an approval.

Private evidence: `../final-controlled-purchase-20261027/`. Current unsigned scope:
`controlled-scope-draft-outlook-v2.private.json`; status `READINESS-OUTLOOK-v2.json`.
Earlier unapproved account/configuration drafts remain preserved and superseded.

## Owner checkout steps after separate activation approval

1. Sign into the selected account. Use its real saved recipient unchanged.
2. Open `/products/mousepad-wolf`; add one Default model to the normal cart.
   The cart must contain only this item. Stop on an unresolved older checkout.
3. Select Owner-managed delivery, EGP50, and CARD. Confirm EGP75 total and no coupon.
   Stop if the product, recipient, fee, method or total differs.
4. Place the order once. Open Paymob and submit the owner's own card once.
   On timeout or an unclear result, stop and retain the original references.
5. Tell Codex the submission finished, without card details. Codex then verifies
   the matching real provider transaction/signed callback, paid order, customer
   ownership, exact amount, immutable Manual/untracked snapshot and actual Dashboard
   fulfillment state. A redirect cannot establish payment success.

Closure must clear the private grant and remove only its normal-route exception.
Keep signed Paymob callbacks, owned receipts/status, credentials and asset fallback.
Grant expiry independently rejects new checkout/initiation. Do not down-migrate,
restore data or automatically dispatch a paid Manual order through PDC.

## Public Beta after controlled PASS

Prepare a separate public activation packet only after this purchase passes.
Bind genuine catalog/Manual coverage, CARD-only policy, exact runtime/edge changes,
recovery, an emergency purchase-disable action and staff15-minute exception review.
Reuse the documented [manual cancellation/reimbursement procedure](public-beta-minimum-launch.md)
and retain signed callbacks/owned reads after closure. No public activation is
authorized here. All32 deferred tests, schema96, Git worktrees and the deferred
VPS Storage audit remain unchanged and incomplete.


</details>
