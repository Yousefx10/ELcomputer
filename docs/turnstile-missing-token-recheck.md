# One missing-token CAPTCHA qualification — PASS, approval consumed

**Exact7c approval received; exactly1 request completed PASS.**
Supabase returnedHTTP400/structuredcaptcha_failed/no session at
2026-10-26 11:51:32.836 Riyadh. This closes the earlier diagnostic gap.
No email/settings/deployment/restart/launch change. Original2f budget2/2 remains
separate;7c used1/1. Both are consumed. Never rerun this helper.
[Complete scoped Auth acceptance](turnstile-auth-acceptance-receipt.md).

The preparation text below is historical; its limits remain the executed scope.
The original2f scope used exactly2 negative password requests. Its missing-token
request returned400/no session, but its specific reason was not retained.
Invalid-token400/captcha_failed is independently verified. See the
[current acceptance receipt](turnstile-auth-acceptance-receipt.md).

This proposal permits **one** new missing-token password request using the
installed SDK's API version/payload, public anonymous/publishable key and reserved
invalid-domain fixture. Expected:400/structuredcaptcha_failed/no session.
No real customer, credentials/session, email, settings change, deployment,
restart, runtime/Caddy/schema change, signup/purchasing/PDC or Git push.
No Secret Key entry or configuration repeat. No automatic retry/rollback.

Preconditions: owner customer login/staff login PASS and recovery email RECEIVED;
the owner reported PASS/PASS/RECEIVED on2026-10-26. This prerequisite is satisfied.
Signup must remain disabled, confirmation required
and current configured frontend unchanged. The helper requires both those owner
results and a new explicit approval before reading keys or dispatching a request.

Local mocked-fetch comparison to the installed Supabase SDK confirms the exact
missing-token payload/API version:1 test PASS,0 live requests. Existing4 SDK/error/
public-key tests and3 confirmation/budget guards remain PASS. These are local
contract checks, not server acceptance.

Private packet: `../turnstile-runtime-recovery-fix-20261026/auth-missing-recheck-plan.json`.
Helper: `auth-missing-recheck.mjs`, exclusive intent/max1 request.
Seal: `7c232640a8433b84a167e0bfea6a59cd5ad0cb21337e2d9441417a31f7087017`. Owner-positive prerequisite PASS; **separate exact approval executed/CONSUMED_COMPLETE**.
Executed approval (historical; do not repeat):

```text
APPROVE ONE MISSING-TOKEN CAPTCHA CHECK 7c232640a8433b84a167e0bfea6a59cd5ad0cb21337e2d9441417a31f7087017
```

The packet binds the corrected helper, installed-SDK contract proof, existing
negative receipt and owner configuration confirmation. Owner approval, exclusive request intent, result and postflight receipts exist.
No additional request allowance exists. Never rerun the original2f helper or repeat its first request under
the exhausted budget. Public signup activation remains a separate review.
