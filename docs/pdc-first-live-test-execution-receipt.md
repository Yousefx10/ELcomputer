# First live PDC API test — uncertain outcome, execution stopped

**PAYMOB remains VERIFIED. PDC booking remains UNCONFIRMED.**
The owner approved seal
`5a03be551efea46477528467db6bd954b3e353617f28d93c641819427e43e4fb`.
The sealed operation executed against existing paid/packed order
`ORD-20261023-8C0C964CBD`. No booking retry is authorized.

| Approved operation | Actual result,23October2026 Asia/Riyadh |
| --- | --- |
| One SaveShipmentEx | Sent once at23:27:50.247. PDC returned HTTP500,95-byte JSON, success=false, generic unspecified-error message. No AWB returned. |
| One original-reference lookup | Sent once at23:30:06.166, after136seconds. GetShipmentsStatus also returned HTTP500 and the same generic message. No matching AWB could be established. |
| One private ExportPDF | Not attempted: no confirmed, persisted AWB exists. |

Reference, persisted before provider submission:

```text
ORD-8b59b9e0-df2a-4269-a61d-4b3fe244e871
```

The application job is `2ea28361-f56a-46c8-a2d7-9667f069f723`, state uncertain,
attempt_count1, AWB null. Its matching durable dispatch also remains uncertain.
The original reference and dispatch barrier prevent another booking. Never clear
them, replace the reference or rerun the booking operator merely because no AWB
is recorded. Neither HTTP500 proves that PDC created no shipment or pickup.

The response bodies were authenticated/decrypted offline from retained encrypted
evidence. Both contain only success=false, a generic Arabic error message and a
traceId. This is an actual upstream HTTP500, not an HTTP200 response-schema
rejection. The root cause is unknown; no account, credential, Product40, test-value,
city, payload or parser defect is established. No corrective development or retry
was undertaken. Actual test/cancellation fees are not established by these errors.

## Preserved state and evidence

The paid order remains EGP2, paid/Ready to Deliver, with its existing completed
packing evidence. One successful Paymob transaction remains recorded. There was
no further payment, refund, cancellation, reverse shipment, separate pickup,
GetProducts/GetCities or PDF call.

The process ended. Caddy, production runtime files, provider credentials, Paymob,
application artifact and global purchasing/provider gates remain unchanged and
closed. No public or shipping access window was opened. No deployment occurred.

Thirteen private operation files were copied over authenticated SSH and verified
by SHA256. Raw requests/responses remain encrypted on private VPS and local disk;
the two PDC trace IDs and a prepared incident packet remain private. No credentials,
customer address/phone, raw response or encrypted evidence entered Git.

Private execution directory: `../first-live-pdc-test-20261023/`.
`PRIVATE-PDC-INCIDENT.md` contains exact timestamps, trace IDs, original reference,
test fields and the reconciliation question. It is prepared, not sent to PDC.
`final-order-readonly.json` verifies the durable uncertain job/dispatch and preserved
paid order after both provider calls. The original seal and operator are unchanged.

The approved booking and status request budgets are consumed. The PDF budget is
unused but blocked without an authoritative AWB. No further provider request may
run from this consumed approval. Any later investigation/reconciliation needs its
own explicit scope and approval; do not repeat the booking.

## Minimum next action

The owner checks their existing PDC Dashboard for the exact client reference above,
created around23:27:50 Riyadh. No authenticated PDC Dashboard session is available
to Codex, so visual presence/absence is not claimed. If found, identify its AWB and
any linked pickup, and cancel manually as intended. Do not create a replacement.
Dashboard absence alone does not settle an ambiguous provider write.

If no authoritative Dashboard record is available, ask PDC to reconcile that
original reference using both trace IDs in the private incident packet. Ask whether
an AWB/pickup was created and why both requests returned HTTP500. Codex has not
contacted PDC. Provider confirmation is needed before any new booking is considered.

The first end-to-end PDC acceptance has not passed: AWB, private label, tracking
and actual PDC Dashboard visibility remain unconfirmed. Broader development stays
held. Both historical handoffs and all existing features/artifacts are preserved.
No Git push and no repeated application tests/build occurred.
