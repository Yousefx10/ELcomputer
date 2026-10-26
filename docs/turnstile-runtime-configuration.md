> **2026-10-26 current state:** [E50 scoped Auth acceptance](turnstile-auth-acceptance-receipt.md)
> is complete; Supabase Turnstile is enabled. Signup/purchasing remain disabled and
> PDC paused. Earlier backend-OFF/pending descriptions below record preparation,
> not current state or authorization to rerun consumed checks.

# Turnstile frontend configuration — 2026-10-26

**Frontend configuration DEPLOYED PASS; exact7b approval consumed.**
[Authoritative execution and qualified browser receipt](turnstile-runtime-deployment-receipt.md).
Public provider/Site Key are installed with one app restart; release5a/schema94
unchanged. Supabase enforcement/signup/purchasing remain closed. Earlier READY/
approval-pending text is preparation history and must not be executed again.
The [next manual enforcement acceptance](turnstile-auth-acceptance-plan.md) has
its own separate approval; no Secret Key was received.
The first approved attempt stopped during runtime recovery, before any target
mutation or restart. Its approval is consumed. The local adapter correction and
replacement packet are recorded in the [STOP receipt](turnstile-runtime-stop-receipt.md).
The missing shared-backup input is corrected and regression-tested.
Public signup remains BLOCKED. CAPTCHA enforcement and purchasing remain off.
PDC remains paused. No new application deployment is required.

## Current implementation

Production remains `5a38201292763325` / schema94, source `3001cd6`.
The [approved code deployment](public-signup-deployment-receipt.md) is consumed.
Do not rerun its apply command or old-baseline check.

The deployed frontend already includes:

- Shared `app/components/auth/Turnstile.vue` and a lazy vendor-script loader.
- Managed widget support, EN/AR, RTL, resolved Light/Dark and compact mobile sizing.
- Supabase `options.captchaToken` on customer signup and password login.
- `captchaToken` on password recovery and Dashboard password login.
- Token invalidation on expiry, timeout, failure, mode change and submission.
- Explicit retry/reset, stale-callback guards and widget cleanup on unmount.
- Generic errors and existing confirmation, redirects, RBAC and ownership checks.

Tokens stay in memory. The component disables vendor response fields.
There is no client Secret Key, custom verification proxy or customer lookup.
Recovery-link password updates retain their existing verified-session flow.

The public runtime inputs are `NUXT_PUBLIC_AUTH_CAPTCHA_PROVIDER` and
`NUXT_PUBLIC_TURNSTILE_SITE_KEY`. They are now configured on the server; Supabase CAPTCHA enforcement remains off.
No credentials or deployment hostname were added to reusable application logic.
Managed mode and allowed hostnames belong to the Cloudflare widget settings.

## Focused validation and limits

| Evidence | Result and boundary |
| --- | --- |
| Fresh Auth/widget/Dashboard/readiness and runtime operator checks | 23 JavaScript + 7 Python checks PASS, zero failures/skips. Guards reject wrong/consumed approval, expanded scope, secret fields, stale recovery and duplicate/injected configuration. Atomic activation fixture proves one restart and no automatic retry/rollback. The actual shared remote capacity guard rejects the old missing archive_bytes input and accepts the corrected recovery adapter. |
| Deployed application identity | All759 application/server/public/locale/config/package/schema inputs match the consumed deployed plan.94 migrations. No application or session-isolation code changed. |
| Retained deployed qualification |28 focused tests,33 current session/checkout/Paymob checks including local A/B browser components,6 release guards, unchanged native94 concurrency proof, typecheck/build PASS. Exact archive:15 scenarios/36 screenshots/1640 client-byte checks; official dummy widget tokens reach SDK requests. No hosted Auth or emails in those fixtures. |
| Real public Site Key, actual live origin | PASS in a fresh anonymous Chrome profile on the deployed HTTPS login page. Public configuration changed only in that tab. Cloudflare loaded and a token became available; only the success boolean was recorded.6 Cloudflare client requests; no captured token values, credentials, Auth submissions or production writes. |
| Failed local/automated previews | Retained. Owner saw a failed check; no diagnostic error code established. A headed preview also ended on a screenshot timeout. These do not establish the cause of the challenge failure. The later genuine-origin widget passed. |
| Preview cleanup | Functional success was saved before an anonymous-profile deletion race. Only the task-created profile was removed; cleanup PASS. The script now waits for Chrome termination and retries profile deletion. No successful widget rerun was needed. |
| Supabase Secret Key pairing / enforcement | PENDING. No secret was received, no CAPTCHA setting changed, and no token was redeemed by Supabase. |
| Hosted signup/login/recovery with enforced CAPTCHA | PENDING separately approved backend configuration and scoped acceptance. Public registration remains closed. Existing accepted Brevo confirmation/recovery results stand; no test email was repeated. |

Cloudflare documents that automated browsers can fail real challenges.
Official dummy keys provide predictable automated tests.
This explains the preview's limits, not its unobserved failure cause.
[Cloudflare testing guidance](https://developers.cloudflare.com/turnstile/troubleshooting/testing/).
Supabase supports CAPTCHA for signup, login and password reset.
[Supabase CAPTCHA integration](https://supabase.com/docs/guides/auth/auth-captcha).

The frontend real-key check is not complete hosted Auth acceptance.
It does not prove the owner-held Secret Key matches this Site Key.
No accounts, passwords, ownership claims or historical orders were changed.

## Guarded frontend-only packet

Private replacement packet: `../turnstile-runtime-recovery-fix-20261026/`.
Source: `source/`, branch `local/turnstile-runtime-recovery-fix-20261026`.
Operational commit: `31ecdd2e4256b603b2455c37e3aefc00df031063`.
This corrects the shared backup adapter and adds its regression test.
The original sealed source remains preserved; no application release is added.

The sealed operator is `scripts/turnstile-runtime/operator.mjs`.
Its scope permits only these changes to `/etc/storefront/runtime.env`:

```dotenv
NUXT_PUBLIC_AUTH_CAPTCHA_PROVIDER="turnstile"
NUXT_PUBLIC_TURNSTILE_SITE_KEY="<owner-provided public Site Key>"
```

All other runtime values and bytes are preserved.
The key comes from a private operational input file, not application source.
Existing root ownership and mode0600 remain enforced.
The candidate uses the installed application on a private loopback port.
Only one production application restart is permitted.
The release symlink, schema94, Caddy, Auth policies, credentials, media,
private files, callbacks, current accounts and history remain bound.
No app build/install/switch, SQL, provider transaction or Git push is allowed.
Signup, purchasing, payment/shipping initiation and CAPTCHA enforcement stay off.
Returning-customer notice configuration also remains unchanged.

Seal: `7b9038186919a03ca16138845e90642dffdc53a49cd0eaa303654fdc9a413f15`.
Approval executed once/CONSUMED_COMPLETE. Execution intent and completed receipt exist. Never rerun apply/check.
Fresh recovery verified **2026-10-26 03:40:02.140 Riyadh**;
expires **2026-10-26 09:40:02.140 Riyadh**.
Encrypted database full readback:12839997 bytes. Runtime readback:10 files.
Sealing and independent read-only target/schema/Auth/preservation checks PASS.
Private `read-only-check.log` records READ_ONLY_CHECK_PASS/target_writes0.

Consumed frontend approval (historical; never repeat):

```text
APPROVE TURNSTILE FRONTEND CONFIG 7b9038186919a03ca16138845e90642dffdc53a49cd0eaa303654fdc9a413f15
```

This authorizes only frontend runtime configuration and one restart.
It does not authorize Supabase CAPTCHA enforcement or public signup.
An expired or drifted packet must be refreshed before execution.

Fresh read-only checks, encrypted recovery/full readback, private candidate and
postflight are mandatory. The approval is single-use. Stop on drift or failure.
No automatic retry or rollback; recovery requires a separately reviewed action.
Never restore a database over newer users or orders.

## Keys and approval sequence

1. **Frontend configuration completed.** The guarded operator wrote the
   public Site Key to the two runtime inputs above. No Secret Key is needed.
   Configured customer/Dashboard pages and closed gates passed qualification.
2. **Supabase enforcement is a later approval.** Only after configured frontend
   verification, the owner enters the matching Secret Key directly in the
   production Supabase Dashboard: **Authentication → Bot and Abuse Protection →
   CAPTCHA protection**, provider **Turnstile**. Supabase also labels this path
   Settings → Authentication → Bot and Abuse Protection. Do not save/enable yet.
   See the [official settings instructions](https://supabase.com/docs/guides/auth/auth-captcha).
3. **Hosted enforcement acceptance stays bounded.** Plan approved owner-controlled
   login, negative/missing-token checks, recovery and Dashboard continuity.
   Signup SDK wiring is locally accepted; genuine registration/confirmation needs
   a separate signup activation window and an authorized test identity/mailbox.
   An off enforcement toggle cannot prove backend rejection or key pairing.
4. **Public signup activation remains separate.** No executable public activation
   phrase is issued now. Purchasing/PDC stay closed throughout this stage.

Never send the Secret Key in chat, Git, Nuxt code or a public environment value.
No hostname expansion, wildcard, localhost allowance or key rotation is needed.

## Continuity and next gate

The original12 worktrees remain intact; the isolated correction makes13 worktrees
and10 local branches. Main remains at `ea113e9` with91 migrations.
Use the schema94 descendant above for this work. No automatic merge, rebase,
reset, worktree deletion or push. The detached `c3775e8` context is preserved.

The owner's ordinary verified historical match has zero archived orders.
Owner profile/empty-history acceptance is still pending; it is not order-detail
acceptance. A later order-bearing case needs an authorized actual customer and
verified original mailbox. Never impersonate customers or attach guest orders.
Existing Supabase identities, session isolation and ownership denials remain bound.

Keep the owner-verified30 Auth emails/hour,60 seconds/address and30 requests per
five minutes/IP limits initially. Consider a quota increase only after observed
Beta demand and verified Brevo headroom. No Management API403/SMTP reinvestigation.

**One next purchasing milestone remains BETA-07: official PDC destination mappings.**
PDC is paused now. EGP50 shipping, CARD/callbacks, deployed zero-stock behavior,
Dashboard booking, cancellation/refunds, a complete genuine hosted order and
emergency purchase-disable acceptance retain separate milestones.
