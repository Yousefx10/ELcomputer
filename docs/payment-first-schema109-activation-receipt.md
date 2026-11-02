# Payment-first CARD activation receipt — E195, 2 November 2026

**ACTIVE. Approval CONSUMED_COMPLETE. Checkout display owner accepted.**

Owner approval `e0d17db79a1cdbf933cccfdd5bd2ddb404fe4eeb7f5a71f0df81446c53e6452d` ran once against the exact sealed schema109packet.
The mutation operator completed without a STOP, retry or automatic rollback.
Natural postflight produced CORE_ACTIVATION_NATURAL_MON_PASS and completion.json.
The frozen plan/helpers and original consumed approvals remain untouched.

Production application remains **81f6206b393714ae**, source **7b33ed0**, database
**schema109**. There was no deployment, migration or Caddy change/signal/restart.
AppPID changed197689→208234for exactly one planned restart at20:48UTC/23:48Riyadh.
CaddyPID26652is unchanged. The original application certificate remains intact.

## Exact changes and preservation

- Existing private checkout control: enabledfalse→true, revision0→1,
  enabled_since2026-11-02T20:47:39.511Z; one authorized owner audit inserted.
- Runtime: onlyNUXT_PAYMENT_FIRST_ENABLED=true andNUXT_PUBLIC_PAYMENT_FIRST_ENABLED=true.
- Each existing MON,customer Email and PDC timer paused once at20:47:23UTCand
  resumed once at20:48:08UTC. Already running callers were not terminated.
- The154protected projections outside the intended control/audit tables passed
  same-transaction comparison. Schema/RLS/Auth/history access and all functions
  remained unchanged. No existing order or payment was written by the operator.
- All17protected files checked: one runtime file changed exactly as sealed;
 16others unchanged. Loaded process/runtime/certificate and original emergency
  budgets passed. Core disable is unused. Server-authoritative COD fee10.00remains.

No provider request, charge, refund, fund credit, order, shipment, pickup, cash
collection, test email or manual worker was performed by the operator. Natural
customer purchases remain permitted; this receipt does not freeze their later
activity. The existing Brevo delivery evidence is reused,never repeated.

## Actual verification

| Evidence | Result |
| --- | --- |
| Approved read-only preflight20:46UTC |109,controlsOFF,original7warnings/3gaps,integrity0 |
| Database control commit20:47:55UTC |One control update/one audit;154other projections preserved |
| Runtime activation20:48UTC |Two flags loaded;one restart;all3timers resumed |
| Public capabilities20:49UTC |paymentFirsttrue;CARD/CODavailable;manual transferfalse;express[] |
| EN/ARroot/cart |HTTP200;cart includes active runtime flag |
| EN/ARcheckout and Payment activity |HTTP302to correct localized login |
| Anonymous private session list |HTTP401,private/no-store/no-referrer |
| Natural MON20:50:05UTC |Complete WARNING,0critical,7original warnings/3gaps unchanged |
| Natural Email20:51:10UTC |Service exit0;timer enabled |
| Natural PDC20:51:14UTC |Service exit0;timer enabled;no eligible AWB |
| Final runtime/stage audit20:54UTC |One restart,intended flag write,one pause/resume per timer,16other files preserved |
| Owner checkout display |Existing cart advances to Card+Cash options;device/language not specified |
| Read-only state following owner display |Enabled/revision1;private sessions/attempts/funds0;all four payment integrity counts0 |

The owner said they clicked Continue to checkout and Continue to payment, then
saw Card+Cash. The existing Continue to payment handler validates delivery and
refreshes the quote before displaying methods. It does not itself initiate the
provider or confirm COD. This is useful authenticated display acceptance. It
is not evidence of a payment, paid order, successful bank transfer, cash collection,
email delivery or shipment. No real payment was initiated for qualification.

Local evidence remains23HTTP/callback/privacy/concurrency cases,10control/disable
cases,20guards and3deployed-build runtime modes. Fresh encrypted109database and
17file readback passed before activation. All old failures, deferred native Storage/
reset checks, physical-device/ENAR/UI cases and merchant acceptance remain retained.

## Active behavior and remaining acceptance

New explicit CARD confirmations use private checkout sessions with the existing
Paymob Intention/hosted Redirect. Only verified matching live funds create one
paid order. Failed/unverified/abandoned attempts remain private; duplicate callback
and genuine late-payment handling remains installed. COD remains its independent
unpaid order-confirmation exception, with no automatic PDC booking.

The first genuine prepaid CARD transaction, provider acceptance, successful return,
paid-order visibility and verified customer Email remain pending genuine activity.
The callback/owner/financial behavior is qualified locally,not substituted for a
real purchase. Do not create a synthetic paid order or launch an operator payment
probe without separate explicit approval. Do not activate unsafe Pay Again.

MON retains all seven unverified financial warning identities and three journal
gaps. None is reconciled, cleared or marked paid. MON notification Email remains
OFF; ordinary transactional Email remains LIVE. Later genuine customer events may
change these counts legitimately; inspect evidence and never reset a warning to
force a release. The earlier outage, transient client-write warning and generic
tracking caller failures remain archived separately.

## Recovery and emergency controls

Do not rerun this activation or its consumed parents. The sealed packet includes
one unused SQL-only core disable for an allowed critical condition or explicit
owner request. Use its original seal and recognized reason with the frozen
operator disable mode. It sets enabledfalse/revision2with one audit, retains
runtime flags and enabled_since, and needs zero restarts. New prepaid claims stop;
COD,private history,valid callbacks,late verified funds and cart evidence remain.

Do not turn the runtime flagsfalse after enabled_since exists: the database keeps
the prepaid boundary and prevents returning to legacy unpaid CARD creation. Do
not restore an old database over later orders, replay a provider request, invent a
refund or rewrite financial status. Partial/uncertain future actions need actual
state review and a separate recovery. Original purchasing/COD/Email emergency
fences and their original budgets remain intact and are never renewed here.

Private evidence:
`/Users/imac/Documents/ELcomputer/payment-first-core109-activation-20261102`.
Important files: owner-approved.json,activation-attempt.json,begin-receipt.json,
database-receipt.json,runtime-active.json,immediate-postflight.json,completion.json,
live-capabilities-postflight.json,stage-readonly-audit.json,
core-activation-natural-workers.log,owner-checkout-display-acceptance.json,
owner-display-database-readonly.private.json,activation-technical-closeout.json.

## Next independent work

Qualify the already prepared inactive InstaPay candidate20261101221000against
actual deployed109; it is next migration110. Reuse existing receipt review/private
VPS storage/deduplication; a receipt upload never proves bank payment. Keep it OFF
until its own deployment,verified recipient/proof access and independent bank-review
qualification and activation approval. No new app/provider implementation is
inferred or started by this closeout.

Apple's merchant activation remains pending actual offer evidence; the owner
reports Paymob handles setup and no extra owner action. Do not impose generic
certificate/domain work or contact them again. Pixel1.2.8and Pay Again remain
separately gated by provider/SDK/3DS evidence. Wallets need actual merchant IDs;
balance111needs legitimate funding/reconciliation/terms;Google stays OFF. PDC
commercial/ERP work remains LAST. All worktrees and deferred evidence are preserved.

**ONE next independent action:** qualify the minimal inactive InstaPay110release.
