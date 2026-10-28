# Paymob Merchant Inquiry history-contract stop receipt

28 October 2026. **MERCHANT AUTHENTICATION PASS / FULL-HISTORY INQUIRY BLOCKED.**
This is a new stop after the separately approved authentication201 correction.
The original authentication201-only stop receipt remains unchanged.

## Approved run and exact observations

Owner approval seal:
`971e67503c7f4649b32fa662309bad7fcf84bac83808623a6d6ca3ee0b3c4997`.
Private approval, exclusive single-use intent, provider observation, before/after
local snapshots and independent qualification receipt exist in:
`/Users/imac/Documents/ELcomputer/paymob-merchant-inquiry-auth201-20261028`.
Both this approval and original32093a55… approval are consumed. Never replay them.
No new approval or replacement execution packet is prepared at this stop.

14:23:58.651 Riyadh: two provider requests only:

1. Authentication POST returned201. Mandatory profile ID and token validation
   passed. Merchant API Key access/authentication is now qualified for this run;
   secret/token stayed within VPS memory and were not exported or logged.
2. GET for the first original EGP2 paid control returned200. Order ID, merchant,
   amount/currency, original attempt reference and paid-amount type checks passed.
   The required `transactions` array contract then failed with
   `HISTORY_ARRAY_OR_LIMIT_STOP`.

The exact failed condition requires a list with at most20 entries. The safe receipt
does not distinguish absent/non-list history from history exceeding20. Do not
assert which JSON shape, field type or count Paymob returned. Raw responses were
not exported or persisted and cannot be re-parsed retrospectively.

The run stopped before individual transaction reads, the second paid control,
EGP2649 orEGP3149 inquiry. No completed full-history observation exists. No fallback,
authentication retry, guessed filter/endpoint, broad transaction list or provider
financial operation ran. Across the two consumed packets there were3 provider
requests total:2 authentication POSTs and1 known-order GET; transaction GETs0.

## Payment evidence and production preservation

- Scoped local financial snapshots identical. No agent order/attempt/transaction
  update or paid/unpaid reconciliation was applied.
- EGP2649 remains on_hold/pending/paid0/no local transactions; EGP3149 remains
  cancelled/pending/paid0/no local transactions. Both provider outcomes UNVERIFIED.
  Owner-confirmed intentional abandonment/local cancellation does not prove final
  nonpayment. No charge/retry/refund/cancellation/fulfillment or email.
- Original EGP2/EGP5 paid/succeeded controls preserved; WOLF Processing and earlier
  fulfillment backlog retained. No newly verified provider success is invented.
- Afterflight14:24:04.069 Riyadh: acfc97b72fe85237/schema98/PID61817, Caddy26652,
  same runtime/credentials/certificate/unit hashes and key metadata. Zero app
  restarts/deployments/SQL/Caddy/runtime/timer/credential edits. API Key unbound to app.
- Public storefront/cart/signup entry/capabilities200; Live CARD available, COD
  absent, anonymous monitoring401, unsigned callback GET403. Existing signed
  callback code/ingress unchanged; no signed callback or owner browser action was
  initiated or newly claimed as exercised.
- MON enabled/active with fresh14:20:06 report/3 warnings; original shared emergency
  purchasing budget1 unused. Existing reports/dedup/permissions unaffected.
  Email OFF, Supabase Auth SMTP untouched, PDC PAUSED, Pay Again OFF.

## Remaining blocker and exact next action

The refreshed official order/reference API documents a latest transaction only:
[Paymob order/reference inquiry](https://developers.paymob.com/paymob-docs/developers/transaction-inquiry-apis/transaction-inquiry/by-order-id-or-reference).
The official repository's full-order nested-history claim remains unqualified for
this merchant; actual evidence did not satisfy the approved bounded-array contract.
Static research did not establish a supported complete-history endpoint/filter/
pagination contract for these exact orders. Do not silently relax history checks,
substitute the latest-only response or guess a broad list filter.

NEXT: obtain a merchant-supported full attempt-history contract or complete scoped
history with completeness evidence. [Prepared contract request](paymob-merchant-history-contract-request.md).
No message has been sent to Paymob. No third provider request in this run, further
probe, new approval seal or deployment is authorized by this receipt. After an
exact supported bounded procedure is reviewable, prepare its separate approval.

Pay Again still needs durable evidence/reconciliation, ownership/RBAC/RLS,
immutable amounts, callback race/idempotency rules, unique transaction identity,
complete history, old-session terminality and duplicate-charge prevention.
Customer notification email delivery remains a separate required task.
COD then homepage cart stay queued until this inquiry qualification is resolved;
address/LOC-01 checkout AND profile/navbar/MIG-04 follow. Original32 deferred rows,
DTR-33, STOR-01, all deferred work and existing worktrees remain preserved.
