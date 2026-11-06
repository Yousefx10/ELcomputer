> **CURRENT E258:** A is deployed and independently verified: `4f32e3bee6f2f137` / `e9361ea` / schema114. Operator CONSUMED_COMPLETE;never reuse the approval below. All14 attempts preserved;5,019 live HTTPS hashes and natural MON pass. Owner/device/provider acceptance remains open. [Final receipt](commerce-payment-lifecycle-schema114-deployment-receipt-20261105.md).

> **CURRENT E257,5November2026:** The owner-approved A operator installed `4f32e3bee6f2f137` / `e9361ea` / schema114 at03:03:00 Riyadh. Read-only postflight is active. The authorization below is consumed;never reuse it. [Actual deployment receipt](commerce-payment-lifecycle-schema114-deployment-receipt-20261105.md).

# E255 — Payment lifecycle and commerce release review — 5 November 2026

**LOCAL PASS. Release A sealed, production approval not recorded.**
Fresh sealed read-only preflight **PASS at 02:46:41 Riyadh**. The corrected operator preserves anonymous hosted CARD and account-scoped embedded CARD. No approval or execution marker exists.
No deployment, settings activation, provider request, financial action or Git
push occurred. This work resumes commerce only. Daftra/SMS stays owner-paused.

## Current production

Fresh pinned host/database observations confirm application `6fd67997c8feaeca`,
deployed source `ff037ddd30f7d625daf637c11065f5e980c19f1d`, physical schema **114**,
latest migration `20261104140000_storefront_discovery`, active app PID `282442`.
The final 02:46:41 Riyadh preflight preserves all 14 checkout attempts, 11 orders and 17 protected file hashes.
Recorded checkout funds and callback inbox rows remain zero. Four financial
integrity counters remain zero; MON retains eight warnings and three journal gaps.
These are local database observations, not proof that Paymob never charged.

CARD/COD, fixed EGP10, Storefront114, Modern PDP, historical product-family links,
Auth, Brevo and bounded PDC workers remain under their installed contracts.
The Storefront114 operator remains CONSUMED_COMPLETE and must never be replayed.
Meta115 is not installed; transmission stays OFF. No migration slot is reserved.

## Payment diagnosis and correction

SQL113 already removed the account-wide financial lock and scopes protection to
customer and affected product/variant obligations. The remaining browser defect
was the single retained command per account: final confirmation recovered it
before comparing the current cart/revision. A lost acknowledgement or another
tab could select an old quote and render or navigate to the old payment screen.
The conflict response also mounted the status presentation as normal checkout.

Release A retains each unacknowledged command, selects only the current cart
revision, and preserves older request evidence. Old acknowledgements cannot
consume a newer command. A relevant uncertain payment now displays an inline
status reference while cart/delivery controls remain usable. It does not mount
an SDK, hand off a hosted payment or redirect automatically on a conflict.

Server advisory locks, immutable quote authority, overlapping-obligation guards,
customer ownership, submission fences and authenticated callbacks are unchanged.
Independent baskets still pass those gates. This UI change cannot establish
financial failure or authorize another submission of an uncertain obligation.
No migration is needed for Release A on the verified schema114 target.

The previously qualified Apple guard is reused: sheet closure retains the native
document and intention; Try Again follows server `canResume`. Opening CARD/Apple
UI without pressing Pay leaves initialized state and allows immediate reuse or
safe supersession. Pixel1.2.8's prepayment hook runs before native Apple
authorization. Once that hook arms the server, dismissal remains uncertain.
There is no SDK cancellation receipt that proves no charge can occur. Vendor
bytes remain unchanged. [Official Pixel contract](https://developers.paymob.com/paymob-docs/developers/checkout-experiences/pixel-embedded).

Authenticated decline permits server-authorized retry on the existing intention.
Late authenticated success still verifies exact ownership, quote, amount,
currency and integration; creates one paid order; finalizes only purchased lines;
and records the notification once. Replayed or forged callbacks cannot create
another order. Bank finality is never inferred from age or missing redirects.
[Official callback contract](https://developers.paymob.com/paymob-docs/developers/webhook-callbacks-and-hmac/transaction-callbacks).

## The two distinct unresolved references

| Reference | Preserved evidence | Required finality |
| --- | --- | --- |
| `CHK-724EDD15767942B3` | November 3, CARD, legacy interface unknown; no recorded submission timestamp, funds, callback, order or inquiry | Its missing new metadata cannot prove it was unsubmitted. Paymob must establish transaction/authorization/capture status and whether another charge remains possible. |
| `CHK-5AB39404CFB747A4` | November 4, Apple, submission fence present; no recorded funds, callback, order or inquiry | The fence precedes native authorization. Sheet closure alone cannot release it. Paymob must establish transaction status and callback-delivery evidence. |

These attempts belong to different customers. Both remain private and auditable
in Payment Activity. No attempt, order, financial record or provider state was
cleared, cancelled or rewritten. Their same affected obligations stay protected.
Neither real reference is declared failed or uncharged.

The existing authenticated inquiry adapter was reused in separate local operator
preparation, `resume-20261105/reconciliation/`. An exact obligation-bound approval,
private durable claim, one-minute cooldown, three-check daily cap and fixed request
timeouts prevent repeated dispatch. Crash claims require review; nothing breaks
stale claims automatically. Four offline cases pass. No scheduler, customer route,
credential acquisition, production caller or database finalization is installed.

Production inquiry remains blocked on separately authorized supported merchant
access and a fresh exact provider-read scope. No credentials were requested or
printed. Empty/404 responses remain unknown. Order inquiry returns the latest
transaction; it does not prove all intention activity financially final.
[Official inquiry contract](https://developers.paymob.com/paymob-docs/developers/transaction-inquiry-apis/transaction-inquiry/by-order-id-or-reference).

## Final independent candidates

Task root: `/Users/imac/Documents/ELcomputer/commerce-reliability-20261104`.
Final artifacts are under `resume-20261105/release-{a,b,c,d}/release/`.

| Release | Source commit | Final archive SHA256 | Asset / route checks | Gate |
| --- | --- | --- | --- | --- |
| A — payment lifecycle | `e9361ea16e6e8c6bab08ce41ce34701c46097a63` | `4f32e3bee6f2f1373140e1eb2b33b6a3df4557128f29cb40f467ed3397ec19fa` | 5,019 / 13 | Sealed; approval not recorded |
| B — cart, delivery, coupons | `e3ba3b72ead34fcc71f7c6fd8ce8cd57151b74c3` | `bef28c4029ccc9b6b6604dd2489cb8afe36d07293dafd9b9e81b5e4f8756734e` | 5,142 / 15 | Locally qualified; bind actual installed A, fresh ledger and one-use operator before approval |
| C — preorder and COD capability | `e39dfa62b4b7f544b9913de8ea623f3981e0e648` | `4549faee1e3a5e3ec2fc04f22640fb825fff875d1a132bb42e741758ce5499ca` | 5,266 / 15 | Locally qualified; bind installed B and fresh operator; no activation |
| D — visuals and public-image caching | `79775a14fff04827621f21be485fc3de7997b565` | `3848511d922e0c13c49e62ec11193ff7cbeb2280c571e06da66cae94aef14450` | 5,391 / 15 | Locally qualified; bind installed C and cache recovery boundary |

All four final builds use isolated dependency caches and pass typecheck/build,
archive readback, secret scanning and compiled local HTTP checks. Prior archives,
failed shared-cache logs and successful prior isolated builds are unchanged.
No entire development suite was rerun or blanket full-suite PASS claimed.

Each source contains its predecessors. `release-scope.json` is the execution
migration list: B adds cart and coupon SQL; C adds preorder and COD SQL; D adds
image-cache SQL. Never reapply cumulative predecessor migrations from an archive's
source list. The five source identifiers are not installed/reserved live positions.
A subsequent Meta installation requires a new ordering and target reconciliation.

## Commerce work completed locally

- Account carts retain guest persistence, deterministic one-time merge, stable
  SKU/line identity, CAS versions, exact retry receipts, current price projection,
  focus refresh and cross-account/logout isolation. Verified cleanup subtracts
  only purchased lines once.
- Checkout automatically chooses the cheapest eligible delivery service, exposes
  address/delivery cards, consolidates Edit/New, refreshes authoritative totals,
  rejects stale responses and preserves the payment tab. Cart has no delivery
  selector. The final pending three-file polish was preserved and committed as
  `a1459b1`, then incorporated into the final B/C/D lineage.
- Coupons reuse actual server eligibility, discount snapshots and usage capacity.
  Dashboard controls and collapsed coupon UI are preserved. Fresh observation
  again confirms the Beta policy has `allow_coupons=false`; four real saved
  configurations were reused only as private isolated fixtures. Public opt-in
  remains a separate reviewed activation.
- C provides configurable full/deposit CARD/Apple preorders, default OFF. Quotes
  distinguish full total, charge now and remaining balance. Verified payment
  creates one held preorder; stock/fulfillment and later verified balance guards
  remain. Existing preorder email exclusion is unchanged and must not be called
  notification acceptance for deposits.
- COD supports fixed/percentage calculation using discounted goods plus eligible
  delivery before the fee itself. Numeric half-up rounding, historical snapshots,
  quote/PDC amount parity and current fixed10 are preserved. The 0.5 percent
  setting requires separate approval and actual financial/PDC collection proof.
- D reuses stable theme/hero identity, full mobile banner composition, licensed
  footer vectors, dark review contrast and qualified public-image ETag/304/HEAD,
  bounded freshness and URL-version invalidation. Dashboard controls remain.
  Auth/customer/payment/private documents are outside the cache. OFF/version
  recovery is separate from a database rollback; already-fresh browser copies
  cannot be recalled by changing the response policy.

The exact B Caddy addition allows only GET/POST `/api/account/cart` (optional
trailing slash). Fresh adaptation with the installed host binary passed; eleven
local boundary cases reject other verbs and adjacent/private paths. It remains
uninstalled. Only the supported signal contract may activate a reviewed config.
The encrypted monitor config changes only its Caddy hash and passed authenticated
full readback. No runtime values, credentials or unit definitions change.

C's deposit-aware monitor source matches the actual deployed baseline preimage
and passes 27 checks. Its exact replacement is bound in `monitor-bindings.json`;
installation must precede preorder activation. Neither config nor worker was
installed or manually invoked on production. B/C/D cannot be sealed against a
predecessor that has not actually been installed; their later fresh bindings are
release prerequisites, not authorization from this report.

## Qualification and remaining acceptance

| Evidence | Final result |
| --- | --- |
| A selection, embedded browser, native SQL, HTTP and account isolation | 73 pass, Chromium; 36 pass, WebKit; zero skips |
| Final B address/delivery/coupon plus selection | 44 pass, Chromium; address suites 39 pass, WebKit; zero skips |
| Final combined financial/cart/preorder/COD | 62 pass; zero skips |
| Deposit-aware monitor | 27 pass |
| A exact source/data scope | 44 assertions pass |
| A JavaScript / remote guard rejection tests | 45 / 39 pass |
| One-use missing/wrong approval and uncertain stage/pause/cutover fixtures | 6 scenarios / 45 assertions pass; no production connections |
| Fresh encrypted database + 17 recovery files | Full authenticated readback passes |
| Fresh schema114 backup restored in PostgreSQL17.11 | Five migrations committed/rehearsed; rollback verified; 160 projections and 14 attempts preserved; temporary DB removed |
| Prior unchanged current regression / visual-cache / Apple SDK | Reused 103 / 50 / 63 passing evidence |
| Prior unchanged compiled Modern PDP/family | Reused 249 checks in each engine |

Reused results are bound by the exact relevant source delta in
`resume-20261105/reused-evidence.json`. Counts cover separate suites and can overlap.
The older preorder shipping-job expectation still fails on the deployed baseline;
it is not reclassified as passing. Daftra's 20 broad failures and mobile invoice
failure remain untouched in its separate checkpoint.

Hosted authenticated cart/device concurrency, customer address/coupon acceptance,
real iPhone/iPad authorization/3DS/OTP, Paymob finality/callback delivery, actual
Brevo/PDC effects for new flows, preorder stock/balance acceptance, COD percentage
collection and owner visual/cache acceptance remain **NOT EXERCISED**. Local
fixtures and public anonymous checks do not replace them. These acceptance tests
follow the appropriate separately approved installation/activation.

## Read-only preflight corrections

The first unused seal stopped before approval or mutation on the existing PDC
caller (`ExecMainStatus=1` at 02:39:15 Riyadh). Independent service/journal reads
confirmed natural success at 02:40:16 and02:41:18; no timer or worker was invoked.
The next read-only check exposed a draft operator assertion expecting anonymous
embedded CARD. The installed capability contract correctly returns hosted CARD
without an authenticated customer; embedded CARD/Apple remain account-scoped.

A separate replacement operator corrects that expectation. New fixtures prove
hosted anonymous capability passes and unexpected anonymous embedded capability
stops. Its 45 JavaScript/39 remote guard checks and six one-use scenarios pass.
The old unused seal and both failed preflight observations remain preserved.
Application source,archive,backup and financial contracts were not changed.

## Exact Release A production gate

Packet: `../commerce-reliability-20261104/release-a-final-ready-execution/`.
Seal: `bdbb3d386f2bc552bc8b25a8f5f7f1d143e72a20d971407506f2942707b58c98`.
Candidate application: `4f32e3bee6f2f137`.

Permitted only after fresh exact approval: stage one sealed archive; one app
cutover/restart; pause/resume existing MON/Email/PDC timers at most once each
within 180 seconds. Preserve schema114, all real attempts, protected files,
CARD/COD/fixed10 and existing workers. SQL, runtime, flags, Caddy, units,
credentials, providers, financial operations, manual workers, marketing, cache,
visuals, coupon/preorder/COD activation and Git push are outside A.

The guarded operator consumes the attempt before mutation. On uncertain staging,
cutover or restart it stops; no replay, automatic retry/rollback or database
restore over customer activity. Only fenced existing timers may resume once.
Postflight must verify all asset hashes, exact installed state, private/public
method contracts, preserved schema/financial evidence and the next natural MON.
If STOP occurs, inspect actual installed state independently before fresh recovery.

Execution must **start before 06:16:21 Riyadh on 5 November 2026**.
The packet expires at **06:31:21 Riyadh**. Drift or expiry requires a new packet,
not an edited seal or reuse of historical approval. No approval/apply marker exists.

Exact approval:

```
APPROVE COMMERCE PAYMENT LIFECYCLE SCHEMA114 DEPLOYMENT bdbb3d386f2bc552bc8b25a8f5f7f1d143e72a20d971407506f2942707b58c98
```

## Preserved source and safe continuation

All 61 original worktree HEADs/indexes and 23,999 original untracked hashes passed
preservation. Sixty original worktrees outside main retain exact statuses/diffs.
There are now 65 worktrees. The four owned commerce worktrees are clean:

- Original combined source: `commerce-reliability-20261104/source`, `a1459b1`.
- Original preorder/COD source: `preorder-source`, `93e9d23`.
- New A: `resume-20261105/payment-source`, branch `local/payment-final-20261105`,
  `e9361ea`.
- New combined: `resume-20261105/commerce-source`, branch
  `local/commerce-final-20261105`, `79775a1`.

The old pending patch, original source copies, four original archives and all
success/failure receipts remain untouched. Main retains continuity documentation;
it is not the application deployment lineage. No Git push occurred.
Daftra/SMS stays independently paused at `b782b13`; its builds, failures and
unfinished guards are preserved. Meta's uninstalled inactive packet and encrypted
candidate remain independent and require fresh source/ledger/expiry bindings.

**ONE next action: approve the exact Release A packet within its valid window.**
Your resumed local-work request and historical documentation do not authorize
production. This gate follows your explicit mission and `AGENTS.md`.
