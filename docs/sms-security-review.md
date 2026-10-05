# Vodafone SMS security and architecture review — 2026-10-05

## Dormant production security verification — 2026-10-05

Authorized dormant deployment succeeded for clean synced `main` commit `39c5c9ea5689c68efa572edcc5933780d94f7193`, including all audit fixes and **INC000081856720**. Only reviewed `20261005160000_vodafone_sms_foundation.sql` was applied; all 59 versions align. Historical business/staff/settings fingerprints are unchanged. Earlier local-only statements below describe the historical audit/correction, not the current release.

Fresh full/focused suites: 375 passes/one existing optional skip and 52 SMS passes; typecheck/build/diff/preflight passed. Actual component fixtures: 338 assertions/48 screenshots. Built-local HTTP/SSR/private-fixture scans: 801 assertions/14 requests/115 public files/six private types/zero exposures. Both deterministic public hash fixtures passed when executed from the deployed built function: literal uppercase hexadecimal string key, HMAC-SHA256, no HEX decoding or fallback.

Live read-only SQL verifies five RLS tables with no anon/authenticated table grants or browser policies, five service-only security-definer queue functions and eight default-deny rights. Disabled-provider enqueue/claim/final-dispatch guards are present and zero SMS business triggers are connected. Anonymous SMS APIs/worker access fail 401/private,no-store. Against actual disabled production settings both central services fail 503 before queue writes. Settings projections expose credential-presence flags only. Provider, credentials, host/port/senders and external confirmations are unconfigured; SMS templates/batches/messages/attempts are all zero.

One production browser navigation exceeded the initial 15-second harness wait without an app error; the homepage independently returned 200 in 11.38 seconds. Remaining mobile/System states were rerun with a 45-second wait. Combined production verification passed 143 HTTP assertions/34 requests and 594 browser assertions/84 page states, covering storefront/customer/staff/SMS guards, actual local cart persistence, EN/AR/RTL, desktop/mobile/themes/System and Live Chat open/close. Scan of 118 deployed public files against three private runtime values, nine server responses and 2798 browser response bodies found zero detected exposures. Error-log bytes/hash remain unchanged. All 710 deployed entries match the guarded local build; only `new-elcomputer` restarted once, 35 → 36.

**Master encryption and SMS worker authentication infrastructure are not ready.** Credential encryption remains mandatory AES-256-GCM; no Vodafone secrets are stored and no plaintext substitute was used. No master key/worker secret/scheduler, merchant credentials, provider activation or external endpoint was configured. This is safe for dormant operation and a blocker for later credential storage/activation. Authenticated production staff/customer interiors and settings save/reload, native independent-session races, worker scheduling and live provider/TLS/handset acceptance remain **NOT VERIFIED**.

Rollback is available and unused at `/home/newelcomputer/htdocs/new.elcomputer.net/.output-deploy-backup-20261005-185939-48604`; all 696 entries match the pre-release manifest. Keep the additive migration when reverting output. No Vodafone API call, real SMS, trusted-IP registration, fake production queue record or OTP/NPS/order/PDC/returns/warranty/pickup consumer occurred. Detailed 19-point release report/status flags: `docs/sms-report.md`; ephemeral evidence: `/tmp/elcomputer-sms-deploy-20261005/`. STOP after dormant release verification.

## Provider-confirmed SecureHash correction — INC000081856720

After this audit, the user supplied Vodafone's official support clarification **INC000081856720**: the production service uses the Secure Hash Secret as the **literal uppercase hexadecimal string when calculating HMAC-SHA256**, without HEX decoding. This authoritative clarification supersedes the contradictory written PDF sentence and the previous local decoded-key interpretation. The code now passes the literal string directly to HMAC; exact field/SMSList ordering, UTF-8 input and uppercase hexadecimal output remain. There is no compatibility fallback.

Dashboard/server validation accepts only nonempty uppercase `0-9A-F` strings, bounded to 512 characters. It rejects lowercase, padding, prefixes and non-string values without normalizing them. Since the key is literal text, there is no decoded-byte minimum or even-length restriction; the provider's `A1B2C3D4E5F6` example and odd-length uppercase text are supported. Blank replacement preserves the saved encrypted value. No secret is returned to the browser. Protocol-confirmation copy now describes literal uppercase keys; defaults and explicit activation controls remain intact.

The hash ambiguity is resolved. No real activation, deployment, production migration, Vodafone contact or SMS was authorized or performed. The correction changes only hashing, corresponding validation/copy/tests and documentation; the audited queue, RBAC/RLS and XML/transport architecture remain intact. Prior audit results retain their historical context.

### Fresh correction validation

- Node **24.16.0**. Full suite: **375 passed, zero failed, one existing optional native Paymob test skipped** (376 total). Focused SMS suite: **52 passed, zero failed or skipped**. All prior queue/RBAC/XML/transport regressions still pass.
- `npm run typecheck`, `npm run build`, `git diff --check`: **passed**. Build/typecheck used `env -u DEBUG`; existing duplicate ERP import, sourcemap and chunk-size warnings remain.
- Actual hash function reproduces both PDF digests and deterministic omitted/present-empty ExternalTrxId outputs. Negative tests distinguish decoded bytes, reversed parameters and reversed SMSList; Arabic/UTF-8 and uppercase output are retained.
- Settings/H3 tests reject lowercase, padding, prefixes, overlong and non-string replacements without changing saved settings or exposing rejected input. Valid literal values round-trip exactly through AES-256-GCM and never return plaintext/ciphertext. Mocked manual XML digests use literal keys; key/hash input/generated digest are absent from history, worker responses, audits and attempts. Source contains no SMS credential/hash-source logging.
- Actual Vue fixture browser checks: **338 assertions, 48 screenshots, zero errors/external requests**, including EN/AR literal-key input validity, blank preservation and masking. Built-local HTTP/SSR/public scans: **801 assertions, 14 requests, 115 public files/six fictional private types, zero exposures**. Temporary server stopped.
- Evidence: `/tmp/elcomputer-sms-literal-*.log` and `/tmp/elcomputer-sms-review/`. No native independent-session race, authenticated production/staging, scheduling, actual provider/TLS acceptance, real submission or billing verification was performed. No real merchant credentials were configured.

## 1. Overall verdict

**SAFE TO PROCEED TO DORMANT PRODUCTION DEPLOYMENT.**

This verdict applies to the reviewed foundation with the audit fixes and provider-confirmed correction above, and disabled Vodafone settings. It authorizes no deployment, migration, activation or provider test. Neither this audit nor the correction performed those actions. The former SecureHash ambiguity is resolved by INC000081856720; external provisioning/acceptance and separately authorized activation remain outstanding.

Reviewed `AGENTS.md`, `PROJECT_STATE.md`, `CODEX_HANDOFF.md`, `docs/sms-report.md`, all pages of the original supplied January 2026 V5 PDF, the complete implementation, and committed diff `c29fb09^..c29fb09` (38 files, 2,217 insertions, two deletions), followed by the audit changes. The working tree was initially clean. The PDF was treated as protocol evidence; the user's pasted review request controls task scope.

## 2. Findings and severity

| Severity | Defect reproduced before fixing | Consequence | Resolution |
| --- | --- | --- | --- |
| High | A worker recovered as stale during preflight could resume and POST because its final callback checked configuration but not its lease. | Outbound dispatch could occur after the ledger marked that job uncertain and revoked its authority. The late finish then failed. | Atomic lease/config/expiry check immediately before HTTP; recovered workers stop without POST or overwriting recovered state. |
| Medium | Dashboard paths could be swapped while remaining distinct, without clearing activation. | A Campaign could be posted to the individual Notification endpoint. | Preserve the published path relationship in settings, SQL and provider dispatch; path changes disable and clear confirmations. |
| Medium | IPv6 filtering used string prefixes and accepted expanded documentation addresses, special-purpose ranges and 6to4; IPv4 filtering also overblocked ordinary addresses. | The public-destination safety check was incomplete and spelling-dependent; legitimate public destinations could also be rejected. | Numeric CIDR filtering with conservative special-purpose exclusions, applied to literal hosts and every DNS result. |
| Low | Multipart count used only division of units by capacity. | 153 GSM extension symbols (306 units) or 67 emoji (134 UTF-16 units) displayed two segments when preserving character boundaries needs three. | Pack complete GSM escape/surrogate pairs within 153/67-unit segment capacities. |

Four new regressions failed against the original implementation in `/tmp/elcomputer-sms-audit-before.log`. All pass after fixes. No unresolved code defect was identified that blocks a dormant release. The external hash ambiguity was an activation blocker at audit time; it is resolved by the provider-confirmed correction above.

The address policy was checked against the primary [IANA IPv6 registry](https://www.iana.org/assignments/iana-ipv6-special-registry) and [IANA IPv4 registry](https://www.iana.org/assignments/iana-ipv4-special-registry). It conservatively excludes IPv6 protocol-assignment and transition ranges rather than assuming they are ordinary merchant HTTPS destinations. It does not require an online registry lookup during dispatch.

## 3. Fixes made

- `server/utils/sms/service.js` now calls service-only `sms_check_dispatch` after DNS. The SQL function locks the provider then job and checks lease token/status/age, dispatch marker, revision, enabled state and expiry. Recovered leases leave their uncertain state intact. Known cancellation before POST becomes failed without retry.
- `server/utils/sms/vodafone.js` rejects unspecified/unknown traffic, multi-recipient Notification and inconsistent endpoints before transport. Campaign must end in `/sms/submit`; Notification is that path plus `/Notification`. A Dashboard-managed gateway prefix remains supported.
- `server/utils/sms/settings.js` applies that relationship and readiness check; path changes disable and clear external confirmations. The same invariant is constrained in the unapplied migration.
- `server/utils/sms/transport.js` uses Node's numeric `BlockList` subnet checks, including expanded IPv6 and documentation/transition ranges; existing DNS pinning and TLS verification remain.
- `app/utils/sms.js` packs complete characters for multipart estimates. Both server snapshots and Dashboard previews use the same corrected calculation.
- Regression tests cover these defects and additional transport/dispatch gaps. Queue and H3 mock transports now execute the real final authorization callback. The browser script checks the corrected segment previews in both languages.

Only the original, still-unapplied SMS migration was adjusted. No second SMS system, business consumer, OTP, NPS, provider compatibility fallback or UI redesign was added.

## 4. SecureHash implementation review

The provider-confirmed production behavior is **HMAC-SHA256 with the literal uppercase hexadecimal Secure Hash Secret string as key bytes** (`createHmac('sha256', secret)`), UTF-8 input and uppercase hexadecimal output. Key validation rejects non-uppercase-HEX values without transforming them. Fields are concatenated as literal ordered name/value pairs: AccountId, Password, each SMS's SenderName/ReceiverMSISDN/SMSText in recipient order, then ExternalTrxId when present. The SMSList wrapper and SecureHash field are excluded. Omitted ExternalTrxId differs from present-empty. No URL encoding or XML escaping occurs before hashing. XML escaping occurs afterward and preserves carriage returns with character references.

The implementation follows Vodafone clarification **INC000081856720** and now matches both printed PDF hashes. The former decoded-key behavior is removed. A negative test computes a decoded-key digest only to prove it differs; that interpretation is not an operational mode or fallback.

## 5. Exact PDF contradiction and provider resolution

V5 section 5, step 3, requires the **hex decoded value** of the activation secret. The fictional example secret `0BAF4EACBFB84A1A87574DFEFC41525F` is 16 bytes after HEX decoding but 32 bytes as textual UTF-8/ASCII. Holding the complete ordered request string, including `ExternalTrxId=2025-01-18 15:44:00`, constant produces:

| Example | Printed PDF digest and current provider-confirmed literal-key result | Discarded HEX-decoded comparison (historical only) |
| --- | --- | --- |
| One SMS | `70A7BE2DBCAF15C1544E4CD9EC520FC91426C06C1EF0B87D68EFF8BB0A56268D` | `6F37744E74B3C2381CB53FE8557140570E7AC4B8A81EE25A7C4EA5D584043518` |
| Three ordered SMS | `60A7042DE62B10D268C516A575301959011EBEF8C6DB4AC67AFB314BE86C7BCD` | `7674D561C77824EC3B0B3381A2E229899ED52028C17C5C343801F3C054B1AD53` |

The audit independently recomputed both interpretations with Python `hmac`/`hashlib` against the original PDF. Vodafone subsequently confirmed the textual/literal interpretation in INC000081856720. Both printed hashes are now assertions against the actual `vodafoneHash` implementation. These are public fictional fixtures, never saved merchant settings. Literal-key fixtures also cover ExternalTrxId omitted (`2B26B16FB32F2F2EC78BB95525B9A122C5DD45DB73F21DFACC010159C5E2D736`) and present-empty (`B4333E0ADC6F8FDDC0C2AC74086A59FAC23E8E4F6B683E96C84A3B99F815C8FB`).

## 6. Dormant deployment versus activation

The former contradiction did not block dormant foundation deployment and is now resolved by INC000081856720. Defaults remain disabled, merchant values empty, confirmations false, and no scheduler or valid worker secret is installed by the migration. Saving credentials does not enable sending. Runtime worker authentication is separately required.

Key interpretation no longer blocks activation: Vodafone confirmed literal uppercase hexadecimal keys and the local correction implements that behavior. This does not activate the provider or authorize a live test. Existing Dashboard protocol/trusted-IP/account confirmations, infrastructure readiness, provisioning and separate activation authorization remain required. This correction does not set any confirmation flag or enablement state. There is no retry using both key interpretations.

## 7. Dashboard configuration and encryption

All merchant settings remain Dashboard/database-managed: Account ID, password, hash secret, approved/default senders, host/port, both paths, enablement, outbound IP/activation information, timeouts, preflight retry, batch/pacing and phone options. No merchant `.env` variable was introduced. Only existing master encryption and new worker authentication infrastructure secrets are server environment configuration.

Credentials use existing authenticated AES-256-GCM envelopes with random IVs and the private master key. Browser responses whitelist operational fields and expose credential presence flags; neither plaintext nor ciphertext returns after save. Blank secret inputs preserve saved values. Replacement buffers clear after successful save and are not SSR data, cookies or persistent storage. Config revisions reject stale settings saves. Audits record changed-field names/booleans, never credential values. Unexpected errors are sanitized, and staff responses are private/no-store.

Local API encryption/history tests and built-server SSR/error/public-artifact scans verify fictional secrets are absent. No real merchant credential existed in this task; authenticated production secret handling is not claimed as exercised.

## 8. Notification and Campaign separation

Future callers must explicitly use `sendNotification` or `sendCampaign`. Notification requires exactly one normalized recipient in service, enqueue SQL and provider dispatch. Campaign has its own permission, explicit recipient confirmation and persistent staff quota. Templates must match selected traffic. Both manual H3 paths reach the same central queue and separately selected XML endpoints in mocked acceptance.

Endpoint pairing can no longer be swapped or independently repointed. Unknown traffic is rejected rather than falling through to Campaign. No Notification fallback exists for bulk jobs.

## 9. XML and transport security

The serializer preserves exact namespace/field/object order and escapes all values, including CR; invalid XML 1.0 characters and unpaired surrogates are rejected. Strict SAX parsing validates root/child namespaces, allowed fields/results/statuses, duplicate scalar fields, exact ordered SMS counts and numeric error codes. DTD/ENTITY declarations are rejected, and no external resolver exists. Provider text is not returned or logged.

Responses are limited to 262,144 bytes and headers to 16,384 bytes. Configured DNS and HTTP timeouts are each bounded at 1–30 seconds. DNS checks all results and pins a checked address while preserving hostname certificate validation. HTTPS uses minimum TLS 1.2, no redirect following and no credential-bearing URL. A timeout/disconnect, non-200 response or unparseable response after possible dispatch becomes uncertain. Only known DNS/destination preflight failures retry. Tests use stubbed DNS/HTTPS; no socket or Vodafone call is needed.

## 10. Queue, idempotency and uncertain outcomes

Private batches/messages/attempts use transaction-bound enqueue, an advisory lock plus unique logical key/content fingerprint, unique stable random ExternalTrxId, ordered messages, lease tokens, dispatch markers, expiry/priority and pacing. Duplicate content with the same key reuses the batch; different content fails. Each lease begins dispatch once. Concurrent claims serialize on the singleton provider row; a processing job blocks another provider claim. A resumed stale worker now fails final lease authorization before POST.

Only proven preflight failures requeue, within retry/expiry limits and retaining the same ExternalTrxId. Ambiguous POSTs become terminal uncertain; process crashes or failed database finishes recover to uncertain. There is no automatic retry of submitted, partial or uncertain batches, no retry of accepted recipients, and no reliance on Vodafone deduplication. States preserve queued/processing/submitted/partial/failed/uncertain; submitted means provider acceptance, never delivered. Staff must reconcile uncertain outcomes externally before separately authorizing a new logical send.

SQL transitions and simulated interruption/recovery are verified in isolated PGlite using the actual application migration. Native PostgreSQL independent-session races remain unexercised because no disposable native server/driver is installed here; this is not claimed as concurrency acceptance. An already authorized/in-flight request cannot be recalled by disabling the provider.

## 11. RBAC, RLS, manual portal and templates

Every staff API authenticates a Bearer token through existing `requireAdminRequest`, verifies active staff and server-side permissions. SMS parent, settings view/manage, templates view/manage, history view, Notification send and Campaign send are separate, default-deny rights. UI hiding is supplemental. Cross-site cookie-only requests lack the required Authorization header; authentication does not accept cookies as an SMS API credential. Existing ownership semantics are retained.

All five tables have RLS and no PUBLIC/anon/authenticated table grants or browser policies. All five queue RPCs revoke those roles and grant only service_role. Anonymous and authenticated roles cannot enumerate settings/history or forge jobs. The service key stays in private runtime configuration. History masks recipients and excludes message bodies. Templates validate bounded text, known placeholders, translations, enabled state, sender and traffic; substitution treats values literally.

The additive migration creates SMS schema/constraints/indexes and expands default-deny permission definitions and the existing full-reset allowlist. It does not rewrite historical commerce, staff grants or phone data. Full reset is an existing separately authorized destructive operation, refused while a worker processes; partial reset preserves SMS. Applying the migration performs no reset.

## 12. Tests added or changed

- Protocol: swapped/unknown/bulk traffic, numeric IPv6/special-purpose checks and multipart character-boundary regressions.
- Settings: swapped/independent paths rejected; valid prefix changes disable and clear activation.
- Queue: recovered worker cannot POST, begin-dispatch cannot repeat, final guard cancels on disable/revision/expiry/staleness, new RPC browser-role denial, direct table job/template/settings forgery denied, SQL rejects swapped endpoints; mock acceptance executes final authorization.
- H3 API: mocked Notification/Campaign transport executes the real final guard.
- New `sms-transport.test.mjs`: mixed DNS blocked, sanitized preflight errors, callback ordering/cancellation, address pinning/TLS/headers/UTF-8 body, response size, abort/disconnect/timeout uncertainty, no redirect following. DNS/HTTPS are stubbed; no sockets exist.
- Browser: actual EN/AR segment preview checks for 153 extension characters and 67 emoji.

## 13. Original audit validation (before provider correction)

- Node **24.16.0**.
- `node --test tests/*.test.mjs`: **373 passed, zero failed, one existing optional native Paymob test skipped** (374 total).
- `node --test tests/sms-*.test.mjs`: **50 passed, zero failed or skipped**.
- `npm run typecheck`: **passed**.
- `npm run build`: **passed**.
- `git diff --check`: **passed**.
- Browser: **330 assertions, 48 screenshots, zero console/runtime errors or external requests**. Actual SMS Vue page/shared preferences under isolated API/auth fixtures; EN/AR, desktop/mobile, Light/Dark/System, permissions, secret replacement, templates, both manual traffic paths, normalized previews and corrected multipart counts, masked history.
- Built localhost HTTP/SSR/artifacts: **801 assertions, 14 requests, 115 public files scanned against six fictional private value types, zero exposures**. Anonymous staff/worker denial and all EN/AR SMS tab login guards. The temporary server was stopped afterward.
- Independent original-PDF Python HMAC verification and Node crypto fixture tests: **passed**, proving the contradiction without a provider call.
- Reviewed unapplied migration SHA-256: `0a88239aa00db65a17672736f933dc01fc3e4d51d08fd2175bc5dc99ed2ca5ad`.

Build/typecheck used `env -u DEBUG` to suppress inherited hook timing output. Existing duplicate ERP import, sourcemap and chunk-size warnings remain. No unrelated change was made.

Limits: no authenticated production/staging session, native PostgreSQL independent-session SMS race test, real worker scheduling/infrastructure acceptance, live Vodafone/TLS acceptance, real submission, handset delivery or merchant billing was exercised. PGlite verifies actual SQL transitions/RLS but does not establish native multi-session acceptance. Evidence is local and ephemeral under `/tmp/elcomputer-sms-audit-*.log` and `/tmp/elcomputer-sms-review/`.

## 14. Provider clarification received; remaining external acceptance

The actual production HMAC interpretation is confirmed by **INC000081856720**, as supplied by the user. Both published deterministic examples match it. Remaining external acceptance concerns provisioned Account ID/password/secret, approved senders, actual Notification/Campaign host/port/paths, supported modern TLS, registered outbound IP/account/interface activation, quotas/rates/international eligibility and the meaning/limits of ExternalTrxId. Do not assume handset delivery receipts or a status inquiry endpoint from this PDF. No Vodafone contact or real test is authorized in this correction.

```text
SMS FOUNDATION AUDITED: YES
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
