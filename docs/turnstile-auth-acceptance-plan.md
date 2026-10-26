# Supabase Turnstile authentication acceptance — completed for tested scope

**Owner approval received and CAPTCHA enablement confirmed.**
[Current results and limits](turnstile-auth-acceptance-receipt.md): invalid-token
server denial PASS, owner customer/staff login and recovery email PASS/RECEIVED;
missing-token structured denial is now confirmed under separately approved7c.
The2f2-request budget and separate7c1-request budget are consumed. Do not repeat
the helpers, successful owner tests or recovery email. Public signup launch remains
a separate approval and genuine new registration remains unexercised.
Public signup and purchasing remain closed. PDC remains paused.
This is an owner-operated settings step; no automated settings operator is staged.
The Secret Key is entered only in Supabase and never shared with Codex.

Private reviewed plan:
`../turnstile-runtime-recovery-fix-20261026/auth-enforcement-acceptance-plan.json`.
Seal: `2f716d6351e8dc638817af08f2776792796fd79fef66b8c933174d074ed67f34`.
The plan binds the completed frontend receipt and qualified browser evidence.
The current frontend approval7b is consumed and supplies no backend authority.

Received approval (historical; do not request again):

```text
APPROVE SUPABASE TURNSTILE ENFORCEMENT ACCEPTANCE 2f716d6351e8dc638817af08f2776792796fd79fef66b8c933174d074ed67f34
```

## Approved scope

| Action | Limit and boundary |
| --- | --- |
| Supabase configuration | Owner enters the matching Secret Key/providerTurnstile and enables CAPTCHA once in the bound production project. Signup stays disabled; email confirmation stays required. |
| Negative Auth acceptance | After owner reports configuration complete, at most2 agent password-login requests: missing token and invalid synthetic token. Public anon key only; no bearer/cookies/admin/service role. Reserved `captcha-check@example.invalid` fixture, no actual customer. Record status/code only. No email or successful session expected. |
| Positive customer login | Owner uses their existing ordinary account once, in a private window; reports only pass/fail. No credentials, cookies or tokens shared. |
| Dashboard login | Owner uses their existing authorized staff account once in a separate private window. Keep the current Dashboard session available. No role/permission changes. |
| Password recovery | At most1 owner-requested email through the CAPTCHA form to their own existing account. This accepts the newly enforced request path; accepted Brevo transport/templates are not reinvestigated. Do not redeem the link or change the password for this step. |
| Stop/recovery | Stop on unexpected denial or account/session behavior; no automated retry. If legitimate owner login is blocked, the owner may disable only the newly enabled CAPTCHA once to restore the previous backend state, then report the result. No automatic rollback, key rotation or other setting change. |

No new accounts, password changes, automatic historical claims, guest attachment,
public signup/purchasing, PDC, payment/shipping transaction, app/runtime/Caddy/schema
change, restart, accepted SMTP/origin/quota change or Git push is included.
Existing30/hour/60s and30-per5min/IP limits remain. No Management API403 investigation.

## Completed owner actions under the received approval

The configuration and successful owner actions below are completed history;
do not repeat them under the exhausted2f scope. The remaining one-request
qualification has a separate approval.

1. Recheck the configured frontend and closed signup gates; stop on drift.
2. In the production Supabase Dashboard, open **Authentication → Bot and Abuse
   Protection → CAPTCHA protection**. Select **Turnstile**, enter the matching
   **Secret Key**, enable CAPTCHA and save. Keep signup disabled and confirmation
   required. Report only `CAPTCHA enabled` or the failure; never send the key.
3. After the bounded negative checks, perform the existing customer/staff login
   checks and one recovery request above. Report results only.

Supabase documents this provider/Secret Key location and supports signup, login
and reset tokens. [Official Supabase instructions](https://supabase.com/docs/guides/auth/auth-captcha).
Supabase performs server verification. No Nuxt Secret Key or custom Siteverify
proxy is needed. Client widget success does not prove server protection.
[Cloudflare server validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

Enforcement acceptance does not accept normal public signup. With signup closed,
a positive genuine registration cannot be exercised. After this stage passes,
review the separate signup activation window and an explicitly owner-controlled
mailbox, preserving existing Supabase identities and account isolation. The
historical owner match has no orders; archived-profile/empty-history acceptance
and later authorized order-bearing detail acceptance remain distinct.
No executable public signup activation phrase is issued here.
