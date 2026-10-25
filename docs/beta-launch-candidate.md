# Public beta candidate — 24 October 2026

Status: **BLOCKED. Local candidate only. No deployment or activation approval.**

Production remains `58e3083f4aa6a1f8`, schema91. Current read-only inspection
confirmed healthy Nuxt, closed purchasing/provider gates, disabled signup and
email confirmation enabled. Two confirmed, active customer profiles exist.
The second account has no admin record. Normalized Auth emails have no duplicates.
The owner reports account switching passed; this is owner-reported acceptance.
Hosted independent order creation remains pending. No extra account was created.

The working copy at `ELcomputer/` is older than production. This candidate lives
in an isolated worktree at `../beta-launch-preparation-20261024/source`, based
on `6440669`. The original worktree, branch, incident records and consumed release
packets are preserved. No push, merge, reset or production mutation ran.

## Changes in this candidate

- Public beta configuration restricts checkout to CARD and the reviewed courier.
  Deployment-specific excluded product UUIDs block TESTproduct2026 before quotes,
  orders and payment attempts. The same policy checks persisted order items before
  returning or creating payment sessions. Malformed policy closes access.
- Optional private customer UUIDs and a maximum one-hour window support acceptance
  with the two existing accounts. UUIDs and time limits stay out of capabilities.
  Existing customer status, RLS, SQL ownership and permission checks still apply.
- Proposed migration92 enables ordinary CARD backorders in built-in inventory.
  Products must remain published, normal, positively priced and model-valid.
  Existing preorder/coming-soon contracts are preserved and excluded from card beta.
- A fully stocked order uses the existing atomic allocation transaction.
  A shortage makes the entire parcel an unallocated special order. It creates no
  physical units, warehouse balance, stock deduction or fictional reservation.
  The quote discloses this, with configured EN/AR delivery information and explicit
  consent. The order retains its accepted message and timestamp.
- Verified Paymob settlement marks a special order paid and leaves it on hold.
  The existing Orders permission controls physical allocation after procurement.
  Release is transactional and repeat-safe. Packing/shipping cannot start while
  stock is unallocated. No preorder deposit or alternate payment method is enabled.
- Proposed migration93 cancels abandoned unpaid card orders and restores actual
  reservations once. No-attempt orders expire after one hour. Persisted attempts
  become eligible one hour after their existing expiry. Active, paid, packed,
  dispatched or uncertain unpersisted attempts are protected. Uncertain attempts
  enter manual review. Late successful receipts retain the payment evidence,
  flag review and never fulfill a cancelled order or deduct stock again.
- A default-disabled secret protects the bounded expiry endpoint. Production
  needs a loopback scheduler and monitoring before public ordering.
- Administrators can record a genuine PDC Dashboard AWB for a paid, allocated,
  packed order. Existing packing/video, coverage, mapping and RBAC checks apply.
  The durable dispatch barrier is written atomically. Existing uncertain dispatches
  cannot use this fallback. A recorded AWB shows `label_pending`; it never invents
  a label. The existing explicit label action retrieves the provider PDF later.

## Catalog and delivery

Private `../eligible-sku-review.csv` contains239 model rows across225 published
products.223 normal products have positive prices and active models and are
backorder candidates for owner review. TESTproduct2026 and the existing preorder
product are excluded. No product was published, edited, seeded or imported.

Only TESTproduct2026 has recorded ready stock:49 units. Those entries do not prove
49 physical units and are excluded from beta purchasing. Zero recorded stock is
not a launch blocker for approved, truthfully disclosed backorders.

Use existing Product Manager filters and current-page bulk publication controls.
Review exact selected rows, preview sparse changes, confirm and retain receipts.
Do not mass-publish drafts. The CSV is a review list, not an import or publication
command. Blank SKUs remain blank; product/model UUIDs identify those rows.

PDC remains the sole company. The owner approved a configurable EGP50 customer
delivery fee. Production still stores EGP1; EGP50 is tested locally and unapplied.
The existing Shipping Company editor owns `client_shipping_price`. Carrier cost,
the store's subsidy and provider invoice VAT are separate accounting facts. None
is inferred from that customer fee or from the unverified tariff draft. Do not
import tariffs, invent a subsidy/VAT figure or add unknown costs to checkout.

The official updated city/governorate file remains missing. Before activation,
review its exact IDs against the accepted API cache, reject ambiguous/duplicate
IDs and names, and approve a bounded import/diff. Restrict offered governorates to
that result. SQL continues requiring an exact supported mapping; unrestricted
text never authorizes an unknown city. Searchable selectors remain follow-up UI.

Keep automatic labels/booking and reverse/COD automation off. Payment creates no
shipment. Admin confirms stock, packs, then explicitly books through the existing
PDC action or records an actual manually booked AWB with `ORD-<order UUID>`.
No pickup-scheduling action is introduced. Never reuse the original uncertain
order's standalone AWB or remove its original-reference barrier.

## Registration without historical migration

Beta does not import WooCommerce passwords, identities, addresses or orders.
An existing Supabase identity keeps its UUID and credentials. New customers
verify their email through ordinary Auth before buying. A legacy customer can
register a verified beta identity; historical linking is deferred. Future imports
must reserve and review mappings against those verified UUIDs and never overwrite
working credentials, profiles, roles or orders. Contact-email matches prove no
historical order ownership. Legacy password failures use normal signup/recovery;
no identity bridge, auto-confirmation or privileged profile exception is added.
This supersedes the historical full-migration prerequisite for beta only.

Public Auth settings confirm `disable_signup=true` and `mailer_autoconfirm=false`.
The management read did not establish custom SMTP, exact redirect allowlists,
effective hosted rate limits or CAPTCHA. The existing management token returned HTTP403, so SMTP configuration remains
UNVERIFIED. A fresh read-only inspection found the separate central Brevo
adapter disabled, zero approved senders, no API key and no message/attempt/event
history. That does not establish Supabase Auth SMTP state. No email was sent.
Owner confirmation and separately approved external verification/recovery checks
are required. Local `config.toml` defaults
are not hosted evidence. See [Supabase's SMTP restrictions](https://supabase.com/docs/guides/auth/auth-smtp)
and [production Auth controls](https://supabase.com/docs/guides/deployment/going-into-prod).
The separate order-email/SMS providers remain disabled; owned order confirmation
and Dashboard monitoring must work even without those notifications.

## Operations and approval sequence

Read the [manual refund procedure](beta-refund-operations.md). The merchant's LIVE
Refund/Void permission remains unverified. No refund or new charge is authorized.

Private `../activation-plan.private.json` records the accepted business inputs,
two-account identities and pending approvals. It is not executable approval.

1. Receive/validate the official city file; confirm SMTP, abuse controls and refund
   access. The owner approved the special-order wording and mixed-order handling. Review the eligible product/model CSV.
2. Qualify and seal an inactive application plus migrations92–93 release against
   the current target, with fresh backups and a matching guarded apply operator.
   Existing schema91 application-only operators cannot apply these migrations.
3. Obtain exact inactive deployment approval. Keep signup, new payment initiation,
   public purchasing and all outbound shipping gates held during deployment.
4. Separately approve a bounded normal-flow acceptance window for the two existing
   accounts. Bind private customer IDs and exclusions. Keep the payment-intention
   ingress closed for no-charge order/isolation acceptance. Preserve existing
   orders; cancel only newly approved unpaid acceptance orders through normal controls.
5. Approve public signup, CARD-only settings, existing PDC's EGP50 fee, reviewed
   destinations, backorder disclosures, expiry scheduler and staffed monitoring.
   Enable public purchasing last. Real charges/bookings need their exact approval.

During beta, check unpaid orders, successful transactions, `order_requires_review`,
uncertain intentions, expiry results and unfulfilled paid backorders every15 minutes.
An expiry result containing `requiresReview` is an alert, not a completed release.
Stop accepting orders if monitoring or reconciliation cannot be maintained.

Emergency closure disables new checkout and intentions while preserving signed
Paymob POST ingress, reconciliation keys, owned order/status reads, payment-result
pages and existing PDC ingress. Keep the expiry worker and review queue running.
An application rollback requires schema compatibility review; never roll back
customer orders, payments, inventory history or incident barriers to a backup.
Browsing-only beta can continue with signup/purchasing closed.

Evidence and exact validation results are in `../validation.json` and private logs.
Native SQL, local HTTP/browser fixtures and owner reports have separate meanings.
They do not establish a new hosted paid-customer purchase or merchant refund.

## Approved special-order disclosure

The owner approved: “Special order. We’ll confirm availability and delivery timing
before fulfillment.” Mixed orders ship together when all items are genuinely
available or sourced. Both PDP styles, Cart and Checkout show the notice before
payment. English and faithful Arabic text are provided. Dashboard fields keep
both messages editable. No date or stock quantity is fabricated.

## Exact remaining SMTP inspection

In the intended Supabase project, inspect Authentication → Email → SMTP Settings.
Confirm custom SMTP enablement, host/port, configured credentials and the verified
sender domain privately. Never paste passwords, API keys or complete mailbox data.
Inspect Authentication → URL Configuration for the reviewed production origin and
narrow login/recovery redirects. Keep signup disabled and email confirmation on.
Inspect hosted rate limits and bot-protection settings. Existing successful login
or central Brevo/domain configuration does not establish Auth email delivery.
Check retained Auth/provider delivery logs for both verification and recovery to
an external mailbox. If no delivery evidence exists, a separately approved send
is still required; this milestone authorizes no transactional email.
