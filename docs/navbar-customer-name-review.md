> E132,29October2026: DEPLOYED9aa61b64c2c5cf9f/schema103; approvalbfbfdf13 **CONSUMED_COMPLETE**, never replay. One app restart/0 migrations;3020 assets and next automatic02:00 MON PASS. [Deployment receipt](navbar-customer-name-deployment-receipt.md). Navbar/address/location owner visual acceptance remains pending. Approval/expiry/readiness below are historical.

# CX-NAV-01 — authenticated customer name — E131

29 October 2026. **NAVBAR READY / LOCAL PASS / SEALED READ-ONLY PREFLIGHT PASS / NOT DEPLOYED.**
No owner deployment approval, apply attempt, remote stage or production write exists.
Address-book/location owner visual acceptance remains **PENDING**, not accepted.

## Small reusable application change

New33rd worktree `../navbar-customer-name-20261029/source`, branch
`local/navbar-customer-name-20261029`, source **8d75404b9acec7b137de471e7298fe80254c48fb**,
based directly on deployed LOC-01 source34022ae. Original32 HEAD/status inventories
and11127 pending-file hashes preserved. Mainb760a25 and all Codex1/Codex2 work retained;
no merge/rebase/reset/cleanup or Git push. Nothing is built from an older main lineage.

The existing navbar shows the saved customer profile full_name. If absent, use the
CURRENT session's Auth preferred_name/display_name/full_name/name, then localized
Account. No email-derived name, invented identity or foreign-account fallback.
Existing EN/AR translations are reused. Names use escaped text and bidi isolation;
whitespace/control characters are normalized and display text is bounded/truncated.
A compact name remains visible on mobile without changing logged-out navigation.
Account/orders/cart links, departments, Account navigation and logout behavior remain.

Navbar and Account share one minimal authenticated own-profile read
(id/full_name/created_at/is_active) per Nuxt app/session lifetime. Existing Account
lookup is replaced, not duplicated. No profile/address/schema/Auth mutation or new
API route. Both components reuse the existing Supabase browser client and RLS.
Cache is private to its Nuxt app and session epoch; it is never placed in SSR payload,
local/session storage, a global cross-request cache or customer-shared data key.

Personalized rendering waits for mount. A neutral, non-animated loading placeholder
holds the navbar name while resolving. A shared request cannot inject a name/member
header before Account hydration. Session changes clear data synchronously, abort old
reads and invalidate old epochs, including A→B→A and stale JWT-claim updates. A
same-account profile refresh retains its name until the current result returns.
Lookup errors/20second timeout use the safe current-account fallback. Profile save's
existing account:profile-updated event refreshes this single shared lookup.

Only five app files change: navbar, Account layout, their shared composable/name
helper and narrow header CSS. Four focused test files cover the behavior. Server,
payment/checkout/cart/provider code, migrations, translations and dependency files
are byte-identical to the deployed parent. No new database inputs or configuration.

## Qualification

- **16 focused tests PASS /0 skipped:** own minimal projection/dedup/remount,
  synchronous clearing, late replies, A→B→A, profile refresh without blanking,
  guest/anonymous/error/foreign replies, separate app/SSR state, bounded timeout,
  safe Auth/localized fallback and existing profile/session save protections.
  The old Account-header unit scenario is retained as coverage against the real
  shared composable and actual layout/navbar, replacing its obsolete private loader.
- **17 actual-component browser checks PASS /0 skipped:** real SSR→hydration,
 12 EN/AR ×1440/390/320 ×light/dark views; stored-name precedence, visible compact
  mobile text, one shared navbar/Account query, unchanged links/logout, stale claims/
  replies, account switches, successful refresh and safe error/guest fallbacks.
  No hydration mismatch or horizontal overflow. All external browser writes blocked.
 12 private screenshots retained; Arabic320 dark inspected visually. Transport/Auth
  are local fixtures, not hosted authenticated acceptance.
- **6 release guards PASS** (5 remote/1 database), Node22.23.1 typecheck/build and
  git diff --check PASS. Browser checks found and corrected mobile CSS specificity
  and the warm-profile/Account hydration race before sealing. Earlier harness/local
  stop logs are retained; final qualified receipts govern.
- Exact archive **9aa61b64c2c5cf9ff30a891cdba54c4d76cb7e9708801adff2b71036af121da8**, bytes24740262;4001 inventory
  entries, readback and secret scan PASS. All2910 immutable parent assets retained;
  **3020 browser assets HTTP200/SHA256 PASS** against packaged Nitro. Four compiled
  owned-address APIs deny unauthenticated access401/private no-store. The existing
  seven retained-URL registry entries were restored locally, with other bytes and
  prior entries retained. No Caddy fallback/configuration change is proposed.
- Fresh encrypted **schema103** DB/full pg_restore and11 runtime/config file full
  readbacks PASS. No database restore, provider request or Merchant API Key access.

**01:52:56.908 Riyadh sealed READ-ONLY PREFLIGHT PASS**,29October2026:
production **57a5b31dd4d82156/schema103**, appPID71861/CaddyPID26652 unchanged;
exact installed bytes/certificate/schema/history/security/fixed files and original
unused emergency budget1 match. CARD-only/Manual EGP50/signup/email confirmation live.
MON enabled/active/waiting; automatic01:50:05.795 report complete/WARNING3/critical0.
Payment/ownership/duplicate/unreconciled-success mismatch counters0; overdue-unverified2
retained. No provider outcome inferred. COD/PDC booking OFF, email alerts OFF.

## Exact application-only approval

Candidate **9aa61b64c2c5cf9f**, source8d75404; **schema103 unchanged**.
Private sealed plan/operator/archive/logs: `../navbar-customer-name-20261029`.
Seal **bfbfdf13a43bf8afaf63c7487d95cec15a3e9e24dc27817997b3ee6c3e8b154c**. This is the ONE new exact approval:

```text
APPROVE CX-NAV-01 SCHEMA103 CUSTOMER NAME DEPLOYMENT bfbfdf13a43bf8afaf63c7487d95cec15a3e9e24dc27817997b3ee6c3e8b154c
```

Expires **29 October 2026,05:51:50.078 Riyadh** (`2026-10-29T02:51:50.078Z`).
Permits **one sealed app cutover and one ordinary app restart** only. ZERO migrations,
SQL/reference/customer writes, Caddy writes/signals/restarts, runtime/MON/unit/
credential/settings/stock/provider/payment/email changes or Git pushes. No transaction,
charge, inquiry, booking, pickup, cash/Treasury action or COD activation.
All previous approvals, including LOC-01 661, remain consumed and cannot be reused.

Execution must recheck exact sealed inputs/current production/expiry, consume one
local attempt, qualify loopback, switch/restart once and verify installed bytes,
schema103/private routes/CARD/Manual50, every public asset once and the next automatic
non-critical complete MON report. Reuse the asset receipt while waiting. Preserve/
rebind the ORIGINAL unused emergency-close budget1 and callbacks; create no new one.
Stop on drift/expiry/failure/partial or transport uncertainty. No retry, second restart,
automatic rollback or historical operator/migration replay; preserve checkpoints and
prepare a separately approved recovery if required.

Risk: brief restart interruption. A failed name lookup shows the safe fallback;
real hosted authenticated name/visual acceptance remains NOT EXERCISED until release
and owner review. Local checks do not imply deployed, owner or provider acceptance.

## Blockers and immediate priorities

**No navbar release blocker.** Separate owner deployment approval is the next action.
Address-book/location visual acceptance stays PENDING; it is not waived or inferred.

OD-20261029-NAV-01 confirms that after navbar the immediate work is **CX-COD-01,
CX-PAY-01 and PDC shipping/tracking**, not additional cosmetic changes. PDC must
collect the **full final cash amount**. COD activation remains **BLOCKED** until the
written currency-scale contract and booking safeguards are qualified on the actual
then-current baseline. No speculative currency conversion or booking retry. Paymob
Inquiry/history, Pay Again/payment-method/finality safeguards and PDC original-REF/
AWB/no-retry barriers remain intact. Emails/SEO/legacy redirects and all DTR-33/
STOR-01/original deferred tests remain queued, unaccepted and preserved.

**ONE NEXT ACTION:** owner sends the exact new approval above before expiry.
