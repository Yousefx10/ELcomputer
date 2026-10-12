# Phase 3, Milestone 4 publication integration

The separate [fresh application publisher](application-publication.md) now
provides guarded package/runtime/plan/check/apply/resume/verify operations for
an already completed M3 installation. Production, migrations 1–71, certified
bundles and production deployment helpers remain unchanged. Local actual
Nuxt/PM2/Auth/Storage tests use explicitly declared Linux/SSH/ingress fixtures;
real Linux/hosted/reboot acceptance remains pending. STOP for M4 review.
The milestone notes below retain their original historical boundaries.

# Phase 3, Milestone 3 local installer

The guarded operator CLI initializes a certified fresh database, private buckets
and first owner. Read [the runbook](installation-cli.md). It adds no Dashboard
bootstrap action and leaves the deployed Phases 1/2 guide unchanged.

Production remains owner-reported `ae3a58d7` with 70 migrations. Migration 71
is unchanged development source and was tested only in owned disposable
environments. Actual local Auth/Storage acceptance is separate from pending
hosted/VPS acceptance. Milestone 4 and Phase 4 remain unauthorized.

# Phase 3, Milestone 2 local follow-on

Migration 71 adds neutral configuration and protected first-owner primitives.
The Dashboard guide remains owner-only; it exposes no bootstrap operation.
Missing PDC IDs and empty content remain unconfigured. Provider activation still
requires the existing editors and gates. [Contract and evidence](installation-bootstrap.md).

Production remains the owner-reported application checkpoint below with 70
migrations. No production access, deployment or hosted Auth/reset occurred.
Milestone 3 and Phase 4 have not started. The following guide documents the
existing deployed Phases 1/2 behavior and its acceptance limits.

# Quick Setup — Phases 1 and 2

Quick Setup is an owner-only guide at `/dashboard/setup`, also available at `/ar/dashboard/setup`. Phases 1 and 2 are deployed at the owner-accepted `ae3a58d7a6e81a00b720bed49d8953aabd3bb160` checkpoint with 70 migrations. Phase 2 extends the same guide with private, nonsecret progress metadata. Configuration editors remain authoritative. The acceptance evidence limits below remain; Phase 3 Milestone 1 did not contact production.

## Supported sections

1. System Status: application table access, saved store settings, server configuration presence and HTTPS origin syntax.
2. Store & Branding: saved store name, logo reference, contact method/address and enabled policy configuration.
3. Commerce & Payments: existing checkout settings, Cash, transfer limitations, Paymob test capability and unsupported gateways.
4. Shipping & ERP: active manual courier or selected PDC configuration; Daftra credentials, evidence and ownership.
5. SMS & Email: Vodafone/Brevo readiness, enablement, worker authorization presence and notification bindings.
6. Authentication & Integrations: verified owner session; outstanding hosted Auth, Storage, OAuth and Live Chat acceptance.
7. Launch Readiness: required configuration gaps and separate manual acceptance checklist.

All configuration actions remain links to existing Settings, Shipping, SMS, Email and Claims communication editors. The new checkboxes, Save current check and Confirm review buttons edit setup metadata only. There are no provider test buttons, install/clone/reset commands or launch action. EN/AR, RTL, responsive layouts, Light/Dark/System themes and heading focus navigation are preserved.

## Status and progress

`GET /api/admin-setup/status` verifies a bearer token and current active owner through `requireAdminRequest`. `readQuickSetupProgress` wraps `readQuickSetupStatus` with a private metadata snapshot. Existing Daftra, SMS, Email, PDC and Paymob configuration/validation helpers remain authoritative; no new provider backend is introduced.

Responses contain explicit identifiers, booleans, enumerated states, revision numbers, opaque HMAC bindings and normalized timestamps. No saved store/provider strings, account IDs/URLs, actor identity, raw diagnostics, plaintext secrets, encrypted values, environment dumps or customer data are returned. The browser fetches only after mounting and active-owner verification. Responses are private/no-store; errors are fixed and do not echo request URLs or database diagnostics. Losing owner/active status clears displayed data and invalidates pending read and mutation responses.

Progress counts **required items whose configuration checks are complete / required items**. Requirements follow existing settings plus the owner's optional setup choices. A choice adds requirements and never enables a provider. Exclusion cannot hide an integration required by existing settings. Configuration progress, current verification and owner review counts are displayed separately; no combined operational readiness score is generated.

Required base items are application configuration, infrastructure origin syntax, branding, contact information, checkout methods, shipping and authentication acceptance. Optional services become required when selected in saved configuration: active Daftra ownership, enabled providers, enabled SMS events/Claims communication channels, Email webhook/marketing controls, PDC automatic/reverse controls, enabled policy families, Facebook visibility and enabled Live Chat. Unreadable optional configuration becomes a required unverified gap because its selected state cannot be established. Bounded list reads reject partial results instead of accepting an incomplete scan.

Daftra evidence is verified only for an existing successful database-credential-revision test within 24 hours. Environment fallback tests use revision zero and cannot bind credential changes; the guide reports those as unverified. Older/future/revision-mismatched evidence is stale; a current failed test is failed. Once a recorded test is invalidated, saving that same test again cannot renew it, including after an intervening unavailable result. A fresh deliberate test in the existing ERP settings is needed. This policy affects this guide only, not existing ERP activation or ownership. Other provider connections remain **Not verified**.

Specific limitations are shown directly:

- PDC readiness uses existing validation without decrypting credentials, testing lookups, enabling its outbound gate, creating jobs or retrieving labels.
- Vodafone readiness includes existing external confirmations and destination validation. Those declarations do not prove sender/trusted-IP/account acceptance; no SMS or DNS/provider request runs here.
- Brevo readiness includes saved sender/account confirmations. These are not remote account verification or delivery evidence. Supabase Auth email is a separate configuration.
- Paymob reuses its runtime configuration validator. It reports credential presence and test capability separately from enablement; live mode remains unsupported. A saved Card flag with a disabled gateway is not treated as a selected working payment method.
- Cash is the current implemented non-test checkout path. Enabled Bank Transfer/InstaPay selections report the incomplete secure proof-submission backend. Selected card test flow cannot establish live-payment readiness. PayPal settlement, Apple Pay, Google Pay and mobile wallets remain unsupported.
- A worker secret only establishes authorization configuration, never scheduling or successful dispatch.
- Hosted Auth URLs/SMTP/OAuth provider state, physical Storage operations/quotas, exact migration history, grants/RLS, TLS/domain ownership, backups/recovery and real end-to-end transactions remain unverified.

`operationalReady` always remains false and operational acceptance remains `not_verified`. Existing Auth/Storage evidence cannot be inferred from table reads or owner acknowledgements. Auth acceptance remains a required unverified configuration gap.

## Security and scope

Both Dashboard middleware and backend require active owner authorization. Ordinary admins with configuration permissions cannot read or mutate setup metadata. Existing integration permissions are unchanged. Refresh runs SELECTs/configuration helpers only; there are no RPC invocations, provider requests, configuration writes, audits, queues or background processing from Setup reads.

Infrastructure credentials remain operator-managed. The guide never accepts Supabase administrative credentials, master/worker keys, SSH credentials or VPS configuration. Phase 2 adds migration 70; all 69 applied migration files remain unchanged. This implementation does not access production, apply SQL, deploy, activate providers, rotate keys, send messages, create payments/labels, or perform a real reset. No installer, cloning or Product Manager feature is included.

## Phase 2 persistence and evidence

Migration `20261012120000_quick_setup_progress.sql` creates:

- `quick_setup_state`: one installation UUID, owner update revision and eight boolean choices: PDC, Daftra, Vodafone, Brevo, Paymob, PayPal, OAuth and Live Chat.
- `quick_setup_revisions`: monotonically increasing generations for the 17 existing setup items.
- `quick_setup_events`: immutable selections, verification snapshots and acknowledgements, with an actor UUID, safe result/source enums, numeric dependencies, opaque binding and timestamps. No free text, credentials or provider response is stored.
- `quick_setup_snapshot`: a private view providing state, all generations, latest events and the latest 50 history entries in one MVCC snapshot.

All three tables have RLS enabled and restrictive deny policies for browser roles. PUBLIC, anon and authenticated have no table/view/function access. Service role has SELECT only; direct mutation, truncation and sequence access are revoked. The only writable API is `PATCH /api/admin-setup/state`, using the service-only `quick_setup_mutate(uuid,jsonb)` command. Security-definer helpers have empty search paths and no public execute grants.

The server authenticates the owner before reading the body. It accepts one selection, capture or acknowledgement command, an expected revision and an opaque binding where required. It rejects client-supplied outcomes, sources, timestamps, dependency revisions, secrets and unknown fields. The database rechecks and locks the active owner, locks installation state and ordered dependency generations, validates the complete dependency set, then commits state, immutable history and `admin_activity_logs` together. Stale versions return 409; excess writes return 429 after 30 owner updates per minute. Audit failure rolls everything back. The UI refreshes after a conflict without retrying the write.

Configuration triggers increment relevant generations on actual changes, insertion, deletion or truncation. Returning values to an earlier configuration does not reuse old evidence. Updated timestamps/actors and Email dispatch scheduling noise are ignored. Provider settings, payment flags/fees, ERP ownership/tests, shipping mappings, policies, notification templates/bindings and chat settings are covered. Changed owner choices also increment the corresponding domain generation. Paymob depends on checkout settings; SMS/email depend on notification configuration. Unrelated branding changes do not invalidate SMS evidence.

Bindings use installation-scoped HMAC-SHA256 with the existing private service-role key. The input includes engine version, action/item, dependency generations, relevant choices and scoped runtime configuration. Private values enter only the HMAC; plaintext hashes and credentials are never stored. Runtime/master/worker-key and gate changes invalidate relevant evidence; service-key rotation invalidates all bindings. No parallel credential store or new encryption key is introduced.

Status reads compare snapshots before and after configuration reads. A changed snapshot retries once; continuing races fail closed with 503. Read refresh never initializes metadata or changes history. Missing metadata/schema preserves the Phase 1 read-only guide, displays an unavailable notice and removes mutation controls; writes fail with 503. Unexpected or malformed metadata also fails closed.

**Save current check** records existing evidence without contacting any provider. Configuration snapshots stay unverified, or unavailable for unsupported/unreadable items. Only the supported, current Daftra database-revision test can be verified; failed and stale tests retain those states. Evidence expires after 24 hours. Explicit live tests remain in existing integration editors under their existing permissions and gates, requiring deliberate action. No new remote test endpoint is added.

The seven acknowledgement categories are Auth, Storage, commerce, providers, workers, backup and migration/security parity. **Confirm review** records an owner report, not independent verification; **Withdraw confirmation** appends a revocation. Reports expire after seven days or relevant configuration changes. History remains immutable. Hosted settings, delivery, scheduling, Storage operations, physical backups/restores and live commerce cannot be established from saved metadata. External changes that the application cannot observe require owner review; expiration supplies a review deadline, not continuous monitoring.

## System Reset policy

Every scope, including full reset, retains installation identity, choices, generations and history. This avoids destroying the installation's review trail or falsely declaring a new installation complete. Actor UUIDs intentionally have no admin FK, allowing other-admin deletion without deleting retained history. Existing full reset still clears general activity logs; the dedicated setup history survives.

The additive migration explicitly adds these tables to the recognized retained list in `system_reset_plan`. An unexpected source anchor stops the migration transaction for review. No table is added to reset deletion manifests. An insert trigger on the existing reset journal increments affected generations in the same transaction as the database reset, before ordinary configuration triggers are suspended. Full reset invalidates all domains; narrower scopes invalidate relevant domains and infrastructure/backup review. Rollback also rolls back invalidation. File/Auth cleanup is still the existing reset workflow. The full-reset description explicitly states that setup history remains and confirmations need review.

## Validation

`tests/quick-setup.test.mjs` covers real Dashboard middleware, route/navigation boundaries, configured/incomplete/disabled/unavailable selections, stale/failed evidence, credential redaction, capability limits and actual H3 owner authorization. Actual configuration reads use the complete application schema and unchanged migration chain in disposable PGlite; whole-public-table fingerprints and SQL traces prove no writes/RPCs. Auth transport is fixture-only.

`tests/quick-setup-progress.test.mjs` covers the additive 69→70 upgrade, prior public-row fingerprints, provider OFF states, optional choices, immutable audit, acknowledgements/expiry, scoped invalidation/ABA, old-test renewal prevention, snapshot races, all reset manifests/SQL scopes, private grants/RLS, throttling, strict commands and real H3 PATCH authorization. `tests/quick-setup-concurrency.test.mjs` uses independent native PostgreSQL sessions and observed lock barriers to prove exactly one competing save commits, changed configuration and owner revocation reject waiting commands, and audit failure rolls back state/history. Browser roles cannot invoke the command or read its private view; service role cannot write tables directly.

`scripts/setup-browser.mjs` compiles the actual Vue page and uses application CSS plus actual H3/SQL reads and owner metadata commands. It reviews all seven sections in EN/AR, desktop/tablet/mobile and Light/Dark/System, localized links, keyboard/focus, persistence through reload, current/failed/stale/unavailable evidence, reviews/withdrawal/history, conflicts and late read/save revocation. Whole-table fingerprints distinguish allowed metadata/audit writes from provider/business/queue changes. Browser traffic is restricted to loopback. Auth and provider results are synthetic fixtures; this is not hosted sign-in or production Dashboard acceptance.

`scripts/setup-artifacts.mjs` scans public artifacts and renders the actual page through Vue SSR for owner/non-owner/inactive states. It asserts no private Setup fetch, populated integration card or secret canary in SSR. Screenshots and machine-readable reports are written under temporary storage, not committed to application assets.

Commands use the repository's prepared Node 22 environment. Browser/native tests need loopback networking permission. Native regression tools are documented in `storage-policy-delegation.md`; they accept executable paths and create fresh owned loopback clusters, never a production database URL.

```sh
node --test tests/quick-setup.test.mjs tests/dashboard-navigation.test.mjs
node --test tests/quick-setup-progress.test.mjs tests/quick-setup-concurrency.test.mjs
node --test --test-concurrency=2 tests/*.test.mjs
npm run typecheck
npm run build
node scripts/setup-browser.mjs
node scripts/setup-artifacts.mjs
git diff --check
```

Provide `SETUP_REVIEW_PLAYWRIGHT` and `SETUP_REVIEW_CHROME` when the default prepared local browser paths are unavailable; `SETUP_REVIEW_ARTIFACTS` overrides the screenshot directory.

## Phase 2 final local results — 2026-10-12

- Full regression: **835 passed, zero failures/skips**, with native PostgreSQL17.11, PostgREST16.4 and actual Supautils enabled. Includes **16 Phase 2 persistence/security tests and six native concurrency results**. Historical Storage/order audits retain their original64→69 boundaries; new tests independently verify69→70.
- Node22.23.1 typecheck and production build: passed; pre-existing ERP duplicate-import, sourcemap and chunk-size warnings remain. Diff check passed.
- Actual Vue/H3/SQL browser: **1,171 assertions /146 screenshots /29 JSON responses**, zero unexpected errors/external requests. Expected409 conflict exercised explicitly. EN/AR x desktop/tablet/mobile x Light/Dark/System covered.
- Public/SSR review: **135 files /eight actual Vue SSR cases**, zero private Setup fetches or exposed secret canaries.
- All **69 applied migration files are byte-identical** to `ac30fbe97cf1832a5d6f6a6d7ba312dfd6633d59`. Repository now contains70 files. Migration70 SHA-256: `1dff9aac7d94bab1091287b61dac7e86f50fdbe1d803bba2239940f1674f2161`.
- Full screenshot matrix, reports, migration parity proof and passing logs: `/Users/imac/Documents/ELcomputer/quick-setup-phase2-review-20261012`.
- Security finding resolved: environment fallback revision0 cannot establish bound Daftra verification; stale saved tests cannot be renewed by recapturing the old result. No secret store, automatic activation or passive provider activity was introduced.
- Limitations: hosted Nuxt/Supabase owner/non-owner sessions, real provider tests/transactions, hosted Auth/Storage, physical restores and worker scheduling remain separate. Owner reports are not independent evidence. No production connection, schema application, deployment or real reset occurred.

## Phase 1 historical local results — 2026-10-11

- Full regression: **813 passed, zero failures/skips**, with native PostgreSQL17.11, PostgREST16.4 and actual Supautils fixtures enabled.
- Node22 typecheck and production build: passed; existing ERP duplicate-import, sourcemap and chunk-size warnings remain.
- Browser: **1,062 assertions, 136 screenshots, eight JSON responses**, zero browser errors/external requests. Auth/provider data are fixtures; no production connection or real provider call.
- Public/SSR review: **135 files, eight actual Vue SSR cases**, zero private Setup fetches or secret exposure.
- All69 existing migration files are byte-identical to `0c702f6`; deployment/secret helpers are unchanged; no new migration.
- Persistent selected screenshots, browser/artifact reports and validation logs: `/Users/imac/Documents/ELcomputer/quick-setup-phase1-review-20261011`. The complete screenshot matrix remains under `/private/tmp/elcomputer-setup-browser`.

## Deferred work and production deployment

Phase 2 is deployed. Phase 3 Milestone 1 adds the local clean schema/seed/permission foundation and tested history-adoption strategy; read [clean-install-baseline.md](clean-install-baseline.md). Migration 71 portability, first-owner bootstrap, remote installer, locks/checkpoints, VPS publication and hosted installation acceptance remain later milestones. Phase 4 controlled import/cloning/recovery remains deferred. Existing applied migration source stays unchanged.

Production baseline is the user-accepted Phase 2 commit `ae3a58d7a6e81a00b720bed49d8953aabd3bb160` with 70 applied migrations, supplied by the handoff and owner rather than refreshed here. The final hosted snapshot independently recorded selections but no captures/acknowledgements or Branding generation change; controlled hosted acceptance for those paths remains open. Before any separately authorized release, verify current parity, dormant controls/queues, recovery, reset retention, cache/grants and the locked target. Retain migration70/history on application rollback. Local baseline certification grants no production, provider, reset, installation or cloning authorization.
