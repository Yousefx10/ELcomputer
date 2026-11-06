# Vodafone first real SMS — 5 November 2026

SMS-VF-LIVE-01: **SUBMITTED and owner-confirmed received**.

The exact owner-approved seal was
`7180f5b90bf7408c829cc582c9ed9daa01ae083dec649e85f9d8c797115dbf5a`.
It is CONSUMED_COMPLETE and must never be replayed.

| Evidence | Actual result |
|---|---|
| Provider HTTP | 200 |
| ResultStatus / SMSStatus | SUCCESS / SUBMITTED |
| Provider POSTs / automatic retries | 1 / 0 |
| Recipients / encoding / units / segments | 1 / GSM-7 / 33 / 1 |
| Text | ELcomputer SMS test. Code: 482913 |
| Client ExternalTrxId | ELC-d80f8646-432b-4d44-8447-c8d62eecf402 |
| Provider-assigned reference | Not returned |
| Handset evidence | Owner: Received the exact test message |
| Provider delivery receipt | Not supplied by this submission API |
| Exact actual cost | Not returned; ordinary one-message charge owner-authorized |
| Production | app459a6579dc15cc31 / source6f1f805 / schema120 |
| Runtime / restart / migration / authentication changes | Zero |
| Regular transactional / marketing | OFF / OFF |

Account ID, password and Secure Hash Secret were bound through the existing
server-side AES-GCM mechanism. The master key stayed on the VPS. Credentials,
recipient and source IP are excluded from this report. Minimal input and actual
preimage remain authenticated encrypted envelopes in the ignored owner-only
operation directory. No WordPress configuration was copied into the application.

Current sender/credential/source access was demonstrated by this accepted real
Notification request and owner-reported receipt. A formal whitelist document
and exact merchant tariff remain unprovided; no provider replacement keys are
requested. The existing contract supplies no free authenticated account-status
or delivery inquiry endpoint. No such endpoint was invented or called.

**INC000081856720** remains authoritative: HMAC-SHA256 uses the literal uppercase
hexadecimal secret string, without hex-decoding. Application/provider code was
unchanged. Twenty-two new one-use scope, refusal, uncertainty, privacy and retry
checks passed. The body is synthetic and created no authentication OTP or state.

The one-off maintenance scope kept all ordinary sending globally OFF. It appended
one owned processing batch/message/attempt, used the installed adapter and
transport once, then finalized that owned attempt through the existing SMS RPC.
The current sender/IP confirmation columns remain false until a separately
approved regular activation. The provider acceptance receipt is the new evidence
for that activation; no historical setting was relabelled as current proof.

Postflight18:42:57 Riyadh confirmed encrypted credential presence and all channels
OFF; app/source/schema and financial counters remained unchanged. No Paymob,
COD fee, Daftra, Meta transmission, marketing, PDC or Brevo changes occurred.

Next milestone SMS-VF-TX-01: a separately sealed, future-only transactional pilot
with approved bilingual templates, a hard small segment budget and zero retries.
No additional provider charge is authorized by this completed one-message seal.
