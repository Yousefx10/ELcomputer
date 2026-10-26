# Supabase Turnstile authentication acceptance — ACCEPTED for the tested scope

Reviewed2026-10-26, Asia/Riyadh. **Turnstile authentication acceptance is complete
for existing-customer login, Dashboard login, recovery requests and missing/invalid
token rejection.** Genuine new-customer signup remains unexercised while closed.
Public signup/purchasing stay closed. PDC remains paused.

## Authorization and configuration

Exact owner approval2f716d6351e8dc638817af08f2776792796fd79fef66b8c933174d074ed67f34
was received. The approved manual plan remains byte-identical.
The owner reported `CAPTCHA enabled` after entering the matching Secret Key
in the production Supabase Dashboard. The agent never received the key and
made0 settings/Management API calls. No repeated HTTP403 investigation.

Fresh pinned read-only preflight passed before configuration and before Auth
requests: same release5a38201292763325/process/runtime/output/schema94,759 app
inputs, protected schema/Auth/business/history/ownership. Public EN/AR/Dashboard200,
Cart/Checkout403, anonymous history401. Signup disabled/confirmation required.
No app deployment/restart/runtime/Caddy/schema change in this acceptance stage.

## Two-request scope and separately approved one-request qualification

| Case | Recorded result | Acceptance boundary |
| --- | --- | --- |
| Missing CAPTCHA token — approved7c qualification | HTTP400, structured `captcha_failed`, no session. | Server CAPTCHA denial confirmed by exactly1 request at2026-10-26 11:51:32.836 Riyadh. |
| Original missing-token diagnostic — historical2f evidence | HTTP400, no session; reason not retained. | Preserved unchanged. The separately approved7c request closes the evidence gap without rewriting the earlier receipt. |
| Invalid synthetic token | HTTP400, structured `captcha_failed`, no session. | Server CAPTCHA denial confirmed. |

The first diagnostic omitted `X-Supabase-Api-Version`, which the installed Auth
SDK adds automatically. Its expected structured code was absent, so the helper
stopped before its second request. The storefront SDK is unaffected.
Its original STOP/intent/result are retained; the helper was not rerun.
Local native-SDK mocked-fetch tests confirmed the correct API version/payload.
A public-key validation correction handles both publishable keys and legacy anon
JWTs; its failed local validation occurred before a second request intent.
Only the unused, distinct, originally approved invalid-token case then ran once.
The missing-token request was not repeated. Total password Auth requests2/2;
no third request or automatic retry is authorized under this plan.

All requests used only the public anonymous/publishable key, without customer
cookies, bearer sessions, admin/service-role access or actual customers.
The reserved invalid-domain fixture sends no email. Agent sessions/emails0.
Raw response messages/tokens were not saved; status/code/session booleans only.
The earlier missing-token message cannot be reconstructed from its receipt.
The separate exact7c owner approval supplied that one-request authorization;
it is now consumed/PASS. No further request is authorized under either scope.

Local tests:3 approval/confirmation/budget guards +4 native-SDK/error-contract/
public-key cases PASS, no skips. These are diagnostic checks, not Auth acceptance.
Private `AUTH-ENFORCEMENT-NEGATIVE-RECEIPT.json` binds the qualified evidence.

## Owner functional acceptance PASS — 2026-10-26

| Owner check | Reported result | Boundary |
| --- | --- | --- |
| Existing customer login | PASS | Owner-observed hosted login in a fresh private window. |
| Authorized staff Dashboard login | PASS | Owner-observed hosted login in a fresh private window. |
| Forgot Password request | Email RECEIVED | Owner-observed delivery after the protected request; password reset/redemption was not requested or retested. |

The owner reports each applicable check was performed once, without changing
passwords or credentials. No secrets, login credentials, session cookies, links
or tokens were shared. Do not repeat these successful checks or send another
acceptance recovery email under the consumed2f scope.

These results accept the legitimate customer/staff/recovery flows with the
owner-configured Turnstile integration. Together with the structured invalid-token
denial, they support normal real-token verification working. Owner observations
are distinguished from agent-captured HTTP evidence; sessions were not inspected.

Fresh read-only evaluation confirms the same release5a38201292763325/runtime/
process/output and759 app inputs. Login/AR/Dashboard200, Cart/Checkout403,
anonymous history401; public settings retain signup disabled/confirmation required.
No new password Auth request, email, setting/deployment/restart/schema change.
Private `OWNER-AUTH-POSITIVE-RESULTS.json`,
`AUTH-ENFORCEMENT-OWNER-ACCEPTANCE-RECEIPT.json` and
`auth-owner-results-readonly.json` bind this milestone.

## Missing-token qualification PASS — acceptance complete for this scope

Exact owner approval:
`APPROVE ONE MISSING-TOKEN CAPTCHA CHECK 7c232640a8433b84a167e0bfea6a59cd5ad0cb21337e2d9441417a31f7087017`.
The sealed helper/evidence and owner-positive prerequisites verified unchanged.
Fresh public Auth settings retained signup disabled/confirmation required; the
configured login page retained the approved public Site Key.

Exactly1 missing-token password request returned400/structuredcaptcha_failed,
no session. No email, real customer, setting/key entry, deployment/restart/schema,
permission/password/claim or provider transaction. No automatic retry.
Postflight Cart/Checkout403 and anonymous history401. The7c allowance is consumed;
do not rerun the helper or repeat accepted owner flows/recovery email.

The original2f scope remains2/2 requests. The separately approved7c scope used1/1,
for3 total negative password requests across those distinct approvals. The original
helper STOP and unqualified response remain historical evidence; the new qualified
response independently closes the missing-token case.

Accepted evidence now covers all five bounded cases: owner customer login PASS,
owner staff Dashboard login PASS, recovery email RECEIVED, invalid token denied,
and missing token denied. Owner-observed positive results remain distinguished
from agent-recorded HTTP denials. No credentials, sessions or Secret Key inspected.
The password-reset link/redemption remains prior accepted evidence, not repeated.

Private authoritative closure: `TURNSTILE-AUTH-ACCEPTANCE-COMPLETE.json`,
`OWNER-MISSING-RECHECK-APPROVAL.json`, `auth-missing-recheck-intent.json`,
`auth-missing-recheck-result.json`, `auth-missing-recheck-execution.log`,
`auth-missing-recheck-postflight.json` and both approval-status receipts.

## Next separate milestone: public signup launch readiness

Public signup and purchasing remain DISABLED until a separately approved launch
milestone. PDC stays paused. This Auth acceptance does not open registration.
Genuine new-customer signup/confirmation has not been exercised while signup is
closed; the deployed signup SDK wiring has retained local qualification only.
Prepare the small guarded signup-only plan and its owner-controlled registration
acceptance case, preserving existing Supabase identities, confirmation/redirects,
CAPTCHA, account isolation and all purchase/provider holds. No executable signup
activation phrase is issued by this receipt.

Historical owner profile/empty-history acceptance remains pending and cannot
accept an order detail. A real order-bearing historical customer requires explicit
authorization and verified original identity; no impersonation, automatic claim
or guest linking. Customer login success does not supply those results.

Both handoffs/roadmap retain all88 task IDs. No source/Git push/merge/reset/delete;
13 worktrees/10 branches, original46 source paths/detachedc3775e8 preserved.
Main remains91 migration files; deployed schema/source94 lineage remains the base.
ONE next purchasing milestone is still BETA-07 official PDC destination mappings,
after signup readiness and PDC resumption authorization.

## Follow-up disposition

The [one-request qualification](turnstile-missing-token-recheck.md) was separately
approved and completed PASS. Its consumed approval cannot authorize any launch,
settings change or additional Auth request. Both handoffs and the roadmap carry
this completed milestone and the separate public signup readiness boundary.
