## Regular SMS preparation completed locally — 6 November 2026

Source **9fa54a1** is preserved on codex/sms-regular-limits-20261106, based exactly
on deployed e2663ea. Five app/SQL files changed: two existing Dashboard inputs,
EN/AR labels, existing settings validation/defaults and one additive SMS migration.
No payments, fee, coupon, shipping, Meta, Daftra or HMAC implementation changed.

- Daily segment limit uses a rolling24h count; default0 pauses regular dispatch.
  Minimum interval defaults60seconds. Existing RBAC, revision conflicts and audits
  are reused. Settings can reduce the active limit; the worker refuses any value
  above its separately approved charge ceiling. Existing credential edits retain
  their activation-revocation behavior.
- The regular worker reserves one segment exclusively and syncs it before POST.
  It writes an acknowledgement only after a submitted result and successful ledger
  finish. A rejected/uncertain result, missing acknowledgement after process death,
  or uncertain ledger finish latches further sending closed. No automatic retries
  or fallback. Only future COD/verified-payment confirmations; one Egyptian
  recipient/segment. Marketing and other producers remain excluded.
- The new service-only state projection exposes the capture cutoff to the worker.
  A future exact handover must drain the pilot, preserve all old receipts/markers,
  advance capture cutoff/channel revision, bind the new policy and run exactly
  one dispatcher. Unspent pilot slots never silently become a new charge allowance.

**Scoped local qualification PASS:**13quota checks,14compiled-worker flows,
6native migration/rollback/ACL/cache-notification checks,5authenticated compiled
settings checks,7compiled-app HTTP cases and8EN/AR/mobile/desktop/light/dark browser
cases. Pause-to-zero, saves and read-only staff behavior pass. Node22.23.1 typecheck
and build pass. No provider call or production connection was used by these tests.

The build was produced from a777ffb. The only later delta in9fa54a1 is the SQL
PostgREST cache notification; it passed six native checks. Compiled app/worker
inputs and bytes are unchanged, so their successful checks are reused.
Build archive8218c8bdb367c9be65aae2f3bafb963c83bb78f903975c1baa248b869f57e263
and worker9e564238a406aa37ae31fedb6ac0db126d6f5b270214fe38def329822d3890b3
are retained. All1271archive entries passed full content/mode readback; its private
readback destination root was corrected from0700to the source0755 before equality.
Prior sandbox/fixture failures remain saved, with no production correction implied.

**NOT INSTALLED / NOT FULL RELEASE QUALIFICATION.** The final release must merge
and replay retained production assets, rehearse against a fresh restored actual
predecessor, qualify the one-use handover operator and obtain separate exact
installation/charge approval. Physical122 is only the conditional next schema if
production still has121; no migration slot is reserved. Current production stays121.

Five/day,35total over7days remains a **proposal**, not paid-send authorization.
The exact merchant tariff is still undocumented; no replacement credentials,
provider onboarding or HMAC clarification is requested. PreserveINC000081856720.

Last live observation03:25Riyadh: current app2a1fb3c96f391f40/sourcee2663ea/121,
couponsON with the unrestricted offerOFF; pilot0/5, closed=false, same19:02:25expiry;
0genuine transactional events, Meta/marketingOFF. The delivered one-message test
was not repeated. Genuine-order SMS History/submission/receipt acceptance remains
OPEN. Do not fabricate an order to close it.

Local evidence: logs/activation-register-20261106/sms-regular/component-qualification.json
and artifact/artifact-review.json. Older preparation notes below are dated history.

---

# Current preparation — 6 November 2026, 02:30 Riyadh

The delivered connection is reused. Live pilot0/5, same expiry19:02:25Riyadh,
closed=false, runtime unchanged, marketingOFF and0genuine transactional events.
A five-file Dashboard/settings candidate patch is prepared against deployede2663ea:
regular daily segment limit (rolling24h, default0/OFF) and minimum interval
(default60seconds). Existing settings RBAC/revision/audit and compact EN/AR UI are
reused. This uninstalled candidate requires a small future app/settings release;
it is independent of the configuration-only coupon packet.

The quota core passes13offline checks: approved ceilings, Dashboard pause/reduction,
rolling24h/total allowance,1segment,60seconds, expiry, invalid windows, duplicate
reservation and closed-latch guards. The unchanged delivered HMAC/provider code
is reused. The worker must persist exclusive reservations before POST, carry
uncertainty across restarts, integrate these limits and hand over without overlapping
the pilot. That wiring/native settings/compiled HTTP/hosted qualification is still
OPEN; the five-file draft and quota core are preparation, not release acceptance.
No regular charge allowance is inferred. Prior5/day,35total,7day limits remain a
proposal for separate exact approval. Keep genuine-event acceptance distinct.

Local candidate: logs/activation-register-20261106/sms-regular/.
No provider request, paid test, onboarding recovery or SMS configuration change.

---

# Transactional SMS transition review — 6 November 2026

SMS-VF-TX-PERM-01 is prepared for review, not activated. Reuse the delivered
Vodafone connection and installed channel. HMAC remains the literal uppercase
hexadecimal string (INC000081856720). No replacement credentials or repeat paid
connection test are required by this review.

At01:10Riyadh, the pilot has zero dispatches and all five approved slots.
Its expiry is6November19:02:25Riyadh. The current worker, runtime hash, markers,
active receipt, one-minute rate, one segment, zero retries and durable fatal /
uncertain-outcome latch remain unchanged. Marketing remainsOFF.

## Minimum operational transition

1. Observe the next genuine COD or genuinely verified-payment event. Verify one
   source event, one batch, one attempt, its exact submitted/delivered distinction
   and private SMSHistory. Do not fabricate an order, payment or authentication OTP.
2. Carry forward only COD confirmation and verified-payment confirmation, the
   existing EN/AR templates and current encrypted provider binding. Other events,
   invoice/Daftra/PDC/failure/claims/marketing producers stay excluded.
3. Replace the temporary fixed-window wrapper with a separately owned dispatcher
   policy and persistent daily/period quotas. Quotas, reservations, dispatch markers
   and close latches must survive app/worker restarts and upgrades. Never consume
   the original pilot receipt as ongoing sending authority.
4. Use the same final configuration/template/event/lease checks. Serialize a single
   worker, allow at most one segment/recipient and one dispatch/minute, zero retries,
   no fallback. A rejected/uncertain POST or uncertain ledger finish must close
   further sending durably before another event is processed.
5. Expose queue age, quota left, rejection/uncertainty and dispatcher health to the
   owner. Distinguish accepted/submitted from delivered and from actual invoiced
   merchant cost. Do not invent a supported delivery-status endpoint.
6. Handover under one fresh exact production scope: drain/stop the pilot timer,
   preserve all its receipts/markers, bind the new policy/worker/configuration,
   then enable exactly one dispatcher. No overlapping senders or historical replay.

## Concrete bounded authorization proposal

A conservative first regular-operation proposal is **five segments/day for seven
days, maximum35 total**, one segment/message and one/minute. This is a proposal,
not owner authorization. The owner can choose a different explicit quantity/window.
The pipeline is an ongoing product feature; paid dispatch always obeys the current
bounded owner-approved budget. It must stop on quota/window exhaustion or the first
uncertain result. Do not silently renew a budget or erase a stop latch.

The exact merchant tariff remains undocumented. The delivered one-message and
five-total pilot approvals do not authorize these35 charges. A new quantity-based
ordinary-charge approval may be sufficient; do not invent an exact monetary-cap
requirement absent an applicable rule. Record the real tariff when obtained.
Marketing still requires its separate tariff, consent, Unicode, suppression,
unsubscribe and exact campaign controls.

## Gates and existing evidence

The installed channel/template/queue/provider implementation is qualified; the
current guarded worker passed eight flow checks and natural post-cutover runs.
No real eligible transactional event exists in the current snapshot. That genuine
producer/History/delivery acceptance remains open. A permanent quota-wrapper and
handover qualification is a small corrective operational release, not a provider
integration rewrite. Build its source-bound no-network fixture before sealing.

No placeholder production seal is issued here: the regular charge allowance,
window and first real event acceptance are genuinely not yet established. Keep
this review with the original permanent plan and preserve the Daftra checkpoint.

**One next action:** inspect the first genuine eligible pilot event; then finalize
and authorize the bounded regular dispatcher policy independently of coupons/Meta.
