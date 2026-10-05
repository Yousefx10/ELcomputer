# Central SMS service

This foundation is local only. Vodafone defaults disabled. No business event, authentication, email, PDC, survey, return, warranty or pickup flow calls it.

## Reused architecture

See `sms-audit.md`. SMS reuses credential AES-256-GCM envelopes, the server service-role client, staff permissions/authentication, Dashboard shell/locales/preferences, bounded request reading, admin activity history and the private SQL job/internal worker pattern. Existing chat/support/order message tables continue serving in-app conversations. There is one outbound SMS implementation.

## Dashboard configuration

`/dashboard/sms` has Provider settings, Templates, Send SMS and SMS history tabs. Settings store enabled state, explicit production mode, HTTPS server, optional port, Notification/Campaign paths, encrypted Account ID/password/HEX secret, approved/default senders, outbound-IP information, external activation/trusted-IP/hash confirmations, notes, timeout, safe preflight retry limit, campaign batch bound, request pacing and phone behavior.

No merchant values come from `.env` or source defaults. Server hostname and credentials start empty. The paths alone default to the published protocol paths. Vodafone does not document a sandbox here, so no sandbox is invented. Test adapters are injected in isolated tests and are never a Dashboard delivery mode.

The API returns only credential presence flags. Even staff with settings management cannot retrieve plaintext or ciphertext. Secret inputs are temporary replacement buffers; they clear after successful save and are never SSR state, cookies or persistent browser storage. Blank input keeps the saved value. The existing encryption helper trims secrets, so surrounding whitespace is rejected rather than silently changing the merchant password. Encryption infrastructure must be ready before storing replacements. Config revisions prevent stale saves. Account, credentials, destination or outbound-IP changes disable sending and clear the relevant external confirmations; saving does not activate the provider.

The only new environment value is `NUXT_SMS_WORKER_SECRET`, an infrastructure authentication secret of at least 32 characters. Reuse the existing server-only `NUXT_CREDENTIALS_ENCRYPTION_KEY` master key. Neither goes in public runtime configuration. No master key or worker secret was configured in production by this task.

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

Template sends accept `templateCode`, `locale` (`en` or `ar`) and string `variables`. The service reads the enabled matching traffic template, requires that translation, validates known supplied variables and snapshots the resulting text/sender into the queue. It does not evaluate JavaScript or access customer data implicitly. Templates have codes, purpose, both languages, traffic, approved/default sender, enabled state, derived placeholders and creator/updater timestamps. No speculative templates are seeded.

## Vodafone protocol and hashing

Read all pages of the supplied January 2026 V5 PDF. Requests use HTTPS POST XML, the `http://www.edafa.com/web2sms/sms/model/` namespace, ordered AccountId/Password/SecureHash, repeated SMSList objects with SenderName/ReceiverMSISDN/SMSText, and optional ExternalTrxId last. Notification uses `/web2sms/sms/submit/Notification`; Campaign uses `/web2sms/sms/submit` by default. SMSList ordering is preserved end to end.

HMAC-SHA256 uses HEX-decoded secret bytes and UTF-8 name/value pairs in interface order. Field separators are literal `=` and `&`; no URL encoding and no wrapper/secure-hash inclusion. The uppercase hexadecimal digest is calculated only server-side before XML escaping. Credentials, hash source strings and generated hashes are never persisted in attempts/audits or sent to browsers.

**Activation blocker:** both PDF printed hashes match textual secret bytes, conflicting with its required HEX-decoding instruction. `sms-protocol.test.mjs` verifies the explicitly required HEX implementation and independently reproduces both contradictory printed outputs as evidence. It cannot honestly claim an exact match to the printed examples. Vodafone must confirm the correct algorithm/example correction. Dashboard confirmation defaults false and is required for enablement. See `sms-audit.md` and `sms-report.md`.

XML serialization escapes all values, preserves carriage returns using character references, and rejects invalid XML 1.0 code points/unpaired surrogates. Strict SAX parsing checks namespace/schema fields, result and SMS statuses, exact message count, numeric description codes, duplicate fields and bounded response bytes. DTD/entities are rejected; no external-entity resolver exists. The PDF's error examples contain namespace typos; the parser requires the correct documented namespace, treating nonconforming responses as uncertain.

Transport resolves and checks every destination IP, pins the checked address while keeping hostname TLS validation, rejects private/local addresses, uses modern TLS (minimum 1.2), permits no redirects and limits response headers/body/time. Settings contain a public HTTPS origin and separate port/paths. Sending checks enablement/config revision again after DNS immediately before dispatch. A request already authorized and in flight cannot be recalled by disabling the provider; disablement blocks subsequent dispatches.

## Phones and segment estimates

New SMS recipients use canonical `+` plus international digits. At send time Egypt mode accepts `0020`, `+20`, `20`, leading zero and bare 10/11/12/15 national formats from appendix A. International numbers require explicit `+`/`00` and the configured international option. Egypt-number validation still requires a valid mobile prefix/length. Explicit-prefix mode declines ambiguous national numbers. Vodafone XML receives digits without `+`. Historical profiles/orders/CRM phones are never rewritten.

Shared browser/server estimates use GSM 03.38 basic and extension character sets: 160 single/153 multipart GSM units, extension symbols two units; otherwise UTF-16 with 70 single/67 multipart code units. Emoji count as surrogate pairs. Displayed character count counts Unicode code points, distinct from encoding units. Estimates do not establish billing or handle provider-specific segment packing beyond the documented limits.

## Queue, history and recovery

The additive migration creates private provider settings, templates, batches, messages and attempts. Every logical batch receives a random `ELC-UUID` ExternalTrxId, independent of timestamps. Unique content-bound idempotency keys avoid duplicate records when a caller repeats the same request; changed content with the same key returns 409. Each batch retains recipient order, template/actor/source, priority/expiry and message snapshots.

SQL enqueue transactions verify enabled state, sender/batch bounds and durable manual quotas (10 batches per staff member per minute; one Campaign per minute). Configuration caps batches at 200, defaults 50, below Vodafone's published 1,000 maximum. Duplicate normalized recipients fail rather than silently charging twice. Manual Campaign requires its own permission and explicit recipient-count confirmation; Notification never accepts multiple recipients.

`POST /api/internal/sms/process` uses the existing internal-worker pattern and `x-sms-worker-secret`. Configure a scheduler separately after authorized deployment; no scheduler/VPS/Nginx/firewall changes occur here. The bounded worker processes up to three claims, one provider POST at a time, with a SQL lease and configurable 500–60,000ms spacing. A new installation has no worker secret and cannot run this endpoint.

States are queued, processing, submitted, partial, failed or uncertain. Per-recipient statuses preserve Vodafone's ordered SUBMITTED/FAILED_TO_SUBMITTED/SUSPENDED/INVALID values. Submitted means accepted into the provider queue, never handset delivered. Attempts store only sanitized result/code/category/time and the same ExternalTrxId.

Only destination/DNS preflight failures proven to precede POST can retry automatically, at most three configured retries with a 30-second delay and expiry checks. Provider rejections and failed rate submissions are terminal. Network/timeouts/disconnects/HTTP errors/malformed responses after dispatch become uncertain; stale leases after two minutes also become uncertain. A failed database finish leaves processing for conservative stale recovery, never automatic re-POST. Mixed results retain successful recipients and never retry the whole batch.

The supplied API does not establish a supported inquiry endpoint or ExternalTrxId deduplication guarantee. Staff must reconcile uncertain records externally through Vodafone reporting before separately authorizing any new logical send. There is deliberately no blind Retry button or fictional reconciliation API.

History uses 25-batch pages, masked phones, actor/source/template references, sender, created/submitted time, attempts, transaction ID, ordered SMS statuses and numeric codes. It excludes message bodies and credential material. The body snapshot remains private for queue execution; define retention/redaction before security-sensitive OTP integration. Existing admin audits retain their existing per-user limit; durable SMS ledgers are separate.

The owner-only existing full reset explicitly includes the five SMS tables and refuses to run while a worker is processing. Partial resets preserve SMS. A completed full reset leaves absent configuration equivalent to disabled defaults; a later Dashboard save can recreate the disabled provider singleton. Applying the migration performs no reset.

## Permissions and deployment acceptance

`sms.view` is the parent; separate rights are `sms.settings.view/manage`, `sms.templates.view/manage`, `sms.history.view`, `sms.notification.send` and `sms.campaign.send`. Existing staff gain none automatically; owners retain existing full access. Supabase browser roles have no table or RPC grants; all tables also have RLS. Staff API operations verify permissions server-side and return private/no-store responses.

The provider error mapping covers all 34 documented V5 codes, including 9013 source IP, 9014 password, 9021 SecureHash, 9023 MSISDN and 9034 sender. Codes mentioning reports do not imply implemented report endpoints. No raw provider bodies or errors are logged.

Before production: review the protocol discrepancy and code/schema, authorize a dormant migration/release, configure infrastructure secrets/worker scheduling, complete authenticated staging staff acceptance, and obtain Vodafone credentials, correct endpoint/port/certificate, approved senders, trusted-IP activation, account quotas/rates, international eligibility and hash clarification. Confirm no legacy TLS downgrade is required. Then Dashboard-save while disabled, validate locally, record external confirmations, explicitly enable, and separately authorize a small real Notification test followed by a bounded Campaign test. Observe provider submissions and reporting before attaching a separately scoped business consumer.

## Local validation commands

Run the Node suite, focused `tests/sms-*.test.mjs`, typecheck, build and diff check. `scripts/sms-browser.mjs` uses local Chrome and Playwright; set `SMS_REVIEW_PLAYWRIGHT` to an installed Playwright `index.mjs` if the package is outside this checkout. Set `SMS_REVIEW_CHROME` if Chrome uses another path. It compiles the actual Vue page/preferences with isolated API fixtures and refuses external browser requests. `scripts/sms-http.mjs` accepts only an already running localhost built server (`SMS_REVIEW_LOCAL_URL`, default port 3187); it performs anonymous read-only guards and public artifact scans. All merchant/provider tests remain mocked; neither script can authorize a real Vodafone send.
