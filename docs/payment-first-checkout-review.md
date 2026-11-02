> **E181,2November2026:** Original local review below is preserved. Current codee0ece3a adds two baseline ownership tests only to830. Missing inactive compatibility, exact migration/rollback, asset HTTP/backups/guard qualification and fresh sealed read-only preflight now PASS. [Inactive core108 release review](payment-first-core108-release-review.md) supersedes the old unsealed-release status in section9; new exact approval/expiry required. Production unchanged;109/monitor/activation remain separate.

# PAY-FIRST-01 — local design and qualification

2 November 2026. Owner decision OD-20261101-PAY-FIRST-01.

**PAYMENT-FIRST DESIGN READY locally. Production deployment and activation are
not qualified by this report. No deployment approval, seal or expiry is issued.**

The owner authorized implementation and isolated qualification. Nothing was
installed, activated, restarted, charged, refunded, emailed or sent to a provider.

## 1. Verified production and preservation

Read-only host/DB refresh at 2026-11-01 21:25:21 UTC (2 November 00:25 Riyadh):
`5fa9ef1bf4b05359 / schema107 / source7b3706768206a8852483999e98b0b1b46d1a0b04`.
Application169602/Caddy26652 and all17 protected hashes match the deployment.
CARD/COD, automatic customer Email, bounded PDC tracking and MON-01 remain live.
The same six payment-unverified warnings, zero critical and original journal-gap
bindings remain. Nine existing orders and payment evidence are unchanged. No
eligible genuine AWB exists. Dashboard fee10 and emergency controls are preserved.

The cancelled `ORD-20261101-96B4660736` stays closed/provider-unverified. No inquiry,
reopening, retry, refund, stock release or financial reclassification was made.
Historical uncertain PDC booking remains quarantined. No shipment was created.

All46 pre-existing worktrees,24,133 protected non-document pending file hashes and
all35 deferred IDs/evidence are preserved. This is an isolated47th worktree:
`local/payment-first-checkout-20261101`, based on deployed7b plus reused checkout
A–E commit571a670. Full phase-two34e1590, visual7b, phase-one71d86c3 and metadata
9b4107c are retained. No blind merge, reset, cleanup or Git push occurred.

## 2. Existing order-creation points

| Existing point | Existing behavior | New branch |
| --- | --- | --- |
| POST /api/checkout | commerce_checkout_command commits pending order/items and effects | Freeze private prepaid session; dispatch one intention only after explicit confirmation |
| Controlled checkout | Same guarded command/receipt RPC | Cannot bypass the activated prepaid lifecycle |
| POST /api/payments/intentions | Claims a public order-bound attempt | Retained for existing orders; new sessions use private checkout-bound attempts |
| Paymob HMAC webhook | Reconciles an existing public order | Durable signed receipt/inbox; correlate private session first, otherwise unchanged legacy reconciliation |
| Browser return / Pixel completion | Presentation only | Cannot create an order or prove payment |

COD is intentionally still order-at-confirmation, unpaid/awaiting cash collection.
No current order, attempt, amount, callback or historical record is converted.

## 3. Private model and exact finalization

Core108 adds six private tables: settings, immutable checkout sessions, one claimed
attempt/session, monotonic callback inbox, immutable hash-only signed receipts and
verified funds. Existing customer_orders gains a nullable unique checkout_session_id.
No browser or service-role direct table access is granted. Service-only functions
perform ownership, authorization and row locking. Authenticated public order/item
RLS remains owner-scoped; account changes clear mounted private UI and requests.

The server reuses current pricing/location/delivery/coupon/stock authorization.
It freezes the normalized quote, original titles/SKUs/prices/quantities, address,
shipping/fees/discounts/currency, owner/cart/quote identity, locale and cart-line
acknowledgements. Client totals never set the amount. Quotes must still match at
start. The30-minute local session deadline cannot prove provider failure.

One unresolved prepaid session/customer, unique cart/session/attempt/provider
references and a dispatch claim before POST prevent duplicate initiation. Old
cached clients lacking the new cart acknowledgement contract fail before any
session/provider action. Lost responses remain uncertain; page views, retries,
returns and recovery never make a replacement intention or replay a stored secret.

Only the existing valid HMAC + supported live sale + exact signed provider order,
integration, mode, EGP currency and amount can fund a matched checkout. Unsigned
special_reference/browser success is never ownership proof. Callback/mapping locks
close the before-persistence race. Separate immutable digests retain pending and
successful signed statuses without storing PAN, raw callback bodies or secrets.

Verified funds create one order/items/public CARD ledger/command receipt and paid
transition in one transaction. Existing warranty/after-sales guards run. Only the
verified-paid Email event is captured after its ledger exists; no unpaid receipt
is queued for the new prepaid path. Capture and dispatch retain schema105 verified
recipient ownership checks. Duplicate callbacks/approvals cannot duplicate orders,
stock effects, coupon use or Email events. Legacy callbacks remain compatible.

If order insertion fails, funds and signed evidence survive privately; staff with
payments.review + payments.verify can retry DB finalization only. Additional
successful transactions remain separate review evidence; no second order/refund.
A completely lost intention response may leave an unknown signed provider order.
It stays quarantined in the inbox. Matching by amount, age or unsigned metadata is
forbidden. Binding requires independently verified provider identity; its recovery
contract is held, with no new merchant inquiry or guessed API.

## 4. Cart, stock and expiry behavior

No unsuccessful session creates an order, stock/coupon effect, shipping record or
customer Email. Abandonment and failure retain the cart and frozen checkout details.
Owned payment activity is separate from My Account orders and Dashboard Orders.
The account can review frozen details and check status without a provider request.
No unsafe Pay Again is added. Failed/uncertain sessions remain guarded rather than
being released on age alone; an abandoned charge cannot silently become final failure.

A durable paid order acknowledges only the purchased cart-line epochs/quantities.
New additions, other options and removed/re-added items survive; refresh cannot
subtract a purchased quantity twice. No provider secret enters localStorage.

Already-paid prices/fees/discounts are honored even after expiry/catalog changes.
Current inventory_tracking_required=false remains authoritative, including
serialized products sold in untracked mode. If recorded inventory is required,
the paid order is held for the existing staff stock allocator; it never invents
stock. Native qualification received actual fixture stock and released the hold
exactly once through the existing Orders permission.

## 5. Manual InstaPay (independent addon109)

Four additional private tables hold settings, recipient-bound submissions, receipt
metadata and immutable review command/audit evidence. No normal order exists until
staff verify actual funds. The dedicated customer page shows the frozen recipient,
exact amount/instructions and optional reference; proof submission is Under Review.
Rejection/correction remains private activity, not an unpaid sales order.

Existing Dashboard CARD/COD controls remain. Named payments.view/review/verify/
configure permissions guard the new compact transfer queue/settings. Staff check
actual bank credit, exact amount/currency, original recipient/settings revision,
bank date and globally unique reference. Case/whitespace normalization is explicit;
no OCR, bank API, guessed reference equivalence or automatic approval is used.

Files reuse private VPS document safety in a separate transfers-v1 namespace;
optional transferDocumentsDir falls back to the existing private shipping root.
No Supabase Storage. Content-validated JPEG/PNG/inert PDF only; configured limits
are capped at5MiB, four PDF pages and five receipts/session. Script/actions/forms/
attachments/annotations and disguised content are rejected. Two concurrent uploads,
one/user, bounded parsing,0700 directories/0600 files, no links/traversal, atomic
publication, SHA256/size verification and authorized no-store access are retained.
Exact receipt digests and normalized bank references prevent reuse. A successful
file upload alone never means Paid. Verification reads the stored file again.

Verified acceptance reuses the same one-order finalizer and bilingual paid-only
Email safety. The current untracked paid-transfer order can use existing staff
packing/video and PDC eligibility with zero COD. No shipment is queued or dispatched.
Native qualification performed a quantity scan, real isolated WebM validation and
packing completion, then inspected eligibility with zero PDC requests.

Recipient/instructions, role assignments, private hosted storage/backup/retention
and real bank operating acceptance remain owner-configured before activation.
Existing manual/preorder records are not rewritten. New prepaid preorders and
other unimplemented bank-transfer/PayPal flows remain unavailable in the new lifecycle.

## 6. Additional provider readiness (C)

| Method | Verified documentation | Still required / current state |
| --- | --- | --- |
| CARD | Existing working Paymob infrastructure reused | New checkout identity/hosted-return/3DS acceptance after an approved inactive deployment |
| Apple Pay | Paymob documents Egypt | Actual merchant enablement/live integration/domain verification/certificates are unverified; unavailable |
| Google Pay | Regional page lists KSA/UAE | Egyptian merchant availability unverified; unavailable despite technical Pixel support |
| Egyptian wallets | Vodafone Cash, Orange Cash, e& money, We Pay and bank wallets documented | Actual enabled merchant integrations and qualified callback/flow are pending; unavailable |

Sources checked1 November, without authenticated provider calls:
[Apple Pay](https://developers.paymob.com/paymob-docs/payments-and-features/payment-methods/apple-pay-all-regions),
[Google Pay regions](https://developers.paymob.com/paymob-docs/payments-and-features/payment-methods/google-pay-ksa-uae),
[Egypt wallets](https://developers.paymob.com/paymob-docs/payments-and-features/payment-methods/mobile-wallets-egy-ksa).

Existing mode-bound private paymobIntegrationIds registry is reused. Dashboard
shows configuration/readiness; IDs alone cannot make an unimplemented method
available. Integration IDs remain reviewed private runtime configuration, not a
new public Dashboard enable bypass. CARD/COD settings and InstaPay settings are
configurable in their authorized existing/new forms. No IDs/contracts are invented.
Pixel/Pay Again remain held pending the existing provider reply. D catalog/
accessories and historical metadata remain outside this feature and undeployed.

## 7. Local qualification and limits

Private logs/artifacts reside outside Git at payment-first-checkout-20261101.
All customer/provider examples are owned isolated fixtures, never genuine purchases.

| Evidence | Result |
| --- | --- |
| Composed108/109 native SQL, real H3 HTTP, HMAC, RLS, concurrency, funds recovery, cart, COD, transfer upload/review, validated packing, Email/labels/monitor regressions |141 Node tests pass |
| Existing Paymob suite, native legacy races/cancellation, method registry, actual compiled config/private-environment canaries |41 pass, no skips |
| Core108 alone, without addon109 |23 native/HTTP tests pass |
| Existing MON worker plus four optional private-session checks |26 Python tests pass |
| Actual Vue checkout/status/transfer/review/settings/activity; Chromium and WebKit |102 scenarios per engine,204 total;206 Node test results including wrappers |
| Browser sizes/themes/locales |320/390/768/1440, light/dark, EN/AR/RTL; explicit handoff/cart/paid-line/privacy/review cases |
| Migration transaction rollback |Restores107 function definitions exactly before any checkout data exists |
| Operational disable |Blocks new starts, retains late callbacks/evidence/paid orders; activated lifecycle cannot fall back to unpaid order creation |
| Historical migration/cancellation preservation |All107 original files unchanged; prior qualified cancellation guard body identical |
| Typecheck/build |Pinned Node22.23.1, empty dotenv and fixture origins; pass |

This is not an all-repository-green claim. Twenty-six stale COD/location/source
assertion failures were reproduced on the untouched deployed7b source; their logs
and deferred evidence remain. The Paymob VM harness was updated to load the real
new imports and compile the real Nuxt configuration; no security assertion was
removed. Previously deferred tests and evidence have not been deleted.

Fixtures do not prove hosted Supabase privileges/cache/HTTP acceptance, a real
merchant charge or3DS return, physical iPhone behavior, actual bank credit, mailbox
delivery, a genuine PDC shipment/PDF or owner acceptance. No such test was spent.

## 8. Deployment sequence and exact disable/rollback boundary

Actual deployed history ends107. Core candidate:
`20261101220000_payment_first_checkout.sql` →108.
Addon candidate `20261101221000_manual_instapay_checkout.sql` →109 only after108.
No historical migration edits, backfill, old-order conversion or catalog migration.
Old local catalog108/109 and cancellation110 labels do not reserve checkpoints;
future composition must preserve originals and receive a freshly qualified sequence.

1. Seal complete core A108 + compatible app, with server/public paymentFirstEnabled
   false and every new initiation control OFF. Keep existing live CARD/COD behavior.
   Qualify the managed role, migration/rollback operator, backups and fresh guards
   before requesting its exact one-use deployment approval. Do not deploy half of A.
2. After approved inactive installation, verify owner/staff isolation and old
   checkout/callback/COD/Email/MON/tracking. Install/qualify optional monitor coverage
   under its own exact reviewed file/config scope; preserve the six old alert IDs.
3. Seal a separate payment-first activation with the complete UI/API/DB switch,
   cached-client guards, monitor readiness, bounded cutover and disable procedure.
   A private-session flag change is not a legacy-order Pay Again approval.
4. B109 is an independent inactive addon after108, then separately configured/
   hosted-qualified and activated. No automatic bank instructions or receipt review
   activation. C merchant flows stay unavailable; D catalog stays separate.

Emergency disable A: use the revision-checked commerce_payment_checkout_configure
with enabled=false (separately approved operational action). Keep the new writer/
callback binary and runtime contract. It blocks new CARD starts and continues
verified late finalization. COD, tracking/history and current orders stay intact.
Emergency disable B: revision-checked commerce_transfer_configure enabled=false,
retaining the saved recipient/settings. Existing proof/funds review remains
available for transfers already instructed; new sessions stop. Neither disable
clears activation history or permits legacy unpaid prepaid order creation.

Before activation and with zero private attempts, an approved old-binary app
rollback may retain the additive inactive schema. After any private attempt exists,
retain the compatible callback/finalizer and use disable + forward repair. Never
restore an old database, drop funded/session/receipt tables, delete evidence or
roll back to a callback handler that cannot accept the new references. No automatic
rollback, merchant inquiry, replacement intention, refund, shipment or email test.

## 9. Remaining release/activation gates and one next action

Local design/implementation qualification is complete. An inactive production
operator/package, managed-role preflight and revision-bound approval have not been
sealed by this design task; therefore there is no executable deployment approval
or expiry to replay. Existing visual approvals remain consumed.

Activation additionally needs hosted inactive acceptance, installed private-session
monitoring, controlled merchant/return/3DS acceptance under separate transaction
approval, and owner acceptance of the quoted-price/paid-stock-hold/quarantine rules.
InstaPay needs the owner's verified bank recipient/instructions, roles and hosted
private-file operations before its own activation. Unknown signed mappings require
provider-proven identity; no unsupported automatic recovery is available.

**ONE next action:** prepare the separately sealed inactive core108 deployment
packet from this qualified branch. Keep addon109, provider methods and catalog
under their independent gates. This report does not authorize that deployment.
