# Paymob complete attempt-history contract request — draft only

28 October 2026. **NOT SENT. No provider transaction authorized.**

Merchant API Key authentication succeeds against Egypt Accept using the existing
API-key/token flow. A separately approved GET for a known Live order returned200
and matched our stored order, merchant, amount, currency and original attempt
reference. It did not satisfy our required bounded nested transaction-history
array contract. We stopped; no order state or customer payment was changed.
Our safe receipt does not identify whether the history field was absent, non-list
or over20 entries. No raw response is retained. Do not describe it more precisely.

We need the following supported contract for this merchant/region before another
API procedure can be reviewed:

1. Exact read-only API method/path, authorization, and documented filter binding
   to one existing Paymob order ID or merchant special reference. We need every
   transaction attempt, not just the latest. No create/pay/refund/void/cancel API.
2. Request/response schema, all status meanings and explicit Test/Live/merchant/
   integration/order bindings. Include success, pending, failed, authorized,
   captured, refunded, voided and partial/multiple-payment histories.
3. Pagination/cursor/count/ordering and completeness guarantees. How can a client
   distinguish no transactions from missing/truncated/filtered history? What is
   the maximum page size, and how should concurrent late transactions be handled?
4. Read permissions and rate limits for the existing Merchant API Key; do not
   request regeneration/replacement of working Secret/Public/HMAC keys.
5. Separately, how can the original intention/checkout/3DS flow be proven terminal
   so an old session cannot later charge after a negative inquiry? Do not assume
   local cancellation/expiry closes Paymob or request a money action for this check.

Please supply official merchant-specific API Explorer/Postman documentation and
synthetic/redacted examples. Do not send API keys, auth tokens, cookies, card/PAN,
billing data or customer details. Existing provider IDs can be shared privately
with support by the owner if necessary; no broad account export is needed.

[Official latest-only order/reference inquiry](https://developers.paymob.com/paymob-docs/developers/transaction-inquiry-apis/transaction-inquiry/by-order-id-or-reference)
explains why a failed latest transaction cannot exclude an earlier success.
[Official transaction-by-ID inquiry](https://developers.paymob.com/paymob-docs/developers/transaction-inquiry-apis/by-transaction-id)
can inspect known IDs but does not by itself discover complete history when IDs
are missing. The Dashboard provides transaction filtering, including by Order ID:
[Paymob Dashboard documentation](https://developers.paymob.com/paymob-docs/getting-started/new-dashboard).
Viewing an order-scoped all-status history may provide manual evidence; it does
not qualify API automation or old-session finality. Do not click Refund/Void/
Capture or change provider state. Keep any history evidence private and sanitized.
