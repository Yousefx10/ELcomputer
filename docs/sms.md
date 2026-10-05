# Central SMS service

The central foundation and its infrastructure have a committed dormant production readiness record. Order notifications are now implemented locally and await their own migration/deployment. Vodafone remains disabled; no PDC, OTP, survey, return, warranty, pickup or marketing consumer is connected. Read [order SMS behavior and release boundaries](order-sms.md).

## Reused architecture

See `sms-audit.md`. SMS reuses credential AES-256-GCM envelopes, the server service-role client, staff permissions/authentication, Dashboard shell/locales/preferences, bounded request reading, admin activity history and the private SQL job/internal worker pattern. Existing chat/support/order message tables continue serving in-app conversations. There is one outbound SMS implementation.

## Dashboard configuration

`/dashboard/sms` has Provider settings, Templates, Send SMS and SMS history tabs. Settings store enabled state, explicit production mode, HTTPS server, optional port, Notification/Campaign paths, encrypted Account ID/password/HEX secret, approved/default senders, outbound-IP information, external activation/trusted-IP/hash confirmations, notes, timeout, safe preflight retry limit, campaign batch bound, request pacing and phone behavior.

Local order notification controls extend Provider settings with four default-off events and EN/AR central-template bindings. The existing History tab includes masked order intents, terminal skipped reasons and linked batch diagnostics. Templates remain in `sms_templates`; no order API/component hardcodes final customer SMS copy. Settings/template/history permissions remain separate.

No merchant values come from `.env` or source defaults. Server hostname and credentials start empty. The paths alone default to the published protocol paths. Dashboard paths must preserve the documented relationship: Campaign ends in `/sms/submit`, and Notification is that path plus `/Notification`. A different gateway prefix remains configurable; swapping traffic endpoints is rejected by settings, SQL and the provider adapter. Vodafone does not document a sandbox here, so no sandbox is invented. Test adapters are injected in isolated tests and are never a Dashboard delivery mode.

The API returns only credential presence flags. Even staff with settings management cannot retrieve plaintext or ciphertext. Secret inputs are temporary replacement buffers; they clear after successful save and are never SSR state, cookies or persistent browser storage. Blank input keeps the saved value. The existing encryption helper trims secrets, so surrounding whitespace is rejected rather than silently changing the merchant password. Encryption infrastructure must be ready before storing replacements. Config revisions prevent stale saves. Account, credentials, destination or outbound-IP changes disable sending and clear the relevant external confirmations; saving does not activate the provider.

The foundation's infrastructure authentication value is `NUXT_SMS_WORKER_SECRET`, at least 32 characters. Reuse the existing server-only `NUXT_CREDENTIALS_ENCRYPTION_KEY` master key. Neither goes in public runtime configuration. The separate completed production-readiness task configured them through PM2; the local order feature changes no environment secret.

## Server API for later features

```js
import { createSmsService } from './sms/service.js'

const sms = createSmsService(supabaseAdmin)
await sms.sendNotification({
  recipients: [customerPhone], // exactly one
  text: renderedText,
  idempotencyKey: `feature:${logicalEventId}`,
  triggerSource: 'future_feature',
  priority: 10,
  expiresAt: expiryIso // optional; priority 0–100
})
// Bulk/similar recipient traffic explicitly calls sms.sendCampaign(...).
```

Calls return the persisted batch ID, queue state, provider ExternalTrxId and whether the same logical request was reused. They never wait on Vodafone. Disabled/unready settings return a controlled 503. Callers must authorize the business action before using this server-only service. Future OTP must separately add abuse/rate/resend/verification rules and short expiry; no OTP state exists here.

Template sends accept `templateCode`, `locale` (`en` or `ar`) and string `variables`. The service reads the enabled matching traffic template, requires that translation, validates known supplied variables and snapshots the resulting text/sender into the queue. It does not evaluate JavaScript or access customer data implicitly. Templates have codes, purpose, both languages, traffic, approved/default sender, enabled state, derived placeholders and creator/updater timestamps. The local order migration seeds only its four disabled transactional templates, without replacing existing matching codes.

## Vodafone protocol and hashing

Read all pages of the supplied January 2026 V5 PDF. Requests use HTTPS POST XML, the `http://www.edafa.com/web2sms/sms/model/` namespace, ordered AccountId/Password/SecureHash, repeated SMSList objects with SenderName/ReceiverMSISDN/SMSText, and optional ExternalTrxId last. Notification uses `/web2sms/sms/submit/Notification`; Campaign uses `/web2sms/sms/submit` by default. SMSList ordering is preserved end to end.

Vodafone support clarification **INC000081856720**, supplied by the user on 2026-10-05, confirms HMAC-SHA256 with the **literal uppercase hexadecimal Secure Hash Secret string as key bytes**. The secret is passed directly to HMAC as a UTF-8 string (hexadecimal characters are ASCII); it is never HEX-decoded. Input uses UTF-8 name/value pairs in interface order. Field separators are literal `=` and `&`; no URL encoding and no wrapper/secure-hash inclusion. The uppercase hexadecimal digest is calculated only server-side before XML escaping. Credentials, hash source strings and generated hashes are never persisted in attempts/audits or sent to browsers.

The provider clarification supersedes the PDF sentence requiring HEX decoding and resolves the earlier hash activation blocker. Both printed PDF examples now match the active literal-key implementation as deterministic regression fixtures. There is no decoded-key behavior, compatibility mode or automatic fallback. Dashboard validation accepts only nonempty uppercase `0-9A-F` strings bounded to 512 characters; it rejects lowercase, whitespace, prefixes and non-string replacements without trimming or uppercasing them. There is no decoded-byte minimum or even-length restriction; Vodafone's `A1B2C3D4E5F6` example is valid. Blank input still preserves the encrypted secret, and read-back still returns only presence flags. Existing activation/trusted-IP/protocol confirmations remain explicit and default false. This correction does not enable the provider or authorize deployment or a real test. See `sms-security-review.md` and `sms-report.md`.

XML serialization escapes all values, preserves carriage returns using character references, and rejects invalid XML 1.0 code points/unpaired surrogates. Strict SAX parsing checks namespace/schema fields, result and SMS statuses, exact message count, numeric description codes, duplicate fields and bounded response bytes. DTD/entities are rejected; no external-entity resolver exists. The PDF's error examples contain namespace typos; the parser requires the correct documented namespace, treating nonconforming responses as uncertain.

Transport resolves and checks every destination IP, pins the checked address while keeping hostname TLS validation, rejects private/local and conservative IANA special-purpose/transition ranges using numeric CIDR comparisons, uses modern TLS (minimum 1.2), permits no redirects and limits response headers/body/time. Settings contain a public HTTPS origin and separate port/paths. Sending atomically checks the current lease, dispatch marker, lease age, enablement, config revision and expiry again after DNS immediately before dispatch. A recovered worker cannot resume a cancelled lease and POST. A request already authorized and in flight cannot be recalled by disabling the provider; disablement blocks subsequent dispatches.

## Phones and segment estimates

New SMS recipients use canonical `+` plus international digits. At send time Egypt mode accepts `0020`, `+20`, `20`, leading zero and bare 10/11/12/15 national formats from appendix A. International numbers require explicit `+`/`00` and the configured international option. Egypt-number validation still requires a valid mobile prefix/length. Explicit-prefix mode declines ambiguous national numbers. Vodafone XML receives digits without `+`. Historical profiles/orders/CRM phones are never rewritten.

Shared browser/server estimates use GSM 03.38 basic and extension character sets: 160 single/153 multipart GSM units, extension symbols two units; otherwise UTF-16 with 70 single/67 multipart code units. Multipart packing keeps GSM escape sequences and Unicode surrogate pairs together. For example, 153 carets or 67 emoji each need three estimated multipart segments. Displayed character count counts Unicode code points, distinct from encoding units. Estimates do not establish Vodafone's actual billing or provider-specific transliteration/packing behavior.

## Queue, history and recovery

The additive migration creates private provider settings, templates, batches, messages and attempts. Every logical batch receives a random `ELC-UUID` ExternalTrxId, independent of timestamps. Unique content-bound idempotency keys avoid duplicate records when a caller repeats the same request; changed content with the same key returns 409. Each batch retains recipient order, template/actor/source, priority/expiry and message snapshots.

SQL enqueue transactions verify enabled state, sender/batch bounds and durable manual quotas (10 batches per staff member per minute; one Campaign per minute). Configuration caps batches at 200, defaults 50, below Vodafone's published 1,000 maximum. Duplicate normalized recipients fail rather than silently charging twice. Manual Campaign requires its own permission and explicit recipient-count confirmation; Notification never accepts multiple recipients.

`POST /api/internal/sms/process` uses the existing internal-worker pattern and `x-sms-worker-secret`. Configure a scheduler separately after authorized deployment; no scheduler/VPS/Nginx/firewall changes occur here. The bounded worker processes up to three claims, one provider POST at a time, with a SQL lease and configurable 500–60,000ms spacing. A new installation has no worker secret and cannot run this endpoint.

States are queued, processing, submitted, partial, failed or uncertain. Per-recipient statuses preserve Vodafone's ordered SUBMITTED/FAILED_TO_SUBMITTED/SUSPENDED/INVALID values. Submitted means accepted into the provider queue, never handset delivered. Attempts store only sanitized result/code/category/time and the same ExternalTrxId.

Only destination/DNS preflight failures proven to precede POST can retry automatically, at most three configured retries with a 30-second delay and expiry checks. Provider rejections and failed rate submissions are terminal. Network/timeouts/disconnects/HTTP errors/malformed responses after dispatch become uncertain; stale leases after two minutes also become uncertain. A failed database finish leaves processing for conservative stale recovery, never automatic re-POST. Mixed results retain successful recipients and never retry the whole batch.

The supplied API does not establish a supported inquiry endpoint or ExternalTrxId deduplication guarantee. Staff must reconcile uncertain records externally through Vodafone reporting before separately authorizing any new logical send. There is deliberately no blind Retry button or fictional reconciliation API.

History uses 25-batch pages, masked phones, actor/source/template references, sender, created/submitted time, attempts, transaction ID, ordered SMS statuses and numeric codes. It excludes message bodies and credential material. The body snapshot remains private for queue execution; define retention/redaction before security-sensitive OTP integration. Existing admin audits retain their existing per-user limit; durable SMS ledgers are separate.

The owner-only existing full reset includes the five foundation tables and, after the local order migration, the two private order SMS tables. It refuses to run while a provider worker is processing. Partial resets preserve SMS history; deleted orders cannot send retained intents. A completed full reset leaves absent provider/event configuration equivalent to disabled defaults; a later Dashboard save can recreate it. Applying either migration performs no reset.

## Permissions and deployment acceptance

`sms.view` is the parent; separate rights are `sms.settings.view/manage`, `sms.templates.view/manage`, `sms.history.view`, `sms.notification.send` and `sms.campaign.send`. Existing staff gain none automatically; owners retain existing full access. Supabase browser roles have no table or RPC grants; all tables also have RLS. Staff API operations verify permissions server-side and return private/no-store responses.

The provider error mapping covers all 34 documented V5 codes, including 9013 source IP, 9014 password, 9021 SecureHash, 9023 MSISDN and 9034 sender. Codes mentioning reports do not imply implemented report endpoints. No raw provider bodies or errors are logged.

The foundation/infrastructure readiness is already recorded separately. For the local order feature, review the new migration and matching code, then perform the dormant migration/guarded release later from the authorized deployment computer. Keep provider/events off and complete authenticated staff acceptance. Scheduling and Vodafone provisioning (credentials, endpoint/port/certificate, approved senders, trusted IP, quotas/rates and international eligibility) remain separately authorized work. SecureHash key interpretation is resolved by INC000081856720. Only later explicit authorization permits provider/event enablement or any real Notification/Campaign test. Future consumers require their own scope.

## Local validation commands

Run the Node suite, focused `tests/order-sms.test.mjs tests/sms-*.test.mjs`, typecheck, build and diff check. `scripts/sms-browser.mjs` uses local Chrome and Playwright; set `SMS_REVIEW_PLAYWRIGHT` to an installed Playwright `index.mjs` if the package is outside this checkout. Set `SMS_REVIEW_CHROME` if Chrome uses another path. It compiles the actual Vue page/preferences with isolated API fixtures and refuses external browser requests. `scripts/sms-http.mjs` accepts only an already running localhost built server (`SMS_REVIEW_LOCAL_URL`, default port 3187); it performs anonymous read-only guards and public artifact scans. All merchant/provider tests remain mocked; neither script can authorize a real Vodafone send.
