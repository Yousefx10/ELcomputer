# BETA-01 / BETA-02 — Auth email acceptance

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
