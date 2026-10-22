# Guarded Premium product page activation

Status: **DEPLOY_PASS; hosted owner browser acceptance pending**.
Active release `cda41a7a13e0b61d`, application `a2e47a5`, schema89 unchanged.
Owner approved seal `d903d3a7b737ab9fcd1738076d797b8f6583735a286f84f96bb16c8a011870de`.
The application-only operator completed ONCE at `2026-10-22T11:52:36.997Z` with zero SQL writes,
zero migrations, no provider transactions and Classic still selected.

Fresh execution backups, private schema89 candidate, public route/metadata/Auth
holds and protected database/runtime/media checks pass. Live anonymous review
passes279 checks/22 screenshots with no runtime/hydration errors. The browser
intentionally blocked23 analytics POSTs;21 chat-status403s are the existing hold.
No other HTTP failure was observed. Full post-browser preservation also passes.
The archive is byte-identical to the266-check qualified artifact. Caddy/runtime,
media, both footers, catalog/Auth, credentials and disabled gates remain preserved.

Private evidence: parent premium-pdp-20261022/prepared-activation/completed.json,
FINAL-ACTIVATION-DEPLOYMENT-RECEIPT.json and activation-live-browser-report.json.
Exact owner URLs/checks: DEPLOYED-PDP-OWNER-BROWSER-CHECKS.md in that directory.
README and both handoffs record deployment. Stop pending owner acceptance.
All three plans are consumed. Commands below document the completed workflow;
never rerun a consumed plan or migration89. Any recovery needs its own review.

## Consumed plans and verified production state

The first PDP plan (`11f5aa80c67c81aa`, seal beginning `aeb557dc`) stopped before
migration DDL because it compared read-only and write transaction modes directly.
Its transaction rolled back. The second (`c9c68db4510d0dfe`, seal beginning
`90dbc370`) corrected that mode comparison and committed exactly migration89.
Its commit receipt proves preservation of all135 original table projections,
Auth and existing schema/security, with only the reviewed additive extensions.

The second plan then stopped before its schema89 candidate or activation. Its
postcommit verifier compared live analytics with an earlier preparation snapshot.
Events advanced2246→2265→2266 and sessions1645→1652→1653 across preparation,
commit and diagnosis. This contradicted the existing approved `approvalState`
policy, which already projects only the schema of these two telemetry tables.
The full read-only comparison confirms every other protected field matches the
committed state. No rollback, retry or application activation occurred.

Both plans, intent/STOP files, commit receipts, staged artifacts and executors
remain immutable. Do not invoke `operator.mjs` or `recovery-operator.mjs` again.
Private evidence is under parent premium-pdp-20261022/: prepared/, prepared-recovery/,
SCHEMA89-STOP-DIAGNOSIS.json, SCHEMA89-PRESERVATION-VERIFICATION.json and the fresh
ACTIVATION-READONLY-PRODUCTION-VERIFICATION.json. This is verified production evidence;
local synthetic Auth/browser tests remain a separate evidence category.

## Application-only scope

- Zero SQL writes and no pending migrations. Verify the complete exact89-row ledger.
- Reuse the identical qualified Premium PDP artifact from `c9c68db4510d0dfe`, app
  `a2e47a53b016051500180876b25feb2420d7038d`. Do not rebuild or change the application.
- Classic remains selected. All three new metadata tables remain empty on release.
- Only `public.store_analytics_events` and `public.store_analytics_sessions` use the
  existing live-telemetry row projection. Their columns, ACL/RLS, constraints,
  indexes, triggers and functions remain exact. Internal analytics tables remain
  protected. Every other present/future business table and new metadata table,
  settings, saved flags, ledger, Auth identity/security, schema and permissions
  stay bound. Auth activity uses only the previously approved timestamp projection.
- Caddy, runtime/systemd configuration, credentials, all media, both footers and
  disabled purchasing/signup/Paymob/PDC gates remain unchanged. No provider calls.
- An independent release identity and staging directory preserve both consumed plans.
  No automatic retry, rollback, Caddy operation or Git push.

The new `activation-operator.mjs` and `activation-remote.py` allow only schema89
application activation. Database observations use read-only transactions. Remote
mutation rejects SQL scope, a migration list, schema88, old plan formats or missing
approval. Candidate proof binds the plan, artifact, inventory and migration hash;
activation requires the exact approved read-only database-state digest.

The23 release checks and nine owned remote fault checks pass, with no failures,
cancellations or skips. Tests use a non-superuser local database, real postcommit
analytics growth, fresh read-only observations, protected data/Auth/schema drift,
tampered artifacts, wrong scope/approval and failure-without-retry evidence.

## Prepare and verify

Use the pinned Node22.23.1 and deployment-specific private configuration. Do not
use retired PM2 deployment scripts. The new `committed_plan` configuration input
names the consumed second plan. The operator verifies and seals its complete
intent/STOP/commit/diagnosis/preservation evidence and original qualification.

```sh
node scripts/premium-product-release/activation-operator.mjs prepare PRIVATE_SPEC NEW_PRIVATE_DIRECTORY
node scripts/premium-product-release/activation-operator.mjs check NEW_PRIVATE_DIRECTORY/plan.json
```

Preparation is read-only in production. It checks the running application, Auth,
Caddy/runtime/media identities,89-row ledger, permissions and committed protected
state. It captures fresh encrypted schema89 database and runtime backups, verifies
authenticated decryption, full pg_restore readback and runtime member hashes.
The exact existing archive, secret scan, inventory1675, retained626 assets and
independent safe-extractor readback must agree. Its266 exact-artifact browser
checks and qualification are hash-bound; no application changes invalidate them.
[Application validation](premium-product-validation.md) retains full regression
qualifications and distinguishes fixtures from hosted owner acceptance.

## Completed owner approval and execution

The owner approved the exact new seal below for application activation only.
Schema89 was already committed and was not reapplied. Both earlier approvals and
this completed application-only approval are consumed. Historical approval:

```text
APPROVE PREMIUM PDP DEPLOY
d903d3a7b737ab9fcd1738076d797b8f6583735a286f84f96bb16c8a011870de
```

The operator was invoked once using the pinned runtime. Historical command only:

```sh
node scripts/premium-product-release/activation-operator.mjs apply PRIVATE_PLAN --approved d903d3a7b737ab9fcd1738076d797b8f6583735a286f84f96bb16c8a011870de
```

1. Recheck immutable inputs, exact artifact, read-only schema89/data/Auth and holds.
2. Capture and verify fresh encrypted execution backups.
3. Stage the artifact and run the private systemd candidate against schema89.
   Verify Classic SSR/SEO, new metadata APIs, private API401s and unchanged live state.
4. Recheck protected schema89 state read-only and bind its exact approved digest.
5. Switch the application link atomically and restart the same storefront service once.
6. Verify public routes/holds, Classic/SEO, metadata, runtime/Caddy/media and protected
   database state. Retain receipts; never select Premium or configure content.

Execution intent is one-use. A failure writes STOP evidence. There is no automatic
retry or rollback. Inspect any uncertainty read-only before a new reviewed plan.

## Recovery plan

The previous application archive and runtime identities remain retained and are
backward-compatible with schema89. Rollback is a separate reviewed application-only
operation:
verify the current failed release, verify the accepted previous archive/runtime,
restore the recorded application link and restart the same service once. Preserve
schema89, products, media, Auth, settings, receipts and credentials. Never drop89
or restore an old database dump over newer data. No automatic recovery runs.

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
