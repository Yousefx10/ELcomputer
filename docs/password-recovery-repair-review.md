# Password recovery repair — E68, 2026-10-27

## E70 — owner recovery acceptance PASS; return to the purchase

[Acceptance receipt](password-recovery-acceptance-receipt.md): owner reports correct
unchanged Site URL/redirects, updated recovery template, password update PASS and
new-password login PASS. Record as owner-reported functional smoke-test results.
The controlled recovery blocker is resolved; no further recovery email/test or
app-operator replay. Current11cb/schema95 preserved; the EGP75 purchase awaits
the real saved recipient/mobile and a separate exact purchase authorization.

## E69 — application DEPLOYED; owner configuration and acceptance pending

[Deployment PASS](password-recovery-deployment-receipt.md),2026-10-27 02:26:23.176
Riyadh: active11cb391b2497b703/schema95, one app restart, zero SQL/runtime/Caddy/Auth/
email/provider changes. Fresh execution backups/private candidate/preservation/
public assets PASS. App operator approval CONSUMED_COMPLETE; never replay it.
The owner-only recovery-template/exact redirects and ONE fresh private reset/
password/new-login test remain approved and unused. No further approval is needed
for those exact steps. Recovery acceptance remains BLOCKED pending their completion.
Earlier NOT EXECUTED/readiness text below is preserved authorization history.

**PUBLIC LAUNCH BLOCKER — BETA-02 / OD-20261027-AUTH-RECOVERY-01.**
The owner corrects previous acceptance: recovery EMAIL DELIVERY passed; link
redemption, password updating and subsequent new-password login never passed.
This supersedes all earlier recovery-redemption ACCEPTED wording. Signup email
confirmation, Turnstile, A/B isolation, existing payment and schema95 acceptance
remain accepted. All32 deferred tests remain unchanged.

## Root cause and evidence

**Exact hosted trigger: UNCONFIRMED. Application defect: CONFIRMED locally.**

The deployed customer `/login?mode=forgot` calls `resetPasswordForEmail` with the
same-origin EN/AR `/login?mode=recovery` redirect and the existing CAPTCHA token.
The Nuxt Supabase module uses browser PKCE. Its installed SDK handles the code
exchange automatically; a callback without the originating verifier cannot do so.
An unrelated saved session can remain after a failed callback.

The deployed recovery form checks only whether `getSession()` returns a session,
then calls `updateUser({password})`. It does not establish recovery proof or reject
an unresolved callback. The exact deployed SFC was reproduced in a closed local
fixture: unresolved PKCE plus another existing session updates that current
account. The corrected SFC rejects that case with zero password updates. This is
not a server authorization bypass; it is an incorrect account-recovery decision.

The owner supplied the current Reset Password HTML. Its link uses
`{{ .ConfirmationURL }}`, which verifies a single-use token on the first GET.
[Supabase documents mail-scanner prefetch consumption](https://supabase.com/docs/guides/auth/auth-email-templates#email-prefetching)
and [PKCE's originating-browser requirement](https://supabase.com/docs/guides/auth/sessions/pkce-flow).
The owner tried the same and another browser. Different-browser PKCE failure is
a confirmed supported explanation; scanner consumption, overlapping requests,
expired codes, link rewriting and a wrong redirect remain hypotheses for the
reported repeated attempts. No actual reset link was inspected or consumed.

Sanitized read-only Auth evidence at01:51:43 Riyadh: selected ordinary customer is
confirmed/active/nonanonymous/nonadmin, recent `recovery_sent_at`, last sign-in
still from confirmation. No matching `auth.audit_log_entries` rows were available.
These records establish neither the failed HTTP response nor its user agent.
No token, password/hash value, raw URL, cookie or session was selected. Existing
credentials cannot inspect hosted email/redirect configuration through Management
API; the prior403 was not repeated. Template contents are owner-reported, and the
current exact redirect allowlist is unverified. App analytics records paths only.

## Smallest reusable correction — LOCAL PASS

Isolated full95 branch `local/password-recovery-20261027`, source
`5b090772228494989b7d7eb0fbb28690ef6c8316`; original full95b37 and main91 remain intact.
Five application files change; one focused test file is added. No dependency,
server route, schema, permission, CAPTCHA or session-isolation implementation changes.

- Require explicit recovery verification, or verified legacy recovery claims.
  Reject unresolved/error callbacks and ordinary unrelated sessions before updates.
- Support a recovery-only email hash, held in the component closure and removed
  from browser history. Page load never redeems it. On the owner's password form
  submission, use supported public `verifyOtp(type='recovery')`, bind its returned
  user to the current session, then call ordinary `updateUser`. No admin API.
- Verification failure cannot fall back to another account or auto-retry.
  A weak-password correction can reuse the already verified same-user session.
  Dispose the proof with the component; clear the password and sign out on success.
- Preserve the existing EN/AR form and Turnstile request enforcement. Add only an
  EN/AR request-new-link action for failed recovery. Login/signup/OAuth are untouched.

The exact proposed recovery template preserves existing copy and changes only
the link destination:

```html
<p><a href="{{ .RedirectTo }}#token_hash={{ .TokenHash }}&amp;type=recovery">Reset password</a></p>
```

The fragment is not sent in an HTTP URL. The installed PKCE client does not
auto-consume this hash; explicit submission verifies it through Supabase before
any password update. The token hash is still a secret email-ownership proof.
Do not paste it into chat, logs, screenshots or Git. No custom bypass or disabled
CAPTCHA is used. Only the Reset Password template changes, after app deployment.

## Exact guarded approval — NOT EXECUTED

```text
APPROVE PASSWORD RECOVERY REPAIR 20d5432cdafad2250c97a8a1b5a672c47ecf63398ebb499218a212ba0d6bfebc
```

| Bound input | Qualified result |
| --- | --- |
| Current production | `81becf54218a8e14`, schema95 |
| Proposed release | `11cb391b2497b703`, same schema95 |
| Archive SHA256 | `11cb391b2497b70321941ab8b04d60e6a33623fcbb8d8d83ac293256945ddbfa` |
| Archive readback | All2,820 entries checked; all1,744 current assets retained; differing collisions rejected |
| Focused recovery checks |15 PASS, zero skipped; includes actual installed SDK/fresh-browser EN/AR and actual SFC before/after defect |
| New release guards |17 Node checks and6 Python guard groups PASS |
| Typecheck / clean-environment build | PASS / PASS; no production secrets used in build |
| Recovery | Fresh schema95 encrypted database/full pg_restore readback and10-file runtime full byte readback PASS |
| Expiry |2026-10-27 **08:10:31.184 Riyadh**; mandatory fresh preflight remains required |
| Owner test target | One exact verified ordinary customer bound privately; one recovery email request maximum |
| Current review state | Sealed, unused; no deployment, template edit or test email sent |

Private plan/operator: `../password-recovery-repair-20261027/plan.json` and
`release-operator.mjs`. The earlier unapproved plan lacking explicit owner identity
binding is preserved and superseded. No consumed release operator is invoked.

This approval permits one separately staged app-only release, an isolated
loopback app/static candidate, and one main app restart. It permits **zero SQL,
runtime/Caddy/service/Auth/SMTP configuration writes by Codex**, migrations,
provider/payment/PDC requests, order creation, public purchase activation or push.
All current data/schema/Auth/runtime/Caddy/media/private files, frozen135 paths and
clean96 remain bound. No automatic retry, rollback or database restore is allowed.
Failure consumes this approval and requires inspection and separate authorization.

The same approval permits these explicit OWNER-ONLY steps after deployment PASS:

1. In Supabase URL Configuration, verify Site URL equals `https://elcomputer.net`.
   If it differs, stop; no origin change is authorized. Ensure the two exact
   redirects below exist, adding only missing entries and retaining every existing
   redirect. No wildcard, SMTP, sender, CAPTCHA, signup or quota change.

   - `https://elcomputer.net/login?mode=recovery`
   - `https://elcomputer.net/ar/login?mode=recovery`

2. In Email Templates → Reset Password, replace only the reviewed link as shown.
   Preserve its subject and other copy; do not alter signup/confirmation templates.
   The exact full proposed HTML is private `recovery-template.proposed.html`, SHA256
   recorded in the sealed plan. Confirm the saved placeholder destination, without
   generating or sharing a real link. No global Brevo tracking toggle is included.
3. Only after app/template/redirect checks pass, personally request ONE fresh reset
   email for the privately bound account through Forgot Password and Turnstile.
   Ignore older messages. Open the new email yourself, enter a new password privately,
   submit once, then sign in with that new password and Turnstile.
4. Report password update and fresh sign-in separately. On failure, stop; do not
   automatically resend or reuse an ambiguous attempt. Codex inspects only sanitized
   metadata and owner-reported results, never the password/link/session.

**Recovery acceptance remains BLOCKED until deployment/configuration and this
one owner redemption/password/new-login test pass.** No new email was authorized
or sent merely by preparing this approval. Auth email delivery stays accepted;
the previously unaccepted redemption is the only new functional acceptance.

If an app rollback is separately approved, review the recovery template alongside
the old application's capabilities. Keep additive95 and later account activity;
never restore an earlier database/password snapshot over newer users or passwords.
Signed Paymob callbacks and protected owned receipts remain available throughout.

## Return directly to the purchase

After recovery PASS, the same customer saves a real address/mobile. Resume
[the controlled purchase](final-controlled-purchase-review.md): mousepad WOLF/Default1,
EGP25 +Manual delivery50 +cardfee0 =proposedEGP75. Refresh its bindings to the new
release and saved recipient before issuing a separate one-charge purchase approval.
No order, intention or charge now. Signup stays OPEN, purchasing OFF and PDC PAUSED.
All32 deferrals, schema96, source worktrees and the post-Beta Storage audit remain
preserved and incomplete. Public opening still requires its own later approval.
