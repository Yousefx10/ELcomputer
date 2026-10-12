# Milestone 3 integration, 2026-10-12

The [operator CLI](installation-cli.md) now calls these unchanged primitives
after strict target/source verification, leases, history adoption and private
bucket creation. Local tests use actual Auth Admin HTTP and Storage services,
including lost responses and promotion recovery. Migration 71 and its frozen
certificate remain unchanged; no additional SQL migration was needed.
Hosted and VPS acceptance remains deferred. The Milestone 2 contract follows.

# Phase 3, Milestone 2: portability and first owner

Migration 71 is `20261012160000_quick_setup_installation_bootstrap.sql`.
Its hash is recorded in `supabase/bootstrap/portability-v1/manifest.json`.
Migration files 1–70, `clean-v1`, the schema reference and guarded deployment
scripts remain unchanged. This milestone makes no production connection.

## Neutral configuration

PDC company/product identifiers can be NULL while unconfigured. Company IDs
must contain 1–40 digits; product IDs retain their positive integer constraint.
Shipping, automatic labels and reverse pickup require both IDs. The migration
adds an unconfigured disabled singleton only if missing. Existing PDC rows,
credentials, caches, controls and timestamps remain untouched. GET preserves
NULL; PATCH accepts an empty disabled draft and rejects incomplete enablement.

Site defaults for future inserts and missing application settings have blank
merchant branding/contact/prose and all payments OFF, including Cash. Saved
rows retain their values. Empty announcements, links, offers and hero arrays
stay empty; empty heroes do not render the built-in promotional scene. No logo
is fabricated for a site without a configured logo. Configured content retains
the current layout and behavior. No catalog/customer/business seed is added.

Claims capture uses a saved, validated HTTPS `site_settings.seo_site_url`, or
the exact operator-bound installation origin. Neither request Host headers nor
a production domain supply a fallback. Valid saved case variants, root slashes
and default HTTPS ports normalize during reads; saved values stay intact.
Missing or malformed origins suppress otherwise eligible intents as
`invalid_template`, preserving existing disabled/provider failure reasons. Existing intents and queues are unchanged.
Workers retain the captured URL and verify its HTTPS origin, locale, UUID and
exact account path; the email renderer accepts those portable captured links.
Template suggestions are generic and disabled. The worker never silently
rebinds a historical intent to a changed origin.

SEO has no merchant origin fallback. With no explicitly saved/runtime origin,
pages emit no canonical/alternates/structured data and use noindex. Public
discovery responds unavailable until configured. Saved/runtime origins retain
the existing precedence. `NUXT_PUBLIC_SITE_URL` is blank in the example file.

## Operator authority and journal

`private.installation_bootstrap` is outside the exposed public schema. It has
RLS, explicit schema/table/function revokes for PUBLIC, anon, authenticated and
service_role, and explicit operator grants. Empty definer search paths and
`session_user = postgres` checks require the direct supported migration login.
An already occupied `private` namespace aborts the complete migration; unrelated
private helpers or schema grants are never silently adopted or changed.
Browser/application roles cannot register a request or link an owner, including
through PostgREST. There is no bootstrap API, reusable browser capability,
default identity/password or customer permission shortcut.

The migration seals historical installations, identified before adding a
missing PDC singleton. Only an unused clean target without Auth/admin/business
history and configured providers becomes available. The journal binds the
existing Quick Setup installation UUID, request UUID, target digest, project
reference, HTTPS origin and normalized owner-email digest. Binding is immutable;
revisions increase on each transition. No password, key, credentialed DSN,
provider response or free-form diagnostic enters the journal.

States are `available → registered → auth_started → complete`, with
`sealed_existing` terminal for an upgrade. Competing requests cannot replace
the registered binding. Compare-and-set authorization before HTTP permits one
Auth creation call. For the initial missing PDC seed only, the transaction
returns its first shipping generation to zero while no owner/request/evidence
exists; it never rewrites existing installation generations or history.

## Auth creation and atomic promotion

`scripts/lib/installationBootstrap.mjs` is an operator library, not an installer
CLI or an application import. Its caller supplies the verified target, direct
SQL connection and separate Supabase Auth Admin adapter. Private owner input
includes a password of at least 16 characters and deliberate confirmation.
Identity creation uses `auth.admin.createUser` with `email_confirm: true` and
server-controlled, nonsecret `app_metadata.elcomputer_bootstrap` markers.
`user_metadata` supplies only a display name and never determines authorization.
The library does not insert Auth rows; SQL Auth inserts exist only in fixtures.
The [Auth Admin API](https://supabase.com/docs/reference/javascript/auth-admin-createuser)
is the supported identity boundary.

Owner linking locks the journal and Auth/admin tables. It requires one newly
created, confirmed, nonanonymous Auth subject with exact request markers and
email digest; unrelated identities/profiles/business rows block promotion.
The transaction inserts an active `admin_users` owner with every current
permission-catalog key true, writes the activity audit, and permanently
completes the journal. Existing Auth/profile/admin triggers mark the owner's
profile internal. No ordinary customer is imported or created separately.
Audit/promotion failure rolls back owner/audit/completion together.

After an interrupted Auth call, creation is never automatically repeated.
A bounded Admin listing reconciles only one exactly marked subject; SQL
rechecks authoritative rows. Missing results, duplicate email/subjects,
unrelated users or unverifiable markers stop. There is no automatic adoption,
deletion, password reset or resend. A crash after the pre-HTTP checkpoint but
before the call remains unresolved; a future operator workflow must investigate.
Auth success plus failed promotion preserves the identity and request for exact
resume. Lost SQL acknowledgement reads the completed receipt before retrying.

Completion is a historical receipt, even after owner demotion/deletion. No
supported command reopens it or recreates a deleted owner. Additional owners
continue through the existing owner-authorized admin API. All reset scopes
retain the private journal; full reset can still clear ordinary activity logs
under its established policy. No public reset whitelist or second reset
workflow was introduced.

## Local proof and limits

Both an existing native source-70 database and independently restored
`clean-v1` with exactly 70 adopted versions reach the same public/private schema
through 71. The only public catalog additions are two helper functions, two PDC
checks, nullable PDC IDs and neutral future defaults. Historical table ACLs,
merchant records, providers, credentials, controls and captured history compare
unchanged on the existing path. The clean path starts with zero business/Auth
rows, neutral PDC/configuration, 17 zero generations and zero setup events.

`tests/installation-bootstrap.test.mjs` uses non-superuser PostgreSQL, actual
Supautils and PostgREST. It covers grants/RLS isolation, wrong requests,
interrupted/lost Auth results, duplicate/unrelated identities, failed audit,
independent-session competition, lost SQL acknowledgement, permission catalog,
owner internal identity, every reset scope and permanent closure. Acceptance
reset fixtures are disposable rollback transactions, never a hosted reset.

The separate portability compiler compares both paths and binds the resulting
catalog/ACL evidence. The original compiler remains reproducible byte for byte.
Browser fixtures compile the actual content reader/home/hero/navbar/topbar/
footer/login and preserve configured content in EN/AR and desktop/mobile themes.
The existing Setup/PDC suites exercise their current editors and boundaries.

Milestone 3 still needs target/platform verification and locks, guarded installer
plan/apply/resume/verify, secure input/secret files, hosted Auth/Storage/Realtime
acceptance, signup/public traffic restriction, buckets, VPS publication and
receipts/recovery. This library does not establish those prerequisites. No
installer CLI, deployment, remote project/user/provider configuration, Phase 4
clone logic or Product Manager work is included. STOP after Milestone 2.

Final local validation: 862 regression results and 12 focused bootstrap results,
zero failures/skips. Both compiler reproductions, Node 22.23.1 typecheck/build
and public-output isolation pass. Browser results: neutral storefront 229
assertions/32 screenshots; Setup 1,171/146; PDC 495/48, with zero errors or
external requests. Evidence is in
`/Users/imac/Documents/ELcomputer/quick-setup-phase3-milestone2-review-20261012`.
