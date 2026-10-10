# Final integrated audit — 2026-10-10

Freshly reviewed all seven milestones with Claims/reverse/central SMS/Email and all four migrations. Native outbox rollback, channel/linkage/dispatch races and new reverse receipt/acceptance races pass. Occurrence/purchase-contact/locale/template approval/no-backlog boundaries hold. Migration67 and provider algorithms unchanged; corrections concern64/65 boundaries.

Integrated browser adds labels, keyboard, loading, intentional error and hidden-role checks: **456 assertions /65 screenshots**, seven mock acceptances per channel, zero unexpected errors/external requests; its intended503 is recorded separately. Complete fresh **641 full /354 focused** results and27-point report: [after-sales-final-audit.md](after-sales-final-audit.md). Real Auth/Storage/provider acceptance unverified; no production migration/deploy/activation/message. **STOP after final audit.** Earlier records are historical architecture/evidence.

# After-Sales Stage 3 — Claims SMS and Email

Implemented locally on 2026-10-09, starting from clean synced `main` at audited Email commit `c1885735799b0943737f8ed02c95fa2322e02c10`. This is one additive communications feature. No production access, deployment, migration application, credential acquisition/configuration, provider activation, real provider request or real message occurred. The user-reported production checkpoint remains 63 migrations and was not refreshed. There are now 67 local migration files; 64–67 require a separate deployment review. Earlier project documentation checkpoints are historical.

## 1. Audit findings

Read AGENTS, project/handoff records, Claims, reverse logistics, policy, warranty, central Email and SMS/Order/PDC SMS documentation and actual code/migrations. The branch contains Claims `c43b1f2`, reverse logistics `f13ccf2`, Email `6ecac1e` and its security audit `c188573`. Claims already persist authoritative timeline events, information-request UUIDs and audited decisions; reverse booking acceptance and dated canonical receipt already persist through Claims events. No status machine or courier implementation was replaced.

An order contact email snapshot already exists: the actual customer checkout handler requires an address/account email and supplies it to `commerce_create_customer_order`. Claims creation's browser locale differs from purchased `customer_orders.sms_locale`; automation therefore uses the purchase locale. Reverse timeline events do not contain a job UUID, so capture verifies the latest authoritative job inside the existing serialized Claim transaction. Repeated saves of one resolution create timeline events, requiring a separate unchanged-decision guard.

## 2. Existing services reused

`server/utils/sms/service.js`, settings, templates, normalization, XML escaping, queues, leases, ExternalTrxId, worker and history remain central. `server/utils/email/service.js`, audited `email_command`, encrypted settings, safe template/layout rendering, Brevo adapter, queues, attempts, events and recipient restrictions remain central. Vodafone SecureHash and both provider adapters are unchanged. No SMTP, additional provider worker, sending history database, bulk sending or campaign system was added.

## 3. Exact supported milestone sources

| Purpose | Existing persisted event and status | Occurrence identity |
| --- | --- | --- |
| More Information Required | `request_information` / `more_information_required` | Pending `after_sales_claim_information.id` |
| Approved | `approve` / `approved` | Timeline event ID; once per Claim/channel |
| Rejected | `reject` / `rejected` | Timeline event ID; once per Claim/channel |
| Reverse Pickup Scheduled | `reverse_created` / `pickup_scheduled`, verified latest job `created` with AWB | `shipping_claim_jobs.id` |
| Item Received | Manual `receive`, or canonical `reverse_received` / `received` | Timeline event ID; once per Claim/channel |
| Resolution Decided | `select_resolution` / `resolution_in_progress`, changed resolution enum | Decision timeline event ID |
| Resolved | `resolve` / `resolved` | Timeline event ID; once per Claim/channel |

No notifications for submission, review, inspection, notes, customer replies, raw tracking, reconciliation, unknown/undated observations or duplicate webhooks. Item Received through reverse logistics requires a verified delivered job, normalized delivery and authoritative provider date. Old/future observations are suppressed. Existing reverse and outbound PDC routing is preserved.

## 4. Event-to-intent architecture

A private AFTER INSERT trigger on the existing immutable timeline creates two channel intents in the same transaction. Each captures source identity, purchased contacts/locale, safe customer variables, approved template snapshot/fingerprint, sender, settings/provider revisions and a ten-minute expiry. Workers prepare at most three intents per invocation and atomically hand them to the corresponding central queue. Provider networking occurs only in the existing central queue processors. Claim/PDC handlers never call or wait for message providers.

The new ledger records preparation and central linkage only. Central SMS/Email ledgers own dispatch, provider acceptance, retries, uncertainty and delivery observations.

## 5. Dashboard communication settings

`/dashboard/after-sales?tab=communications` contains seven cards, each with event/SMS/Email flags, separate EN/AR central template references, approved sender selection and optimistic revision saves. Every flag defaults OFF. The migration seeds only seven OFF controls; no templates, recipients, enabled bindings, messages or historical intents are seeded.

Read-only staff can inspect controls. Authorized managers approve current template fingerprints when saving enabled bindings. Provider readiness is shown without exposing secrets. Links open existing SMS/Email editors with a disabled, bilingual purpose draft. Staff must save/enable templates centrally and then approve the event bindings. Suggested business defaults in the brief remain suggestions only.

## 6. SMS integration

Uses central `sendNotification` only, exactly one normalized purchased phone, saved central templates, stable `claim:<intent UUID>` idempotency, central ExternalTrxId and existing enqueue/worker/history. Segment estimation caps Claims SMS at ten segments, including Unicode multipart boundaries. Missing/invalid phones, invalid content and oversized SMS skip only SMS. Campaign routing is rejected for a Claims context. The internal SMS worker now also rechecks its private secret before queue work and on both sides of final dispatch authorization.

## 7. Email integration

Uses central `sendTransactional` only. Saved plain sources become escaped responsive branded HTML with EN/AR direction, plain-text snapshots and an accessible canonical My Account link. Claims context is a server-only service option, never a browser body field. Central enqueue and Claim linkage share one SQL transaction. Central safety restrictions remain effective; provider acceptance is distinct from delivery. Existing Auth email/OTP and marketing flows retain their boundaries.

## 8. Controlled transactional templates

Bindings require enabled bilingual templates with `claim_<purpose>` keys/codes (optional suffix), exact `claims:<purpose>` category, Notification/Transactional classification, `claim_reference` and body `{{claim_url}}`. Information-request Email also requires `{{request_text}}`. Each purpose has a restricted variable allowlist. No arbitrary HTML, sender address, subject, recipients or list is accepted by Claims actions/settings.

Templates are audited through their existing editors. Saving an enabled binding approves the entire current template fingerprint; any subsequent edit invalidates preparation/final dispatch until a fresh binding approval. Ordinary manual transactional text still has the audited Email Foundation governance limitation: structural purpose checks cannot conclusively detect promotional prose written by a trusted template editor. There is no claim of semantic classification. Approved content review remains an activation prerequisite.

## 9. Phone recipient policy

Uses `customer_orders.phone`, the purchased-order contact used by existing Order SMS, captured at the milestone. Uses the established MSISDN utility and provider country/international rules. Reverse pickup's alternate phone, browser values and later account profile changes never override it. Invalid/missing contacts produce a safe terminal channel skip.

## 10. Email recipient policy

Uses only captured `customer_orders.email`, lowercased and strictly validated by the central utility. The checkout handler already stores this purchase contact. There is no mutable profile fallback, inferred historical email, browser override or recipient list. Missing/invalid Email does not block SMS or the Claim. Captured contacts remain immutable even if the source order/profile subsequently changes.

## 11. Locale, content and privacy

Uses purchased `customer_orders.sms_locale`; established English fallback for a missing locale. Claim form/browser locale does not choose messages. Safe variables are `customer_name`, `claim_reference`, `claim_type`, `order_number`, `product_name`, `claim_url`; add `request_text` for information requests, `awb`/`courier_name` for pickup, and `resolution` for decided/resolved. No invented pickup date. Localized Claim/resolution names use the existing catalog.

The fixed HTTPS account route contains the Claim UUID because the authenticated account page requires it; no token/secret is embedded. The account APIs retain authentication and ownership checks. Request text is the explicitly customer-visible prompt, escaped by Email rendering. Staff-private notes, provider reasons, serial verification rationale, risk data and secrets do not enter message variables. Refund/Replacement/Repair decisions never assert funds sent, shipment dispatched or repair completed. No execution integration was added.

## 12. Database idempotency

Unique `(purpose, occurrence_id, channel)` and `(event_id, channel)` constraints; once-only partial uniqueness for Approved, Rejected, Received and Resolved per Claim/channel. Central content-bound keys add the existing second boundary. Preparation uses leases, tokens and atomic linkage, with bounded storage retries. Replayed events/actions and retries cannot produce another queue message. Source/linkage fields are immutable; direct service mutations are denied.

## 13. Repeated information requests

Each new persisted request UUID gets one intent per channel. Re-emitting the same request, even from concurrent native sessions, captures once per channel. A customer reply creates no communication and invalidates an unsent original request. A later new request may notify. Email includes safe customer-facing text and the account action; suggested SMS directs customers to My Account.

## 14. Reverse booking and rebooking

A booking attempt alone does not notify. Verified REF/AWB acceptance into the latest `created` job emits Pickup Scheduled. Re-observing that booking does not resend. A legitimate new booking after an allowed failed/cancelled/returned predecessor has a new job UUID and can notify. Stale prior booking intents are superseded. Verified delivery emits one Received communication per channel; raw tracking and replay do not. Reverse delivery creates no outbound `pdc_*` Order SMS event. PDC semantics and history are unchanged.

## 15. Transaction/outbox guarantees and deliberate tradeoff

Event and both channel intents commit or roll back together. No queue or provider work occurs in that transaction. A forced intent-insert failure rolls back status, revision and timeline: this is a deliberate fail-closed persistence choice, **not unconditional isolation from outbox database failure**. An enabled milestone is never silently committed without its intent.

Once committed, preparation, queue/linkage and transport failures cannot reverse or change the Claim/PDC fact. Failed central enqueue/linkage rolls back both and permits a bounded retry. Preparation can recover a two-minute abandoned lease, retry storage failure after 30 seconds, and attempts at most three times. Authorized events survive short worker downtime within the existing ten-minute freshness window; expired work is terminally skipped. This does not promise unlimited offline delivery or perfect external exactly-once delivery.

Final checks repeat current configuration, template approval, approver permissions, ownership, source relevance and expiry immediately before provider POST. A disablement committed ahead of a blocked check prevents sending in both native channel races. A change after final authorization cannot retract an HTTP request already in flight. Central uncertain outcomes are retained and never blindly resent.

Resolution supersession compares genuine captured decision occurrences as well as the current enum: A → B → A sends only the latest pending A; repeated saves of the unchanged A neither create nor invalidate a new occurrence.

## 16. Provider-disabled suppression

OFF event/channel, disabled/unconfigured provider, missing runtime encryption/readiness, invalid source/template/contact, expired/superseded work or revoked approval cause terminal suppression. There is no future-sendable central job for such capture/preparation skips. Missing stored SMS credentials cannot pass central provider activation constraints. Both providers and all policies remain untouched outside disposable fixtures.

## 17. No historical backlog

Capture starts at migration creation; no prior timeline scan/backfill. Old dated reverse delivery observations are suppressed using source date, configuration time and expiry. OFF captures stay terminal after future enablement. Settings changes retire pending/preparing and still-queued central-linked work; accepted/completed central history remains accurate. Queued/processing jobs also recheck revisions/current authorization at final dispatch. Enabling later cannot revive suppressed work.

## 18. Channel failure isolation

Separate per-channel intents, preparation and central workers. SMS failure/invalid recipient/segment cap does not block Email; Email failure/missing recipient/header injection/safety suppression does not block SMS. Both unavailable and uncertain results retain committed Claim status and reverse history. Mocked acceptance is recorded as acceptance, never real delivery.

## 19–21. Staff history and customer UI

A Communications panel in staff Claim detail shows masked recipient, milestone/channel, template/reference, sender, preparation and central queue states, bounded attempts, safe reason, occurrence timestamp and provider acceptance when available. It joins existing central ledgers and offers permission-gated links to central history; there is no resend action or duplicated provider history.

Customers keep the existing My Account timeline and response workflow. No sending diagnostics/control or private ledger is fetched or rendered for customers. Other customers still cannot access Claim detail. English/Arabic, desktop/mobile and Light/Dark/System were exercised against actual components and APIs with fixture auth.

## 22. RBAC/RLS

Two minimal permissions: `claims.communications.view` and `.manage`, with existing `claims.view` and view/manage dependency enforcement. Owner bypass remains active-owner only. Server APIs authenticate actual Claims actors and reject unbounded/unknown configuration fields, invalid bindings, arbitrary recipients and stale revisions. SQL repeats actor/permissions/revision/template/sender checks and writes settings audit atomically.

Both new tables have RLS, no browser grants/policies and SELECT-only service table access. Canonical RPCs alone mutate them; owner-only helpers and preserved pre-wrapper functions are not service/browser callable. Delete/truncate and intent/linkage mutation are guarded. Staff history excludes raw contacts, prompts, variables, templates, tokens, fingerprints, provider payloads and secrets. Account timeline privacy remains unchanged.

## 23. Database changes

Only new unapplied migration `20261009120000_after_sales_communications.sql` (67). Two private indexed/constrained tables for controls and preparation/linkage; timeline capture trigger; canonical configuration/preparation/linkage/history functions; minimal permissions; final SMS/Email authorization wrappers preserving original function bodies. Full reset recognizes and retains new records, blocking configured/data-bearing erasure. No modifications to migrations 64–66, destructive writes, enabled configuration, historical backfill, real templates/provider jobs or production application.

## 24. Tests and native concurrency

Five focused Stage 3 files cover seven milestones, all OFF, channel combinations, credentials/provider OFF, no backlog, binding changes/revocation, genuine information/rebooking/decision identities, segment/header/HTML safety, contacts/locale, channel failures/uncertainty, workflow preservation, API ownership/RBAC/privacy, audit/capture/linkage rollback, expiry/leases/caps and populated 66→67 preservation. **39 focused Stage 3 passes**, zero failures/skips.

Native PostgreSQL **17.11** runs fresh disposable loopback clusters via existing executable/driver paths, never a database URL or existing installed cluster. Three independent service-role sessions plus observed `pg_stat_activity` lock barriers verify transaction visibility/rollback, concurrent stale approval, one preparation/queue/link, concurrent information occurrence capture, central linkage failure/retry, SMS and Email disable-ahead-of-dispatch, private grants and canonical writes. Nine native test results (parent plus eight subtests) pass; clusters are destroyed afterward. PGlite tests are not described as native concurrency.

## 25. Full validation

Final full suite: **622 passes, zero failures/skips**, including native Email/Claims and Paymob. Focused Claims/reverse/policy/warranty/SMS/Email: **293 passes**, zero failures/skips; Stage 3 accounts for 39 results. Typecheck, build and diff check pass on Node 24.16.0; production Node 22 is untouched. Commands: `node --test tests/*.test.mjs` with both native Email/Paymob environments configured; focused Claims/reverse/SMS/Email suites; `npm run typecheck`; `npm run build`; `git diff --check`. Pre-existing duplicate ERP autoimport, module/Tailwind sourcemap, chunk-size and preorder target warnings remain. The new feature introduces no required-check failure. Migration SHA-256: `df83fed86e8cb119a67b12e84974de059c665ea3b449c5d8724f5e35e9543f63`. Logs `/private/tmp/claim-full.log`, `/private/tmp/claim-adjacent-focused.log`, `/private/tmp/claim-stage3-focused.log`, `/private/tmp/claim-content.log`, `/private/tmp/claim-typecheck.log`, `/private/tmp/claim-build.log`. The initial 36-result Stage 3 log predates lease recovery, catalog capacity and preparation-time worker revocation checks; current full/focused runs include all 39. Catalog filtering occurs before the central metadata limit, so unrelated templates cannot hide Claim bindings. Preparation-time authorization loss never enqueues, propagates 401 and uses bounded recovery instead of a misleading template/segment reason.

## 26. Local browser/public results

Stage 3 actual Vue + compiled application CSS + real H3/RBAC + disposable SQL: **385 assertions / 65 states/screenshots / 210 JSON responses**, zero browser errors/external requests, seven mock SMS acceptances and seven mock Email acceptances. New panels use the established theme variables; computed text contrast and screenshot review pass. Per-event control and sender/bilingual binding saves use actual APIs; all seven milestones and customer timeline/history are checked. Reverse booking transport is a verified SQL fixture acceptance, not production PDC. Artifacts: `/private/tmp/elcomputer-claims-communications-browser/`.

Existing Claims Core: **496 assertions / 120 states/screenshots / 323 JSON responses**. Existing reverse: **537 assertions / 110 states/screenshots / 325 JSON responses**, seven mocked provider operations. Both have zero browser errors/external requests. Central Email: **896 assertions / 124 states/screenshots / 232 JSON responses**, one mock provider call. Central SMS: **553 assertions / 98 screenshots**. Both pass with zero browser errors/external requests and verify disabled Claims draft shortcuts; Email also saves the draft through actual central APIs and verifies variable labels. Across five harnesses: **2,867 assertions / 517 screenshots**. Rebuilt public scan: **133 files / 4,448,889 bytes / 36 SSR cases**, zero canary exposures/private requests. Evidence `/private/tmp/claim-*-browser.log`, `/private/tmp/claim-artifacts.log`; screenshots in existing `/private/tmp/elcomputer-email-browser/`, `/private/tmp/elcomputer-sms-review/browser/` and Claims/reverse fixture folders. The SMS browser uses fixture API data; Claims/Email browser APIs use real H3 and disposable SQL. Public canary scan plus 36 real Vue SSR cases issue zero private SSR requests.

These checks prove local component/API/SQL behavior under fixture authentication. They do **not** establish authenticated deployed Nuxt/Supabase/RLS sessions, live provider deliveries, ingress/cron reachability, quotas, sender verification or production concurrency.

## 27. Existing-system regressions

Full suite includes Claims, reverse, policy/warranty, SMS/Order/PDC SMS, central Email, authoritative checkout/payment and native Paymob, Support/Live Chat and Auth-related behavior. Existing Claims/reverse/SMS/Email browser harnesses are retained; only necessary component registration and draft assertions were added. No adjacent business state machine, payment authority, outbound shipment semantics, SecureHash, Auth OTP/email or notification provider was replaced.

## 28–29. Real activity and production status

No real Brevo/Vodafone/PDC API call, SMS/email, refund, replacement dispatch or provider activation. No production access/migration/deployment/credential configuration, policy activation, Supabase Auth, Microsoft 365/GoDaddy DNS or OneSignal change. Fake credentials and enabled settings exist only in disposable test fixtures. Normal `main` commit/push is the only shared release activity.

## 30. Before final After-Sales deployment

The deployment computer must pull, review the exact commit and migration parity, confirm the user-reported 63 checkpoint and all four pending migrations 64–67, preserve backups/data and perform a separately authorized dormant release. Independently verify active-role Supabase sessions/RLS, dashboard settings/history, private evidence, account links and EN/AR behavior in the deployed application.

Activation needs separate authorization: approve policy and sender/account setup, configure encrypted provider and server master/worker secrets on that computer, review bilingual purpose template content, centrally save/enable templates, approve event bindings, verify worker scheduling/ten-minute operational freshness, PDC reverse prerequisites, authenticated webhook/ingress and retention rules. Perform authorized real provider/receipt acceptance before claiming live delivery. No automatic financial execution or replacement outbound integration exists. **Stop after Stage 3.**

## Explicit completion states

```text
CLAIM COMMUNICATIONS IMPLEMENTED: YES
MORE INFORMATION SMS CONNECTED: YES
MORE INFORMATION EMAIL CONNECTED: YES
APPROVED SMS CONNECTED: YES
APPROVED EMAIL CONNECTED: YES
REJECTED SMS CONNECTED: YES
REJECTED EMAIL CONNECTED: YES
PICKUP SCHEDULED SMS CONNECTED: YES
PICKUP SCHEDULED EMAIL CONNECTED: YES
RECEIVED SMS CONNECTED: YES
RECEIVED EMAIL CONNECTED: YES
RESOLUTION DECIDED SMS CONNECTED: YES
RESOLUTION DECIDED EMAIL CONNECTED: YES
RESOLVED SMS CONNECTED: YES
RESOLVED EMAIL CONNECTED: YES
CLAIM COMMUNICATION SETTINGS DASHBOARD-MANAGED: YES
CLAIM SMS USES CENTRAL SMS: YES
CLAIM EMAIL USES CENTRAL EMAIL: YES
CLAIM COMMUNICATION IDEMPOTENCY DATABASE-BACKED: YES
TRANSACTIONAL TEMPLATES PURPOSE-BOUND: YES
SMS/EMAIL FAILURES ALTER CLAIM STATE: NO
HISTORICAL CLAIM EVENTS BACKFILLED: NO
DISABLED CHANNELS CREATE FUTURE-SENDABLE BACKLOG: NO
SUPABASE AUTH CHANGED: NO
REAL BREVO API CALLED: NO
REAL VODAFONE API CALLED: NO
REAL PDC PRODUCTION API CALLED: NO
REAL SMS SENT: NO
REAL EMAIL SENT: NO
AUTOMATIC REFUND EXECUTION CONNECTED: NO
REPLACEMENT OUTBOUND SHIPPING CONNECTED: NO
PRODUCTION MIGRATION APPLIED: NO
PRODUCTION DEPLOYED: NO
```

“Connected” means locally implemented/tested through central services, with production controls remaining unactivated. Transport failures preserve committed state; database intent-persistence failure deliberately blocks an uncommitted transition as described in section 15.
