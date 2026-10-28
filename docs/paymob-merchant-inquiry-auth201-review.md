# Paymob authentication HTTP201 correction and fresh inquiry review

2026-10-28. **LOCAL25 PASS / READ-ONLY PREFLIGHT PASS / NOT EXECUTED.**
Previous inquiry BLOCKED at authentication; see [stop receipt](paymob-merchant-inquiry-stop-receipt.md).

## Correction and evidence boundary

The consumed run observed auth HTTP201; its transport accepted only200. Paymob's
[current authentication documentation](https://developers.paymob.com/paymob-docs/developers/authentication-request-generate-auth-token-1)
lists200, while the actual merchant endpoint returned201. Neither a2xx status nor
a stored key alone establishes valid authentication or payment status.

The only provider-facing code change accepts HTTP200 or201 for the existing
`POST /api/auth/tokens`. Order and transaction GETs still require exactly200.
Profile/token validation must pass before any order read. All original merchant/
order/attempt/reference/mode/integration/amount/currency/history/paid-control guards
remain. No broad2xx acceptance, endpoint fallback, automatic retry or financial API.

The fresh private packet is
`/Users/imac/Documents/ELcomputer/paymob-merchant-inquiry-auth201-20261028`.
It uses independent approvals/intent/receipts and pins the consumed parent artifacts.
The original packet remains byte-identical. Exact original four-order bindings
must match, and the new seal cannot replay the original consumed authority.

## Unchanged scope

- Credential `/etc/storefront/paymob-merchant-api-key`, root:root0600/parent0700.
  Contents read only within the VPS process after approval; never logged/exported.
- The same four orders: original EGP2 andEGP5 paid controls, EGP2649 andEGP3149.
  Full transaction arrays required; preserve every known succeeded transaction.
  Local2649 on_hold/pending/paid0 and3149 cancelled/pending/paid0 are unchanged.
  Both provider outcomes still UNVERIFIED. Intentional abandonment proves no
  final provider state; negative/empty history cannot enable recovery.
- One auth POST, four full-order GETs, up to20 transaction GETs:25 requests maximum.
  Fixed Egypt origin and IDs only; no latest-only fallback, broad merchant list,
  redirects, proxy, automatic retries or payment/refund/cancellation requests.
- Response1MiB limit; socket10seconds; total120second deadline (at most10second
  final in-flight socket overrun); SSH180seconds. Stop on unavailable/malformed/
  incomplete/mismatched evidence and preserve safe partial observations.
- Original emergency budget1 untouched. No installer, app restart/rebuild/deploy,
  SQL/local payment-state update, service/timer/Caddy/runtime/credential edit,
  provider financial action, email, Pay Again or COD activation.

25 focused synthetic tests PASS: original20 retained plus five regressions for
valid200/201 auth histories,201 rejection on GET, other auth statuses rejected,
201 malformed/missing profile/token preventing all reads, and unchanged redaction.
All original history/context/paid-control/budget/expiry tests remain. Node prepare
syntax and sealed read-only production preflight PASS. No broad app suite repeated.

Fresh14:19:33.901Riyadh preflight: acfc97b72fe85237/schema98, appPID61817,
CaddyPID26652, key metadata/runtime/certificate/units unchanged. MON active/enabled,
fresh14:15:05 report/3 warnings, shared kill1. Public storefront/cart/signup and
CARD capabilities200, anonymous monitor401, unsigned callback403; COD absent.
These checks do not perform an authenticated owner action or signed callback.
No new provider call occurred during correction/preparation.

## Approval and remaining recovery work

Exact fresh approval:

`APPROVE PAYMOB READ-ONLY MERCHANT INQUIRY 971e67503c7f4649b32fa662309bad7fcf84bac83808623a6d6ca3ee0b3c4997`

Expires **2026-10-28T18:18:52.258+03:00 Riyadh / 2026-10-28T15:18:52.258Z**.
Must start before **2026-10-28T18:15:52.258+03:00 Riyadh** to retain180seconds observation margin.
No new owner approval, execution intent or provider receipt exists at preparation.
The prior auth201 stop remains consumed even though its original clock has not expired.

Before provider access, the operator verifies source/plan hashes, original parent
receipts, exact four-order bindings, expiry, app/runtime/MON/key/kill identity,
and public read-only availability. It creates an exclusive local single-use intent.
Afterward it writes separate sanitized observations and local snapshots and rechecks
baseline/availability. Any new stop consumes this fresh attempt; do not rerun it.

Pay Again stays OFF. Durable reconciliation/audit, callback conflicts, customer
ownership/RBAC/RLS, immutable totals, unique transaction identity, serialized
idempotent recovery, verified session finality and duplicate-charge prevention
still require qualification and separate implementation/deployment approval.
Customer email delivery CX-EMAIL-01 remains separately required and unconfigured.
After inquiry qualification: COD preparation first, homepage cart next, then
checkout address, LOC-01 checkout AND profile, navbar, MIG-04 later. PDC PAUSED;
original32, DTR-33, STOR-01 and the full deferred register remain open.
