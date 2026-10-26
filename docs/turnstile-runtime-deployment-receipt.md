# Turnstile frontend configuration PASS — 2026-10-26

**The public frontend configuration is installed. Supabase enforcement stays off.**
Public signup and purchasing remain closed. PDC remains paused.
The exact7b approval is consumed; never rerun its operator or old-baseline check.

## Exact execution

Owner approval: `APPROVE TURNSTILE FRONTEND CONFIG 7b9038186919a03ca16138845e90642dffdc53a49cd0eaa303654fdc9a413f15`.
Operational source: `31ecdd2e4256b603b2455c37e3aefc00df031063`.
Private packet: `../turnstile-runtime-recovery-fix-20261026/`.
Completed receipt recorded **2026-10-26 03:48:38.214862 Riyadh**.
Result: `FRONTEND_CONFIG_PASS`, exit0, `CONSUMED_COMPLETE`.

Only these public inputs changed in `/etc/storefront/runtime.env`:

```dotenv
NUXT_PUBLIC_AUTH_CAPTCHA_PROVIDER="turnstile"
NUXT_PUBLIC_TURNSTILE_SITE_KEY="<owner-provided public Site Key>"
```

Root ownership and mode0600 retained. Exactly one application restart occurred.
Application release `5a38201292763325`, deployed source3001cd6 and schema94 are
unchanged. No app build/install/release switch, SQL, Caddy or Supabase setting.
All759 deployed application inputs match, including session-isolation code.
Current accounts/passwords/ownership/history, media, private files, callbacks and
payment/shipping initiation holds passed mandatory preservation checks.
The returning-customer notice runtime value remains unchanged/off.

## Validation and evidence boundary

| Evidence | Result |
| --- | --- |
| Mandatory preflight | Exact target/runtime/source/tool/seal/freshness/Auth/schema/protected data/ownership checks PASS. |
| Execution recovery | Fresh encrypted12841108-byte database dump, authenticated/full pg_restore readback PASS;10 runtime files/full byte readback PASS. |
| Private candidate | EN/AR customer login and Dashboard login200 with configured public key; anonymous history/shipping401; purchase/CARD availability false. Candidate stopped; installed release unchanged. |
| Mandatory postflight | Installed runtime hash matches sealed proposal, app restart count1; release/schema/Caddy/media/private/assets/other runtime files retained. DB/Auth/history/ownership preserved. EN/AR/Dashboard200, Cart/Checkout403, anonymous history401. |
| Retained focused qualification |30 checks PASS:23 JavaScript/7 Python, including the actual shared recovery capacity regression. Existing deployed Auth/widget/SDK/session/checkout/Paymob/native94/build qualification reused; no app changes. |
| Configured frontend browser acceptance | PASS for EN login/Light/1280px, AR password recovery/Dark/RTL/320px and actual Dashboard password form/Light/1280px. Each received a real widget token, recorded only as a boolean. Translated labels loaded, no raw translation keys, no horizontal overflow/page errors. No runtime override. |
| Browser guard | Fresh anonymous profiles, interception before navigation, credential inputs disabled, every Auth mutation blocked.0 Auth submissions/emails/secrets/account/password/claim changes. Profiles removed.52 Cloudflare client requests across the retained inspections;0 payment/shipping provider transactions. |
| Supabase token redemption | NOT EXERCISED. Secret pair/enforcement and authenticated login/recovery acceptance remain pending their separate approval. A widget token alone does not establish server enforcement. |

The initial inspection helper blocked published locale assets and selected a
storefront search submit before the Dashboard login button. Its broad PASS is
restricted to runtime/widget observations; it is not language/Dashboard-token
acceptance. These were inspection-only defects, with no production code change.
EN/AR were qualified after allowing only published locale GETs. A separate final
Dashboard check bound the password form, asserted one matching submit and checked
the translated label/token. Raw/incomplete inspection evidence is preserved.
`configured-frontend-acceptance.json` binds the qualified component evidence.
Screenshots were reviewed for AR mobile/Dark and Dashboard desktop.

Private authoritative receipts: `OWNER-FRONTEND-CONFIG-APPROVAL.json`,
`execution-intent.json`, `approved-execution.log`, `execution/completed.json`,
`execution/activate.json`, `execution/candidate.json`,
`execution/backup-verification.json`, `FRONTEND-CONFIG-RECEIPT.json`,
`configured-frontend-acceptance.json` and `APPROVAL-STATUS.json`.
The earlier a8 [STOP and adapter correction](turnstile-runtime-stop-receipt.md)
remain separate consumed evidence. No old approval was retried or repurposed.

## Next exact step

The [manual Supabase enforcement acceptance plan](turnstile-auth-acceptance-plan.md)
is prepared only. Its scope is separate from the consumed frontend approval.
No Secret Key was received and no backend setting/test was performed.
After new approval, only the owner enters the Secret Key directly in Supabase.
Public signup activation and genuine registration remain a later review.

Both handoffs and the master roadmap are updated together.
All13 worktrees/10 branches and original46 source paths remain; main still91
migrations at ea113e9. No merge/rebase/reset/delete/push or unrelated implementation.
One next purchasing milestone remains BETA-07 official PDC destination mappings,
after signup readiness and resumption approval. PDC stays paused now.
