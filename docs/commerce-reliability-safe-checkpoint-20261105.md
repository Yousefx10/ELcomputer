# E254 — Commerce reliability safe checkpoint — 5 November 2026

**PAUSED BY OWNER at 01:41 Riyadh (2026-11-04 22:41 UTC).**
The owner requested an immediate stop and a handoff to another Codex.
Implementation and local checks have ended. No owned background process remains.
Resume only after the owner requests continuation. This checkpoint grants no
deployment, settings activation, provider operation or Git push approval.

## Production and payment evidence

Latest pinned read-only observation: **01:35:55 Riyadh, 5 November 2026**.
Production remains app `6fd67997c8feaeca`, deployed source
`ff037ddd30f7d625daf637c11065f5e980c19f1d`, physical schema **114**, latest
migration `20261104140000_storefront_discovery.sql`, app PID `282442`, active.
The newest actual deployment receipt is
[Storefront114](storefront-ux-discovery-schema114-review-20261104.md),
**CONSUMED_COMPLETE**. Never replay that operator or reuse its approval.
Main's `20ee8212` HEAD is not the deployed application lineage.

There are 14 checkout sessions/attempts, 11 orders, zero verified checkout funds
and zero callback inbox records. Every opening attempt row and all 17 protected
runtime/configuration file hashes matched the closing observation. No financial
record was cleared or changed by this work. CARD/COD, fixed EGP10, Auth, Brevo,
PDC and existing monitoring remain under their current production contracts.

| Reference | Local evidence | What remains unknown |
| --- | --- | --- |
| `CHK-724EDD15767942B3` | EGP325, CARD5904482, pending, legacy `interface_state=unknown`; no submission timestamp, order, callback, funds or inquiry result | It predates the new interface metadata. A missing timestamp cannot establish that no charge was submitted. Paymob finality is unverified. |
| `CHK-5AB39404CFB747A4` | EGP325, Apple6038812, pending, `interface_state=submitted`; fence at 2026-11-04 13:27:17 UTC; no order, callback, funds or inquiry result | Pixel's prepayment hook runs before native Apple authorization. Sheet closure does not establish a nonchargeable outcome. Paymob finality is unverified. |

The references belong to **different customer accounts and carts**. Account IDs,
provider identifiers and raw evidence remain private. Neither attempt is proven
uncharged. Absence of callbacks is not provider finality. No inquiry, charge,
refund, cancellation, new production intention or external support message was
sent in this workstream.

The persistent status screen reflects unresolved financial evidence. Schema113
already removed the global customer lock and scopes protection to affected
obligations/SKUs. Its initialized-form supersession, authenticated decline retry,
immutable quote, exactly-one-order and late-success paths are reused and tested.
The genuine new UI defect was Apple's cancel callback navigating away from the
current native document. The recovered guard preserves the document/intention,
shows sheet closure, and offers Try Again only when the server permits it.
It cannot safely declare either real reference failed.

Pixel1.2.8 and the existing Apple/Caddy corrections remain intact. Local WebKit
qualification is not physical iPad/iPhone or merchant acceptance. Continue the
existing Paymob case with authoritative transaction and callback-delivery
evidence; do not attribute the behavior to Saudi Arabia or invent SDK fixes.
The relevant contracts remain [Pixel Embedded](https://developers.paymob.com/paymob-docs/developers/checkout-experiences/pixel-embedded)
and [authenticated transaction callbacks](https://developers.paymob.com/paymob-docs/developers/webhook-callbacks-and-hmac/transaction-callbacks).

## Implementation report

All implementation below is local. **Nothing from this milestone is deployed.**

| Area | Root cause | Reused work | Implemented | Tests | Deployed | Remaining |
| --- | --- | --- | --- | --- | --- | --- |
| PAY-REL-01 | Legacy unknown outcome; Apple fence precedes native authorization; cancel navigated away | Schema113 lifecycle, Pixel1.2.8, qualified Apple guard | Preserve document/intention; accurate closed/uncertain copy; server-authorized retry | 63 Apple/interface checks; 62 combined financial cases | No | Provider finality, physical device acceptance, fresh sealed deployment |
| CART-SYNC-01 | Browser carts did not synchronize accounts across devices | Existing public catalog, identity, customer scope and cart UI | Private server cart; CAS versions and exact retry receipts; stable SKU/line identity; visible conflicts; focus/15-second refresh; deterministic guest merge; logout isolation; paid-line subtraction once | Real H3/PostgreSQL/Vue two-device, queue and account-isolation checks within 62 cases | No | Proxy installation and hosted cross-device acceptance |
| CHK-DEL-01 | Cart contained a misleading delivery selector; saved addresses were hidden; totals refreshed late | Existing owned address CRUD, mapping, PDC/manual shipping contracts and quote service | Remove cart selector; visible address/delivery cards; cheapest eligible service; adjacent Edit/New; authoritative debounced totals; stale-response rejection | 39 address/delivery/coupon browser checks per engine; 107 checkout matrix checks per engine | No | Three final source files are pending; recompose/build/package final B/C/D |
| COUPON-REL-01 | Current Beta runtime explicitly has `allow_coupons=false` | Existing coupons, normalization, fixed/percentage/delivery discounts and redemption ledger | Explicit opt-in support; clear disabled/invalid/expired/exhausted messages; optional category/customer limits; locked capacity at submission; collapsed disclosure with retained active code/discount | Four actual saved configurations copied into isolated fixtures; monetary/capacity checks; collapsed/apply/remove browser checks | No | Separate reviewed runtime opt-in and hosted acceptance; no commercial records changed |
| PREORDER-REL-01 | Historical preorders require manual methods; payment-first exposes CARD/COD | Product full/deposit terms, allocation/stock guards, signed funds and finalization | Owner-selected CARD/Apple path, default OFF; explicit consent; freeze full total and initial payable amount; one held preorder after verified funds; partial balance; explicit verified balance method; stock release requires real units | Native/HTTP full/deposit CARD and Apple, forged/duplicate callbacks, caps, term changes, late success after OFF, cart cleanup and release; 27 monitor tests | No | Activation, genuine merchant acceptance and hosted stock/balance acceptance; existing preorder email exclusion preserved |
| COD-FEE-01 | Fee supported only fixed EGP10 | Existing quote/order/PDC amount contracts | Enabled/fixed/percentage controls; numeric half-up rounding of `rate × (discounted goods + delivery)`; no fee recursion | Fixed10, 0.5%, discounts, OFF, bounds, quote drift and PDC amount regression | No | Saved fixed10 remains; 0.5% needs separate settings and financial/PDC collection acceptance |
| SF-VIS-REL-01 | Hero reset on refetch/theme; narrow cover cropped composition; weak social artwork/review contrast | Existing hero, authored mobile/focal controls, Dashboard identity and vector icon system | Stable hero identity; full mobile/tablet composition; compact captions; licensed Bootstrap WhatsApp/YouTube vectors; semantic review colors | 50 visual/cache cases; Modern PDP/product-family 249 checks per engine | No | Hosted and owner visual acceptance |
| IMG-PERF-20261104-01 | Qualified cache candidate remained separate | Recovered `d6b0934` implementation | Public VPS image ETag/304/HEAD; bounded freshness/OFF; version invalidation; Dashboard controls and bounded process diagnostics | Repeat-byte savings, invalidation, private/invalid denial and browser tests | No | Reviewed migration/app installation; independent OFF/version recovery and owner acceptance |

Authenticated carts store identities, quantities, stable line IDs and coupon code,
then project current public prices/options. SQL versions and owner locks prevent
stale overwrites. A lost acknowledgement retries its original UUID. Guest merge
uses maximum duplicate quantities and existing server line identity, skips
unavailable/incompatible items visibly, and runs once per guest revision.
Account A never becomes account B's guest import. Logout clears visible private
state without deleting the actual server cart. Quotes retain monetary authority.

Coupon submitted/unknown obligations reserve capacity; unsubmitted forms do not.
Lifetime usage is not automatically released on cancellation/refund. Preorders
remain separate from normal baskets and do not accept coupons. Deposit orders
retain the full value and actual partial payment; the unpaid balance is visible.
The new preorder flag defaults false. The paired MON-01 source recognizes a
verified linked deposit while retaining signature, amount and duplicate alarms.
Its reviewed worker binding must precede preorder activation.

For the proposed COD policy, an EGP250.70 base produces EGP1.25 and EGP251.95
payable; an EGP325 base produces EGP1.63. Existing historical fees remain immutable.
Installation defaults to enabled/fixed/current EGP10 and percentage zero.

Caching covers validated public VPS image bytes only. It adds no transformations,
browser quota promise or server transformation store. Auth/cart/order/payment and
private/signed documents remain uncached. OFF changes future response policy;
version changes invalidate newly generated public URLs. Cache diagnostics are
bounded process counters, not a guaranteed count of browser cache hits.

## Saved source and pending changes

Task root: `/Users/imac/Documents/ELcomputer/commerce-reliability-20261104`.

| Scope | Commit | Saved source |
| --- | --- | --- |
| A — payment navigation | `8bd28e4d17c539209b4ac58964d8929151b57234` | `release-a/source` |
| B — cart/checkout/coupons/preorder | `14756001897453a6807280097f1d14ce63221b26` | `release-b-preorder/source`; branch `local/commerce-preorder-card-20261105` |
| C — B plus COD capability | `93e9d239b4b5cbfa4ca4e7a531a7190b0b2c7f30` | `release-c-preorder/source`; clean owned `preorder-source`, branch `local/commerce-cod-after-preorder-20261105` |
| D — combined compatible source | `dcded3f5e149e63aeeebca294b3e3b198dbfc29d` | `release-d-preorder/source`; owned `source`, branch `local/commerce-reliability-20261104` |

Earlier group commits remain: `da69a18`, `a049f79`, `e6e00ca`, `c9f5ba3`,
`e6d04ab`. No main application source, original worktree or Git index was reset,
overwritten, merged or pushed.

**The combined owned `source` is intentionally dirty in exactly three files:**

- `app/pages/checkout/index.vue`: consolidate Edit beside New Address; remove
  obsolete dropdown state; keep the applied coupon code visible when collapsed.
- `tests/checkout-address-book-browser.test.mjs`: visible-card selectors,
  Chromium/WebKit, cheapest delivery/quote change and coupon disclosure cases.
- `tests/checkout-address-summary-browser.test.mjs`: visible-card and engine checks.

These pending changes passed **39 tests in each engine** before the stop.
They are not committed, ported into standalone B/C, rebuilt or repackaged.
The four saved archives match the commits above, not this final pending patch.
Recover exact bytes from `checkpoint/pending-working.patch`,
`checkpoint/pending-source/` and `checkpoint/state.private.json`. Preserve the
working tree; do not reset it or apply that patch blindly over later edits.

New application files include `accountCartSync.js`, `CartSyncNotice.vue`, the
private cart API and SQL, coupon capacity helpers, preorder SQL and safety docs,
COD numeric helpers, recovered image-cache utilities/API controls and licensed
vector artwork. Existing checkout, useCart, payment views, Dashboard settings,
coupon management, EN/AR strings, hero/footer/review components and MON-01 source
were extended. Exact changed-file scope is available from each committed diff
and the saved pending patch.

| Migration source identifier | Scope |
| --- | --- |
| `20261105010000_customer_carts.sql` | Private account carts, receipts, service RPC and verified cleanup |
| `20261105011000_coupon_capacity.sql` | Coupon category/customer limits and submission capacity |
| `20261105012000_preorder_card_payment_first.sql` | Inactive CARD/Apple full/deposit capability |
| `20261105020000_configurable_cod_fee.sql` | Fixed/percentage fee capability preserving current settings |
| `20261105030000_public_image_cache.sql` | Recovered public cache settings |

These are source identifiers. **No production physical positions are reserved.**
Meta115 remains uninstalled; recheck the actual ledger and source ordering before
any release. The local restored rehearsal's ledger is not a production slot claim.

## Qualification and packet boundary

Node22.23.1 was used. Latest relevant evidence is saved under the task root.
Counts describe separate suites and can overlap; no blanket full-suite PASS is claimed.

| Evidence | Result | Receipt/log |
| --- | --- | --- |
| Combined financial SQL/H3/cart/browser | 62 pass | `composed-financial-native-result.json`, `.log` |
| Current CARD/coupon/PDC/Brevo/options/family/inquiry | 103 pass | `composed-regressions-result.json`, `.log` |
| Payment-first/preorder/transfer EN/AR, widths320–1440, light/dark | 107 pass in Chromium; 107 in WebKit | `preorder-browser-chrome-result.json`, `preorder-browser-webkit-result.json` |
| Pending address/delivery/coupon polish | 39 pass in Chromium; 39 in WebKit | `address-cards-complete-result.json`, `address-cards-webkit-complete-result.json` |
| Hero/theme/footer/review/cache | 50 pass | `composed-visual-cache-result.json`, `.log` |
| Compiled Modern PDP/family/actual catalog save/conflict | 249 checks per engine | `composed-modern-chromium-result.json`, `composed-modern-webkit-bounded-result.json`; browser directories |
| Apple actual SDK/interface checks | 63 pass | `apple-fixed-result.json`, `.log` |
| Deposit-aware MON-01 source | 27 pass | `monitor-final.log` |
| A exact scope, guard and one-use fixtures | 42 scope; 43 JS +39 Python; 6 scenarios/45 assertions | `release-a-execution/*qualification.json` |
| A/B/C/D Nuxt typecheck and build | All pass for listed commits | A `build-results.json`; B/C/D `build-results-isolated.json` |
| Fresh encrypted DB/runtime backup and authenticated complete readback | PASS; 17 recovery files | `release-a-execution/backup-verification.json`, encrypted `backup/` |
| Actual schema114 backup restored locally; five migrations, commits and DDL rollback | PASS; all 160 original projections/14 attempts preserved; temporary DB removed | `release-a-execution/migration-qualification.json` |

The first concurrent builds collided in a shared dependency cache. Failed logs and
outputs are retained. New isolated dependency caches were used for all final B/C/D
builds. The first compiled WebKit PDP run hit its ten-second navigation deadline;
the preserved rerun allowed a bounded thirty seconds for navigation and passed
all 249 unchanged state assertions. No production timeout was changed.

The older preorder test expects an automatic shipping job and fails unchanged on
deployed `ff037ddd`. That baseline failure is preserved, not called a pass.
The test-only Brevo timer harness was corrected; current transport checks pass.
Codex1's separate 20 broad failures and invoice mobile failure remain untouched.

Four archives have complete readback, secret scans, retained serving-registry
repair and local compiled HTTP/hash checks:

| Review candidate | Archive SHA256 | Compiled public asset hashes | Route/privacy checks |
| --- | --- | --- | --- |
| A | `d7fce4233d2852631d830e84df35e0e131101eebb06f801b0961a9acbf6843d0` | 5,019 | 13 |
| B | `c3e5d531ab18f04542cf03b6acd3926d327e48a1accfd5032f0780334dd3ff8a` | 5,142 | 13 |
| C | `e4037546113337d4a38012b30bbda6b761a649bcabd55a90dd04776022983590` | 5,266 | 15 |
| D | `83d0cefcbbe9da635c591c3cc7db47c006ab7bee8ac1a1b01652a287e6f8d9ec` | 5,391 | 15 |

Archives are `release-a/release/application-review.tar.gz` and
`release-{b,c,d}-preorder/release/application-review.tar.gz`.
Each has `release-review.json`, `inventory.json`, `assets.json` and
`compiled-smoke.json`. B retains A/current immutable assets; C retains B;
D retains C. Source ordering must match actual installed predecessors.

**These are review candidates, not ready production approvals.**
`release-a-execution/` contains copied/adapted guarded tools, passing local
qualifications, fresh read-only bindings, encrypted backup and restored rehearsal.
`prepare-plan.mjs` was written but **never executed**. There is no real
`plan.json`, `seal.json`, owner approval, apply marker, execution intent or cutover
receipt. Fixture approvals exist only in offline test directories. Never transfer
them into the real operator directory or execute an unsealed draft.

Remaining release preparation: commit/recompose the pending checkout polish;
freeze/rebuild affected B/C/D; bind exact current predecessors and physical SQL
ledger; refresh recovery evidence when stale; qualify each final scoped operator,
proxy/worker changes and one-use stops; produce a fresh seal before requesting
an exact approval. Hosted postflight and owner acceptance follow separately.
No expired or historical approval authorizes any step.

B also needs the exact restrictive GET/POST `/api/account/cart` Caddy addition,
paired deposit-aware MON worker binding and separately reviewed coupon policy.
The Caddy candidate passed syntax adaptation with the actual host binary and is
uninstalled. Its proposed hash and preimage are saved privately in
`cart-routing.private.json`. Do not assume systemd reload support; preserve the
existing monitor Caddy-hash and supported-signal contracts. No Caddy signal or edit
occurred. Preorder enablement and COD0.5% remain separate activation scopes.

## Preservation and exact continuation

All **61 opening worktrees** remain registered and retain their original HEADs
and indexes. The 60 original worktrees other than main retain exact statuses and
diffs. All 23,999 original untracked hashes are preserved. There are now **63**
registered worktrees, including the two owned commerce worktrees. Main contains
continuity documentation only. The pending three-file patch is preserved as-is.
See private `checkpoint-preservation.private.json` for the final audit.

Codex1's Daftra/SMS is still independently **PAUSED BY OWNER**, clean at
`b782b13785b08d72dc718aa914456bb73bab4b96`, under
`/Users/imac/Documents/ELcomputer/daftra-sms-20261104/source`.
Its four builds, partial archive, 20 failing regression cases, mobile invoice
viewport failure, incomplete release guards and encrypted/private artifacts were
not resumed or overwritten. The exact resume path is
[its original checkpoint](daftra-sms-safety-checkpoint-20261104.md), then
`/Users/imac/Documents/ELcomputer/daftra-sms-20261104/CHECKPOINT.md` and
`owner-pause.json`. Resuming commerce does not resume Daftra/SMS.

Meta remains uninstalled and transmission OFF. Its existing inactive packet and
encrypted worker-secret candidate are preserved, unspent and subject to fresh
target/expiry/source/ledger checks. Its missing CAPI token and hosted acceptance
remain separate. No Meta work, event transmission or marketing worker ran.

On an explicit resume, read mandatory continuity docs, this report and
`/Users/imac/Documents/ELcomputer/commerce-reliability-20261104/CHECKPOINT.md`.
Inspect both owned Git statuses and `checkpoint/state.private.json` before any
mutation. Preserve all passing/failed evidence and consumed operators. Recheck
live lineage read-only; complete pending local source integration before sealing.
Do not reset, blindly merge, replay deployment, automatically roll back or infer
financial/provider acceptance from these fixture checks.

**ONE next action: give the next Codex this checkpoint when requesting resumption.**
