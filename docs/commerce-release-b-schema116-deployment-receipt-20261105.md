# Release B schema116 deployment receipt — 5 November 2026

**DEPLOYED / technical PASS / CONSUMED_COMPLETE. Owner/provider acceptance remains open.**

| Binding | Previous A | Installed B |
| --- | --- | --- |
| Application | `4f32e3bee6f2f137` | `bef28c4029ccc9b6` |
| Source | `e9361ea16e6e8c6bab08ce41ce34701c46097a63` | `e3ba3b72ead34fcc71f7c6fd8ce8cd57151b74c3` |
| Physical ledger | 114 | 116 |
| App PID | 295093 | 308821 |

Original one-use forward seal: `3fd11398539b8a7ae2cbf904b89d8b341642018e49ce95080ce35d10e7130722`.
Archive SHA256: `bef28c4029ccc9b6b6604dd2489cb8afe36d07293dafd9b9e81b5e4f8756734e`. Existing qualified archive/source reused;
no rebuild, upload, extraction, second candidate launch or isolated-fixture replay.
The already staged B candidate was rehashed and adopted once, its old certificate
preserved, and its certificate rebound once to the new seal.

The two exact existing SQL files committed in one atomic transaction at
08:41:28 UTC / 11:41:28 Riyadh. Actual installed source/security footprint passed:

| Migration | SHA256 |
| --- | --- |
| `20261105010000_customer_carts.sql` | `b3f4c3fc75bb86a32466d833ad2dcf4978835503fb009ca19abfdb362f97682a` |
| `20261105011000_coupon_capacity.sql` | `5b1a27a5250eb2c689bc16d53d8de78189abbe1da871de6e09594958c58ba9d3` |

Two exact history rows added; latest identifier `20261105011000`. Physical schema
slots 115/116 are now B's cart/coupon changes. Meta's historical 115 label does not
represent an installed Meta migration; Meta remains uninstalled/transmission OFF.

App/routing cutover acknowledged at 08:41:44 UTC / 11:41:44 Riyadh: one app restart,
one production Caddy SIGUSR1, no Caddy restart. Caddy PID 26652 stayed unchanged.
Only GET/POST `/api/account/cart` with optional trailing slash was added to the
reviewed access expression. The monitor config changed only its Caddy hash; the
monitor worker and all runtime settings/flags/unit definitions/credentials stayed
unchanged. Of 17 protected files, only the two approved Caddy/MON bytes changed;
all modes/owners stayed identical. Loaded app environment exactly matches the
unchanged runtime configuration. MON/Email/PDC timers each paused/resumed once,
for 54.36/54.32/54.28 seconds respectively, inside the 180-second bound. They are
active/enabled and existing natural callers report success. No manual worker call.

## Verification

- Physical116, full expected schema/RLS/ACL/function/index footprint and all 160
  original data projections PASS. All 14 attempts preserved exactly; 11 orders,
  0 checkout funds/callbacks/proofs, all four integrity counters zero.
- Independent financial audit rehashed nine original financial projections and
  verified original114 history plus the two exact B source SQL rows.
- All 5142 canonical live HTTPS asset body hashes PASS at 08:46:39 UTC. Original
  source's 1698 inputs match the qualified build; no blanket full-suite claim.
- Fourteen additional public method/privacy checks PASS: EN/AR storefront/cart,
  anonymous checkout/Apple login redirects, authenticated cart GET/POST and existing
  payment-checkout/interface/proof endpoints 401 with private no-store/no-referrer.
- Natural MON at 08:45:05 UTC / 11:45:05 Riyadh after cutover: 8 existing warnings,
  3 existing gaps, 0 critical; exception identities/evidence unchanged. No manual MON.
- Original operator recorded CONSUMED_COMPLETE at 08:48:56 UTC / 11:48:56 Riyadh.
  Independent host/runtime/timer/financial closeout PASS at 08:49:22 UTC.
- Local forward controller 83 JS / 89 Python guards and 8 one-use scenarios/64 assertions
  PASS. Corrected exact-baseline restored DDL rollback and real atomic executor
  PASS on PostgreSQL17.11 with actual business/Auth data. Previous exact-B local
  cart 15, coupon/Beta 6, Chromium 44/WebKit 39, typecheck/build and compiled 15-route /
  5142-asset evidence were reused for unchanged bytes.
- One obsolete order-first initiation subtest and its parent still fail identically
  on A and B. The mismatch and original logs remain; no financial guard was relaxed.

## Delivered scope and boundaries

B installs authenticated cart persistence and safe guest merge; saved-address cards
with New Address beside Edit; cart delivery selector removal; selectable checkout
delivery cards; cheapest eligible default; immediate authoritative quote refresh;
collapsed coupons and the existing capacity infrastructure. Beta `allow_coupons`
remains false. Hosted customer/cross-device/address/delivery acceptance is still
owner-controlled and unexercised; local/browser/public checks do not establish it.

CARD/COD/fixed EGP10, scoped Apple/Pixel1.2.8, payment-first semantics, PDC, Brevo/
Email, MON, Auth/security, original financial evidence and all 65 worktrees remain
preserved. C/e39dfa6 and D/79775a1 sources/archives are unchanged and independently
gated. Subsequent releases need fresh current116 source/ledger/asset binding.
Meta is OFF/uninstalled. Daftra/SMS stays paused at b782b13, including its 20 prior
failures/mobile issue. No Git push or unrelated integration activation occurred.

## Consumed and expired history

Original B 7a461ec8 expired unused. Replacement 3f542aff staged B and passed its
actual-binary 13-case isolated Caddy fixture, then stopped before SQL commit because
the prepared expected schema inherited 31 restored owner-ACL representations and
four differently qualified pg_trgm index definitions. I missed exact baseline
fidelity in the earlier qualification. Its uncommitted transaction rolled back;
independent reads proved schema114, all original security/data and attempts
unchanged; existing timers resumed once. No app/Caddy cutover occurred under it.
That CONSUMED_STOP and all old receipts remain intact and were never replayed.

The approved forward packet corrected only local fixture fidelity and stage
adoption. It reproduced the precise production baseline in the isolated restore,
required full raw schema equality before DDL, reconstructed expected production
plus only B's delta, and explicitly rejected the old expectation in regression.
No live ACL/index repair or ignored differences. The successful original 13-case
proof and its binary/config/receipt bindings were preserved rather than replayed.
No committed database rollback, automatic restore, signal/restart retry or new
financial action occurred. Current forward seal is now CONSUMED_COMPLETE: never
approve/apply, rebind, repeat SQL, signal, restart or restore under that approval.

## Separate Apple reconciliation — PAY-REL-02

`CHK-5AB39404CFB747A4` remains submitted/pending and financially unknown. It correctly
matches the same Black Fantech GO W190 variant in the previously audited quotes.
A different published SKU passed the conflict predicate. B preserves that financial
hold; no failure, retirement, cancellation, refund, deletion, duplicate intention,
false paid order or live Paymob inquiry was performed.

A fresh **separate**, read-only inquiry packet is now bound to physical116 and the
unchanged exact attempt/merchant/intention/order references. Directory:
`/Users/imac/Documents/ELcomputer/commerce-reliability-20261104/resume-20261105/reconciliation/exact-inquiry-schema116-20261105`.
Eight offline operation tests and fresh DB binding check PASS. It permits one
order inquiry after one auth request, 10-second timeouts, zero automatic retries,
shared durable 3/day and 60-second limits, normalized/digest-only audit, no database/
financial writes, and no provider mutations. Management credential must be supplied
privately via owner-controlled FD3; it was not read/provisioned by this release.
It still needs its own fresh exact approval; this B approval cannot authorize it.

```text
APPROVE CHK-5AB39404CFB747A4 PAYMOB READONLY INQUIRY 56c98e33bdd04b9ee8abb06cdb0f5b31a280644920ac52c471bea2119f6d858f
```

Inquiry expiry `2026-11-05T10:47:47.870Z` / 13:47:47 Riyadh. No request-intent exists;
provider escalation is prepared privately, not sent. Older inquiry packets remain
expired and preserved. Latest-transaction failure/absence does not establish whole-
intention nonchargeability. Existing paid-order reconciliation or a separately
qualified terminal-state procedure depends on authoritative provider evidence.

**ONE next action:** owner signed-in acceptance of the cart/address/delivery flow
on two devices, without submitting a new payment for the held obligation. Physical
Apple/3DS/OTP and Paymob finality remain separate acceptance/authorization gates.

Evidence directory:
`/Users/imac/Documents/ELcomputer/commerce-reliability-20261104/release-b-forward-execution-20261105`.
Key receipts: `migration-committed.json`, `cutover-complete.json`,
`postflight-database-verification.json`, `postflight-assets.json`,
`hosted-method-postflight.json`, `consumed-complete.json`, `independent-closeout.json`.
