# Paymob Apple Pay form hotfix — 4 November 2026

Task `PAY-APPLE-FORM-20261104-01`. **LOCAL PASS / SEALED READY / UNAPPROVED.**
The candidate is not deployed. Owner iPhone and provider acceptance remain open.

The owner reports an immediate error on iOS 26. CARD fields render on the same
iPhone after Back. The confirmed application fault is an initialization context
mismatch: checkout advertises top-level eligibility, then the wrapper checks
`ApplePaySession.canMakePayments()` inside the SDK child frame. Rejection at
`public/paymob-pixel/1.2.8/host.js:26` sends `unavailable`; the parent flattens it to
“The payment form is unavailable.” The guard loses the specific native error.
An eligible-parent/restricted-child fixture reproduces the immediate message
before submission. The original physical Safari exception was not recorded;
its exact device/provider cause is unverified. No certificate defect is claimed.

Read-only live evidence shows the EGP 3,050 Apple intention used integration
6038812, live mode and EGP, with provider references and a valid-format secret.
The session was unexpired when observed, with no submission fence or order.
Secrets pass the existing length guard. Loaded runtime and its existing Nitro
string encoding match reviewed configuration. No real key or secret was exported.
No direct live provider request was made for this investigation.

Only Apple now opens an authenticated `/checkout/apple/:id` document. It uses the
unmodified integrity-pinned Pixel 1.2.8, existing intention, server quote and owned
interface endpoint. The actual SDK constructs the native session from its button
gesture; the existing submission gate runs before `begin()`. Full navigations
provide disposal because this SDK has no public destroy API. Errors use fixed
sanitized phase codes and localized recovery controls. CARD keeps its iframe.

Source `388c04df15d998fcde1774b8eaddc8169a39bdd9` derives directly from actual production source
`0b2eeb3255b07163364368b15bb6310a55322f43`. The runtime changes are:

| File in the isolated source | Change |
| --- | --- |
| `app/components/payment/ApplePay.vue` | Apple-only mounting, error handling, submission gate and document disposal. |
| `app/pages/checkout/apple/[id].vue` | Existing customer authorization and private Apple page. |
| `app/pages/checkout/index.vue` | Route an acknowledged Apple checkout to that page. |
| `app/components/payment/CheckoutStatus.vue` | Route permitted Apple reopening to that page. |
| `i18n/locales/en.json` | Concise Apple recovery messages. |
| `i18n/locales/ar.json` | Matching Arabic messages. |

Tests changed: `tests/paymob-apple-page-browser.test.mjs`,
`tests/payment-embedded-browser.test.mjs`, and `tests/paymob-apple.test.mjs`.
Documentation changed: `docs/paymob-apple-form-hotfix.md` and
`docs/paymob-pixel-apple.md`. All 765 build inputs match their pre-build timestamps
and captured hashes. No server, SQL, SDK vendor, CARD iframe, package, quote,
callback/HMAC, reconciliation, cart, COD or image-cache implementation changed.

Passed checks:

- 38 actual-SDK checks across Chromium/WebKit with a synthetic Apple session:
  eligible initialization, trusted gesture, EGP 3,050, EN/AR, mobile/desktop,
  expiry, cancellation, SDK/network failure, denied/unknown submission gates,
  replayed browser callbacks and account invalidation. All external requests
  were intercepted or blocked; this does not prove a real Apple sheet or payment.
- 77 focused backend/native PostgreSQL/HTTP/HMAC lifecycle tests: authoritative
  amount and integration, CARD/COD, authenticated late callbacks, exactly one paid
  order after verified fixture funds, duplicate prevention and preserved carts.
- 34 checkout/status browser checks per Chromium and WebKit. Typecheck, Nuxt
  production build and source whitespace checks pass. Mobile fixtures fit the
  viewport; their EN/AR WebKit screenshots were also inspected.
- Full archive byte readback and secret scan, 4,772 current/retained asset HTTP
  hashes, 13 compiled route/auth/resource checks, and nine compiled Nitro runtime
  configuration cases pass. The earlier raw/encoded-string distinction stays intact.
- 50 scope/preservation checks, 43 JavaScript and 39 Python release guards,
  and 45 offline one-use/uncertain-transport assertions pass. Fresh encrypted
  database and 17 protected-file backups pass full decryption/pg_restore/tar
  readback at 10:58 UTC. No production restore was performed.

Actual production at read-only preflight **2026-11-04T11:01:13.617Z** remains application
`46bb252b303280e8`, source `0b2eeb3`, physical schema113, application PID267131.
Caddy PID26652 and all 17 protected files are unchanged. Natural MON
2026-11-04T11:00:06.439367+00:00 is complete with the original eight
warnings, three gaps and zero critical findings. Existing warnings were not cleared.

The current baseline contains **ten sessions/attempts**, including one submitted
unresolved fence, zero funds/callbacks, ten orders and zero proofs. All integrity
checks are zero. All earlier IDs and the five legacy unknown/null interfaces are
preserved. No financial outcome was inferred or changed. Opening/cancelling an
unsubmitted form retains the cart and existing safe reopen permission. After an
acknowledged or uncertain submission, cancellation cannot clear the financial
fence: status and authoritative server permission govern retry.

Normal customer use added quotes and another attempt during preparation.
No packet had been sealed or approved then. The fresh packet binds all current
attempts exactly. Quote additions are allowed only while every prior quote ID
and full-row hash remains identical; deletions, rewrites and column changes stop.
Financial, order, catalog and security drift still stops execution. All 57 original
worktrees, 55 paused Meta/SMS/InstaPay artifacts and 14,940 consumed packet inputs
remain preserved. There is no homepage, infinite-scroll, Meta or image-cache bundle.

The isolated packet is `/Users/imac/Documents/ELcomputer/paymob-apple-form-hotfix-20261104/release`. Its immutable plan seal is
`23d5b181de6f1e4e4f78edfc2538df2269b7018f6bffe40d88b6f9f2e7ee4933`, with 2145 sealed inputs. Candidate application
`54315e37fdc74aa7` has archive SHA256 `54315e37fdc74aa77947790f942e03cc6f8227e605c41952d65dc48c7604aba0`.
The sealed read-only preflight passed. Approval and apply markers are absent.

Deployment scope is one archive upload/stage and one application restart, with
one bounded pause/resume per existing MON/Email/PDC timer. Schema113 stays exact:
zero migrations, SQL/history writes, financial/business actions, runtime/flag/Caddy/
unit/credential changes, provider calls, manual worker requests, pushes or new
emergency budgets. Full database checks run before timers pause. Cutover must
start within 75 seconds of the first pause intent, reserving the reviewed
180-second pause budget for bounded restart/readiness and one-use resumes.

The operator consumes the packet before mutation. An uncertain stage/restart/
cutover cannot be retried or rolled back automatically. The previous compatible
schema113 release remains available as a recovery image. Recovery needs fresh
state review and a new exact approval; never restore over customer activity.
Postflight requires installed inventory/certificate/PID/runtime, protected files,
exact schema/security and existing attempt IDs, CARD/COD/private authorization,
all asset hashes and the next natural MON. No manual worker may manufacture proof.

DTR-45 remains open for deployed owner-device acceptance and separately authorized
real provider payment. DTR-44 hosted technical success and its owner gates remain
separate. DTR-36/38/42/43 and Modern DTR-41 acceptance are preserved. No physical
Apple authorization sheet, merchant acceptance, live charge or refund is claimed.

The deployed schema113 approval was consumed. This new artifact needs the fresh
one-use approval required by the owner's production instructions and AGENTS.md.
Execution must start before **14:45:02 UTC / 17:45:02 Riyadh, 4 November 2026**;
expiry is **15:00:02 UTC / 18:00:02 Riyadh**. Expiry or drift requires a fresh packet.

ONE next action: approve this exact hotfix packet:

```text
APPROVE PAYMOB APPLE PAY FORM HOTFIX SCHEMA113 DEPLOYMENT 23d5b181de6f1e4e4f78edfc2538df2269b7018f6bffe40d88b6f9f2e7ee4933
```
