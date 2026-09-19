# Project state — 2026-09-20

## Help Center and customer support

The Help Center and support-ticket implementation is present locally. It is **not deployed**. The linked Supabase project has migrations through `20260914200000`; `20260919120000_help_center_support.sql` is local-only.

### Architecture

- Public `/help` and `/help/[category]/[slug]` pages use server APIs backed by PostgreSQL full-text search. Categories are database-managed. Only active categories and published articles are returned publicly. Article bodies use the existing safe Markdown renderer.
- `/dashboard/help` manages categories and draft, published, or archived articles. `help.view` controls reading; `help.edit` controls changes. Archiving is the safe delete action.
- `/account/support` and `/account/support/[id]` let authenticated customers create, list, reply to, close, and recently reopen their own tickets. An order link is optional and verified against `customer_orders.user_id`.
- `/dashboard/support` and `/dashboard/support/[id]` let authorized staff search, filter, read, reply, add internal notes, change status/priority, and assign tickets. Existing `admin_users` and admin permissions are reused. Existing CRM support records are separate.
- Ticket assignment is limited to active staff with reply permission (or the owner), so a view-only account cannot become the assignee.
- Customer and admin APIs are under `server/api/support`, `server/api/admin-support`, `server/api/help`, and `server/api/admin-help`. `server/utils/supportTickets.js` handles ownership, threads, uploads, and downloads; `server/utils/helpCenter.js` validates article/category input.
- `app/composables/useSupportClient.js` sends the signed-in user's access token. The Supabase service-role key stays in server runtime configuration and is never returned to the browser.

### Database and security

The local migration creates `help_categories`, `help_articles`, `support_tickets`, `support_ticket_messages`, `support_ticket_attachments`, and `support_ticket_events`, with foreign keys, constraints, indexes, and timestamp/history triggers. Ticket states are open, in progress, waiting for customer, waiting for support, resolved, and closed. Priority is staff-controlled. An event table records creation, status, priority, and assignment changes.

RLS is enabled on all six tables. Public roles can select only active help categories and published articles in active categories. They have no grants or policies for ticket tables. Ticket-write RPCs have execution revoked from public, anon, and authenticated roles; server APIs call them with service role only after verifying the bearer token and authorization. Customer APIs scope ticket and order reads by authenticated user ID. Customer responses exclude internal notes and attachments on those notes. Staff APIs require `support.view`, `support.reply`, or `support.manage` as appropriate. Attachment downloads check ticket ownership or active staff permission, and deny disabled customers. The `support-attachments` Storage bucket is private; application APIs use server-side download after authorization. File types are PDF, TXT, JPG, PNG, and WebP, with a 5 MiB file limit and signature checks. Multipart parsing still buffers the request; configure an appropriate reverse-proxy body limit before production.

The migration also updates the full-system-reset allowlist and captures existing private support object paths in the reset manifest. Full reset deletes support rows and then removes only captured support files. Content reset removes Help Center content while preserving tickets and their conversation. Both behaviors were tested in an isolated PGlite database.

### Notifications and future integration

V1 offers in-app ticket lists and status changes, not push, email, or unread badges. Ticket events and `last_reply_at` give a basis for later notifications. Order linkage uses the existing website order ID, so a future ERP view can join through the existing order/ERP mapping rather than duplicating ERP data. Article helpfulness feedback and email notifications are Phase 2.

### Validation state

- Verified: the full migration applies in an isolated PostgreSQL-compatible PGlite database; ownership, RLS/grant denial, draft visibility, staff permissions, ticket history, private bucket metadata, and reset behavior are covered by database tests.
- Verified: repository test suite and production build pass (see `CODEX_HANDOFF.md` for counts and commands).
- Not verified: production Supabase migration, live Storage policies, authenticated browser workflows, real file upload/download, and VPS behavior. No remote writes or deployment were performed.
- A local built-server smoke returned 401 for unauthenticated private APIs. The public Help API returned 503 against the unmigrated linked database, while `/help` rendered its error state; this is expected until the migration is applied.
- Unavailable in this repository: lint script; Nuxt typecheck needs missing `typescript` and `vue-tsc` dev dependencies. Build compilation is not a substitute for a typecheck.

Before production deployment, apply the migration in a reviewed database maintenance window, verify the private bucket and policies on the actual Supabase project, then perform the manual acceptance checks in `CODEX_HANDOFF.md`. Do not deploy the application before the migration.
