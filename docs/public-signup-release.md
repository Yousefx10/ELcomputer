# Public signup — returning customers and optional Turnstile

Reviewed **2026-10-26, Asia/Riyadh**. **CODE DEPLOYED; PUBLIC SIGNUP ACTIVATION BLOCKED.**
The exact application deployment passed at **2026-10-26 02:02:04.416 Riyadh**; its approval is consumed.
See the [production deployment receipt](public-signup-deployment-receipt.md).
Earlier qualification and preparation evidence is preserved below.
Production registration and purchasing remain closed. No activation is inferred.

## Reviewed source and scope

Opening main/cached origin/main:ea113e9, two untracked consumed Auth sources.
The2026-10-25 audit has no unresolved blocker to isolated preparation. All nine
original worktrees/dirty bytes/indexes/HEADs were inventoried and preserved.
No fetch, merge, reset, cleanup or push. Cached refs do not prove remote freshness.

The notice-only candidate source574bb86/archive4d6817e7d66d2796 was qualified and
sealed, then marked **SUPERSEDED / NOT APPROVED / NOT EXECUTED** after the owner
requested Turnstile support. Its original plan/archive/source remain preserved
at `../public-signup-preparation-20261026/`. Do not approve or deploy that packet.

The one replacement release uses
`../public-signup-turnstile-preparation-20261026/source`, branch
`local/public-signup-turnstile-20261026`, source `3001cd6` (application `34167fe`, browser tooling `e7bf90f`).
Both new worktrees are additive:11 total. Latest main continuity documents were
copied forward; feature-era handoffs did not overwrite main. Main still has91
migration files; the reviewed deployed-source descendant has94. Main integration
and remote publication remain separate work. Documentation updates are retained
in main and the candidate; the application manifest excludes those documents.

Eight application inputs change: customer login, Dashboard login, shared widget
and loader, safe Auth errors, EN/AR catalogs and runtime defaults. Dashboard login
needs CAPTCHA because the Auth setting also protects staff password sign-in.
Its layout, active-admin check, permissions and audit remain. No Dashboard
redesign, commerce/ERP/SEO/Live Chat work or schema change is included.

## Customer copy and authentication

The compact EN/AR notice explains original-email registration, new passwords,
mailbox verification, secure explicit historical connection and Forgot Password
for existing new-platform accounts. Old website passwords do not transfer.
Existing responsive layout, RTL, Light/Dark/System and keyboard focus remain.
Failed customer password logins use identical generic guidance without checking
whether any email has an account. Duplicate signup gives generic next steps.

`NUXT_PUBLIC_RETURNING_CUSTOMER_NOTICE_ENABLED=false` is the portable default.
The notice additionally requires public Auth settings to report registration open,
email enabled and confirmation required. It stays hidden during recovery and
closed/unknown registration. Direct signup-mode submission fails closed as well.
Supabase disable_signup remains authoritative for direct Auth API access.

Optional CAPTCHA inputs:

| Input | Default / meaning |
| --- | --- |
| NUXT_PUBLIC_AUTH_CAPTCHA_PROVIDER | Empty disables the widget; turnstile enables it. Unsupported values fail closed. |
| NUXT_PUBLIC_TURNSTILE_SITE_KEY | Empty by default; public widget key only. Missing key with enabled provider fails closed. |

The matching secret belongs only in Supabase's CAPTCHA settings. The application
never receives it. No new dependency, secret proxy, server credential or custom
identity lookup is added. Independent stores remain unchanged by default.

The shared explicit widget loads Cloudflare's official script only when configured.
It supports EN/AR, resolved themes, compact320px layouts, script failure/retry,
expiry/timeout, unmount and stale-callback protection. Tokens stay in memory,
are cleared on mode changes and after every Auth attempt, and are not rendered
as attributes, hidden fields, stored credentials or logs. The SDK forwards the
fresh token in supported captchaToken options for customer signup, password login,
reset requests and Dashboard login. Password-update/PKCE completion stays separate.
A missing or rejected challenge cannot submit an enabled CAPTCHA form.

Supabase performs token validation when its CAPTCHA setting is enabled; a local
widget alone cannot protect direct Auth requests. See [Supabase CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha),
[Cloudflare lifecycle](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/)
and [official public test keys](https://developers.cloudflare.com/turnstile/troubleshooting/testing/).
Current hosted login sends no CSP header; no CSP/Caddy change was made.

Existing server-only owner password reauthentication already uses its isolated
service-role client. No reset or bypass was added. Upstream Auth middleware treats
admin credentials separately; this is source evidence, not hosted reset acceptance.
Live Chat and anonymous Auth remain disabled; their future rollout is separate.

## Qualification and evidence boundaries

- 28 focused Auth/widget/Dashboard/history tests passed,0 failed/skipped. Tests cover
  the actual Vue scripts, actual HTTP history routes, PostgreSQL ownership rules,
  missing/expired/denied/reused tokens, stale callbacks and unchanged admin denial.
- 33 current session/checkout/Paymob checks passed,0 failed/skipped, including the
  opt-in local two-account browser component tests. Hosted two-account acceptance
  is still separate. No real customer was impersonated.
- The unchanged native schema94 concurrency test passed with the prepared PostgreSQL
  toolchain. The initial wrong-toolchain pg_trgm failure and corrected proof remain
  in the first packet. Native SQL/helper inputs are unchanged; no workaround SQL.
- Six release-guard checks passed: wrong/consumed approval, expanded write/signup/
  retry scope, changed target scope and stale recovery stop before target mutation.
- Node22.23.1 typecheck and empty-dotenv production build passed. Qualified installed
  dependencies were reused; package/lockfile bytes are unchanged. Existing ERP
  duplicate import, sourcemap and es2019 BigInt warnings were retained.
- Exact archive:15 scenarios/36 screenshots and1,640 HTTP/SHA256 client-asset checks passed. Cloudflare
  official dummy widgets passed for all four forms, including EN/AR, resolved
  themes and320px layouts.44 public Cloudflare widget requests;0 hosted Supabase
  connections, emails or payment/shipping requests. Missing-token denial uses a
  local Auth fixture; actual hosted CAPTCHA enforcement remains unexercised.

Private evidence: `../public-signup-turnstile-preparation-20261026/` and final `review-2/`, including
opening inventory, source manifest, exact archive/readback, all logs/screenshots,
owner settings receipt, masked account-binding result and reused native proof.
No customer snapshots, actual Auth passwords/tokens or provider secrets are in Git.

## Historical ownership

Fresh read-only evidence confirms deployedbc05eef266eeb7de/schema94, three current
accounts/profiles,516 historical customers,513 eligible identities,591 orders,
6 refunds and131 protected unlinked records. Actual claims remain0 at this task's
retained check. Runtime/schema/history routing bindings and held gates match.
EN/AR login200, Cart/Checkout403 and anonymous history401 pass.

**The one verified historical match is the owner's ordinary account used for
accepted recovery and new-password login on2026-10-25.** The exact UUID matches
that private owner acceptance receipt; only a masked mailbox was returned in chat.
It is confirmed, active, permanent and not an administrator. Its archived history
contains **zero orders**. The agent created/changed/claimed nothing.

**Hosted claim/profile/empty view: PENDING OWNER.** The owner can log in normally,
open My Account → My Orders → Connect previous orders, expand the archived profile
and refresh. Correct acceptance is owned profile/address visibility plus an empty
previous-orders list. It cannot accept a real order detail. This local regression
now also passes in SQL, including no current-profile overwrite and another-account
profile/detail denial. A read-only aggregate is not browser ownership acceptance.

For later order detail, use one legitimate order-bearing historical customer,
with authorization and control of their original mailbox, ordinary registration
and verification. A minimal one-order candidate is identified privately; it has
not been contacted, impersonated, registered or claimed. Verify its owned list,
detail, money/items/addresses and refresh against immutable records; another
ordinary account must be denied that direct URL. Guest, held and unlinked records
remain private. Never substitute an Admin-created identity or service-RPC
impersonation. No actual customer's identity may be used without authorization.
The order-bearing case is future acceptance; it is not being fabricated as a
prerequisite to preparing the signup release.

## Owner-verified abuse settings — OD-20261026-AUTH-01

The owner personally inspected production Supabase Dashboard and reported:

| Control | Owner-verified value |
| --- | --- |
| Auth email quota |30 emails/hour, project-wide |
| Same-address minimum interval |60 seconds |
| Signup/password-sign-in |30 requests/5 minutes/IP |
| Token verification |30 requests/5 minutes/IP |
| CAPTCHA / provider |Disabled / none |
| Leaked-password protection |Disabled |

This supersedes the earlier unknown-settings blocker. No Management API403
investigation was repeated. These are owner-verified settings, not an agent stress
test. Existing Brevo SMTP/confirmation/recovery are accepted and remain unchanged.

**Recommendation: retain30/hour for the initial low-volume Beta.** Confirmation
and recovery share that allowance; it is not30 guaranteed completed signups.
No mass invitations are needed. Review actual quota consumption and delivery;
if genuine demand approaches24 emails/hour, verify Brevo's available account/day/
rate capacity and other transactional traffic before proposing a bounded increase.
No increase is needed now, and no Brevo plan/quota has been invented or changed.
Keep the60-second interval and both IP limits. Do not weaken limits to fix delivery.
Auth link-tracking follow-up and disabled leaked-password protection remain
recorded; no SMTP/template/global tracking/password-policy change ran.

## Guarded code release and separate activation

Candidate archive SHA256:
`5a382012927633254b58142dae6c5fcb433290e23af46f671acff848216ddbd2`.
Release `5a38201292763325`,15,104,675 bytes,2,620 entries; eight application inputs
change relative to deployed-source descendantde5c414. Schema94; no migrations.

**DEPLOYED — APPROVAL CONSUMED. Do not rerun.**

The following exact approval was executed once; it is historical, not a new request.

```text
APPROVE SIGNUP NOTICE DEPLOY e9d1d4bb798919e79aa5a70641801f1f99a1e3cd4623e35a4f923df7598988b0
```

Authoritative private packet: `../public-signup-turnstile-preparation-20261026/review-2/plan.json`.
Source `3001cd69b711240640fc523c9482c4f84b58c573`; archive and scope above are bound.
Fresh encrypted recovery/full readback verified **2026-10-26 01:05:19 Riyadh**:
12,818,743 database bytes and10 runtime recovery files. All140 original projections
and all five history-table fingerprints are captured. Recovery freshness expires
**2026-10-26 07:05:19 Riyadh**. The operator rejects expiry or any protected
source/artifact/target/data/ownership drift. The preparation window above is historical. Owner approval, execution intent,
remote staging and one application deployment now exist; see the consumed receipt.
No public signup activation occurred. Secret scan of all2,620 extracted
entries passed without recording secret values.

The first replacement read-only preparation stopped before sealing when live
analytics and the append-only internal-cart ledger advanced during backup. Its
evidence remains. No approval or execution was consumed. A new review-2 packet
refreshes the baseline. The operator reuses the existing comparison rules for
only analytics sessions/events and Auth activity timestamps. All internal ledgers,
identity/password/email/security, profiles, commerce and history/ownership remain
fully bound; six guard tests explicitly cover those distinctions. All140 projections
are captured; live telemetry rows are not represented as frozen business data.

This approval permits only the exact application archive, mandatory preflight,
fresh execution backup, private target candidate, at most one app restart and
postflight receipt. It leaves notice/CAPTCHA runtime defaults off, Auth signup
closed, purchasing closed and Paymob/PDC initiation held. Runtime, Caddy, SMTP,
Auth identities/passwords, current commerce/history/media and signed callbacks
remain. Drift, expiry or an attempted execution stops; no retry/automatic rollback.
Do not use the retired PM2 tools or any consumed schema/import operator.

**Public signup activation approval: NOT READY; no executable phrase issued.**
The remaining blockers are production widget/key binding and controlled hosted
CAPTCHA/login/signup/ownership acceptance, rather than Management API access or
another SMTP investigation. Accepted email tests must not be repeated casually.

Minimum owner sequence:

1. Report the matched owner's archived-profile/empty-orders result. No new account
   or password change is needed for that test.
2. The exact application deployment is complete and its approval consumed. Supply
   the public sitekey for a hostname-restricted managed Turnstile widget. Keep its
   secret private. No Supabase CAPTCHA toggle is requested before the deployed frontend is configured and the widget renders on all four
   affected forms.
3. Prepare one separately approved runtime/CAPTCHA configuration and hosted
   acceptance packet: bind the public sitekey, install the matching secret directly
   in Supabase, preserve all accepted origins/confirmation settings and current
   accounts, verify ordinary owner/customer and staff login plus reset-request
   compatibility. Keep public registration closed until its exact approval.
   A first genuine signup/email test and any order-bearing identity use need
   recipient/owner authorization; no automatic creation, resend or impersonation.

Enabling Supabase signup affects direct Auth too; Caddy/UI gating does not make
an enabled Auth window private. Later activation must include monitoring and
emergency registration closure. It cannot enable purchasing or book shipments.

## Minimum paid-Beta gates retained

| Gate | Verified boundary / remaining step |
| --- | --- |
| Official PDC destinations |BETA-07/SHIP-02: updated official owner location file missing. Validate exact supported IDs and prepare a bounded review-only mapping diff.411-city cache/free text/tariff zones are distinct evidence. |
| Configurable EGP50 delivery |Existing client_shipping_price support deployed;50 approved in principle but unapplied. Retained test fee1 is not public delivery pricing. Separate settings approval after destination review. |
| CARD and signed callbacks |Deployed Beta CARD-only foundation and accepted signed Paymob callback authority preserved; no new charge/replay. |
| Zero-stock foundation |Deployed inactive, unchanged. Post-Beta stock-independent selling remains separate; no surprise current Beta contract/label change. |
| Dashboard booking |Merchant-controlled, retaining permissions, confirmation/packing and uncertain-booking barriers; separate real booking approval. |
| Cancellation/manual refunds |BETA-08: verify merchant entitlement, procedure and local reconciliation/actual-stock disposition. Status changes do not return card funds. |
| Genuine complete order |One authorized ordinary-customer order/payment/receipt/merchant-handling acceptance remains, followed by separate purchasing approval. |
| Emergency closure/expiry |Retain purchase-disable controls and callback/owned-receipt reconciliation. BETA-09 scheduler/monitoring/closure acceptance remains; no worker activation here. |

**ONE next purchasing milestone: BETA-07 — obtain the official PDC destination
file and prepare its exact mapping diff.** No provider calls, fee activation,
refund or checkout activation is bundled with that first review.

The exact code-only production deployment completed once. No runtime/Auth/Caddy
change, Auth account creation/password change, ownership claim, email, payment/
shipment request or Git push ran.
Cloudflare requests in qualification use only its official public dummy widget
against local Auth fixtures; they do not establish hosted Supabase enforcement.
