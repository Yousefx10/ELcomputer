# Central SMS report — 2026-10-05

The foundation has a committed dormant production deployment/infrastructure record. Order notifications are now implemented locally and await their own migration/release. Prior foundation-only records below remain historical. Vodafone remains disabled; no real SMS/provider call occurred.

## Order SMS notifications — local implementation

Full requested 28-point report: [order-sms.md](order-sms.md). Successful order insertion maps to Order confirmed; authoritative payment transition to `paid` maps to Payment confirmed; actual `processing` and `cancelled` transitions map to their respective events. Cash, verified preorder receipt/release, Paymob TEST/live/replay/cancellation guards and ERP ownership are preserved. No frontend decides or sends an order SMS.

Unapplied additive migration `20261006100000_order_sms_notifications.sql` adds order locale, private event bindings and durable transition intents. All events and four seeded central bilingual templates default off. Existing Dashboard settings/templates/history, Notification service/queue/worker, permissions/encryption and normalization/segmentation are reused. Sender stays centrally configured. Only the order phone snapshot is used; language is validated checkout EN/AR or English fallback. Safe variables use committed order amounts/status/payment labels.

Unique order/event identities prevent repeated saves, re-entry, payment replays and worker retries from creating another message. Business transactions capture intents; the existing authenticated worker atomically enqueues/completes them in the central queue. Disabled/unconfigured events produce terminal history, never future-sendable batches. Captured revisions/template timestamp, ten-minute expiry and final post-DNS checks prevent stale activation. SMS failure cannot change commerce; total intent-storage failure may lose even the safe fallback audit, as documented. No historical replay.

### Final local validation

- Node **24.16.0**; `node --test tests/*.test.mjs`: **401 passed, zero failed, one existing optional native Paymob skip** (402 total).
- `node --test tests/order-sms.test.mjs tests/sms-*.test.mjs`: **78 passed, zero failed/skipped**, including both Vodafone PDF literal-key fixtures and all foundation queue/RBAC/XML/security regressions.
- `npm run typecheck`, `npm run build`, `git diff --check`: **passed**. Nuxt checks used `env -u DEBUG`; existing ERP duplicate-import/sourcemap/chunk warnings remain.
- Actual-schema SQL tests cover rollback, paid/partial/Cash, processing/cancellation/re-entry, Paymob TEST/live fixture replay/late cancellation, defaults/no replay, disabled/no backlog, revision/expiry/post-DNS guards, contact/locale/money/variables, Notification-only routing, Unicode limits, atomic enqueue/lease/retry/concurrent preparation and downstream failure safety. Actual H3 tests cover event controls, settings/templates/history permissions, masked history and worker authentication. Independent native PostgreSQL sessions are not claimed.
- Actual local Vue/browser fixtures: **432 assertions, 72 screenshots, zero console/runtime errors or external requests**. EN/AR/RTL, desktop/mobile, Light/Dark/System, event controls/bindings/save/reload/read-only access, templates/history, Cash checkout metadata and order Dashboard processing/cancellation. Arabic mobile Dark settings/history screenshots inspected. Fixture acceptance does not establish authenticated production acceptance.
- Built localhost HTTP/SSR/public artifacts: **948 assertions, 16 requests, 115 public files, seven fictional private value types, zero exposures**. Anonymous controls, absent/invalid worker secrets and EN/AR login guards denied safely. Temporary local servers stopped after validation.
- Evidence: `/tmp/elcomputer-order-sms-{focused,suite,typecheck,build,browser,http}.log` and `/tmp/elcomputer-order-sms-review/browser/`. Provider transport is mocked; all local credential fixtures are fictional.

```text
ORDER SMS FOUNDATION IMPLEMENTED: YES
ORDER CONFIRMED SMS CONNECTED: YES
PAYMENT CONFIRMED SMS CONNECTED: YES
ORDER PROCESSING SMS CONNECTED: YES
ORDER CANCELLED SMS CONNECTED: YES
ORDER SMS CONFIGURATION DASHBOARD-MANAGED: YES
ORDER SMS IDEMPOTENCY DATABASE-BACKED: YES
DISABLED EVENTS CREATE FUTURE-SENDABLE BACKLOG: NO
VODAFONE ENABLED: NO
REAL VODAFONE API CALLED: NO
REAL SMS SENT: NO
PDC SMS CONNECTED: NO
OTP CONNECTED: NO
NPS CONNECTED: NO
RETURNS/WARRANTY SMS CONNECTED: NO
PRODUCTION MIGRATION APPLIED: NO
PRODUCTION DEPLOYED: NO
```

“Connected” describes local code, not a production release or active messaging. This development computer intentionally has no production credentials; none were obtained/recreated/copied/inferred/modified, and no production connection was attempted. Prior production readiness is inherited from the user and committed record, not live-reverified. Transfer committed/pushed work to the authorized deployment computer for reviewed migration and guarded release with provider/events off. Authenticated acceptance and activation/testing remain separate. PDC → SMS is a future separate consumer after order-feature acceptance. STOP after this feature.

## Production infrastructure readiness — 2026-10-05

The existing production PM2 environment now supplies `NUXT_CREDENTIALS_ENCRYPTION_KEY` and `NUXT_SMS_WORKER_SECRET`. Configuration was persisted with `pm2 save` and owner-only saved-environment permissions; no repository environment file was uploaded.

The pre-existing `CREDENTIALS_ENCRYPTION_KEY` was reused through the documented Nuxt runtime override. SMS and Daftra retain the existing shared AES-256-GCM helper; PDC's separate shipping-key configuration is unchanged. Only the missing worker secret was securely generated server-side with Node cryptographic randomness. No secret value is recorded here.

```text
MASTER ENCRYPTION INFRASTRUCTURE READY: YES
SMS WORKER INFRASTRUCTURE READY: YES
VODAFONE ENABLED: NO
VODAFONE CREDENTIALS CONFIGURED: NO
```

Earlier infrastructure readiness blockers below describe the deployment-time state and are superseded by this completed readiness task.

## Dormant production deployment — 2026-10-05

This authorized release supersedes the earlier local-only status. No feature or SMS business consumer was added. Vodafone remains disabled and unconfigured.

1. **Branch and deployed commit:** clean synced `main`, `39c5c9ea5689c68efa572edcc5933780d94f7193`. GitHub metadata was refreshed and `HEAD` matched `origin/main` before release. Previous production output matched all 696 entries of the prior PDC release (`73de4da655285dfa08d5a733f52cb29044d07026`). Subsequent release-documentation commits do not change the deployed application identity.
2. **Pre-deployment validation:** Node 24.16.0; 375 full-suite passes, zero failures, one existing optional native Paymob skip; 52 focused SMS passes; typecheck/build/diff check/preflight passed. SMS component/browser fixtures: 338 assertions/48 screenshots/no errors/external requests. Built-local HTTP/SSR/artifacts: 801 assertions/14 requests/115 public files/six fictional private types/zero exposures. The first sandboxed test run could not bind localhost; the identical suite passed with localhost sockets permitted. Existing ERP duplicate-import, sourcemap/chunk warnings were retained without source changes.
3. **SMS migration applied:** only `20261005160000_vodafone_sms_foundation.sql`, SHA-256 `0a88239aa00db65a17672736f933dc01fc3e4d51d08fd2175bc5dc99ed2ca5ad`. Reviewed additive tables/indexes/constraints, default-deny permissions, service-only queue functions and existing full-reset allowlist/active-worker guard. Applying it performed no reset, historical rewrite or SMS dispatch. The dry run listed no unrelated pending migration.
4. **Migration alignment:** all 59 local/remote versions match. Supabase's Docker catalog-cache warning was non-fatal only after live parity/schema/security/data checks succeeded. Final fingerprints across 21 historical tables match the pre-release baseline, including staff permissions, commerce/shipping settings, 91 products/91 variants, 8 orders/12 items, three customer profiles, 382 cities/32 mappings, five chat conversations and two NPS responses.
5. **Deployment result:** existing `env -u DEBUG npm run deploy` completed guarded preflight, a fresh secret-free build, `.output`-only upload, backup, target restart, retrying internal health and public HTTPS health. No `.env`/`.deploy.env` upload, deployment-script bypass, Nginx/firewall change or unrelated site/process modification occurred. All 710 deployed files/symlinks match the guarded local build; manifest digest `b9574e388de2b4ba9a686594dd980fc8a2857fcd783ec5efc7d8348d55346773`.
6. **PM2/health:** `new-elcomputer` online, `/home/newelcomputer/htdocs/new.elcomputer.net`, `.output/server/index.mjs`, internal port 3001, expected Node 22.23.1 interpreter. One scoped restart, 35 → 36. The first internal probe during restart failed transiently, then the existing retry succeeded. Error-log bytes/hash are unchanged through final verification.
7. **SMS Dashboard verification:** all four EN/AR settings/templates/send/history URLs redirect anonymous visitors to Dashboard login, including live desktop/mobile Light/Dark states. The actual Vue/preferences fixture suite independently verifies tabs, EN/AR/RTL, Light/Dark/System, restricted rights, masking, replacement/blank preservation, templates/history and blocked send controls. Authenticated production staff interiors, save/reload and permission edits are **NOT VERIFIED** because no signed-in production session was supplied; fixtures and login protection are not claimed as authenticated acceptance.
8. **Settings/encryption:** merchant enablement, Account ID/password/hash secret, senders/default sender, server/base URL/port, both endpoint paths, trusted-IP/account/protocol confirmations, timeouts/retry/batch/pacing/phone configuration remain Dashboard/database-managed. Live singleton is disabled; Account ID/password/hash-secret columns are null; host/default sender/outbound IP empty, port null, sender list empty, confirmations false and config revision zero. No merchant value was put in ordinary environment variables. AES-256-GCM replace-only storage and presence-only projections pass fixtures; production has no stored Vodafone secrets. Master encryption infrastructure is **not ready**, so later credential storage remains blocked rather than using plaintext.
9. **SecureHash deployed behavior:** Vodafone clarification **INC000081856720** is retained. The built function on the VPS executed both published deterministic fixtures successfully without network access. It uses HMAC-SHA256, the literal uppercase hexadecimal string directly as the key, exact parameter and SMSList ordering, UTF-8 input and uppercase hexadecimal output. No hex decoding or fallback exists. Order/UTF-8/ExternalTrxId semantics were also independently rerun in focused tests.
10. **Notification/Campaign separation:** distinct endpoint paths remain `/web2sms/sms/submit/Notification` and `/web2sms/sms/submit`; the pairing is constrained in settings/SQL/provider code. Notification enforces one recipient; Campaign requires its separate permission/confirmation/quota. The central services both return 503 for actual disabled production settings before queue writes. No live send was attempted.
11. **RBAC/RLS:** read-only native production SQL verifies RLS and zero browser policies on all five SMS tables; neither anon nor authenticated has SELECT/INSERT/UPDATE/DELETE. All five queue RPCs deny anon/authenticated and grant service_role only, with security-definer/search-path protections. Eight new SMS rights default false; existing staff records are unchanged. Production anonymous settings/capabilities/templates/history/send API access and writes return 401/private,no-store. Customer/nonprivileged staff behavior is covered in isolated tests and live database grants, but a signed-in production customer/staff API flow was not exercised.
12. **Queue dormant state:** templates/batches/messages/attempts all zero at final read. Enabled state false, no worker authentication secret ready, no scheduler installed by this release. Live SQL confirms disabled enqueue/claim/final dispatch checks, and live APIs reject absent/invalid worker secrets before processing. No production queue record was forged for acceptance. Lease/concurrency/recovery/idempotency and final post-DNS authorization pass actual isolated SQL tests; independent native-session races and an in-flight authorized request remain unexercised.
13. **Secret exposure:** 118 deployed public files scanned against three private running-process values, plus nine server-side responses, all production HTTP responses and 2798 browser response scans; zero detected exposures. Built-local fictional secret/SSR/error scans and presence-only settings projection checks passed. Production log fingerprint is unchanged; no Vodafone credentials existed to log. No credential plaintext/ciphertext is returned by the settings projection. Provider bodies/hash source are not logged by the reviewed SMS code.
14. **Production regression checks:** The first browser run accepted 53 states before a navigation exceeded its 15-second harness wait; the homepage independently returned 200 in 11.38 seconds. The remaining mobile/System states were rerun with a 45-second navigation wait, without app changes. Combined accepted coverage: 143 HTTP assertions/34 requests and 594 browser assertions/84 page states passed. Home, real product, cart persistence, checkout/login/customer-account protection, Dashboard/SMS tab protection, Arabic/RTL, desktop/mobile Light/Dark/System and Live Chat launcher/open/close passed. No browser errors/provider calls/private exposure/commerce writes. Paymob capability remains dormant and PDC settings/data are unchanged. Real authenticated checkout/account/dashboard/chat messaging acceptance is not claimed.
15. **Any Vodafone API call:** **NO**. Deterministic hash fixtures and transport tests were local/mocked. No endpoint connectivity check, trusted-IP registration/update or provider contact occurred.
16. **Any SMS sent:** **NO**. No real or fake production messages, campaigns or templates were inserted; no valid worker request was performed.
17. **Production encryption readiness:** **NO**. The effective built/runtime `credentialsEncryptionKey` is not configured to the required length; `NUXT_SMS_WORKER_SECRET` is also unconfigured. Neither infrastructure secret was added/changed. Before any future credential storage configure the existing server-only master encryption infrastructure securely, then verify encryption/masking and authenticated save/reload. Worker provisioning/scheduling is later separately authorized work.
18. **Rollback availability:** `/home/newelcomputer/htdocs/new.elcomputer.net/.output-deploy-backup-20261005-185939-48604`. All 696 files/symlinks exactly match the pre-release production manifest. Backup remains readable and rollback was unused. Use the established guarded rollback contract; retain the additive migration if reverting application output. Prior backups remain governed by the existing retention setting.
19. **Remaining activation requirements:** separately authorize encryption/worker infrastructure, authenticated staff/customer acceptance, Vodafone credentials/approved senders/modern-TLS host+port+paths, trusted outbound IP/account/interface activation, quotas/rates/international eligibility and ExternalTrxId contract acceptance. Keep settings disabled while provisioning. Only later explicit authorization permits enablement and small real Notification/Campaign acceptance. No OTP, NPS, order, PDC, returns, warranty or pickup consumer is connected.

```text
SMS FOUNDATION CODE DEPLOYED: YES
SMS FOUNDATION MIGRATION APPLIED: YES
SMS CONFIGURATION DASHBOARD-MANAGED: YES
VODAFONE SECRETS STORED ENCRYPTED: NO (no Vodafone secrets are stored; future storage requires AES-256-GCM)
VODAFONE SECUREHASH PROVIDER BEHAVIOR CONFIRMED: YES
SECUREHASH USES LITERAL SECRET STRING: YES
SECUREHASH HEX-DECODED: NO
VODAFONE ENABLED: NO
VODAFONE CREDENTIALS CONFIGURED: NO
REAL VODAFONE API CALLED: NO
REAL SMS SENT: NO
OTP CONNECTED: NO
NPS CONNECTED: NO
ORDER SMS CONNECTED: NO
PDC SMS CONNECTED: NO
RETURNS/WARRANTY SMS CONNECTED: NO
PRODUCTION ENCRYPTION READY: NO
AUTHENTICATED PRODUCTION SMS DASHBOARD ACCEPTANCE: NOT VERIFIED
```

Release evidence: `/tmp/elcomputer-sms-deploy-20261005/` contains validation/preflight/deploy logs, migration dry-run/push/parity, read-only data/security snapshots, disabled-gate checks, deployed hash fixtures, output/backup manifests, HTTP/browser reports and screenshots. Temporary localhost app and fixture browsers were stopped. Documentation is committed/pushed separately from the deployed application commit. STOP after this dormant release; no additional feature starts here.

## Provider-confirmed SecureHash correction — INC000081856720

The user supplied official Vodafone support clarification **INC000081856720** after the audit. Provider-confirmed production behavior is **HMAC-SHA256 with the literal uppercase hexadecimal Secure Hash Secret string as key bytes**, without HEX decoding. This overrides the contradictory written sentence in the PDF. The local implementation now follows this behavior; exact parameter/SMSList ordering, UTF-8 input, optional ExternalTrxId semantics and uppercase output remain. Both one-message and multi-message printed PDF hashes pass as deterministic regression fixtures. There is no decoded-key mode or automatic fallback.

Dashboard/server validation accepts only nonempty uppercase `0-9A-F` strings bounded to 512 characters, without trimming/uppercasing arbitrary input or requiring decoded-byte pairs. Vodafone's `A1B2C3D4E5F6` example is accepted literally. Blank input preserves the encrypted value; secret read-back remains presence-only. EN/AR labels and protocol confirmation now describe literal uppercase keys and reference the support ticket. No enablement or confirmation flag was changed automatically.

The former hash activation blocker is resolved. External provisioning, readiness, acceptance and separately authorized activation remain required. This focused correction performs no deployment, production migration, Vodafone contact or real SMS and changes no queue, traffic, RBAC/RLS or XML/transport architecture. The prior audit and implementation validation below remain historical evidence.

### Correction validation

- Node **24.16.0**; `node --test tests/*.test.mjs`: **375 passed, zero failed, one existing optional native Paymob test skipped** (376 total).
- `node --test tests/sms-*.test.mjs`: **52 passed, zero failed or skipped**, including all prior queue/RBAC/XML/transport regressions.
- `npm run typecheck`, `npm run build`, `git diff --check`: **passed**. Build/typecheck used `env -u DEBUG`; existing duplicate ERP import, sourcemap and chunk-size warnings remain.
- Tests verify actual one-/three-message PDF outputs, direct literal key versus decoded bytes, exact parameter/SMSList order, included/omitted/present-empty ExternalTrxId, Arabic/UTF-8, uppercase output, rejection without normalization and exact encrypted replacement. Actual H3 manual Notification/Campaign XML uses the literal-key digest; settings/history/worker responses, audits and attempt records expose neither the key, hash input nor generated digest.
- Browser: **338 assertions, 48 screenshots, zero console/runtime errors or external requests**. Actual Vue EN/AR fixtures verify literal-key validation, lowercase denial, blank preservation, masking and existing functionality across desktop/mobile/Light/Dark/System.
- Built localhost HTTP/SSR/artifact scan: **801 assertions, 14 requests, 115 public files, six fictional private value types, zero exposures**. Temporary server stopped. Source review confirms no credential/hash-source logging in the SMS server implementation. No real merchant credentials were configured.
- Evidence: `/tmp/elcomputer-sms-literal-{before,focused,suite,typecheck,build,browser,http}.log` and `/tmp/elcomputer-sms-review/`. Native PostgreSQL independent-session races, authenticated production/staging sessions, scheduling and live provider acceptance remain unexercised.

```text
VODAFONE SECUREHASH PROVIDER BEHAVIOR CONFIRMED: YES
SECUREHASH USES LITERAL SECRET STRING: YES
SECUREHASH HEX-DECODED: NO
DOCUMENTED VODAFONE HASH FIXTURES PASS: YES
FULL TEST SUITE PASSED: YES
REAL VODAFONE API CALLED: NO
REAL SMS SENT: NO
PRODUCTION MIGRATION APPLIED: NO
PRODUCTION DEPLOYED: NO
```

## Subsequent security review — 2026-10-05

**SAFE TO PROCEED TO DORMANT PRODUCTION DEPLOYMENT**, including the audit fixes. Full 14-point review: [`sms-security-review.md`](sms-security-review.md). Do not release the original `c29fb09` implementation without these fixes.

Reproduced and fixed four defects: high-severity stale-worker POST authorization, medium-severity swappable traffic paths, medium-severity IPv6/public-destination filtering and low-severity multipart character-boundary undercounts. The existing unapplied migration now constrains traffic endpoints and adds the service-only final dispatch authorization RPC. Merchant settings/encryption/RBAC/RLS remain private and Dashboard-managed. At audit time the original decoded-key implementation conflicted with the printed textual-key examples and blocked activation. That issue is now resolved by **INC000081856720** and the focused literal-key correction above.

Fresh results: **373 full-suite passes/one existing optional native skip; 50 focused SMS passes; typecheck/build/diff check passed** on Node 24.16.0. Actual local Vue fixtures: **330 assertions/48 screenshots**, zero errors/external requests. Built localhost SSR/API/artifacts: **801 assertions/14 requests/115 public files/six fictional private value types**, zero exposures. Native PostgreSQL independent-session races and authenticated production/staging/provider acceptance remain unexercised. Evidence: `/tmp/elcomputer-sms-audit-*.log` and `/tmp/elcomputer-sms-review/`. No deployment, production migration, Vodafone call or real SMS occurred. The numbered implementation report and original validation below are historical evidence from before this review.

```text
SMS FOUNDATION AUDITED: YES
VODAFONE SECUREHASH PROVIDER BEHAVIOR CONFIRMED: YES
SECUREHASH USES LITERAL SECRET STRING: YES
SECUREHASH HEX-DECODED: NO
REAL VODAFONE API CALLED: NO
REAL SMS SENT: NO
PRODUCTION MIGRATION APPLIED: NO
PRODUCTION DEPLOYED: NO
```

## Original implementation report

1. **Audit findings:** all supplied PDF pages and project instructions/state/handoff reviewed. Searches found no existing outbound SMS subsystem; existing messages are in-app chat/support/order content. See `sms-audit.md`.
2. **Reused architecture:** AES-256-GCM credential helpers, staff auth/RBAC, service-role database client, bounded body reading, activity audits, private SQL leases/jobs, authenticated internal worker and shared Dashboard locale/theme/navigation.
3. **Files changed:** Dashboard SMS page; shared SMS preview/template utility; permission/navigation/localization definitions; server SMS settings, errors, transport, Vodafone protocol, service and API helpers; seven staff API routes and one internal worker; server-only worker runtime key; reset allowlist; one migration; four focused test files and SQL adapter; browser/HTTP acceptance scripts; this report, audit/usage docs and both project handoff/state files. Exact file list follows below.
4. **Schema:** additive `20261005160000_vodafone_sms_foundation.sql`, unapplied in production. Five private tables with constraints, FKs, indexes/RLS, atomic enqueue/claim/begin/finish RPCs, default-deny SMS permission definitions and existing full-reset awareness. Historical commerce and customer phones are unchanged.
5. **Provider architecture:** future server code calls `createSmsService(db).sendNotification` or `.sendCampaign`; provider details stay behind `vodafoneProvider.submit`. One outbound SMS service.
6. **Vodafone implementation:** configured HTTPS XML endpoints, exact namespace/ordered fields and per-message ordered responses; no invented sandbox, delivery receipt or inquiry endpoint.
7. **Dashboard:** one SMS navigation group, four tabs, shared preferences and route protection, responsive EN/AR and logical RTL spacing.
8. **Dashboard-managed settings:** enablement/mode/server/port/credentials/senders/paths/IP/activation/notes/timeouts/preflight retry/batch/pacing/country/international behavior. No merchant environment variables or fabricated account/server data.
9. **Encryption:** existing server master key encrypts Account ID, password and hash secret. Replace-only fields expose presence flags; no plaintext/ciphertext read-back, SSR persistence or audit values.
10. **SecureHash:** the original implementation used a decoded key. This is superseded by **INC000081856720**: current behavior is HMAC-SHA256 with the literal uppercase hexadecimal secret string, UTF-8 ordered pairs, repeated message ordering, optional ExternalTrxId last and uppercase output, server-only.
11. **Document verification:** the printed examples contradict the PDF's decoded-key sentence. Vodafone has confirmed that the examples' literal-key interpretation is the actual production behavior, ref. **INC000081856720**. The current implementation reproduces both printed hashes, and exact printed-fixture verification is now **YES**. Dashboard confirmations still default false; this correction does not activate the provider.
12. **Notification:** exactly one normalized recipient; its own permission and published Notification path.
13. **Campaign:** explicitly selected path/permission, bounded recipient list and count confirmation; persistent manual quota. No segmentation CRM, automation or Notification fallback.
14. **XML security:** escaped serializer/valid code points/CR preservation; strict bounded namespace/status/count parsing; DTD/XXE rejection. DNS destination checks/pinning, modern TLS, no redirects, bounded headers/time/response.
15. **MSISDN:** canonical `+` international form, Egypt 10/11/12/15 variants, explicit international option; normalize at send time without rewriting history.
16. **Encoding:** shared GSM basic/extension and UTF-16 code-unit estimate, 160/153 and 70/67 limits; Unicode preview and separate character count. Billing is not claimed.
17. **Templates:** codes/names/purpose/EN/AR/traffic/enabled/sender/variables/audit timestamps; safe known-variable replacement; missing translation/variables fail. No speculative seeds or event bindings.
18. **Manual portal:** phone entry, sender, text or enabled template, normalized preview/encoding/segments, controlled enqueue and Campaign confirmation. No implicit phone-to-customer identity matching.
19. **Jobs:** durable private batches/messages/attempts; expiry/priority, content-bound idempotency, random stable ExternalTrxId, atomic leases, one POST at a time and configurable pacing; authenticated bounded worker. Scheduler remains a later deployment requirement.
20. **History:** paginated masked recipients, actor/source/template, sender, timestamps, queue/provider states, attempts, transaction ID, numeric diagnostics. No delivered claim, body retrieval or credential logging.
21. **RBAC:** eight independent SMS keys under existing staff architecture, default false for existing/new staff; owner semantics preserved. Browser roles cannot access tables or RPCs.
22. **Error codes:** centralized mapping of all 34 V5 codes; 9013/9014/9021/9023/9034 explicitly tested. Raw errors never reach consumers.
23. **Recovery:** retry only proven preflight failure with bounds/delay/same ID; terminal provider rejection; ambiguous POST/stale worker → uncertain. No automatic uncertain resend, invented inquiry or provider idempotency guarantee.
24. **Tests:** `sms-protocol`, `sms-settings`, `sms-queue`, `sms-api`; actual isolated application SQL/RLS/RPCs, actual H3 staff routes with mocked auth, mocked provider XML, protocol conflict, order, encryption/replacement, phone/segments/templates/traffic/quota/leases/expiry/history/permissions.
25. **General validation:** final command results are recorded in the validation section below.
26. **Browser:** actual SMS Vue page and shared preference component under isolated API/auth fixtures; all four tabs, EN/AR × desktop/mobile × Light/Dark/System, masking/replacement, previews, manual Notification/Campaign, template save, masked diagnostics and restricted staff. Screenshots inspected; dark-mode scoped selector behavior corrected. Authenticated production acceptance is not claimed.
27. **Real Vodafone API:** none; provider tests inject transport and browser blocks external network.
28. **Real SMS:** none.
29. **Before production:** review code/schema and the provider-confirmed correction, authorize dormant release/migration, configure infrastructure encryption/worker/scheduler, complete authenticated staging acceptance and then separately authorize provider tests/activation. No deployment was attempted.
30. **Vodafone requirements:** provision Account ID/password/literal uppercase HEX secret, approved senders, real HTTPS host/port, modern TLS certificate, account/interface activation, registered outbound IP(s) and quotas/rates/international eligibility. Hash key interpretation is resolved by **INC000081856720**.
31. **Activation sequence:** review corrected literal-key implementation → authorized dormant release/migration → infrastructure → Vodafone provisioning → Dashboard save disabled → external confirmations → explicit enablement → separately authorized single test → separately authorized bounded Campaign test → reporting/uncertain-result review.
32. **Recommended next consumer:** separately scoped order confirmation after durable local order creation. OTP needs its own security design; no consumer implementation began here.

## Original implementation validation

- `node --test tests/*.test.mjs`: **359 passed, 0 failed, 1 existing optional native test skipped** (360 total).
- `node --test tests/sms-*.test.mjs`: **36 passed, 0 failed**.
- `npm run typecheck`, `npm run build`, `git diff --check`: **passed**, Node **24.16.0**. Build/typecheck ran with the inherited DEBUG variable removed to suppress hook timing noise. Existing duplicate ERP import, sourcemap and bundle-size warnings remain; no unrelated fix was made.
- `scripts/sms-browser.mjs`: **326 assertions, 48 screenshots, zero runtime/console errors, zero external requests**. Actual SMS page/shared preferences, isolated staff/API fixtures, EN/AR, RTL, 1440/390px, Light/Dark/System, all four tabs, disabled sends, secret masking/replacement, template save, normalized Unicode preview, both traffic paths/count confirmation, masked history and restricted permissions. Dark-mode screenshots were visually inspected after the CSS fix.
- `scripts/sms-http.mjs`: **801 assertions, 14 local built-server requests, 115 public files scanned against six fictional private value types, zero detected exposures**. Anonymous staff/worker denial, all EN/AR SMS tab login guards, HTML/SSR/error responses and public artifacts. No real Vodafone credentials existed to scan.
- Historical Python hashlib and Node crypto verification proved both printed hashes match textual key bytes and not decoded bytes. The then-active decoded-key implementation did not match them; that behavior is superseded by INC000081856720. Current literal-key fixture matching is **YES**.
- Actual isolated SQL validates defaults/encryption storage access, transaction-bound idempotency, stable transaction IDs, mocked queue submission, preflight retry bounds, stale/uncertain behavior, expiry/priority/revision checks, active-worker full-reset denial and recreation of absent disabled configuration. Actual H3 handlers verify permissions, audit flags, quotas, secret-safe read-back/history, bounded bodies and sanitized unexpected errors with mocked identity verification. Both actual manual H3 traffic paths reach mocked Vodafone XML submission through the same central queue.
- **Not verified:** authenticated production/staging staff sessions, native PostgreSQL independent-session SMS races, actual worker scheduling/production infrastructure, provider network/TLS acceptance, live submissions/handset delivery or merchant billing. Existing optional native test skip is not claimed as a pass. PGlite tests verify real application SQL but do not establish multi-session concurrency acceptance.

Evidence logs and screenshots are under `/tmp/elcomputer-sms-*.log` and `/tmp/elcomputer-sms-review/` and are local ephemeral artifacts, not production evidence. No remote database operation, migration, deploy, real provider request, SMS, Vodafone registration, networking change or real merchant credential configuration occurred.

Using only the document's fictional fixtures, including its ExternalTrxId:

| SMS count | Printed V5 result and current provider-confirmed literal-key output | Discarded HEX-decoded comparison (historical only) |
| --- | --- | --- |
| 1 | `70A7BE2DBCAF15C1544E4CD9EC520FC91426C06C1EF0B87D68EFF8BB0A56268D` | `6F37744E74B3C2381CB53FE8557140570E7AC4B8A81EE25A7C4EA5D584043518` |
| 3 | `60A7042DE62B10D268C516A575301959011EBEF8C6DB4AC67AFB314BE86C7BCD` | `7674D561C77824EC3B0B3381A2E229899ED52028C17C5C343801F3C054B1AD53` |

## Exact changed files

- `app/pages/dashboard/sms.vue`, `app/utils/sms.js`, `app/utils/adminPermissions.js`, `app/utils/dashboardNavigation.js`, `app/utils/uiMessageKeys.json`
- `i18n/locales/en.json`, `i18n/locales/ar.json`, `nuxt.config.ts`, `package.json`, `package-lock.json`
- `server/utils/sms/{admin,errors,service,settings,transport,vodafone}.js`, `server/utils/systemResetScopes.js`
- `server/api/admin-sms/{capabilities.get,settings.get,settings.patch,send.post,templates.get,templates.post,history.get}.js`, `server/api/internal/sms/process.post.js`
- `supabase/migrations/20261005160000_vodafone_sms_foundation.sql`
- `tests/sms-{api,protocol,queue,settings}.test.mjs`, `tests/helpers/smsDatabase.mjs`, `scripts/sms-browser.mjs`, `scripts/sms-http.mjs`
- `docs/sms-audit.md`, `docs/sms.md`, `docs/sms-report.md`, `PROJECT_STATE.md`, `CODEX_HANDOFF.md`

## Required declarations

```text
EXISTING SMS SYSTEM AUDITED: YES
PARALLEL SMS SYSTEM CREATED: NO
SMS CONFIGURATION DASHBOARD-MANAGED: YES
VODAFONE SECRETS STORED ENCRYPTED: YES
VODAFONE SECUREHASH VERIFIED AGAINST DOCUMENT: YES — printed fixtures match literal-key behavior confirmed by INC000081856720
NOTIFICATION/CAMPAIGN SEPARATED: YES
REAL VODAFONE API CALLED: NO
REAL SMS SENT: NO
PRODUCTION MIGRATION APPLIED: NO
PRODUCTION DEPLOYED: NO
```

Encrypted storage is verified with fictional isolated test values; no real merchant credential was configured. STOP here: no OTP, NPS, returns, warranty, shipping SMS, pickup or other feature.
