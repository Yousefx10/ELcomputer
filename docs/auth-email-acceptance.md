## 2026-10-26 completed code deployment — 2026-10-26 02:02:04.416 Riyadh

[Exact deployment](public-signup-deployment-receipt.md) PASS:5a38201292763325 /
schema94, source3001cd6, approvale9d1d4bb consumed once. Runtime/Caddy/Auth/signup/
CAPTCHA/purchasing gates unchanged. No merge/reset/cleanup/worktree deletion/push;
all original source bytes and refs remain. Current source lineage still contains
94 migrations; main remains the91-migration continuity checkout. Earlier READY/
approval-pending notes below are historical; never rerun the consumed operator.

## 2026-10-26 BETA-03 update — accepted mail preserved

Owner personally verified effective abuse settings:30 Auth emails/hour project,
60s/address, signup/sign-in30/5min/IP, verification30/5min/IP; CAPTCHA/provider off/
none and leaked-password protection off. Do not repeat Management API403 checks.
Keep30/hour initially; inspect real demand/Brevo headroom before proposing an
increase. No SMTP/template/settings/send changed. Accepted recovery/confirmation
stand. Optional Turnstile frontend is locally qualified for customer signup/login/
reset and Dashboard login; runtime/provider activation remains off. See the
[current signup release](public-signup-release.md) for exact code-only approval
and separate real key/configuration/hosted acceptance gates. Do not enable CAPTCHA
before deploying/configuring the frontend. No new actual Auth account/email.

# BETA-01 / BETA-02 — Auth email acceptance

## Confirmation ACCEPTED — read-only verified — 2026-10-25

**AUTH-CONFIRM-01: ACCEPTED. Password recovery remains ACCEPTED.**
The owner received the Outlook confirmation email, opened its link in the
originating Chrome profile and reports successful account access/login. Fresh
read-only PostgreSQL verification confirms the exact UUID has a set
`email_confirmed_at`, a sign-in timestamp and one matching email identity. Its
active customer profile has the same UUID/email, zero wallet balance and no admin
membership. It is permanent/non-anonymous, unbanned and not invited. No password,
link or session token was captured, and this check changed no data.

Admin/settings/order/payment/present shipping-job fingerprints still match the
pre-test values. This accepts controlled signup email confirmation/owned access,
alongside accepted recovery. It does not certify unaided public signup or a newly
chosen password for this test identity; do not infer those from PKCE access.
No more Auth test email is authorized. Private receipt:
`../auth-email-acceptance-20261025/confirmation-01-acceptance.private.json`.

### Follow-up under BETA-03 — Auth email click tracking

The owner observed Brevo wrapping the confirmation URL through
`sendibt3.com/tr/cl`. Retain only that host/path observation; never copy the
token-bearing link or tracking payload. Confirmation passed despite rewriting;
this observation does not reopen accepted recovery/confirmation.

Prepare an Auth-specific no-click-tracking rule at template/link/sender scope
**only if Brevo confirms support for these Supabase SMTP messages**. No such
account control was independently verified. Do not invent an SMTP header or
HTML attribute, assume a dedicated key isolates tracking, or silently disable
tracking across unrelated mail. Supabase recommends avoiding Auth link rewriting
in its [email tracking guidance](https://supabase.com/docs/guides/auth/auth-email-templates#email-tracking).

If Auth-only suppression is unavailable, a same-provider alternative is the
documented email OTP flow: a private code entered on the application, with
supported verification and abuse limits, rather than a token-bearing click URL.
It needs separately reviewed template/UI changes and focused acceptance; none is
implemented here. See [OTP guidance](https://supabase.com/docs/guides/auth/auth-email-templates#email-prefetching).
No SMTP, provider, tracking or template settings changed; no email was sent this
review. Carry this into public signup readiness; migration preparation can proceed.

**Next primary milestone:** [inactive migration-release preparation](customer-migration-approval.md).
The source/cutoff/exception seal is owner-approved; deployment/import remain gated.
The confirmation creation/send scopes are consumed. Do not repeat them. Earlier
pending-owner/unconfirmed/browser-link instructions below are superseded.

---

## Current confirmation request — one send accepted, owner pending — 2026-10-25

The owner explicitly approved agent creation of exactly one ordinary unconfirmed
identity and one genuine signup-confirmation email for the privately bound
Outlook mailbox. This supersedes the earlier owner-Dashboard creation step and
all pending-approval instructions below. **Both one-attempt scopes are consumed.**

- Fresh read-only Auth/profile checks found zero exact-email conflicts. Both
  authenticated preserved WordPress snapshots also had zero exact-email matches.
- Supported Auth Admin `POST /admin/users` created exactly one permanent ordinary
  identity with `email_confirm=false`. No invitation was requested. The normal
  matching active profile has zero wallet balance and no admin membership.
- No password was supplied, displayed or recorded. The provider generated its
  undisclosed initial password; private owner password setup/login for this new
  identity is not yet exercised. Existing Test B recovery remains ACCEPTED.
- A separate visible Chrome window opened the production login page signed out.
  Its existing Nuxt/Supabase client made exactly one `resend(type='signup')`
  request, with production `/login` and browser-held PKCE. Supabase accepted it;
  the exact new identity's `confirmation_sent_at` is populated, `invited_at` and
  `recovery_sent_at` remain null. This is a confirmation request, not an invitation.
- **Delivery/redemption/access are OWNER PENDING.** The new identity was still
  unconfirmed in the post-send check. HTTP acceptance is not mailbox delivery or
  acceptance. No link was opened or session/password captured by Codex.
- Before/after fingerprints excluding only the approved new Auth identity,
  email identity and profile match: all prior Auth identities/profiles, admins,
  settings, orders, payment attempts and present shipment-job records are intact.
  Signup is disabled, confirmation required, Cart/Checkout403. No settings,
  deployment, import, provider action, public activation or push ran.

Private evidence is under `../auth-email-acceptance-20261025/`:
`confirmation-01-approval.private.json`, before/create/after-create receipts,
`confirmation-01-send-attempt.json`, `confirmation-01-send-result.json`,
`confirmation-01-after-send.private.json` and browser-session metadata. The live
operator uses exclusive creation/send attempt receipts; **never rerun/retry**.
The private Chrome profile holds the verifier. It is retained for owner redemption;
do not export it, close that window or substitute another browser/profile.
No connected document session was available; this separate headed browser is
the controlled fallback. It has no ongoing page/URL/session inspection.

**ONE owner browser action:** open the Outlook confirmation email, copy its
confirmation link and open it in the address bar of the separate ELcomputer
Chrome window left open for this test. Do not paste the link into chat. Check the
production confirmation/account result; another request would replace the verifier.
No more approval or configuration questions are needed for this approved attempt.

The historical migration source/code is preserved. A future guarded import must
refresh the target-identity snapshot to include this new approved test identity;
never restore an older Auth snapshot over it or infer a history ownership claim.

---

Earlier preparation and accepted recovery evidence follow. Their uncreated/
approval-pending statements are superseded by the request evidence above.

## Current acceptance — recovery ACCEPTED, confirmation prepared — 2026-10-25

**AUTH-RECOVER-B-01: ACCEPTED — owner-verified production PASS.**
The owner received the Test Customer B email from `info@elcomputer.net`, followed
the link to the production password-reset page, changed the password and logged
in successfully with the new password. Site URL and all four exact Redirect URLs
are saved, as confirmed by the owner. Do not repeat recovery or configuration
investigations. The failed localhost attempt below remains historical evidence.

| Scope | Current result | Evidence boundary |
| --- | --- | --- |
| Brevo SMTP / recovery delivery | **ACCEPTED** | Owner verified mailbox receipt and sender. BETA-01 transport scope is complete; no independent Brevo log claim. |
| Recovery redirect / password update / subsequent login | **ACCEPTED** | Owner-verified production flow on2026-10-25 for ordinary Test B. This does not certify every locale/browser or another identity. |
| Site URL / four Redirect URLs | **SAVED, owner-verified** | Production link now works. No agent settings write or independent Dashboard read is claimed. |
| Signup confirmation | **PREPARED, NOT RUN** | One new external mailbox selected privately; owner says it has not been added to Supabase. No creation or send approval yet. |
| Public self-service signup / abuse controls | **NOT ACCEPTED; signup remains closed under latest bounded evidence** | Separate activation and normal signup acceptance follow migration identity safeguards. |

Private owner acceptance receipt:
`../auth-email-acceptance-20261025/recovery-b-owner-acceptance-20261025.json`.
It contains no password, link, token or mailbox payload. Owner verification is
accepted as the scoped evidence; logs are not a new prerequisite for this PASS.

### AUTH-CONFIRM-01 — one controlled confirmation test

The owner selected a new Outlook mailbox. Its exact address is kept in private
`../auth-email-acceptance-20261025/confirmation-01-plan.private.json` and its
disabled browser artifact, outside repository documents.
Creation/send approvals are **false**, and the new UUID is not yet assigned.
One combined approval covers one ordinary unconfirmed identity and exactly one
signup-confirmation email to that mailbox. It does not open public registration.

After that approval, perform these steps without additional approval loops:

1. Check the exact mailbox against Auth, current customer profiles and the
   prepared legacy identity inventory. Stop for a conflict; never change an
   existing user, unconfirm Test B, infer aliases or automatically claim history.
2. The owner uses Supabase **Authentication → Users → Add user → Create user**,
   with **Auto Confirm OFF** and a password entered privately. Do not use Invite.
   Bind the returned UUID; verify unconfirmed, permanent, ordinary and active,
   matching the new profile, with no admin membership or purchase grant. Existing
   profile creation through the normal Auth trigger is expected; no transaction,
   address, historical-order association or provider record is created.
3. In a separate signed-out browser profile, open `https://elcomputer.net/login`.
   Prepare the reviewed browser request with the verified new UUID and approved
   mailbox. Invoke the existing application's client once:
   `auth.resend({type:'signup', email, options:{emailRedirectTo:'https://elcomputer.net/login'}})`.
   Keep public signup disabled; no invitation, magic link, auto-confirmation or
   broad redirect is substituted. The API name is resend, but this is the single
   confirmation email for the pre-created identity; no earlier email is required.
4. The owner opens that email in the same browser profile/device, accepts the
   production confirmation callback, opens the owned account, then signs out and
   signs in with the privately chosen password. Do not overlap another Auth flow.
5. Record receipt/sender, redirect, the exact UUID's confirmation timestamp and
   owned access/login separately. Verify existing identities/transactions and
   gates are preserved. Retain this test identity; no automatic cleanup or resend.

The supported [resend API](https://supabase.com/docs/reference/javascript/auth-resend)
and [upstream handler](https://github.com/supabase/auth/blob/v2.196.0/internal/api/resend.go)
accept a PKCE challenge for an existing unconfirmed identity. The installed
Auth SDK2.108.2 creates and stores that verifier for `resend`. This closes the
previous local qualification gap; hosted confirmation is still NOT RUN. A200
alone does not prove a message was sent. If the hosted request fails, inspect
only that failure and stop before any retry or signup-policy change.

The prepared operator helper is
`scripts/auth-email-acceptance/confirmation-browser.mjs`. It uses the existing
Nuxt browser client, requires explicit send approval and a bound UUID, refuses
a signed-in session, and reserves a per-tab attempt marker before awaiting the
request. An unknown/rejected result never retries. The marker does not enforce
a global quota across browsers; the one-attempt limit also binds the operator.
No service-role key enters the browser. Private
`confirmation-01-browser.prepared.js` has approval false/UUID unset and cannot
send. Regenerate its inputs only after the exact scoped approval and creation.

**Ten focused checks PASS** (`tests/auth-page.test.mjs` and
`tests/auth-redirect-flow.test.mjs`, Node22.23.1). The existing seven checks are
preserved; new EN/AR fixture checks exercise the helper and actual installed SDK
through resend → PKCE callback → owned account entry, with duplicate-send and
unapproved-send rejection. All transport is closed/synthetic; no hosted endpoint,
account creation or email ran. No application change/build/deployment is needed.

This controlled test certifies confirmation delivery/redemption and ordinary
access. It does not certify unaided public customer registration. That acceptance
must use the normal signup page after identity safeguards and signup approval.

**ONE next action: approve the single new-identity/confirmation-email scope for
the selected Outlook mailbox.** The mailbox reply authorized binding the plan,
not creation or sending. Once confirmation passes, use the existing combined
Beta/history candidate for guarded inactive92–94 deployment and historical import
review, then public signup, final checkout and separately approved purchasing.
History schema must be deployed before its import; no replacement build or repeat
WordPress audit is requested. Delivery mapping/EGP50, manual merchant refunds/
reconciliation and final order acceptance remain paid-launch prerequisites.

No account, email, settings change, deployment, history import, payment/shipping
action, public activation or Git push ran in this milestone. Existing customer
identities, transactions, branches and prepared work remain intact.

---

Historical redirect investigation follows; its pending-recovery/save instructions
are superseded by the accepted owner result above.

## Current redirect correction — 2026-10-25

**Application readiness: GO. Next email execution: HELD until the owner saves
the values below and approves one fresh recovery email.** No deployment is needed.
End-to-end recovery and confirmation acceptance remain incomplete.
This section supersedes all pending-delivery, configuration-access-first and
test-order instructions in the historical sections below.

### Owner-reported production result

- The approved Test Customer B recovery email arrived through Brevo: **delivery
  PASS, owner-reported**. No independent Brevo log review is claimed.
- Its link redirected to localhost; the password reset did not complete.
  **Previous redirect FAIL; password update/account-access acceptance incomplete.**
- The owner found saved Site URL `http://localhost:3000` and an empty Redirect
  URLs list, and is correcting the Site URL. The corrected saved state has not
  been independently observed. The previous one-email approval is consumed.
- Those old values explain the production redirect falling back to localhost.
  A Management API403 did not establish a transport defect. Do not repeat that
  investigation or ask for SMTP credentials.

### Exact values to save in Supabase Auth → URL Configuration

Site URL:

```text
https://elcomputer.net
```

Redirect URLs, one entry per line:

```text
https://elcomputer.net/login
https://elcomputer.net/ar/login
https://elcomputer.net/login?mode=recovery
https://elcomputer.net/ar/login?mode=recovery
```

The first two are email-confirmation callbacks; the last two are recovery
callbacks. Retain the recovery query exactly. `/login?mode=forgot` only requests
the email; it is not its callback. Do not add generated `code` parameters,
tokens, localhost, wildcard entries, `/account` or an invented `/auth/confirm`.
OAuth callback requirements are outside this email-only correction.

Supabase uses Site URL as the fallback for an unaccepted redirect. Its current
Auth implementation also accepts redirects matching the configured Site URL's
scheme, hostname and port; these four entries explicitly document the app's
intended email routes. See [redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls)
and [upstream redirect validation](https://github.com/supabase/auth/blob/v2.196.0/internal/utilities/request.go).
These are deployment settings, not domains added to reusable application logic.

### Application and PKCE verification — LOCAL PASS

`app/pages/login.vue` already derives both redirects from `window.location.origin`
and `localizedPath`, including EN/AR. `resetPasswordForEmail` receives
`/login?mode=recovery` or `/ar/login?mode=recovery`. Signup passes `/login` or
`/ar/login` as `emailRedirectTo`.

The existing Nuxt Supabase browser plugin uses `createBrowserClient` with SSR
cookies. The installed client enables PKCE and URL session detection. It stores
the recovery verifier, exchanges the returned code once, removes `code` from the
URL and retains `mode=recovery`. The Nuxt plugin awaits session initialization.
The page's user watcher skips account navigation during recovery. Submission
requires a session, calls `updateUser({ password })`, clears the field and signs
out. A second manual `exchangeCodeForSession` would consume the same code again;
none is needed. Missing verifier/session does not authorize a password update.

**Seven focused checks PASS** in `tests/auth-page.test.mjs` and
`tests/auth-redirect-flow.test.mjs`: actual login SFC plus the installed SSR/Auth
SDK, synthetic browser/cookies and closed in-memory Auth transport. They cover
both locale redirect pairs, real SDK PKCE challenge/code exchange, recovery form
retention, password-update/signout, confirmation account-entry behavior, missing
verifier rejection and existing safe-return/error helpers. Separate synthetic
store origins verify portability. No hosted email or real credential is used.
The reload fixture intentionally creates successive clients with shared cookies;
the SDK's multiple-instance warning is expected in that local fixture.

Run: `node --test tests/auth-page.test.mjs tests/auth-redirect-flow.test.mjs`
(verified with Node22.23.1). These are local flow tests, not hosted acceptance.
No application code changed. The login source SHA256 remains
`0173205ea50e289bf422b5a0511af5919e5c3c74f93ba58e92b2c11d7f50b111`,
matching the retained deployed source and both later candidates. No build or
deployment is necessary for this configuration correction.

### Next controlled test and acceptance boundary

**ONE owner action now: save the Site URL and four Redirect URLs above.**
After they are saved, application readiness is GO for a fresh, separately
approved Test B recovery attempt. Do not reuse the old localhost email or resend
automatically. From a signed-out browser profile, request once through the normal
forgot-password form; open the new email in that same profile/device. Keep that
browser's cookies and avoid another signup/recovery request before redemption,
because a new flow can replace the verifier. See [PKCE flow](https://supabase.com/docs/guides/auth/sessions/pkce-flow).

The owner checks the production recovery form, sets a password privately, then
signs in and opens the owned account. Record delivery, redirect, password update
and access separately; never copy links, codes, tokens or passwords into chat.
Any enabled password-change security notification belongs in that test's scope.
Only a concrete new failure calls for bounded Auth/Brevo log or template review.

One controlled confirmation test follows under separate identity/send approval.
Normal signup's PKCE confirmation callback is locally verified; the historical
Admin-create/resend proposal below is not a verified PKCE test and must not be
treated as executable acceptance. Do not enable public signup to run it.
Confirmation remains required under the latest bounded public-settings evidence
(`mailer_autoconfirm=false`); this review changes no policy or abuse controls.

No production settings were changed by Codex. No email, deployment, customer
import, payment/shipping action, public activation or Git push ran in this review.
The migration milestone and remaining79-task roadmap stay intact.

---

Historical priority reset follows; its pending-delivery state is superseded above.

## Current priority reset — 2026-10-25

The owner has approved **one recovery email for existing ordinary Test Customer B**.
That account was identified uniquely and verified active/confirmed/non-admin.
Use its normal application browser recovery flow first; the owner opens the link
in that same browser profile and sets any password privately. Agent has not
dispatched a recovery email. Owner request/delivery/redemption result is pending;
do not resend while it is unknown. Purchasing and signup stay closed.

The concrete private plan/approval are under
`../customer-migration-launch-20261025/recovery-b-plan.private.json` and
`recovery-b-approval.json`. This supersedes the recipient-unbound recovery proposal
below. It does not approve account creation, another email, confirmation testing,
production settings or bulk sends. Complete one controlled confirmation test next.

**Management API403 is not evidence of broken SMTP and does not block this test.**
The earlier six-setting questionnaire/config-access prerequisite is withdrawn.
Use delivery/link/account evidence; inspect the specific settings or logs only
if a concrete failure requires it. Preserve older findings below as history.
[Customer migration and launch milestone](customer-migration-release.md).

---

Historical read-only preparation follows; its proposed ordering is superseded above.

Status: **SMTP ACCEPTANCE BLOCKED**. Reviewed 2026-10-25, Asia/Riyadh.
Scope: read-only verification and preparation of two controlled email tests.
No email, user creation, password change, configuration change or deployment ran.

## Verified results

| Check | Result | Evidence boundary |
| --- | --- | --- |
| Custom SMTP | Owner reports saved Brevo Custom SMTP, `smtp-relay.brevo.com:587`, dedicated active key and verified sender. | Effective Auth configuration GET returned403 with the existing management credential. Saved host, port, sender, key presence and effective transport remain independently unverified. No secret was displayed. |
| Confirmation policy | **PASS for configuration.** Public Auth settings200: `mailer_autoconfirm=false`, email provider enabled. | Requires confirmation; does not establish email delivery or a completed confirmation. |
| Public registration | **CLOSED.** `disable_signup=true`; anonymous Auth disabled. | No signup attempt or setting change ran. |
| Production | Release `58e3083f4aa6a1f8`, service active, schema91. | Fresh pinned-host read and read-only PostgreSQL transaction. No application or migration change. |
| Purchasing/providers | Empty restricted-purchase grant; effective purchasing default remains false. Paymob/PDC initiation flags false; public Cart/Checkout403. | Read-only runtime/route checks; no provider request or checkout action. |
| Confirmation delivery | **NOT RUN.** | No approved recipient, unconfirmed test identity or send authorization. |
| Password recovery | **NOT RUN.** | No recovery send or password change authorized/executed. |
| Redirects | Four exact application entry routes return200. | Hosted Site URL, allowlist and actual email-link redemption remain unverified. HTTP200 is not redirect acceptance. |
| Rate limits / abuse | **UNVERIFIED.** | Auth configuration403 prevents reading effective quotas, resend interval, CAPTCHA and related controls. No stress probes ran. |
| Existing identities | Two ordinary/permanent Auth identities are confirmed; zero unconfirmed identities. | Aggregate-only read. Existing users were not edited or selected for password reset. |
| Auth audit baseline | No matching confirmation/recovery/password-change audit actions in the bounded previous24-hour query. | This is not proof that every historical email/log is absent. No Brevo delivery finding is asserted. |

The local private SMTP input file is an empty preparation template. It does not
establish the effective hosted configuration or contradict the owner's report.
Do not copy the new SMTP key into repository files or chat to resolve this gap.
Central application Brevo settings are separate from Supabase Auth SMTP.

Private receipts, outside Git:
`../auth-email-acceptance-20261025/configuration-readonly.json`,
`runtime-readonly.json`, `database-readonly.json`, `routes-readonly.json`.
These contain sanitized facts only; no raw management response was saved.
The management read needs the intended project's `auth_config_read` permission.
See [Supabase's config-read contract](https://supabase.com/docs/reference/api/v1-get-auth-service-config).

## Exact application redirect contract

This table binds the existing deployment; reusable application code uses the
browser origin and locale. It does not add any domain to application logic.

| Flow | EN target | AR target |
| --- | --- | --- |
| Account confirmation | `https://elcomputer.net/login` | `https://elcomputer.net/ar/login` |
| Password recovery | `https://elcomputer.net/login?mode=recovery` | `https://elcomputer.net/ar/login?mode=recovery` |

All four routes returned200 with their paths/query intact. Expected Site URL is
the reviewed canonical origin, `https://elcomputer.net`; its effective Auth value
was not readable. Check the saved allowlist against all four exact URLs, including
the recovery query. Do not infer acceptance from an origin-wide wildcard or add
wildcards as a workaround. Existing unrelated redirect requirements need review
before any future cleanup; no URL changes are authorized here.

Source: `app/pages/login.vue:118` and `:141`, `app/utils/appearance.js`,
`app/utils/authPage.js`. These files match retained later branch6440669.
The app uses the existing SSR browser client and PKCE verifier storage. The owner
must open each link in the same browser profile that initiated its request.
Complete confirmation before requesting recovery, which can replace the verifier.
Do not use a server-created PKCE challenge or copy link/session tokens into chat.

Confirmation returns through `/login`; the owned account may then open normally.
Recovery must retain `mode=recovery` and show the password-update form. A fallback
to the Site URL, ordinary login screen or missing verifier is not a passing reset.
Inspect templates for correct confirmation URL/redirect handling and provider
link rewriting before sending. See [redirect rules](https://supabase.com/docs/guides/auth/redirect-urls)
and [email template/link tracking guidance](https://supabase.com/docs/guides/auth/auth-email-templates).

## Remaining read-only configuration inspection

Use a connected owner-authorized Supabase dashboard session or a suitably scoped
management credential supplied through an existing private secret channel.
No connected document/browser session was available during this review.
The current credential's403 is an access blocker, not evidence of bad SMTP.

Record only these non-secret facts:

- Custom SMTP saved host/port, enabled state and credential-presence indicators;
  sender/domain verified. Never reveal the login, key or password.
- Site URL and exact Redirect URLs; confirmation and recovery template behavior.
- Project email/hour quota and minimum resend interval, including applicable
  request/IP limits. Keep effective values; do not substitute documented defaults.
- CAPTCHA enabled/provider and whether the existing normal form supplies any
  required challenge. Do not bypass a configured challenge to make a test pass.
- Email hook enabled state; if enabled, establish which transport actually sends.
- Link expiry/password-security controls and enabled password-change notification.
  A password change may trigger an additional security email; include it explicitly
  in later approval or stop before changing the password.
- Brevo transactional account readiness, verified sender and link-tracking status,
  viewed privately. Auth SMTP success and mailbox delivery remain separate results.

No production write is needed to inspect these settings. If correction is needed,
prepare its exact diff for separate approval. Supabase documents the configurable
controls in [Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits).

## Prepared controlled tests — not authorized for execution

Private plan: `../auth-email-acceptance-20261025/test-plan.private.json`.
Recipient remains unset. Owner may save the selected external mailbox in
`../auth-email-acceptance-20261025/test-target.private.json` as an email field.
Do not place passwords, email links, OTPs or full mail contents in that file.
Selecting a mailbox does not authorize account creation or sending.

Use one fresh owner-controlled external mailbox and one dedicated ordinary test
identity for both tests. No admin membership, purchase grant, address, stock,
orders or privileges. Check exact identity/legacy conflicts privately first.
Never unconfirm or reset either existing customer to manufacture test state.

| Test | Approved scope needed | Steps prepared | Acceptance |
| --- | --- | --- | --- |
| AUTH-CONFIRM-01 | Exact external mailbox; one unconfirmed ordinary Auth identity; one signup-confirmation email; owner link redemption | After configuration verification, pre-provision only that unconfirmed identity through the supported Auth Admin API without an invitation or auto-confirmation. From the application's existing browser client, send one `resend({type:'signup', ...})` with the exact confirmation redirect. Owner opens the email in that browser. | Brevo delivery evidence, owner receipt/correct sender, expected application redirect, confirmed timestamp for the exact identity and ordinary owned account. No public signup activation. |
| AUTH-RECOVER-01 | Same identity after confirmation; one recovery email; owner-only password update/login; any enabled security-notification side effect | Owner opens normal `/login?mode=forgot`, enters only the approved mailbox and submits once. Owner opens the delivered link in the same browser, checks recovery mode and sets a password privately. | Brevo delivery evidence, correct recovery redirect/form, successful owned password update and subsequent sign-in; old password rejected if an old password existed; no other identity changed. |

The confirmation proposal uses the supported [resend API](https://supabase.com/docs/reference/javascript/auth-resend)
and [Auth Admin user creation](https://supabase.com/docs/reference/javascript/auth-admin-createuser).
Upstream [resend handling](https://github.com/supabase/auth/blob/v2.196.0/internal/api/resend.go)
looks up an existing unconfirmed user and returns an empty success for an already
confirmed/missing user. An HTTP200 alone cannot prove a confirmation was sent.
The proposed combination still needs bounded hosted acceptance; do not substitute
an invitation, magic link or public-signup enablement if the hosted service refuses it.
This tests confirmation delivery/redemption; it does not certify a new public signup.

Before any execution, bind the selected mailbox/identity privately, verify current
settings, review any profile-trigger effects and freeze the exact approval scope.
Create no identity merely to prepare this document. Each email send is limited to
one attempt; no automatic resend or retry after a timeout. Respect the actual
configured resend interval between confirmation and recovery. Owner opens links;
Codex does not consume them or obtain the password/session.
Keep registration, public purchasing and provider initiation closed throughout.
Retain the test identity afterward; deletion requires separate instruction.

## If delivery or link redemption fails

Stop before another send. Record test ID, request time/status and sanitized error.
Inspect Supabase Auth service logs for that bounded request, and Audit Logs for
the related action. Never export raw URLs, tokens, email payloads or SMTP secrets.
An empty audit query is not a substitute for service delivery/error logs.

In Brevo **Transactional → Logs**, filter by the private recipient and request
window. Review accepted/sent/delivered/deferred/bounce/blocked outcomes and message
ID privately. No Brevo authenticated session/API credential was available here;
no message was sent, so no failed-delivery investigation was needed yet.
See [Brevo's transactional-log guide](https://help.brevo.com/hc/en-us/articles/360021533839-Manage-your-transactional-logs-and-email-previews).

Distinguish transport acceptance, recipient delivery, owner receipt, link redemption
and password update. Capture each separately. If a link is already consumed,
expired, rewritten or opened in a different browser, preserve that result before
requesting a separately approved replacement. Never test by resending repeatedly.

## One next action

**Resolve the read-only Auth configuration evidence gap.** Supply the non-secret
saved dashboard values or provide appropriately scoped access privately. Then
finalize the exact recipient-bound test approval. No send approval is requested
until its effective configuration and recipient are concrete.

No setting changes, signup activation, purchase activation, credentials disclosure,
payments, shipments, production deployment or Git push are authorized by this report.
