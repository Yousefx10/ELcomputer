# Independent security and production-readiness audit — 2026-10-09

Reviewed the actual clean `main` implementation at `6ecac1ed31ce7a0b9d9ca1a98c6127eb24da7ff2`, its complete Email code/migration, AGENTS, project/handoff records and relevant SMS, Claims, PDC/reverse, authentication and Live Chat architecture. Refreshed current official Brevo documentation independently. This audit fixes only Email defects; Claims Stage 3 and all business consumers remain absent. No production connection, migration, deployment, credential discovery, real provider request/email/SMS, DNS/Microsoft 365/OneSignal/Auth change or webhook registration occurred.

This is the current audit checkpoint. The implementation record below preserves its earlier validation counts and limitations as historical evidence.

## 1. Overall verdict

**Suitable for a separately reviewed dormant deployment and separately scoped Claims Stage 3 development.** No Critical/High issue was identified or remains in the reviewed code. Five Medium defects and two Low parser defects were fixed. This is not live activation approval or authenticated production/provider acceptance. Free-form manual content remains a documented Medium governance limitation: the application cannot establish that arbitrary staff-written text is essential rather than promotional.

## 2. Findings and severity

| Severity | Reproduced defect | Fix/evidence |
| --- | --- | --- |
| Medium | SQL `<>` guards treated missing revisions, template classification/version, fingerprints and lease tokens as unknown rather than refusing them | Null-safe `IS DISTINCT FROM`; original native PostgreSQL reproduction accepted a missing revision/template version/fingerprint and dispatched/finished without a lease; corrected negative tests pass |
| Medium | An authenticated callback could record events after webhook disablement or token rotation while its body/SQL operation waited | Bind ingress-authenticated settings revision to the atomic event transaction; current webhook enablement/token presence/revision required; actual partial HTTP requests and native lock-barrier revocation tests pass |
| Medium | Worker secret checked only at ingress, allowing revoked authorization to proceed after body/DNS waits | Recheck current secret before every claim and on both sides of final SQL authorization; known pre-POST revocation suppresses the intent; HTTP/body and mocked preflight tests pass |
| Medium | Final-dispatch throttle requeues could consume more than three attempts and exceed the three-row attempt view | Terminal failure at the third throttle attempt; claim also retires exhausted queued work; original native reproduction reached attempt four; corrected bounded-attempt tests pass |
| Medium | 429 handling ignored Brevo's documented reset header, and truncated waits above 300 seconds | Transport projects `x-sib-ratelimit-reset`; use the longer positive numeric reset/Retry-After value; SQL expires waits beyond authorization rather than retrying early; mocked 120/900-second cases pass |
| Low | Inherited object properties such as `constructor`/`toString` were treated as supported callback names | Own-property/string allowlist; unknown names are ignored after authentication |
| Low | A malformed object-valued provider error code could throw during property lookup instead of recording a known rejection | Only string codes enter the closed mapping; malformed code tests produce sanitized definite rejection |

Remaining Medium limitation: trusted staff can write promotional prose in custom transactional content or template values. A permission, essential-message declaration or classification tag cannot prove the meaning of that text. No unreliable keyword classifier or replacement campaign system was added. Restrict transactional permissions to trusted staff and approve future business templates/purpose/recipients before activation. Existing activity-log retention and email-body retention also need an explicit operational policy; this audit does not rewrite shared retention behavior.

## 3. Scope of fixes

Changed only the central Email adapter/event parser/worker/service, the still-unapplied 66th Email migration, relevant test fixtures/tests and these three audit documents. Added negative and native concurrency tests without repository dependencies. `email_command` retains the existing provider → recipient → message lock order and canonical service-only write boundary. Email snapshots, API contracts, Dashboard surfaces and adjacent systems retain their existing architecture.

## 4. Brevo API verification

Current official [send reference](https://developers.brevo.com/reference/send-transac-email), [send guide](https://developers.brevo.com/docs/send-a-transactional-email), [HTTP/error concepts](https://developers.brevo.com/docs/how-it-works), [rate limits](https://developers.brevo.com/docs/api-limits) and [reset headers](https://developers.brevo.com/docs/limit-headers) support `api-key`, fixed `/v3/smtp/email`, sender/name, one `to`, optional `replyTo`, one HTML/text body, custom correlation header and 201 `messageId`. A valid identity means acceptance, not delivery. No deduplication guarantee for this single-recipient endpoint is assumed. Rate limits and credit/account approval are separate.

Configured timeout is bounded to 1–30 seconds for DNS and separately for HTTP; the total call can include both waits. TLS certificate/hostname checks, checked public DNS pinning, request/response/header caps and no redirects remain. Only proven preflight failures and explicit 429 rejection retry, within the same intent/expiry/three-attempt cap. 5xx, invalid acceptance, network timeout/disconnect or interrupted results remain uncertain and cannot automatically resend. Numeric reset/Retry-After waits are honored; absent/invalid values fall back to 30 seconds. This is a conservative local policy, not a provider timeout, quota or delivery guarantee.

## 5. Webhook authentication and replay

Independently verified [secured webhooks](https://developers.brevo.com/docs/secured-webhooks), [creation fields](https://developers.brevo.com/reference/create-webhook) and [transactional payloads](https://developers.brevo.com/docs/transactional-webhooks). `auth:{type:'bearer',token:...}` is documented for callback authentication, separate from API-key authentication when creating the webhook. The handler checks the encrypted token in constant time and now binds that authentication to current SQL authorization. Off ingress returns 404, invalid token 401, and a recognized callback whose authorization changes in flight is refused 403 without persistence. Ordinary callers cannot execute the event RPC.

This uses a shared secret over TLS, **not a per-event HMAC/signature**. A compromised token can impersonate a provider; secure ingress/header redaction and later token rotation remain essential. Private event deduplication, exact recipient/normalized provider ID, dispatched nonce for early events, time bounds and ordered observations pass SQL/HTTP/native races. Duplicate/late observations cannot enqueue another email or weaken recipient safety. No registration or actual Brevo callback acceptance was performed; only non-batched transactional email payloads are supported.

## 6. Encryption and secret handling

Reused AES-256-GCM with random 12-byte nonce and authentication tag/server-only master key. Fresh ciphertext, tampering, malformed envelope and wrong-key tests pass. Dashboard returns presence/readiness flags only, blank replacement preserves the secret, and replacement requires fresh activation. No merchant secrets in public runtime configuration. Private no-store API projections exclude ciphertext, bodies, correlation/unsubscribe material and raw provider errors. Fresh public build/SSR/browser canary scans found no exposure. Real credential validity/master-key configuration was not inspected.

## 7. RBAC/RLS

All six private tables retain RLS and no anon/authenticated read/write grants or policies. Email helpers/command deny those roles execution; service-role sessions use SELECT plus canonical RPC rather than direct mutations. Active staff permissions separately govern settings, templates, transactional sending, private history and marketing preferences. Settings/template management also requires corresponding view permission. Database staff/consent/configuration rechecks and atomic audit rollback pass. Native races actually run with service-role worker sessions. Real authenticated Supabase sessions remain untested.

## 8. Transactional/Marketing separation

Separate service entry points, immutable template/intent classification, configured marketing sender and final SQL checks are verified. Ordinary Dashboard attempts to change a saved marketing template into transactional or use it through manual preview are refused. Marketing has no browser send endpoint; marketing-manage is consent administration, not a bulk-send permission. One mailbox per intent, preview-bound confirmation, ten manual sends per staff/minute and global one-second dispatch pacing constrain sending. These are structural/authorization guarantees, **not semantic proof that free-form prose is non-promotional**; the limitation in section 2 applies.

## 9. Consent/unsubscribe safety

Marketing requires recorded opt-in evidence and enabled marketing settings at enqueue and final dispatch. Unknown/unsubscribed recipients are suppressed; recipient-link opt-out suppresses marketing alone, including a waiting processing intent at dispatch. Random 256-bit hashed, recipient-bound, expiring capabilities and explicit POST prevent arbitrary mailbox mutation. Genuine transactional mail remains available after marketing opt-out. Verified [Brevo blocklist behavior](https://help.brevo.com/hc/en-us/articles/209458705-FAQs-What-are-the-different-types-of-blocklisted-contacts) distinguishes promotional opt-out from sender-scoped transactional unsubscribe. Hard bounce/invalid/spam impose conservative local global safety restrictions; softer/provider-blocked observations never invent a resend. No provider unblock/contact synchronization is performed.

## 10. Queue/idempotency/concurrency

**Independent native PostgreSQL verification actually ran on 17.11**, compiled from checksum-verified official release source entirely under a temporary directory. Tests create/destroy fresh loopback-only clusters and accept executable/driver paths, never a database URL/existing cluster. Three independent service-role sessions are demonstrably blocked at provider-row lock barriers before release. Tests verify one concurrent enqueue/lease/attempt/dispatch authorization/event, changed-content conflicts, callback authorization revocation, disabled/staff-revoked/marketing-unsubscribed dispatch refusal and crashed lease recovery with no reclaim/late finish. Ten native Email subtests plus their parent pass; the existing native Paymob concurrency suite also passes. This is local PostgreSQL evidence, not hosted Supabase/provider evidence.

Focused mocked tests additionally cover preflight rejection, 429 caps, acceptance/rejection, ambiguous response, timeout, post-submission transport interruption, duplicate/out-of-order/late/early callbacks and missing/wrong leases. Missing completion/crashed workers become uncertain; no automatic uncertain retry or new retry identity exists. A POST already authorized/in flight cannot be recalled by a later settings/consent change.

## 11. Provider disabled/no backlog

Disabled/unready enqueue returns unavailable without creating an intent. Configuration edits retire queued work, dispatch rechecks current revision/readiness, authorization expires after ten minutes, and re-enable never resurrects suppressed intents. Native disable-before-dispatch and local SQL/HTTP/browser tests pass. No historical email/backfill producer was introduced.

## 12. Migration assessment

Exactly **66 local migration files**. Modified only unapplied `20261008180000_email_foundation.sql` in place; Claims Core 64 and reverse logistics 65 are unchanged prerequisites. Production 63 is the user's recorded checkpoint, not refreshed by this audit. Native tests apply the actual schema and all 66 migrations to fresh disposable databases. The populated 65→66 preservation test proves existing business/SMS/PDC/Claims/payment rows and canonical functions unchanged apart from the documented permission/reset extensions. No destructive changes, seeded credentials/templates/consent/messages or historical sends. Full reset preserves configured/retained Email data and reports its blocker. Later deployment must independently recheck applied migration identities/parity and dormant invariants; do not assume an edited migration can replace an already-applied version.

## 13. Existing systems

Full tests and populated migration checkpoints pass for Auth/support/chat, checkout/payment/My Account, Vodafone/Order/PDC SMS, Claims Stage 1 and reverse Stage 2. No production Auth, Microsoft 365, OneSignal or DNS acceptance is claimed. No changes to those integration/consumer files; no email business producers, financial/inventory actions, scheduler or Claims Stage 3.

## 14. Tests and validation

Final **`node --test tests/*.test.mjs`: 583 passed, zero failed/skipped** with both native binary/driver environments configured. Focused final Email suite: **50 passed, zero failed/skipped**. `env -u DEBUG npm run typecheck`, `env -u DEBUG npm run build` and `git diff --check` pass. Existing ERP duplicate-import, sourcemap/chunk, preorder BigInt and `previousProduct` build warnings remain; build completes successfully. No unrelated warning repairs.

Reproducible native setup uses `EMAIL_REVIEW_PG_BIN`/`EMAIL_REVIEW_PG_DRIVER` for Email and the existing `PAYMOB_REVIEW_PG_BIN`/`PAYMOB_REVIEW_PG_DRIVER` for payment. With no native infrastructure these tests explicitly skip rather than claiming concurrency verification. Source/binary/driver are temporary audit infrastructure; no package/lockfile, global install or installed database service changes. Detailed temporary evidence: `/private/tmp/email-audit-{original-native-repro,rate-before,final-suite,focused-final,native,revocation,typecheck,build,browser,artifacts}.log`.

## 15. Local browser/API verification

Fresh actual styled Vue/H3/RBAC/disposable SQL browser: **867 assertions, 122 states/screenshots, 224 JSON responses, zero errors/external requests, one mocked provider call, zero real calls**. EN/AR/RTL, mobile/desktop, Light/Dark/System, tabs/settings/secret replacement, confirmation, roles/history/consent and unsubscribe pass. Screens/report: `/private/tmp/elcomputer-email-audit-browser/`. Actual HTTP partial-body tests prove webhook disable/token rotation and worker-key revocation, beyond anonymous guards. Fresh artifacts: **130 public files / 4,425,667 bytes, 12 Vue SSR cases, zero private SSR requests/secret canaries**. This is local fixture browser/API acceptance, not production/staging login or real Supabase/provider acceptance.

## 16. Remaining limitations and activation dependencies

Manual content meaning is not mechanically established; trusted staff/content governance remains required. Account/sender verification and activation are merchant attestations, not a real API readiness probe. Real Supabase authenticated roles/persistence, provider approval/quotas/deliverability/callback registration, secure ingress, deployed worker-key rotation/scheduling, private retention and provider blocklist/consent reconciliation remain unverified. An uncertain send requires reviewed reconciliation rather than resend. Shared Bearer authentication has no per-event signature. Event subscriptions/payload spelling differ; early callbacks without the echoed correlation or saved provider ID cannot be safely matched. Existing activity-log cleanup may prune old administrative actions; durable Email ledger is separate.

Later release/activation needs separate authorization and the established guarded migration/deployment review. Configure infrastructure master/worker secrets securely and merchant credentials/verified senders through Dashboard, recheck approval/quotas, deliberately enable only reviewed capabilities, then perform authorized authenticated/provider acceptance. This audit performs none of those actions.

## 17. Claims Stage 3 readiness

**Safe to build a separately authorized Claims communications stage on the corrected foundation.** Its server producer must authorize owned business events, use approved essential templates/recipients and stable event identities, atomically associate its business intent, suppress obsolete/historical events, respect consent/safety and preserve SMS/logistics/financial boundaries. This audit implements no producer or Stage 3. Live communications still require the release/activation/acceptance steps above. Stop after this audit.

```text
EMAIL FOUNDATION AUDITED: YES
SAFE TO BUILD CLAIMS STAGE 3: YES
SAFE FOR FUTURE DORMANT DEPLOYMENT: YES
CRITICAL/HIGH ISSUES REMAINING: NO
TRANSACTIONAL/MARKETING SEPARATED: YES
EMAIL QUEUE IDEMPOTENCY VERIFIED: YES
WEBHOOK SECURITY VERIFIED: YES
EMAIL SETTINGS DASHBOARD-MANAGED: YES
SUPABASE AUTH CHANGED: NO
REAL BREVO API CALLED: NO
REAL EMAIL SENT: NO
PRODUCTION MIGRATION APPLIED: NO
PRODUCTION DEPLOYED: NO
```

# Earlier Central Email Foundation implementation record — Brevo

Implemented locally 2026-10-08–09. Brevo, marketing and webhook processing default **OFF**, with no credentials, senders, templates, historical messages or business producers seeded. No production access, credential discovery, migration, deployment, DNS/Microsoft 365/OneSignal/Auth change, webhook registration or real provider/email/SMS operation occurred. Only disposable fixtures contain fake credentials and mocked sends.

## 1. Existing email and OneSignal audit

Read `AGENTS.md`, current project/handoff records, SMS audit/security/foundation/order/PDC documents, Claims Core, reverse logistics, authentication documentation and the existing Live Chat acceptance record. Reviewed migrations, RBAC, navigation, server settings/auth/body readers, private workers/queues and test fixtures. Repository search covered email, mailer, smtp, onesignal, brevo, sendinblue, resend, notification, template, queue, campaign, unsubscribe, email provider, message history and transactional. Environment/deployment credential files and generated/dependency/Git directories were excluded from content discovery.

Before this change there was no Brevo/Sendinblue/OneSignal integration, mailer, reusable outbound email sender, email template ledger, email queue/history or marketing unsubscribe system in application code. Historical OneSignal DNS records are user-supplied context; DNS was neither inspected nor changed. Email fields belong to customer/admin identity, orders, CRM/contact forms and in-app support/chat. Support unread notifications, private Realtime and order conversations are not email sends. `supabase/config.toml` has commented example SMTP configuration; the login page calls Supabase Auth for password recovery. Authentication email remains owned by Supabase. No provider or hosting configuration was inferred from those examples.

## 2. Reused architecture

Uses the existing `credentialSecrets.js` AES-256-GCM envelope and server master key, `requireAdminRequest`/active staff RBAC, permissions editor/navigation, `useSupportClient`, bounded payment callback body reader, private/no-store handler pattern, existing admin activity table and EN/AR dashboard/theme conventions. SMS/PDC/Daftra workers supply durable lease/final-dispatch patterns. Their XML/MSISDN/shipment/ERP tables have domain-specific constraints and are not a safe generic email queue. They remain unchanged. The generic Supabase-shaped disposable SQL fixture is reused for tests only.

## 3. Files

- `app/pages/dashboard/email.vue`: six existing-shell Dashboard sections.
- `app/pages/email/unsubscribe.vue`: localized confirmation page with no customer account lookup.
- `app/utils/email.js`: mailbox/header/text validation, supported placeholders and escaped responsive HTML.
- `app/utils/adminPermissions.js`, `dashboardNavigation.js`, `uiMessageKeys.json`, both locale catalogs: granular navigation, labels and permissions.
- `app/utils/seo.js`, `server/middleware/emailPrivacy.js`: private/non-indexable unsubscribe route, no-store and no-referrer headers.
- `server/utils/email/{core,settings,templates,service,brevo,events}.js`: central service, encrypted settings, adapter, event normalization and private error handling.
- `server/api/admin-email/*`: settings, capabilities, templates, preview, manual send, paginated history, attempts/events and consent/suppression APIs.
- `server/api/internal/email/process.post.js`, `server/api/webhooks/brevo.post.js`, `server/api/email/unsubscribe.post.js`: separate worker, documented-auth webhook and recipient token endpoint.
- `nuxt.config.ts`: private infrastructure `emailWorkerSecret`; no merchant provider environment variables.
- Migration below; `tests/email-{foundation,api,transport}.test.mjs`, `tests/helpers/email{Fixture,HttpFixture}.mjs`, `scripts/email-browser.mjs`, `scripts/email-artifacts.mjs`.
- This document, `PROJECT_STATE.md`, `CODEX_HANDOFF.md`.

## 4. Database migration

`20261008180000_email_foundation.sql` is the **66th local migration**, following unapplied Claims Core `20261008120000` and reverse logistics `20261008160000`. Production's last user-reported checkpoint is 63, not refreshed here. Apply none during this task.

Six new private RLS tables:

| Table | Purpose |
| --- | --- |
| `email_provider_settings` | Singleton Brevo config, encrypted key/token, revision and dispatch throttle |
| `email_templates` | Stable keys, immutable classification, bilingual text sources and versions |
| `email_preferences` | Normalized mailbox, consent status/provenance/time, safety reason and provider-unsubscribed senders |
| `email_messages` | Immutable one-recipient intent/content/sender/template snapshot, durable idempotency, lease, expiry, provider identity and separate observations |
| `email_attempts` | Sanitized bounded attempt outcomes and timestamps |
| `email_events` | Immutable deduplicated normalized provider observations |

Unique logical UUID, correlation nonce, provider identity, unsubscribe hash and per-intent attempt identity; queue, recipient/history and event indexes; constrained state/type/language/content. No historical sends/backfill. All writes use service-only `email_command`, canonical triggers and atomic audits. Browser roles have no table/RPC privileges. Service role has SELECT and RPC access, no direct table mutation privileges. The existing default permissions function is extended with false email grants; existing staff rows are unchanged.

Full reset recognizes and retains the new tables. Once configured email or retained ledger/preference/template data exists, it returns an `email_retained_data` blocker, requiring a separately scoped retention/reset decision. It cannot silently erase private history or configuration. Other reset scopes preserve email. The populated migration test proves existing business/SMS/PDC/Claims/payment rows and canonical function sources unchanged, except the explicitly extended permissions and reset-plan functions.

## 5. Central service

`createEmailService(db).sendTransactional(input, { actor })` and `.sendMarketing(input)` render/validate then call the private SQL enqueue. They do not make a provider request. An explicit `idempotency_key` UUID is required for server consumers. Staff manual sends instead use a server-signed preview receipt, bound to staff, normalized content, recipient, sender, template/version, config revision and a ten-minute deadline. Confirmation includes an essential/non-promotional declaration. The HTTP route forces one transactional recipient, manual source and priority zero.

For later server consumers, `actor` is omitted and source becomes `service`; the caller must perform its own business authorization and stable event identity construction. There are **no current consumer calls** from Claims, Orders, shipping, pickup, NPS, Support, Auth, abandoned cart or product automation. Suppressed recipients produce terminal, non-sendable records when an otherwise enabled service receives a new intent. Disabled/unready service returns 503 and creates no message.

Inputs: `recipient`, optional approved `sender`, `locale` (`en`/`ar`), `body_format` (`html`/`text`), `template_key` plus supported `values`, or transactional `subject`/`body`; future server callers may supply bounded `business_reference` and priority 0–10. Marketing requires a marketing template and the configured marketing sender. No browser marketing send endpoint, segmentation, bulk send, campaign manager or scheduler exists.

## 6. Brevo adapter and verified documentation

Reviewed current official [send API](https://developers.brevo.com/reference/send-transac-email), [send guide](https://developers.brevo.com/docs/send-a-transactional-email), [transactional webhook payloads](https://developers.brevo.com/docs/transactional-webhooks), [secure webhook calls](https://developers.brevo.com/docs/secured-webhooks), [webhook creation contract](https://developers.brevo.com/reference/create-webhook), [batch idempotency](https://developers.brevo.com/docs/heterogenous-versions-batch-emails), [API status/error concepts](https://developers.brevo.com/docs/how-it-works), [rate limits](https://developers.brevo.com/docs/api-limits) and [provider blocklist distinctions](https://help.brevo.com/hc/en-us/articles/209458705-What-is-a-blacklisted-contact-). Documentation browsing made no authenticated provider API request.

One server POST to fixed `https://api.brevo.com/v3/smtp/email`, with `api-key`, sender name/email, one `to`, subject, optional `replyTo`, safe HTML **or** text, opaque `X-Mailin-custom` correlation and classification tag. The documented endpoint is a protocol allowlist, not merchant configuration; no arbitrary base URL/redirect/SSRF target is allowed. DNS has a timeout, all returned addresses must be public, the checked address is pinned with normal hostname/certificate verification, TLS minimum 1.2, headers 16 KiB, request 192 KiB, response 256 KiB and configured request timeout 1–30 seconds. Responses/errors discard raw provider text.

The current guide says to choose one body type. Both representations are snapshotted/previewable; HTML requests use `htmlContent` and plain requests use `textContent`. Multipart dual-body delivery is **not claimed**. A valid 201 `messageId` means provider acceptance only. Optional outer angle brackets normalize identically between send and callback IDs. Malformed acceptance, redirects, unexpected HTTP statuses, 5xx, post-dispatch timeout/disconnect and interrupted results become uncertain. Explicit 400/401/402/403/404/405/406/422 are categorized rejection; documented credit/account-validation/auth/parameter codes map through a closed allowlist, while `duplicate_request` stays uncertain because prior acceptance is not established; 429 has a bounded Retry-After/default delay. DNS/payload preflight failures proven before POST may retry. No single-recipient send deduplication guarantee is assumed from Brevo's separate batch idempotency documentation.

## 7. Dashboard configuration and secrets

Provider Settings controls approved senders/name/verification attestations, transactional and marketing defaults, Reply-To, brand name, marketing unsubscribe HTTPS site origin, local activation/account-approval confirmations, provider/marketing/webhook toggles, timeout and encrypted key/token replacement or removal. Sender, key or sender-default changes reset provider/account activation; webhook token replacement leaves webhook off. A fresh later save must confirm readiness. All config saves atomically increment revision and retire queued intents.

Saved keys/tokens are encrypted using the existing random-IV AES-256-GCM v1 envelope. Only presence flags reach staff browsers; plaintext and ciphertext are never returned. Empty secret inputs keep existing envelopes; explicit removal clears them. Inputs clear after successful replacement. Credentials must be printable non-space ASCII, 32–1024 characters. Master encryption and `NUXT_EMAIL_WORKER_SECRET` are server infrastructure, never public runtime config. No real merchant key was configured. Suggested initial sender, from supplied context: `info@elcomputer.net`; it is not seeded/hardcoded and its verification/account approval must be confirmed by authorized staff when activating.

## 8. Transactional/marketing separation

Classification is explicit in templates, immutable intents, service entry points, tags and SQL checks. Transactional entry rejects marketing templates. Marketing entry requires marketing templates, enabled marketing configuration, approved configured marketing sender, recorded suitable opt-in and no delivery restriction. SQL checks again before enqueue and immediately before dispatch. One recipient per intent for both classes; no bulk shortcut.

Free-form manual content cannot be semantically proven essential by software. It is restricted to authorized transactional staff, previewed, declared non-promotional and audited. Future consumers need approved message purpose/content; labels or staff declarations alone do not establish legal approval. Marketing consent has no automatic account/profile/contact import, inferred opt-in or default subscription.

## 9. Templates

Dashboard key/name/category/classification, bilingual subject/body, sender override, Reply-To override, enabled toggle and revision/update fields. Classification and key cannot change on an existing template. Controlled placeholders: `customer_name`, `reference`, `message`, `store_name`. Unknown/malformed/executable-looking expressions fail; no JS/expression engine or arbitrary HTML editor. Body sources are plain text/paragraphs with placeholders, rendered into branded, responsive table HTML and plain text. All substituted/body/subject/brand values are escaped; no external image, script, event handler or remote preview resource. Arabic HTML has `lang=ar`, `dir=rtl` and right alignment. Preview uses an empty sandbox and no-referrer; no content is injected into the parent DOM. Send snapshots retain template version despite later editing.

## 10. Queue/idempotency

States: queued, processing, accepted, failed, uncertain, suppressed. Unique database logical UUID plus SHA-256 normalized semantic fingerprint prevents repeated enqueue and rejects changed content with the same identity. Configuration revision/template version/actor/classification are bound. Native provider-row locking serializes authorization/queue changes; claim uses a bounded lease and queue ordering. One-second final-dispatch throttle across workers, at most three attempts, ten-minute intent authorization, two-minute stale lease to uncertain, one-minute dispatch window. Worker processes at most three intents per request, default one.

Immediately after DNS and before POST, SQL rechecks current settings/revision/expiry, work token, dispatch marker, actor permissions, marketing consent and recipient global/sender restrictions. Once a request is authorized and in flight it cannot be recalled by a subsequent disable/unsubscribe. Later dispatches are blocked. No automatic uncertain retry, Retry button, fictional provider inquiry, batch-dedupe reliance or new identity generation for retry. Preflight/429 retry uses the same intent with bounded delay, expiry and attempt cap. A database finish failure leaves a lease for conservative uncertain recovery. Durable attempt history preserves sanitized categories, codes/status/IDs and times.

Enabling later does not resurrect any retired intent. Missing credentials/encryption/disabled provider cannot enqueue, report fake acceptance or contact Brevo. Queued intents expire even if no worker is scheduled; a later worker suppresses them before sending.

## 11. Manual portal

One staff recipient, approved sender, language, HTML/plain format, enabled transactional template or plain custom subject/body. Server-rendered preview, explicit recipient/content confirmation and essential-message declaration; edits invalidate preview. Send is blocked while unavailable. The result says queued/suppressed, not delivered; worker acceptance and callbacks appear through history. No browser operation directly dispatches provider traffic. The local browser fixture enables only fake config and uses a mocked provider.

## 12. History

25-row bounded pages with masked recipient, sender, class/category/language, template/version, source/business reference/actor, state, provider ID, times, attempts and separate delivery/open observations. Detail shows sanitized attempts and events. No subject/body, correlation nonce, credentials or unsubscribe token/hash in saved history responses. Explicit future retention/redaction of private body snapshots and recipient data is required before sensitive communications; this task performs no historical purge.

## 13. Webhooks

`POST /api/webhooks/brevo`, off until encrypted Bearer token and explicit webhook enablement. Brevo's documented creation option is `auth: { type: 'bearer', token: ... }`; compare `Authorization: Bearer ...` in constant time. It is a shared-secret/TLS mechanism, not a provider HMAC signature. Possession of that secret authenticates the caller; there is no claimed cryptographic per-event signature. Configure gateway header redaction/rate controls and optional official IP restrictions during later activation. Never register automatically.

32 KiB object body, five-second read limit; register **non-batched transactional email** callbacks later (`batched:false`, email channel). Arrays/batched payloads are deliberately unsupported. Verified payload mapping: `request`→sent, `delivered`, `deferred`, `soft_bounce`, `hard_bounce`, `spam`, `invalid_email`, `blocked`, `error`, `unsubscribed`, `opened`. Subscription names `hardBounce`, `softBounce`, `invalid` differ from payload names. Unsupported mappings are ignored after authentication. No click/proxy-open or SMS/campaign payload inference.

UTC event time is `ts_event`, with documented `ts` fallback. Never use send-time `ts_epoch` as event time. Native bounds reject pre-intent/future events. ID + exact normalized recipient must match; before the HTTP finish, a dispatched processing/uncertain intent can match its random opaque correlation nonce. Unknown events/IDs/recipients return generic receipt without storing arbitrary external-message PII. Event key derives canonical provider ID, recipient, type and event second; webhook `id` is not treated as a globally unique event identity. Replay is database-deduplicated. Provider ID becomes immutable. Late events cannot downgrade delivered/terminal observation to sent/deferred/soft bounce or move its timestamp. Equal-second events use deterministic delivery/safety precedence, so sent and delivered in one second still project delivery. Opening is tracked separately and does not prove a human read. Early events without an ID already saved or the documented echoed custom header cannot be matched; no unsafe guess is made.

## 14. Bounce and suppression

Hard bounce, invalid mailbox and spam complaint impose conservative global safety suppression at final dispatch; later delivery facts do not remove it. Soft bounce/deferred do not trigger application resend; provider processing remains authoritative. `blocked`/`error` are observations and terminal delivery states, not invented mailbox invalidity. Brevo transactional unsubscribe blocks the originating sender according to documented sender-scoped behavior; a marketing-class event also opts out of application marketing. The separate recipient-link marketing opt-out does not block necessary transactional mail. Provider restrictions must be reviewed externally; this foundation does not call Brevo unblock/resubscribe APIs.

## 15. Consent/unsubscribe

Preferences hold unknown/subscribed/unsubscribed, consent time, explicit evidence/provenance, current safety reason, provider sender blocks and update author/time. Staff consent/suppression writes need permission, evidence and optimistic revision. Clearing a global safety restriction needs explicit documented provider clearance; sender blocks cannot be silently cleared through the UI. Automated/provider updates clear staff-author attribution. Atomic admin audit identifies the recipient through a SHA-256 fingerprint, omitting raw body/credential/evidence text. Provider facts remain in immutable events.

Future marketing intents append a random 256-bit unsubscribe capability, SHA-256 hash persisted uniquely and bound to that intent/recipient/marketing class, expiring after 180 days. The page receives the token in a URL **fragment**, removes it from the address bar on mount, loads no customer identity, and requires a click before body-only POST. GET/render/prefetch does not change preferences. No recipient query/address override is accepted. API looks up only the private hash, returns a generic unavailable response for invalid/expired links and opts out only the bound mailbox's marketing. Replays keep it unsubscribed. Localized no-store/no-referrer/noindex route stays outside public AI/CMS discovery. Future campaigns must decide compliant consent, purpose, token lifetime, preference retention and provider/contact synchronization before activation.

## 16. RBAC/RLS

Parent `email.view`; `email.settings.view/manage`, `email.templates.view/manage`, `email.transactional.send`, `email.history.view`, `email.marketing.manage`. Settings/template manage depend on their view rights. Existing owner full access remains; ordinary staff gain no grants. Route/navigation/editor use existing normalization; every API enforces active server staff rights. Send-only staff can list enabled transactional templates and approved senders but cannot view secrets/settings/marketing templates/history. History/events share the history right. SQL repeats mutation/manual send authorization and worker actor revocation checks. Customers/anonymous/inactive staff cannot view private tables/settings/history or mutate recipient preferences without a valid unsubscribe capability.

## 17. Security review

Reviewed boundaries for secrets in APIs/SSR/public artifacts, merchant origin versus fixed provider endpoint, DNS/TLS/redirect/payload/time limits, header injection, placeholder escaping/sandbox, classification, HMAC preview binding, native idempotency/immutable snapshots, disabled backlog/config races, lease ambiguity, final consent/staff restrictions, constant-time Bearer validation, event replay/recipient matching/time ordering, suppression provenance, unsubscribe hash capabilities, reset retention and atomic audit failure. No raw provider response/body/secret is logged. Private queue content remains sensitive even though history projections omit it. Limits and audit retention follow this foundation/existing architecture; authenticated production sessions, independent PostgreSQL concurrency, provider acceptance/deliverability, real DNS account approval, quota behavior and operational monitoring are not established by fixtures.

## 18. Validation

Deterministic foundation, actual HTTP/RBAC/SQL and transport tests cover all requested boundaries, including a populated 65→66 migration preservation checkpoint, merchant JSON key ordering, secret masking/replacement, disabled backlog, unsafe placeholders/headers, EN/AR, idempotency, preview tampering, marketing consent and native dispatch rechecks, expired/stale leases, uncertain sends, bounded rate retries, accepted IDs, early callbacks, replay/ownership, hard bounce/invalid/spam/sender unsubscribe, stale preferences/provider clearance, private roles, body caps and atomic audit rollback.

Required final commands: `node --test --test-concurrency=1 tests/*.test.mjs`, `npm run typecheck`, `npm run build`, `git diff --check`. Concurrency one avoids the existing timing-sensitive Paymob fixture contention while running every requested test file. **552 tests: 551 pass, zero fail, one existing optional native-concurrency skip.** Typecheck, build and diff check passed. `scripts/email-artifacts.mjs` scanned **130 public files / 4,434,664 bytes** and rendered **12 real Vue SSR cases** with zero private SSR requests or secret canaries. Final counts are also recorded in the project/handoff checkpoint. Existing optional native concurrency review remains skipped unless its dedicated disposable environment is explicitly configured. Build retains existing ERP duplicate-import/source-map/chunk/preorder/previousProduct warnings.

## 19. Browser acceptance

`scripts/email-browser.mjs`: actual Vue page with its scoped styles + compiled application CSS, real H3 endpoints/RBAC/disposable application SQL, fixture Auth and strictly mocked adapter. EN/AR/RTL, 1440/390 widths, Light/Dark/System, six tabs, unavailable template/manual previews, replacement and fresh activation, preview invalidation, one confirmed queued intent, mocked worker acceptance, delivery events, consent, granular roles/privacy and localized unsubscribe. Public/private browser response canaries and external-request block. **867 assertions / 122 states and screenshots / 224 JSON responses**, zero browser errors/external requests, one mocked provider call and zero real calls. Screens/reports under `/private/tmp/elcomputer-email-browser`; counts recorded in the checkpoint. The browser review found and corrected sender comparison across PostgreSQL JSON key ordering, explicit control accessibility, and mobile fieldset/checkbox widths. The harness attaches the same scoped style IDs as Vue before rendering. This is local component/API acceptance, **not authenticated production or live Supabase/Brevo acceptance**.

## 20. Existing-system regressions

Full suite covers existing Vodafone SMS, Order/PDC SMS, PDC tracking/reverse logistics, Claims/warranty/policies, support/auth/ERP, checkout/payments and public discovery. Migration checkpoint preserves existing business rows and canonical send/checkout/shipping/Claims function bodies. No business-email producers or edits to their consumers. Existing Supabase OTP/login/reset flows and OneSignal configuration remain untouched.

## 21. Later activation requirements

Separately authorized deployment computer must synchronize main, review pending migrations **64→65→66**, migration parity/backups and dormant data invariants, then apply/release through established guarded procedure. Do not assume deployment from Git alignment. Configure the existing server master key and separate long worker infrastructure secret securely; no provider secrets in ordinary env. Enter real Brevo key, approved verified sender/name and Reply-To in Dashboard; recheck domain/account transactional approval/quotas and explicit fresh activation. `info@elcomputer.net` is a suggestion from user-supplied verified sender context. Marketing and webhook remain off unless separately approved/configured. No real readiness network probe exists.

Plan worker scheduling/rate/quota monitoring, uncertain reconciliation procedures and private data retention. Register non-batched email webhook later with documented Bearer auth and selected supported events, secure ingress and test exact payload/matching semantics. Independently verify real authenticated staff saves/roles, Supabase persistence/concurrency, one expressly authorized provider transaction and provider logs/events. Marketing additionally requires reviewed opt-in provenance, approved marketing sender/site origin, external sender blocklist reconciliation and unsubscribe lifecycle/contact synchronization. This task does none of those external actions.

## 22. Before Claims Stage 3

Claims Core/reverse logistics remain unchanged and have no email producer. Stage 3 needs separate authorization for concrete milestone templates, recipient/purpose policy, exact event identities, transaction-safe business intent creation and stale/historical suppression, ordering, business-reference/audit privacy, coexisting SMS controls, localization and final delivery policy. Review deployment/activation prerequisites and authenticated/native concurrency/provider acceptance before any real notification. Refund/inventory/logistics actions remain outside email. **STOP after this foundation.**

## Required implementation flags

CENTRAL EMAIL FOUNDATION IMPLEMENTED: YES
BREVO PROVIDER IMPLEMENTED: YES
EMAIL SETTINGS DASHBOARD-MANAGED: YES
BREVO CREDENTIALS STORED ENCRYPTED: YES (architecture and fake isolated tests; no real key configured)
TRANSACTIONAL/MARKETING SEPARATED: YES
EMAIL QUEUE DATABASE-BACKED: YES
EMAIL IDEMPOTENCY DATABASE-BACKED: YES
EMAIL TEMPLATES DASHBOARD-MANAGED: YES
EMAIL HISTORY IMPLEMENTED: YES
BOUNCE/SUPPRESSION FOUNDATION IMPLEMENTED: YES
SUPABASE AUTH CHANGED: NO
ONESIGNAL CONFIGURATION CHANGED: NO
REAL BREVO API CALLED: NO
REAL EMAIL SENT: NO
PRODUCTION MIGRATION APPLIED: NO
PRODUCTION DEPLOYED: NO
