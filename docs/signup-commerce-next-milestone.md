# Superseded current gates — E59, 2026-10-26

Use [the minimum Beta plan](public-beta-minimum-launch.md). Owner confirmed Manual
delivery/all areas/EGP50 and physically available catalog. Housekeeping/history/
cosmetic gates are deferred. New95 untracked mode is locally qualified; the old
stock-hold-only route below remains historical. No authorization is inferred.

# Signup gates and manual CARD purchase preparation

Current private-access step: a FRESH dedicated guarded Chrome window is ready for
owner A's private sign-in, followed automatically by B's private sign-in for the
readonly empty view. The first window expired BEFORE Auth (all counts0), not a
failed login or CAPTCHA test. New live status: ../signup-commerce-next-20261026/
owner-browser-live-status.json; runner session59171, result2/stop2 files. No password
in chat, one A-only restoration, no history claim or other write. Authorization
already exists; owner entry is the only access prerequisite. The prepared script
cleans up its own browser profile after success/timeout. Do not rerun old operators.

Reviewed2026-10-26, Asia/Riyadh. **SIGNUP GATES: BLOCKED. HOSTED PURCHASE READINESS:
BLOCKED.** Focused candidate commit9b7564fce0952a796249b47494af4e66a4a68c38.
No deployment, signup/purchase activation, shipment, charge/refund or Git push.

## Returning-customer notice

The owner clarified **OD-20261026-SIGNUP-02**: history IS imported. Never say it has
not migrated.591 historical orders/6 refunds and all customer snapshots stay intact.
Approved English copy, implemented in the existing compact notice:

> Your previous orders may not appear in your account yet. Historical purchases require account verification before they can be securely linked to your profile.

Arabic:

> قد لا تظهر طلباتك السابقة في حسابك بعد. يلزم التحقق من الحساب قبل ربط مشترياتك السابقة بملفك الشخصي بأمان.

Only two application inputs change: EN/AR `authPage.returningVerify`. Original-email
registration, password guidance, generic errors, verification, safe redirects,
Turnstile, permissions, RTL/themes/layout and backend claim rules are unchanged.
No automatic/unverified-email link and no unimplemented self-service promise.

Four local actual-template/CSS render scenarios PASS: EN/AR, RTL, Light/Dark,
320px/desktop, no horizontal overflow. No Auth submission, email or Cloudflare
request. The first preview's missing scoped CSS was caught visually and retained;
styled qualification governs. This is copy/layout qualification, not a repeated
signup/CAPTCHA or full Auth acceptance. Existing acceptance E50/E57 is retained.

**Production visibility remains BLOCKED**: old app5a is still installed and
NUXT_PUBLIC_RETURNING_CUSTOMER_NOTICE_ENABLED=false. The flag additionally requires
signup open/confirmation required. New copy is local, not deployed. A future narrow
release must install the copy and reviewed notice flag configuration; public signup
activation is separate. Do not turn on registration merely to inspect this notice.
[Non-executable signup activation review](public-signup-activation-review.md).

## Empty owner history and marker restoration

Fresh read-only qualified match is the owner's existing ordinary B account, with
zero current orders, zero matching archived orders, one eligible UNLINKED archived
profile. Its identity is confirmed/active/nonstaff. It is not the separate earlier
confirmation-only account; that initial lookup is retained privately and superseded
by exact qualified binding. No account IDs/full emails/customer snapshots in Git.

Reading the deployed history function in a READ ONLY transaction produces an empty
owned payload:0 orders/0 linked profiles/total0. That is the correct unclaimed
experience. It does not verify an archived profile after connection or a real
historical order detail. No Connect/claim RPC or historical write is allowed here.
All imported records/link columns/counts and existing credentials/permissions/orders/
payments/PDC dispatch state are fingerprinted and preserved.

**A marker restoration and authenticated browser view remain PENDING.** Owner
explicitly authorized a normal self-profile edit. A guarded dedicated Chrome session
was prepared with one exact A-only address-null upsert, readonly B Orders/history,
no other mutations or provider actions. Owner was invited to enter passwords
privately; no password/token/cookie was requested in chat or logged. Window timed
out with0 signins/0 profile writes and was closed; owned temporary profile removed.
No bypass via privileged SQL or fabricated customer session. The marker remains.

When owner private sign-in is available, restore A Address line1 from the exact
marker to its original empty value once via normal Profile Save, then inspect B's
empty My Orders/visible Connect prompt WITHOUT clicking Connect. Sign out both;
read-only postflight verifies only A restoration and immutable history. This is
newly authorized account maintenance/read-only viewing, not an Auth retest. No
new approval is needed for those already authorized actions; no passwords in chat.

## Manual delivery and optional recorded stock

Owner requirement **OD-20261026-MANUAL-01** selects a legitimate NON-PDC delivery
method for the next acceptance. PDC is entirely PAUSED, including its uncertain
booking. No PDC files, official PDC city mappings, credential tests or provider
calls are needed for the manual path. Retain that future work under SHIP-02.

Deployed Manual is `commerce_shipping_companies.provider='manual'`, not a new SDK
or provider registry. It uses the existing active/checkout-enabled company,
reviewed governorate coverage and customer fee snapshot. PDC-specific city/product/
credential validation and automatic PDC job creation are skipped for Manual.
The PDC **Manual AWB** recovery endpoint belongs to uncertain PDC bookings; it is
NOT this delivery method and must not be used here.

Production currently has only the existing PDC company/Cairo/EGP1 test-era fee.
No manual company is configured. Do not convert/delete/reassign that PDC record.
Prepare a separate real company/owner-driver record only after owner identifies
who will deliver and the actual supported areas. Customer shipping EGP50 remains
the earlier owner-approved configurable default; merchant carrier costs/return
terms are separate facts, not inferred from that customer charge. Keep configuration
inactive until its bounded approval. Use existing authorized Shipping Companies UI.

**OD-20261026-STOCK-02:** recorded warehouse quantity is NOT required to accept a
CARD order through the already deployed zero-stock foundation. Production has
allow_out_of_stock_purchases=true. Preserve this option; do not manufacture balances,
serials or receipts. Current EN/AR fulfillment messages are blank, so truthful
owner-approved expectations must be configured before zero-stock review succeeds.
The current Beta contract requires customer acceptance and awaits stock/fulfillment;
dispatch still needs genuine allocation/packing. Removing that hold/labels is the
separate retained PROD-05 policy, not a surprise change in this release.

There are561 product records,225 published with positive price. Only one product
has recorded stock: TESTproduct2026 (49 units/EGP1). It is TEST DATA and excluded
from genuine acceptance. No real in-stock availability is established by those
numbers. Published candidate examples, pending owner price/sourcing approval:

| Product | Current catalog EGP | Recorded quantity | Technical state |
| --- | ---: | ---: | --- |
| mousepad WOLF |25 |0 | Published/normal/one active model |
|7 in1 Electronic Cleaner Kit |99 |0 | Published/normal/one active model |

These are review candidates, not recommendations or physical-stock/fulfillment
claims. Owner may select different legitimate published products. Needed: title/SKU,
actual sale price and realistic sourcing/fulfillment timing for quantity1 per buyer.
No recorded-stock entry is required merely to prepare or accept CARD payment.

## Focused qualification and smallest next purchase milestone

12 new automated checks PASS/no skips:4 owner-browser scope/secret-handling guards,
8 native PostgreSQL17/manual-checkout checks on full schema94 and actual HTTP
handlers. No already accepted signup/CAPTCHA/browser switching test was repeated.
Four additional local notice render scenarios PASS. App changes remain only EN/AR.

Native manual cases verify coverage/EGP50 snapshot, CARD-only/no coupons, A ready
stock with same-command lost-ack recovery, B zero-recorded-stock with no fabricated
units, refusal while expectations blank, both positive owned order details and
foreign direct URLs404, uncertain payment one attempt/no second intention, safe
unpaid deferred-stock cancellation, zero PDC jobs/provider calls. Products/people/
stock/payment transport are disposable fixtures, NOT hosted or business acceptance.
One synthetic Paymob timeout was intercepted locally;0 real gateway requests.

Existing deployed cart/checkout isolation is implemented; E57 hosted PROFILE/
session/logout stays accepted. Positive hosted Cart/Checkout/order/recovery remains
HELD by runtime/Caddy. Do not infer readiness from403 or empty baskets. No new
cart, Auth, ERP, checkout, callback or Dashboard refactor was needed.

Smallest purchasing acceptance: **two sequential account-scoped NO-CHARGE checkout
windows using the existing normal-purchase capability**, A then B. Each binds one
customer, durable cart, chosen real product/model/quantity1, manual company, exact
EGP total/private address hash and≤1hour. Public gates stay held; payment_enabled=false.
Keep A owned reads while B's grant is active; verify separate receipts, foreign404,
recovery and no duplicate orders/stock. This needs real business inputs and its
own reviewed runtime/edge/order-creation approval; no executable packet yet.

Only afterward approve one actual Paymob payment/owned signed callback acceptance,
then manual fulfillment/shipment separately. No giant combined deployment/charge/
shipping/refund/public activation. [Detailed plan and practical refund flow](manual-delivery-purchase-acceptance.md).

## Exact remaining inputs and approvals

1. Private authorized sign-in for A restoration and B read-only empty view.
2. Real non-PDC carrier/own driver and actual governorates/cities. EGP50 customer
 fee is the existing draft default unless owner changes it; no PDC files needed.
3. Selected published product/model, real price and sourcing/delivery expectations
 in EN/AR; warehouse quantities may remain0.
4. Merchant LIVE refund permission/reconciliation readiness before a real charge;
 unpaid cancellation alone does not return captured funds. No money action now.

**No exact release/public signup/purchase approval is issued while these dependent
packets are unqualified.** Signup review is prepared, not activation. Native/local
readiness is not a hosted purchase acceptance. Coupons/CX-01 and broad Dashboard
work stay subsequent; PDC mapping/provider account redesign stays paused/future.

Private evidence: ../signup-commerce-next-20261026/ opening-worktrees.json,
readiness-readonly.private.json/before.private.json, qualified historical binding,
account-history-postread.json, stock-policy-readonly.json, published candidates,
production-gates-readonly.json, owner-browser guard logs/timeout status,
manual-card-native-qualified.log, notice-copy-qualification.json/screenshots.
All14 opening worktree heads/bytes preserved except authorized main continuity docs;
new15th worktree local/signup-commerce-next-20261026, full94 base51cbeef/new9b7564f.
Main remains91; no merge/rebase/reset/delete/push. No sensitive evidence in Git.
