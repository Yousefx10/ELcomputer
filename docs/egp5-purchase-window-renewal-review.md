> E83 update: this renewal is ACTIVE; APPLY CONSUMED.
> See [activation and exact deadline](egp5-purchase-window-activation-receipt.md).
> Historical preparation below does not authorize another activation.

# Renewed EGP5 purchase window — E82

**READY FOR SEPARATE APPROVAL. No new purchase window is active.**
The PDP/cart repair is [deployed](pdp-cart-repair-deployment-receipt.md).
Production is `a402cf24a9685e0d`, source `113b313`, schema98, PID52880.
Its repair approval is consumed. No second application deployment is proposed.

The original EGP5 window expired at14:21:33 Riyadh on27 October2026.
This proposal creates a separately approved replacement window.
It does not reuse that expired authorization or reset its purchase budget.

## Exact proposed authorization

```text
APPROVE EGP5 PURCHASE WINDOW af7112e281d0f2c7e58a232ec05f15bc87b1c2d598830718802f3649609b361c
```

This packet expires on **27 October2026,19:11:48.101 Riyadh**, matching
FRE5's existing expiry. It cannot extend the coupon or silently reseal itself.
A new window lasts **at most one hour from activation**, ending earlier
if this packet or FRE5 expires. Report its exact start/end after activation.

Only the original grant's `starts_at` and `expires_at` may change.
Keep the verified customer, real recipient hash, WOLF/Default/quantity1,
Manual shipping option, FRE5, fixed cart command and review key identical.
The original durable cart and unused one-charge budget remain authoritative:
one order, one Paymob intention, one owner card submission, zero retries.

The exact total stays **25+50−25−45+fee0 = EGP5**.
FRE5's customer/product/delivery scopes, one-use limit and expiry stay unchanged.
The fresh14:44:21 Riyadh read-only baseline confirms zero cart commands,
quotes, orders, payment attempts and payment transactions for this customer.
Saved recipient binding and all business settings still match.

## Proposed execution and closure

After exact approval, record it once, run fresh preflight and encrypted
recovery again, update only `NUXT_CONTROLLED_PURCHASE` dates, and restart
the production application once. No application switch or rebuild occurs.
No SQL, stock, coupon, business setting, Caddy, credential or public gate changes.
Public signup remains OPEN, public purchasing OFF, and PDC PAUSED.
The agent creates no quote, order, payment, Paymob request or shipment.
Only the owner performs the genuine payment after the ACTIVE confirmation.

This same NEW authorization also permits one later fail-closed closure,
including after expiry or owner activity. Restore the captured runtime
containing the original already-expired grant, then restart the app once.
Keep the repaired release, callbacks, owned receipts and late reconciliation.
Closure changes no application, SQL, stock, coupon or Caddy configuration.
It does not refund, retry, void or cancel an order or payment.

Exclusive activation/closure intents stop duplicate execution before a second
write or restart. Preserve partial receipts and STOP on drift or uncertainty.
No automatic retry, rollback, blind operator replay or extra restart is permitted.
Never use the consumed417c purchase operator or ddcd repair operator here.

Seven new remote guard groups and twelve local scope/deadline cases pass.
They cover separate approval, deployed target identity, unchanged cart/review key,
one-hour/coupon bounds, only-grant runtime patching, duplicate activation,
post-expiry closure, no deployment/edge mutation and unchanged public gates.
The initial local fixture assertion was corrected before qualification;
no production operation was involved. Existing application, Auth and payment
qualifications were retained; no completed acceptance test was repeated.
Fresh encrypted schema98 database full pg_restore and ten runtime-file
full-byte recovery checks pass. Final read-only preflight PASS at 14:48:24
Riyadh; diagnostics empty. Its receipt is recorded privately.
These checks do not establish genuine owner or Paymob acceptance.

Private packet: `../egp5-purchase-renewal-20261027/`.
See `READINESS.json`, `plan.json`, `readiness-baseline.json`, `qualification.json`,
`final-preflight.json`, `OPERATOR.md` and encrypted `backups/`.
No approval record or activation/execution record exists for this new packet.

## Owner purchase after ACTIVE confirmation

Reload normally as the selected verified Outlook customer. Add only WOLF,
Default, quantity1. Confirm the saved recipient and Manual50 delivery.
Apply FRE5 and verify the payable total is EGP5. Submit the owner's card
once privately before the newly reported deadline. Report the outcome;
do not retry an uncertain payment.

Then verify the actual provider result, signed callback, paid owned order,
FRE5 usage and Manual untracked fulfillment. Close the grant using this
packet, then prepare separate public purchasing approval after real acceptance.
All32 deferred tests, clean location4843754/version26190000, frozen135 paths,
Storage work, branches, commits and uncommitted work stay preserved and pending.
