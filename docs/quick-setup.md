# Quick Setup — Phase 1

Quick Setup is an owner-only, read-only guide at `/dashboard/setup`, also available at `/ar/dashboard/setup`. The existing Dashboard navigation adds **Quick Setup** for active owners. It does not replace any configuration editor.

## Supported sections

1. System Status: application table access, saved store settings, server configuration presence and HTTPS origin syntax.
2. Store & Branding: saved store name, logo reference, contact method/address and enabled policy configuration.
3. Commerce & Payments: existing checkout settings, Cash, transfer limitations, Paymob test capability and unsupported gateways.
4. Shipping & ERP: active manual courier or selected PDC configuration; Daftra credentials, evidence and ownership.
5. SMS & Email: Vodafone/Brevo readiness, enablement, worker authorization presence and notification bindings.
6. Authentication & Integrations: verified owner session; outstanding hosted Auth, Storage, OAuth and Live Chat acceptance.
7. Launch Readiness: required configuration gaps and separate manual acceptance checklist.

All configuration actions are ordinary links to existing Settings, Shipping, SMS, Email and Claims communication editors. The page contains no editable settings forms, provider test buttons, install/clone/reset commands or launch action. It supports EN/AR, RTL, responsive layouts and the existing Light/Dark/System themes. Step buttons, Previous/Next and readiness review links move focus to the section heading.

## Status and progress

`GET /api/admin-setup/status` verifies a bearer token and current active owner through `requireAdminRequest`. It then uses `readQuickSetupStatus` in `server/utils/quickSetup.js` to read current configuration. Existing Daftra, SMS, Email, PDC and Paymob configuration/validation helpers remain authoritative; no new provider backend is introduced.

Responses contain only explicit identifiers, booleans, enumerated states and normalized timestamps. No saved store/provider strings, account IDs/URLs, raw diagnostics, plaintext secrets, encrypted values, environment dumps or customer data are returned. The browser fetches only after mounting and active-owner verification. Responses are private/no-store; errors are fixed and do not echo request URLs or database diagnostics. Losing owner/active status clears displayed data and invalidates pending responses.

Progress counts **required items whose configuration checks are complete / required items**. Requirements follow saved settings, without a new selection/completion database. It is configuration progress, not an operational readiness score. Manual completion, skip decisions and acknowledgements are not persisted.

Required base items are application configuration, infrastructure origin syntax, branding, contact information, checkout methods, shipping and authentication acceptance. Optional services become required when selected in saved configuration: active Daftra ownership, enabled providers, enabled SMS events/Claims communication channels, Email webhook/marketing controls, PDC automatic/reverse controls, enabled policy families, Facebook visibility and enabled Live Chat. Unreadable optional configuration becomes a required unverified gap because its selected state cannot be established. Bounded list reads reject partial results instead of accepting an incomplete scan.

Daftra evidence is verified only for a successful current-credential-revision test with a valid timestamp within 24 hours. Older/future/revision-mismatched evidence is stale; a current failed test is failed. This freshness policy affects this guide only, not existing ERP activation or ownership rules. Built-in mode leaves Daftra optional; outages do not switch ownership. Other provider connections remain **Not verified**, since passive reads cannot establish connectivity.

Specific limitations are shown directly:

- PDC readiness uses existing validation without decrypting credentials, testing lookups, enabling its outbound gate, creating jobs or retrieving labels.
- Vodafone readiness includes existing external confirmations and destination validation. Those declarations do not prove sender/trusted-IP/account acceptance; no SMS or DNS/provider request runs here.
- Brevo readiness includes saved sender/account confirmations. These are not remote account verification or delivery evidence. Supabase Auth email is a separate configuration.
- Paymob reuses its runtime configuration validator. It reports credential presence and test capability separately from enablement; live mode remains unsupported. A saved Card flag with a disabled gateway is not treated as a selected working payment method.
- Cash is the current implemented non-test checkout path. Enabled Bank Transfer/InstaPay selections report the incomplete secure proof-submission backend. Selected card test flow cannot establish live-payment readiness. PayPal settlement, Apple Pay, Google Pay and mobile wallets remain unsupported.
- A worker secret only establishes authorization configuration, never scheduling or successful dispatch.
- Hosted Auth URLs/SMTP/OAuth provider state, physical Storage operations/quotas, exact migration history, grants/RLS, TLS/domain ownership, backups/recovery and real end-to-end transactions remain unverified.

`operationalReady` always remains false and operational acceptance remains `not_verified` in Phase 1. Existing Auth/Storage evidence cannot be inferred from table reads. Auth acceptance remains a required unverified gap; the guide therefore does not produce a misleading fully verified launch state.

## Security and scope

Both the existing Dashboard route middleware and backend require owner authorization. Ordinary admins, including administrators with configuration permissions, cannot read setup status. Existing integration permissions are unchanged. Only SELECTs/configuration helpers run after authorization; there are no RPC invocations, provider requests, configuration writes, audits, queues or background processing from Setup reads.

Infrastructure credentials are operator-managed. The guide never accepts Supabase administrative credentials, master/worker keys, SSH credentials or VPS configuration. There is no migration, database table, key rotation, production access, deployment, provider activation, message/payment/shipment/reset or Product Manager change in this phase. All 69 migration files stay unchanged.

## Validation

`tests/quick-setup.test.mjs` covers real Dashboard middleware, route/navigation boundaries, configured/incomplete/disabled/unavailable selections, stale/failed evidence, credential redaction, capability limits and actual H3 owner authorization. Actual configuration reads use the complete application schema and unchanged migration chain in disposable PGlite; whole-public-table fingerprints and SQL traces prove no writes/RPCs. Auth transport is fixture-only.

`scripts/setup-browser.mjs` compiles the actual Vue page and uses application CSS plus actual H3/SQL status reads. It reviews all seven sections in EN/AR, desktop/tablet/mobile and Light/Dark/System, existing localized links, keyboard/step behavior, real theme surfaces, failed/stale/unavailable states, non-owner rendering and revocation including late requests. Chrome is local and external browser traffic is refused. This is component/browser fixture acceptance, not hosted Supabase sign-in or production Dashboard acceptance.

`scripts/setup-artifacts.mjs` scans public artifacts and renders the actual page through Vue SSR for owner/non-owner/inactive states. It asserts no private Setup fetch, populated integration card or secret canary in SSR. Screenshots and machine-readable reports are written under temporary storage, not committed to application assets.

Commands use the repository's prepared Node 22 environment. Browser/native tests need loopback networking permission. Native regression tools are documented in `storage-policy-delegation.md`; they accept executable paths and create fresh owned loopback clusters, never a production database URL.

```sh
node --test tests/quick-setup.test.mjs tests/dashboard-navigation.test.mjs
node --test --test-concurrency=2 tests/*.test.mjs
npm run typecheck
npm run build
node scripts/setup-browser.mjs
node scripts/setup-artifacts.mjs
git diff --check
```

Provide `SETUP_REVIEW_PLAYWRIGHT` and `SETUP_REVIEW_CHROME` when the default prepared local browser paths are unavailable; `SETUP_REVIEW_ARTIFACTS` overrides the screenshot directory.

## Final local results — 2026-10-11

- Full regression: **813 passed, zero failures/skips**, with native PostgreSQL17.11, PostgREST16.4 and actual Supautils fixtures enabled.
- Node22 typecheck and production build: passed; existing ERP duplicate-import, sourcemap and chunk-size warnings remain.
- Browser: **1,062 assertions, 136 screenshots, eight JSON responses**, zero browser errors/external requests. Auth/provider data are fixtures; no production connection or real provider call.
- Public/SSR review: **135 files, eight actual Vue SSR cases**, zero private Setup fetches or secret exposure.
- All69 existing migration files are byte-identical to `0c702f6`; deployment/secret helpers are unchanged; no new migration.
- Persistent selected screenshots, browser/artifact reports and validation logs: `/Users/imac/Documents/ELcomputer/quick-setup-phase1-review-20261011`. The complete screenshot matrix remains under `/private/tmp/elcomputer-setup-browser`.

## Deferred work and production deployment

Phase 2 adds private persistent progress/selections and revision-bound verification evidence, with separately approved explicit provider checks. Phase 3 adds trusted clean installation, baseline/grant initialization, safe draft provider defaults and atomic/resumable first-owner bootstrap. Phase 4 adds controlled import, isolated cloning, file/key recovery and reviewed cutover. Existing migration source must remain unchanged.

Production remains at the user-verified deployed `0c702f6` and 69 migrations until a separately authorized application deployment. No migration is needed for Phase 1. Before that release, review current Git/schema parity and dormant controls, backups, compatible output recovery and the locked deployment target. Do not reuse the consumed prior release GO or its checkpoint63 mutation helpers. After deployment, verify the owner-only navigation/page/API with real signed-in owner and non-owner sessions, existing settings links and locale/theme/mobile behavior. Deployment does not authorize provider activation, integration transactions or installer/cloning work.
