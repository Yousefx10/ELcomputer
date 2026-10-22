# Guarded Premium product page release

Application commits: `ad7b03d`, then the sparse-layout refinement `a2e47a5`.
The final application is pinned to the full `a2e47a5` commit in the dedicated
operator. Both accepted footers and every completed release executor stay intact.

Status: local qualification complete; a new sealed release is being prepared.
Production remains `40ebcf1f6d50a143`, schema88. This document is not approval to
execute production SQL or change the running application.

## Reviewed scope

- Exactly migration89: `20261022100000_premium_product_pages.sql`.
- Two nullable/defaulted presentation Settings columns and three private tables.
- Classic default; no product/content configuration or Premium selection on deploy.
- Exact media-reference and reset-coverage extensions; other existing schema,
  ACL/RLS, functions, triggers and original-column row projections preserved.
- One application switch using the established Caddy/systemd deployment phases.
- Existing Caddy, runtime file, Auth security, credentials, saved flags, catalog,
  public/private media and disabled commerce/provider gates remain unchanged.
- No Git push, provider transaction, generic migration push or historical-seal reuse.

[Local validation](premium-product-validation.md) distinguishes genuine catalog
snapshots, isolated fixtures, synthetic Auth and remaining hosted owner acceptance.

## Prepare and review

Use Node22.23.1, npm10.9.8 and deployment-specific private configuration. Do not
use the retired PM2 deploy scripts. Commands from the repository root:

```sh
node scripts/premium-product-release/operator.mjs prepare PRIVATE_SPEC NEW_PRIVATE_DIRECTORY
node scripts/premium-product-release/operator.mjs check NEW_PRIVATE_DIRECTORY/plan.json
```

Preparation requires a clean, committed checkout and exact application/migration/
tool inputs. It verifies the accepted production receipt/archive/schema, current
runtime/media identities, Auth settings and strict-TLS read-only database state.
Only reads, local files and backup generation occur before final approval.

A fresh custom-format database dump and runtime recovery archive are encrypted.
Authenticated decryption, complete `pg_restore` readback and runtime member hashes
are verified. Existing media is not rewritten; its complete file tree is bound to
the plan. The accepted release artifact remains available for application rollback.

The new artifact is built from its exact commit with a clean `npm ci`, an empty
dotenv and no production secrets. Existing client assets are retained. Inventory,
secret scan, archive hash and safe-extractor readback must all agree. Qualification,
protected inputs, backup evidence, current data/schema and tools are sealed together.
The read-only `check` refuses drift or any prior execution intent/STOP/completion.

## Final approval and execution

The owner must approve the exact new 64-character plan seal. This approval covers
both the reviewed migration89 transaction and application activation. Earlier footer
approvals do not authorize this release.

```text
APPROVE PREMIUM PDP DEPLOY
EXACT_NEW_PLAN_SEAL
```

Only after that approval:

```sh
node scripts/premium-product-release/operator.mjs apply PRIVATE_PLAN --approved EXACT_NEW_PLAN_SEAL
```

The operator performs these guarded phases:

1. Recheck committed inputs, approved state, Auth, HTTP holds and current runtime.
2. Capture and verify fresh encrypted execution backups.
3. Stage and verify the artifact, leaving the current application running.
4. Start a private systemd candidate against schema88; check safe SSR/Auth GETs.
5. Lock/recheck protected data, apply only89 and its ledger row in one transaction.
   Compare all old data/security/schema before committing. Any failed check rolls
   back DDL and the ledger together.
6. Start a second private candidate against schema89. Check new public metadata,
   private API 401s, Classic SSR, SEO, and unchanged production runtime/media.
7. Recheck the committed database, both candidate receipts and artifact bytes.
   Atomically switch the application link and restart the storefront service once.
8. Verify public routes/holds, new metadata, Classic/SEO, unchanged Caddy/runtime/
   media, and exact protected database projections. Retain every receipt.

Execution intent is one-use. Any failure writes STOP evidence. There is no automatic
retry or rollback. An ambiguous commit must be investigated read-only before a new
review; never reapply89 or rerun a consumed plan.

## Recovery plan

The sealed plan records the exact previous release path/archive, runtime hashes,
verified backups and application-only recovery scope. Before activation, the old
application stays current and is backward-compatible with additive89. If SQL fails
before commit, the transaction rolls back. If it committed but activation did not
occur, keep89 and the existing application while reviewing the retained evidence.

After activation, application rollback means verifying the failed current release,
reverifying the accepted previous artifact/runtime/gates, atomically restoring the
recorded previous application link, and restarting the same service once. Preserve
schema89, presentation receipts, catalog/media, credentials and Auth. Do not drop
new columns/tables or restore a database dump over newer business/Auth data. Recovery
is a separate reviewed operation, using the exact sealed paths and retained files.

## Exact owner browser checks after deployment

1. Sign in through the existing Dashboard login. Open Settings → Product page.
   Confirm Classic is selected. Check a current product before changing the style.
2. Select Premium, save, then refresh Settings. Confirm it remains selected.
3. Open the Rapoo1510 mouse, AULA MINI60 keyboard and Fantech ATOM81 option product
   through their existing catalog URLs. Check image quality, price, availability,
   actual options, specifications and the unchanged Modern Footer.
4. Open the gallery; use thumbnails, arrows, zoom and Escape. Confirm focus returns.
   Swipe on a phone. Test roughly1440, tablet and small/large mobile widths.
5. Repeat in English/Arabic and Light/Dark/System. Confirm RTL, currency, no
   horizontal overflow, readable text and no obscured purchase controls.
6. Verify purchasing remains unavailable, and checkout/signup remain held. Do not
   attempt a payment, booking, shipment or provider transaction.
7. Switch to Classic and refresh the same URLs. Confirm the original experience.
   Leave the final preferred style through the Dashboard's explicit selector.
8. If authentic video is available for an existing Draft product, optionally verify
   authorized upload/save/reload there. Its public page/video must remain unavailable.
   Synthetic local video coverage is already complete; no dummy production media is
   needed for acceptance.

Report owner findings as owner-reported browser acceptance. Hosted authenticated
writes/RBAC and genuine provider behavior remain distinct evidence. Stop after this
PDP milestone's deployment and acceptance; PDC and WordPress migration stay later.
