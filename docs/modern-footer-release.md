# Modern Footer 87→88 release preparation — 2026-10-21

**PREPARATION PASS. Final production execution is NOT approved or performed.**

The owner approved preparing a separate guarded release for application commit
`8181953a7678b36fd4643d1ce52a0b96f65d8136` and migration 88. This is a new binding
through the established Caddy/systemd phases. Completed 82→85 and 85→87 tools,
certificates and seals remain unchanged and are never invoked by this release.
This preparation performed no production staging, migration, activation, restart,
configuration edit, provider request or Git push.

## Exact candidate and scope

| Binding | Value |
| --- | --- |
| Application commit | `8181953a7678b36fd4643d1ce52a0b96f65d8136` |
| Existing release/schema | `d2d7a8029b473e4a` / 87 |
| Candidate release | `d1b10bb664e15a67` |
| Final plan digest | `768e8bdcc7a50dc5f8586ba907edde10a8e8a6a9261248668c4426918fcda214` |
| Migration 88 SHA256 | `4ebb4fc58ccd274116ab8c5f3a254cb3e1270489cf556f61abace0cbcc2db331` |
| Release archive | 7,319,708 bytes; 1,468 inventory entries |
| Retained immutable client assets | 428, each independently checked |
| Production mutations/deployment attempts | 0 / 0 |

| Verified artifact | SHA256 |
| --- | --- |
| Output archive | `d1b10bb664e15a6721d863ba05837a325f4f2764ba889ef8e36b5d31618c6a34` |
| Output inventory | `d07eb8ed79f67bfaf2fd8643962a543de3d3be746d278d2c3951a01332973ea8` |
| Encrypted database backup | `f3e21c094e7c5958753a1b6ff4d50fdd3a6ec8ceb5374b37d82a7393faa9492a` |
| Encrypted runtime backup | `400387305a9e0302a76edd9a07c159216f5258ebcde096c858a3410274c993f1` |

The private target configuration binds the existing machine, strict SSH identity,
database/TLS identity, `/srv/storefront`, `storefront.service`, runtime environment,
decoder, private directories and accepted Caddy configuration. No application
store identity or deployment target is hardcoded in reusable application logic.

Use only `prepared-final/plan.json`. The earlier `prepared/` seal was superseded
before execution. Activation and preparation runtime receipts use separate,
exclusive paths; the receipt preservation test passes.

The new `scripts/footer-release/` operator permits only 87→88. It verifies the
exact 88 migration membership/source bytes, all original 87 identities/statements,
the approved 8181953 application input set, target/recovery/tool hashes and the
frozen qualification evidence. Unknown source, data, schema, output, runtime or
gate drift stops execution. Neither `npm run deploy` nor the retired publisher is
used. The new output contains only the approved footer application change;
all server code, dependencies and original 87 migrations match accepted production.

Migration 88 adds only nullable `site_settings.footer_modern_config`, its version/
size check and column comment. It rewrites no row or existing setting. NULL uses
the inherited footer configuration. Classic, original menus, legacy footer fields,
Auth, products and media remain preserved. Settings RLS and recursive media guards
already cover the column. All payment methods, provider outbound flags, PDC/auto/
reverse, checkout and signup must stay disabled. Paymob/PDC configuration is bound
as existing protected data/environment, never printed, entered or changed.

## Backup and artifact verification

A fresh read-only full database dump was encrypted with the existing protected
backup key: 9,067,458 encrypted bytes. Authenticated full decryption, `pg_restore`
TOC inspection and a full `pg_restore --file=/dev/null` readback pass. The runtime
recovery archive has 2,272,910 encrypted bytes covering 10 original files, including
the current credential-containing runtime, units/drop-ins, Caddy configuration,
decoder/extractor and original release metadata. Every restored stream file's
complete bytes match the fresh observation. No plaintext backup file is created.
This is full authenticated archive/parser verification, not a hosted restore test.

The old release, public media and private directories remain on the VPS untouched.
Their complete hash trees are checked before and after preparation and again by
the execution guards. Existing media recovery archives are retained; this UI
release never writes shared media or private business files. Recovery does not
require copying an older database over current business data.

The candidate uses clean `npm ci` with Node 22.23.1/npm 10.9.8, unchanged lock bytes,
an empty build dotenv and an explicit secret-free build environment. All 428 old
immutable client assets are supplied before the Nuxt build, preserving the new
mutable build pointer. The strict inventory rejects secrets, native executables,
escaping links and upload payloads. A separate extraction with the unchanged
guarded extractor verifies every archive member against the inventory. The
extracted and built output inventories match exactly.

The exact retained-asset candidate then passes 102 browser assertions and 17
screenshots against owned native PostgreSQL/PostgREST: Dashboard save/reload,
all fields, ordering/toggles/removal, URL rejection, viewer/RLS denial, EN/AR/RTL,
desktop/tablet/mobile, Light/Dark and real Nuxt SSR/hydration. Browser errors and
external requests are zero. Media selection and Auth are explicit local fixtures;
authenticated production saves/uploads remain post-deployment owner acceptance.

## Eight failures and two cancelled tests

The original whole-suite result remains recorded accurately: 996 pass, 8 fail,
2 cancelled and 83 optional skips. It was not made green by weakening a guard.
The private `qualification.json` binds each original failure, its evidence and
the source comparison to accepted production. No new release-blocking impact
was found for this disabled, footer-only release:

| Original failure | Verified cause and boundary |
| --- | --- |
| 82→85 release membership | Correct refusal of later 86–88; historical executor unchanged and excluded. |
| 85→87 release membership | Correct refusal of 88; separate 87→88 executor passes its own native guards. |
| Two Release82 certificate contexts | Both original tests pass against all 597 exact certified application inputs and 82 original migrations. Later source must remain rejected. |
| Dashboard handler fixture | A fixture banner redeclares an explicit H3 `readBody` import. A disposable Nuxt-style auto-import adapter passes the original actor/RBAC assertions. No handler changed. |
| Retired Nginx registry hashes | Previously accepted backend changes already invalidate old review pins. Footer adds only its locale namespace. Current Caddy routing is bound unchanged; the obsolete policy is not applied. |
| Daftra cash fixture | It directly marks unreceipted COD paid, rejected by the existing 85 cash-history guard. A disposable bank-transfer stock-owner fixture passes; existing 87 also requires full courier eligibility before queuing. Production ERP remains built-in and commerce disabled. |
| Preorder shipping expectation | Existing87 requires a packed, selected, eligible `ready_to_deliver` order. The old fixture expects a courier job at `processing`; its corrected expectation passes the full financial/stock test. |
| Two email transport cancellations | Mock timeout tests lacked a referenced event-loop handle. A test-only handle lets all three original tests pass, without transport changes or real network calls. |

All adaptations are in disposable review contexts outside this checkout. Original
application and historical tests/guards remain intact. The adapted fixture run
passes 22 tests; the exact frozen 82 context passes 2. Additional native release,
Paymob, PDC and COD safety verification passes 59 tests, zero failures/skips. Six
owned remote-phase tests cover approval/scope rejection, output corruption,
uncommitted SQL refusal and failed-activation evidence/no retry/no rollback.
These results do not certify live merchant payments, shipments, Daftra COD or
future provider acceptance. Those workstreams remain separately gated.

## Final approval and one execution

Private plan:
`/Users/imac/Documents/ELcomputer/modern-footer-release-preparation-20261021/prepared-final/plan.json`.

The owner should pause Dashboard content/product/provider edits until release
verification finishes. Normal anonymous storefront activity may continue: only
existing analytics activity and the two previously reviewed Auth activity
timestamps are excluded from between-observation row hashes. Auth identity,
security, relationships, schema and every other protected business row stay bound.
Within the migration transaction, all original application rows, including
analytics, are locked where permitted and compared using their original columns.

The exact owner approval phrase is:

> APPROVE MODERN FOOTER DEPLOY
> 768e8bdcc7a50dc5f8586ba907edde10a8e8a6a9261248668c4426918fcda214

This preparation approval does not authorize execution. After the final phrase,
the agent runs these commands once from the repository, using the pinned Node:

```sh
/Users/imac/Documents/ELcomputer/procurement-postgrest-correction-20261018/tools/node-v22.23.1-darwin-x64/bin/node scripts/footer-release/operator.mjs check /Users/imac/Documents/ELcomputer/modern-footer-release-preparation-20261021/prepared-final/plan.json
```

The check is read-only and must pass. Then execute exactly:

```sh
/Users/imac/Documents/ELcomputer/procurement-postgrest-correction-20261018/tools/node-v22.23.1-darwin-x64/bin/node scripts/footer-release/operator.mjs apply /Users/imac/Documents/ELcomputer/modern-footer-release-preparation-20261021/prepared-final/plan.json --approved 768e8bdcc7a50dc5f8586ba907edde10a8e8a6a9261248668c4426918fcda214
```

Execution first consumes one exclusive intent and repeats all live preservation
guards. It obtains another fresh encrypted recovery set before production writes.
It then stages/verifies only this immutable output, retaining old output/assets.
A temporary private systemd unit, with all original commerce gates off and shared
files read-only, checks safe GETs against the candidate. It never becomes public.
The original release/PIDs/runtime/media must remain exact throughout this step.

Only after private candidate success, one short, bounded transaction takes the
reset-exclusion lock and original-table locks, rechecks approved protected state,
applies 88/history and compares all old rows, schema, table grants, RLS, functions,
triggers and indexes. It permits only the intended column/check/comment. Any error
before commit rolls the entire SQL transaction back. Auth/Storage remain read-only.

After committed 88, an explicit SQL receipt is required before the atomic current
symlink switch and one controlled `storefront.service` restart. No runtime, unit,
Caddy or provider setting is edited. Fourteen public health/hold checks, fresh
Auth settings, exact schema 88, disabled gates, preserved protected data/media and
unchanged Caddy/runtime files must pass. The current systemd restart policy remains
unchanged; the operator never repeats deployment or initiates automatic recovery.
On any STOP, ambiguity or interruption, preserve all files and receipts. Do not
repeat `apply`, delete an intent, use an old executor or reverse migrations.

## Recovery plan and post-deployment acceptance

Recovery retains `/srv/storefront/releases/d2d7a8029b473e4a`, its complete original
inventory/metadata, the unchanged protected runtime, both verified recovery sets
and the exact old client assets. The actual retained archive was independently
extracted and served locally against schema 88 in both Classic and Modern, EN/AR,
with Dashboard login: six GET checks pass and the new JSON remains intact.
An old partial settings upsert also preserves the new JSON. This supports backward
application compatibility, not a claim of hosted recovery execution.

If 88 committed but activation did not run, keep the old app serving with 88 and
review the failed phase. If the app switch happened, the shortest recovery is a
separately reviewed, guarded app-only switch to the retained release and one Nuxt
restart, with 88 and all current data left intact. Recheck target/output/runtime,
disabled gates, current DB state, free capacity and the original release hashes
before authorizing that operation. No raw symlink/restart shortcut is approved;
no older database restore, SQL reversal or automatic rollback is part of this plan.
If old output/runtime is damaged, use the retained encrypted recovery inputs only
through a new reviewed recovery plan. Preserve failure evidence throughout.

After a successful deployment, the agent performs read-only EN/AR browser checks
at desktop/tablet/mobile sizes and Light/Dark, checks actual footer images/links,
console/hydration and overflow, and records the active release/schema/holds.
The owner then performs the [focused Dashboard/browser checks](modern-footer.md#production-status-and-next-release-boundary), including save/reload/order/visibility
and Classic/Modern switching. Return to the preferred saved style; keep purchases,
signup, Paymob/PDC and all shipping automation disabled. No real order/provider
test, PDC retry, WordPress import or Git push is authorized by this footer release.

PDC remains awaiting clarification/support. Preserve mandatory WordPress customer
migration, controlled provider acceptance, verified stock/delivery and later public
purchasing approval. UI Improvement 2 remains held until this footer is deployed.
