# Password recovery application deployment — E69

E70 update: [owner recovery acceptance PASS](password-recovery-acceptance-receipt.md).
Owner confirms correct existing Site URL/redirects, updated recovery template,
password update PASS and new-password sign-in PASS. Owner-reported functional
smoke-test results; read-only same-customer metadata supports the recent sign-in.
The owner phase is complete; no repeat recovery test/email or app execution.
Continue the EGP75 purchase after the real saved recipient/mobile is ready.
Earlier OWNER PENDING text below is retained deployment-stage history.

**DEPLOYMENT: PASS. Recovery acceptance: OWNER PENDING.**
Completed2026-10-27 **02:26:23.176 Riyadh**. Public asset postflight passed at02:27:18.090.

The owner approved exactly:

```text
APPROVE PASSWORD RECOVERY REPAIR 20d5432cdafad2250c97a8a1b5a672c47ecf63398ebb499218a212ba0d6bfebc
```

The sealed [review](password-recovery-repair-review.md), packet, source/archive,
unexpired recovery and production state matched. Fresh read-only preflight passed
at02:22:41 Riyadh. The one-shot operator then created new encrypted execution
backups:12,969,135 database bytes with full pg_restore readback, and10 runtime files
with full byte readback. Authenticated decryption and exact hashes passed.

## Verified production result

| Item | Result |
| --- | --- |
| Active release | `11cb391b2497b703` |
| Source | `5b090772228494989b7d7eb0fbb28690ef6c8316` |
| Archive SHA256 | `11cb391b2497b70321941ab8b04d60e6a33623fcbb8d8d83ac293256945ddbfa` |
| Database | Schema95; zero migrations, SQL/data or Auth writes |
| Main application | One restart; PID45853 →46871 |
| Main Caddy | PID26652 retained; zero reloads/restarts or configuration changes |
| Runtime / credentials / services | Unchanged |
| Preserved state | All145 protected projections, exact95 schema, Auth security, history, ledger and access controls |
| Media / private files | Hashes unchanged |
| Signup / confirmation / Turnstile | OPEN / required / accepted runtime preserved |
| Public Cart / Checkout / anonymous history |403 /403 /401 |
| New Paymob initiation / PDC | OFF / PAUSED |
| Agent emails / password changes / provider calls |0 /0 /0 |

Staging/extraction and Caddy's real UID public-file access checks passed. The
isolated loopback application/static candidate passed and was stopped before
activation. It verified closed purchasing/card capability and retained/current
asset bodies without Auth submission or a provider transaction.

All1,744 previous asset entries remain byte-identical; the active inventory has
1,849 asset entries, excluding latest build metadata. Six retained/new JavaScript
bodies and HEAD/content-type/immutable-cache checks passed. EN/AR homepages and
all33 distinct referenced frontend assets returned200 with exact hashes. Latest
metadata retained short caching; missing/hidden asset paths returned404. EN/AR
login returned200. These are deployed HTTP/integrity checks, not recovery acceptance.

All135 frozen paths, original branches/worktrees and clean schema96 were preserved.
The32 deferred-test register and VPS Storage audit scope remain byte-identical.
No completed Auth/payment tests were repeated. No rebuild, merge/reset/deletion,
Git push, automatic retry, rollback or database restore occurred during execution.

The app execution is **CONSUMED_COMPLETE**. Do not replay this operator or an older
deployment/migration. The separately approved owner configuration/test phase remains
pending; its one-recovery-email budget is unused. Retain both releases and assets.
Any separate rollback must preserve both asset generations and align the recovery
template with the chosen app; retain95 and later account activity, without dump restore.

Private evidence: `../password-recovery-repair-20261027/`, including
`approved-fresh-preflight-20261027.log`, `execution-intent.json`, `execution/`,
`approved-execution-20261027.log` and `public-frontend-postflight.json`.

## Approved owner steps — not a new approval request

The sealed scope reserves Supabase configuration and password entry for the owner.
Codex has not edited the hosted template/redirects, and no owner completion has yet
been reported. Keep SMTP, signup, confirmation, CAPTCHA, other templates and quotas.

1. Supabase → Authentication → URL Configuration: verify Site URL is
   `https://elcomputer.net`. Stop if it differs; no origin change is authorized.
   Add only missing exact entries below, preserving all existing redirects:

   ```text
   https://elcomputer.net/login?mode=recovery
   https://elcomputer.net/ar/login?mode=recovery
   ```

2. Authentication → Email Templates → Reset Password: keep the subject/copy and
   replace only the existing link line with:

   ```html
   <p><a href="{{ .RedirectTo }}#token_hash={{ .TokenHash }}&amp;type=recovery">Reset password</a></p>
   ```

   Confirm the saved placeholder destination before requesting email. The exact
   full proposed HTML and its SHA256 are bound in the private plan. No global
   Brevo tracking toggle or SMTP change is included.
3. Only after saving/verifying those settings, open `/login?mode=forgot`, complete
   Turnstile and request ONE fresh recovery email for the privately bound Outlook
   account. Ignore older messages. Open the new link yourself, set the password
   privately, then sign in with that new password and Turnstile.
4. Report password update and new-password sign-in separately. If either fails,
   stop; no automatic resend/retry, password/link/token sharing or admin bypass.
   Codex may verify sanitized metadata; owner results remain owner-reported functional
   acceptance. No new signup, A/B or payment integration test is needed.

BETA-02 remains a public-launch blocker until this bounded owner acceptance passes.
After recovery PASS, save the real recipient/mobile and resume the same customer/
mousepad WOLF1/EGP25 +Manual50 =proposedEGP75 controlled purchase. Refresh the release,
price and address bindings before its separate one-charge authorization. Purchasing
stays closed and PDC paused; public opening still needs separate explicit approval.
