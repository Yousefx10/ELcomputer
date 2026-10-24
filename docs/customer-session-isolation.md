# Customer session isolation — Phase1

This milestone combines the accepted profile correction with Cart, Checkout and
My Account isolation. It changes application code only; schema91 stays unchanged.
It does not activate registration, purchasing, coupons or provider initiation.
PDC remains completely paused. Its uncertain incident and original reference stay
untouched. Manual shipping configuration remains the next separate milestone.

## Customer state

`useCustomerIdentity` uses the current browser Auth session. JWT claims refresh
asynchronously, so old claims cannot restore a previous customer after sign-out
or account switching. Server rendering continues to use its request's verified
claims. A session generation distinguishes A→B→A from the original A lifetime.
Token refresh for the same account keeps its current page and draft.

Private Account, Cart and Checkout pages/layouts remount on account changes.
This discards wallet/order/message/support/claim details, attachment drafts and
payment components. Public storefront routes retain their existing lifecycle.
Order-summary async-data keys include the account and generation; an old cache
entry cannot supply another customer's summary.

`useCustomerScope` binds private requests to their component's original customer
and generation. It checks before and after session lookup and network responses,
freezes the bearer, and invalidates/aborts on account changes or disposal.
Caller cancellation and existing request timeouts remain independently enforced.
Queued support/order actions cannot acquire the next customer's bearer. Late
downloads cannot open a former customer's file. Reorder results cannot add the
former customer's purchases to another cart. Shipping subscriptions stop when
their original customer scope ends; no new provider behavior is introduced.

The accepted profile/header clearing and save guards remain. They now read the
session-backed customer identity instead of potentially stale claims.

## Carts and anonymous browsing

Version3 envelopes live under `commerce-cart-v3:<encoded owner>`.
Authenticated owners use `account:<Auth UUID>`. Anonymous baskets use a random
browser-session identifier retained in sessionStorage. Signing in loads that
account's own basket. There is no automatic guest/account merge or transfer.
Signing out starts a fresh anonymous basket; it never reuses the signed-in cart.

Legacy browser-wide v2/older envelopes have no proven owner. They remain on disk
but are excluded from all account and anonymous baskets. Never guess their owner.
There is no new server cart table or migration. Scope changes clear memory before
reading storage, including when storage is corrupt or unavailable.

Cart items, coupons, cart IDs and completion markers are scoped by owner.
Same-account tabs retain existing revision/fork acknowledgement semantics;
another customer's completion cannot consume the active cart or overwrite edits.

## Checkout and recovery

Checkout invalidation clears customer address, delivery choice/options, quote,
coupon input/results, proof file, payment selection, errors and displayed pending
recovery. The new component reloads the current customer's profile and cart.
Late quote/coupon/profile/payment responses cannot populate the replacement page.
Pixel sessions are discarded; result polling and obsolete subscriptions stop.

Pending commands stay under their existing authenticated customer key. Switching
accounts neither deletes them nor changes their order/cart/quote/address body.
If an already dispatched request completes during a switch, it still belongs to
its original customer. The replacement page cannot display its response or clear
another cart. Returning to the original account recovers the same command through
the existing server receipt and transaction; it does not create a new command.

No server ownership check, RLS policy, transaction lock, financial validation,
HMAC/callback handler or payment idempotency function changed.

## Focused validation

- 83 security tests pass with zero failures/skips. These cover the new session/cart
  boundaries, accepted profile races, account RLS, owned order recovery, checkout
  command validation, signed callback security and native PostgreSQL concurrency.
- 15 browser tests pass with zero failures/skips. They execute the actual Vue
  scripts/templates with synthetic Auth/REST responses, including EN/AR recovery,
  sign-out/sign-in, A→B, two tabs, stale claims, late address/quote/coupon/Intention
  responses, in-flight order recovery and order/summary/message/wallet clearing.
- Clean npm10.9.8 install, Nuxt typecheck and production build use Node22.23.1,
  an empty dotenv and a clean environment. Existing workspace outputs are retained.
- Release guard tests reject incorrect approval and tampered plans before target
  access. Existing retained-asset repair checks are reused.
- Exact archive HTTP/browser qualification and final seal are recorded in the
  separate [approval packet](customer-session-release.md). Source fixtures alone
  do not establish exact-archive or hosted acceptance.

All browser and SQL fixtures are local and synthetic. No customer signup, real
charge, shipment, production profile/order write or provider request is authorized.

## Release scope and preservation

The private preparation is `../customer-session-isolation-20261024/`.
It contains source/workspace manifests, encrypted database/runtime backups with
full readback, baseline schema/security/business fingerprints, retained assets,
test logs and the extracted archive. Fresh checks preserve the paid EGP2 order,
late signed Paymob ingress, the uncertain PDC dispatch and its private evidence.

One pre-existing workspace change in `server/utils/pdcLookups.js` is outside this
milestone. The candidate uses that file from the verified deployed source.
Workspace bytes and Git history remain untouched. The exclusion and both hashes
are explicit in the source binding; the paused PDC change is not deployed.

The first unsealed package exposed missing serving metadata for retained assets.
The next package was superseded by the timeout/caller-signal correction. Both
remain non-deployable. The final package reuses the existing guarded
registry repair: retain exact asset bytes, preserve every new registry entry,
add only verified old serving entries and reject differing collisions/symlinks.
No feature rebuild or source change is needed for this packaging correction.

Production deployment still requires the packet's exact owner approval and a
fresh read-only preflight. The operator takes fresh execution backups, privately
qualifies the target candidate, changes the application symlink and restarts Nuxt
at most once. It does not edit/reload Caddy, apply SQL or change runtime secrets.
Any stop preserves evidence; no automatic retry or rollback is authorized.
Existing customer tabs must reload after deployment to load the corrected code.
Retaining old assets preserves URLs; it cannot replace already executing code.
