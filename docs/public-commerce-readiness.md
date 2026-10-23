# Public customer purchasing readiness — 24 October 2026

Public launch remains blocked. This assessment authorizes no activation.
PDC development and investigation are paused until the owner explicitly resumes.
Preserve its original reference, uncertain dispatch and all incident evidence.

## Scope and evidence

Read AGENTS.md, README.md, both current handoffs, Notes.txt, Git status,
branch history and working diff before editing. The current branch remains
`local/owner-checkout-city-followup-20261023` at `ab21ed0`.
At inspection, local main was one commit ahead of its recorded origin/main;
the current branch contained twelve commits beyond main. No remote ref refresh,
branch switch, reset, merge, rebase, commit or push ran.

Codex 2's existing documentation and untracked tests are preserved.
The new handoff notices prepend to the exact existing working files.
No PDC document, incident, test or operator was edited by this assessment.

Production inspection used pinned SSH and read-only PostgreSQL transactions.
HTTP checks used anonymous GETs and an empty coupon POST, which returns before
coupon lookup. Auth inspection read only public provider settings.
No signup, recovery email, authenticated write, provider transaction or callback
replay ran. Production release remains `0ea60833a5071f27`, schema91.
Private evidence and isolated build source: `../public-commerce-readiness-20261024/`.

## Current blockers and preserved systems

| Area | Verified state | Remaining launch requirement |
| --- | --- | --- |
| Registration and sign-in | Login/Profile render; Supabase email auth enabled, signup disabled, email autoconfirm false, anonymous/social auth disabled. One Auth identity and one active customer profile. | Review legacy identity conflicts before opening signup. Accept confirmation, recovery, redirect allowlist and delivery using separately approved customer identities. Rendering is not authenticated acceptance. |
| Account and addresses | Existing own-profile editor persists one contact/address through Supabase RLS. Customer APIs validate bearer, profile status and ownership. | This is one saved address, not a multi-address book. Local profile session fix below needs deployment and hosted acceptance. |
| Cart and checkout isolation | Existing cart persistence, revision markers, user-keyed pending commands and command recovery should be reused. | `useCart.js` uses one browser-wide cart. Checkout captures customer/profile once on mount; changing sessions can retain the previous address, review or recovery display. Scope carts and reset checkout state on account changes, rejecting late responses. Do not automatically assign unidentified legacy carts to a customer. |
| Availability and stock | 225 published products; one normal published product has recorded positive stock. Database reports49 serialized units in stock and one sold. Card/cash use server prices, confirmed-email checks, product/variant/quantity validation, warehouse checks and transactional allocation. | These counts are database records, not physical verification. The earlier owner attestation covered one test unit. Review genuinely saleable SKUs/units and pricing. One other published selling mode exists; exclude unaccepted preorder/other flows from initial acceptance. |
| Concurrency and recovery | Quote/command RPCs serialize cart commands; creators lock stock; receipts bind customer, intent and quote. Existing payment attempts and transaction uniqueness prevent blind duplicate initiation/settlement. | No hosted multi-customer race acceptance exists. Qualify last-unit competition, duplicate requests, failed/abandoned payment stock handling and explicit cancellation/release. Automatic unpaid-stock expiry/release was not established by this review. |
| Live card payment | Production ledger still contains one LIVE succeeded payment: transaction559384846,200 minor units/EGP2. One paid card order is ready to deliver. Keys remain present privately. | Preserve the completed signed-callback acceptance. Do not repeat integration work. Multi-customer acceptance is separate; no new charge was authorized. |
| Callback and result | Exact signed Paymob POST ingress, owned status and receipt routes remain excepted in Caddy. Callback configuration deliberately supports late reconciliation while initiation is disabled. Browser redirects cannot establish payment. | Preserve this ingress, HMAC checks, context binding, row locks and monotonic success handling during every later release/closure. Do not replay the completed payment to prove preservation. |
| Delivery | The only checkout company is PDC, Cairo, customer chargeEGP1. Provider setting is enabled, but outbound gates are false; automatic labels/reverse/COD are off. | This retained test configuration is not public delivery acceptance. PDC remains paused. There is no configured non-PDC checkout company. |
| Manual delivery and pickup | Shipping companies already support `provider='manual'`; its quote path returns before PDC lookup and does not queue PDC booking. Dashboard supports manual status updates. | Reuse this adapter only for an owner-confirmed real service, coverage and customer price. No such service/rate was supplied. Pickup has no supported checkout path: client and server accept shipping only. Do not relabel a courier as pickup. |
| Dashboard and progress | RBAC-protected order handling, active packing ownership, scan/video validation and Ready to Deliver guard already exist. Owner completed packing for the paid test. My Account order projections are customer-scoped; anonymous admin/account APIs return401. | Accept two-account/customer and authorized staff views. Verify manual delivery completion, cancellation and inventory disposition. The uncertain PDC test order remains guarded and must not be used for this acceptance. |
| Confirmations | Order summary/result/My Account provide existing order confirmation. Email foundation has no enabled account/key; SMS provider and order event switches are disabled. No order-confirmation email producer appears in checkout or payment reconciliation. | Confirm on-screen paid-order behavior. If email/SMS confirmation is required, add an idempotent order-event producer and separately approve actual delivery; enabling a foundation alone is insufficient. Supabase confirmation/recovery email is a separate system and remains untested here. |
| Coupons and access policy | Public `POST /api/checkout/coupon` returns Caddy403; the same empty body reaches Nuxt400 on loopback. Checkout/shipping/capabilities remain held; account messages/admin orders reach application401. | Caddy denial is intentional. Coupon preview currently lacks customer/purchase authorization and trusts a preview subtotal; final order SQL revalidates coupons. Do not simply open it. Review auth, purchase scope, bounded abuse controls and authoritative pricing in Phase5. |
| Payment choices | Saved site flags have Card, Cash, Bank Transfer and InstaPay enabled; PayPal disabled. Runtime Paymob initiation/live-request gates remain false, private purchase grant empty, and public purchasing defaults false. | Saved flags do not prove availability. Before future activation, explicitly constrain accepted methods. Do not expose unaccepted cash, transfer, proof-upload, wallet or express flows by merely flipping purchasing on. |
| Refunds and cancellation | Application Paymob refund/void API is unimplemented. Dashboard order status changes do not return card funds. Refund/void callback shapes are excluded from normal sale settlement. | Adopt the merchant process below and prove local reconciliation/stock handling before broad launch. |

The global public purchasing environment override was absent; the checked-in
runtime default is false. Existing Caddy holds and the empty grant agree.
No claim is made that a literal false override was present for that setting.

## WordPress identity boundary

Follow [the migration plan](wordpress-customer-migration.md). Unrestricted signup
must wait for accepted matching decisions. A new verified Supabase customer can
later receive reviewed legacy history without replacing their UUID or password.
The current plan does not yet supply an implemented durable import/mapping workflow.

Match only reviewed verified identities. Guest order/contact emails do not prove
ownership; never auto-confirm imported users or grant staff roles. Preserve new
address/profile edits when importing older values. Historical order import must
not call live checkout, deduct stock, initiate payment/shipping or notify customers.
Do not make registration depend on importing historical orders, but resolve
duplicate/conflicting identities before allowing unrestricted registration.

## First local feature: account profile session isolation

The existing profile form retained its prior values while another account loaded.
If that load failed, loading ended and the old draft could be submitted using the
new session. The account header also retained old identity data and accepted late
responses. This is a client-state defect within a shared browser; no cross-account
database access was established.

`app/pages/account/profile.vue` now clears private fields and notices synchronously
when identity changes. Saving requires a successful load for the same customer.
Each save captures its draft/customer before awaiting authentication; stale load
and save responses cannot replace fields or announce success for another session.
`app/layouts/account.vue` clears the prior header and rejects obsolete responses.
Unmounting invalidates pending responses. Existing components, text, EN/AR, themes,
RLS and server authorization remain in use. There are no new configuration inputs,
tables, migrations or deployment-specific identities.

The shared cart and checkout defects remain separate, explicit Phase1 work.
This small correction does not certify the whole account or checkout application.

## Merchant refund process before broad launch

Paymob's [official refund documentation](https://developers.paymob.com/paymob-docs/payments-and-features/managing-payments/refund)
describes full/partial refunds of successful transactions through its merchant
dashboard, returning funds to the original payment method. This is a documented
manual option, not acceptance of this merchant's account permissions or balance.

Before launch, the owner must confirm authorized refund access and merchant terms.
For an approved customer refund, staff identify the saved successful transaction,
check prior refund totals, and use Paymob's dashboard for the authorized amount.
Record provider confirmation/reference, amount, order and reason in the controlled
merchant record; confirm pending/failed outcomes before retrying. Reconcile local
payment state, inventory and customer communication through a separately reviewed
workflow. Never mark an order refunded solely from its status selector, and never
change a verified paid sale merely because a refund request was submitted.
No refund, void or completed-test transaction change ran here.

## Validation and next guarded step

- Five new tests execute the shipped SFC scripts with real Vue reactivity and
  deferred responses: immediate clearing/failed-load save denial, out-of-order
  loads/sign-out, queued-save isolation, late acknowledgements and header races.
- The original HEAD reproduced stale-profile failures in an isolated baseline.
- Focused account/Auth/RLS validation:16 pass, zero failures or skips.
- Nuxt typecheck, isolated production build and `git diff --check`: pass.
  Node22.23.1, empty dotenv and an explicit clean environment were used.
  Existing checkout build outputs and dependency tree were preserved.
- Hosted multi-customer browser/Auth/email/provider/fulfillment acceptance remains
  unverified. No production writes, provider transaction, deployment or Git push.

Next release candidate: the two account Vue files and their focused tests/docs,
application only, schema91 unchanged, with all current purchasing/provider/signup
gates held and the exact signed callback ingress preserved. No sealed deployable
archive or new approval seal was produced by this focused assessment. A later
release preparation must bind the exact source/archive, target, retained assets,
fresh preservation evidence and rollback limits before owner deployment approval.

Continue one feature at a time: finish cart/checkout session isolation in Phase1;
then configure a truthful manual delivery option or implement genuine pickup in
Phase2; prepare separately authorized multi-customer real acceptance in Phase3.
The present one-customer grant cannot authorize several customers. Extend the
generic bounded acceptance policy separately, or qualify a private access layer
that restricts every mutating checkout/payment route as well as pages. Do not
open the global gate to circumvent the one-customer contract.
Phase4 public activation requires successful acceptance and explicit owner approval.
Coupons, automated refund/cancellation and gateway management remain Phase5;
the manual refund handling process is a prerequisite for broad launch.
