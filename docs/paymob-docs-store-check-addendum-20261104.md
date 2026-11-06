# Paymob contracts, callback settings and Store Check — 4 November 2026

**Read-only review complete. No payment or provider setting was changed.**
Tasks: `PAY-DOCS-20261104-01`, `PAY-CALLBACK-CONFIG-20261104-01`,
`SEC-CSP-20261104-01`. Existing `PAY-APPLE-LIFECYCLE-20261104-01` remains open.

## Material findings

- The supplied integration screenshot matches Apple Pay **6038812**, EGP,
  online/VPC and Non-Shopify. Both displayed callback defaults still use
  `https://elcomputer.net?wc-api=paymob_callback`, the legacy WooCommerce address.
  This is stale fallback configuration for this application. Our Intention
  requests already supply the current callback URLs. Paymob documents these
  per-intention overrides; the screenshot does not establish that callbacks for
  the unresolved attempt went to the legacy URL, or explain native dismissal.
- Public storefront/payment-result documents have no CSP header. The disposable
  Pixel frame **does** have its scoped, enforced CSP. These are separate scopes.
  Missing document CSP is a confirmed security-hardening gap, classified **P2**;
  no observed CSP restriction explains the Apple sheet closing.
- At **21:08:27 Riyadh**, physical schema114 remains installed. There are now
  **14 sessions/attempts**; all 13 deployment-bound attempts remain. Funds,
  callbacks and transfer proofs are zero; store orders remain 11. The submitted
  EGP325 attempt remains pending and fenced. A separate EGP325 row is pending,
  superseded and unfenced. No status, fence or reference was rewritten. The
  additional attempt is observed activity, with no attribution inferred.

The owner reports that Paymob support has already been asked for financial
finality and native-validation evidence. This supersedes earlier documentation
saying the private case was only prepared. No support message was sent by this
review. No further intention, charge, retry, cancellation or refund is authorized.

## Official contract comparison

The reviewed payment files are byte-identical in deployed source `ff037dd` and
the existing Meta115/image116 candidates. No AI implementation sample was copied.

| Contract | Existing implementation and result |
| --- | --- |
| Intention endpoint/authentication | Server `POST https://accept.paymob.com/v1/intention/`, `Authorization: Token <secret key>`. Correct; no Bearer substitution or client-side secret. |
| Integration selection | Loaded live registry selects integer `6038812` for Apple; CARD retains `5904482`. `payment_methods` contains only the selected ID. Merchant/domain verification flags are configuration evidence, not native-validation acceptance. |
| Amount | Integer EGP minor units, parsed without floating-point rounding. Pure local evaluation confirms EGP325.00 → `32500`. Saved quote and attempt amount must match. |
| Reference/response | `special_reference` is the attempt UUID. Response validation checks mode, intention/provider IDs, amount, currency and matching reference before accepting `client_secret`. Ambiguous responses remain uncertain, without automatic POST retry. |
| Callback destination | Explicit `notification_url` is the configured origin plus `/api/payments/paymob/webhook`. It receives processed transaction callbacks. |
| Browser return | Explicit localized `/checkout/payment-result?checkout_id=<owned-session>`. The current checkout adapter replaces the legacy `order_id` selector. Provider status query fields and SDK completion are not financial authority. |
| Apple return limitation | Paymob documents `redirection_url` support for Card/Wallet; a native Apple redirect is not guaranteed by that statement. Existing Apple completion navigates to the owned session status page. |
| HMAC | POST requires `type=TRANSACTION` and verifies `body.obj` using the official 20-field concatenation, SHA-512 and the `hmac` query value. Exact 128-hex validation and timing-safe comparison precede reconciliation. Unsigned extras/references do not establish payment identity. |
| Pixel/lifecycle | Pinned, self-hosted 1.2.8; Apple gets only `['apple-pay']`, with both card-saving flags false. Apple runs in the top-level eligible document. CARD retains the disposable iframe. Document replacement/iframe removal provide disposal without undocumented SDK methods. |
| Submission/cancellation | The pinned SDK awaits `beforePaymentComplete` before native `begin()` and `onpaymentauthorized`. The existing server submission fence therefore precedes native authorization. Apple cancellation is a UI signal, not proof of no funds, and cannot clear that fence. |

Sources: [Create Intention](https://developers.paymob.com/paymob-docs/intention-apis/create-intention),
[Pixel Embedded](https://developers.paymob.com/paymob-docs/developers/checkout-experiences/pixel-embedded),
[HMAC overview](https://developers.paymob.com/paymob-docs/developers/webhook-callbacks-and-hmac/hmac),
[official transaction HMAC field order](https://developers.paymob.com/paymob-docs/developers/webhook-callbacks-and-hmac/hmac/hmac-transaction-callback),
[transaction callbacks](https://developers.paymob.com/paymob-docs/developers/transaction-callbacks).

The SDK handles native merchant validation through its own validation request
and `completeMerchantValidation`. No original Safari exception, validation
response or provider request ID establishes why the real sheet disappeared.
Existing fixed diagnostic codes and the separately qualified local guard
`1da68eb` remain preserved. That guard is **not deployed**. No certificate,
domain, SDK, callback-authentication or cancellation code was changed.

## Screenshot callback defaults

For this application, the matching defaults would be:

| Paymob field | Application destination |
| --- | --- |
| Webhook URL | `https://elcomputer.net/api/payments/paymob/webhook` |
| Redirect URL | `https://elcomputer.net/checkout/payment-result` |

The request-specific Arabic return remains localized by the application.
Paymob's [official FAQ](https://developers.paymob.com/paymob-docs/need-help/faqs)
documents request-specific callback overrides. The screenshot defaults should
be reconciled as a separate merchant configuration correction; they are not a
proven native Apple validation cause. Preserve the current uncertain intention.
Support should identify its actual callback destination and delivery/result.

GET-only checks at **21:10 Riyadh**: the legacy query URL returns storefront HTML
(200); the current result page returns 200/private-no-store/no-referrer; GET on
the webhook returns 403. The webhook contract is **POST**, so this GET rejection
does not diagnose a broken webhook. No callback POST, callback replay or Paymob
Dashboard save was performed. Signed provider delivery remains unverified.

## Actual deployed browser headers

Anonymous GET checks ran at **21:03 Riyadh**, without cookies or redirects.

| Scope | Observed headers |
| --- | --- |
| `/`, `/ar`, `/shop`, `/login` | No CSP or CSP-Report-Only. Root/Arabic HTML also contain no meta CSP. Referrer policy is `strict-origin-when-cross-origin`. Login is private/no-store. |
| EN/AR payment-result | No CSP; `Cache-Control: private, no-store`; `Referrer-Policy: no-referrer`. |
| EN/AR Apple page, synthetic UUID | 302 to login; no CSP; private/no-store and no-referrer. No authenticated interface was opened. |
| `/paymob-pixel/1.2.8/host.html`, `host.js`, `main.js` | Enforced scoped CSP, no-referrer and public immutable asset caching. The frame policy does not establish a document CSP for the top-level Apple page. |
| Shared baseline | HSTS `max-age=31536000`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`. No Permissions-Policy or COOP/COEP/CORP observed. Their absence alone is not classified as an Apple defect. |

The frame policy retains `default-src 'none'`, self-hosted scripts, the existing
inline-style allowance, explicit Paymob connection/frame origins and self-only
ancestors. No wildcard restriction, global payment permission, COOP/COEP or
site-wide enforcement was added. A later document-CSP change needs actual
resource inventory and report-only qualification for Nuxt, Paymob/Apple,
Meta, Auth/Turnstile and existing media. It remains independent of this incident.

Read-only host metadata at **21:06:17 Riyadh** confirms release
`6fd67997c8feaeca`, source `ff037dd`, app/Caddy PIDs `282442`/`26652`, and all
17 protected file hashes unchanged from the deployment binding. The registry's
JSON-string environment encoding is intentional Nitro compatibility, preserved
from the completed runtime recovery; it is not a new configuration defect.

## Independent release preparation

| Workstream | Current boundary and next preparation |
| --- | --- |
| `SF-UX-20261104-01` | Storefront/infinite scroll already deployed on schema114. Original operator is CONSUMED_COMPLETE. Owner UI acceptance remains open; no rebuild or redeployment. |
| `MKT-META-01` | Rehashed existing `fd655ce` archive `4853345e9b8301ec…`; all five bound inputs match. Deployed storefront is an ancestor and 11 reviewed payment files are identical. Prepare the separate inactive 114 → 115 target; transmission remains OFF. |
| `IMG-PERF-20261104-01` | Rehashed existing `d6b0934` archive `c7c6a37ef9ffdf0a…`; all six bound inputs match, including compiled image HTTP evidence. Existing packet expects 115 → 116, so it cannot directly follow 114 unchanged. Preserve its qualified artifact and migration prerequisite. |
| Target/credentials | Fresh read-only ledger confirms 114 exact and both proposed migrations absent. Old packet descriptions still bind schema113/earlier activity and cannot be used for execution. New recovery, full target/financial/settings/MON bindings for **all 14 attempts**, restored-target rehearsal, one-use operator and exact authorization remain required. |

The older Apple-wide release hold does not apply to these independent packages.
Do not introduce speculative Apple changes to refresh them. Meta's encrypted
worker-secret candidate remains uninstalled; the CAPI token is still missing.
Missing CAPI credentials block transmission acceptance, not local preparation
of an inactive installation. Dashboard token input, worker/runtime installation
and consented Test Events retain their separate scopes. No old approval transfers.

Thirteen existing focused contract checks passed under Node **22.23.1**, using
fixture transports only. Prior builds/browser/cache qualification is reused;
no new application code or tests were written. Existing deferred tests, consumed
operators, historical financial evidence and unfinished work remain preserved.

Machine evidence is in
`../paymob-docs-store-check-addendum-20261104/`: `public-headers.json`,
`host-metadata.json`, `database-readonly.json`, `callback-settings-review.json`,
`focused-contract-tests.json`, `candidate-lineage.json`,
`release-candidates-rehash.json` and preservation receipts.

**Next action:** obtain Paymob's authoritative EGP325 outcome and native-validation
trace; independently refresh the existing inactive Meta115 release binding.
