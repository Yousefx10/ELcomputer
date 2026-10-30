> E138,29October2026: owner reports the Paymob technical inquiry email **SENT; response pending**. Do not repeat investigations or consumed probes while waiting. Current LIVE payment experience stays unchanged; Pixel rollout awaits the response and real SDK qualification.

# PAY-02 — Pixel migration preparation

29 October 2026, E137. **DESIGN PREPARED / PROVIDER CONTRACT AND REAL SDK ACCEPTANCE
PENDING / NO LIVE SWITCH.** COD readiness was decided first. This preparation changes
no application code, provider state, live route or runtime setting.

## Existing implementation and observed gap

Deployed source8d75404 already has `app/components/payment/PaymobPixel.vue`,
`app/utils/paymobPixel.js`, an owned `/checkout/payment/:id` page and server-only
`POST /api/payments/intentions`. Its loader pins SDK1.2.8; both save-card flags are
false. SDK callbacks discard their payloads and navigate to server-verified status.

The owner reports successful LIVE payments through Unified Checkout Redirect.
No separate hosted-Redirect selector/adapter was found in the inspected payment
page/provider source. Do not call the current Pixel foundation merchant-qualified,
claim a new migration is already done, or replace the working journey. Reconcile
the observed navigation with the exact loaded SDK behavior during separately
authorized browser acceptance, without making an extra intention or charge.

The current server rejects a second claim for an existing attempt with
`payment_reconciliation_required`. Preserve that guard. A refresh or another session
must not retrieve/reopen an existing payment form while finality remains unqualified.

## Confirmed public documentation

Checked29October2026:

- [Pixel](https://developers.paymob.com/paymob-docs/developers/checkout-experiences/pixel-embedded)
  documents module JavaScript plus two stylesheets, public key/client secret,
  card/Apple Pay/Google Pay options, Arabic/RTL styling and one-hour client-secret
  expiry. These are SDK capabilities, not merchant method entitlement.
- [Create Intention](https://developers.paymob.com/paymob-docs/developers/intention-apis/create-intention)
  uses a server Secret Key, integer-minor-unit amount and matching integration
  currency/mode. Its intention-scoped client secret supports Pixel or Unified Checkout.
- [By-order inquiry](https://developers.paymob.com/paymob-docs/developers/transaction-inquiry-apis/transaction-inquiry/by-order-id-or-reference)
  returns the latest transaction. It does not supply a completeness guarantee.

The Pixel sample includes browser Secret Key/update code and automatic card saving.
Do not copy those parts. Create/update intentions only server-side; keep both saving
flags false. The sample's `onPaymentCancel` applies to Apple Pay; it cannot establish
card/3DS cancellation or finality.

The one-hour public description does not establish merchant-specific revocation,
late settlement or safe reuse. Existing local attempt expiry is30minutes; retain
the more restrictive local boundary until Paymob qualifies the exact expiry contract.
Expiry is never proof that an old payment cannot succeed.

## Smallest integration approach

1. Build on the then-current deployed lineage. Preserve the unique order/provider
   attempt, order-first locks, server totals, saved address snapshot, owner checks,
   integration/mode binding and uncertain-POST barrier. Never submit another create
   after transport uncertainty, refresh, repeated clicks or overlapping sessions.
2. Introduce an independently reviewed deployment configuration for checkout
   presentation. Keep the working Redirect journey as default/fallback until Pixel
   acceptance and separate rollout approval. Pin presentation for the attempt so
   opening another tab cannot select a second charging surface.
3. Mount the existing Pixel component client-side within the responsive checkout
   flow. Return only allowlisted public key, scoped client secret and required safe
   order/expiry/method metadata over authenticated private/no-store responses.
   Keep secrets out of SSR, URLs, browser persistence, telemetry and error payloads.
4. Use a reviewed immutable SDK version. Confirm1.2.8 support or qualify a replacement;
   do not follow `latest`. Maintain one loader/mount, stale-session fencing and
   disposal guards. Confirm actual provider teardown before enabling remounts for
   locale/theme/navigation changes. Never read card fields or SDK result payloads.
5. Keep verified callbacks authoritative. Pixel completion means processing until
   owned server status confirms a coherent live success. Preserve unpaid/review
   states, late/duplicate/out-of-order callback handling and MON-01.

Redirect fallback must reuse the same qualified intention; it must not mint a
replacement. If the form has been submitted, the outcome is uncertain, the attempt
is expired or eligibility is unknown, return to order status/review. Do not offer
a second payment surface. Before-final-submit switching also needs Paymob's
single-session/finality contract and server authorization; it is not enabled now.

No intention update is introduced until Paymob documents mutability and race
semantics. Saved order totals remain immutable under the existing contracts.
Pay Again and payment-method changes remain disabled.

## Dependencies before implementation/rollout

| Dependency | Evidence required |
| --- | --- |
| SDK/Nuxt/browser compatibility | Supported pinned version, global/module export, lifecycle/disposal, allowed runtime updates and browser support. Actual Nuxt SSR hydration/navigation and repeated-mount checks. |
| Hosted fields and 3DS | Confirm field isolation and data flow; supported challenge frames, top-level redirects/popups, return navigation, abort/late success and mobile Safari/Chrome behavior. No card data in app state/logs. |
| CSP | Inspect actual serving headers. Obtain exact script/style/font/connect/frame/form/navigation origins and any inline-style/nonce requirements. Test restrictive policy in an isolated environment; no wildcard or live header changes here. |
| Merchant compatibility | Confirm existing Egypt LIVE online card integration supports Pixel with current keys/callbacks. Card only initially; wallets, saved cards and installments stay unavailable pending separate capability/acceptance. |
| Expiry/finality | Exact client-secret/payment-key expiry, update/reuse/invalidation, simultaneous-tab behavior, late success and safe same-intention Redirect fallback. No expiry-based retries. |
| Callback/history | Confirm signed fields, delivery/retry/dedup semantics and independently complete order/attempt history. Latest-only inquiry cannot unlock recovery. |

These questions extend the owner's pending technical question set; no message or
provider request was sent. No unsupported endpoint, CSP host or SDK destroy method
is invented. Exact CSP, supported SDK release and real3DS compatibility remain
**unconfirmed** until the required evidence arrives.

## Qualification and approval sequence

Provider-independent next work can cover local presentation configuration, safe
session DTOs, status UI and fake-SDK lifecycle/concurrency tests. It must remain
default-off and must not relax the existing claim guard. Do one increment at a time;
do not combine COD activation, payment recovery, emails or Dashboard deployment.

After the contract arrives, qualify an isolated merchant TEST environment with
separately approved provider access. Cover EN/AR/RTL, Light/Dark/System, mobile and
desktop, SDK failure,3DS, declines/abandonment, callback-before-return, delayed and
replayed callbacks, reload/back/session overlap and fallback. Existing mock tests
are useful regressions, not evidence of actual fields/3DS or merchant acceptance.

A later deployment may install inactive capability only after fresh exact approval.
Customer rollout and any LIVE charge require independent approval. Preserve CARD,
callbacks, payment records, MON and the original emergency-close control throughout.
