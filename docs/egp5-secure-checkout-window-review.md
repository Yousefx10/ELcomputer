**Historical E86 preparation. Approved and activated once under E87; see the
[activation receipt](egp5-secure-checkout-window-activation-receipt.md). Never replay.**

# Post-revocation EGP5 checkout window — E86

**READY FOR EXACT APPROVAL. No new purchase window is active.**
[Exposure containment](session-exposure-checkout-receipt.md) is verified.
Both older sessions and all older unrevoked refresh rows are gone.
The owner confirmed a subsequent fresh login; its new session is intentional.
The agent never read, decoded, copied, tested or reused the exposed credentials.

The earlier purchase window expired at15:59:04 Riyadh,27 October2026.
Production remains `a402cf24a9685e0d`, source `113b313`, schema98, PID53535.
No application correction or redeployment is proposed. The earlier after-FRE5
rejected browser field remains UNCONFIRMED; this packet addresses the expired window.

## Exact proposed authorization

```text
APPROVE SECURE EGP5 CHECKOUT WINDOW e239dbb76fed3311eed3c67606f0f06b9e749eaa93d23562ea5b8bab79ba92db
```

Packet expires **27 October2026,19:11:48.101 Riyadh**, FRE5's unchanged expiry.
The proposed new window lasts at most one hour FROM ACTIVATION, ending earlier
at that deadline. Exact start/end must be reported after activation.
No implicit extension, consumed-operator replay or coupon expiry change.

Change ONLY the original private grant's starts_at and expires_at. Preserve
verified customer, recipient hash, WOLF/Default/quantity1, Manual delivery ID,
FRE5, exact500-minor amount, original durable cart and review key. The unused
budget is still one order, one Paymob intention, one owner card submission,
zero retries. The original barrier is not replaced or reset.

Exact payable total:25 merchandise+50 delivery−25 item discount−45 delivery
reduction+cardfee0 = EGP5. FRE5 and all product/stock/business settings stay unchanged.
The previous E84 focused identical-SQL/handler test supports this canonical quote;
no hosted owner quote or payment acceptance is claimed. No successful Paymob tests
were repeated. Initial no-coupon rejection is expected; Apply FRE5 is a separate
request that must carry the exact cart, saved delivery and Manual binding.

## Proposed activation and closure

After NEW exact approval, record it once and run fresh preflight/encrypted recovery
again. Verify old sessions remain revoked, known hosted Auth version remains
v2.197.0, anonymous/authenticated direct checkout RPC execution remains denied,
and no command/quote/order/attempt/transaction or coupon use has appeared.

Then update the grant dates and restart the app ONCE. No app deployment, SQL,
stock, coupon, settings, credentials, Caddy, callback or public-gate change.
Signup remains OPEN, public purchasing OFF and PDC PAUSED. The agent creates no
quote/order/intention/payment/provider call. No exposed token is used in any phase.

The same NEW approval permits one later runtime-only closure, also after expiry
or owner activity. Restore the captured already-expired preceding grant and restart
once. Keep the repaired application, callbacks, owned receipts and late reconciliation.
No SQL/Caddy/coupon change, refund, retry, void or cancellation. Exclusive intents
stop duplicate activation/closure. On partial/uncertain execution preserve evidence
and STOP; no automatic retry, rollback or extra restart.

Fresh read-only baseline at16:35:49 Riyadh confirms exact bindings, original unused
budget and zero commerce commands/quotes/orders/attempts/transactions. All protected
schema/security/business projections compare unchanged despite legitimate Auth
session activity. Old sessions/refresh tokens remain absent; the current login was
owner-confirmed. Hosted Authv2.197.0 [getUser middleware](https://github.com/supabase/auth/blob/v2.197.0/internal/api/auth.go)
rejects missing session_id rows. This is source-based assurance; the exposed JWT
was not tested. Access JWTs can still be valid for stateless checks until exp;
their actual secret contents/expiry were not read.

Three new remote security guard groups and eight local cases PASS. Previous
qualified activation/closure logic is reused unchanged. A new read-only SQL guard
initially stopped at42883 text/UUID parameter inference; explicit casts were fixed
BEFORE sealing. The original diagnostic is preserved. No production write occurred.
Fresh encrypted schema98 database full pg_restore and ten runtime-file full-byte
recovery checks PASS. Final read-only preflight PASS at 16:40:44 Riyadh;
diagnostics empty. Its receipt is recorded in the private packet.

Private packet: `../egp5-secure-checkout-window-20261027/`.
Read `READINESS.json`, `plan.json`, `readiness-baseline.json`, `qualification.json`,
`final-preflight.json`, `OPERATOR.md` and private encrypted recovery evidence.
No owner approval or activation record exists for this new packet.

## Owner flow after ACTIVE confirmation

Use the newly authenticated selected Outlook customer. Keep only WOLF/Default1.
Confirm saved delivery fields and select Manual50. Enter FRE5 and click Apply
BEFORE Continue to payment. Verify coupon applied and server payable total EGP5.
Pay once privately only after that review, before the new reported window end.
If any step fails, STOP and return only the failed checkout route/status and the
private E84 browser check's match flags. Never copy Network headers, cookies,
tokens, full session output or address details. Do not retry an uncertain payment.

Then verify genuine provider result, signed callback, paid owned order, coupon use
and Manual untracked fulfillment; close the runtime grant. Public purchasing
activation requires its own later approval after actual acceptance.
Live Chat GET status403 is separately explained by Caddy and remains outside scope.
All32 deferred tests, clean location4843754/version26190000, frozen135 paths,
Storage work, branches, commits and uncommitted work remain preserved and pending.
