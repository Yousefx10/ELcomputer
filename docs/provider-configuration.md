# Existing Paymob/PDC account configuration — 2026-10-21

The owner reports that disabled release `d2d7a8029b473e4a`, schema87, passed
Dashboard, Products/images, Orders, Shipping, Quick Setup and browse-only browser
acceptance. That release milestone is complete. Do not redeploy or rerun its operator.

**Paymob BLOCKED; PDC BLOCKED: owner credentials have not been entered.**
The owner confirmed this during the configuration task. The metadata-only live
inspection also found no Paymob keys/integration ID and no PDC token/webhook secret,
merchant/pickup settings, synchronized caches or shipping company. No provider call
or credential entry was performed by the agent.

Later [offline WordPress recovery](pdc-offline-recovery.md) found the historical PDC
account, pickup details, token and compatible webhook secret in three agreeing
sources. Exact values are in the protected local owner report; credentials remain
encrypted. This supplies personal setup inputs, without changing production or
proving current account/parcel/template/registration readiness.

## Start in the existing Dashboard

Use the existing owner account at `https://elcomputer.net/dashboard/setup`.
Arabic uses `/ar/dashboard/setup` and the equivalent localized editor links.

| Quick Setup section | Existing destination | Purpose |
| --- | --- | --- |
| Commerce & Payments → Paymob → Open payment settings | `/dashboard/settings?tab=payments` | Card toggle and actual customer card fee; no key editor |
| Shipping & ERP → Shipping configuration → Open shipping settings | `/dashboard/commerce?tab=shipping` | PDC encrypted credentials, account/parcel settings, diagnostics and shipping companies |

Quick Setup's integration-selection checkbox records intent; it does not enable
the provider. Refresh reloads masked checks without contacting either provider.
Do not mark provider acceptance complete merely because credentials are saved.

## Paymob: owner-only protected server entry

1. In the existing **Paymob Accept Dashboard → Settings → API Keys**, choose
   **Live**. Obtain its Secret Key, Public Key and HMAC Secret personally. The main
   account user can access HMAC; a missing HMAC under a sub-user is not evidence
   that another key can replace it. Do not recreate or rotate an existing secret.
   [Current Paymob Dashboard](https://developers.paymob.com/paymob-docs/getting-started/new-dashboard),
   [credential guide](https://developers.paymob.com/paymob-docs/need-help/setup-guides/getting-integration-credentials),
   [HMAC visibility](https://developers.paymob.com/paymob-docs/need-help/faqs).
2. Open **Settings → Payment Integrations**, still in **Live**. Confirm the existing
   owned **online card integration**, its **EGP** currency and Intention/Pixel
   compatibility. Select its actual live integration ID. Its mode must match the
   keys. Existing active-account status alone cannot verify these properties.
   [Official Intention requirements](https://developers.paymob.com/paymob-docs/intention-apis/create-intention).
3. Use your private SSH/server console personally. The existing approved runtime
   input is **`/etc/storefront/runtime.env`**, owned by root, mode 0600. Existing
   `sudoedit`, `vi` and `nano` availability was checked without reading secrets into
   the report. For example, open the existing file with:

   ```sh
   sudo nano /etc/storefront/runtime.env
   ```

   Edit only the six Paymob settings below. Replace existing assignments rather
   than adding duplicates. Keep each value on one properly quoted line. Preserve
   Supabase, origin, encryption keys, private paths and every other setting.
   Never use a shell command containing a credential or paste the file into chat.

   | Existing setting | Owner enters privately |
   | --- | --- |
   | `NUXT_PAYMOB_SECRET_KEY` | Matching live Intention Secret Key |
   | `NUXT_PAYMOB_PUBLIC_KEY` | Matching live Public Key |
   | `NUXT_PAYMOB_HMAC_SECRET` | Existing merchant HMAC verification secret |
   | `NUXT_PAYMOB_CARD_INTEGRATION_ID` | Confirmed live online EGP card integration ID |
   | `NUXT_PAYMOB_MODE` | `live` |
   | `NUXT_PAYMOB_CARD_INTEGRATION_MODE` | `live` |

   The old API key/WooCommerce token is not the Intention Secret Key. Current
   application validation accepts matching `sk_live_…` / `pk_live_…` key shapes,
   with an optional `egy_` prefix. Do not alter a supplied key to fit a pattern;
   report only a configuration-check failure if the actual credential is rejected.
   Keep the optional wallet registry unchanged; only the existing card flow is ready.

4. Preserve these four false runtime gates and disabled Dashboard Card:

   ```text
   NUXT_PAYMOB_ENABLED="false"
   NUXT_PAYMOB_LIVE_REQUESTS_ENABLED="false"
   NUXT_SHIPPING_LIVE_REQUESTS_ENABLED="false"
   PDC_LIVE_REQUESTS_ENABLED="false"
   ```

   The existing origin must remain `NUXT_PUBLIC_SITE_URL="https://elcomputer.net"`.
   Live mode selects credentials; it does not authorize charging with these gates off.
5. Save privately and report **“Paymob file saved; not restarted”** only. A masked
   file/gate check comes before loading the changed runtime. Loading new environment
   values needs a controlled restart of the existing `storefront.service`; it does
   not need a build, migration, release-operator execution or new deployment.
   No restart or runtime write has occurred during this configuration task.
6. In Dashboard Payments, keep **Credit or debit card** disabled. Confirm the real
   customer card fee, including zero only if that is the owner's explicit decision.

Paymob credentials are server-only runtime inputs, not encrypted Dashboard fields.
The environment file is plaintext protected by root ownership/mode 0600; encrypted
release recovery is separate. Do not claim database encryption for these values.
Quick Setup returns presence/validation states, never the keys. No Secret/HMAC
value is in `runtimeConfig.public`. The officially public key is used later only
by the owned payment flow; no payment flow is started by this task.

## Paymob callbacks: prepare a controlled cutover

In **Paymob → Settings → Payment Integrations → the confirmed Live EGP card
integration**, the current UI calls these fields **Webhook URL** and **Redirect
URL**. Older labels may say Transaction Processed/Response Callback.

| Merchant field | Exact deployment URL |
| --- | --- |
| Webhook / transaction processed | `https://elcomputer.net/api/payments/paymob/webhook` |
| Redirect / transaction response | `https://elcomputer.net/checkout/payment-result` |
| Arabic return when selected by the application | `https://elcomputer.net/ar/checkout/payment-result` |

Register the base URLs without credentials or a made-up order ID. The application
already supplies `notification_url` and a localized `redirection_url` with its own
order selector per intention. Paymob supplies callback signature/query parameters.
The signed server receipt settles a payment; a browser redirect cannot do so.
[Official callback fields](https://developers.paymob.com/paymob-docs/intention-apis/create-intention).

Both new provider receivers are currently held by the existing public restrictions.
**Do not replace an active WordPress callback with an unreachable new receiver.**
Confirm whether that integration still serves WordPress, preserve its settings,
and defer the actual cutover until separately reviewed callback reachability.
No callback or Caddy configuration changed here.

## PDC: existing encrypted Dashboard settings

Open **Commerce → Shipping → PDC API** using the Quick Setup link above.

| Field | Owner confirms privately |
| --- | --- |
| API mode / URL | `production` / `https://clientsapi.pdc-eg.com/api/ClientUsers/V6/` |
| Company ID / Access Token | The existing account's matching identifiers and token |
| Product ID | The actual account product, later verified against synchronized products |
| Pickup city | Actual account city ID, later verified against synchronized cities |
| Pickup address / contact / phone | Real collection details; phone uses the supported Egyptian mobile form `01` plus nine digits |
| Default weight, kg | Actual parcel weight; a positive saved default does not establish correctness |
| Shipment type | **Normal (1)**; no reverse or exchange shipment |
| PDF template | The account's agreed supported template, not a guessed/default ID |
| Package opening / reject invalid batches | Actual agreed service choices |
| Status timezone | Confirm `Africa/Cairo` for the existing account |
| Webhook Secret | A separate owner-generated random secret, at least 32 characters; never the Access Token |

Keep **Enable live requests**, **Automatic booking**, **Reverse pickup** and
**PDC COD eligibility** off during credential staging. No worker/scheduler is needed
for this phase. Choose actual product/city IDs only; unknown IDs may remain unset
while the provider is disabled. Do not substitute invented IDs to satisfy readiness.

Click **Save PDC settings**. On successful save, secret entry fields clear. Reload
and expect **Token saved** and the saved-secret placeholder. Leaving a secret
replacement blank preserves it; it does not erase the existing credential.

The server validates these fields and encrypts Token/Webhook Secret separately
with AES-256-GCM using the retained shipping master key. API replies expose
presence flags, never ciphertext or plaintext. Settings require `settings.edit`;
the table retains RLS with no anon/authenticated SELECT grant. The current live
master-key readiness and those access restrictions passed the read-only check.
Do not rotate the existing master key to enter a provider credential.

PDC's future webhook destination is `https://elcomputer.net/api/webhooks/pdc`.
Confirm PDC can send **`X-Webhook-Secret`** with the independently configured value.
Do not put it in the URL or substitute the account token. Confirm actual provider
header/payload support and receiver reachability before registering/cutting over.

## Delivery coverage and prices

In the same Shipping page, use **Shipping Companies** to prepare the intended
delivery option: provider **PDC**, actual supported governorates and the explicit
**Shipping price for client**. Internal **Shipping cost** and **Return cost** are
separate confidential costs. Separate customer prices need separate existing
delivery options. Do not infer service coverage/rates from the city list.

Keep **Offer delivery at checkout** off while staging. Do not enable public checkout,
activate a new delivery option, fabricate inventory or enter an assumed free fee.
Known customer charges, pickup/parcel facts and account service eligibility need
owner confirmation before the controlled acceptance phase.

## Diagnostics and what remains blocked

| Existing check | External behavior | Local effects / current restriction |
| --- | --- | --- |
| Quick Setup Refresh | No provider request | Reads masked configuration; does not prove connection |
| Paymob configuration check | No provider request | Validates shapes, mode, integration ID and HTTPS origin locally; cannot verify merchant ownership/currency remotely |
| Payment capabilities GET | No charge or intention | Disabled/held response is not a connection test; no existing read-only Paymob connection button |
| PDC Test connection | `GET GetProducts` only | Claims a one-minute throttle and writes a sanitized admin audit; no shipment/label |
| PDC Sync cities/products | `GET GetProducts` + `GET GetCities` | Also writes the two bounded caches/timestamps; no shipping/order/inventory transaction |

Thus Test/Sync are provider-read-only, **not completely database-read-only**.
Their reviewed handler cannot call SaveShipmentEx or ExportPDF. No diagnostic has
been executed: the server outbound gate remains false. Do not enable that gate or
provider enablement just to perform a connection check under this task's holds.

The current UI also disables both buttons unless provider enablement is true,
although the protected API allows disabled-provider lookups when its server gate
is authorized. This existing UI/API mismatch is confirmed by source inspection;
no correction or redeployment was made. Before later diagnostics, review that
narrow path without turning on booking or automation. It does not prevent saving
the initial encrypted credentials with provider enablement off.

Quick Setup's overall **Incomplete** and **Connection not verified** can remain
correct after secure entry: live gates, coverage/cache checks and acceptance are
intentionally separate. Do not enable charging/bookings to force a green badge.

## Current evidence and next action

At 00:12:24 UTC on 21 October, pinned SSH and a read-only database transaction confirmed
release d2d7a8029b473e4a/schema87, runtime root 0600, no Paymob credential/ID values,
test-mode defaults, PDC encryption ready but token/webhook/account/pickup absent,
empty product/city caches and zero shipping companies. Positive parcel/template
defaults exist but are not owner-confirmed business facts. All payment/provider/
automatic/reverse flags remain off; orders, attempts, jobs and dispatches are zero.

Private metadata-only evidence is retained under
`/Users/imac/Documents/ELcomputer/provider-configuration-20261021/`.
No raw provider secret, customer/contact data or encrypted credential was selected
into the report. No production setting, service, release, Auth, inventory, provider
account, callback or shipment changed. No push occurred.

**One next action:** personally complete the private credential-entry steps and
report only **“PDC saved”** and/or **“Paymob file saved; not restarted”**. Then verify
masked loaded/on-disk configuration and the retained holds before any runtime reload.
Provider-read-only connection checks remain a separately gated step; no real charge
or shipment is authorized.

After provider configuration, the required workstream remains WordPress customer
identities/old-login compatibility, private names/phones/profiles, billing/shipping
addresses and historical orders. Preserve existing Auth UUIDs, prevent duplicate
identities and historical commerce side effects. Keep unrestricted signup closed.
Then complete controlled payment/shipment acceptance with real stock, agreed fees,
parcel settings, customer access and callback reachability before public checkout.
