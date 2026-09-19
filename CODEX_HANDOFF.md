# Codex handoff — Help Center and customer support

Date: 2026-09-20. State: **local implementation validated; not deployed; manual acceptance still required**.

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

`20260919120000_help_center_support.sql` creates the Help Center and support tables, indexes, constraints, private Storage bucket, service-role-only ticket RPCs, RLS policies, initial categories, audit triggers, and reset integration. `20260920120000_support_unread_replies.sql` adds customer read timestamps, an unread index, and service-role-only unread count functions. Both execute in the PGlite test helper against the full schema/migration chain. Read-only `supabase migration list --linked` confirms **both remain unapplied** to the linked remote project. Neither migration was pushed in this pass. Do not deploy the app ahead of both migrations.

## Checks and limits

- `node --test tests/*.test.mjs`: 77 tests passed, 0 failed. New tests cover unread isolation/internal-note behavior and safe account lookup errors.
- `npm run typecheck`: passed after adding only `typescript`, `vue-tsc`, and `@types/node`. A narrow type annotation in the existing customer middleware and a Node import in Nuxt config resolved prior setup errors without changing runtime behavior.
- `npm run build`: passed after final code changes (non-blocking existing sourcemap warnings only).
- Local built-server smoke: private customer, staff, and attachment routes return 401 without a session. `/api/help` returns 503 because the linked database has not received this migration; `/help` renders its error state with HTTP 200. No authenticated browser session was available.
- `git diff --check`: passed after final code changes.
- Lint: no script or lint configuration in `package.json`.
- PGlite migration and focused reset/security tests: passing. This is not a live Supabase Storage or browser test.

## Security review and remaining risks

Ticket/order ownership is enforced in server queries and ticket RPCs; IDOR attempts against other customers' tickets/orders are tested. Customer thread reads exclude internal notes, and attachment downloads check the owning ticket and note visibility. Active staff permissions are checked server-side. All new tables have RLS; direct ticket grants and direct RPC execute rights are denied to browser roles. Public Help Center reads require published articles and active categories. Service-role use is server-only. Text, UUIDs, article slugs, file size/type/signatures, and database states have validation; Markdown goes through the existing HTML-escaping renderer. Idempotency keys limit duplicate tickets/messages.

Customer unread counts are computed only for the authenticated customer. Browser roles cannot query private ticket tables or execute the unread functions, and the read endpoint first verifies ticket ownership and updates only customer-visible staff messages in that ticket. Staff needs-attention counts require `support.view` and use new/open or waiting-for-support tickets; internal notes do not change that state or customer unread state. Shared authentication failures return generic 500 responses while keeping diagnostic database text in server logs.

Residual risks: actual remote Storage policies/configuration differ from the PGlite stub until inspected; multipart parsing buffers chunked uploads before the 5 MiB post-parse check, so the VPS reverse proxy needs a request-body limit. V1 indicators refresh on page load, not by live polling or email. No rate limiting, malware scanning, or automated browser E2E suite exists. The live migrations and authenticated UI flows remain unverified. No lint configuration exists.

## Exact manual acceptance checks before deployment

1. Back up the linked Supabase database, review both pending migration SQL files, and apply them **in order to a staging/project clone first**. Confirm all six tables, RPC grants, RLS policies, unread index/functions, and the private `support-attachments` bucket. Confirm no existing broad `storage.objects` policy grants direct access to that bucket.
2. In staging, create a published and a draft article. As an anonymous visitor, search and open the published article; confirm the draft and archived article are absent from the page **and** direct API/database reads. Check Markdown links and hostile HTML render safely.
3. Sign in as Customer A and Customer B. Create a ticket for A, optionally linked to A's order. Try B's order ID during A's creation, then try B's session against A's list/detail/reply/status/attachment URLs. All cross-customer attempts must fail without returning ticket data.
4. As staff with `support.view` only, read but do not reply/manage. Test `support.reply` and `support.manage` separately, including a disabled admin account. Add an internal note and file; confirm the customer API and browser never reveal either. Test assignment only to eligible staff. Confirm new/customer-replied tickets increase the staff needs-attention count, and a public staff reply removes that ticket from the attention queue.
5. Upload and download each allowed file type; reject a >5 MiB file, a mismatched MIME/signature, another ticket's file, a disabled customer's file, and a direct public Storage URL. Check network responses and server logs for stack traces or leaked credentials.
6. With two customer accounts, verify that a public staff reply adds a New reply badge only to the owning customer's ticket and account navigation. Opening the conversation clears only the visible replies; an internal note creates no badge. Try one customer's token against another customer's unread/read URLs. Confirm direct RPC access is denied to browser roles.
7. Close and reopen a ticket within seven days, then test the expired-window behavior. Verify ticket event history, status labels, search filters, date range, payment status, and shipment/preparation context from existing order records. Verify desktop/mobile layouts, keyboard focus, and browser console/network errors.
8. In a **disposable staging database only**, exercise content reset (articles/categories deleted, tickets preserved) and full reset (support rows and captured private objects removed, unrelated buckets and new uploads untouched). Never use production reset as a smoke test.
9. Confirm `npm ci`, `npm run typecheck`, tests, and build pass in staging CI; then make a separate decision about production migration and the scoped VPS deployment. Do not deploy from this handoff automatically.

Recommended next action: complete staging migration and manual security acceptance, then make a separate deployment decision. No additional feature work is needed before those checks.
