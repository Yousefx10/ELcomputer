# ELcomputer safe checkpoint — schema122

**PAUSED BY OWNER — 6 November 2026,22:50Riyadh.**

The owner requested: “can you do a safe checkpoint now? update the md handoff,
then stop.” Implementation, qualification, deployment preparation and production
mutations are stopped. Existing approved production services remain running.
Resume requires an explicit owner instruction. The earlier emergency directive
must not be treated as permission to continue through this checkpoint.

## Installed and verified

- App `bea168064d2234bd`; source `9fa54a1a841a0b22571a66e8b77e9cf6daa8cca3`;
  schema122; PID394646 at the last host reconciliation.
- SMS controls recovery `8ba304398e07ced91aba314dcfe0238aa371d72b25cd8d82d19538922e84eceb`
  is **CONSUMED_COMPLETE / DEPLOYED / hosted technical PASS**. SQL committed
  22:13:00Riyadh; the single restart/cutover completed22:13:14.
- Postflight completed22:18:56: all5905hosted public-file hashes passed; all176
  original business/Auth/history/RLS/ACL projections were preserved. Natural
  MON22:15:05 retained the same8known warnings/3gaps, with no critical finding.
  Financial uncertainty remains unresolved; no successful Apple payment is inferred.
- SMS providerOFF/configrev3, daily limit0/minimum interval60. Transactional channel
  remains revision1 with its original cutoff. Regular dispatcher is uninstalled.
  The original five-slot pilot stays closed/0dispatches; expiry, slots and receipts
  were not renewed. One earlier test SMS was accepted/owner-received.
- Apple initiationOFF; CARD/COD/coupons/retriesON. FixedCOD remainsEGP10.
  Meta6/marketingOFF; BrevoON with4provider acceptances, delivery unverified.
  Last preservation checks retained25payment attempts and12orders.
- Artifact certificate `a5d75bbf` is retained unchanged. New activation receipts
  bind8ba30439. Earlier4b147019/a5d75bbf are consumed stops. None may be replayed.

## Unfinished regular SMS work — do not execute

The new regular-handover packet
`d17bae75773892fa4c4a1d85759b018ad78aa27686624bbc040b3f5ddba78e21`
is **WITHHELD / UNAPPROVED / NOT EXECUTED**. No ordinary-charge approval was
requested or received. Its printed deadline does not make it executable.
The proposed5daily/35total segments over7days is not spending authority;
actual tariff remains unknown. No new worker/unit/provider activation was performed.

The configuration-only rehearsal passed rollback and commit in a disposable
local restore:2configuration rows plus exactly one Vodafone Quick Setup revision
increment; all17setup rows and the other16domains were checked. Other protected
business/Auth/RLS/ACL/history, credential, template, binding and message state was
preserved. Initial fixture failures are retained; their clusters were removed.
The new controller/contract40tests and isolated host7tests passed. Those component
passes do not establish end-to-end regular sending readiness.

A source comparison then exposed an untested dispatch blocker. The regular worker's
`providerBinding` includes `next_request_at`, while the actual SMS queue-claim
function updates that field. The expected dispatch refusal follows from those
source paths; a dedicated regression reproduction has **not** been run. The
candidate is **not fixed**. No v2directory, corrected bundle or replacement seal
was created before this stop. Preserve the original9e564238bundle, d17plan and
all associated source/proofs; do not edit their sealed inputs.

On a future explicit resume: reproduce the cooldown change in an isolated fixture,
create a separate corrected worker/binding candidate, retain credential/destination
change guards, rerun relevant compiled/native/lifecycle/host checks, qualify Linux
units and fresh read-only predecessor state, then prepare a new exact quantity/
charge approval. Do not use d17 or send a test message to qualify this defect.

## Other preserved work and blockers

- Apple eligibility correctionf19e7e0 is local only. Successful Apple Pay remains
  APPLE_PAY_PROVIDER_BLOCKED; native/provider failure stage and root cause are
  unknown. The association-file URL404 and private unsent escalation are retained.
- Coupon engine isON; unrestricted95%+EGP50offer isOFF. COD delivery-coupon parity
  remains local. The fixed-preserving fee foundation and separate0.5%activation
  are not installed. Forward source543c550/canonical archive01276bc8 is preserved.
- `coupon-sql-ops/lifecycle.mjs` and `remote.py` are incomplete, unsealed operator
  drafts. There is no coupon CLI/application qualification or production authority.
  Physical123/124 remain conditional, not reserved or installed.
- PDC has an older uncertain booking/noAWB/noPDF and no eligible packed parcel.
  Do not rebook. Automatic pickup needs no scheduling development. A scheduled
  loopback tracking failure at21:37:13recovered naturally on the next run; its
  cause remains unknown. A separate diagnostics-only wrapper passed12local tests
  but is uninstalled and outside the SMS release.
- Genuine automated SMS/history/delivery, Brevo receipt, physical PDC acceptance,
  Meta receipt/dedup/ViewContent/catalog/value and material Beta restrictions remain
  open. Meta ordinary tracking isOFF. Beta warning remains. Daftra stays paused.

## Preservation and next action

The approved encrypted full backup and all failed/consumed receipts remain intact.
No new payment, SMS, shipment, Meta event, credential change or Git push occurred
in this continuation. Main's existing dirty/untracked work is retained. All76
original worktree HEADs and every foreign dirty state match the opening record;
main retains its intentional continuity edits. Both sealed scopes and every
sealed input match their original hashes. See the private preservation receipts. Agent release/rehearsal processes
were checked: none remain running; no disposable PostgreSQL cluster remains.
Existing production timers are intentionally not stopped by this owner checkpoint.

**One next action: owner reviews this checkpoint.** Do not resume any work,
qualification or activation until explicitly instructed.

Private evidence: `logs/emergency-commerce-20261106/owner-pause-schema122.private.json`,
`sms-ops-recovery/packet/consumed-complete.json`,
`sms-regular-handover/packet/WITHHELD-OWNER-STOP.json`,
`checkpoint-preservation-20261106-schema122.private.json`.
