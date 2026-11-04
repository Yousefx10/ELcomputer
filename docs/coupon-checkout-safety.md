# Coupon repair and preorder boundary

The actual Beta policy rejects all coupons unless its reviewed configuration
explicitly sets allow_coupons: true. The new capability reports that opt-in. The
existing default remains closed; an unavailable coupon now has clear feedback.
Changing production runtime policy requires its own reviewed deployment scope.

The existing fixed/percentage and optional delivery discounts, normalization,
dates, minimum spend, customer/product/carrier scopes and idempotent order usage
are reused. Optional category scope applies to the entire basket, matching the
existing whole-basket product scope. Optional per-customer limits count lifetime
accepted orders. Cancellation/refund does not automatically release usage.

Submitted or unknown unresolved financial obligations hold coupon capacity.
Unsubmitted initialized forms and sessions without a provider attempt do not.
Capacity is checked again under the coupon row lock before submission. Existing
uncertain attempts keep their quoted terms and late-success processing. A browser
cancel, timeout or absence of callbacks never releases financial evidence.

The disclosure starts collapsed. An applied coupon remains visible in the summary
and stays applied when collapsed. Apply/remove and delivery changes refresh the
authoritative quote. Client prices never authorize a discount or payment.

Preorders currently support the historical verified manual-payment contract.
Production payment-first and Beta policy expose CARD/COD, while manual InstaPay
is OFF. Bank transfer is saved as enabled but excluded by those checkout policies.
Consequently no approved payment-first preorder method is currently available.
The delivery step now says this explicitly. It never creates an unpaid normal
order, bypasses stock/consent rules, or silently enables a payment method.

Full payment-first preorder completion requires a separately reviewed financial
path supporting its full/deposit snapshots, allocation limits, verified funds,
exactly one order, later balance and staff fulfillment. That implementation and
genuine acceptance remain open. The existing manual preorder transaction is
preserved. Its old automatic-shipping fixture also fails on unchanged deployed
source; that failure is retained, not treated as a new regression or a pass.
