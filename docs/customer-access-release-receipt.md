# Customer access Caddy release — 2026-10-20

**DEPLOY PASS. Authenticated owner browser acceptance remains pending.**
Follow-up, 21 October: owner reports `Unavailable` at the `/account` entry.
Acceptance is BLOCKED by that omitted parent page. The separate
[prepared correction](customer-account-entry-followup.md) awaits approval;
the deployment receipt below remains historical evidence, not full acceptance.

The owner approved the exact correction prepared at `c7d2079`.
Only Caddyfile changed. Caddy restarted once at 20:31 UTC.
Nuxt, schema 85, Auth/RBAC/RLS and provider settings were unchanged.
Do not rerun the execution or completed commerce release operator.

## Bindings and execution

| Evidence | Value |
| --- | --- |
| Approved source | `c7d20791608f0e5630e001bbc51436d3805ef90c` |
| Before Caddy SHA-256 | `f1b944bbd78b8ba100ee26ed005c08585840a38e968299c378cacdd475d91c7c` |
| Installed Caddy SHA-256 | `a19befc25ede29546b5670c0d4a8075e4180c8e310f7e72bd2d0536dc287a169` |
| Reviewed policy SHA-256 | `8b2bdcb1ed45fc3976be24a646d0d0e318d9404f5d6b68725c374313a985b997` |
| Execution | `2026-10-20T20:31:04.397566+00:00`–`20:31:08.608186+00:00` |
| Caddy PID | `14793` → `23064`, active/running, zero automatic restarts |
| Nuxt release / PID | `82214df492a57126` / `22422`, unchanged |
| Preserved Caddyfile metadata | root:root, `0644` |
| Completed receipt SHA-256 | `35854a5cbb9bda4fcd34f697031986d8b523a952ae9de75eda399ab5b83bcaf4` |

Fresh strict-host SSH preflight matched the reviewed machine, configuration,
application, environment and service bindings. Local candidate reconstruction
matched exactly; the change retains every original configuration byte.
The existing private/no-store method/path exceptions precede the held routes.
No broad API rule, authorization change or new route family was introduced.

The deployment-specific executor followed the documented operator procedure:
exclusive local/remote intent, durable private backup, staged Caddy validation,
atomic replacement preserving ownership/mode, then one Caddy restart.
The existing `admin off` setting required that restart. No retry or rollback ran.

## Live verification

All five primary APIs now reach Nuxt. Missing and invalid bearer tokens each
return JSON 401 with `Cache-Control: private, no-store`.

| Surface | Exact GET route | Before anonymous | After missing / invalid token |
| --- | --- | --- | --- |
| Messages | `/api/account/messages` | Caddy 403 | Nuxt 401 / 401 |
| Support | `/api/support/tickets` | Caddy 403 | Nuxt 401 / 401 |
| Claims | `/api/account/after-sales/claims` | Caddy 403 | Nuxt 401 / 401 |
| Purchased items | `/api/account/after-sales/items` | Caddy 403 | Nuxt 401 / 401 |
| Store Customers | `/api/customer-users` | Caddy 403 | Nuxt 401 / 401 |

Forty post-release HTTP observations passed:

- Support `/api/support/orders` and `/api/support/unread` return JSON 401.
- Anonymous `/account/messages`, `/account/support`, `/account/after-sales` and
  `/ar/account/messages` return 302 to their configured login paths, with no-store.
  `/dashboard/hr?tab=users&people=customers` returns 302 to `/dashboard/login`.
- Root and Dashboard login return 200. One existing public upload returns 200;
  its downloaded content hash matches the VPS file.
- `/checkout`, `/ar/checkout`, `/api/checkout`, `/login`, `/signup`, payment
  capabilities, internal shipping worker and PDC webhook remain Caddy 403.
- Unknown customer API paths, held account orders, private attachment byte GETs,
  Support/Claims attachment POSTs and customer PATCH/DELETE remain Caddy 403.
- `/private/secret` remains 404. Anonymous admin-products GET and empty-body
  image/video upload POSTs return application 401. No file body was uploaded.

The initial smoke harness expected 200 for five anonymous protected pages.
Their 302 responses match the unchanged authentication middleware. The original
observations were reviewed offline; raw evidence is retained. No request,
installation or restart was repeated to correct those test expectations.

Read-only database checks matched all 85 migration identities and stored sources
for 83–85. Product content hash and protected counts matched before/after:
561 products, one Auth user/identity, four Storage objects, zero orders,
packing videos, payment attempts, shipping jobs, COD receipts or reconciliations.
No database mutation, migration or Supabase Storage upload was performed.

All 2,613 public files (410,096,992 bytes) retained their paths/content hashes.
Nuxt PID/start identity, current symlink, environment, base unit/drop-ins, private
packing runtime, Caddy unit/binary and provider flags matched before/after.
All five payment methods and provider-live flags remain false. PDC, auto-labels
and reverse remain disabled. Hosted signup remains disabled; email confirmation
remains required. No payment or shipping provider was called.

Fresh local checks: two actual-Caddy policy tests, six existing Caddy/archive
tests and seven account Auth/RBAC checks including their parent passed, no skips.
The last suite includes one mocked PDC diagnostic; that local application fix
was **not deployed**. Auth/provider fixtures are not hosted merchant acceptance.
No application source changed, so typecheck/build were not repeated here.

## Recovery evidence and remaining acceptance

Private local evidence:
`/Users/imac/Documents/ELcomputer/customer-provider-readiness-20261020/execution-a19befc25ede2954/`.
Its `completed.json` is bound by the hash above; preflight, activation, database,
HTTP, preservation and recovery evidence remain alongside the exact executor.

Remote evidence: `/var/lib/customer-access-releases/a19befc25ede2954/`.
The root-only 0700 directory retains the 0600 `Caddyfile.before`, installed
candidate, intent, validation/restart logs and activation receipt. Backup and
candidate hashes were verified after execution. No failure receipt exists.
Do not prune it. Recovery would restore only the verified original Caddyfile,
preserving root:root 0644, validate it, then restart Caddy once under a reviewed
recovery action. No automatic recovery, SQL reversal or Nuxt switch is authorized.

Existing private Support/Claims attachments remain held 403. Their legacy handlers
still use Supabase Storage and require a separate private VPS conversion.
This release does not enable those uploads/downloads. Packing videos remain on
the existing private VPS workflow; public product images remain separate.

ONE next owner action: complete this browser acceptance using the existing owner
session, signing in through `/dashboard/login` if necessary:

1. Hard-refresh `/account/messages`; expect the owned list or proper empty state.
2. Open `/account/support`; tickets and order choices must load without 403.
3. Open `/account/after-sales`; Claims and purchased items must load without 403.
   Zero eligible purchases is expected while there are no orders.
4. Open `/dashboard/hr?tab=users&people=customers`; expect the authorized list or
   genuine empty state. The API request must succeed with `users.view`.
5. Check storefront/product images and existing Dashboard access. In a private
   window, primary APIs must return 401, and checkout/signup remain 403.

Do not submit messages, claims, files or saves during this read-only acceptance.
Authenticated owner reads, a valid customer denied staff access, customer-to-customer
isolation and authenticated upload writes were not exercised live by the operator.
No new account/session was manufactured. Local tests cover the role/ownership
boundaries; they are not a substitute for hosted acceptance. Report any browser
failure before further release work; do not retry deployment automatically.

After acceptance, complete the documented live activation requirements in the
existing Paymob/PDC implementations. The PDC setup helper remains local.
Checkout stays disabled. WordPress identity/address/order migration remains
a required launch workstream.
