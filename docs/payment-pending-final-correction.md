# Payment pending correction — 5 November 2026

The browser previously retained one checkout command per account. Checkout's
confirmation action recovered that command before comparing it with the current
basket. A lost acknowledgement or a second tab could therefore replay an old
quote. The SQL113 affected-item gate remained safe, but the browser selected the
wrong purchase and rendered or navigated to its old status.

Retain unacknowledged requests by account, cart and revision. Preserve the legacy
pointer and exact request bytes for recovery. Select only the current revision;
an independent basket uses a new reviewed command. An acknowledgement removes
only its matching request. Old acknowledgements cannot clear a newer command.
Storage failure stops submission. These local envelopes contain no provider keys.

An affected-item conflict now stays inline with a private status reference.
It does not mount the SDK, hand off a hosted payment or navigate automatically.
Cart editing remains available. New purchase commands still pass the unchanged
SQL advisory locks, immutable quotes, overlap checks and one-use submission gate.
This browser selection is never evidence of financial failure or permission to
submit an already uncertain obligation. Saved Payment Activity remains private.

Reuse the qualified Apple document-preservation guard and pinned Pixel1.2.8.
Opening CARD/Apple UI alone leaves initialized state. Pixel's prepayment hook
runs before native Apple authorization; once that hook arms the server, closing
the sheet retains submitted uncertainty. The SDK supplies no authoritative
no-charge cancellation receipt. Do not reset the fence, use elapsed time as
finality, patch vendor internals or repeat authorization automatically.

Historical unknown and submitted attempts are unchanged. Authenticated callbacks
still verify exact amount, currency, integration and order/customer linkage,
create one paid order, notify once, and finalize only purchased cart lines.
Confirmed decline permits server-authorized reuse of the existing intention.
Duplicate/late callbacks preserve the existing SQL113 processing contract.

No migration is required for this correction on physical schema114.
No provider request, financial mutation, public policy change or SDK change is
included. Existing targeted inquiry normalizes authenticated evidence but is not
an automatic reconciliation service. A provider-authorized lookup, documented
merchant access and a separately reviewed durable rate/dispatch gate are required
before enabling automatic inquiries. Missing transactions and 404s remain unknown.
Real native device, merchant and callback-delivery acceptance remain separate.
