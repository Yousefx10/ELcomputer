# Customer access and existing provider readiness — 2026-10-20

Owner-approved Caddy access correction DEPLOY PASS at 20:31 UTC.
See the [release receipt and pending browser acceptance](customer-access-release-receipt.md).
Only Caddyfile changed; no Nuxt deployment, SQL change or provider call occurred.
The PDC application correction remains local and undeployed.
Real payment/shipment activation remains BLOCKED by the specific gaps below.

The initial review started clean at `8f22448`, with `07bb18f` and `8f22448` ahead of
recorded origin/main. One worktree, no other branches/stashes or unrelated changes. Existing
unpublished work is preserved. Current deployed application remains release
`82214df492a57126`, schema 85. No migration is required for this correction.

## Exact live denial source

Read-only comparison at 18:27 UTC used the pinned SSH identity/host and current
loopback 3000. The public response body was `Unavailable`, content-type text/plain.
Nuxt returned JSON 401 `Missing authorization token.` at loopback for every row.

| Reported surface | Actual request | Public before correction | Nuxt loopback |
| --- | --- | --- | --- |
| Account Messages | `GET /api/account/messages` | 403 | 401 |
| Account Support | `GET /api/support/tickets` | 403 | 401 |
| Account After-Sales | `GET /api/account/after-sales/claims` | 403 | 401 |
| Purchased items dependency | `GET /api/account/after-sales/items` | 403 | 401 |
| Store Customers | `GET /api/customer-users` | 403 | 401 |

The original Caddy `@commerce` matcher explicitly blocked `/api/account/*`,
`/api/support/*` and `/api/customer-*` before Nuxt. Its `@dormant` rule also blocked
direct reloads of the account pages. The generic Claims error hid the same
denied request. This was the Caddy access policy, not an Auth/RLS diagnosis
or a reason to revisit the retired Nginx/VPS work.

Customer handlers already verify the bearer with Supabase, reject missing,
anonymous/inactive profiles, and constrain records by authenticated customer ID.
Claims repeat identity/ownership checks in SQL. Store Customers requires active
staff with `users.view`; its intended authorized empty state is not an error.
No authorization helper, grant, policy, profile or identity is changed.

## Narrow correction

`scripts/customer-access/policy.json` enumerates methods and anchored paths.
`prepare.py` inserts one early, matched proxy into a copy of the current config,
using the existing loopback transport. It never connects, installs or reloads.
Every original byte remains, including redirects, aliases, private-path denial,
held legacy links and the browse-only rules. Repeated application or unexpected
source structure fails closed.

The exceptions cover the three account page families, lists/details/dependencies,
existing text replies/read receipts/support/claim actions, and staff customer
list/detail GETs. Customer IDs alone confer no access. Authorization headers pass
unchanged; deferred private/no-store headers override any upstream public cache.
Real Caddy tests cover two independent store hostnames and all declared methods.

Checkout, login/signup, payments, callbacks, workers, unknown customer routes,
customer status/deletion mutations and private attachment bytes stay held.
Existing support/Claims attachment uploads still use Supabase Storage; they are
not opened by this fix. Their VPS conversion remains separate required work
before accepting attachment-dependent workflows. Text-only support and Claims
without mandatory new evidence retain their existing contracts. No file workflow
is rebuilt or silently redirected to public product uploads.

Prepared deployment-specific files, outside Git:
`/Users/imac/Documents/ELcomputer/customer-provider-readiness-20261020/candidate/`.

| Binding | SHA-256 |
| --- | --- |
| Before Caddy configuration | `f1b944bbd78b8ba100ee26ed005c08585840a38e968299c378cacdd475d91c7c` |
| Installed Caddy configuration | `a19befc25ede29546b5670c0d4a8075e4180c8e310f7e72bd2d0536dc287a169` |
| Reviewed route policy | `8b2bdcb1ed45fc3976be24a646d0d0e318d9404f5d6b68725c374313a985b997` |

The exact production copy passes Caddy adaptation. Formatting warnings do not
justify reformatting unrelated rules. The immutable restoration kit is untouched.

Owner approved this exact candidate at `c7d2079`. Execution rechecked these hashes,
current release/service identity and disabled commerce controls, preserved an
exclusive backup/intent, validated the staged candidate, atomically replaced
Caddyfile and restarted Caddy ONCE because `admin off` remains set. Original
mode/ownership and recovery file were preserved. Nuxt and schema 85 were unchanged.
The five routes now reach application 401 anonymously and with invalid tokens;
checkout/payment/worker paths remain 403. No retry or automatic recovery ran.
ONE next owner action: perform the authenticated browser acceptance in the receipt.

The PDC application correction below is local
and needs its own matching reviewed application deployment; it is not installed
by replacing Caddyfile. Do not rerun the completed commerce release operator.

## Existing integrations and credential entry

The owner already has active accounts and credentials. No new account, gateway,
shipping engine, payment UI or Quick Setup screen is needed.

| Existing surface | What it does | Configuration location |
| --- | --- | --- |
| `/dashboard/setup` | Owner-only guide, configuration links, private progress and acceptance history; no provider calls or activation button. | Existing Settings/Shipping editors remain authoritative. |
| Paymob | Server Intention request, Pixel card session, owned status/result views, HMAC callback, private attempt/transaction ledgers. | Server-only runtime keys; Dashboard Payment settings supplies card enablement/fee. Quick Setup does not store Paymob secrets. |
| PDC | Credential editor, products/cities test/sync, address/status mappings, SaveShipmentEx, ExportPDF, tracking/webhook and authenticated worker. | Encrypted `shipping_provider_settings`; existing Shipping form returns presence flags only. |
| Customer delivery prices | Existing Shipping Companies enablement, governorate coverage and explicit charge. | Admin-configured; PDC city/product lookups are not a rate quote or coverage promise. |

Read-only production configuration: all payment flags off, no Paymob runtime
credentials/integration ID, PDC disabled/auto-label/reverse off, no stored PDC
token/webhook secret/merchant/product/pickup details, no cached products/cities,
zero provider attempts/jobs/orders. There are 382 retained destination mappings and
32 status mappings. These are not proof of current account coverage. No customer
delivery option is configured and no serialized units are `in_stock`.

**Existing shipping encryption is already ready.** Its actual runtime input is
`shippingCredentialsEncryptionKey` (`SHIPPING_CREDENTIALS_ENCRYPTION_KEY` fallback
or `NUXT_SHIPPING_CREDENTIALS_ENCRYPTION_KEY` override). No replacement key is needed
for this review. Worker authorization is absent, and both outbound-live flags are
false. Only readiness booleans were read; no key, token, ciphertext or account ID
was printed. Existing Auth/products/media and original 560 imports were untouched.

### Small PDC setup correction

Previously, `requirePdcReadAccess` required `is_enabled=true` even for explicit
GetProducts/GetCities checks. Settings validation also requires a product ID when
enabling, so an unconfigured deployment could not fetch its product choices while
keeping shipments disabled.

The existing lookup endpoint now explicitly permits disabled-provider diagnostics.
Active `settings.edit` authorization, operator outbound gate, official URL/mode,
token/company checks, bounded whitelist, throttle and cache revision checks remain.
Only this trusted caller sets `allowDisabled`; no browser flag can enable booking.
Tracking refresh retains its original default provider-enable requirement.
Shipment/reverse workers, automatic labels, callbacks and financial fields are
unchanged. Isolated actual HTTP/SQL tests prove a single mocked GetProducts GET
with `is_enabled=false`, `product_id=null`, no jobs, no Storage calls and no flag
changes. Missing operator gate or staff permission still denies before transport.

After deploying that small application fix, existing PDC token/CompanyID can be
saved through Shipping with shipment flags off. Under separate approval, the
operator can allow outbound requests for one explicit read-only Test/Sync while
auto-labels/reverse/workers remain off. Select real returned product/city IDs,
pickup details and a distinct webhook secret; never guess them. No such save,
lookup or provider request was executed here.

### Paymob: ready for configuration, not live charging

The existing test flow matches the official [Intention protocol](https://developers.paymob.com/paymob-docs/developers/intention-apis/create-intention)
and [transaction HMAC contract](https://developers.paymob.com/paymob-docs/developers/webhook-callbacks-and-hmac/hmac/hmac-transaction-callback),
reviewed 20 October. A modern account Secret/Public key pair, merchant HMAC and
matching online EGP card integration ID configure the existing test path through
the current `NUXT_PAYMOB_*` runtime inputs. No WooCommerce token or invented ID.
Callback URLs derive from the reviewed site origin, not the request Host.

Server amounts use saved order totals and integer minor units. HMAC covers the
official 20 fields with timing-safe SHA-512; provider order/integration/amount/
currency/mode bind to the saved attempt under locks. Browser redirects cannot pay
an order. Unique attempts/transactions and no uncertain Intention POST retry
protect replay. Failed/pending callbacks cannot downgrade success. Test success
never marks a commerce order paid or permits live fulfillment. Native concurrent
claim/replay/context/cancellation checks passed with synthetic data.

Real charging cannot be activated by entering live credentials alone:

1. `getPaymobConfig` rejects live mode. SQL claim/store routines also accept only
   test attempts and test intention/client-secret prefixes. Their existing live
   settlement branch is fixture-tested but intentionally unreachable from initiation.
2. Migration83's physical-stock, confirmed-email and configured shipping snapshot
   extensions currently apply to cash. Card checkout still displays shipping as
   calculated later. Extend the existing quote/order guards to card before a live
   final amount can include actual delivery and verified saleable stock.
3. Caddy intentionally holds payment APIs, result pages and webhook delivery.
   The access correction above does not activate those routes.
4. Hosted Pixel/3DS and authoritative successful/failed/duplicate callback acceptance
   remain unverified. PayPal/wallets remain unsupported and disabled.

Deployment-specific intended URLs, for later owner-controlled registration:
`https://elcomputer.net/api/payments/paymob/webhook`,
`https://elcomputer.net/checkout/payment-result` (localized Arabic result supported).
Provider dashboard registration was neither inspected nor changed. Review existing
WordPress callback ownership before replacing any provider setting.

### PDC: read-only setup ready; real booking blocked

Existing access-token encryption, lookup/cache, tracking match/order handling,
independent constant-time webhook secret, throttles, mapping and private customer
projections are implemented and tested locally. ExportPDF is implemented; it has
not been accepted with this merchant's current response. Public PDC API protocol
details were not independently available online; existing supplied vendor reports
remain the protocol basis, not a guarantee about the current account.

Specific normal-order booking gaps in the existing outbound path:

- SQL queues paid orders, and the worker rejects unpaid orders and sends `cod:0`.
  Normal unpaid COD therefore cannot be shipped through it. Never mark COD paid
  early to bypass this; extend the existing eligible-order/collectible-amount path.
- Before any auto-booking, bind the actual selected courier and recheck current
  packing/cancellation/stock eligibility. The current paid-order queue is broader.
- Timeout/ambiguous SaveShipmentEx errors become retryable `failed` jobs. A later
  automatic POST may duplicate a shipment; preserve REF and reconcile ambiguous
  outcomes before another booking. Unique local job/AWB keys alone are insufficient.
- Normal and reverse PDF labels still upload/download through Supabase Storage.
  Move those existing private label paths to VPS storage, retaining authorization
  and metadata. Do not enable this legacy object-upload path in this architecture.
- Worker secret/scheduling, actual merchant products/pickup, configured coverage/
  customer charges, production response shapes/status mappings and callback reachability
  need controlled acceptance. ID 97 remains ambiguous; never invent its meaning.

Later PDC callback URL: `https://elcomputer.net/api/webhooks/pdc`, with a distinct
server-verified `X-Webhook-Secret`. It remains blocked and unregistered by this task.
Do not call SaveShipmentEx, ExportPDF or a worker to test readiness now.

## Validation and launch order

Focused tests use disposable SQL, actual compiled Auth/RBAC handlers, actual
loopback Caddy and mocked provider transports. Native Paymob concurrency uses an
owned PostgreSQL17 cluster. No hosted customer session, real payment/shipment or
provider credential was used. Typecheck/build use Node22.23.1/npm10.9.8 with empty
dotenv and a clean environment. Exact final results are in both handoffs.

Private evidence: `customer-provider-readiness-20261020/` contains denial comparisons,
provider presence/counts, canonical encryption readiness, candidate and build/test
logs. No secrets belong in Git. No new migration or provider activation was added.

Accept the deployed account correction using the existing identities, then
continue the identified corrections within existing
Paymob/PDC before controlled activation. Keep public checkout off until verified
stock, configured delivery and owner acceptance. Historical WordPress login,
identity/address/order migration remains the next required launch workstream;
preserve current Auth UUIDs and prevent duplicate signup identities. UI work later.
