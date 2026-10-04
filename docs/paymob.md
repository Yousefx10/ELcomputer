# Paymob foundation — local only, 2026-10-04

REAL PAYMOB TRANSACTION TESTED: NO. LIVE PAYMOB ENABLED: NO. PRODUCTION DEPLOYED: NO.

This first phase implements the server/provider boundary, private gateway ledger, modern Intention request, secure Pixel mount and verified callback/return separation. It does not authorize deployment, production migrations, dashboard changes or an external transaction. Gateway configuration defaults off, and live initiation is hard-blocked in JavaScript and the claim RPC. No real credentials were added or changed.

## Audit and architecture

Read [the pre-change audit](paymob-audit.md). Reused existing `requireCustomerRequest`, server-only Supabase admin client, site_settings/dashboard card toggle/fee, locale/theme/storefront shell, account order pages and `commerce_create_customer_order` transaction. Manual Cash/Bank Transfer/InstaPay and preorder-specific restrictions/receipts are preserved. No PayPal integration was added; existing PayPal presentation remains unconnected and must not be advertised as processed payment.

The browser creates the order through existing checkout, passing only product/variant IDs, quantities, address, coupon code and chosen method. The database calculates product/coupon totals and payment fee and allocates stock once under existing cart idempotency/locks. Card orders stay pending. The entry page moves from `checkout.vue` to `checkout/index.vue` so Nuxt renders payment/summary/result siblings independently; the `/checkout` URL and flow are unchanged. Checkout then navigates to `/checkout/payment/:id` within the branded storefront. The customer explicitly opens secure payment. Payment initiation accepts only `order_id` and optional `locale`; it loads the customer's saved order and claims a durable attempt under an order row lock. EGP fixed-decimal amounts convert to integer minor units without binary float multiplication or rounding. Shipping remains “calculated later” under existing architecture; no unspecified future shipping charge is silently included.

`server/utils/payments/index.js` owns the provider boundary; Paymob request/config/HMAC code is isolated in `paymob.js`. `methods.js` separates merchant integration configuration from implemented flows. Only card/VPC has an implemented flow. Apple Pay, Google Pay and mobile wallet registry entries remain unavailable even if IDs are supplied. Public express capability is an empty array. Future work must implement browser/device checks and confirmed merchant integrations before populating that array or extending Pixel methods; configuration alone never advertises a working wallet.

## Schema (unapplied)

`supabase/migrations/20261004120000_paymob_foundation.sql` is additive and has not been applied to a remote or persistent local database. Automated tests apply it only to disposable PGlite/native PostgreSQL databases, including existing historical-order fixtures.

- `payment_attempts`: one provider attempt per order, integration/mode/amount/currency binding, provider intention/order IDs, private expiring client secret, normalized status, bounded safe error code and timestamps.
- `payment_transactions`: multiple signed transaction IDs per intention, uniqueness across provider/transaction, normalized state only. No callback body, PAN, masked PAN, brand, billing payload, token or raw card credential is stored.
- RLS enabled; no anon/authenticated grants or policies. Service-role RPCs claim, store and reconcile. Authenticated APIs return owner-constrained safe projections; status responses exclude the client secret.
- Unpaid card packing/progress guards preserve manual-method behavior and historical metadata/refund edits, while blocking new unpaid fulfillment. Any test attempt prevents a card order being marked paid or fulfilled. Financial context cannot change after an attempt exists.
- The existing explicit owner reset table lists now include both ledgers in FK-safe order. No reset is run. Existing order/payment values, history and existing RLS policies are unchanged.

The order's existing payment enum remains pending/partially_paid/paid/failed/refunded. Attempt states distinguish initiated/pending/succeeded/failed/cancelled/expired; absence means not_started. Expiration is projected from expires_at without a scheduler. A test success is `test_succeeded` in the safe result API and leaves commerce payment pending. A dormant live-only settlement branch has isolated fixture tests for paid/status/amount_paid transitions and duplicate protection, but live mode cannot be initiated or reconciled through the foundation's configured HTTP gateway. Opening that gate requires later explicit review, not another environment flag. Full commerce acceptance from real TEST callbacks also needs a separately reviewed staging-only settlement policy restricted to an isolated database/environment; this version intentionally has no such override.

## Runtime configuration

Set private Nuxt runtime variables in a secure operator environment, never in public Supabase settings. `.env.example` contains blank placeholders only.

| Variable | Purpose/default |
| --- | --- |
| `NUXT_PAYMOB_ENABLED` | `false`; gateway gate |
| `NUXT_PAYMOB_MODE` | `test`; `live` rejected in this phase |
| `NUXT_PAYMOB_SECRET_KEY` | Egypt `egy_sk_test_…`; server only |
| `NUXT_PAYMOB_PUBLIC_KEY` | Egypt `egy_pk_test_…`; passed to owned Pixel session only |
| `NUXT_PAYMOB_HMAC_SECRET` | Merchant HMAC verification secret; server only |
| `NUXT_PAYMOB_CARD_INTEGRATION_ID` | Merchant's reviewed online EGP VPC test integration ID |
| `NUXT_PAYMOB_CARD_INTEGRATION_MODE` | `test`; explicit operator assertion for the integration |
| `NUXT_PAYMOB_INTEGRATION_IDS` | Optional JSON registry; default `{}`; future method entries `{id,mode,enabled}` stay unusable |
| `NUXT_PUBLIC_SITE_URL` | Fixed HTTPS origin, `https://new.elcomputer.net`; callback construction never trusts Host |

An API key is not required by the current Intention API. Only the officially public key and an intention-scoped client secret reach Pixel, via a private no-store authenticated API response. Payment API errors are also returned through a scoped sanitized handler, preventing the framework error renderer from echoing query values or replacing 404 privacy headers. They are never rendered in SSR HTML. All credentials stay outside runtimeConfig.public. Test/live key prefixes, client-secret/intention prefixes, integration mode and response amount/currency/reference are validated. Integration IDs themselves do not encode mode; an operator must confirm their mode/currency/ownership in Paymob. The known merchant ID belongs only in secure configuration, never source.

The deployment script omits dotenv; use `NUXT_*` PM2 runtime overrides for a later authorized release. Do not run deployment or migration commands from this foundation checklist.

## Endpoints and customer routes

| Route | Responsibility |
| --- | --- |
| `GET /api/payments/capabilities` | Safe environment card capability and empty express list; checkout also requires saved card toggle |
| `POST /api/payments/intentions` | Authenticated active customer; strict owner/order lookup; server amount; claim/reuse intention; safe Pixel session |
| `GET /api/payments/status?order_id=<UUID>` | Owner-authorized payment state only |
| `GET /api/payments/status?provider_order_id=<Paymob order ID>` | Same owner authorization for static dashboard redirect correlation |
| `POST /api/payments/paymob/webhook?hmac=…` | Public server callback, no customer session; HMAC and atomic reconciliation |
| `/checkout/payment/:id` and `/ar/checkout/payment/:id` | Protected branded secure-payment page |
| `/checkout/payment-result` and `/ar/checkout/payment-result` | Separate presentation; never trusts payment query flags |

Exact future dashboard webhook URL: **https://new.elcomputer.net/api/payments/paymob/webhook**

Exact future dashboard customer response/redirect URL: **https://new.elcomputer.net/checkout/payment-result**

Intention requests set notification_url to the webhook and redirection_url to the localized result URL plus internal order_id. The static dashboard URL is also supported: Paymob's appended `order` query is used only as a lookup; the server still checks ownership. The result page removes provider query fields from browser history and uses only the safe selector. It polls at most ten times, every three seconds, then shows unable-to-confirm and an order link. No browser/Pixel callback marks an order paid, creates fulfillment or cancels an order.

## Security and idempotency

The webhook verifies SHA-512 over the exact 20 official POST `obj` fields, uses a fixed-length timing-safe signature comparison, requires real boolean/integer shapes and normalizes only safe state. The signature covers Paymob order ID, integration, amount, currency and transaction ID. Unsigned extras/merchant_order_id/is_live cannot select an order or authorize a state transition. Signed IDs bind to the persisted intention/order plus configuration's integration/mode; current order currency/total are checked again under locks. Authorization-only/capture/refund/void/child transactions are rejected, not implemented. Callback bodies are limited to 65,536 bytes while streaming, with a 10-second upload timeout, and never stored/logged. Unsupported card-token events are not accepted or persisted.

Consistent order-before-attempt locks serialize callback, initiation and cancellation. Unique attempts prevent duplicate remote POSTs across simultaneous tabs. Unique transaction IDs cannot move between attempts, including conflicting races. Repeated success leaves paid timestamps and fulfillment untouched; stale failure/pending cannot downgrade success. Failure may later become success. Unknown provider order responds retryably (503), covering callback-before-intention-persistence. Unknown transaction ID is acceptable only as the first valid signed event for a known persisted provider order; unbound/mismatched IDs fail.

No network retry is sent after a timeout, 5xx or malformed result. An initiated attempt lacking a persisted client secret requires manual provider reconciliation; even a definite provider rejection does not automatically create a replacement intention. Concurrent callers during the initial POST receive an unavailable/review result. Persisted unexpired pending/failed intentions can be reused. Expired attempts cannot create replacements in this phase. Abandoned orders retain existing stock allocations and require staff handling; there is no new automatic stock release/cancellation job. Late success for a cancelled/refunded live fixture records a review condition and cannot queue fulfillment.

## Pixel and acceptance limits

The official `paymob-pixel` CDN SDK is pinned to version **1.2.8**, rather than `latest`. Script/CSS load only after a valid owned session. Paymob creates payment fields; ELcomputer has no card inputs, bindings, values, card validation, saved-card previews or SDK payload logs. Save/force-save-card options are both false. SDK callbacks trigger status navigation only. The surrounding page supports EN/AR, RTL, desktop/mobile and resolved Light/Dark/System colors. Pixel receives initialization-time theme/locale; changes while a form is already open require reopening it, and actual SDK/3DS lifecycle must be tested in staging.

Automated browser tests replace the Pixel SDK with a no-fields initialization stub and block Paymob requests. These tests confirm actual Vue component/options, secure-page layout, disabled-card filtering, manual-method selection and return-state presentation. They do not certify actual Paymob-rendered fields, 3DS, wallet capabilities, SDK teardown, callback delivery/retries or settlement. No customer/staff identities, orders or settings were written to production.

## Manual merchant steps — later, after review

1. Review this code/migration and resolve staging acceptance before any production release. The foundation still blocks live mode; a separately reviewed live-activation change is required for real charging.
2. In Paymob Developers → Payment Integrations, inspect the existing TEST online VPC integration. Confirm EGP, merchant ownership and compatibility with modern Intention/Pixel; ask Paymob if the old Non-Shopify integration needs further activation. Confirm the integration's mode matches its keys.
3. Obtain TEST Secret/Public keys and merchant HMAC secret through Paymob's credential settings and put them only in the secure isolated staging environment. Configure the reviewed integration ID and integration mode. Do not use old WooCommerce API tokens as modern credentials.
4. After a separately authorized public staging/application deployment, replace the OLD transaction processed callback with the exact new webhook URL above, and the transaction response callback with the exact new customer redirect URL above. The merchant makes these changes; this task does not.
5. Keep production gateway and card availability off. An isolated test environment may explicitly enable gateway plus the existing dashboard Card toggle after its migration. Review labels/fees using existing settings.
6. When Paymob/merchant test access allows it, verify the actual Pixel loading, secure fields, 3DS, valid/invalid callbacks, redirect-before-webhook, replay, declined/abandoned attempts, session recovery and settlement. Do not treat current mocks as that evidence.
7. For Apple Pay/Google Pay/wallets, obtain confirmed merchant integrations and official region/browser/domain requirements, implement the missing flow/capability checks and run actual acceptance before setting usable capability. Adding registry IDs alone has no effect on availability.

## Rollback and release considerations

No production state changed, so current rollback is reverting the local patch. Retain an applied private ledger for audit/history in any future rollback; do not drop payment evidence. Disabling the saved Card toggle stops new initiation while a deployed gateway callback can still reconcile in-flight intentions. Do not disable callback configuration/remove its code while real payments are in flight. Reconcile uncertain attempts with the provider before any replacement payment. Match application and migration versions, verify remote migration parity without blindly applying other pending work, review existing unrelated ERP migration state, and use the repository's guarded release only after explicit authorization. Secure PM2 variables must be provisioned separately, with a public-output secret scan.

Read [validation and final report](paymob-report.md) for exact commands/evidence and remaining acceptance work.
