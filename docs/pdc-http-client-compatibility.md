# PDC HTTP client compatibility

PDC requests use the generic `Storefront-PDC/1.0` User-Agent. The shared header
builder applies it to booking, labels, city/product GETs and status lookups.
It contains no store, domain, account or deployment identifier. No new runtime
configuration is required.

The correction follows a controlled production read-only comparison. On the same
VPS, default Node requests returned HTTP500 while curl returned HTTP200. Adding a
fresh, self-issued session cookie did not fix Node. Holding that cookie, JSON,
credentials, source IP and TLS path constant, changing only the User-Agent from
`node` to `Storefront-PDC/1.0` changed a dated status lookup to HTTP200.

The owner then executed one corrected Node booking from the VPS. The protected
receipt confirms HTTP200, AWB `EDC17983113EG`, booking ID1071825 and reference
`ORD-24046ef1-b9a6-46bf-93ec-58df0c85503e`, at12:14:33 Riyadh24October2026.
There was one provider request, no retry, no cookie and zero database writes.
This establishes production static booking acceptance. Dynamic customer-field
and normal Dashboard acceptance still require a separately authorized test.
The provider's internal exception remains unknown. The separately approved client
release `2573cdf1504bf559` is now deployed. Production provider gates remain closed;
deployment made no provider call and does not authorize another booking.

The integration retains `Accept: application/json`, JSON content type, existing
encrypted credentials, exact production/test origins, redirect refusal and no
automatic retries. It adds no browser cookies, cookie jar or authentication flow.
Curl succeeded without cookies; session warmup alone was insufficient for Node.

Status lookups require explicit, valid `fromDate` and `toDate` with timezone offsets.
The transport rejects missing, malformed or reversed dates before making a call.
Normal tracking, original-reference recovery and reverse-shipment status operations
read only the matching saved job's creation timestamp. They send UTC dates from
the preceding day through the end of the current day. This includes older
shipments instead of silently dropping them outside a rolling recent window.
An unreadable/missing job timestamp stops the lookup. Existing reference/AWB
matching, throttles, authorization and persistence contracts remain intact.
No configuration input or database migration is required.

Wire-header observation uses the official
[Undici diagnostics channel](https://github.com/nodejs/undici/blob/v6.27.0/docs/docs/api/DiagnosticsChannel.md).
Credentials and cookie values are redacted before summaries are written. Raw
provider responses and session evidence remain encrypted in private diagnostics.
The cookie name `cookiesession1` also appears in
[Fortinet's session documentation](https://docs.fortinet.com/document/fortiweb/7.4.0/administration-guide/669661/https-sessions-security),
but the name alone does not prove the cause of a provider failure.

Focused checks cover all five PDC operations, independent account settings,
unchanged Arabic serialization, required status dates, older shipment coverage,
cookie absence and one-call failure behavior. Product40 remains the existing
deployment setting; reusable logic still respects configured products. Weight-only
booking fields remain unchanged. No dimensions, pickup endpoint or scheduling
flag is added. PDC may create an implicit pickup with a shipment; cancellations
remain manual. See the [acceptance receipt](pdc-static-booking-acceptance.md) and
[guarded release](pdc-http-client-release.md).
