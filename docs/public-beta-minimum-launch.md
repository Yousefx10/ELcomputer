# E62 — locations isolated; return to the unchanged95 path

Offline location/reference work is local96 on its own branch/package. It is not
inserted into the frozen95 artifact or approval. See [the review](pdc-location-reference-review.md)
and [deferred-test register](DEFERRED_TEST_REGISTER.md). Complete95 guarded release/
recovery qualification and ONE scoped new-customer real transaction next. Signup
stays OPEN; purchasing/PDC stay held.96 needs its own future sealed scope/approval.

# E61 update — public signup OPEN; purchasing still held

Signup-only owner activation passed2026-10-26 21:18:33.481 Riyadh.
[Verified receipt](public-signup-activation-receipt.md). The95 release below remains
LOCAL/not authorized. Preserve enabled signup through all new preflight/rollback
planning; older disabled-signup expectations are superseded. No repeat Auth tests.

# Smallest public Beta — E59, 2026-10-26

**PUBLIC BETA BLOCKED on the new release and one scoped transaction acceptance.**
**PUBLIC CUSTOMER SIGNUP READY for separate exact owner approval now.**
This decision supersedes E58 housekeeping/history/notice launch gates. Completed
Auth, Turnstile, genuine signup/confirmation, A/B profile/session/logout, deployed
cart isolation, LIVE Paymob callback and packing acceptance are retained.

## Confirmed business scope

Owner confirms all Dashboard products are physically in the store and can ship,
without warehouse counts. This confirms sourcing; it does not publish drafts or
permit unpriced, coming-soon, inactive-model or test products. Beta exposes normal
published positive-price products at their current prices, excluding TESTproduct2026.
No SKU-by-SKU stock census or fictitious receipt/unit/quantity is required.

Owner-managed delivery: EGP50 customer shipping, temporarily all Egyptian cities
and governorates. Actual merchant delivery cost remains separate. A new Manual
company will be configured; never convert, reassign or delete the existing PDC row.
The existing selector gains missing North Sinai; legacy North Coast is retained.
Cities remain customer text within approved governorates, with no PDC ID dependency.

No delivery-day promise was supplied. Proposed transparent bilingual copy for
owner approval in the activation packet:

- EN: Delivery timing depends on your address. Contact us for an estimate.
- AR: تختلف مدة التوصيل حسب العنوان. تواصل معنا لمعرفة الموعد المتوقع.

Owner now requests PDC webhook tracking and reports labels/daily pickups. These
are owner-reported operational facts, not a new accepted callback or reconciliation
of the preserved uncertain shipment. PDC remains technically paused: no new calls,
booking, retry, polling, provider registration or incident changes are authorized.
Latest redacted provider files can inform the subsequent scoped tracking work.
Manual delivery allows Beta without waiting for a PDC integration cutover.

## Critical implementation prepared locally

Source `b37be43ac6a24a663a12a5a56aaaa7e801827963`, full95 lineage from9b7564f; main remains91. Migration95 adds
`site_settings.inventory_tracking_required`, default **true**. An explicitly
approved false value enables ordinary built-in CARD sales without quantity checks.
It snapshots `stock_fulfillment_state=untracked` on new orders; old tracked/backorder/
preorder records and contracts remain unchanged. Toggling the default does not
change existing orders. No inventory counts, physical units or movements are made.

Normal cards, Classic/Premium pages and cart show usual Add to cart/options without
stock/backorder availability labels in this mode. Checkout shows the configured
delivery information without special-order consent/stock-wait messaging. Publication,
model, positive price, trusted totals, company/coverage, CARD-only Beta policy,
verified ownership and duplicate command/payment protections remain authoritative.

Paid untracked orders can enter existing packing with matching product/model SKU
and exact requested quantity. Active operator/session, paid LIVE order, private
video and completed packing requirements remain. Tracked orders retain assigned-
unit scans and allocations. No broad Dashboard, ERP, provider or stock rewrite.

The QA marker `Signup isolation A` is rejected by the server in either address
line at quote and commit. Its profile cleanup is deferred, with no SQL edit or
new login. The guard must be deployed before any genuine purchase window. The
ordinary customer supplies a real address during the actual transaction acceptance.

Local focused qualification: **15 native tests PASS, no skips**, including the
new public-mode two-owner transaction and unchanged tracked-stock suite. Actual
PostgreSQL/SQL and HTTP routes exercise totals, ownership/foreign404 for orders/
payment reads/initiation, duplicate prevention, one synthetic intention/replayed
signed settlement, paid confirmation, no fabricated stock, SKU packing without
inventory, unpaid/wrong actor/wrong code/duplicate/video denials, existing-order
mode persistence and manual commercial closure. Zero external requests or money.
Initial two fixture-only video metadata/cast failures are retained; qualified
run `native-untracked-and-preservation-3.log` governs. Typecheck PASS. Build and
artifact receipts are recorded separately in the private E59 work directory.

This is LOCAL validation. It is not a production deployment, actual customer charge,
real recording, transfer, provider refund, dispatch or hosted new-customer acceptance.

## Minimum cancellation and reimbursement

Automatic refund capability and the Paymob refund/void UI/API project are **B**.
A practical customer repayment and reconciliation process remains **A**. Owner
proposes direct transfers. Such a transfer is a separate reimbursement; Paymob
refunds return to the original payment method. Do not label a bank transfer as a
Paymob refund or assume it closes the original captured card transaction.
[Paymob refund reference](https://developers.paymob.com/paymob-docs/developers/manage-payment-apis/refund),
rechecked2026-10-26. Provider/scheme acceptance of an alternative is not established
by this local work; use the merchant-supported original method where available.

Before any manual remedy, stop fulfillment; match owned order/original captured
transaction, EGP amount and previous compensation. Record customer agreement to
the proposed method and privately verify destination. Keep one append-only private
operation with unique operation_id, order/transaction, method, amount, reason,
consent/evidence hashes, provider/bank reference, operator/reviewer and state.
Check the prior log and remaining amount BEFORE action; no automatic resubmission
on ambiguity. Reconcile original card receipt and any later refund/dispute to
prevent duplicate repayment. Only confirmed evidence permits commercial closure.

Native local proof shows existing authorized status/audit closure keeps original
captured payment evidence, produces no phantom stock and cannot be reopened by a
replayed success. Original `payment_status=paid` remains captured-card history;
commercial `status=refunded` alone does not send money or prove a card reversal.
The private operation log is the initial manual reconciliation boundary, not an
automatic application refund ledger. Real allocated/returned goods still follow
existing return controls. Uncertain payment retains original attempt/reference;
never create a second charge to diagnose it. Review exceptions every15min while
Beta is staffed; pause new purchases if reconciliation cannot be maintained.

## One guarded Beta plan, not authorization

1. Freeze this95 candidate, migration hash, build archive, exact production target
 and current94 source/runtime/DB/Caddy hashes. A new guarded operator and qualified
 backup/recovery capsule must be prepared; consumed helpers are never reused.
 Dry-run/read-only target preflight must pass. No broad Git integration or push.
2. Under the eventual exact release approval, take qualified backups, apply ONLY95
 (atomic,5s lock timeout) with tracking defaulttrue, install the pinned app inactive,
 and prepare separate Manual company/EGP50/all supplied coverage. No product,
 customer/history, PDC incident or existing order rewrite. Configure approved
 bilingual delivery terms. New untracked mode is enabled only for the reviewed
 acceptance/activation stage. Other payment methods stay disabled.
3. ONE scoped new-customer normal CARD transaction: use the authorized new customer
 with a real checkout address, one approved published product/quantity1, trusted
 total including50 shipping, exact EGP maximum and a single intention/charge budget.
 Bind the account/cart/company/total in the existing controlled capability; do not
 start another signup/CAPTCHA/profile test. Other customer reads/attempts against
 that order must reveal no data and create no intention. Existing local A/B proof
 means no second paid customer order is required for this minimum milestone.
4. Accept once: durable owned order, server total/fee, expected untracked disposition,
 same-command retry gives one order, one payment attempt, accepted signed callback
 gives one paid order, owner Dashboard confirms that actual payment. Preserve paid
 packing guards; do not repeat the separately accepted packing/video workflow or
 create a shipment. Stop on an uncertain/mismatched result; retain the original.
5. Only if all guards pass and the exact owner activation approval covers this stage,
 open normal public Beta using the existing reviewed Beta policy: Manual company,
 CARD only, excluded test products, published normal catalog and configured delivery
 terms. No coupons, alternative payments, automatic PDC dispatch or tracking promise.
 Signup can already be open through its separate approval. Never silently broaden
 a controlled grant or treat successful local tests as authorization to activate.

Explicit eventual authorization must bind artifact95/migration/target/config and
separately enumerate the one real payment budget and conditional public-open stage.
No executable Beta approval token is issued while the new95 operator/recovery and
exact transaction inputs are unsealed. This is one focused plan, not a demand for
new historical/housekeeping or repeated provider tests.

Kill switch: disable new purchasing and outbound payment initiation at runtime and
restore the reviewed restrictive edge rules. Keep signed callbacks and protected
owned receipts readable for late settlement. Stop new Manual dispatch separately.
Preserve all order/attempt evidence. Before any untracked orders exist, recovery can
restore the previous app and tracking default while keeping additive schema95. Once
an untracked order exists, retain compatible95 handling for reconciliation; do not
drop95, rewrite its stock policy or roll back paid orders/data. Signup has its own
independent toggle/rollback; it need not close when purchasing closes.

## Deferred explicitly

**C:** repeated private Chrome cleanup, A address-marker removal, historical-owner
empty-history browser inspection, signup/recovery success-screen polish, returning-
notice visibility/extra previews and wider cosmetic review. Both old private windows
closed on timeout with0 logins/writes. Their incomplete acceptance is retained.

**B:** actual order-bearing historical detail acceptance/claims, PDC webhook tracking
cutover and mapping work, full refund automation, multiple saved addresses, coupon
fix, wider Dashboard/ERP/chat/SEO/notifications work, per-product stock overrides,
scheduler installation (staffed manual monitoring suffices initially). Existing
identity/RLS, callback, packing and inventory safeguards are never deferred.

## Complete task classification

A means the **minimum safety portion** is required for payments, not that all of
that roadmap task must be finished. Accepted/deployed portions stay accepted.
B is deferred; C is cosmetic/housekeeping. Mixed scopes are stated explicitly.

| Task | Class | Current launch disposition |
|---|---|---|
| DONE-01 | B | Preserve accepted/deployed baseline; no repeated acceptance. |
| DONE-02 | A | Preserve accepted/deployed baseline; no repeated acceptance. |
| DONE-03 | A | Preserve accepted/deployed baseline; no repeated acceptance. |
| DONE-04 | A | Preserve accepted/deployed baseline; no repeated acceptance. |
| DONE-05 | B | Preserve accepted/deployed baseline; no repeated acceptance. |
| DONE-06 | B | Preserve accepted/deployed baseline; no repeated acceptance. |
| DONE-07 | B | Preserve accepted/deployed baseline; no repeated acceptance. |
| DONE-08 | A | Preserve accepted/deployed baseline; no repeated acceptance. |
| DONE-09 | B | Preserve accepted/deployed baseline; no repeated acceptance. |
| DONE-10 | B | Preserve accepted/deployed baseline; no repeated acceptance. |
| DONE-11 | A | Preserve accepted/deployed baseline; no repeated acceptance. |
| LOCAL-01 | A | Preserve accepted/deployed baseline; no repeated acceptance. |
| LOCAL-02 | A | Preserve accepted/deployed baseline; no repeated acceptance. |
| LOCAL-03 | A | Preserve accepted/deployed baseline; no repeated acceptance. |
| LOCAL-04 | A | Preserve accepted/deployed baseline; no repeated acceptance. |
| LOCAL-05 | B | Preserve accepted/deployed baseline; no repeated acceptance. |
| LOCAL-06 | B | Preserve accepted/deployed baseline; no repeated acceptance. |
| LOCAL-07 | A | Subsequent roadmap; not a public Beta gate. |
| LOCAL-08 | C | Subsequent roadmap; not a public Beta gate. |
| BETA-01 | A | Preserve accepted/deployed baseline; no repeated acceptance. |
| BETA-02 | A | Preserve accepted/deployed baseline; no repeated acceptance. |
| BETA-03 | A | Accepted security; signup-only activation approval ready. |
| BETA-04 | A | Preserve deployed verified ownership; empty-history inspection deferred. |
| BETA-05 | A | New local public-mode paid order/ownership proof PASS; one hosted new-customer transaction remains. |
| BETA-06 | A | Owner confirms catalog physically available at listed prices; no warehouse counts required. |
| BETA-07 | A | Owner-managed delivery, all cities/governorates, EGP50 confirmed; configure a separate Manual company. |
| BETA-08 | A | Basic reimbursement/cancellation and private reconciliation required; automation deferred. |
| BETA-09 | A | Manual exception monitoring and kill switch required; scheduler installation deferred. |
| BETA-10 | A | Preserve accepted/deployed baseline; no repeated acceptance. |
| BETA-11 | A | Guarded schema95 release and bounded normal-customer purchase before public activation. |
| BETA-12 | A | Accepted LIVE payment/callback retained; no repeat provider audit/charge. |
| MIG-01 | B | Preserve accepted/deployed baseline; no repeated acceptance. |
| MIG-02 | B | Preserve accepted/deployed baseline; no repeated acceptance. |
| MIG-03 | B | Preserve accepted/deployed baseline; no repeated acceptance. |
| MIG-04 | B | Migration/SEO follow-up deferred; do not relaunch historical import. |
| MIG-05 | B | Preserve accepted/deployed baseline; no repeated acceptance. |
| PAY-01 | B | Subsequent roadmap; not a public Beta gate. |
| PAY-02 | B | Subsequent roadmap; not a public Beta gate. |
| PAY-03 | B | Automated Paymob refund/void integration deferred; manual remedy governed by BETA-08. |
| PAY-04 | B | Subsequent roadmap; not a public Beta gate. |
| PAY-05 | B | Subsequent roadmap; not a public Beta gate. |
| PROD-01 | A | Subsequent roadmap; not a public Beta gate. |
| PROD-02 | B | Subsequent roadmap; not a public Beta gate. |
| PROD-03 | B | Subsequent roadmap; not a public Beta gate. |
| PROD-04 | B | Subsequent roadmap; not a public Beta gate. |
| SHIP-01 | B | Subsequent roadmap; not a public Beta gate. |
| SHIP-02 | B | Subsequent roadmap; not a public Beta gate. |
| SHIP-03 | B | Subsequent roadmap; not a public Beta gate. |
| SHIP-04 | B | Subsequent roadmap; not a public Beta gate. |
| SHIP-05 | B | Subsequent roadmap; not a public Beta gate. |
| SHIP-06 | B | Subsequent roadmap; not a public Beta gate. |
| SHIP-07 | B | PDC tracking requested; optional to owner-managed launch, no new calls. |
| SHIP-08 | B | Preserve accepted/deployed baseline; no repeated acceptance. |
| SHIP-09 | B | Subsequent roadmap; not a public Beta gate. |
| SHIP-10 | B | Requested PDC webhook follow-up; paused provider/incident preserved pending exact scope. |
| SHIP-11 | B | Subsequent roadmap; not a public Beta gate. |
| SHIP-12 | B | Preserve original uncertain booking; never retry or reuse its consumed operator. |
| ORDER-01 | A | Preserve accepted/deployed baseline; no repeated acceptance. |
| ORDER-02 | B | Subsequent roadmap; not a public Beta gate. |
| ORDER-03 | B | Subsequent roadmap; not a public Beta gate. |
| ORDER-04 | B | Subsequent roadmap; not a public Beta gate. |
| ORDER-05 | B | Full returns/refund automation deferred; basic cancellation/reimbursement remains BETA-08. |
| CX-01 | B | Subsequent roadmap; not a public Beta gate. |
| CX-02 | B | Subsequent roadmap; not a public Beta gate. |
| CX-03 | B | Subsequent roadmap; not a public Beta gate. |
| CX-04 | A | Deployed session isolation accepted; new local transaction proof PASS, no repeated profile switching. |
| CX-05 | B | Subsequent roadmap; not a public Beta gate. |
| CX-06 | B | Subsequent roadmap; not a public Beta gate. |
| FUT-01 | B | Broad Dashboard acceptance deferred; preserve existing named permissions. |
| FUT-02 | C | Subsequent roadmap; not a public Beta gate. |
| FUT-03 | B | Subsequent roadmap; not a public Beta gate. |
| FUT-04 | B | Subsequent roadmap; not a public Beta gate. |
| FUT-05 | B | Subsequent roadmap; not a public Beta gate. |
| FUT-06 | B | Subsequent roadmap; not a public Beta gate. |
| FUT-07 | B | Subsequent roadmap; not a public Beta gate. |
| FUT-08 | B | Subsequent roadmap; not a public Beta gate. |
| FUT-09 | B | Subsequent roadmap; not a public Beta gate. |
| FUT-10 | B | Subsequent roadmap; not a public Beta gate. |
| CONT-01 | C | Subsequent roadmap; not a public Beta gate. |
| PROD-05 | A | Global opt-in mode implemented locally for Beta; per-product overrides deferred. |
| PROD-06 | C | Subsequent roadmap; not a public Beta gate. |
| CHAT-01 | B | Subsequent roadmap; not a public Beta gate. |
| DOC-01 | B | Subsequent roadmap; not a public Beta gate. |
| ORDER-06 | B | Subsequent roadmap; not a public Beta gate. |
| DASH-01 | C | Subsequent roadmap; not a public Beta gate. |
| DASH-02 | C | Subsequent roadmap; not a public Beta gate. |
| ERP-01 | B | Subsequent roadmap; not a public Beta gate. |
| ERP-02 | B | Subsequent roadmap; not a public Beta gate. |

Additional owner requirements: OD-20261026-AUTH-UX-01 and historical empty inspection
are C; OD-20261026-SIGNUP-02 notice is C; BETA-04's ownership protection remains A.
OD-20261026-STOCK-03 global mode is A/implemented locally; its per-product extension
is B. OD-20261026-DELIVERY-02 Manual coverage/50 and OD-20261026-REFUND-02 minimal
manual remedy are A; provider automation is B. OD-20261026-TRACK-01 is the next
PDC follow-up, B for owner-managed Beta, with no provider authorization inferred.

## E59 packaged candidate receipt

Source `b37be43ac6a24a663a12a5a56aaaa7e801827963`;95 migrations. Final production
build PASS; typecheck PASS; native15 PASS/no skips. New private candidate archive
`../public-beta-minimum-20261026/artifacts/application.tar.gz`: SHA256
`81becf54218a8e144137f2bdce7df1eed6bcc07745924c0167fcd7435aae37ff`. Migration95 SHA256
`fd9c028435f74caae6b3731ce7791573077838d00f9c3893ac3e10f484e2a508`. Private manifest includes the
reviewable Manual/50/all-area/default-safe-mode configuration draft. No keys or
customer credentials are embedded. Three output symlinks all resolve inside the
application package. This is not a sealed executable95 deployment operator or
permission to run one. Production remains94; no migration/config/activation ran.

## E60 addition — deferred storage audit

STOR-01 is task89, class B, queued AFTER this Beta milestone. The original88-task
classification above is preserved. See [the read-only audit plan](vps-storage-audit-plan.md).
Unused Supabase bucket definitions are not a launch blocker. No current bucket
counts/classifications or full VPS workflow acceptance are inferred before audit.
