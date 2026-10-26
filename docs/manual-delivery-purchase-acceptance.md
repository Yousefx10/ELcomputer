# Superseded current gates — E59, 2026-10-26

Use [the minimum Beta plan](public-beta-minimum-launch.md). Owner confirmed Manual
delivery/all areas/EGP50 and physically available catalog. Housekeeping/history/
cosmetic gates are deferred. New95 untracked mode is locally qualified; the old
stock-hold-only route below remains historical. No authorization is inferred.

# Manual delivery — controlled CARD acceptance and merchant recovery

2026-10-26. **PREPARED LOCALLY; HOSTED ACCEPTANCE BLOCKED ON BUSINESS INPUTS.**
No payment, booking/shipment, refund/void, deployment, gate activation or Git push.
PDC stays completely paused; its original uncertain booking/barriers are untouched.

## Required real configuration

Use a separate existing-model Shipping Company with provider Manual. Owner must
name the real courier or own driver and actual covered governorates/cities.
The earlier customer fee policy is configurable EGP50, not the provider's cost.
Do not reuse PDC's current EGP1/Cairo test-era configuration, modify its identity,
use PDC Manual AWB recovery, request PDC files or call PDC lookups/bookings.

Prepare the company with truthful name/coverage/fee, initially not exposed for
checkout until its review. Reuse the current authorized Dashboard company form,
quote coverage check and immutable shipping identity/fee snapshot. Manual dispatch
is arranged by the merchant, with Dashboard packing/status controls; no automatic
carrier booking/label/tracking integration is promised. Staff must confirm the
actual dispatch/reference privately under a later shipment authorization.

Select legitimate published positive-price products with active models and owner-
confirmed sourcing. Zero recorded stock is permitted through deployed CARD special-
order behavior, with explicit expectations/customer acceptance; no fictitious
inventory. Missing EN/AR fulfillment text currently blocks that route. Preserve
the awaiting-stock/allocation/packing contract. Normal selling without those
holds/labels remains separate PROD-05. Actual delivery cannot be promised from
catalog publication, a test unit, saved tariff or an unavailable supplier.

## One small next acceptance, then paid/shipping stages

1. Review exact A/B ordinary customer UUIDs privately; A test address must first be
 restored, then real delivery details entered privately for the future orders.
2. Prepare two sequential≤1hour grants using existing controlled normal checkout:
 one customer/cart/product/model/quantity1/manual company/total/address hash per
 grant, payment_enabled=false, no public purchasing. Owner approves runtime/edge
 ingress and creation of these real unpaid orders before any hosted submission.
3. A reviews/creates one command; recover the same durable command after refresh/
 lost acknowledgement. B has its own cart/profile/address and order; B cannot read
 A detail or pay it, and vice versa. Existing owned receipts remain readable after
 grant expiry. No browser-success URL is payment proof. No PDC/manual shipment.
4. Stop and reconcile any unexpected response; no replacement order/intention to
 diagnose ambiguity. Verify exact order count, totals/ownership, expected genuine
 allocation or awaiting-stock state and no provider job/call.
5. After no-charge hosted acceptance, approve ONE exact hosted Paymob CARD payment
 with merchant/currency/amount/order/maximum/request budget. Verify signed callback
 and durable payment authority/idempotency; no repeated full integration audit.
 The second buyer's payment is a separate bounded action if needed.
6. Only then approve actual manual dispatch after genuine allocation/packing and
 owner-verified delivery arrangement. Never combine payment/booking/refund/public
 activation into one permission. Coupons and Dashboard redesign are not included.

Local proof8 checks PASS on native PostgreSQL17/full94/actual HTTP handlers, fake
Auth and loopback transport. Ready-stock A and zero-stock B, scoped positive reads/
foreign404, shipping snapshot/coverage, idempotent lost-ack recovery, missing-term
rejection, uncertain intention frozen at one attempt, no phantom cancellation stock,
PDC disabled/no jobs/zero external calls. It is not hosted/payment/physical-stock proof.

## Payment failure and cancellation

- Definite unpaid/no unknown remote intention: review and cancel through existing
 named Orders permissions. Stock release is transactional/repeat safe; zero-stock
 orders cannot manufacture returned units. Do not claim cancellation returns money.
- Timeout/5xx/missing acknowledgement: retain the original order, attempt and
 provider reference. Check that same transaction in the merchant Dashboard read-only.
 Do not automatically create/retry a charge or second intention. Native local test
 confirms a502 unknown result followed by409 and only one synthetic dispatch.
- Late signed payment on a cancelled order requires merchant reconciliation before
 fulfillment; preserve signed callback ingress while purchase initiation is closed.
- Before actual charge, owner must demonstrate the LIVE merchant can inspect and
 perform the appropriate refund operation. Documentation does not prove this
 account's entitlement. No old acceptance transaction is refunded as a casual test.

## Practical merchant refund/reconciliation

For a successful/captured payment, stop fulfillment and obtain approval for the
exact order, original transaction, EGP amount and reason. Check previous refunds,
remaining refundable amount and the merchant's actual permission/status. A Paymob
refund returns money to the original method, up to the captured amount; the owner
performs one approved Dashboard action. A card void is an alternative only when
Paymob shows it eligible before settlement. [Paymob Refund](https://developers.paymob.com/paymob-docs/developers/manage-payment-apis/refund),
[Paymob Void](https://developers.paymob.com/paymob-docs/developers/manage-payment-apis/void).
Official documentation rechecked2026-10-26; no merchant transaction/action performed.

Keep an append-only private record BEFORE action: operation_id, order_id,
original_transaction_id, currency, amount_minor, reason, status, provider_operation_id,
provider_confirmed_at, operator, reviewer and evidence_sha256. Record confirmed or
uncertain outcome; a timeout does not authorize resubmission. Inspect the same
original operation before any further decision. Only confirmed provider evidence
supports application reconciliation; do not fabricate payment/refund callbacks,
credit a wallet as a substitute or record the same money twice. Reuse the existing
[full operational guide](beta-refund-operations.md) and merchant accounting controls.

During controlled Beta review pending/failed/unknown orders every15min manually
until the separately reviewed scheduler is accepted. Emergency purchase-disable
must stop NEW checkout/payment initiation while keeping signed callbacks and
protected owned receipts available for late reconciliation. No worker/runtime/
Caddy or automatic provider configuration is activated by this plan.

## Not ready for an approval seal

Missing real manual delivery arrangement/areas, selected genuine products/prices/
fulfillment expectations, A address restoration and target-bound private order
inputs. LIVE merchant refund access and hosted failure/recovery/payment acceptance
also remain before public purchasing. No executable approval phrase until these
facts and the narrow runtime/edge/order scopes are concrete and qualified.
