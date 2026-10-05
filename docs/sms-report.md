# Vodafone SMS foundation report — 2026-10-05

Implementation is local and dormant. No production migration/deployment, Vodafone contact, real provider call, SMS or real Vodafone credentials occurred. Scope stops at the reusable SMS foundation.

## Subsequent security review — 2026-10-05

**SAFE TO PROCEED TO DORMANT PRODUCTION DEPLOYMENT**, including the audit fixes. Full 14-point review: [`sms-security-review.md`](sms-security-review.md). Do not release the original `c29fb09` implementation without these fixes.

Reproduced and fixed four defects: high-severity stale-worker POST authorization, medium-severity swappable traffic paths, medium-severity IPv6/public-destination filtering and low-severity multipart character-boundary undercounts. The existing unapplied migration now constrains traffic endpoints and adds the service-only final dispatch authorization RPC. Merchant settings/encryption/RBAC/RLS remain private and Dashboard-managed. HEX-decoded HMAC remains unchanged; both fictional PDF examples independently match textual key bytes. This ambiguity blocks **activation**, not dormant deployment.

Fresh results: **373 full-suite passes/one existing optional native skip; 50 focused SMS passes; typecheck/build/diff check passed** on Node 24.16.0. Actual local Vue fixtures: **330 assertions/48 screenshots**, zero errors/external requests. Built localhost SSR/API/artifacts: **801 assertions/14 requests/115 public files/six fictional private value types**, zero exposures. Native PostgreSQL independent-session races and authenticated production/staging/provider acceptance remain unexercised. Evidence: `/tmp/elcomputer-sms-audit-*.log` and `/tmp/elcomputer-sms-review/`. No deployment, production migration, Vodafone call or real SMS occurred. The numbered implementation report and original validation below are historical evidence from before this review.

```text
SMS FOUNDATION AUDITED: YES
VODAFONE SECUREHASH PROVIDER BEHAVIOR CONFIRMED: NO
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
10. **SecureHash:** HMAC-SHA256, HEX-decoded key, UTF-8 ordered pairs, repeated message ordering, optional ExternalTrxId last; uppercase hexadecimal, server-only.
11. **Document verification:** **printed examples do not match the document's own HEX algorithm.** Both instead match textual UTF-8 keys. Tests and independent Python/Node calculations establish the discrepancy. Implementation follows the user's explicit HEX requirement. Vodafone clarification is required and Dashboard confirmation defaults false. Exact printed-fixture verification must be reported **NO**, not asserted falsely.
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
29. **Before production:** review code/schema/hash conflict, authorize dormant release/migration, configure infrastructure encryption/worker/scheduler, complete authenticated staging acceptance and then separately authorize provider tests/activation. No deployment was attempted.
30. **Vodafone requirements:** provision Account ID/password/HEX secret, approved senders, real HTTPS host/port, modern TLS certificate, account/interface activation, registered outbound IP(s), quotas/rates/international eligibility and correction/clarification of hash examples.
31. **Activation sequence:** review → authorized dormant release/migration → infrastructure → Vodafone provisioning/clarification → Dashboard save disabled → external confirmations → explicit enablement → separately authorized single test → separately authorized bounded Campaign test → reporting/uncertain-result review.
32. **Recommended next consumer:** separately scoped order confirmation after durable local order creation. OTP needs its own security design; no consumer implementation began here.

## Original implementation validation

- `node --test tests/*.test.mjs`: **359 passed, 0 failed, 1 existing optional native test skipped** (360 total).
- `node --test tests/sms-*.test.mjs`: **36 passed, 0 failed**.
- `npm run typecheck`, `npm run build`, `git diff --check`: **passed**, Node **24.16.0**. Build/typecheck ran with the inherited DEBUG variable removed to suppress hook timing noise. Existing duplicate ERP import, sourcemap and bundle-size warnings remain; no unrelated fix was made.
- `scripts/sms-browser.mjs`: **326 assertions, 48 screenshots, zero runtime/console errors, zero external requests**. Actual SMS page/shared preferences, isolated staff/API fixtures, EN/AR, RTL, 1440/390px, Light/Dark/System, all four tabs, disabled sends, secret masking/replacement, template save, normalized Unicode preview, both traffic paths/count confirmation, masked history and restricted permissions. Dark-mode screenshots were visually inspected after the CSS fix.
- `scripts/sms-http.mjs`: **801 assertions, 14 local built-server requests, 115 public files scanned against six fictional private value types, zero detected exposures**. Anonymous staff/worker denial, all EN/AR SMS tab login guards, HTML/SSR/error responses and public artifacts. No real Vodafone credentials existed to scan.
- Independent Python hashlib and Node crypto: both printed document hashes match textual key bytes; neither matches HEX-decoded key bytes. Required HEX implementation's ordered deterministic fixtures pass. Printed hash matching remains **NO**.
- Actual isolated SQL validates defaults/encryption storage access, transaction-bound idempotency, stable transaction IDs, mocked queue submission, preflight retry bounds, stale/uncertain behavior, expiry/priority/revision checks, active-worker full-reset denial and recreation of absent disabled configuration. Actual H3 handlers verify permissions, audit flags, quotas, secret-safe read-back/history, bounded bodies and sanitized unexpected errors with mocked identity verification. Both actual manual H3 traffic paths reach mocked Vodafone XML submission through the same central queue.
- **Not verified:** authenticated production/staging staff sessions, native PostgreSQL independent-session SMS races, actual worker scheduling/production infrastructure, provider network/TLS acceptance, live submissions/handset delivery or merchant billing. Existing optional native test skip is not claimed as a pass. PGlite tests verify real application SQL but do not establish multi-session concurrency acceptance.

Evidence logs and screenshots are under `/tmp/elcomputer-sms-*.log` and `/tmp/elcomputer-sms-review/` and are local ephemeral artifacts, not production evidence. No remote database operation, migration, deploy, real provider request, SMS, Vodafone registration, networking change or real merchant credential configuration occurred.

Using only the document's fictional fixtures, including its ExternalTrxId:

| SMS count | Printed V5 result (text-key bytes) | Result with required HEX-decoded key |
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
VODAFONE SECUREHASH VERIFIED AGAINST DOCUMENT: NO — document examples conflict with required HEX decoding
NOTIFICATION/CAMPAIGN SEPARATED: YES
REAL VODAFONE API CALLED: NO
REAL SMS SENT: NO
PRODUCTION MIGRATION APPLIED: NO
PRODUCTION DEPLOYED: NO
```

Encrypted storage is verified with fictional isolated test values; no real merchant credential was configured. STOP here: no OTP, NPS, returns, warranty, shipping SMS, pickup or other feature.
