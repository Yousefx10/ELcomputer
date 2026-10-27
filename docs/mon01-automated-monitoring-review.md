> Superseded by [E96 Dashboard-first core](mon01-dashboard-core-review.md). Email is optional and does not block the core. Auth SMTP credentials remain untouched.

# MON-01 — local candidate; deployment blocked — E95

Reviewed 27 October 2026, Asia/Riyadh. Public Beta remains LIVE.
**No deployment, production restart, notification or business mutation occurred.**
The existing approvals are not authorization to deploy this candidate.

## Immediate Beta review

Read-only database checkpoints: **22:24:25,22:32:45,22:45:51 Riyadh**.
Latest in-memory worker qualification: **22:47:21 Riyadh**.
Since the preceding21:51:28 checkpoint: new orders0, new attempts0,
new transactions0, changed prior attempts/transactions0. There remain two existing
LIVE successes and one pending attempt. No orphan, duplicate, amount mismatch,
charged-but-unpaid or ownership-command mismatch was found.

- ORD-20261027-A5FC5269EA, EGP3149: owner-reported incomplete friend test;
  provider outcome **UNVERIFIED**, local pending/paid0, no signed transaction.
  No provider inquiry was attempted. Expiry is not nonpayment evidence.
- WOLF ORD-20261027-D42FA123A8 remains Paid / Processing / untracked,
  packing incomplete, no shipment. No test goods were marked fulfilled.
- Global worker inspection also reports the existing23October paid PDC order as
  old staff backlog. It is not a new Beta sale or new shipment authorization.
- Appa402cf24a9685e0d, schema98, PID55343/NRestarts0; CaddyPID26652.
  Public signup/CARD/Manual50 remain available, Manual coverage28. Callback
  reconciliation remains inaccessible to anon/authenticated database roles.
  HMAC/configuration and PDC pause are unchanged.
- Cart/Login/capabilities200. No identified callback/checkout/account failure in
  the last reviewed interval. One earlier incomplete proxy response was counted
  between22:24–22:32; available evidence does not identify it as a checkout failure.
  Per-request access logging remains absent. Unclassified error markers are not
  proof of successful or failed checkout.

**PUBLIC BETA: WARNING**, due to the unresolved friend attempt, incomplete
automation/notification configuration and monitoring gaps. No critical payment
integrity defect was established. Preserve existing purchasing availability while
staffed monitoring and fulfillment coverage remain available. Next staffed check:
**23:00:52 Riyadh**. No unattended background job was started in this work.
The22:06 and22:21 scheduled checks have no timely receipts:15 historical missed
checkpoints are now recorded. Catch-up ledger reads do not restore real-time staff
coverage for those intervals.

## Smallest implementation

Isolated source branch `local/mon01-payment-monitor-20261027`, commit
`5ea264a435f1ddbb2a6e2b045b2208dfbd2edd82`, based on deployed source113b313.
Main and all existing worktrees/commits were preserved; no Git push.
Unit-only follow-up60e9fdd loads the private worker config through systemd credentials;
application code/build remain5ea264a. Installed unit acceptance is still pending.

1. One Python standard-library worker and one persistent systemd five-minute timer.
   Fixed GET-only Supabase projections; no RPC, Paymob inquiry, callback replay,
   expiry, cancellation, stock release, payment retry or automatic kill switch.
2. Signed-ledger/order/amount/duplicate checks; overdue/provider-uncertain outcomes
   remain UNVERIFIED. New paid orders are separated from existing staff backlog.
   Public health, unchanged callback proxy configuration and available journal
   categories are observed. A403 GET to a POST-only callback route is expected;
   it is not proof of working signed POST ingress.
3. Private atomic status report, successful-check heartbeat, bounded receipt/gap
   history, overlap lock and SQLite alert identities. Unchanged exceptions do not
   send again. SMTP dispatch is claimed before sending: ambiguous delivery or crash
   stays UNVERIFIED, without an automatic resend. SMTP acceptance is not delivery.
4. One **Payment alert email** field in Dashboard → Email → Settings, EN/AR and
   existing compact form. Existing named permissions, request protection, audited
   settings command and optimistic revision apply. Blank pauses email alerts.
   The existing settings-save queue-retirement contract is retained.

Owner-bound recipient: **info@elcomputer.net**. Addresses and deployment targets
remain operational configuration, never reusable application constants.

## Focused evidence

**17 worker tests +2 Dashboard/settings tests PASS**. They cover pending uncertainty,
signed-success mismatches, duplicate charge evidence, decimal/ownership checks,
server row limits/global coverage, restart/deduplication, dispatch crash uncertainty,
recipient changes, missing configuration, incomplete checks, bounded receipts,
gap persistence, lock/capacity/staleness, TLS-before-login, redaction, existing
permission/revision enforcement, and EN/AR template compilation. Fixtures only;
no real mail, customer session or payment test was repeated.

Nuxt production build PASS. All **2,267 browser assets** returned200 with matching
SHA-256 through a local Caddy asset handler, including all2,161 retained assets.
Private-key/service-role/password scan PASS. Review archive SHA-256:
`5821a3560bf52905d286752c8a8bcd97f533b415ed6fe81d77a8b4178b24a660`.
This is an artifact fingerprint, **not an approval seal**.

In-memory production qualification read three ledger orders through the actual
GET transport, checked Manual/health/journals and accepted the timer expression.
It wrote no production files and sent no notifications. The installed service
sandbox, timer restart behavior, SMTP login/delivery and Dashboard browser save
remain unexercised. Local tests/build do not establish hosted acceptance.

Private evidence: `../mon01-automated-monitoring-20261027/` contains immutable
health checkpoints, inventory, qualification, test/build and review receipts.

## Notification configuration and guarded release gates

The application Brevo API configuration has **no key, approved sender or active
provider**. The approved Auth SMTP transport is hosted separately. No accessible
reusable SMTP profile was supplied or discovered in the checked operator/runtime
configuration. No new credential or test email is authorized. The owner was asked
for a secure path to the existing SMTP profile, or confirmation it exists only in
Supabase. Never send its password/token in chat.

Required existing configuration: approved SMTP host, TLS port465/587, username,
sender and existing password, via a private configuration reference. Do not create
a provider key. Deployment must bind that profile and the owner recipient, and
initialize only `config.monitor_recipient` through the existing audited command
with a valid staff actor/revision. Keep every provider activation flag/secret intact.
The worker receives only its existing Supabase/SMTP credentials via systemd
credentials; it never receives customer sessions or the full storefront runtime.

Before issuing an exact deployment approval:

- Bind existing SMTP access without a new key or test message.
- Freshly qualify/seal the application + worker installer, sandbox, backup/recovery
  evidence and preservation guards against the current LIVE baseline. No migration
  or Caddy change; one proposed application restart for the Dashboard field.
- Preserve the emergency kill capability across the new application release.
  The existing single-use operator validates the a402 release and assets, so it
  cannot simply be assumed valid after an app switch. Prepare and qualify an
  explicit new binding that shares the original unconsumed kill-intent budget;
  never edit/rerun the consumed activation operator or create a second kill budget.
- Include real operational alerts to the reviewed address in the exact approval;
  test notifications remain separately approval-gated. Verify delivery using the
  first authorized operational alert and owner observation.

An on-host monitor cannot alert while its VPS/network is down. No off-host deadman
channel is configured. Staff must independently check its heartbeat and fulfillment
coverage every15minutes; the timer does not establish staffed operations.

**DEPLOYMENT: BLOCKED. EXACT APPROVAL: NOT ISSUED.**
This review is not an executable authorization packet. No execution operator was
released with it. The immediate missing owner input is a secure reference to the
existing approved SMTP profile. After binding it, finish the release/kill guards
and return one fresh exact approval; none of the old approval phrases may be reused.

Original32 deferred rows, DTR-33, STOR-01, schema96 location work and the storage
audit stay open/unchanged. PDC stays PAUSED. No real card/Auth acceptance was redone.
