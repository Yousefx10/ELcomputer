> E140,29October2026: owner prioritizes real COD shipping first, tracking second and provider-qualified payment recovery/Pixel third. This design is preserved. Detailed PDC merchant fees/net settlement/remittance/ERP panels are LAST (FIN-PDC-01/DTR-35), never booking prerequisites; basic payment/collection/receivable truth stays mandatory. [Current operations](real-cod-pdc-operations.md).

# PAY-06 — payment operations and reconciliation design

29 October 2026, E137. **DESIGN ONLY / NO PROVIDER ACTION OR APPLICATION CHANGE.**
Reusable across independent deployments; business identity and provider account
bindings come from reviewed configuration. Preserve the compact Dashboard design,
existing tables/forms, EN/AR, RTL, themes and responsive behavior.

## Navigation and bounded views

Add a compact Payments section to the existing Order detail. A separate payment
operations list may follow using the same table/filter components. Link MON-01
exceptions to the corresponding authorized order/attempt view without resetting
the monitor or acknowledging an exception as resolved.

Search is server-bounded and paginated, with explicit filters for date, order,
provider/mode, normalized state and exception. Prefer keyset pagination and an
explicit result limit. Failed requests show an error, never an empty ledger.
No full-catalog/client-side fetch, raw provider response or credential projection.

| View | Show | Evidence boundary |
| --- | --- | --- |
| Order summary | Saved gross/currency, amount paid/balance, payment method and verified payment state | Local order/financial contracts; fulfillment state remains separate. |
| Payment attempts | Local attempt ID, provider/mode/integration, intention/order IDs, safe error, created/updated/expiry and recovery reason | Existing private `payment_attempts`, explicitly projected server-side. Current unique `(order_id,provider)` allows one local attempt, not a complete provider attempt history. |
| Transactions | Bound transaction ID/status and recorded timestamps | Existing `payment_transactions`; callback-derived records only, not a complete merchant statement. Preserve multiple transaction IDs per intention without assuming all are known. |
| Callback health | Verification/reconciliation evidence, latest known processing result and callback/dedup telemetry when available | Existing signed ledger proves accepted reconciliation, not every received/rejected callback. A received-callback audit trail is not currently available and must say so. |
| Recovery | Eligible/held plus a server-derived reason and observation time | Current existing attempt, uncertain/expired state or incomplete finality means held. No Pay Again/method-change action. |
| Financial reconciliation | Gross, fee/VAT adjustments, net due, settled/remitted amount, currency, source/time and exception | Gross is local; provider fees/net/settlement stay Unknown until supported statements/API evidence is qualified. Never display missing fees as zero. |
| Refunds/voids/disputes | Known operation state, original transaction, amount/currency and evidence source | Unsupported actions unavailable. A manual reimbursement remains a separately labelled local financial record, not a Paymob refund. |
| COD | Final cash due, independently verified collection, separate Treasury reconciliation and remittance references | Booking/AWB/delivery do not mark Paid or reconcile Treasury. No inferred PDC fee deduction. |
| Audit and MON | Staff action/time, safe reason, immutable command/receipt linkage; monitor freshness and unresolved exceptions | Existing activity and monitor history. Never expose customer/card payloads, keys, tokens or HMAC values. |

No callback-reception ledger or settlement schema is added by this design. New private
telemetry/history requires a separate reviewed migration and retention decision.
Do not allocate a replacement104 migration number; the local email104 candidate is
preserved and any later migration is sequenced against the then-current release.

## Truthful states

Keep local attempt state, verified financial state, provider evidence and settlement
state as separate fields. Do not force them into one status badge:

- **Unpaid / Pending:** no coherent verified success. Initiation, client completion
  and browser return do not mark Paid.
- **Processing:** an eligible payment is in progress; display bounded server status.
- **Provider unverified:** overdue/terminal/uncertain local records cannot establish
  provider finality. Declined/expired local state cannot unlock another attempt.
- **Declined:** retain the trusted observed decline for that transaction. Another
  transaction or late success can still require reconciliation.
- **Verified paid:** coherent server-verified live callback, exact amount/currency,
  persisted attempt/transaction/order binding and paid balance. Never infer this
  from Pixel events, test signals, AWB or a provider dashboard screenshot alone.
- **Settlement unknown / due / reconciled / exception:** independent financial
  evidence. Verified Paid does not mean settled to the merchant's bank.

Provider-reported latest transaction is labelled as latest-only evidence with its
observation time. No empty/missing history array establishes nonpayment. Keep
the current exceptions and original evidence intact; do not auto-close alerts.

## Permissions and confidentiality

Reuse active staff authorization and existing permissions on every server route.
Order/attempt summaries and MON views require `dashboard.orders`. Sensitive financial
projections additionally require the applicable existing Treasury read permission;
Treasury writes retain existing `treasury.edit` and command contracts. Confirm the
registered read permission before implementation; do not invent one or treat Orders
permission as automatic access to all fees, settlements or Treasury details.

Keep browser roles denied direct private-ledger reads/writes. Return explicit DTOs,
never `select('*')` on payment attempts: that table contains a client secret. Hide
keys, client secrets, authorization material, billing/card/source-data payloads and
raw callbacks from all Dashboard responses, exports, errors and audit entries.
Provider identifiers require authorized staff context, never public order selectors.

Permission changes, stale authorization, foreign-order requests and unavailable
provider evidence must fail safely. Preserve original RLS/RBAC; no owner/account
special case. Separate future viewing from any financial-operation capability.

## Financial controls and provider dependencies

Use exact integer minor units and explicit currency for calculations. Provider fee,
tax, conversion, refund and settlement amounts require documented signs, currency,
rounding, gross-versus-net semantics and statement provenance. Compare like currencies;
show conversion separately. Reconcile gross less evidenced deductions/adjustments
against evidenced net and actual remittance; never manufacture a balancing entry.

Any future refund/void request needs supported endpoint/account eligibility, original
transaction binding, approval, per-operation amount limits, a durable unique command,
one outbound dispatch, uncertain-outcome handling and separately verified result.
Disputes and settlements need their own supported observation contracts. No such
provider action is introduced or enabled by this design.

## First safe implementation increment

After the current COD packet is qualified, implement one bounded **read-only**
order-payment projection and compact order-detail view using existing local ledgers,
MON and audit data. Show provider fields as Unknown/Unavailable where unsupported.
Do not add refund, void, retry, settlement, inquiry or provider-sync buttons.

Meaningful local qualification covers staff permission revocation, field redaction,
cross-order access, bounded pagination, no-transaction/late-success/multiple-record
projections, exact currency math, request errors versus empty results and EN/AR/RTL
responsive rendering. This design has not run those implementation tests and does
not claim hosted staff acceptance or deployment readiness.
