Current update: [EGP2 restricted checkout is active](owner-checkout-egp2-active-receipt.md).
It expires22:27:56.541 Riyadh today,23October. The owner completes normal payment.
Opening approval is consumed; closure remains approved. No payment or booking initiated.
The EGP101 grant stays revoked. Earlier preparation/activation text is historical.

Current update: [EGP2 replacement approval is required](owner-checkout-egp2-readiness.md).
The owner changed customer delivery to1; intended item1 + delivery1 + card0 = EGP2.
The incompatible EGP101 grant is revoked. Signed callbacks/owned reads remain open.
No orders or payment attempts exist in the inspected application records.
Public purchasing stays closed; earlier activation/preparation text below is historical.

Current update: [restricted owner checkout is active](owner-checkout-active-receipt.md).
The one-hour window expires22:27:56.541 Riyadh on2026-10-23. Public purchasing stays off.
Data setup and opening are consumed; owner completes normal checkout personally.
No charge/booking was initiated. Closure and late-event reconciliation remain pending.
Before any separately approved booking, verify Ramses10 covers the actual Al Azbakeya address.
Earlier preparation and approval text below is historical.

Current update: [Ramses ID10 is verified](pdc-ramses-egp101-readiness.md).
The encrypted capture is consumed; missing cityID/cityName aliases caused rejection.
The owner-authorized profile city update is complete; all other address fields remain.
Fresh actual-validator and both-line checks pass. EGP101 setup/access approval is next.
No additional provider GET, cache/rate/gate change or app deployment is required now.
Public purchasing remains closed. Earlier evidence below is historical.

Current update: [the single GetCities lookup is consumed](pdc-city-lookup-receipt.md).
HTTP200/valid JSON failed later city validation; no authoritative ID was accepted.
The limited receipt cannot isolate the failed check. No retry or data/gate change occurred.
One encrypted-capture diagnostic is prepared but needs fresh approval.
The saved profile remains valid; owner-approved delivery100/total101 are preserved.
Carrier cost stays a separate booking requirement. Production remains0ea60833a5071f27/schema91.
Owner checkout remains BLOCKED pending city evidence and exact setup/access approval.
Earlier inspection/proposal text below is retained as history.

# Normal owner checkout — BLOCKED, 2026-10-23

The owner will complete the normal customer journey personally:
sign in → My Account → Cart → Checkout → Paymob → Dashboard packing.
PDC booking follows a separate approval. Codex must not enter an address,
create an order, initialize a payment, submit a card or mark an order paid.

This supersedes the separate controlled-purchase page proposal in the
[earlier readiness handoff](controlled-purchase-readiness.md) and the
[earlier transaction packet](tariff-deployment-and-first-transaction.md).
Historical plans, approvals and receipts remain preserved.

## Current checks

Production database inspection used a repeatable-read, read-only transaction.
The runtime check verified saved/loaded configuration and exact release bytes.
Public probes used GET only; no live callback POST or provider API was sent.

| Required result | Current evidence |
| --- | --- |
| Authorized account | Owner selected `i***@elcomputer.net`. Latest inspection found it active, confirmed and nonanonymous, with a customer profile. Its internal flag grants no checkout bypass. No purchase grant is active; account selection approves no preparation, access, payment or booking action. |
| Saved address | One saved profile address exists, including line 2. Its phone fails the required Egyptian mobile format. Exact governorate/city mapping count is zero. Country is Egypt. Full details were not printed or copied into this document. |
| My Account management | Profile read/upsert exists under own-row Auth/RLS. Live `/login` and `/account/profile`, including Arabic routes, return403. Successful owner browser loading/saving has not been established. |
| Address continuity | Normal checkout prefills line 1, city, governorate and phone, but drops the populated line 2. This needs a small correction that also avoids duplicating or overwriting address lines during the post-order profile update. |
| Normal purchasing restriction | The deployed grant is consumed only by `/account/controlled-purchase` and its separate API. Ordinary Cart/Checkout and payment initiation do not enforce that grant. Opening their Caddy routes alone cannot provide the requested account restriction. |
| PDC option and fee | Company is active, checkout is disabled, governorates are empty. Stored customer fee is EGP10; this is not an approved customer price or confirmed merchant carrier quote. |
| PDC mapping | Saved product40/type1, pickup10 and destination need authoritative cached lookup confirmation. Both product/city caches are empty;382 aliases alone do not establish live coverage. |
| Paymob | Live configuration was previously qualified. Fresh runtime hashes and loaded values are unchanged. Global initiation gates remain false. Signed callback code exists, but Caddy currently holds its POST path. Merchant entitlement, minimum and real callback acceptance remain unverified. |
| Payable amount | Not approved or ready. Current arithmetic is EGP1 merchandise + EGP10 stored delivery + EGP0 card fee = EGP11, before any discount; that is not a usable checkout quote. |
| Production effects | Schema91/release `08b45ffac0e524c8`; zero orders, attempts, transactions, shipment jobs and dispatches. No production write, provider call, application rebuild or Git push occurred during this inspection. |

The [tariff deployment](shipping-tariff-deployment-receipt.md) remains complete.
Its seal is consumed. Its artifact, source and migration are unchanged.
Both tariff tables remain unimported; the supplied tariff package stays editable,
unverified and inactive, with no fabricated effective date or checkout reader.

## Small normal-flow correction required

Preparation/read-only authorization does not authorize another application
deployment or production purchasing activation. No application code was changed
in this inspection. The next local correction is limited to these contracts:

1. Reuse the existing private, default-off customer/product/variant/quantity1/
   company/address/amount/window grant on normal storefront surfaces. Keep
   global purchasing and live-provider switches off. Ordinary Auth/RLS still apply.
2. Enforce it on every normal quote/order/payment entry, including other payment
   methods. Hiding buttons or checking Caddy cookie/header text is insufficient.
   Supply account-scoped card capability through authenticated requests.
3. Use the owner's normal browser cart, normal saved address and existing quote/
   durable command protocol. Bind one durable cart identity without assistant
   order creation, manual address entry, a special checkout page or a second-order
   escape through another tab/cart. Never replace unresolved checkout recovery.
4. Carry both saved address lines through review, durable order and provider
   payload; preserve the profile without duplicate lines or collateral changes.
5. Preserve normal explicit Paymob initialization, owned receipts and status
   polling. Viewing a page must not initiate an intention. Enforce exact order,
   amount, account and time checks before any provider call.
6. Qualify expired/revoked/other-account/changed-cart/address/fee scopes, repeated
   submissions and uncertain acknowledgements. Test both configured deployments,
   EN/AR and existing public-purchasing behavior without owner special cases.

Use targeted tests and a separately reviewed inactive application release.
Do not rebuild, modify or redeploy the completed tariff artifact. Full gateway,
multi-carrier, subsidy and loyalty work is not a prerequisite.

## Owner address access preparation

A separate local Caddy candidate adds only GET/HEAD for EN/AR `/login` and
`/account/profile`. Existing authentication and own-profile RLS remain unchanged.
It exposes the existing sign-in page; it does not authenticate a particular user
or change anyone's permissions. Every purchasing/payment/callback/worker hold and
the existing account/support/dashboard rules remain byte-for-byte preserved.

Private candidate: `../normal-owner-checkout-20261023/account-access-candidate/`.
Baseline SHA256:
`504191ccdc985084cf9aa0bba4fc36b7cf2bcae7405af95abce469d56bd81558`.
Candidate SHA256:
`7374a3e2c8e889f97eec41134626d6fe5e65c17d71402e2c3fa1afbb9fef6663`.
It is not installed. Caddy-only access needs its own explicit approval and fresh
target/process/configuration checks, backup, remote validation and one bounded
activation. `admin off` requires the reviewed Caddy restart procedure. This is
not purchasing activation. An uncertain activation stops for inspection.

The exact copy passes Caddy adaptation and70 local proxy checks across two
independent fixture hostnames. These test method/path holds, authorization
forwarding and private caching; they do not test a live owner profile save.

The [next authorization packet](/Users/imac/Documents/ELcomputer/normal-owner-checkout-20261023/AUTHORIZATION-PACKET.md)
binds this account-only candidate and the two local normal-flow corrections.
Proposal SHA256:
`5d3181a2382ee4812b6fc0cf21d1759abfd2bb41d12b6dd77f92949a40c4aac9`.
It authorizes neither application deployment nor purchasing/payment activation.
The owner's later account-selection reply is recorded separately in private
`owner-account-selection.json`. The sealed proposal remains unchanged and unapproved.

After that access is authorized, the owner signs in and corrects the saved
address privately in My Account. Read-only checks can then derive its hash and
match its exact destination. No full address, password, token, serial or card
information needs to enter this conversation. Own-profile RLS inspection and
local proxy tests are not proof of a successful live owner save.

## Remaining activation packet

The final purchasing packet is **not executable or approvable yet**. It must bind
the confirmed account, owner-chosen product/model, one real unit, normal cart,
saved-address hash, verified PDC pickup/destination IDs, approved customer fee,
exact gross EGP amount, expected merchant charges and a UTC window of at most
one hour. Actual parcel facts and declared value stay in Dashboard/private records.

PDC preparation needs one separately authorized GetCities-only request if its
existing evidence cannot resolve the route. Reuse the accepted GetProducts
evidence; Dashboard Test/Sync would repeat it. Cache/mapping/company/settings
changes need exact reviewed deltas. Do not guess suburbs or turn on draft tariffs.
Checkout currently also requires PDC settings enabled and validated caches;
this must be distinguished from outbound booking permission. Keep automatic
booking, COD and reverse disabled, and outbound PDC runtime gates off until the
separate booking approval.

The future opening Caddy policy must enumerate normal Cart/Checkout/payment
pages, authenticated scoped quote/order/capability/intention APIs, owned order/
status reads and exact POST `/api/payments/paymob/webhook`. Its application guard
must already reject anonymous users, other accounts and out-of-scope commands.
Keep signup, unrelated commerce methods/routes, PDC webhook and workers held.
Do not install the obsolete special-page candidate.

Gate activation, the owner's one real Paymob submission, and one PDC booking
remain separate approvals. Codex never submits the card or books on implication.
Only after the required release, profile/mapping/price checks and limited access
approval pass may the status become **READY FOR OWNER CHECKOUT**. Then instruct
the owner to open the storefront and complete checkout personally.

## Payment, shipment and closure acceptance

Paymob's [Create Intention documentation](https://developers.paymob.com/paymob-docs/intention-apis/create-intention)
specifies the total in cents and matching live integration credentials. It does
not establish this merchant's minimum. The application accepts EGP1 as100 minor
units; this is not proof Paymob accepts it for this merchant. The submitted amount
is the final order total, including approved delivery and fees. Minimum/entitlement
confirmation or explicit one-attempt acceptance of that uncertainty is needed.
TESTproduct2026 is published, normal-sale and has an active serialized variant.
Fifty structural stock records are not proof of fifty physical units. The owner
reports one real unit. Current booking declares net merchandise EGP1; confirm
that value privately against actual goods and carrier terms before booking.
If it cannot be used truthfully, select/configure another genuine item.

The owner must review the exact total and explicitly initiate Paymob in the
normal payment page. Signed SHA512 callback verification and durable reconciliation
decide paid status. Neither redirect fields nor manual staff marking may do so.
Verify the matching live attempt/transaction and order amount/currency before
calling the payment passed. Do not blindly retry an uncertain intention or card
outcome, including a provider result whose local persistence failed.

Close new order/payment initiation while retaining exact signed callback POST
ingress, its keys and authenticated owned receipt/status reads. Grant expiry and
outbound closure must not drop late signed receipts. Do not use an arbitrary
callback cutoff. Resolve original references and provider evidence; missing
intention persistence requires a separate reviewed repair/redelivery procedure,
not a second charge or automatic provider query.

The owner then confirms and packs the paid order through Dashboard. Existing
packing scans, actual serialized allocation and validated private VPS packing
video are required by the booking guard. Separately approve one COD0 PDC booking
for the exact order, truthful parcel, product/route and expected charges, one AWB,
private ExportPDF and bounded tracking poll. Uncertain outcomes require original
REF review; a PDF failure after an AWB permits label recovery, not another booking.

Paymob refunds/voids are **not implemented**; the callback normalizer rejects
these events. A separate release and approval must cover the original transaction,
refundable amount, provider entitlement/fees, durable request/reference, signed
reconciliation, duplicates/uncertainty and actual card credit. Portal refunds need
their own approved manual reconciliation plan; current callbacks cannot accept them.

PDC reverse shipment code **exists but is inactive and unaccepted live**.
`reverse_enabled=false`, reverse type is unset. Its separate test needs an eligible
real delivered order/claim, staff permissions, confirmed reverse entitlement/type,
pickup/destination mappings, parcel/charges, one claim-bound booking/private PDF/
poll and actual return pickup/store receipt. Preserve the original AWB/payment
history; refund, inspection and restocking have independent legitimate workflows.

The [modular roadmap](modular-payment-shipping-plan.md) remains separate releases.
Both handoffs retain the historical tariff and transaction evidence.
