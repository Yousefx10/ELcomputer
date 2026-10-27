# Password recovery acceptance — E70, 2026-10-27

**AUTH-RECOVER-OUTLOOK-01: PASS — owner-reported functional smoke-test results.**
**BETA-02 recovery acceptance: ACCEPTED for this controlled customer flow.**

The owner reports:

- Supabase Site URL and the approved EN/AR recovery redirects were already correct;
  no URL configuration change was required.
- The Reset Password email template was updated as reviewed.
- Password update: **PASS**.
- Sign-in with the new password: **PASS**.

These results complete the owner-only acceptance following
[E69's deployed repair](password-recovery-deployment-receipt.md). They establish
actual reset redemption/password updating/new-password login for the selected
ordinary customer, rather than email delivery alone. Previous E68 corrections
remain historically valid; this new acceptance does not retroactively certify
the older unexercised flow or every browser/locale.

Read-only metadata at02:59:18 Riyadh confirms the same privately bound UUID remains
confirmed, active, nonanonymous and nonadmin, with a recent sign-in at02:55:04.578
Riyadh. This supports the owner report; it does not independently inspect the
password, email contents, template editor or browser session. No password, token,
reset URL, password/hash value or cookie was requested or captured.

The approved recovery acceptance is complete. No repeat recovery email, link
redemption, password change, signup/Turnstile or A/B test is needed. The precise
original Outlook failure trigger remains unconfirmed and is no longer a launch
blocker after this bounded functional PASS. The deployed session-proof correction
and all prior local/guarded evidence remain intact.

## Current production and purchasing continuation

At03:01:32 Riyadh, fresh read-only checks confirm release `11cb391b2497b703`, source
`5b090772228494989b7d7eb0fbb28690ef6c8316`, schema95, unchanged app/Caddy processes,
runtime, file inventories and restrictive gates. Signup is OPEN, email confirmation
required, accepted Turnstile runtime preserved. Cart/Checkout remain403; anonymous
history401. Paymob initiation remains OFF and PDC PAUSED. No agent Auth submission,
email, password/configuration write, deployment, order, payment or provider action.

The [controlled purchase](final-controlled-purchase-review.md) continues with:

| Input | Fresh result |
| --- | --- |
| Product / model / quantity | mousepad WOLF / Default /1 |
| Current price | EGP25; published normal-sale product and active model |
| Customer | Same recovered verified ordinary customer, privately bound |
| Proposed Manual delivery / card fee | Approved EGP50 / current EGP0 |
| Proposed total | EGP75 /7,500 minor units; no coupon |
| Existing customer orders / payment attempts |0 /0 |
| Saved recipient | Address line1, city, governorate and valid mobile still missing |
| Manual company / untracked configuration | Approved draft; not installed/applied |
| Purchase authorization | NONE; unsigned draft only |

The owner now saves the real recipient and Egyptian mobile in My Profile, without
sharing the address in chat. Do not use the old A marker or invent a destination.
Then bind the normalized saved address and qualify/seal the exact one-customer/
product/model/amount/durable-command/one-charge activation and closure packet.
Use the existing approved Manual50/untracked/ENAR delivery-information changes;
keep PDC/company/incident barriers and global public purchasing unchanged.
Only the owner will create the order and submit the card after separate approval.

The unsigned purchase draft now binds the current11cb release and preserves its
previous unused durable command. The qualified Caddy proposal is byte-identical
to its earlier version/current closed policy; no old functional tests were repeated.
No new exact approval can be issued while the real recipient hash is missing.

Private evidence: `../controlled-purchase-after-recovery-20261027/`, including
`owner-recovery-acceptance.private.json`, `current-readiness.private.json`,
`current-gates.json`, `production-readonly.private.json`,
`controlled-scope-draft.private.json` and `PURCHASE-READINESS.json`.
All32 deferred tests, schema96, original branches/worktrees and the post-Beta
VPS Storage audit remain preserved and incomplete. Public purchasing activation
still requires its own later explicit approval after controlled purchase PASS.
