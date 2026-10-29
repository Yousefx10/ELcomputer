# CX-PAY-01 paid-control shape audit COMPLETE — E135, 29 October 2026

**CONSUMED_COMPLETE for the bounded shape audit. Full-history Inquiry and Pay Again
remain BLOCKED.** Exact47410c89… approval and exclusive intent were used once.
The E134 approval below is historical and cannot be replayed.7dc4 remains expired,
unexecuted; it was never extended or substituted.

Owner approval11:17:41.470Riyadh; preflight11:17:37.090Riyadh and fresh pre-provider
guards PASS. Intent11:17:56.579, safe provider observation11:18:00.851, completion
11:18:02.377Riyadh. Exactly two requests: auth POST201 and original verified EGP2
paid-control order GET200. No transaction GET, unpaid-order inquiry or other provider
request. Merchant/order/amount/currency/original reference and paid amount matched.

| Checked field | Observed shape |
| --- | --- |
| `transactions` | MISSING |
| `transactions_count`, `transaction_count` | MISSING |
| `transactions_truncated` | MISSING |
| `next`, `hasMore`, `nextPage`, `totalCount` | MISSING |

The response had29 top-level fields. We exported only allowlisted shapes/counts/flags,
not unknown field names, transaction contents or raw provider replies. This confirms
that the expected top-level history field is absent in this matched paid-control
response. It does not establish zero history, exclude different documented fields,
prove completeness or settle any unpaid order. No endpoint/field alias was guessed.

**11:20:00.208Riyadh read-only postflight PASS:** production9aa61b64c2c5cf9f/schema103,
app72557/Caddy26652 unchanged, no restarts. Original paid control and protected
checkout/PDC configuration unchanged. CARD-only live, COD off; financial/signed-success/
duplicate/ownership mismatch counters0, overdue-unverified1. MON enabled/active/
complete with the same four warning bindings, no critical alert; original emergency
budget1 unused. No report/history/dedup reset or manual monitoring action occurred.

The existing Merchant key was read only inside VPS memory for approved authentication.
Key contents, auth token, raw replies, query-token URLs and customer/card data were
not exported. The before/after snapshots' `credential_contents_read:false` refers
only to their metadata inspection; authentication did perform its approved private
key read. Zero SQL/financial writes, app/config/deployment/restart/email/PDC actions.
All33 worktrees/HEADs and14046 unrelated pending hashes preserved. Previous12 shape
and4 binding tests were reused; no application source changed or test/build repeated.

Private safe receipts are in `../paymob-paid-control-shape-refresh-20261029/`:
`owner-approval.json`, `audit-intent.json`, `provider-shape-observation.json`,
`completion.json` and `execution-postflight.json`. The receipt is not a new approval.
Do not run this packet's audit or expired predecessor again.

**ONE NEXT ACTION:** obtain the documented complete one-order history contract:
exact supported schema/route/auth/filter, pagination/completeness and merchant/mode/
integration bindings. Independently obtain old-session terminality/late-settlement
semantics before Pay Again. [Updated provider request — DRAFT / NOT SENT](../../paymob-paid-control-shape-refresh-20261029/PAYMOB-HISTORY-CONTRACT-REQUEST.md)
reuses the existing request and adds the confirmed missing-field evidence. No
additional provider request is authorized. No new execution approval is issued while
those contracts are unqualified. COD also stays off pending PDC's written cash units.
Owner address-book/location/navbar acceptance remains pending; all deferred work retained.

---

# CX-PAY-01 refreshed read-only shape audit — E134, 29 October 2026

**READY FOR NEW EXACT APPROVAL.** The earlier7dc4… packet expired before its
approval could execute. It made zero provider requests. Its seal and all input files
remain unchanged; a local late-approval receipt records accepted-for-executionFALSE.
No old owner-approval or audit intent exists. The E133 packet below is historical.

At validation11:04:53Riyadh, its07:28:53.884 expiry had passed. The operator's exact
expiry and180-second start-margin guards prohibit executing or extending that seal.
The replacement is fully prepared; its different expiry/baseline produces a new seal.

The first refresh stopped safely because MON now has **four**, rather than three,
current unverified-payment warnings. Read-only diagnosis confirmed a complete fresh
scan and enabled/active timer: one overdue and three terminal unverified warnings,
zero critical exceptions. No report, history, dedup record, timer or warning changed
through this work. Current warning evolution does not establish provider payment or
nonpayment. Earlier warning evidence remains retained, and no payment is reconciled.

The replacement guard binds all four current warning fingerprints, codes, severity
and UNVERIFIED evidence exactly. Missing/added/changed warnings stop. Existing fresh,
complete, noncritical and email-off requirements remain. **Four new local binding
tests PASS**; prior12 shape tests are reused. The provider projection, immutable
transport and one-auth/one-original-EGP2-GET scope are unchanged.

**11:12:12.633Riyadh sealed read-only preflight PASS:** current9aa61b64c2c5cf9f/schema103,
app72557/Caddy26652 unchanged. Original EGP2 paid-control state and key metadata
match; Merchant key contents were not read. CARD live/COD off, protected checkout/PDC
configuration unchanged. Critical mismatch, unreconciled-success, duplicate and
ownership counters are0; overdue-unverified is now1. MON11:10:05.899Riyadh complete/
active/WARNING4; original emergency budget1 unused. Zero provider calls or production
writes. No application source changed or build/deployment test suite repeated.

The isolated packet is `../paymob-paid-control-shape-refresh-20261029/`.
At most two requests after separate approval: one Merchant authentication POST and
one GET of the same verified EGP2 paid-control order. Zero transaction/unpaid GETs,
financial/provider writes, SQL writes, runtime/service/Caddy/MON changes, restart,
deployment, email or retry. Raw provider responses, credentials and customer fields
stay in VPS memory. Only allowlisted type/count/flag metadata returns. Complete
history, session finality, reconciliation and Pay Again remain UNQUALIFIED/PROHIBITED.

**ONE current exact approval:**

```text
APPROVE PAYMOB READ-ONLY PAID-CONTROL SHAPE AUDIT 47410c89bff52d1d7a6483e99bb5240658bd797e072606b7d76985d5b2a52e6c
```

Expires **29 October 2026,15:11:54.444 Riyadh (12:11:54.444 UTC)**.
Must start before **15:08:54.444 Riyadh (12:08:54.444 UTC)** for the180-second margin.
No replacement approval or audit intent exists. Stop on drift/expiry/uncertain outcome;
never transfer the expired approval or replay an audit. After a capture, qualify the
history/finality contract before considering any safe Pay Again/method-change work.

---

# CX-PAY-01 paid-control shape audit — E133, 29 October 2026

**READY FOR SEPARATE READ-ONLY APPROVAL.** Complete-history Inquiry and Pay Again
remain blocked. This packet neither deploys nor changes production payment state.
No provider request occurred during preparation. No API Key contents were read.

The prior consumed Inquiry authenticated successfully, then stopped on the original
verified EGP2 paid-control order at `HISTORY_ARRAY_OR_LIMIT_STOP`. The safe receipt
cannot distinguish a missing/non-array `transactions` field from an oversized array.
The raw response was not retained. Do not guess its shape or treat a missing array
as proof of nonpayment. Old Inquiry approvals remain consumed.

## Exact bounded operation

The new isolated `../paymob-paid-control-shape-20261029/` packet reuses the qualified
immutable auth201 transport. After approval only, it permits **at most two provider
requests**: one Merchant authentication POST, then one GET of the original verified
EGP2 paid-control order. Zero transaction GETs and zero unpaid-order inquiries.
No endpoint/filter fallback, redirect, automatic retry, payment/capture/cancel/refund,
new charge, email or provider booking is permitted.

The VPS process matches merchant, provider/local order, amount, EGP currency, original
attempt and exact paid amount. It returns only allowlisted field types/counts/flags,
not raw values, transaction contents, arbitrary field names, URLs, tokens or customer
data. Missing, null, non-array, short and oversized arrays remain distinguishable.
Even a short matching array always leaves history completeness, session finality,
retry and reconciliation **UNQUALIFIED / PROHIBITED**. No local financial state writes.

Fixed Egypt Accept origin; existing root0600 key read only after approval. Each response
is bounded to1MiB, socket10s, total provider deadline30s, SSH90s. Exact current release,
PIDs, certificate, fixed files, key metadata, schema103/local paid control, fresh MON,
CARD-only availability, original kill budget and33-worktree preservation are checked.
One exclusive local intent is written before provider access. Any uncertain SSH outcome
consumes the attempt and requires receipt inspection, never an audit replay.

## Qualification

**12 new local tests PASS**, zero provider calls. They cover shape distinctions,
redaction canaries, paid-control mismatches, auth stop before GET, request scope and
expiry. Existing completed25 Inquiry tests, app typecheck/build and deployments were
not rerun; no application code changed.

**03:30:05.350 Riyadh sealed preflight PASS:** production9aa61b64c2c5cf9f/schema103,
app72557/Caddy26652 unchanged. Key metadata matches without reading contents.
CARD-only/live, COD off. MON report03:25:05.813 Riyadh complete/active, warning3;
original kill budget1. Zero provider calls, credential contents read or SQL writes.
Provider response shape itself remains untested until separate approval.

Seal: `7dc4c56d117fb3a9c1d0316147df6a97a5248febe4c5727f1cda2da359beef2a`.

**One next approval — Paymob read-only audit, not COD activation:**

```text
APPROVE PAYMOB READ-ONLY PAID-CONTROL SHAPE AUDIT 7dc4c56d117fb3a9c1d0316147df6a97a5248febe4c5727f1cda2da359beef2a
```

Expires **29 October 2026, 07:28:53.884 Riyadh (04:28:53.884 UTC)**.
The audit must start before **07:25:53.884 Riyadh (04:25:53.884 UTC)** to retain the
180-second observation margin. Stop on expiry or drift; no old-packet substitution.

No owner approval or audit intent exists. If approved, record this exact statement
once and use only this packet's guarded single-use operator. A successful capture
only informs the next history-contract qualification; it never opens Pay Again.
