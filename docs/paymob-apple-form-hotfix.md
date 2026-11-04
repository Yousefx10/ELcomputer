# Apple Pay initialization hotfix

Task `PAY-APPLE-FORM-20261104-01`. Application-only correction on schema113.
Reuse the unmodified, integrity-pinned Pixel1.2.8 and existing payment-first APIs.

The previous checkout advertised top-level Apple eligibility, then initialized
the SDK in a child context with a second capability check. Rejection before
mounting became the generic form-unavailable message. A fixture with an eligible
top-level context and restricted child reproduces that immediate rejection.
The original device exception was discarded, so its exact Safari exception is
not independently known. This qualification does not claim physical acceptance.

Apple checkout now opens `/checkout/apple/:id` through a full document navigation.
That route uses existing customer middleware and the owned interface endpoint.
It reopens the same intention, checks its Apple method and expiry, and renders the
same server-authoritative quote. The real SDK creates its Apple session from its
button gesture. The existing server submission gate runs before the sheet begins.

Cancellation closes the page without inventing financial finality. A submission
or uncertain acknowledgement stays fenced. Completion opens server status; client
success and duplicate callbacks never create or pay an order. Retry is explicit,
replaces the document, and uses the existing intention. All exits dispose SDK
globals without undocumented methods. Account changes clear private details.

Fixed phase codes and concise localized recovery messages replace raw exceptions.
Keys, client secrets, provider bodies and payment payloads are not logged or stored.
CARD retains its current iframe, COD is unchanged, and callbacks/HMAC, quotes,
funds, reconciliation, duplicate prevention and SQL remain unchanged.

Local qualification uses the actual pinned SDK with isolated provider responses
and a synthetic Apple session. It verifies button-to-session calls, amount,
currency, trusted gesture, eligibility, expiry, cancellation, denied/unknown gates,
SDK/network failures, replayed client callbacks, privacy, EN/AR and mobile layout.
Real device sheet/merchant/authorized payment acceptance remains a separate gate.

Official contracts:
[Paymob Pixel](https://developers.paymob.com/paymob-docs/developers/checkout-experiences/pixel-embedded),
[Apple session gesture](https://developer.apple.com/documentation/applepayontheweb/applepaysession/applepaysession),
[Apple iframe guidance](https://developer.apple.com/forums/topics/app-and-system-services/app-and-system-services-apple-pay?sortBy=boosts&sortOrder=DESC).
