# Storefront UX and Infinite Scroll schema114 — exact production review

**READY / UNAPPROVED.** Read-only sealed preflight passed at 19:33:53 Riyadh on 4 November 2026. No deployment or production mutation has occurred. The owner's latest instruction separates this nonfinancial release from the independently tracked Apple Pay P1 escalation.

| Binding | Exact value |
| --- | --- |
| Operator seal | `0caf76d38285fecb86bc227762e34785545f55c20948d9088ce3324c1931370a` |
| Production before | `54315e37fdc74aa7`, source `388c04df15d998fcde1774b8eaddc8169a39bdd9`, physical schema113 |
| Qualified source | `ff037ddd30f7d625daf637c11065f5e980c19f1d` |
| Candidate release | `6fd67997c8feaeca` |
| Reused archive SHA256 | `6fd67997c8feaeca5ed07cb4e5fd526dee5990e824d38c40f039bc7f8a9d8e6d` |
| One migration | `20261104140000_storefront_discovery.sql`, schema113 → 114 |
| SQL SHA256 | `36a61287bd516a896b5da0c62be994924ffc271ef41f532798921bc71ad894e9` |
| Start deadline | **4 November 2026, 22:49:03 Riyadh** (`2026-11-04T19:49:03.512Z`) |
| Authorization expiry | **4 November 2026, 23:04:03 Riyadh** (`2026-11-04T20:04:03.512Z`) |
| Protected recovery | Fresh encrypted database and all 17 runtime files; full readback at 19:04:03 Riyadh |
| Inputs and assets | 1,891 sealed input hashes; 4,898 compiled/retained HTTP asset hashes already qualified |

The reviewed local operator is `../storefront-master-20261104/release-a-production-20261104/operator.mjs`; its private `plan.json`, `seal.json`, backup receipts, restored-target qualification and read-only preflight receipts are alongside it. Execution uses Node 22.23.1. No historical approval transfers to this packet.

The scope is the existing hero CMS's three layouts and mobile controls, category circles, footer refinements, and bounded infinite scroll across listing/search/brand/category contexts with filtering, retry, Back restoration and crawlable pagination. Existing mode/content and Dashboard permissions are preserved. The new infinite-scroll field defaults to enabled; Dashboard can disable it. The archive and all 769 built application inputs are reused unchanged. No application rebuild or full development-suite rerun occurred.

Approval permits one exact migration/history transaction, one archive upload/staging, one application cutover/restart, and one bounded pause/resume each for the existing MON/Email/PDC timers (180-second budget). The migration adds four columns, three constraints and one security-invoker public ranking function. It removes or rewrites no existing schema object. It performs no financial or business-row rewrite.

Apple Pay code, the local cancellation guard, CARD/COD payment logic, callbacks, runtime flags, Caddy, credentials, units, provider operations, manual workers, marketing transmission and image caching are outside this release. No charge, retry, cancellation, refund, payment-state update, new emergency budget or Git push is authorized. The unchanged Apple baseline still has the separately tracked native-dismissal/safe-retry defect.

The fresh target has **13 attempts**, including all original twelve. The thirteenth Apple attempt already existed before this preparation: created 18:34:58.954 Riyadh, EGP3050, pending/submitted, with no recorded funds, callback or linked order. One older initialized attempt has only the three replacement metadata fields changed by the installed schema113 contract; all original financial statuses, amounts, provider identities and submission evidence remain preserved. The private comparison against the earlier encrypted backup classifies this change. The new seal binds all thirteen current attempts, including all submission fences and unknown outcomes. Current global funds/callbacks/proofs remain 0; store orders are 11, Auth rows 15, and all four integrity counters are 0. This establishes no provider-side financial finality. No financial evidence was cleared.

Current CARD/COD, EGP10, exactly-once verified prepaid ordering, late authenticated callbacks, product/family data, orders, Auth/Email/PDC/MON and settings remain protected. InstaPay, wallets and balance activation remain off. Both process IDs and all 17 protected files match. Natural MON retains 8 warnings, 3 gaps and 0 critical findings; all original warning records remain. Candidate/stage paths are unused, the candidate port is free, and free capacity exceeds the established 1 GiB threshold. No monitoring policy was loosened or worker invoked.

Qualification reuses the existing storefront/browser/native/SSR evidence, 44 composed payment/family/options results, and 249 Chrome plus 249 WebKit Modern/family checks. Typecheck, build, full archive readback, secret scan and all 4,898 asset HTTP hashes remain bound to the unchanged artifact. New checks cover the operator: 52 JavaScript guards, 52 remote guards, and seven one-use/uncertain commit/transport scenarios with 54 assertions.

The fresh encrypted backup was restored into a private disposable PostgreSQL 17.11 instance. The same migration adapter passed DDL rollback and committed SQL114 plus its exact ledger row, preserving all **160 original projections**, all 13 attempts, Auth/Email/shipping and application default ACLs. The temporary database was removed. Restored namespaces were public/private/catalog/customer history/Auth/Storage/migration history/Realtime; managed GraphQL/Pgbouncer/Vault and unavailable extension services were excluded. Their production ACLs and schema remain fully bound by production guards. This was an isolated rehearsal, not a production restore. Earlier local harness setup stops are retained.

Two historical snapshot assertions are explicitly classified release exceptions: `tests/storefront-footer.test.mjs:62` compares against the preexisting privacy/social/payment changes from old commit `89743fa` and an obsolete whole-stylesheet snapshot; `tests/storefront-payments.test.mjs:121` expects the capabilities URL inline although the existing `usePurchaseAccess` composable loads it. The targeted tests fail twice on both deployed baseline `388c04d` and candidate `ff037dd`. Candidate Footer.vue and checkout source match the deployed baseline byte for byte. The assertions were not removed, skipped or weakened; current browser, capability and financial regressions are retained. Exact evidence is in `baseline-snapshot-classification.json` and the two saved logs.

Meta remains a separate inactive schema115 packet at `fd655ce`, with no Paymob dependency. Its existing worker preview remains uninstalled. A local worker-secret candidate is encrypted and verified outside Git; no production credential was written. The CAPI token is still missing; its secure input is Dashboard → Marketing → Conversions API token after approved inactive installation. Worker/runtime installation and consented Test Events/live transmission need their own exact approvals. Image caching remains a separate schema116 packet at `d6b0934` with the previously qualified cache/privacy evidence; hosted after-release measurement remains open. Their actual migration prerequisites and target bindings will be refreshed after the preceding release receipts.

All 60 existing worktrees remain; 59 other worktrees retain their heads, status, diffs and indexes. Main changes continuity documentation only. All 24,009 prior untracked hashes, 55 paused artifacts and 21,710 consumed input hashes are preserved. Vodafone SMS, InstaPay activation, wallets, customer balance and prior deferred requirements stay paused.

Execution fails closed on any seal, target, physical ledger, Auth, financial, settings, Email, footprint, lock/permission or MON-binding drift. No automatic retry, rollback, schema downgrade or restore over newer activity exists. Only previously fenced timers may resume once. If SQL114 commits before an app stop, the existing app remains compatible; any correction needs separate exact authorization.

The operator's `check` mode is read-only. After the exact owner statement, `approve` must pass a fresh check before recording authorization; `apply` consumes the attempt before mutation. `verify` performs read-only database/host/assets checks and waits for evidence from the natural monitor. No approval or apply marker exists now. This contract and AGENTS.md require fresh authorization for production changes.

**ONE next action:** reply with the exact statement below before the start deadline.

```text
APPROVE STOREFRONT UX AND INFINITE SCROLL SCHEMA114 DEPLOYMENT 0caf76d38285fecb86bc227762e34785545f55c20948d9088ce3324c1931370a
```
