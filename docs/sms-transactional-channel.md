# Transactional SMS channel

Local candidate only. Runtime `smsTransactionalEnabled` and private database
`transactional_enabled` both default OFF. Vodafone's provider switch, confirmed
sender/IP/V5 hash protocol, encrypted credentials, mature queue leases and final
pre-POST checks remain required. No scheduler is installed by the migration.

Dashboard → SMS → Settings has the separate transactional switch and seven event
bindings. Settings and templates retain their existing named staff permissions.
Templates use optimistic revisions, archive old versions privately, and retain the
existing bilingual rendering, XML validation and GSM-7/UTF-16 segment preview.
Editing a bound template cancels already queued automated messages conservatively.
Raw campaign sending is closed; marketing requires its own release.

| Template | Actual source | Automated status |
| --- | --- | --- |
| tx_cod_confirmed | Accepted unpaid cash order after channel enable | Disabled binding |
| tx_prepaid_confirmed | Primary live funds plus signed/inquiry callback and paid order | Disabled binding |
| tx_payment_failed | Definitively failed, signed and processed live attempt callback | Disabled binding |
| tx_transfer_under_review | Ready proof and canonical under-review submission | Disabled binding |
| tx_transfer_verified | Reviewed primary transfer funds and fully paid order | Disabled binding |
| tx_transfer_rejected | Ready proof and canonical reviewer-backed rejection | Disabled binding |
| tx_invoice_available | Genuine issued current-tenant invoice with verified client/order ownership | Optional A dependency, disabled binding |
| tx_shipment_booked | No new automatic producer: booking acceptance must be separately qualified | Disabled template |
| tx_shipment_dispatched | Existing trusted PDC out-for-delivery event binding can select this | Disabled template, existing control OFF |
| tx_shipment_delivered | Existing trusted PDC delivery event binding can select this | Disabled template, existing control OFF |
| tx_refund_update | No invented refund outcome: accepted claim communication/manual policy only | Disabled template |

Only new events after enable are eligible. Order capture is additionally bounded
to 24 hours; polls scan at most 100 per source and prepare at most three messages.
Unique event/source keys prevent repeats. Old order-confirmation producers cannot
be enabled together with overlapping new billing confirmations. Financial state
is never altered by SMS capture. No pending/abandoned/unverified payment is a paid
confirmation. Invoice links point to the authenticated opaque My Account route.

Preparation uses expiring leases and max three claims. Actual HTTP dispatch retains
the original transport's no-resend-on-uncertainty rule and stable ExternalTrxId.
Runtime, provider revision, source, template revision, lease and database channel
state are checked again before POST. An unavailable/changed source suppresses the
intent; re-enabling a switch does not revive suppressed history.

Provider SUBMITTED is not handset delivery. No merchant delivery-receipt/inquiry
contract was supplied, so no receipt endpoint or delivery claim is fabricated.
Brevo Email and Supabase Auth messages are unaffected.

Qualification: tests/sms-transactional.test.mjs exercises the actual migrations,
private access, stale revisions, duplicate capture, Arabic queue, changed-template
cancellation, source cancellation and unpaid source exclusion. Existing V5 transport,
queue, order and PDC tests remain the protocol regression sources.
