> **E145,29October2026:** 1e931d20d19bde5a/schema104 DEPLOYED INACTIVE. Approval e2663f CONSUMED_COMPLETE; never replay. One migration/restart, all3,129 assets and next automatic18:00:07 MON PASS. Configured Email revision2/key/sender preserved; all sending/capture/worker controls OFF, no email/provider request. [Receipt](customer-email-schema104-deployment-receipt.md). ONE private controlled test requires separate preparation/approval.

> **E144,29October2026:** configured Email revision2 remains intact and OFF in the sealed inactive104 release preflight. [Deployment review and exact approval](customer-email-schema104-release-review.md). No new save, Brevo request, send, worker or Auth SMTP access. Configuration receipt below remains completed evidence.

# E143 — disabled Dashboard Email configuration receipt

29 October2026, **16:12:47 Riyadh — READBACK PASS / OUTBOUND OFF**.

The owner reports saved/Disabled, all five activation controls unchecked and sender
verified YES. Fresh read-only SQL confirms revision**2**, an encrypted application
key and one sender matching the approved ELCOMPUTER / info@elcomputer.net identity.
The sender is stored as verified; external Brevo verification remains the owner's
confirmation. No API authentication test or delivery proof is inferred.

| Readback | Observed result |
| --- | --- |
| Key | Present, encrypted format valid. Neither key nor ciphertext selected. |
| Provider/account/activation/marketing/webhook | All five false. |
| Sender | Exact approved sender/name and brand match; stored verified. |
| Worker/webhook credentials | Both absent. |
| Other configuration | Reply-To, marketing sender, payment alert recipient and unsubscribe origin empty; timeout10000. |
| Templates/messages/attempts/events | All zero. |
| Application/schema | Same9aa61b64c2c5cf9f / schema103; proposed104 absent. |
| Commerce/MON | CARD and COD live; automatic16:10:06 complete, five retained warnings/zero critical. |
| Real order intake | Zero genuine COD orders; zero new orders since COD activation. |
| Codex activity | Read-only host/SQL/public capabilities only; no provider API call, credential decryption, Auth SMTP access, settings write, send, deployment or restart. |

The configuration-only milestone is complete. Revision2 is the observed baseline
for later work; do not repeat a save, restore revision0/1 or re-enter the key to
prove its presence. The next independent action is inactive schema104 release
qualification against the current runtime/configuration. Preserve every existing
Email setting, keep future capture/worker OFF and create no history backlog.

Deployment, one controlled send and future automatic capture/worker activation
remain separate approvals. Provider authentication, actual delivery, remaining
customer email events and owner acceptance remain unfinished. No executable
release/send seal is issued by this receipt.

Private evidence: `../customer-email-disabled-readback-20261029/host.json`,
`database-readback.json`, `readback-pass.json` and preservation/completion receipts.
The old guide and review below retain their dated boundaries.

---

# E142 — approved private Dashboard configuration guide

29 October2026. **OWNER-GUIDED SAVE AUTHORIZED / OUTBOUND OFF / RESULT PENDING.**

Owner reports the dedicated key is prepared: Restricted, Transactional email All,
all other resources None. Keep this scope. The key stays private; Codex has not
received or tested it. Brevo's [permission reference](https://help.brevo.com/hc/en-us/articles/40158277171474-About-API-key-permissions)
confirms Transactional email offers None, Read and All, with sending included in All.
No account/contact/webhook permission is needed to store settings in this app.

Open the existing authenticated **Dashboard → Email → Provider settings**, path
`/dashboard/email?tab=settings`. Reload before editing to use the latest revision.
If an existing sender/key, enabled controls or encryption error differs from the
expected empty/OFF state, stop and report the non-secret state before replacing it.
Do not capture screenshots while entering the key.

1. Set **Brand name** to `ELCOMPUTER`.
2. Under **Approved senders**, choose **Add sender**. Set **Email address** to
   `info@elcomputer.net` and **Sender name** to `ELCOMPUTER`. Keep **Verified in Brevo**
   unchecked unless Brevo already confirms that exact sender. Saving it unverified
   while delivery is OFF is allowed; do not request a verification email in this step.
3. Select `info@elcomputer.net` as **Default transactional sender** after adding it.
4. Paste the dedicated key into **Brevo API key**, the password field. Keep both
   **Remove saved secret** checkboxes unchecked. Leave **Webhook Bearer token** empty.
5. Leave every one of these five controls **unchecked**:
   **Transactional account approval confirmed**, **Sending activation confirmed**,
   **Enable email provider**, **Enable future marketing delivery** and
   **Enable authenticated webhook**. Do not change Reply-To, Payment alert email,
   Marketing sender, unsubscribe origin or timeout. The API endpoint is read-only.
6. Click **Save** once. Expect **Saved.**, key status **Saved securely; hidden.**,
   an empty key input and the top **Disabled** badge. Reload and verify those states,
   the saved sender and all five unchecked controls. **Complete provider setup
   before sending.** is expected because activation is deliberately incomplete.

The save handler does not call Brevo, send mail, enable scheduling or access Auth
SMTP. It needs no migration or restart. Do not use Manual transactional email or
Queue email. If save returns a conflict or uncertain error, reload to inspect the
saved state before another submission; report only the error text and non-secret
status, never the key. Codex has not performed a settings save or fresh live readback.

After saving, the owner can report: **Saved securely; Disabled; all five controls
unchecked; sender verified YES/NO.** Provider authentication, actual sender/domain
qualification, inactive104 deployment and one controlled send remain separate.

---

# CX-EMAIL-01 — smallest next independent step, E141

29 October 2026. **LOCAL RESUME QUALIFIED / EMAIL OFF / NO PRODUCTION APPROVAL.**

Owner decision **OD-20261029-EMAIL-RESUME-01** permits email preparation while waiting
for genuine COD orders and provider responses. Real COD intake/approval/packing
remains first priority. No synthetic store order, PDC/Paymob investigation, shipment,
provider API request, configuration save, migration, deployment or email occurred.

## Current live boundary

Read-only check at **14:36:22 Riyadh** confirms release9aa61b64 / schema103.
CARD and COD remain available. MON-01 is active. Its automatic14:35:05.630 report
completed with five retained warnings and zero critical alerts.
There are **zero COD orders and zero new orders** since COD activation.
Two existing pending CARD orders remain unverified. The existing paid/packed CARD
shipment stays quarantined; it is not a COD candidate or test shipment.

Application Email is revision0, **disabled and unconfigured**:

- No application API key, transactional sender or approved sender.
- Account/activation, marketing and webhook flags all false; worker secret absent.
- Encryption-key presence verified as a boolean only.
- Templates, messages, attempts and events are empty; schema104 remains absent.
- No Auth SMTP credentials were inspected, extracted, reused or modified.

Dashboard Email redirects anonymous visitors302 and its settings API rejects
anonymous access401. This verifies route/authentication boundaries, not a successful
authenticated settings save. No Caddy or permission change is needed for this step.

## Existing schema104 candidate reused

The original branch `local/customer-order-emails-20261029`, source444c8fd,
is directly based on deployed8d75404. All five qualified code/migration hashes
match the previous receipt. No code change, merge, reset or new migration number.

Retain the existing **31 focused checks, typecheck/build PASS**, native142-table
preservation/rollback and383 unrelated function contracts. Those checks were reused,
not rerun. Six bilingual previews remain available; no owner/delivery acceptance is
inferred. Actual live104 migration/release/operator preparation is still separate.

New offline qualification exercised the existing settings validator with a local
canary key and owner-selected sender: encryption, all-off settings, false readiness,
public-response/private-recipient redaction, stale revision rejection, forbidden
encrypted-input rejection and accidental activation reset. A verified sender alone
also cannot enable delivery. **10 focused configuration checks PASS**, no database
order creation, production credential use or external network request.

This increment supports order-received CARD/COD and coherently verified-live-CARD
payment receipts. COD copy says cash is not collected. Shipping, cancellation,
verified COD collection/remittance notices and reminders remain unfinished scope,
not silently marked complete. Existing unknown reset-table coverage stays fail-closed.

## Smallest next action: dedicated application sender/key

The owner-selected From remains **ELCOMPUTER <info@elcomputer.net>**. It is deployment
configuration, never a reusable application default. Its Brevo sender/account
verification is not established by naming it or checking the app's Verified box.

Privately prepare the separate **Brevo application API key** and confirm that sender
and domain in Brevo. API authentication and SMTP credentials are distinct; the
installed application uses the REST API. Leave the working Supabase Auth SMTP key
and settings untouched. Brevo documents [API-key setup](https://developers.brevo.com/docs/api-key-authentication)
and requires [sender/domain configuration before sending](https://developers.brevo.com/docs/send-a-transactional-email).
No provider account, DNS or verification-email action was performed by Codex.

Keep keys out of chat, Git, screenshots and reports. Enter the dedicated key only
through the existing authenticated Dashboard Email password field when the scoped
configuration save is approved. The known private test-only mailbox stays in its
private packet; it is not a customer recipient default or a configured monitor address.

## Concrete configuration-only approval scope

After the private key and actual sender evidence are ready, the required approval
covers **one revision-bound application Email settings save**, starting at the
then-current configuration. Current observed baseline is revision0; drift requires
a fresh read-only review rather than an unconditional save.

| Item | Permitted scope after that approval |
| --- | --- |
| Entry point | Existing authenticated `/dashboard/email?tab=settings` and settings API, with existing Email view/manage authorization. No staff impersonation or permission change. |
| Credential | Save one dedicated application API key through existing encryption. No Auth SMTP extraction/rotation or webhook secret. |
| Identity | Owner-selected From/name, transactional sender and brand. Sender Verified can be true only with actual Brevo evidence; otherwise retain false. |
| Gates | Provider, account approval, activation confirmation, marketing and webhooks remain false. Worker remains absent/off; order capture remains unavailable/off. |
| Unrelated settings | Keep marketing sender, monitor recipient, reply-to, unsubscribe settings and all other configuration unchanged unless separately reviewed. |
| Expected effects | One settings revision/audit. Empty queue remains empty; no order/event backfill or message/attempt creation. |
| Exclusions | Zero sends/provider API calls, migration, deployment, restart, worker scheduling, CARD/COD/MON changes, PDC action or Git push. Provider key creation/rotation, DNS changes and verification emails are outside this application save scope. |

The save needs **no migration or restart**. Existing validation automatically clears
delivery/account activation when key/sender identity changes; all-off flags are also
explicit. Readback checks credential presence only, approved identity/evidence, false
gates, empty queue, current commerce/MON and untouched Auth. Never log credential text.

**No executable configuration/send/deployment seal is issued now:** the dedicated
private credential and provider sender evidence are still missing. This document
defines the next approval scope; it is not permission to save or send.

## Later independent approvals

1. Prepare and qualify an **inactive schema104 migration/application packet** on the current
   COD-active runtime, retaining both payment methods, callbacks, monitor and emergency
   controls. Keep provider/capture/worker off; no history backfill. Deploy only after
   exact release approval. Do not reuse a pre-COD runtime or an old consumed operator.
2. Prepare a separate **one-message controlled-send approval** with exact private
   recipient, From, reviewed content, stable intent, expiry and one dispatch budget.
   Test neither a genuine customer's order nor the quarantined shipment. Provider
   acceptance is separate from actual mailbox delivery; uncertainty cannot resend.
3. Only after evidence and owner acceptance, prepare order-email/worker activation
   for future qualified events. No marketing, Claims or MON email activation as a
   side effect. Keep the rest of CX-EMAIL-01 and all deferred tests visible.

**ONE next independent action:** privately prepare the dedicated application API key
and confirmed Brevo sender; then obtain the disabled configuration-only approval
above. Existing local previews/dedup evidence are ready for that step. Real COD
orders preempt email preparation when an eligible order arrives.
