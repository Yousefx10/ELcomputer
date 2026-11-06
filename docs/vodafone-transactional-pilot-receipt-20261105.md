# Vodafone delivered test and bounded transactional activation — 5 November 2026

**Real test delivered; future-only transactional pilot active.**

Vodafone accepted one Notification request with HTTP200, ResultStatusSUCCESS and
SMSStatusSUBMITTED. The owner separately confirmed exact handset receipt. No
provider delivery receipt was returned. The [test receipt](vodafone-first-real-sms-receipt-20261105.md)
retains the client reference and evidence boundaries. The test's ordinary charge
was owner-authorized; the API did not return its exact amount or a provider ID.

The owner separately approved five further ordinary one-segment charges with
exact seal`ee12fc4b4ac70877b14d5cfc137dc20854c7ddb42dd0a73660de4d2b90351526`.
It is CONSUMED_COMPLETE. Never replay, roll back automatically or reset its budget.

| Current production | Actual |
|---|---|
| Application | 459a6579dc15cc31 |
| Source | 6f1f805c42d916d6898e2f9104f98bf79831e554 |
| Physical schema / migration writes | 120 / 0 |
| App PID / restarts | 324764 / 1 |
| Provider / channel revision | 2 / 1 |
| Credential binding | Existing server AES-GCM/master key |
| Transactional runtime/provider/channel | ON / ON / ON |
| Allowed events | Future COD confirmation; genuinely verified-payment confirmation |
| Approved ceiling | Five further provider submissions, one segment each |
| Rate / retries | At most one/minute / zero automatic retries |
| Window | 24h; no dispatch after 06 November 2026 19:02:25 Riyadh |
| Marketing / all other SMS events | OFF / excluded |
| Additional pilot SMS sent at postflight | 0; no eligible new order |
| Existing timers | All restored after 12.1138 seconds |

The private CLI worker uses the frozen application transaction/queue/provider
services. Every provider POST retains the current lease/revision/expiry and
verified-event check. A root-only exclusive lock and durable dispatch markers
prevent concurrent runs, quota reset and ambiguous-message retries. Each dispatch
must be an Egyptian single-recipient, single-segment message from one of the two
allowed event sources. Longer rendered messages and other sources fail closed.
The five-dispatch cap includes uncertain/rejected POSTs. The earlier test is
separate, leaving all five newly approved pilot slots available at postflight.

The budget does not reset daily. On exhaustion or expiry, subsequent natural
worker checks disable the provider using its expected revision; the worker
cannot dispatch beyond the cap/window. The transaction runtime/control flags may
remain ON while the provider is OFF at closure. Expanding the pilot requires
fresh approval; do not remove its marker files. Configuration/source drift stops
this worker. No public HTTP worker secret was installed. The existing HTTP worker endpoint
continues to reject requests without valid server authorization. Existing RLS/RBAC and permissions remain.

Both templates were enabled without changing their text:

- `tx_cod_confirmed`: COD order {{order_number}} is confirmed. Payment is due on collection.
- Arabic: تم تأكيد طلب {{order_number}}. الدفع عند الاستلام.

- `tx_prepaid_confirmed`: Payment is verified. Order {{order_number}} is confirmed.
- Arabic: تم التحقق من الدفع وتأكيد الطلب {{order_number}}.

Only orders created at or after the activation's enabled_since timestamp can
enter this pilot. Pending/uncertain payments cannot become verified-payment
notifications. Transfer, failure, invoice, PDC and claim events remain disabled.
No test order, authentication OTP, payment transition, invoice, refund or fee
change was created. No historical-order replay occurred.

Postflight19:06:09 Riyadh passed: three natural worker runs, zero new dispatches,
no residual lock, exact worker-bundle hash, all existing callers healthy, and
natural MON19:05:05 with eight known warnings/three historical gaps/zero critical.
Total SMS ledger remains one submitted batch/message/attempt from the delivered
test. Anonymous SMS APIs return401/private,no-store; storefront returns200;
Meta public tracking remains disabled/no-store. Financial counters remain
14sessions/14attempts/11orders/funds0/callbacks0. No new-order handset acceptance
is claimed before a genuine eligible order produces a notification.

Twenty-two single-test safety checks and fourteen pilot bounds/source/segment
checks passed. Existing source identity and qualification were reused; no app
build, SMS integration rewrite or HMAC investigation was repeated. Support ticket
**INC000081856720** remains authoritative: literal uppercase secret string as
HMAC-SHA256 key, without HEX decoding.

All original68worktrees/24,004recorded hashes and financial/Daftra/Paymob/PDC/Brevo
checkpoints are preserved. Meta remains ready for its separately deferred inputs.
Exact merchant tariff/account billing can be supplied later; it is not a blocker
for these expressly approved ordinary-charge quantities. No replacement keys
were requested. No production token or credential appears in this report.

ONE next action: monitor the first eligible future-order notification during the
approved pilot, without fabricating an order or a successful payment.

## Installed stop guard

The owner approved the separate worker-only seal
`69978611f1177f1a9de51ddb63affeee2afb9ad87c6ffb73225ddbf1db59188a`.
It completed at 19:20:06 Riyadh and must never be replayed. The earlier test and
activation operators remain consumed. The old private worker was retained as a
protected, hash-pinned preimage; none of its consumed local source was edited.

The private worker now durably closes the whole pilot after its first rejected
or uncertain provider response, or uncertain ledger finish following dispatch.
It disables the provider when reachable. A persistent closed latch prevents
subsequent capture, claim or dispatch even if database disablement is unavailable.
There is no automatic reopening, retry, provider fallback or budget reset.

Eight local checks executed the changed worker flow, including refusal,
uncertainty, ledger failure, database outage, acceptance and quota closure.
No real provider failure was induced. The installed bundle SHA256 is
`36a704775761d20daf372fa940745510c08a12dc3a50117f6ea0c66a54297e8d`.
Only its SMS timer paused/resumed for 0.051 seconds. There were no app restarts,
SQL/configuration/runtime changes, budget/expiry changes or provider calls.

The corrected worker's first natural run completed at 19:21:08 Riyadh.
Read-only verification at 19:21:41 passed with the expected bundle, healthy timer
and caller, no residual lock and zero pilot dispatches. The delivered test remains
the only actual SMS submission. The first eligible future-order notification is
still awaiting a genuine new order.
