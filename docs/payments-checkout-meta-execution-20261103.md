# Payments, checkout and Meta execution — 3 November 2026

OD-20261103-MASTER-EXEC-01. Local implementation and independent artifacts are
complete for checkout/CARD Pixel and Meta tracking. Nothing was deployed,
activated, charged, pushed or sent to a provider during this execution.
Read the current scope below before following older release instructions.

| Area | Production | Local result and remaining gate |
| --- | --- | --- |
| Health | `bec54ceb2fbfac72`, source `76b4db1`, schema110 | Fresh sealed read-only check PASS; MON 8 warnings, 0 critical, 3 journal gaps. Natural MON check 2026-11-03T12:25:05.915414+00:00. CARD/COD/core, Email, bounded PDC tracking and timers active; EGP10 COD fee preserved. |
| Genuine CARD | One pending/overdue attempt;0 verified funds/0 linked orders | Preserve uncertainty. No inquiry, replay, manual finality or fake order. DTR-36 genuine success remains pending. |
| InstaPay | Schema110/access fix installed and owner-accepted; private/runtime gates OFF; blank recipient/instructions | Existing transfer UI, duplicate-proof/reference controls and bank verification reused. Private upload/readback/staff verification→one paid order locally exercised. Inactive hosted packet sealed UNAPPROVED; authenticated hosted/genuine bank acceptance still pending. |
| CARD Pixel | Hosted CARD remains active; Pixel OFF | Pinned 1.2.8 recovered and integrated with payment-first. EN/AR, RTL, Chromium/WebKit and single intention/late callback checks PASS. Genuine merchant 3DS/OTP acceptance and exact activation scope remain. |
| Checkout UI | Address list, delivery cards, coupon position and direct hosted handoff already in deployed source | Added compact COD choice/removal of redundant explanation; prepared independent app-only artifact. Preserves unpaid cart, explicit confirmation and COD exception. New artifact not deployed. |
| Apple Pay | Hidden/OFF; actual extra-method registry empty | Preserve owner's Paymob-managed activation promise. Real live ID/offer and merchant browser flow absent. No repeated support-contact task or unsupported certificate requirement. No claim the flow is implemented/accepted. |
| Egyptian wallets | No actual configured wallet ID/offer | Vodafone/Orange/e&/WE not advertised as working. Existing method registry/callback foundation retained; wallet flow awaits actual supported merchant contract. Google stays OFF. |
| Meta Pixel/CAPI | Not installed/deployed/live | `f5e97b5` LOCAL PASS: protected settings/token, consent, diagnostics, private outbox, exact shared IDs, verified Purchase, COD distinction, balance debit gate, retries and retention. Candidate next schema111 inactive migration + application packaged separately. Real protected Dataset/token configuration, exact release/activation and Meta Test Events acceptance pending. |
| Account balance | OFF; legacy wallet_balance is not money | Preserved immutable candidate/29-result original composed qualification. New Meta composition proves a real isolated completed ledger debit/order before Purchase. No production funding, spending, refund or reconciliation acceptance. |
| Catalog | Preserved/deferred behind supported payments | Infinite scroll and optional selected accessories remain in original qualified candidates. Original provisional108/109/111 numbers cannot be replayed. |

## Completed source and artifacts

The isolated branch `local/payments-checkout-meta-20261103` starts at the actual
live source76b4db1. `968b705` preserves exact
already-installed109/110 SQL bytes. No installed migration was rerun.
`89ea6cc` recovers pinned Pixel with hosted default/fallback and compact COD UI.
`c83d2af` implements inactive Meta; `f5e97b5` preserves private headers on disabled
dispatch. All changes are local commits; no Git push occurred.

| Independent group | Source | Archive SHA256 | Qualification |
| --- | --- | --- | --- |
| A: Checkout/Pixel inactive, app only; zero SQL | `89ea6ccfc9281ff146660471494082dc6b397608` | `3e5fc435ca6cc97053a37455b12c3ab886457edfbf609b0f3169884bb3edf1eb` | Typecheck/build, archive full readback, secret scan and 4289static HTTP byte hashes PASS. Pixel remains OFF. |
| B: Meta inactive, application + candidate111 | `f5e97b56f0d40f6decd23b4f3e9eda3f38fb6504` | `775efa472cdb39205352afc89dbee9aead4f32c37b1104b925f3892091ac2b69` | Typecheck/build, archive full readback, secret scan and 4290static HTTP byte hashes PASS. Capture/dispatch/settings OFF; worker uninstalled. |

Both retain all 4168 current immutable Nuxt assets (the old builds/latest pointer
is deliberately excluded). Only the compiled serving registry was extended.
Current build inputs are hashed and match each committed application exactly.
Group B includes A; review the incremental89ea6cc→f5e97b5 change when sequencing.
These artifact reviews are not production execution seals. H1 below is the only
current exact next production scope. Qualify/seal app cutovers against actual
post-H1 state, preserving CARD/COD, emails, tracking, MON and pending callbacks.

- [Group A receipt](../../checkout-pixel-inactive-release-20261103/release-review.json)
- [Group B receipt](../../meta-inactive-release-20261103/release-review.json)
- [Inactive Meta SQL and worker package](../../meta-inactive-release-20261103/inactive-scope-review.json)
- [Tracking contract and protected fields](../../payments-checkout-meta-20261103/source/docs/meta-commerce-tracking.md)
- [Prepared Meta activation gates](../../payments-checkout-meta-20261103/meta-activation-scope.json)
- [Prepared Pixel/Apple/wallet gates](../../payments-checkout-meta-20261103/pixel-activation-scope.json)
- [Prepared InstaPay activation gates](../../payments-checkout-meta-20261103/instapay-activation-scope.json)

## Verification and limits

All listed new qualifications have zero failures and zero skips:

- Meta native PostgreSQL17.11, real HTTP handlers, verified callback/transfer,
  balance/COD and additive migration/rollback:34 runner results. The changed
  disabled-dispatch handler was then rechecked with 8 HTTP results.
- Meta browser consent/privacy/dedup:18 results; protected Dashboard:12 results.
- Pinned Pixel actual SDK with intercepted Paymob network:18 results.
- Existing actual checkout/transfer browser suite on the changed source:
  103 results per engine, EN/AR, RTL,320/390/768/1440, light/dark. Explicit final
  handoff, uncertainty/cart retention, staff evidence, paid reload and account
  isolation included. Fake provider navigation never reached Paymob.
- Existing authoritative payment-first HTTP suite:10 results; no duplicate order
  or intention after callback replay or lost acknowledgement.
- Meta loopback worker:4 tests; external origin, redirect and secret guards.
- Inactive InstaPay operator:4 Caddy/policy + 6 guard + 3 native database results;
  exact scope/expiry/input drift and partial-write consumed-stop recovery checked.
- Both production builds/typechecks and `git diff --check` PASS. Existing duplicate
  ERP import and third-party build warnings remain visible in the saved logs.

Runner totals include their parent test containers. They are not a count of
real payments. Local financial fixtures use fresh isolated clusters only.
Earlier failed setup/build/assertion attempts remain preserved. The first Meta
artifact is superseded by group B after the compiled404cache-header correction;
it is marked NOT_FOR_RELEASE, never uploaded or substituted silently.

The 50 other original worktrees have exact saved HEAD/status/diff/index matches.
All 51 original trees remain, plus 2 owned new trees: 53 total. Main changes are only
this authorized continuity documentation. Deferred requirements are retained.
No reset, clean, blind merge or foreign-source overwrite occurred.

## Exact next production approval: inactive InstaPay host configuration

[Sealed plan](../../instapay-inactive-host-20261103/plan.json),
[review](../../instapay-inactive-host-20261103/REVIEW.md),
[approval/deadlines](../../instapay-inactive-host-20261103/seal.json).

The observed legacy general InstaPay toggle is ON, contrary to the owner's OFF
instruction. This narrow packet corrects it to OFF with one audit, admits exact
authenticated customer/staff proof routes, updates the paired Caddy/MON hashes,
signals the same Caddy PID once, pauses/resumes only MON once, and checks one
unassociated private filesystem canary as the app user. It leaves private gates,
recipient fields and customer initiation OFF. CARD/COD/core/fee10 are preserved.

Encrypted database and 17-file runtime backups passed full decrypt/readback.
Fresh input/live-state preflight passes and binds all8 warnings/3gaps, the actual
release/PIDs/schema and genuine pending activity. Any drift stops execution.
No app restart, migration, runtime change, provider call, financial action,
customer order, fake bank proof, customer email or new emergency budget is included.
A filesystem canary is not hosted authenticated proof/bank-credit acceptance.

Exact one-use approval:

```text
APPROVE INSTAPAY SCHEMA110 INACTIVE HOSTED PROOF CONFIGURATION db13c8ee8b5e99ca794d7b3d900e8ed8e6965ef96189282fe3dba113a2541923
```

Execution must start before **3November2026,20:41:18Riyadh**
(`2026-11-03T17:41:18.685Z`). The packet expires at20:56:18Riyadh
(`2026-11-03T17:56:18.685Z`). Approval alone never bypasses a fresh immediate preflight.
The owner's prompt explicitly preserves mandatory exact production approval;
that is why this concrete packet requires intervention now. No approval/apply
receipt exists and no production mutation has occurred.

After that inactive scope, fill these real fields privately in Dashboard →
Payment activity → InstaPay Settings: Recipient name (`recipient_name`), transfer
address/account (`recipient_address`), Recipient verified (only after checking),
English instructions (`instructions_en`), Arabic instructions (`instructions_ar`).
Keep Enabled unchecked. Do not place bank details or credentials in chat.
The later activation packet must bind the saved revision and actual hosted
acceptance; it cannot be sealed honestly while those real fields are absent.

After any uncertain production commit/signal, preserve STOP receipts and inspect
read-only. Never replay a consumed approval, automatically roll back, renew old
emergency budgets or restore a database over new customer activity. Preserve a
committed OFF setting and prepare exact actual-state recovery if needed.

**One immediate action:** approve the exact inactive InstaPay host packet above.

Official references checked3November2026:
[Paymob Pixel](https://developers.paymob.com/paymob-docs/developers/checkout-experiences/pixel-embedded),
[Intention API](https://developers.paymob.com/paymob-docs/intention-apis/create-intention),
[Apple Pay](https://developers.paymob.com/paymob-docs/payments-and-features/payment-methods/apple-pay-all-regions),
[Meta Business SDK API](https://github.com/facebook/facebook-nodejs-business-sdk/blob/main/src/api.js),
[Meta server events](https://github.com/facebook/facebook-nodejs-business-sdk/blob/main/src/objects/serverside/server-event.js),
[Meta user-data fields](https://github.com/facebook/facebook-nodejs-business-sdk/blob/main/src/objects/serverside/user-data.js).
Generic provider documentation does not establish this merchant's activation.
Generated 2026-11-03T12:23:42.446857+00:00; secrets and customer identifiers omitted.
