# Codex handoff — Help Center and customer support

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

## Customer account redesign — separate local work

This redesign is **not deployed**. It preserves the site's blue storefront branding and the existing Help Center/ticket backend. A single `app/layouts/account.vue` now owns the account identity, navigation, logout, and responsive frame. `app/components/account/Navigation.vue` uses real Overview, Orders, Messages, Support, Wallet, and Profile routes. Overview is compact; Orders has real filters, paginated order cards, product snapshots, and a detail route. `app/components/account/OrderCard.vue`, `OrderProgress.vue`, and `app/utils/accountOrders.js` share status, payment, date, and money presentation. The progress component deliberately shows only placed/current state because no per-status history exists.

Changed account files: `app/pages/account/index.vue`, `messages.vue`, `support/index.vue`, `support/[id].vue`, `orders/index.vue`, `orders/[id].vue`, `wallet.vue`, `profile.vue`, `app/layouts/account.vue`, `app/components/account/Navigation.vue`, `OrderCard.vue`, `OrderProgress.vue`, `app/utils/accountOrders.js`, storefront order links in `app/pages/index.vue` and `app/components/layout/NavBar.vue`, `server/api/account/orders/[id].get.js`, `server/api/support/orders.get.js`, and `tests/account-orders.test.mjs`. The separate profile guard adds `supabase/migrations/20260920130000_guard_customer_profile_fields.sql` and `tests/customer-profile-guard.test.mjs`.

The order detail endpoint verifies the bearer token and active customer, validates the order ID, filters by both ID and `user_id`, and only then reads related items and selected courier fields. Existing customer order/item RLS remains unchanged. The support order picker can include an older order only after an ownership-scoped lookup. There are no fake tracking links, invoices, refund buttons, wallet transactions, or delivery dates.

Validation on 2026-09-20: 81 repository tests, `npm run typecheck`, `npm run build`, and `git diff --check` pass. The original local Nuxt dev worker returned HTTP 500 with `worker exited with code 0` on both `/` and `/account`; its exact exit cause is unproven. Stopping only that process and starting a fresh dev server restored `/` to HTTP 200, unauthenticated account pages to login redirects, and the private order API to HTTP 401. A separate local run of the built production server returned the same expected statuses. No lint script exists. Authenticated desktop/mobile visual checks, browser console review, live customer order/payment/shipment verification, profile editing, and support-ticket flows are still manual because no customer test session was available. Do not deploy this local redesign until those checks are accepted.

Profile security: existing `customer_profiles` RLS allowed a customer to update `wallet_balance` and `is_active` on their own row. Migration `20260920130000_guard_customer_profile_fields.sql` now rejects those changes for `authenticated`/`anon` roles, including forged inserts, while preserving trusted service-role writes and safe customer profile edits. Isolated PGlite role tests passed. A linked dry run showed exactly this one pending migration; `supabase db push --linked --yes` applied it, and `supabase migration list --linked` showed matching local/remote version `20260920130000` on project `zsqhuwgoasrexdnamlks`. The Docker cache warning after push did not prevent application. The migration changes the live database, not the VPS app. The profile table still grants owners broad access to other fields such as email and timestamps, so a complete column-permission hardening review and live authenticated profile/disabled-account acceptance remain before deploying the UI.

Account loading follow-up (local only): The `useSupabaseUser()` value is JWT claims (`sub`), not a Supabase User object (`id`). This caused Overview's “Loading your orders…” to persist because its loader returned while `loading` remained true. The account overview, orders, wallet, profile, layout, support conversation identity, and login profile lookup now normalize the ID through `app/utils/accountSession.js`; the route guard checks verified claims. Requests have finite timeouts, and failed reads no longer present misleading empty orders or zero balances. The full suite now has 86 passing tests, including session normalization/fallback/timeout. Wallet history is absent because the schema records only the current balance, not credits and debits; the customer-facing text was simplified. This fix needs no Supabase migration and has not been deployed to the VPS. Authenticated browser acceptance is still required.
