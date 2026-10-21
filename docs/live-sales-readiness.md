# Paymob and PDC controlled-sales readiness — 2026-10-21

The [disabled production release](live-sales-release-receipt.md) passed with
schema87, reusing both existing integrations and Quick Setup. Owner browser
acceptance passed. Follow the [private account-entry guide](provider-configuration.md).
PDC credentials/settings are saved. The owner reports verified LIVE Paymob inputs
saved in root0600 runtime.env. The
[owner-only validator](paymob-owner-validation.md) is prepared; production validation
and any later controlled restart decision remain pending owner result lines.
[Offline Paymob recovery](paymob-offline-recovery.md) supplies protected historical
LIVE/TEST keys, HMAC and EGP card IDs; the owner reports current verification and
personal entry. No agent production credential copy or provider request occurred
in recovery. Read-only validation does not prove merchant payment acceptance.
[Masked saved-state verification](pdc-connection-paymob-preparation.md) passed.
The [approved one-run PDC exception](pdc-readonly-diagnostic-receipt.md) is consumed:
GetProducts returned HTTP500, then stopped. GetCities was not attempted.
Connection remains BLOCKED; saved product/city IDs are not remotely validated.
All persistent provider/payment gates remain off. No shipment or payment request ran.
Historical PDC account/pickup inputs and encrypted credentials were subsequently
[recovered offline](pdc-offline-recovery.md). Currentness and provider acceptance
remain separate; production settings were not populated automatically.
The owner accepted all six customer-access pages; that milestone stays closed.

## Existing implementation retained

Paymob already had Intention creation, Pixel, private attempts/transactions,
owned order/status APIs, signed callbacks and duplicate settlement protection.
PDC already had encrypted settings, Test/Sync, city/product caches, editable
destination/status mappings, booking/PDF transport, tracking and webhooks.
Quick Setup links to those editors and records configuration/acceptance evidence.
It is not a second secret editor or an activation switch.

## Corrections

- Migration86 extends the existing confirmed-customer, physical-stock,
  price/coupon and delivery quote/command transaction to normal card orders.
  Delivery and method fees are included before payment. Backorder configuration
  cannot bypass received stock. Old card orders are not attested retroactively.
- Matching test/live keys and integration modes are accepted. Live initiation
  additionally requires `NUXT_PAYMOB_LIVE_REQUESTS_ENABLED=true`, default false.
  SQL binds live attempts to the verified checkout. Existing attempt uniqueness,
  fixed-decimal totals, signed transaction matching and test isolation remain.
- Closing outbound payment gates does not discard valid signed callbacks.
  Keys, origin, mode and integration must remain configured for outstanding
  receipts. Browser redirects never settle payment. A paid gateway receipt is
  separate from merchant bank payout; it does not invent a treasury cash receipt.
- Migration87 adds an explicit `manual`/`pdc` shipping-company binding and a
  separate PDC COD-eligibility setting, both conservative by default. Checkout
  checks the selected PDC account/product and exact synchronized destination.
  Existing configured customer prices remain authoritative. No carrier rate or
  service coverage is inferred from a list of city names.
- Booking requires a ready-to-deliver order, completed private VPS packing/video
  evidence, allocated serialized units, current delivery eligibility and staff
  authorization. Normal COD supplies the ledger-consistent collectible balance;
  card supplies zero only after an exact successful LIVE payment receipt.
- Explicit Dashboard booking works with automation off. It confirms the action
  and sends one booking request. A durable dispatch record, stable order reference,
  leases, configuration binding and tokens prevent duplicate POSTs, including
  lost acknowledgements, concurrent requests and missing/reset job rows.
- Ambiguous booking becomes `uncertain`. Recover booking queries the original
  REF and requires one exact provider match. It never accepts a browser AWB or
  repeats booking. Missing/ambiguous lookup requires carrier/operator resolution;
  this release has no force-rebook shortcut. Known AWBs retry only PDF retrieval.
- Normal and reverse shipping PDFs now persist exclusively on the VPS. Private
  0700 directories, 0600 files, opaque order/claim keys, bounded PDF validation,
  publish-once writes, stored hashes/sizes and authenticated downloads replace
  Storage upload/download calls. No public product-image route serves them.
  Reset cleanup uses explicit private-file manifests; dispatch barriers survive.
- Existing PDC tracking, secret verification, financial/COD/fulfillment guards,
  Auth/RBAC/RLS and Quick Setup evidence boundaries remain. Automatic booking,
  reverse collection, SMS and unapproved payment methods remain off.

## Exact owner inputs

Use `/dashboard/setup` to open the existing destinations below. Do not paste
credentials into chat, Git, screenshots or acceptance reports.

| Existing destination | Owner supplies/confirms |
| --- | --- |
| Paymob merchant Dashboard | Matching live Secret Key, Public Key, HMAC secret and the owned **online EGP card integration ID**. Confirm that integration's mode/currency and existing WordPress callback ownership. |
| Application Dashboard → Settings → Payment methods | Card enablement and the explicit customer card fee, including zero. Keep it disabled through the disabled release. Keep PayPal, wallets, transfer and InstaPay off. |
| PDC / Commerce → Shipping → provider settings | Access Token, Company ID, production/test mode, chosen synced Product ID, pickup city/address/contact/mobile, actual parcel weight, normal shipment type **1**, agreed PDF template, package-opening/validation choices and an independent callback secret of at least 32 characters. Never use the Access Token as that secret. |
| Existing PDC Test/Sync and mappings | Sync the account's cities/products after an approved read-only provider check; select returned IDs. Confirm exact governorate/city/Arabic aliases and supported services. Account/token/mode changes invalidate caches. Confirm tracking status mappings/timezone and callback format with PDC. |
| Shipping Companies | Select provider **PDC**, activate the intended delivery option, explicitly set checkout governorates and customer delivery charge, including explicit zero. Separate delivery prices use separate existing options. Internal carrier/return costs remain private. |
| PDC enablement | Explicit COD eligibility only if the account/contract supports it. Leave automatic bookings and reverse pickups off for first acceptance. Provider enablement alone cannot open the server outbound gate. |

Paymob secrets currently belong in the existing protected server runtime; Quick
Setup does **not** accept them. The operator sets `NUXT_PAYMOB_SECRET_KEY`,
`NUXT_PAYMOB_PUBLIC_KEY`, `NUXT_PAYMOB_HMAC_SECRET`,
`NUXT_PAYMOB_CARD_INTEGRATION_ID`, `NUXT_PAYMOB_MODE` and
`NUXT_PAYMOB_CARD_INTEGRATION_MODE` from the owner's secure configuration.
The API key used by older integrations is not substituted for the Intention
Secret Key. Matching key/integration modes are required by the
[official credential guide](https://developers.paymob.com/paymob-docs/need-help/setup-guides/getting-integration-credentials)
and [Intention API](https://developers.paymob.com/paymob-docs/intention-apis/create-intention).

The operator retains the existing shipping encryption key. Configure a dedicated
absolute `NUXT_SHIPPING_DOCUMENTS_DIR` outside the application/public uploads,
owned by the Nuxt service user with 0700 permissions and an exact systemd write
exception. No new key rotation or decoder installation is needed.
`NUXT_PAYMOB_ENABLED`, `NUXT_PAYMOB_LIVE_REQUESTS_ENABLED` and
`NUXT_SHIPPING_LIVE_REQUESTS_ENABLED` stay false for the release. Preserve the
existing false `PDC_LIVE_REQUESTS_ENABLED` fallback. A shipping worker secret and
scheduler are needed only for a later explicitly approved automated workflow.

Quick Setup reports configuration separately from provider connection and owner
acceptance. Saved keys/caches/path presence are not proof of working payments,
coverage, disk persistence, a reachable callback or a running scheduler.

## First controlled purchase prerequisites

1. The [disabled release and owner browser acceptance](live-sales-release-receipt.md)
   passed. Migrations86–87, the exact application and private document runtime are
   deployed; native Linux/systemd sandbox and read-only release checks passed.
   Continue [secure private provider configuration](provider-configuration.md).
2. Physically verify saleable SKUs and receive actual units through existing
   procurement/inventory. Select active warehouses. Do not edit the original
   imports to fabricate stock. Last production observations showed no saleable
   units; this local task did not refresh or change production data.
3. Enter confirmed delivery areas, customer charges and actual PDC service/parcel
   settings. Validate read-only account lookups before enabling booking. PDC city
   lists are not rate quotes; confirm payer, fees and COD deductions with PDC.
4. Use an approved confirmed existing customer identity and functional customer
   login/recovery. Public signup remains disabled. Decide identity matching with
   the required WordPress migration before opening registration broadly.
5. Review narrow acceptance access and provider callbacks separately. Current
   checkout/login/payment/worker ingress restrictions remain intentionally held.
   The disabled application release changes no Caddy route. Permit only the
   controlled customer/payment flow and exact authenticated booking/label APIs
   when separately approved; never expose private directories or broad APIs.
6. Configure the owned merchant integration securely and verify callback receiver
   reachability **before** enabling a live session. For this deployment the
   Paymob callback is `https://elcomputer.net/api/payments/paymob/webhook`; the
   return is `https://elcomputer.net/checkout/payment-result` (Arabic supported).
   PDC uses the existing `/api/webhooks/pdc` and its independent secret. Preserve
   any WordPress integration still in use; do not overwrite it blindly.
7. Owner separately approves one controlled real payment and one shipment,
   including amounts, product/quantity and recipient. Keep public access and
   automatic shipments closed. Payment success requires the signed server
   receipt, never a return-page message. Verify failure/duplicate handling with
   approved synthetic/replayed receipts, without creating extra live charges.
8. Scan/record/complete packing, explicitly book once, verify the provider REF/AWB,
   persist and download the private label, and check tracking. On uncertainty,
   recover by REF; do not click Book repeatedly or create a replacement order.
   Record evidence without customer PII, provider bodies or credentials.
9. For COD, delivery is separate from cash receipt and treasury reconciliation.
   Use the existing guarded normal-COD receipt/remittance workflow; no webhook
   or dispatch status may mark cash paid. Gateway payout/fees likewise remain
   separate accounting events; automatic merchant payout import is not added.

## Evidence and limits

See the final handoffs and candidate record for exact test counts and hashes.
Tests use disposable native PostgreSQL/PGlite, synthetic received inventory,
generated packing media, real local private files and mocked provider transport.
They cover trusted card totals/stock/identity, signed receipts while paused,
payment races, PDC delivery/payment/packing gates, duplicate booking/REF recovery,
PDF retries, authorization, file integrity and populated85→87 preservation.
The existing [official HMAC contract](https://developers.paymob.com/paymob-docs/developers/webhook-callbacks-and-hmac/hmac/hmac-transaction-callback)
was checked against the retained field ordering and SHA-512 verification.
These implementation tests do not establish live credentials, Pixel/3DS, merchant
charging, carrier booking, hosted RBAC, browser writes or production file behavior.
The later [release receipt](live-sales-release-receipt.md) separately records the
actual Linux/systemd sandbox and private-file probe. Merchant acceptance is pending.

Old Storage label references fail closed without VPS hash evidence. Preserve
their records/objects; review a separate explicit transfer or regeneration plan
if upgrading another deployment with existing labels. No fallback serves old
private objects. There are no new remote uploads of any shipping document.

## Required next launch workstream

The [WordPress migration plan](wordpress-customer-migration.md) follows provider
readiness: identities, login
compatibility, names, phone numbers, billing/shipping addresses and orders.
Inventory authoritative sources and stable legacy customer/order keys first.
Match existing Supabase Auth identities safely; never create a second identity
because a profile/contact email differs. Legacy password compatibility needs a
reviewed verifier or reset path, not plaintext/password-hash copying into Auth.
Historical order import must never invoke checkout, stock allocation, payment,
booking, notification or fulfillment triggers. This workstream remains required
for launch and was not replaced by the current feature.
