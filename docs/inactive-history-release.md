# Inactive Beta and customer history release — schema91→94

Updated 2026-10-25, Asia/Riyadh. **DEPLOYMENT PASS — INACTIVE RELEASE LIVE.**
Release `bc05eef266eeb7de`, schema94, completed at **21:31:49.255 Riyadh**.
The owner approved the exact replacement seal. Its execution is consumed;
never rerun apply or reuse that approval. No historical import or public activation
ran. Current Supabase customers, orders and final paused catalog edits are preserved.
Recovery and controlled confirmation remain ACCEPTED.

## Production result and consumed approval

| Check | Verified result |
| --- | --- |
| Approval | `4c332350ae6fea14f9dabf1cc0b10d87750f5c2950fcff84b8538b570e1e9650`, recorded separately; execution intent and completion receipt retained |
| Application | `/srv/storefront/releases/bc05eef266eeb7de`; systemd `storefront` active/running after one restart |
| Schema | All94 migration identities verified; only92–94 applied atomically; original91 ledger entries preserved |
| Data/Auth preservation | All140 original transaction projections passed; final existing-data/Auth checks passed; three current customer profiles/credentials preserved |
| History security | Private RLS/grants/service-only RPC checks PASS; all five history tables empty, claims0 |
| Settings/providers | Public signup disabled, email confirmation required; purchasing/Paymob/PDC initiation closed; signed callback authority retained |
| Operational preservation | Caddy/runtime, media and private incident files unchanged; original uncertain shipment references retained |
| Execution recovery | New encrypted DB backup10,935,391 plaintext bytes;10 runtime files; authenticated decryption/full readback PASS |
| Candidate | Private schema91-compatible candidate PASS, protected APIs denied anonymous access, purchase/card flags false, current release unchanged until activation |
| Public smoke | Nine checks PASS: EN/AR home/login200, Cart/Checkout403, anonymous history GET/claim POST403, payment-capability ingress403 |
| Served assets | Six exact-byte checks PASS: three retained and three fresh bundles; full archive/retained-file integrity also checked privately by the operator |
| Prepared import | Read-only `IMPORT_CHECK_PASS`,41 batches; no import/Auth creation/claim executed |
| Git/external actions | No push, email, payment, shipment creation or other provider request from this operation |

Private authoritative receipt:
`../customer-migration-inactive-refresh-20261025/DEPLOYMENT-RECEIPT.json`.
Supporting execution files are `backup-verification.json`, `candidate.json`,
`sql-committed.json`, `activate.json`, `completed.json`, `public-smoke.json` and
`history-import-read-only-check.log` under `execution/`. The archive/source/operator
and evidence hashes below are unchanged. `REFRESH-STATUS.json` now records
DEPLOYED_INACTIVE_CONSUMED; its pre-deployment version is preserved separately.

The temporary catalog deployment pause can end. Resume only already-authorized
catalog work; no historical-customer import or feature activation is implied.
The read-only import check proves prepared-source/batch/schema compatibility,
not ownership acceptance or import approval. Its preview still has zero approved
claims. Freeze reviewed eligible IDs/evidence and the final payload before the
separate import approval; do not import then replay changed customer records.

Authenticated hosted history access remains **NOT EXERCISED**. Public403 checks
prove denial only; the private candidate returned401. Verify ordinary confirmed
customer reachability/claim/list/detail and denied cross-account cases during
guarded history acceptance. If authenticated ingress is held, review only the
required routes under a separate scoped change. Do not infer that anonymous403
proves a customer ownership flow works or bypass its authorization.

The next milestone is reviewed historical import/owned-history acceptance, then
the small returning-customer notice before public signup. PDC/refund/final order
acceptance and separate purchasing approval remain. Keep the old WordPress source
read-only. After committed SQL, any separately reviewed code rollback retains
schema94 and newer data; never restore an older full snapshot over current users.

## Current replacement deployment packet

This is the exact packet that deployed. Approval is received and consumed.

| Input / result | Exact current binding |
| --- | --- |
| Workspace | `../customer-migration-inactive-refresh-20261025/` |
| Plan | `plan.json` in that workspace |
| Replacement seal | `4c332350ae6fea14f9dabf1cc0b10d87750f5c2950fcff84b8538b570e1e9650` |
| Deployed release | `bc05eef266eeb7de`, inactive schema91→94 |
| Archive | `application.tar.gz`; unchanged SHA256 `bc05eef266eeb7de890d48ca30be562136474ddc90a8ebb91d71dcec9ea462c6` |
| Source / operator | Unchanged app `1924ca06b2bf97426aba108f6da36cb7b7bd1287`, operator `724720a50dab99f3e670798cafccfcebcb2e7c79` |
| Inventory | Unchanged digest `4645bc4640bdf81c7ef852a0098806fa09e5119d40fbec1f30e47b3fe70af93f`;2,513 entries,1,428 retained assets |
| Catalog pause | Confirmed by owner; `CATALOG-PAUSE.receipt.json` bound through qualification evidence |
| Final paused data |105 import jobs,1,262 import items,2,436 activity logs,5,723 product specifications;561 products/revisions retained |
| Current recovery | New encrypted backup/full readback:10,930,479 database plaintext bytes;10 runtime files |
| Recovery proof | Actual application/Auth/Storage restore,91→94, injected rollback and duplicate-upgrade refusal PASS;138 original protected tables/all140 transaction projections preserved |
| Freshness window |2026-10-25 20:16:59.697 →2026-10-26 02:16:59.697 Asia/Riyadh; rechecked before apply |
| Approval / execution | Original template remains `approved:false`; separate owner receipt is approved; intent/apply/completion exist, seal consumed |

The earlier backup preceded the owner's last specification/audit edits. Those
edits are included in this new backup and restored-data proof. Schema/runtime/
Auth/other business projections matched; the final seal check verified the paused
target. The expected94 schema, migrations92–94, application and operator are
unchanged. Reuse existing build/browser/tests; no rebuild or broad audit ran.
Managed Vault is excluded locally only, zero secret rows; production managed
services are untouched. Original source approval remains complete.

`qualification.json` binds the pause receipt, paused observation, drift review and
preparation helpers/logs. `plan.json` binds the qualification, current snapshots,
fresh encrypted backups, recovery proof, tools and unchanged archive/readback.
`REFRESH-STATUS.json` and `READY-REVIEW.json` record readiness. Older unsealed
refresh evidence remains under `pre-pause-evidence/`; no history was discarded.

The recorded, consumed owner approval was:

```text
APPROVE INACTIVE BETA HISTORY DEPLOY 4c332350ae6fea14f9dabf1cc0b10d87750f5c2950fcff84b8538b570e1e9650
```

The deployment pause is complete. The old6474587 seal
was approved but held before execution; its different bound data cannot authorize
this replacement plan. This is the same application/scope with current data and
fresh recovery bindings. Signup, purchasing, Paymob initiation and PDC/shipping
live requests remain closed; existing signed callbacks/current customers/orders
are preserved. No historical import or public activation is included.

## Current hold and refreshed recovery

This section preserves the earlier hold. Pause confirmation and the replacement
packet above resolved preparation and the exact replacement subsequently deployed.

The sealed operator's `checked()` comparison in
`scripts/inactive-history-release/operator.mjs` rejected the changed production
data. Initial changes affected five catalog/audit tables; the refreshed snapshot
also contained specification edits. Counts continued advancing between observations.
No guard was bypassed or changed. Schema/runtime/Auth and other business projections
matched; current catalog edits must be preserved rather than overwritten.

| Changed protected data | Original sealed count | Refreshed count |
| --- | ---: | ---: |
| Catalog import jobs |101 |105 |
| Catalog import items |1,242 |1,262 |
| Administrator activity logs |2,369 |2,391 |
| Product specifications |5,769 |5,768 |
| Products |561 |561; values changed |
| Product revisions |561 |561; values changed |

Private original approval/hold receipts are
`../customer-migration-inactive-release-20261025/DEPLOYMENT-APPROVAL.receipt.json`
and `DEPLOYMENT-HELD.receipt.json`. The original plan, false template and diagnostic
snapshots remain intact. Approval was received; execution never started.
**Do not rerun that old seal against the changed baseline.**

A separate replacement workspace is prepared:
`../customer-migration-inactive-refresh-20261025/`.
Its detached source remains724720a; app1924ca0 and archivebc05eef266eeb7de are exact
copies. No rebuild, source change, broad regression or new feature was added.
Fresh encrypted DB/runtime backups passed authenticated decryption/full readback:
10,908,495 database plaintext bytes and10 runtime files. Actual local restoration
and91→94 upgrade preserved138 original protected tables/all140 transaction
projections; injected rollback and duplicate-upgrade refusal passed. History and
claims remain zero; managed Vault remains excluded locally only, zero secret rows.

That first refresh qualified at2026-10-25 18:48:12.749 Riyadh and was unsealed
while pause confirmation was pending. Its evidence is preserved under
`pre-pause-evidence/`. The owner then confirmed the pause;45 fewer specification
rows and45 more audit rows were captured in the new baseline/backup above. The
current replacement is sealed4c332350; use its later freshness window and separate
approval. Do not rebuild the unchanged application or repeat accepted Auth tests.

Owner additions are recorded in the [customer-access plan and pending inventory](customer-access-release-plan.md).
The archive already includes ordinary-customer My Orders claims/history. The EN/AR
returning-customer notice and generic failed-login guidance are the next small
release before public signup; including them here would invalidate the frozen
build/qualification. The archive/operator are unchanged; only data/recovery
bindings caused the replacement approval seal.

## Original qualified packet — approved, held by later data drift

Private workspace, relative to the repository:
`../customer-migration-inactive-release-20261025/`.
Its source branch is `local/inactive-history-release-20261025`.
Deployment inputs are private; this report contains no credentials/customer data.

| Input | Exact binding |
| --- | --- |
| Qualified application source | `1924ca06b2bf97426aba108f6da36cb7b7bd1287`; all663 frozen application inputs unchanged |
| Operator commit, local only | `724720a50dab99f3e670798cafccfcebcb2e7c79` |
| Archive | `application.tar.gz` in the private workspace |
| Archive SHA256 | `bc05eef266eeb7de890d48ca30be562136474ddc90a8ebb91d71dcec9ea462c6` |
| Proposed release | `bc05eef266eeb7de`, schema94 |
| Inventory digest | `4645bc4640bdf81c7ef852a0098806fa09e5119d40fbec1f30e47b3fe70af93f` |
| Inventory file SHA256 | `01256037dcd4558757a6855f4bf93e4306eae382a71e4015fc91433dc6d33c3b` |
| Archive contents | 2,513 entries; 1,428 retained production client assets; every entry read back |
| Operator | `source/scripts/inactive-history-release/operator.mjs`, format11; matching database/remote modules and tests sealed |
| Deployment plan | `plan.json` in the private workspace |
| Plan seal | `6474587b004ab0a5ac9d55e04e55f1e57a73760ced15b4dd26f3314a353a801d` |
| Target | Reviewed deployment configuration: `https://elcomputer.net`, Caddy/systemd `storefront`, `/srv/storefront` |

The source approval seal70e929ee9934b1e04d149266819ef2e3403be2a3cd27c03491803ebf837608d8
is complete. Its separate receipt and original frozen inputs are bound by this
plan. Do not request source approval again. Old schema91-only operators cannot
apply this release. The original deployment template remains `approved:false`;
the separate receipt records the later actual approval. No execution intent exists.
Earlier checks passed; the final deployment check stopped on catalog data drift.

| Migration | SHA256 |
| --- | --- |
|92 — `20261024150000_card_backorders.sql` | `bb2f5f3c137f10d22a9810c9ccfe2710a768fdbe7c772ac7b57e48e1fe74c470` |
|93 — `20261024160000_unpaid_card_stock_release.sql` | `09b87054c66f1f35e49b1d25292e795570dadb03123b98da28348f94bc550987` |
|94 — `20261025120000_customer_history.sql` | `ead7c92fbd0304e765d19d479c3054383ca1d888a0140904b8017af769832c17` |

All91 preceding migration files remain unchanged.

## Original application qualification and preservation evidence

- Reused69 Beta checks,20 focused history checks and passing typecheck after
  validating unchanged source/evidence bindings. The41-batch history rehearsal
  remains valid. The whole regression suite was not repeated.
- All eight new operator checks passed: five Node and three Python, no skips.
  They cover scope, artifact binding, freshness, drift and private gate guards.
- Fresh Nuxt build passed under pinned Node22.23.1, clean environment and empty
  dotenv. The exact extracted archive passed15 HTTP checks,1,534 asset byte
  checks and eight browser checks: EN/AR, desktop/mobile and Light/Dark.
  Browser checks recorded no page errors, external or production requests.
  Ordinary analytics produced32 synthetic loopback telemetry requests only.
- A fresh encrypted production backup was restored to disposable PostgreSQL17.11.
  Original data across138 protected tables matched before upgrade. The actual
  migration transaction preserved all140 original projections, Auth security,
  existing profiles/orders/payments and original schema/ACL/function contracts.
  Target94 matched the sealed expected schema. Private history tables were empty;
  RLS/grants and service-only RPC access passed. Injected pre-commit rollback
  passed; duplicate upgrade was refused. No history import/provider request ran.
- Three signed Paymob authority source files match production byte-for-byte:
  webhook handler, Paymob adapter and request-body verifier. The existing payment
  reconciliation function is preserved. Qualified additive late-callback handling
  remains covered by retained Beta evidence. No callback replay or charge ran.

Evidence files in the private workspace: `qualification.json`,
`compiled-qualification.json`, `operator-tests.log`, `remote-tests.log`,
`recovery-upgrade-proof.json`, `expected-after-schema.private.json`,
`backup-proof.json` and `read-only-check.log`. The plan binds the fixed inputs,
operator/tool hashes, source receipt, encrypted backups and recovery evidence.

Public signup stays disabled and email confirmation remains required.
Public purchasing, controlled access grants, Paymob initiation and PDC/shipping
live requests stay closed. Existing signed Paymob callbacks remain available.
Runtime/Caddy settings, current fee, catalog publication, media/private files and
existing uncertain shipment references are unchanged. No scheduler is installed.
There are no imported historical rows, approved claims or automatic Auth links.
Current Supabase UUIDs, credentials and profiles remain authoritative.
The [source approval packet](customer-migration-approval.md) retains identity,
password-transition and exception rules for the later import.

## Original backup and recovery evidence — retained

Private encrypted backups are `backups/database-before.dump.enc` and
`backups/runtime-recovery.tar.gz.enc`. Authenticated decryption and full readback
passed:10,871,490 database plaintext bytes and10 pinned runtime files. Secrets
remain encrypted and outside Git. Future authorized execution takes another
fresh encrypted backup before any schema/application mutation.

The actual local restore verified application/Auth/Storage data and upgrade
behavior. The managed Vault extension was omitted locally:10 archive entries,
zero Vault secret rows. Its complete encrypted backup is retained; production
Vault and managed services are untouched. This is not managed-service restore
acceptance. Nineteen owner-only default ACL representations were reconstructed
locally to match the source catalog; no privileges were widened. Source UTC,
search path and server version were preserved in the fixture.

The older backup/restore qualification timestamp is
**2026-10-25 16:57:04.050 Asia/Riyadh**. The six-hour guard expires at
**2026-10-25 22:57:04.050 Asia/Riyadh**. The operator checks freshness again before
execution. After expiry, refresh recovery evidence and seal a new deployment
packet; no repeat migration source decision is required.

Previous application: `/srv/storefront/releases/58e3083f4aa6a1f8`.
Its retained archive is
`../customer-session-consolidated-20261024/application.tar.gz`, SHA256
`58e3083f4aa6a1f80cd4f18a89f9b13438c46376f4c5b7ed1f773e90140d4cdc`.

Before SQL commit, failure rolls back the transaction. After committed SQL,
preserve schema94 and all new/current data. An application-only rollback needs
separate review against that schema; the operator performs no automatic rollback.
Never restore an older full database over newer customers or transactions.
On uncertainty, preserve execution intent/receipts and inspect; never retry apply.

## Recorded operator sequence — completed, do not repeat

1. Record the exact separate owner deployment approval below. Recheck the saved
   seal, artifact/tool/source hashes, current release/schema/Auth, six-hour recovery
   age, existing data and closed gates. Any unexpected drift stops execution.
2. Create exclusive execution intent. Take and authenticate fresh encrypted
   execution backups. Stage the sealed archive without changing the live pointer.
   Run the private candidate at schema91 with purchasing/provider guards closed.
3. Recheck production. Lock and compare all140 original projections inside the
   transaction; apply only92–94 atomically. Compare preserved data, Auth security,
   empty private history and exact expected schema/RLS/RPC access before commit.
4. Verify schema94 read-only, then activate the exact application with at most
   one Nuxt service restart. Preserve runtime/Caddy/media/private files. Recheck
   the live release, required migration identities, Auth, empty history, old data,
   unchanged incident references and closed signup/purchasing/provider gates.
5. Retain receipts. Hosted authenticated owned/denied-history acceptance remains
   after deployment and separately approved import. No import, claim, public
   activation, provider transaction or Git push is included here.

The pinned Node executable is bound in private `spec.json`. This was the
pre-deployment read-only command. It expects schema91 and must not be rerun as
post-deployment qualification; use the completed receipts/read-only inspection:

```sh
release_node=/Users/imac/Documents/ELcomputer/procurement-postgrest-correction-20261018/tools/node-v22.23.1-darwin-x64/bin/node
"$release_node" source/scripts/inactive-history-release/operator.mjs check "$PWD"
```

The following command already completed once. **Do not run it again:**

```sh
"$release_node" source/scripts/inactive-history-release/operator.mjs apply "$PWD" 4c332350ae6fea14f9dabf1cc0b10d87750f5c2950fcff84b8538b570e1e9650
```

**Deployment gate complete.** Freeze reviewed claim eligibility and the final payload, obtain
separate import approval, then reconcile counts and accept verified-owner history.
The next small release adds returning-customer EN/AR guidance before public signup.
Public signup and purchasing each retain their own later acceptance/approval.
