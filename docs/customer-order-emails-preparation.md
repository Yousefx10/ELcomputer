# CX-EMAIL-01 — customer order email preparation, E136

29 October 2026. **FIRST INCREMENT LOCAL PASS / OFF / NOT DEPLOYED.**
Customer email delivery and activation are not qualified. No production change,
external support message, provider request or real email occurred in this task.

## Provider dependencies

Both requests are ready for owner-approved forwarding and remain **NOT SENT**:

- [PDC request](pdc-cod-unit-confirmation-request.md): for EGP200.35, confirm whether
  `shipments[].cod` is `200.35` or `20035`, accepted precision/rounding and production
  account/service applicability. PDC must collect the full final balance, including
  EGP50 delivery plus EGP50 COD fee. COD remains off; the original uncertain booking
  stays quarantined. Unit confirmation does not authorize booking or activation.
- [Paymob request](/Users/imac/Documents/ELcomputer/paymob-paid-control-shape-refresh-20261029/PAYMOB-HISTORY-CONTRACT-REQUEST.md):
  supported complete one-order transaction-history schema/route, completeness and
  pagination, merchant/mode/integration bindings, and independent checkout-session
  terminality/late-settlement semantics. The matched paid-control response lacked
  `transactions` and the seven checked history fields. The bounded audit is consumed.
  Both previous uncertain payment outcomes remain unverified; Pay Again stays off.

No inquiry is repeated. Draft and consumed-receipt hashes are retained in the private
`customer-order-emails-20261029/provider-draft-receipt-bindings.json` packet.

## Existing capability, inspected on the deployed source

The installed Email foundation already provides private transactional/marketing
separation, encrypted application-provider settings, named staff permissions,
EN/AR escaped HTML/text, revision-bound intents, stable UUID idempotency, a central
worker/attempt ledger, final-dispatch checks and authenticated provider-event handling.
Ambiguous sends remain uncertain and are not automatically resent. Provider acceptance
is separate from delivery. Claims already use that foundation; no new transport is needed.

The existing `payments/customerNotification.js` prepares truthful customer copy and
stable identities. It had no event capture, queue hooks or outbound behavior. The
SMS order-event ledger is channel-specific and is not reused as email delivery history.

Fresh read-only production inspection found Email revision0, provider/marketing/
webhooks off, no application API key, approved sender, saved template, message,
attempt or event. The independent worker secret is absent. Encryption-key presence
was checked as a boolean only. **Supabase Auth SMTP was not inspected or accessed.**

Owner supplied the proposed From identity **ELCOMPUTER <info@elcomputer.net>**.
This is operational configuration, not an application-code constant. Provider sender
verification is unproven. Owner confirmed a private mailbox for one controlled test.
Its address is kept only in the private test packet, never application code, fixtures
or customer recipient defaults. Naming it is not approval to send.

## Smallest implemented increment

Local source `444c8fd`, branch `local/customer-order-emails-20261029`, is based directly
on deployed `8d75404`. It occupies a new34th worktree; all33 prior worktrees remain.

| Event | Truthful content and qualification |
| --- | --- |
| Order received, CARD | Order saved; payment not confirmed. Suppress a stale awaiting-payment receipt after settlement/cancellation. |
| Order received, COD | Cash not collected; order awaits staff review. Display the saved final total. This does not activate COD or claim collection. |
| Payment verified, CARD | Matching live succeeded attempt and exactly one successful private transaction, exact amount/currency, coherent paid balance/timestamps. Test signals, redirects, expiry and shipping status cannot trigger this message. |

The new capture ledger is a business-event source feeding the existing Email queue.
It uses one immutable `(order,event)` identity and locale snapshot. Duplicate updates,
concurrent workers and lost enqueue acknowledgements cannot create another message.
Enqueue and linkage commit atomically. Recipient/context and lease are checked in SQL;
browser roles cannot read events or execute worker/configuration RPCs.

The candidate **104** migration is
`20261029120000_customer_order_email_notifications.sql`. Production history is103,
ending `20261029010000`;104 is proposed only. It adds two private/RLS tables,
default-disabled configuration, scoped capture/preparation functions and a final
dispatch extension. Existing Claims, recipient safety and queue rules remain in the
delegation chain. No historical scan, data backfill, provider activation or sendable
backlog is created. A disabled provider or order-email gate captures nothing sendable.

Only new ordinary built-in storefront orders with saved checkout/recipient context
are eligible. Imported/legacy rows and preorders are excluded. Bad recipients and
stale/changed contexts are suppressed. Preparation is bounded; actual sending stays
with the existing queue. Notification capture errors log a sanitized SQLSTATE and
cannot undo checkout or payment settlement. Such a missed notification needs staff
review; no exactly-once external-delivery guarantee or historical resend is claimed.

Fulfillment/cancellation emails, COD collected/remitted notices and recurring payment
reminders are **not implemented by this first increment**. They remain requirements
inside CX-EMAIL-01. Each must use its authoritative milestone and independent money
evidence. An AWB/booking is never payment or proof of delivery.

## Local qualification and limits

- **31 focused checks PASS,0 skips**, including independent PostgreSQL17.11 workers,
  replay/lost acknowledgement, wrong recipient/token, worker revocation, disabled
  capture, no backlog, verified/test-payment distinction, uncertainty and retention.
- **Typecheck, build and diff checks PASS.** Existing local missing-Supabase-config
  and duplicate-ERP-import warnings remain; no production secrets were supplied.
- Native migration/transaction rollback proof preserved **142 existing table data/
  security projections and383 unrelated function contracts**. Original Email/reset
  bodies remain delegated; order capture defaults off, historical backfill0.
- [Six local EN/AR previews](/Users/imac/Documents/ELcomputer/customer-order-emails-20261029/previews/index.html)
  cover CARD receipt, verified CARD payment and uncollected COD. References/totals/
  recipients are synthetic. These are not sent emails or owner visual acceptance.

The local reset-policy check has three **pre-existing** unknown tables on103:
`private.delivery_location_cities`, `private.delivery_location_governorates` and
`public.customer_delivery_addresses`.104 introduces zero additional unknown tables.
That reset planner remains fail-closed; it was not broadly repaired in this feature.
New notification history also has immutable/FK deletion protection and a retention
blocker. This is a local reset-compatibility limitation, not evidence of a Beta outage.

No hosted email, provider acceptance/delivery, sender/DNS verification, scheduled
worker or authenticated email-management acceptance was exercised. Full release
packaging, production migration preflight and a controlled send remain separate.

## Minimum remaining implementation/release plan

1. Prepare a guarded **inactive**104/application packet on the then-current baseline.
   Recheck migrations, backup/readback, CARD, callbacks, MON and original kill budget.
   Keep provider, order-email capture, worker scheduling, marketing and webhooks off.
   Apply only after a fresh exact owner approval. No real-order backfill or mail.
2. Configure a separate application Brevo API key privately through the existing
   encrypted Email settings. Verify the owner-selected sender/account and choose
   an owner-controlled test recipient. Never copy/extract Auth SMTP credentials,
   paste secrets in chat or enable marketing/Claims/monitor emails as a side effect.
3. Prepare a separately approved **single** controlled email test. Bind its recipient,
   From identity, reviewed content, expiry, one stable intent and one dispatch budget.
   Verify acceptance, actual mailbox delivery, sender/reply-to, EN/AR rendering and
   duplicate suppression. Stop on uncertainty; never resend blindly.
4. After acceptance, prepare a fresh scoped order-email/worker activation approval.
   Process only future qualified events. Preserve MON's own timer, reports, dedup
   history and emergency budget. Add the remaining order milestones one at a time.

No deployment, configuration, test-send or activation approval is issued now.
**ONE next action: qualify the separate application credential and sender privately.**
From identity and test-only recipient are confirmed. The private one-message test
scope is prepared, but has no approval, expiry or configured key. Secure configuration,
preflight and fresh exact approval must precede that test. All customer email stays off.

## Current Beta health

At11:59Riyadh, production remains **9aa61b64c2c5cf9f/schema103**, app72557/Caddy26652,
fixed runtime/config files unchanged. CARD/Manual EGP50 remain live, COD off/PDC paused.
MON's11:55:05.632 automatic scan is complete and active: **WARNING5/critical0**.
One additional overdue-unverified warning appeared during this task. All four prior
fingerprints remain; now two overdue and three terminal warnings. No outcome is
resolved or inferred. Financial/signed-success/duplicate/ownership mismatches are0.
The original emergency budget remains1; two historical journal gaps remain retained.

No production writes, provider calls, email sends, order/fulfillment changes, monitoring
reset/restart or Git push occurred. Address-book/location/navbar owner acceptance stays
pending. DTR-33, STOR-01 and every deferred test remain preserved.
