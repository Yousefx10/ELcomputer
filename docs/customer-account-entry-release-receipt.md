# Account entry Caddy release — 2026-10-21

**DEPLOY PASS. All six owner browser checks reported PASS.**
The exact follow-up prepared at `3b6f3a8` was conditionally approved, then applied
once at 00:49 Riyadh on 21 October. Only Caddyfile changed; Nuxt and schema 85 remain.
No additional route, integration, identity, migration or application change ran.
Do not rerun either completed Caddy executor or the commerce release operator.

## Approved route condition and bindings

Navigation and account layout use `/account`. Nuxt's existing locale configuration
provides `/ar/account`; the page already has `customer-auth`. These source files
match deployed application `862b1e3`. `/myaccount` has no application route or alias;
public EN/AR probes return 404 before and after, without redirect. It stays unchanged.

The candidate adds only GET/HEAD `^/(ar/)?account/?$` to the existing matcher.
Independent comparison confirmed exactly one changed matcher line. No API exception
was added; existing authentication, profile requirements and RLS remain in force.

| Evidence | Value |
| --- | --- |
| Approved source commit | `3b6f3a814443c2179fdfdabee43c90ae9cf6f076` |
| Approved plan SHA-256 | `ac3127a4a6b6548d4e9b49cefbe193d648bb6973310661c9f535164593885bba` |
| Before Caddy SHA-256 | `a19befc25ede29546b5670c0d4a8075e4180c8e310f7e72bd2d0536dc287a169` |
| Installed Caddy SHA-256 | `504191ccdc985084cf9aa0bba4fc36b7cf2bcae7405af95abce469d56bd81558` |
| Installed policy SHA-256 | `8e2a5a23734fe5d283267b385119c734b794e7cd570e4a7d288bd2615a105d8b` |
| Execution UTC | `2026-10-20T21:49:01.730561+00:00`–`21:49:05.333551+00:00` |
| Caddy process | `23064` → `23477`, active/running, zero automatic restarts |
| Unchanged Nuxt release / PID | `82214df492a57126` / `22422` |
| Final accepted receipt SHA-256 | `c8d117339cbe286fb067d91ede6853fc1e55940911afe1b773d69156f64476e6` |

Fresh preflight matched machine/strict SSH identity, all approved hashes, current
release/process identities, runtime/unit/media state and prior recovery evidence.
Read-only checks confirmed an existing active customer profile and owner account,
schema 85 and disabled signup/payment/provider controls. No session was fabricated.

The established procedure preserved an exclusive intent/private backup, validated
the staged candidate, atomically installed Caddyfile retaining root:root 0644, and
restarted Caddy ONCE because `admin off` remains. No retry or automatic rollback.

## Operator verification

Fifty-one post-release HTTP checks PASS, with nine fresh local Caddy/preparation/
archive tests PASS and zero skips. No Nuxt source changed; build/typecheck were
not repeated. Real payment/shipping transports were never called.

- GET/HEAD `/account`, `/account/`, `/ar/account`, `/ar/account/` now return the
  existing anonymous 302 login guard with private/no-store, replacing Caddy 403.
- Missing AND invalid-token GETs return JSON 401/private-no-store for Messages,
  Support tickets, Claims, purchased items and Store Customers. Support orders/
  unread dependencies and anonymous admin-products also 401.
- Direct customer sections and Dashboard Store Customers redirect unauthenticated
  requests to their existing login routes. Account appearance remains 200.
- Checkout, signup/customer-login, payments, workers/webhooks, unknown/private
  customer APIs, customer mutations and Support/Claims attachment bytes/uploads
  remain 403. Private paths remain 404; `/myaccount` and `/ar/myaccount` remain 404.
- Root, Dashboard login and an existing public image return 200. Downloaded image
  content hash matches the VPS file. Empty-body anonymous image/private-video
  upload requests return 401; no file body was submitted.

Before/after database checks matched all 85 migration identities and stored 83–85
sources, full product content hash and protected counts: 561 products, one Auth
user/identity, four Storage objects, zero orders/videos/payment attempts/shipping
jobs/COD receipt or reconciliation rows. These scoped observations do not assert
a global business-write audit. The operator performed no database mutation.

All 2,613 public files (410,096,992 bytes) retain their paths/content hashes.
Nuxt PID/start identity, symlink, env, unit/drop-ins, Caddy unit/binary and private
packing runtime are unchanged. All five payment flags/provider-live flags remain
false; PDC/auto-label/reverse and hosted signup remain disabled. Confirmation is
required. No provider credentials, product stock, schema or financial setting changed.

## Owner browser acceptance and limits

The owner replied **“All six pass”** after being asked to sign in through the
existing `/dashboard/login`, hard-refresh both account entries, and check:

1. `/account`
2. `/ar/account`
3. `/account/messages`
4. `/account/support`
5. `/account/after-sales`
6. `/dashboard/hr?tab=users&people=customers`

Record this as owner-reported functional smoke acceptance: the pages load lists
or proper empty states without 403/Unavailable. No repeat of these six checks is
required unless a new failure appears.

This does not establish hosted restricted-role/customer isolation, authenticated
upload/write acceptance or global absence of browser-induced writes. Missing/
invalid token rejection was verified directly; valid role/ownership boundaries
retain their existing tests and unchanged runtime/schema contracts.

Private Support/Claims attachments remain held pending private VPS conversion.
Their legacy Storage upload/download paths were not opened. Packing videos remain
private on VPS; product images remain separate. Signed-out account entry still
redirects to held customer `/login`; existing-owner access uses Dashboard login.

## Retained evidence and recovery

Private local evidence:
`/Users/imac/Documents/ELcomputer/customer-account-parent-followup-20261021/execution-504191ccdc985084/`.
`accepted.json` binds the immutable operator `completed.json` and subsequent
`owner-browser-acceptance.json`. Preflight, route condition, validation, activation,
HTTP, database and preservation evidence remain alongside the exact executor.

Remote evidence: `/var/lib/customer-access-releases/504191ccdc985084/`.
Root-only 0700 directory retains the 0600 current-before `Caddyfile.before` (a19befc),
candidate, intent and validation/restart/activation receipts. Both file hashes were
verified after execution. The prior a19befc release directory and its f1b944
backup remain unchanged. Do not prune, reapply or reuse either execution intent.

If recovery becomes necessary, review restoring only the verified a19befc Caddyfile
with original root:root 0644 metadata, validate, then restart Caddy once. No automatic
recovery, Nuxt switch or SQL reversal is authorized by this release.

No remaining owner checklist blocks account-entry smoke acceptance. Next work:
complete the documented requirements in existing Paymob/PDC, then controlled
provider acceptance. Historical WordPress customer identity/login/address/order
migration remains required for launch. Checkout/providers stay disabled.
