# Session exposure containment and checkout status — E85

**Global sign-out of the older sessions VERIFIED at16:26:06 Riyadh,27 October2026.**
OD-20261027-SESSION-EXPOSURE-01 takes priority over checkout until containment.
The owner reported an exposed customer Auth cookie. No exposed token/cookie was
read, decoded, copied, logged, tested or reused by the agent.

## Verified revocation

The owner used My Account → Sign out. The deployed account layout calls
`supabase.auth.signOut()`; the installed SDK defaults to global scope and calls
Auth `/logout?scope=global`. No administrator impersonation, password change,
account deletion or unsupported Auth-table mutation was performed.

At16:20:23, read-only metadata showed2 sessions and2 unrevoked refresh rows.
After global sign-out, all older sessions and older unrevoked refresh rows were
absent. One new session was created at16:20:57; the owner explicitly confirmed
signing in again. That intentional new session and its refresh token remain.
Do not report zero TOTAL sessions or confuse the new login with failed revocation.
Only aggregate session/token-row metadata was queried, never token values.

Issued access JWTs can remain cryptographically valid until their own exp on
stateless paths. The exposed JWT's expiry was not read or tested. Global sign-out
prevents those refresh tokens from minting replacements. Official references:
[Supabase sign-out](https://supabase.com/docs/guides/auth/signout) and
[session lifecycle](https://supabase.com/docs/guides/auth/sessions).

Hosted Auth reportsv2.197.0. Its [authentication middleware](https://github.com/supabase/auth/blob/v2.197.0/internal/api/auth.go)
loads the session_id row and rejects a missing session. Checkout/quote/coupon and
payment routes use server-side `supabaseAdmin.auth.getUser`, so that source check
protects these session-bound routes. This is a pinned-version source inference,
not a replay of the exposed token. Anonymous/authenticated roles also lack direct
checkout RPC execution; this remains a required fresh-window preflight condition.

## Checkout and payment evidence

Read-only16:21:10 counts remain0 cart commands,0 quotes,0 orders,0 Paymob attempts
and0 payment transactions. FRE5 is unchanged, active, usage0/limit1. Schema98 and
application a402cf24a9685e0d/source113b313/PID53535 are unchanged. Runtime, Caddy,
assets and private/media preservation checks match the prior active baseline.

The latest purchase window expired15:59:04 Riyadh. A request now is correctly
rejected by `controlledPurchaseScope` expiry before review/commit/payment. No
extension or new purchase activation occurred during this investigation.

Earlier, while the window was active, missing FRE5 was rejected by exact coupon
equality in `authorizeNormalCheckout` before the SQL quote RPC. A complete matching
FRE5 request passes the actual handlers and identical deployed SQL in the E84
focused disposable test, producing25+50−25−45+fee0=5. Live read-only arithmetic
also confirms5. No production quote was inserted and no successful Paymob test
was repeated. The AFTER-FRE5 rejected browser field remains UNCONFIRMED.

The confirmed browser Network entry supplied by the owner was GET `/api/chat/status`,
not a checkout request. A bounded review of12,000 recent application journal
entries found no retained checkout error record attributable to the customer.
There is no explicit Caddy access-log directive. The historical failed checkout
payload cannot be reconstructed from that evidence. Never invent its rejected field.

## Separate Live Chat finding

GET `/api/chat/status` reproduces403, text/plain, “Unavailable”. The Caddy
`@commerce` rule includes `/api/chat/*` and returns that exact response before
Nuxt. The public launcher independently polls this route. Normal quote/coupon
POST routes have their separate allowlist and reach Nuxt authentication.
This chat denial is not proof of a failed checkout request or payment.
Chat access-policy correction remains separate; no chat/Caddy activation ran.

## Minimum safe continuation

Keep the original fixed cart/review key and unused one-charge budget. Because
15:59:04 passed, prepare a new separately approved, at-most-one-hour EGP5 runtime
window, bounded by FRE5's unchanged19:11:48 expiry. Recheck revocation, exact
bindings, pricing and0 commands/orders/attempts before any activation.
No speculative application correction is justified by the available payload.
A read-only browser match-flag check is available in the E84 private packet;
return only flags, never Network headers, cookies, tokens or address details.
If a genuine binding/code defect is demonstrated, qualify the minimum correction
before proposing deployment. Public purchasing remains subject to separate approval
following genuine owner payment and reconciliation.

No application deployment, restart, SQL/business write, coupon/stock/Caddy change,
provider transaction or agent payment occurred. Signup OPEN, purchasing OFF,
PDC PAUSED. All32 deferred tests, frozen135 paths, clean location4843754/version
26190000, Storage work and existing branches/commits/uncommitted work are preserved.

Private evidence: `../session-exposure-checkout-20261027/baseline.json`,
`after-global-signout.json`, `revocation-verified.json`,
`request-log-availability.json`, and the token-free `inspect-safe.mjs`.
