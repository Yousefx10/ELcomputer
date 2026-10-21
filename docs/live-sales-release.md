# Disabled Paymob/PDC application release plan

The corrected owner-approved deployment returned
[DEPLOY PASS](live-sales-release-receipt.md): release `d2d7a8029b473e4a`, schema87.
Owner browser acceptance passed. All purchase/provider gates remain off.
Current work is [private existing-account configuration](provider-configuration.md).
The earlier [blocked attempt](live-sales-release-blocked-receipt.md) and subsequent
[Auth correction](live-sales-auth-preflight-resolution.md) remain historical.
Both approvals are consumed. Do not rerun either release command.

Completed scope: schema85 →87, matching Nuxt output and private VPS shipping documents.
Further execution, live charging, booking, checkout and credential changes are unapproved.
No Caddy change, reinstall, decoder rebuild, Auth change or payment activation.

## Candidate and dependencies

Apply only `20261021010000_live_card_checkout.sql` (86), then
`20261021020000_safe_pdc_dispatch.sql` (87), in one bounded transaction with
their exact migration-history identities/statements. Preserve all migrations1–85
and their original bytes. Do not run a generic migration push or baseline import.
The existing completed `scripts/commerce-release/operator.mjs` is pinned to82→85
and must **not** be rerun or repurposed without a separately bound new plan.

86 depends on83's checkout guards and the existing Paymob foundation.87 depends
on86, existing PDC tracking/reverse infrastructure and84/85 evidence/finance.
Both migrations use exact reviewed function anchors and stop on source drift.
Existing rows retain their old columns/values; new controls default conservative.

Use Node22.23.1/npm10.9.8, the existing locked dependencies and an empty build
dotenv. Retain current immutable client assets when sealing the target release.
Bind source commit, application input hashes, output inventory/archive, migration
hashes, release tools, target configuration and recovery inputs before execution.
Local validation output is not a production artifact/host acceptance certificate.

Original implementation-validation inventory: 1,075 entries, Node22.23.1,
clean build dotenv. This predates target-asset retention and release packaging.
Application-input map SHA256
`a697421c21b5f25a368583d9cee0756de1d368de3fa17b9a084b6ca6830a40ed`;
output-inventory SHA256
`0d02e8fcf0787e7447ebe3280c23d5924f1a66481ae131136adfac5d128ac8f0`.
These hash the compact JSON maps, not a deploy archive. Private evidence lives in
`/Users/imac/Documents/ELcomputer/paymob-pdc-live-readiness-20261021/`.
The later [preparation receipt](live-sales-release-preparation.md) records fresh
read-only target evidence, retained assets, encrypted recovery and a separate seal.
No production execution is authorized by that preparation.

| Migration | SHA256 |
| --- | --- |
| 86 `20261021010000_live_card_checkout.sql` | `04d26ea7cef634cc753c71663061e9a14a400efb8eb2741f7e9c158e87245790` |
| 87 `20261021020000_safe_pdc_dispatch.sql` | `1166201e9f0d9af4c8d2a4b8e04601c4e7318fbb82ce7609aa9f8e19f4927cd3` |

## Final preflight before an approved single execution

- Confirm the current target against the accepted commerce/access receipts:
  Nuxt release `82214df492a57126`, schema85 identities/source hashes, accepted
  Caddy SHA `504191ccdc985084cf9aa0bba4fc36b7cf2bcae7405af95abce469d56bd81558`.
  These are the last verified baseline, not a new live observation this task.
  Stop on drift; do not repair unrelated state automatically.
- Recheck current Git/source/migration/tool hashes, runtime/env/service user,
  private packing runtime, current output/assets and available capacity. Inspect
  provider/order queues before changing job write permissions. Preserve existing
  Auth/identities, products/full content, financial rows and VPS file hashes.
- All payment flags, Paymob/PDC outbound flags, PDC/auto/reverse and public
  checkout/signup must remain disabled. No credentials are entered by this release.
- Produce and independently verify the existing encrypted database backup and
  retain current app/environment/unit/drop-in recovery snapshots privately.
  Record exact before evidence and one exclusive execution-intent receipt.
  Missing backup/decryption evidence, unexpected job or hash drift means STOP.

## Guarded release order

1. Pause Dashboard edits. Stage and verify the exact immutable output privately;
   retain the old release and immutable client assets. Never touch public media.
2. Add one dedicated private path, e.g. deployment-bound
   `/srv/elcomputer/shared/private/shipping-documents`, owned by the existing
   service user, mode0700. Reuse the private parent; preserve packing videos.
   Add only `NUXT_SHIPPING_DOCUMENTS_DIR` and explicit false new Paymob gate to
   protected runtime. Add only the document path to systemd `ReadWritePaths`.
   Preserve all other env/base unit/drop-ins; snapshot and hash the exact edits.
   The path is operator configuration, never application logic.
3. Validate the service unit and probe file create/fsync/read/delete under the
   same service user/sandbox using an opaque isolated probe. No order or label
   is created. No public alias is added. Confirm private paths remain inaccessible.
4. Start the candidate on a private unused loopback port with all gates off.
   Verify existing Auth boundaries and safe application readiness; no provider or
   business POST. Do not expose candidate traffic publicly.
5. Take the existing reset/release exclusion lock and short table locks. In one
   transaction apply86→87/history, compare every existing table using its original
   column projection and verify service-only commands/private dispatch ACLs.
   Auth/managed Storage are read-only. Stop and roll back SQL on any discrepancy.
6. After committed schema87, atomically select the matching application and
   restart Nuxt once through the established systemd architecture. Preserve Caddy
   exactly. Never automatically retry a failed release or initiate recovery.
7. Verify release/PID, exact87 migration identities/statements, private runtime,
   protected data/media comparison, public storefront/image/login and disabled
   checkout/signup/payment/worker endpoints. Existing Dashboard read operations
   must work. Owner verifies existing pages and masked Quick Setup/settings
   without enabling/saving providers or creating orders. Retain receipts/logs.

The separate `scripts/live-sales-release/operator.mjs` prepares and checks85→87.
Its sealed plan binds the exact artifact, new operator, shared immutable helpers,
target, recovery evidence and migration bytes. Its apply mode requires separate
owner approval of that digest and an exclusive execution intent. It takes another
fresh encrypted backup before changing production. Never invoke it from preparation.

Between read-only observations, only `store_analytics_sessions` and
`store_analytics_events` may advance through normal storefront activity. Their
schemas remain bound; all other table fingerprints remain exact. Within SQL, all
134 original tables, including both analytics tables, are locked where permitted
and compared using their original columns. Only Auth `updated_at`/`last_sign_in_at`
activity is separated from the newly bound identity/security projection; every
other Auth column/schema/member and all Auth relationships remain protected.
Auth/Storage remain read-only.
Pre-commit business drift, queued provider work or a changed migration rolls back.

## Recovery and acceptance

Preserve old output/symlink, environment, unit/drop-ins, current Caddy backup,
encrypted database backup and all intent/phase receipts. On failure stop at the
recorded phase. Do not restore an old database, reverse migrations, retry a
booking or prune evidence. Source/data preservation precedes any reviewed recovery.

Old outbound code writes shipping jobs directly and uploads labels to Storage;
schema87 revokes those writes. Therefore a rollback to schema85 application is
safe only with all checkout/provider/worker/packing business actions held.
Keep new VPS evidence/private barriers. Prefer a reviewed forward application
correction; do not reopen commerce on old code. Native85→87/late-failure tests
verify migration ownership and original-row preservation, not hosted recovery.

After the disabled release, follow [controlled acceptance](live-sales-readiness.md)
for secure configuration and separately approved narrow live payment/shipment
access. This release alone does not authorize a purchase or provider transaction.
The [required customer migration](wordpress-customer-migration.md) follows next;
historical imports need their own dry-run, identity review and owner approval.
