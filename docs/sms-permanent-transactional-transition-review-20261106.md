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
