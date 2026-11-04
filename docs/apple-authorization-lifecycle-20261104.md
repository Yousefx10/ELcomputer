# Apple authorization lifecycle — local guard, external evidence required

PAY-APPLE-LIFECYCLE-20261104-01, 4 November 2026.

Owner-observed iPad native sheet opening is PASS. Authorization/charge/finality
is NOT accepted. EGP325 latest attempt remains pending/submitted, with zero
recorded callbacks/funds/orders/inquiries. The exact provider references and
support case are private outside Git. Preserve every attempt and callback mapping.

Confirmed local cause of the unexpected return: Pixel1.2.8 calls the app's submit
hook before ApplePaySession.begin(). The app's onPaymentCancel then navigates to
checkout. The consumed submission fence correctly prevents an unsafe same-item
retry; schema113 already permits separately quoted nonoverlapping purchases.
Neither cancellation nor timeout is financial finality.

The new minimal local guard keeps the current document/intention on cancel and
provides honest localized feedback. It does not alter SDK bytes, server gates,
callbacks, SQL, CARD/COD or financial state. It does not resolve the unexplained
native sheet dismissal or make a fresh retry safe. It is not a full payment fix
or a production release recommendation.

Actual pinned-SDK Chromium/WebKit fixtures reproduce validation rejection,
preauthorization fence consumption, cancellation, lost acknowledgement, duplicate
callbacks and account invalidation. The fixture rejection is a hypothesis for
the physical failure, not observed provider evidence. Initial10-second failure,
real validation status/request ID and exact iPadOS exception remain unavailable.
No automatic clearing, fixed wait, native global monkey patch, vendor modification
or invented provider response is used.

Paymob must supply the exact intention/order trace and authoritative outcome,
plus a supported postauthorization presubmit hook or negative-result inquiry
contract. Support text is prepared, not sent. Current uncertainty is preserved.
No fresh provider call, charge, refund, cancellation or production write occurred.

Official contracts: [Pixel](https://developers.paymob.com/paymob-docs/developers/checkout-experiences/pixel-embedded)
and [Apple merchant validation](https://developer.apple.com/documentation/applepayontheweb/applepaysession/completemerchantvalidation).

Storefront/Meta/image work continues independently. Payment changes remain in
local/apple-authorization-lifecycle-20261104. Production releases remain held
while this payment-critical issue is unresolved; no short-lived approval is issued.
