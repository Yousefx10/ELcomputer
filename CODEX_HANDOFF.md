# Codex handoff — Live Chat Phase 3

Date: 2026-09-21. State: **PHASE 3 COMPLETE LOCALLY — awaiting explicit instruction for Phase 4. No remote change.**

## Completed in Phase 3

- Added local additive migration `supabase/migrations/20260920170000_live_chat_customer_intake.sql`: shared availability function, saved live/offline intake trigger, atomic first-conversation/message RPC, and narrow definer privileges for chat Auth-schema checks. It is not applied remotely. Phase 1 and 2 chat migrations also remain local.
- Added public `/api/chat/status`, scoped `/api/chat/me`, and optional atomic first-message handling in the create route. Availability remains false without an authorized agent's current online lease; settings default disabled.
- Added a client-only Live Support launcher and responsive customer panel to the storefront's default layout. Guests use a separately persisted Supabase Auth client and sign in anonymously only when they submit. Signed-in customers reuse existing Auth and contact data. The panel supports guest details, a conditional missing-mobile field, offline messaging, owned resume/history, cursor paging, idempotent sends, cooldown display, private conversation subscription, API reconciliation, and a session-local reply badge. It renders plain text, not message HTML.
- No staff inbox UI, anonymous Auth remote setting change, remote migration, staging action, or deployment was performed.

## Files changed in Phase 3

- Migration: `supabase/migrations/20260920170000_live_chat_customer_intake.sql` (**new; local only**).
- Server: `server/api/chat/status.get.js`, `server/api/chat/me.get.js` (**new**), `server/api/chat/conversations/index.post.js`.
- Application: `app/components/live-chat/Launcher.vue`, `app/composables/useLiveChatClient.js`, `app/utils/liveChat.js` (**new**), `app/layouts/default.vue`; `package.json` and `package-lock.json` now declare the direct `@supabase/supabase-js` dependency.
- Tests: `tests/live-chat-customer-ui.test.mjs` (**new**), `tests/live-chat-transactions.test.mjs`.
- Documentation: `PROJECT_STATE.md`, `CODEX_HANDOFF.md`. `AGENTS.md` unchanged.

## Checks and verified behavior

- `node --test tests/*.test.mjs`: **107 passed, 0 failed**. New tests cover offline/online intake based on agent lease and override, atomic first-message failure/retry, a service-role write without direct Auth-schema access, message reconciliation deduplication/order, contact requirements, and cooldown calculations.
- `npm run typecheck`: passed. `npm run build`: passed. `git diff --check`: passed. The locally built storefront returned HTTP 200, while unauthenticated `/api/chat/me` and `/api/chat/conversations` returned HTTP 401. No lint script exists.
- **VERIFIED locally:** The third migration loads in PGlite and produces offline intake with no eligible lease. A failed first message rolls back the conversation, while retrying saved keys returns the same rows. The service-role path works while its `auth` schema grant remains absent. The customer component and routes compile. Browser code does not instantiate a guest Auth client or a Realtime channel on initial page load.
- **NOT VERIFIED:** Real anonymous Auth, authenticated customer/guest HTTP requests, actual private Realtime subscription and reconnect, browser/mobile rendering, software keyboard, full assistive-technology behavior, live Storage/RLS state, and actual linked-project business-hours behavior. No remote migration or deployment occurred.

## Known issues and decisions

- Chat settings default off, and anonymous Auth is disabled in the linked project. The launcher will stay hidden against current production state. Do not enable Auth or apply migrations outside the later staged phase. Guest sign-in may also require project CAPTCHA configuration; test in isolated staging.
- No agent availability lease writer exists yet, so enabled chat will honestly present an offline message until a later staff/availability phase supplies online leases. `chat_live_available()` enforces current lease plus hours/override; Phase 4 staff UI should show the state clearly.
- Customer Realtime signals contain IDs only; the panel re-fetches through scoped APIs. Realtime membership/delivery and the session-local reply badge need browser testing. Durable read/unread markers, typing/presence, guest-to-account linking, order context, attachments, ticket conversion, settings UI, and full responsive/accessibility review remain later phases.
- The panel never links a guest conversation to a permanent account based on contact text. When the main Auth identity changes, it reloads that actor's scoped history. Guest sessions remain isolated under their own storage key.

## Exact next action — Phase 4, only after “Continue with Phase 4”

Re-read the Phase 4 support/admin requirements and current handoff. Build the staff Live Chat inbox in the existing dashboard using `support.view`, `support.reply`, and `support.manage`; show a paged waiting/active/closed queue, scoped transcript and internal notes, customer contact context without unrelated order data, and claim/transfer/close/reopen actions with expected revisions and clear conflict feedback. Reconcile inbox and the viewed conversation from private ID-only signals without subscribing every staff browser to all message bodies. Validate locally, update state/handoff, and stop before Phase 5. Do not deploy or apply chat migrations remotely in Phase 4.

---

# Previous handoff — Live Chat Phase 2

Date: 2026-09-20. State: **PHASE 2 COMPLETE LOCALLY — awaiting explicit instruction for Phase 3. No remote change.**

## Completed in Phase 2

- Added local additive migration `supabase/migrations/20260920160000_live_chat_transactions.sql`. It creates service-only create/resume, send, limit, and staff-transition functions; row-lock/revision concurrency checks; durable workflow events; and private, committed ID-only Broadcast signals. The Phase 1 migration remains local too.
- Added `server/utils/liveChat.js` and customer/guest `server/api/chat` plus staff `server/api/admin-chat` routes. Actors are verified through Supabase Auth and existing customer/admin records. APIs scope projections and cursor-paged message reads, cap request bodies, validate contacts and UUIDs, and leave service credentials on the server.
- Added focused transaction tests and a local Realtime stub; adjusted the Phase 1 topic test to distinguish database-generated signals from its manually inserted test row. No UI, anonymous Auth setting change, remote migration, or deployment was made.

## Files changed in Phase 2

- Migration: `supabase/migrations/20260920160000_live_chat_transactions.sql` (**new; not remotely applied**).
- Server: `server/utils/liveChat.js` (**new**); ten route files under `server/api/chat/conversations` and `server/api/admin-chat/conversations` (**new**).
- Tests: `tests/live-chat-transactions.test.mjs` (**new**), `tests/live-chat-foundation.test.mjs`, `tests/helpers/resetDatabase.mjs`.
- Documentation: `PROJECT_STATE.md`, `CODEX_HANDOFF.md`. `AGENTS.md` unchanged.

## Checks and verified behavior

- `node --test tests/*.test.mjs`: **102 passed, 0 failed**. Transaction tests cover identity/order checks even on resume, open-chat and key retries, cooldown, twelve-message minute limit, staff permission/assignment, stale claim, transfer, close/reopen, public versus internal Broadcast signals, and browser-role RPC denial.
- `npm run typecheck`: passed. `npm run build`: passed. `git diff --check`: passed. No lint script exists. The locally built Nitro server returned HTTP 401 for unauthenticated customer/staff list and detail routes.
- **VERIFIED locally:** PGlite loads both chat migrations. Scoped database writes are atomic in isolated tests; no internal-note customer signal or body-bearing Broadcast payload is generated. Customer/staff route imports compile and the unauthenticated boundary responds correctly.
- **NOT VERIFIED:** Real Supabase Realtime channels/`realtime.send`, remote grants/policies/Auth shape, live authenticated/anonymous HTTP flows, true parallel database connections, cross-node behavior, production proxy IP identity, or any customer UI. PGlite stubs Auth and Realtime. No migration was remotely applied.

## Known issues and decisions

- Anonymous Auth remains disabled; Phase 3's guest client cannot work against the linked project yet. Enable it only after a staging policy/API audit and a deliberate setting change. Guest contact values are unverified and confer no order access.
- Shared actor limits are five new conversations/hour and twelve customer/guest messages/minute, plus the saved configurable cooldown and a 15-second identical-body check. New anonymous sessions can change actor ID and bypass these actor-only counters. Do not claim complete guest abuse protection; add trusted proxy/network controls and load testing before production.
- Settings remain disabled by default. Availability/business hours and offline intake are later work. Client Realtime subscriptions/reconciliation do not exist yet. The Phase 2 trigger uses private `realtime.send`; verify the linked project's function and private channel policies in isolated staging before rollout. No attachments are accepted through chat APIs yet.
- `chat_events` captures current create/claim/transfer/close/reopen and public staff reply operations. Later phases will add controlled identity, order, and ticket events. Internal notes remain staff-only in APIs and signals.

## Exact next action — Phase 3, only after “Continue with Phase 3”

Re-read the Phase 3 and customer UX portions of the master specification. Build the floating customer launcher and responsive panel using the new scoped APIs; create a separate anonymous guest Supabase client/session only on chat start; support contact intake, signed-in prefill, safe resume/history, offline intake messaging, customer message composer cooldown, and API-based transcript reconciliation. Do not build the staff inbox UI or start a remote migration/deployment in Phase 3. Validate the customer flows locally, update state/handoff, and stop before Phase 4.

---

# Previous handoff — Live Chat Phase 1

Date: 2026-09-20. State: **PHASE 1 COMPLETE LOCALLY — awaiting explicit instruction for Phase 2. No remote change.**

## Completed in Phase 1

- Created additive local migration `supabase/migrations/20260920150000_live_chat_foundation.sql`: eight private chat tables, defaults/constraints/indexes, private chat Storage bucket metadata, customer/guest identity compatibility, conversation/message guards, private Realtime topic read authorization, and system reset integration. The migration has not been pushed or applied outside isolated PGlite tests.
- Hardened the existing customer boundary: `server/utils/customerRequest.js` requires an active permanent profile, and `app/middleware/customer-auth.ts` rejects missing/inactive/anonymous profiles. The migration skips customer profile creation for anonymous Auth users and denies their browser profile writes. Anonymous sign-ins remain disabled locally and remotely unchanged.
- Updated reset allowlists and private-file cleanup. Added focused security/schema tests and expanded reset tests. No chat API, claim/send RPC, Broadcast trigger, UI, remote Supabase setting, or VPS deployment was added.
- Static authenticated-role audit found the customer-profile path above; existing order and order-message reads are owner scoped, support ticket tables/RPCs deny browser roles, and admin operations use active staff permissions. The public `site_settings` table was not reused for private chat controls. This audit does not replace a live Supabase policy check.

## Files changed

- Migration: `supabase/migrations/20260920150000_live_chat_foundation.sql` (**new; not remotely applied**).
- Application/server: `app/middleware/customer-auth.ts`, `server/utils/customerRequest.js`, `server/utils/systemReset.js`, `server/utils/systemResetScopes.js`.
- Tests: `tests/live-chat-foundation.test.mjs` (**new**), `tests/helpers/resetDatabase.mjs`, `tests/system-reset-database.test.mjs`, `tests/system-reset.test.mjs`.
- Documentation: `PROJECT_STATE.md`, `CODEX_HANDOFF.md`. `AGENTS.md` was unchanged.

## Checks and verified behavior

- `node --test tests/*.test.mjs`: **96 passed, 0 failed**. New tests cover private-table denial, anonymous profile forgery, private topic access by customer/guest/staff, disabled staff, owned order/ticket linkage, open-conversation uniqueness, sender/visibility/idempotency constraints, private bucket metadata, and reset preservation/cleanup.
- `npm run typecheck`: passed. `npm run build`: passed with existing non-blocking sourcemap warnings. `git diff --check`: passed. No lint script is configured.
- **VERIFIED locally:** The migration loads in the isolated PGlite database and leaves chat disabled. Customer/guest identity and RLS rules, direct browser-role denial, reset allowlist/manifest, and database constraints behave as tested. The customer account middleware and server helper compile and build.
- **NOT VERIFIED:** Actual Supabase Realtime channel joins/policies, remote Auth setting or `auth.users` shape, live private Storage policies, guest sign-in, authenticated browser flows, quota, true concurrent agent claims, cooldown/rate-limit enforcement, and any chat UI/API. PGlite stubs Auth/Realtime infrastructure; staging must verify the real services. Existing support Storage manual acceptance is also still outstanding.

## Known issues and decisions

- Enabling anonymous Auth is project-wide because anonymous users receive the `authenticated` role. It remains disabled. Inspect actual remote grants/policies and Auth configuration before enabling it in a disposable staging project. The migration expects `auth.users.is_anonymous` and `realtime.messages`/`realtime.topic()`, matching current Supabase documentation; verify the target project before application.
- Private Realtime authorization is checked on join/token refresh, and other remote permissive policies could broaden access. The Phase 1 policy alone cannot establish current remote isolation. No customer-sensitive bodies should be broadcast in Phase 2.
- The database schema prepares cooldown, rates, audit, reads, and assignment, but their transactional operations are not yet implemented. The provisional business timezone is `Africa/Cairo` and hours are Sunday–Thursday 09:00–18:00; confirm before staging. The chat setting defaults to off.

## Exact next action — Phase 2, only after “Continue with Phase 2”

Re-read Phase 2 requirements and the current repository/handoff. Build actor authentication for permanent customer, separate anonymous guest, and authorized staff; create scoped chat APIs and service-only transaction RPCs for create/resume, send, claim/transfer/close; enforce 4-second default cooldown and shared abuse limits; emit only committed private Broadcast signals; write focused ownership, idempotency, race, and reconnect-oriented tests. Do not begin customer launcher or inbox UI, enable anonymous Auth remotely, apply this migration remotely, or deploy. Run the suite/typecheck/build/diff checks, update state/handoff, and stop before Phase 3.

---

# Previous handoff — Live Chat Phase 0

Date: 2026-09-20. State: **PHASE 0 COMPLETE — inspection and architecture only. Awaiting explicit instruction to continue with Phase 1.**

## Phase 0 result

- Read the complete 1,256-line Live Chat master specification and inspected Nuxt configuration, layouts, customer and staff auth, profile/order schema, ticket/Help Center/Messages/CRM flows, settings, Storage, Realtime usage, RLS, server routes, tests, reset integration, `AGENTS.md`, and prior project/handoff state. `git status --porcelain` was empty before this documentation update.
- The proposed architecture, reuse map, database tables, private Realtime topics, authorization model, guest identity, assignment/read models, cooldown and abuse limits, attachments, ticket/order integration, availability, quota considerations, risks, decisions, and final phases are recorded at the top of `PROJECT_STATE.md`.
- No chat feature code, SQL migration, external setting, remote database action, or deployment was created/performed. The only Phase 0 files changed are `PROJECT_STATE.md` and `CODEX_HANDOFF.md`.
- Validation: repository inspection, official Supabase documentation review, and `git diff --check` passed. No test, typecheck, or build run was needed for a documentation-only phase. Existing test results later in this file describe earlier releases, not Phase 0 validation.
- **Verified:** existing ticket and order systems, support permission keys, service-role API pattern, private ticket bucket, public `site_settings` rows, no existing chat Realtime subscriptions, anonymous Auth disabled in local config, and email-required customer-profile trigger.
- **Not verified:** current remote Auth/Realtime settings, Storage policies, Supabase plan/quota, manual authenticated flows, proposed anonymous-Auth compatibility, new RLS policies, and any Live Chat behavior.
- **Known decision:** anonymous Auth is the preferred guest identity for private Realtime. Enabling it is project-wide and requires a full `authenticated` policy/API audit and explicit review before staging or production changes. Confirm operating timezone/hours, offline default, and retention before their staging rollout. The proposal defaults chat disabled, manual assignment, offline conversations, and a 4-second customer send delay.

## Exact next action — Phase 1, only after the user says “Continue with Phase 1”

1. Re-read the Phase 1 and security requirements in the attached master specification; inspect current `git status`, this handoff, and the Live Chat section of `PROJECT_STATE.md`.
2. Audit existing authenticated-role RLS/grants and customer APIs for anonymous-user exposure. Draft local additive migrations for the proposed chat schema, validated default settings, RLS and private topic authorization, guest profile-trigger compatibility, indexes and reset integration. Do not enable anonymous sign-ins remotely or apply any migration to production.
3. Add focused isolated database tests for defaults, grants/RLS, topic membership, identity boundaries, constraints, assignment concurrency foundations, and reset behavior. Run relevant tests, Nuxt typecheck/build if application code changes, and `git diff --check`. Update state/handoff with exact results and stop before Phase 2.

---

# Previous handoff — Help Center and customer support

Date: 2026-09-20. State: **linked Supabase migrations and VPS application deployed; manual acceptance still required**.

## Work completed

The interrupted run had already connected public, customer, and admin screens to the new APIs and validated the migration in PGlite. It had confirmed another customer's ticket/order is rejected, draft articles are hidden, and direct public access to ticket tables/functions is denied. The full-suite integration failure was the fail-closed system reset allowlist. That allowlist and private-file cleanup were already patched, with targeted reset tests passing, when work resumed.

After resuming, I reviewed the complete feature, added integration tests for content/full reset and negative authorization cases, denied private-file downloads by disabled customers, restricted assignment to reply-capable staff, corrected staff-facing ticket status labels, made the date-to filter include the whole chosen day, stopped Help Center listings from fetching article bodies, and clarified the article load-error state. No remote database write or VPS deployment occurred.

In the current staging-readiness pass, I removed raw database error text from the shared customer/admin authentication responses, added customer unread-reply tracking and a staff needs-attention count, showed existing payment/shipment state in ticket details, and enabled the standard Nuxt typecheck. The existing feature was not redesigned. No remote database write or VPS deployment occurred.

## Files changed in this staging-readiness pass

- App: `app/components/account/Navigation.vue`, `app/middleware/customer-auth.ts`, `app/pages/account/support/index.vue`, `app/pages/account/support/[id].vue`, `app/pages/dashboard/support/index.vue`, `app/pages/dashboard/support/[id].vue`.
- Server: `server/api/admin-support/tickets/index.get.js`, `server/api/admin-support/tickets/[id].get.js`, `server/api/support/tickets/index.get.js`, `server/api/support/tickets/[id]/read.patch.js`, `server/api/support/unread.get.js`, `server/utils/adminRequest.js`, `server/utils/customerRequest.js`, `server/utils/requestDatabaseError.js`, `server/utils/supportTickets.js`.
- Database/tests/config/docs: `supabase/migrations/20260920120000_support_unread_replies.sql`, `tests/help-support-database.test.mjs`, `tests/request-database-error.test.mjs`, `package.json`, `package-lock.json`, `nuxt.config.ts`, `PROJECT_STATE.md`, `CODEX_HANDOFF.md`.

## Changed files

### Application

- `app/components/account/Navigation.vue`
- `app/middleware/customer-auth.ts`
- `app/components/layout/Footer.vue`
- `app/components/layout/TopBar.vue`
- `app/components/support/Conversation.vue`
- `app/composables/useSupportClient.js`
- `app/pages/account/support/index.vue`
- `app/pages/account/support/[id].vue`
- `app/pages/dashboard/help.vue`
- `app/pages/dashboard/support/index.vue`
- `app/pages/dashboard/support/[id].vue`
- `app/pages/help/index.vue`
- `app/pages/help/[category]/[slug].vue`
- `app/utils/adminPermissions.js`
- `app/utils/dashboardNavigation.js`
- `app/utils/support.js`

### Server

- `server/api/admin-help/categories/index.get.js`
- `server/api/admin-help/categories/index.post.js`
- `server/api/admin-help/categories/[id].patch.js`
- `server/api/admin-help/articles/index.get.js`
- `server/api/admin-help/articles/index.post.js`
- `server/api/admin-help/articles/[id].patch.js`
- `server/api/admin-help/articles/[id].delete.js`
- `server/api/admin-support/assignees.get.js`
- `server/api/admin-support/tickets/index.get.js`
- `server/api/admin-support/tickets/[id].get.js`
- `server/api/admin-support/tickets/[id].patch.js`
- `server/api/admin-support/tickets/[id]/messages.post.js`
- `server/api/admin-support/tickets/[id]/attachments.post.js`
- `server/api/help/index.get.js`
- `server/api/help/[category]/[slug].get.js`
- `server/api/support/orders.get.js`
- `server/api/support/unread.get.js`
- `server/api/support/attachments/[id].get.js`
- `server/api/support/tickets/index.get.js`
- `server/api/support/tickets/index.post.js`
- `server/api/support/tickets/[id].get.js`
- `server/api/support/tickets/[id].patch.js`
- `server/api/support/tickets/[id]/read.patch.js`
- `server/api/support/tickets/[id]/messages.post.js`
- `server/api/support/tickets/[id]/attachments.post.js`
- `server/utils/helpCenter.js`
- `server/utils/adminRequest.js`
- `server/utils/customerRequest.js`
- `server/utils/requestDatabaseError.js`
- `server/utils/sitePages.js`
- `server/utils/supportTickets.js`
- `server/utils/systemReset.js`
- `server/utils/systemResetScopes.js`

### Database, tests, and documentation

- `supabase/migrations/20260919120000_help_center_support.sql`
- `supabase/migrations/20260920120000_support_unread_replies.sql`
- `nuxt.config.ts`
- `package.json`
- `package-lock.json`
- `tests/help-support-database.test.mjs`
- `tests/request-database-error.test.mjs`
- `tests/site-pages.test.mjs`
- `tests/system-reset-database.test.mjs`
- `tests/system-reset.test.mjs`
- `PROJECT_STATE.md`
- `CODEX_HANDOFF.md`

## Database migration

`20260919120000_help_center_support.sql` creates the Help Center and support tables, indexes, constraints, private Storage bucket, service-role-only ticket RPCs, RLS policies, initial categories, audit triggers, and reset integration. `20260920120000_support_unread_replies.sql` adds customer read timestamps, an unread index, and service-role-only unread count functions. Both execute in the PGlite test helper against the full schema/migration chain. On 2026-09-20, `supabase db push --linked` applied both to linked project `zsqhuwgoasrexdnamlks`; `supabase migration list --linked` then confirmed matching local/remote versions. The CLI's Docker catalog-cache warning was non-fatal.

## VPS deployment

On 2026-09-20, `npm run deploy:check` confirmed the exact `newelcomputer` user, `/home/newelcomputer/htdocs/new.elcomputer.net` directory, and `new-elcomputer` PM2 process. All 77 tests and `npm run typecheck` passed before `npm run deploy` built a production release without local secrets and deployed only `.output`. The existing PM2 process restarted and passed the script's internal and public health checks. A transient connection refusal during the first internal health retry cleared on the next check. Public `/`, `/help`, and `/api/help` returned HTTP 200; unauthenticated `/api/support/tickets` returned HTTP 401. The previous output is retained at `/home/newelcomputer/htdocs/new.elcomputer.net/.output-deploy-backup-20260919-232824-9073`. No other site or shared service was restarted.

## Checks and limits

- `node --test tests/*.test.mjs`: 77 tests passed, 0 failed. New tests cover unread isolation/internal-note behavior and safe account lookup errors.
- `npm run typecheck`: passed after adding only `typescript`, `vue-tsc`, and `@types/node`. A narrow type annotation in the existing customer middleware and a Node import in Nuxt config resolved prior setup errors without changing runtime behavior.
- `npm run build`: passed after final code changes (non-blocking existing sourcemap warnings only).
- Local built-server smoke before the remote push: private customer, staff, and attachment routes returned 401 without a session. `/api/help` returned 503 against the then-unmigrated linked database; that result is no longer current. No authenticated browser session was available.
- `git diff --check`: passed after final code changes.
- Lint: no script or lint configuration in `package.json`.
- PGlite migration and focused reset/security tests: passing. This is not a live Supabase Storage or browser test.

## Security review and remaining risks

Ticket/order ownership is enforced in server queries and ticket RPCs; IDOR attempts against other customers' tickets/orders are tested. Customer thread reads exclude internal notes, and attachment downloads check the owning ticket and note visibility. Active staff permissions are checked server-side. All new tables have RLS; direct ticket grants and direct RPC execute rights are denied to browser roles. Public Help Center reads require published articles and active categories. Service-role use is server-only. Text, UUIDs, article slugs, file size/type/signatures, and database states have validation; Markdown goes through the existing HTML-escaping renderer. Idempotency keys limit duplicate tickets/messages.

Customer unread counts are computed only for the authenticated customer. Browser roles cannot query private ticket tables or execute the unread functions, and the read endpoint first verifies ticket ownership and updates only customer-visible staff messages in that ticket. Staff needs-attention counts require `support.view` and use new/open or waiting-for-support tickets; internal notes do not change that state or customer unread state. Shared authentication failures return generic 500 responses while keeping diagnostic database text in server logs.

Residual risks: actual remote Storage policies/configuration differ from the PGlite stub until inspected; multipart parsing buffers chunked uploads before the 5 MiB post-parse check, so the VPS reverse proxy needs a request-body limit. V1 indicators refresh on page load, not by live polling or email. No rate limiting, malware scanning, or automated browser E2E suite exists. The migrations and application are deployed, but live Storage behavior and authenticated UI flows remain unverified. No lint configuration exists.

## Exact manual acceptance checks after deployment

1. Both migrations are already applied to the linked Supabase project. Confirm all six tables, RPC grants, RLS policies, unread index/functions, and the private `support-attachments` bucket in that project. Confirm no existing broad `storage.objects` policy grants direct access to that bucket. Use a staging/project clone for destructive reset tests.
2. In staging, create a published and a draft article. As an anonymous visitor, search and open the published article; confirm the draft and archived article are absent from the page **and** direct API/database reads. Check Markdown links and hostile HTML render safely.
3. Sign in as Customer A and Customer B. Create a ticket for A, optionally linked to A's order. Try B's order ID during A's creation, then try B's session against A's list/detail/reply/status/attachment URLs. All cross-customer attempts must fail without returning ticket data.
4. As staff with `support.view` only, read but do not reply/manage. Test `support.reply` and `support.manage` separately, including a disabled admin account. Add an internal note and file; confirm the customer API and browser never reveal either. Test assignment only to eligible staff. Confirm new/customer-replied tickets increase the staff needs-attention count, and a public staff reply removes that ticket from the attention queue.
5. Upload and download each allowed file type; reject a >5 MiB file, a mismatched MIME/signature, another ticket's file, a disabled customer's file, and a direct public Storage URL. Check network responses and server logs for stack traces or leaked credentials.
6. With two customer accounts, verify that a public staff reply adds a New reply badge only to the owning customer's ticket and account navigation. Opening the conversation clears only the visible replies; an internal note creates no badge. Try one customer's token against another customer's unread/read URLs. Confirm direct RPC access is denied to browser roles.
7. Close and reopen a ticket within seven days, then test the expired-window behavior. Verify ticket event history, status labels, search filters, date range, payment status, and shipment/preparation context from existing order records. Verify desktop/mobile layouts, keyboard focus, and browser console/network errors.
8. In a **disposable staging database only**, exercise content reset (articles/categories deleted, tickets preserved) and full reset (support rows and captured private objects removed, unrelated buckets and new uploads untouched). Never use production reset as a smoke test.
9. Confirm `npm ci`, `npm run typecheck`, tests, and build pass in staging CI. The scoped VPS deployment is already live; retain the backup until authenticated checks pass.

Recommended next action: complete live database/Storage inspection and authenticated manual security acceptance. No additional feature work is needed before those checks.

## Customer account redesign — deployed in the current release

This redesign is deployed to `new.elcomputer.net`. It preserves the site's blue storefront branding and the existing Help Center/ticket backend. A single `app/layouts/account.vue` owns the account identity, navigation, logout, and responsive frame. `app/components/account/Navigation.vue` uses real Overview, Orders, Messages, Support, Wallet, and Profile routes. Orders has real filters, paginated order cards, product snapshots, and a detail route. `app/components/account/OrderCard.vue`, `OrderProgress.vue`, and `app/utils/accountOrders.js` share status, payment, date, and money presentation. The progress component deliberately shows only placed/current state because no per-status history exists.

Changed account files: `app/pages/account/index.vue`, `messages.vue`, `support/index.vue`, `support/[id].vue`, `orders/index.vue`, `orders/[id].vue`, `wallet.vue`, `profile.vue`, `app/layouts/account.vue`, `app/components/account/Navigation.vue`, `OrderCard.vue`, `OrderProgress.vue`, `app/utils/accountOrders.js`, storefront order links in `app/pages/index.vue` and `app/components/layout/NavBar.vue`, `server/api/account/orders/[id].get.js`, `server/api/support/orders.get.js`, and `tests/account-orders.test.mjs`. The separate profile guard adds `supabase/migrations/20260920130000_guard_customer_profile_fields.sql` and `tests/customer-profile-guard.test.mjs`.

The order detail endpoint verifies the bearer token and active customer, validates the order ID, filters by both ID and `user_id`, and only then reads related items and selected courier fields. Existing customer order/item RLS remains unchanged. The support order picker can include an older order only after an ownership-scoped lookup. There are no fake tracking links, invoices, refund buttons, wallet transactions, or delivery dates.

Earlier validation on 2026-09-20: 81 repository tests, `npm run typecheck`, `npm run build`, and `git diff --check` passed. The original local Nuxt dev worker returned HTTP 500 with `worker exited with code 0` on both `/` and `/account`; its exact exit cause is unproven. Stopping only that process and starting a fresh dev server restored `/` to HTTP 200, unauthenticated account pages to login redirects, and the private order API to HTTP 401. A separate local run of the built production server returned the same expected statuses. No lint script exists. Authenticated desktop/mobile visual checks, browser console review, live customer order/payment/shipment verification, profile editing, and support-ticket flows remain manual because no customer test session was available.

Profile security: existing `customer_profiles` RLS allowed a customer to update `wallet_balance` and `is_active` on their own row. Migration `20260920130000_guard_customer_profile_fields.sql` now rejects those changes for `authenticated`/`anon` roles, including forged inserts, while preserving trusted service-role writes and safe customer profile edits. Isolated PGlite role tests passed. A linked dry run showed exactly this one pending migration; `supabase db push --linked --yes` applied it, and `supabase migration list --linked` showed matching local/remote version `20260920130000` on project `zsqhuwgoasrexdnamlks`. The Docker cache warning after push did not prevent application. The migration changes the live database, not the VPS app. The profile table still grants owners broad access to other fields such as email and timestamps, so a complete column-permission hardening review and live authenticated profile/disabled-account acceptance remain before deploying the UI.

Account loading follow-up (deployed): The `useSupabaseUser()` value is JWT claims (`sub`), not a Supabase User object (`id`). This caused Overview's “Loading your orders…” to persist because its loader returned while `loading` remained true. The account overview, orders, wallet, profile, layout, support conversation identity, and login profile lookup normalize the ID through `app/utils/accountSession.js`; the route guard checks verified claims. Requests have finite timeouts, and failed reads no longer present misleading empty orders or zero balances. Session normalization/fallback/timeout tests pass. Wallet history is absent because the schema records only the current balance, not credits and debits; the customer-facing text was simplified. Authenticated browser acceptance is still required.

### Customer-account Classic/Modern release — 2026-09-20

Admin `/dashboard/settings?tab=account-dashboard` now controls `site_settings.account_dashboard_style`. Migration `20260920140000_customer_account_appearance.sql` defaults to Modern and allows only Classic/Modern. Classic retains the preceding account interior; Modern follows the reference's information hierarchy with grouped navigation, purchase history, wallet balance, profile details, messages, and support. Unsupported features were omitted, and the store header was not changed. The public `/api/storefront/account-appearance` endpoint is uncached. Files added: `app/composables/useAccountAppearance.js`, `server/api/storefront/account-appearance.get.js`, the migration, and `tests/account-dashboard-theme.test.mjs`. Files changed: `app/layouts/account.vue`, `app/components/account/Navigation.vue`, `app/pages/account/index.vue`, `app/pages/dashboard/settings.vue`, and `app/utils/dashboardSettings.js`.

All 88 tests, Nuxt typecheck, production build, and diff check passed. The linked dry run listed only `20260920140000`; it was applied once, and `supabase migration list --linked` confirmed local/remote parity. The built local API and live public API returned `modern`. `npm run deploy:check` confirmed exact user, site directory, PM2 process, and health before and after `npm run deploy`. Deployment restarted only `new-elcomputer`, retained backup `/home/newelcomputer/htdocs/new.elcomputer.net/.output-deploy-backup-20260920-172753-15422`, and passed internal/public health. Afterward public `/` and the appearance API returned 200; anonymous account pages redirected to login. PM2 was online in fork mode with the expected cwd/entry, and its error log had not changed since restart. Signed-in customer pages, mobile appearance, browser console/network, and an actual admin Classic→Modern save remain unverified; test these before treating visual acceptance as complete.
