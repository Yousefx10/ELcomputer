> **E214 actual closeout, 4 November:** CARD is restored. Runtime recovery3ba9340b
> is CONSUMED_COMPLETE; current3e5824a9/source9f71/schema111, app249602. Full assets,
> SDK, live Modern, host/financial and natural MON verification PASS. Original
> parente02fcd07 remains consumedSTOP; no rollback/replay or charge occurred.
> [Actual receipt and remaining owner acceptance](paymob-pixel-runtime-string-recovery-receipt-20261104.md).
> Earlier fault/READY/approval text below is historical; never reapply either seal.

> **E211 actual execution, 4 November:** e02fcd07 is CONSUMED_STOP after runtime
> write, cutover and one app restart. Production is3e5824a9/source9f71ec0/schema111,
> app248262. Pages200; CARDfalse. MON has1PUBLIC_CHECKOUT_HEALTH critical plus
> original8warnings/3gaps. Timers resumed; no provider/financial operation or charge.
> Exact compiled tests confirm a two-value runtime JSON-string encoding correction.
> [Fresh recovery review](paymob-pixel-runtime-string-recovery-20261104.md) will
> carry its own exact approval; this parent's approval and inputs are immutable.
> Earlier READY and approval instructions below are historical; do not replay them.

# Scoped Paymob Pixel CARD and Apple Pay — schema111 review

PAY-PIXEL-APPLE-20261103-01. Implementation and local qualification complete.
Production is unchanged. The packet is sealed UNAPPROVED; its operator read-only
preflight passed at2026-11-03T18:43:44UTC. No deployment approval is recorded.

1. **Production.** Application`a5bbed3531c739fa`, source`9335186`, schema111.
   Modern PDP is deployed and owner accepted. CARD/COD/core, EGP10, Email and PDC
   remain active; InstaPay/Google/balance and automatic PDC booking stayOFF.
   There are4pending CARD sessions/attempts,0verified funds/0callbacks,10existing
   orders and0proofs. Original3 session/attempt fingerprints remain exact. The
   additional17:54UTC session is outside the proposed acceptance account.
2. **Reuse.** Recovered only Pixel commit`89ea6cc` onto actual9335186. Recovery
   commit`ea4dd22`; implementation`9f71ec0aec57df3a083205b037f503aba9372b22` on
   `local/paymob-embedded-apple-20261103`. Pinned SDK`paymob-pixel@1.2.8` is unchanged,
   SHA256`082c4b1b76425af80bb6cd98e795e06667fc9b07c34cdb9340c1caa88924373d`.
3. **Apple6038812.** Owner evidence identifies live MIGS-online (APPLE PAY), VPC,
   online/EGP. Pixel's documented`apple-pay` method renders locally in the actual
   pinned SDK. The server selects only6038812 before creating an Apple Intention;
   CARD retains5904482. Existing scalar integration/amount/mode/currency/ownership
   binding is preserved. No migration or integration-ID remapping is used. Actual
   live6038812 metadata, transaction and Apple device acceptance are unexercised.
   [Official Pixel contract](https://developers.paymob.com/paymob-docs/developers/checkout-experiences/pixel-embedded).
4. **Callbacks.** Every new Intention explicitly supplies
   `https://elcomputer.net/api/payments/paymob/webhook` and
   `https://elcomputer.net/checkout/payment-result?checkout_id=<owned-session>`;
   Arabic uses`https://elcomputer.net/ar/checkout/payment-result?checkout_id=...`.
   Existing HMAC verification and private reconciliation remain authoritative.
   Paymob's current FAQ says Intention callback overrides supersede Dashboard
   defaults. No blind edit of the legacy WooCommerce URLs is proposed. Actual
   Apple browser redirect behavior remains a merchant acceptance check.
   [Official override FAQ](https://developers.paymob.com/paymob-docs/need-help/faqs),
   [Intention API](https://developers.paymob.com/paymob-docs/intention-apis/create-intention).
5. **Merchant prerequisites.** Owner explicitly confirms Pixel web, domain and
   certificates; Paymob manages domain verification. This is owner attestation,
   not an independent provider-portal inspection or successful Apple payment.
   Passive association URL404 remains recorded; no invented file/key setup is
   demanded. Device eligibility uses secure context, actual`canMakePayments()`
   and supported session version. Google stays unavailable.
   [Official Apple Pay requirements](https://developers.paymob.com/paymob-docs/payments-and-features/payment-methods/apple-pay-all-regions).
6. **Checkout.** No permanent recovery warning on ordinary visits. Selecting CARD
   or eligible Apple creates one authenticated Intention after explicit confirmation.
   One provider-owned SDK frame, one Pay submission, no forced save-card, no merchant
   card-number/CVV collection. One initial status read and explicit manual checks;
   no polling loop. Abandoned/declined attempts retain cart/private evidence and
   create no ordinary unpaid/cancelled order. A matching late signed success still
   creates one paid order and preserves Modern SKU/price/attributes. Try again is
   disabled until explicit unfunded server retirement: one declined transaction or
   local expiry does not establish complete Intention finality. No automatic
   retirement, inquiry or retry is introduced. Hosted fallback requires disposal
   of the embedded frame before submission; possible submission goes to status.
7. **Qualification.**85 backend/native/HMAC/Modern regressions;22 SDK lifecycle
   checks in Chromium/WebKit;29 focused UI checks per engine;16 release guards;
   typecheck/build; complete archive readback and secret scan. All4412 compiled
   asset HTTP hashes match, including4290 retained immutable assets. Encrypted full
   database and17runtime-file backups passed full readback. Local provider replies,
   callbacks, Apple eligibility and bank outcomes are fixtures. No credentialed
   sandbox/live payment or actual issuer3DS/Apple sheet acceptance was performed.
   Earlier fixture/harness/navigation failures remain archived alongside corrected
   final passes. No genuine provider success is inferred from these checks.
8. **Changed files.** Runtime config/example, method registry/configuration,
   payment-checkout and capabilities handlers, callback normalization, Pixel
   options/bridge/component, checkout and owned status UI, EN/AR copy and focused
   tests. Generic platform logic contains no merchant-specific integration ID,
   customer email or deployment domain. Operational target binding stays private.
   [Implementation notes](/Users/imac/Documents/ELcomputer/paymob-embedded-apple-20261103/source/docs/paymob-pixel-apple.md).
9. **Readiness.** Embedded CARD and Apple SDK support are locally qualified.
   Neither is deployed, enabled or genuinely accepted in production. Initial
   rollout is one existing confirmed/active owner-managed customer account, with
   zero unresolved payment; identity stays in private packet data. Every other
   customer retains hosted CARD. General rollout requires genuine merchant/device/
   issuer acceptance and a separate decision. DTR-36 and DTR-42 remain open.
10. **Production scope.** App/config only, schema111 unchanged. Candidate
    `3e5824a99da43488`; one archive stage/cutover, one runtime file/four reviewed
    keys, one app restart, one pause/resume each MON/Email/PDC timer bounded180s.
    Existing Caddy routes already proxy the SDK; Nuxt supplies scoped CSP.
    Caddy/MON files and Caddy PID remain unchanged. No SQL/migration, credentials,
    units, provider Dashboard action, financial operation, live charge, manual
    worker, new emergency budget, Git push, replay or automatic rollback. Exact
    seal/approval and expiry are recorded below once fresh checks pass.
11. **Preservation.** Four genuine pending sessions remain held; original3 exact.
    Existing orders, cart/order/Auth/RLS, shipping/coupons, Dashboard EGP10,
    Email/PDC, Modern111 and historical journal warnings/gaps remain intact.
    All54 original worktrees/55total and55paused artifacts are preserved. New
    Pixel starts can later be disabled by separately approving Pixel flag OFF,
    while retaining this callback-capable app and Apple registry. An old-app rollback
    after Apple attempts is not automatic or reviewed for callback compatibility.
12. **Paused checkpoint.** Original source`f5e97b56f0d40f6decd23b4f3e9eda3f38fb6504`
    remains untouched. [Exact checkpoint](/Users/imac/Documents/ELcomputer/paymob-embedded-apple-20261103/checkpoint/PAUSED-WORKSTREAM-ORIGINAL.json).
    Meta/SMS/InstaPay activation is not bundled. Earlier H1`db13c8ee` and PDP
    `057f2915` approvals are consumed. Do not deploy old archives or reuse provisional
    Meta111/20261103120000. Any later SQL numbering starts from actual111 evidence.

Packet: [/Users/imac/Documents/ELcomputer/paymob-embedded-apple-20261103/release](/Users/imac/Documents/ELcomputer/paymob-embedded-apple-20261103/release/REVIEW.md).
Pinned Node:`/Users/imac/.npm/_npx/ed214ae0ceb6e0e4/node_modules/node/bin/node`.

The unsealed preparation stopped when a time-derived overdue count changed3to4.
The original read-only snapshot and stop remain preserved. No seal, approval or
apply attempt existed; a fresh draft baseline requires exact stored financial
projections plus independently checked deadlines. No old approval is edited or
reused, and no payment is retired to refresh the review.

The separate capabilities-shape preparation stop was a verifier error: existing
9335186 omits the new experience field. Exact before/installed contracts now have
fixture guards. Both unsealed stops and original snapshots are preserved. Fresh
sealed preflight PASS is based on4overdue sessions with17stored projections exact,
8MON warnings/3journal gaps/0critical, current schema111 and account eligibility.

Exact packet seal:`e02fcd0781934637171a693214eaf5c2bc59df70678701783fa7bd743d5ad32b`;1875inputs.
Execution must start before`2026-11-03T22:26:38.065Z`
(01:26:38Riyadh,4November2026). Approval expires`2026-11-03T22:41:38.065Z`
(01:41:38Riyadh,4November2026). No apply attempt or owner-approved receipt exists.

```text
APPROVE PAYMOB PIXEL APPLE SCHEMA111 SCOPED DEPLOYMENT e02fcd0781934637171a693214eaf5c2bc59df70678701783fa7bd743d5ad32b
```

After this exact approval, use only the sealed operator with the pinned Node.
Run`check`first; record the exact phrase with`approve`;`apply`once; then`verify`
and wait for the next natural MON report. Do not edit sealed inputs or reuse an
attempt on drift, partial completion or an uncertain response. No payment is part
of this deployment approval.

Changed tracked source paths relative to actual9335186:

| File | Review path |
| --- | --- |
| `.env.example` | [Open](/Users/imac/Documents/ELcomputer/paymob-embedded-apple-20261103/source/.env.example) |
| `app/components/payment/CheckoutStatus.vue` | [Open](/Users/imac/Documents/ELcomputer/paymob-embedded-apple-20261103/source/app/components/payment/CheckoutStatus.vue) |
| `app/components/payment/PaymobPixel.vue` | [Open](/Users/imac/Documents/ELcomputer/paymob-embedded-apple-20261103/source/app/components/payment/PaymobPixel.vue) |
| `app/pages/checkout/index.vue` | [Open](/Users/imac/Documents/ELcomputer/paymob-embedded-apple-20261103/source/app/pages/checkout/index.vue) |
| `app/pages/checkout/payment/[id].vue` | [Open](/Users/imac/Documents/ELcomputer/paymob-embedded-apple-20261103/source/app/pages/checkout/payment/[id].vue) |
| `app/utils/paymobFramePolicy.js` | [Open](/Users/imac/Documents/ELcomputer/paymob-embedded-apple-20261103/source/app/utils/paymobFramePolicy.js) |
| `app/utils/paymobPixel.js` | [Open](/Users/imac/Documents/ELcomputer/paymob-embedded-apple-20261103/source/app/utils/paymobPixel.js) |
| `docs/paymob-pixel-apple.md` | [Open](/Users/imac/Documents/ELcomputer/paymob-embedded-apple-20261103/source/docs/paymob-pixel-apple.md) |
| `i18n/locales/ar.json` | [Open](/Users/imac/Documents/ELcomputer/paymob-embedded-apple-20261103/source/i18n/locales/ar.json) |
| `i18n/locales/en.json` | [Open](/Users/imac/Documents/ELcomputer/paymob-embedded-apple-20261103/source/i18n/locales/en.json) |
| `nuxt.config.ts` | [Open](/Users/imac/Documents/ELcomputer/paymob-embedded-apple-20261103/source/nuxt.config.ts) |
| `public/paymob-pixel/1.2.8/3rdpartylicenses.txt` | [Open](/Users/imac/Documents/ELcomputer/paymob-embedded-apple-20261103/source/public/paymob-pixel/1.2.8/3rdpartylicenses.txt) |
| `public/paymob-pixel/1.2.8/host.html` | [Open](/Users/imac/Documents/ELcomputer/paymob-embedded-apple-20261103/source/public/paymob-pixel/1.2.8/host.html) |
| `public/paymob-pixel/1.2.8/host.js` | [Open](/Users/imac/Documents/ELcomputer/paymob-embedded-apple-20261103/source/public/paymob-pixel/1.2.8/host.js) |
| `public/paymob-pixel/1.2.8/main.js` | [Open](/Users/imac/Documents/ELcomputer/paymob-embedded-apple-20261103/source/public/paymob-pixel/1.2.8/main.js) |
| `public/paymob-pixel/1.2.8/manifest.json` | [Open](/Users/imac/Documents/ELcomputer/paymob-embedded-apple-20261103/source/public/paymob-pixel/1.2.8/manifest.json) |
| `public/paymob-pixel/1.2.8/package.json` | [Open](/Users/imac/Documents/ELcomputer/paymob-embedded-apple-20261103/source/public/paymob-pixel/1.2.8/package.json) |
| `server/api/payments/capabilities.get.js` | [Open](/Users/imac/Documents/ELcomputer/paymob-embedded-apple-20261103/source/server/api/payments/capabilities.get.js) |
| `server/utils/payments/checkout.js` | [Open](/Users/imac/Documents/ELcomputer/paymob-embedded-apple-20261103/source/server/utils/payments/checkout.js) |
| `server/utils/payments/methods.js` | [Open](/Users/imac/Documents/ELcomputer/paymob-embedded-apple-20261103/source/server/utils/payments/methods.js) |
| `server/utils/payments/paymob.js` | [Open](/Users/imac/Documents/ELcomputer/paymob-embedded-apple-20261103/source/server/utils/payments/paymob.js) |
| `tests/payment-embedded-browser.test.mjs` | [Open](/Users/imac/Documents/ELcomputer/paymob-embedded-apple-20261103/source/tests/payment-embedded-browser.test.mjs) |
| `tests/payment-first-apple-http.test.mjs` | [Open](/Users/imac/Documents/ELcomputer/paymob-embedded-apple-20261103/source/tests/payment-first-apple-http.test.mjs) |
| `tests/paymob-apple.test.mjs` | [Open](/Users/imac/Documents/ELcomputer/paymob-embedded-apple-20261103/source/tests/paymob-apple.test.mjs) |
| `tests/paymob-pixel-frame-browser.test.mjs` | [Open](/Users/imac/Documents/ELcomputer/paymob-embedded-apple-20261103/source/tests/paymob-pixel-frame-browser.test.mjs) |

ONE next action: send the exact scoped deployment approval above.
