# Private PDC labels

SHIP-06 reuses ExportPDF, saved shipment jobs, database label leases and private
VPS storage. It adds Dashboard View / Download / Print for authorized Orders staff.
The application reads the current provider configuration; it sets no customer fee,
merchant fee, label template, order/payment state or automatic-booking control.

## Identity and privacy

Only active staff with dashboard.orders can retrieve a label. Authorization and
the saved job identity/evidence are rechecked after file/PDF work. Customers and
unprivileged/revoked staff cannot use this endpoint. The request chooses an order,
never an arbitrary path, AWB, reference or customer. Job/order/provider/path/hash/
size must agree. Responses use private/no-store, attachment, sandbox, nosniff and
same-origin resource policy; private paths and credentials are never returned.

Before publication and retrieval, a bounded parser opens the actual PDF and checks
both saved AWB and reference in each page's text. Prefix/suffix substring matches,
metadata-only matches and unrelated extra pages fail. Malformed/truncated/oversized,
scripted, attached-file, form and annotated PDFs are withheld. Password-required,
image-only or unextractable-identity documents are also withheld, not guessed valid.
Limits:5MiB input,4 pages, finite page geometry, two parsers,6s timeout and bounded
worker heaps. Workers receive no runtime credentials and fetch no external resources.
Only dimensions/result return from the parser; extracted private text is discarded.

PDF.js6.4.299 uses its supported legacy build with a JS DOMMatrix shim. Node22.23.1
is qualified; package minimum is22.13. No native canvas/graphics binary is required.
Worker/parser modules and versioned browser font files are included in application
output. No new environment variable is needed; existing shippingDocumentsDir applies.
See [PDF.js API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html).

## Existing shipment only

SaveShipmentEx remains separate. An explicit label retry requires a saved AWB and
uses only ExportPDF. Label-only processing rejects a booking task or changed saved
identity before any provider request. File publication remains atomic/publish-once;
an existing orphan is independently checked before its evidence can be accepted.
Database leases and unique job identity prevent duplicate file records/shipments.

Failed initial retrieval stays label_pending and permits an explicit AWB-only PDF
retry. Missing/tampered already-ready files are withheld; View/Download/Print make
no provider call and do not clear metadata or recreate a shipment. Repair of such
private evidence needs separately reviewed recovery, not a booking retry.

## Dashboard behavior

View renders validated bytes in a compact private canvas preview. Download preserves
the original PDF bytes and server-bound filename. Print uses the browser print dialog
with only label pages, their physical paper sizes and up to300dpi rendering. UI text
supports EN/AR/RTL and existing Light/Dark/System design tokens. Closing/switching
orders aborts pending reads, discards preview buffers and restores print/focus state;
stale responses cannot open another order's label. No durable browser storage is used.

## Acceptance and scope

Local tests use disposable owned fixtures, real PDF rendering/download/printed-PDF
geometry and isolated native database/file handlers. They create no production order,
shipment, money movement or provider call. All historical migrations stay unchanged.

A genuine provider-issued PDF is not available. On the first separately approved real
AWB, qualify the selected template/font encoding, printed AWB/reference, barcode scan,
physical printer/scale and any provider-specific multi-page behavior. Preserve this
acceptance check; local fixtures do not claim real provider/printer acceptance.

Automatic booking/polling/webhook cutover remains OFF. Pickup development is excluded.
After labels, bounded tracking/timelines and offline documented callback qualification
come next. SEO follows independent PDC readiness without waiting for a real order.
Paymob awaits its reply; detailed settlement/ERP/Daftra remains LAST.
