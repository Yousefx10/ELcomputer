# Account carts and checkout continuity

Account carts belong to the authenticated Supabase identity. The API verifies the
bearer token and active customer profile; it never accepts a customer identifier.
Only the service role can execute cart RPCs. Private tables have RLS and no direct
browser or service table grants. Responses use private, no-store.

The server stores product/variant IDs, quantities, stable line IDs and a coupon
code. It projects current public catalog data, variant options and prices. Quotes
and order transactions retain final authority for availability and every amount.
Unavailable existing items remain visible for removal. New unavailable items fail.

Writes compare the server version under an owner lock. Receipts bind one UUID to
the exact command. A lost response retries that same command. A stale snapshot
cannot overwrite another device's changes. The rejected edit stays in memory;
Show saved cart explicitly replaces it with the authoritative state. A recovered
receipt cannot adopt another device's version for a queued old snapshot.

Other devices refresh on focus and every 15 seconds while visible. Checkout waits
for acknowledged synchronization. Offline writes show an error and retain the
pending command for retry; they cannot authorize a payment.

Guests keep the existing owner-scoped browser cart. Login merges each guest
revision once, taking the maximum quantity for duplicate SKUs. Server line IDs
win. Unavailable or incompatible guest items are skipped with a visible notice.
The current account's selling mode wins; an empty account chooses a stable first
eligible product. Browser account envelopes are imported only into that same
identity, then removed. Logout clears private visible state and starts a fresh
guest cart. Account A never becomes account B's guest import.

Verified paid sessions subtract only their frozen quantities and matching line
identities, once. Late success preserves new additions and removed/re-added lines.
Optional cart cleanup cannot block verified settlement. The authenticated paid
status page can retry cleanup. COD acknowledgements clear only the unchanged
reviewed cart; concurrent edits require explicit reconciliation. Emptying a cart
starts a fresh checkout command identity. No payment or order record is erased.

The deployment needs GET/POST /api/account/cart through the restrictive proxy.
No other method or private route is opened. Local syntax qualification does not
install or activate that routing change.

Existing cookie, authorization, payment-first, reset and provider contracts remain.
These migrations reserve no physical ledger positions. Main and paused Daftra/SMS,
Meta and image archives are preserved. Hosted A/B acceptance remains separate.
