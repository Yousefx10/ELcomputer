**Historical E89 review. Exact approval applied once; public CARD Beta is ACTIVE.
See [the E90 activation receipt](public-card-beta-activation-receipt.md). Never replay.**

# Final public CARD Beta activation review — E89

**PUBLIC BETA: GO FOR SEPARATE APPROVAL. PUBLIC PURCHASING REMAINS OFF.**
[Real EGP5 payment and closure](egp5-genuine-payment-verification.md) are verified.
Current app `a402cf24a9685e0d`, source `113b313`, schema98, PID54674.

Exact next authorization:

```text
APPROVE PUBLIC CARD BETA 1707a5baf28702cd8670951bea3747446aedc118623e09f6ca185b4d755cabc6
```

Packet expires **27 October2026,23:23:23.842 Riyadh**. This is an activation-evidence
deadline, not an extension of any EGP5 purchase grant. Both private activation and
closure are consumed; the scoped grant stays expired. Never replay a consumed action.
Private packet: `../public-card-beta-activation-20261027/plan.json`,5104 sealed inputs.

## Concrete activation

Only five runtime values change: public purchasing/Beta purchasing and Paymob CARD/
LIVE initiation become enabled; a private Beta policy binds the existing Manual
company and excludes TESTproduct2026. One app restart, no application deployment,
migration, SQL, coupon/stock/price, Caddy, Auth, PDC or credential change.
Existing restrictive Caddy routes already cover the required normal APIs; their
bytes/process/routes stay unchanged. No root edge signal or reload is needed.

Public customers can buy eligible published, normal, active positive-price models
at trusted current prices, with owner-managed Manual EGP50 and CARD only. Current
read-only eligibility count223; drafts, coming-soon/unavailable models and the test
product remain excluded. Physical availability follows the owner's existing catalog
confirmation and explicit unrecorded-stock setting; no warehouse count is fabricated.
All coupons remain disabled for this Beta policy. FRE5 stays scoped/exhausted1/1,
unchanged; server SQL remains authoritative. Existing applied coupons must be removed
before a Beta review; that local recovery path passed. No stacking/client price trust.
Signup OPEN and PDC PAUSED. Manual fulfillment is staff-managed, never auto-booked.

## Launch-critical evidence

| Requirement | Evidence and boundary |
|---|---|
| Signup / Turnstile | Accepted positive owner signup/recovery retained; current Auth signup open, confirmation required, same Turnstile/runtime/compiled inputs. No broad Auth retest or email. |
| Catalog / Manual50 | Read-only published/active/price eligibility and excluded test ID; existing active Manual50 covers28 configured areas; owner-managed delivery confirmed. |
| CARD / signed callbacks | Genuine LIVE EGP5 transaction561728044, one paid owned order, unchanged HMAC-only service reconciliation. Initiation idempotency/amount/ownership contracts and prior accepted Paymob tests retained. No new charge. |
| Coupon / trusted price | EGP25+50−25−45=5 durable snapshot; FRE5 usage1. New Beta policy rejects coupons; final SQL pricing and command receipt stay unchanged. |
| Account/cart/order isolation | Existing accepted guards/native two-owner proofs retained; this order matches customer/recipient/original durable command; owner confirms My Account/Dashboard. Broader browser matrix remains deferred. |
| Manual cancellation/remedy | Owner confirms operational availability. Preserve original capture, consent, unique private operation and remaining amount; uncertainty never permits duplicate repayment. Automation and real refund test remain deferred. |
| Monitoring / reconciliation | Owner confirms staff review every15min. Sealed read-only monitor reports0 exceptions, two prior LIVE successes. No automatic provider call/retry. |
| Emergency stop | Same new approval includes one later runtime-only kill/restart, including after packet expiry; restores current closed runtime and preserves signed callbacks/owned receipts/late reconciliation. No SQL rollback or money action. |

Browser finding is **DEFERRED controlled-grant discrepancy (DTR-33/CX-07)**, not an
accepted all-browser matrix. Exact original rejected field remains unconfirmed;
matching persisted basket and public normal-address paths pass three focused local
actual-page/guard cases. No proven general application defect warrants a release.
Promote any valid public reproduction to a blocker and close purchasing; preserve
original command/payment, use safe flags, and do not charge again to diagnose it.
Chat/status403 is separate and remains held. Existing unfinished requirements stay.

## Guarded execution and stop boundary

Fresh encrypted schema98 database/full pg_restore and ten runtime-file full-byte
recovery PASS. New remote8/local3 operator guard groups PASS, final sealed live
preflight PASS with empty diagnostics. Source/compiled inventory/assets/security/
schema/history/frozen135/location/Storage boundaries match. Initial read-only
pre-closure checker used the pre-activation baseline; corrected to the recorded
active snapshot before closure. No production retry or extra restart occurred.

After exact approval inspect all local/remote intents/receipts, record approval
once, then run mandatory fresh preflight and encrypted recovery again. Apply once;
validate actual live CARD capabilities, normal route Auth denials, server policy,
protected schema/security/history and unchanged settings. Legitimate new public
orders/Auth activity are not rolled back. Public activation is NOT EXERCISED yet.
On drift/expiry/partial uncertainty STOP; no automatic retry, rollback or extra
restart. Issue a fresh packet if required. Never push Git or replay older operators.

Pinned `public-operator.mjs` modes are check/apply/kill; exact commands and the
read-only monitor are in the packet's OPERATOR.md. Kill is allowed once after
activation under this approval; it performs no refund, cancellation or provider
request. If monitoring cannot be maintained, close new purchasing and reconcile
privately. All32 original deferred rows, DTR-33 addition, separate96 location work,
storage audit, prior provider incident and both accounts' changes are preserved.
