# PDC tracking audit — 2026-10-05

Scope: customer shipment tracking only. All five supplied files were read, including every worksheet and row. Vendor documents describe the protocol; their suggested live shipment/go-live checklist does not authorize external operations.

## Existing architecture

- `shipping_provider_settings` holds dashboard configuration and AES-256-GCM encrypted Access Token/Webhook Secret. `shippingSecrets.js` uses the existing server-only master key. Browser settings return presence flags only.
- `shipping_order_jobs` owns the order, unique `to_ref`, unique AWB, queue/retry state, private label path and latest provider status. References use the original order number, falling back to the order UUID. Order numbers use an ORD- prefix plus an 18-character UUID fragment, backed by order-number and shipment-reference uniqueness. Preserve these references.
- `shipping_webhook_events` already stores history. `shipping_status_mappings` already maps IDs, but only to broad order states. All shipping tables have RLS and service-role-only grants.
- Existing `/api/webhooks/pdc`, paid-order queue triggers, bounded worker, SaveShipmentEx, ExportPDF, private label downloads and generic shipping-company UI are reused. No second provider subsystem is needed.
- Account detail verifies order ownership before selecting shipment data. Order Progress has placement/current-order state only. Delivery exposes the raw latest label; history is absent. Orders cards read `customer_orders.status` through customer RLS, so their chips are order states, including manual/legacy courier transitions.
- Packing has an authoritative `packing_completed_at`; payment has `paid_at`. No general historical order-state ledger exists. Do not fabricate earlier processing stages.
- 382 existing city mappings use Address Mapping Sheet1 IDs; no live city/product synchronization, reconciliation or PDC-specific tests exist. No common shipping provider interface/health abstraction was found; extend the existing PDC utility.

## Defects to correct

- Webhook looks up AWB first and accepts arbitrary REF/AWB combinations.
- Event key includes date, contrary to vendor AWB + StatusID deduplication. Insert and side effects are separate; a failed event is acknowledged as duplicate on retry.
- Creation previously accepted the first response AWB even if its echoed REF differed. The tracking extension requires the exact original reference before saving an AWB.
- Webhook has unbounded JSON input, invalid dates fall back to receive time, and ordering checks race. Unknown references are acknowledged despite never being applied.
- Courier mappings rewrite broad order status, including cancellation and protected terminal states. Tracking should update shipment state only.
- Dashboard API URL is read-only and PATCH replaces it with a constant. Merchant/company/product defaults are duplicated in UI. Existing DB seed is historical configuration, not a new default.
- Existing live-call server safety gate remains; saving dashboard configuration must not silently disable the provider when the gate is off.

## Supplied reference anomalies

- Final Status: 33 rows, 32 distinct IDs. ID 97 appears twice: received after an attempt versus received at hub. Default to neutral/unknown until PDC clarifies; retain both aliases and raw values.
- Webhook PDF illustration IDs 2/3 (pickup requested/picked up) conflict with Final Status (branch transfer/receipt); sample ID 5 says Shipped/Out for Delivery while the sheet says Delivered. Treat illustrations as protocol examples; confirm actual account mapping with PDC before activation.
- Status spelling/case includes Recieved, Recived, shipment Delivered, Reoperate/Re-Operate, and nonbreaking spaces. Do not silently rewrite raw records.
- Reasons: 25 names, no IDs. Consingee Moved and Consignee Moved are semantic spelling duplicates. Consingee Request is another spelling variation. Reasons may arrive prefixed by a status; customer presentation only translates recognized reason suffixes.
- Address workbook: two sheets, 382 unique IDs each, identical ID sets. 140 row differences include governorate aliases/grouping, whitespace, and city 21: Sheet1 Gesr el-Suez versus Sheet2 Arabic text باب in the English column. Eight existing mappings (244-251) replace a nonbreaking governorate space with a normal space. Preserve local address aliases; API IDs/names become the live lookup cache.
- GetShipmentsStatus response table guarantees AWB/Ref/Status/Reason only, while its flow mentions StatusID. Pagination parameters/envelope and timestamp timezone are unspecified. Reconciliation must accept bounded documented arrays/envelopes, preserve name-only observations without inventing IDs/times, and reject ambiguous matches.
- Timezone-free webhook examples require an explicit dashboard timezone (default Africa/Cairo). Confirm with PDC; never depend on the server/browser timezone.

## Intended extension

One additive migration extends the existing settings, jobs, history and mappings. A service-only transactional RPC locks the referenced shipment, verifies AWB, inserts/deduplicates history and selects current state by provider event time. Unknown/older events remain readable; no courier callback changes order/payment/inventory. Private Realtime broadcasts contain only a changed signal; customer ownership and active-account RLS authorize subscription and the existing API supplies the data.

Dashboard controls retain encrypted credentials and existing operational settings, adding mode/URL/timezone, cached city/product lookup, safe connection/sync actions, mapping edits and throttled manual reconciliation. No external shipment, production migration, deployment or provider registration is authorized.

## Current database observation

A read-only check of the locally configured Supabase database confirmed the production PDC URL and supplied merchant/company-product match, 382 city mappings and 32 status mappings. PDC and auto-label creation are disabled. No database write or PDC request was made. Local migration and current database city IDs agree; the eight Sheet1 differences are whitespace only. Current provider labels/order mappings retain the older broad status design described above.

Retained creation discrepancies: existing optional `fromContactName`/`allowToOpenPackage` differ from the PDF’s `fromContactPerson`/`allowToOpenShipment`; the PDF itself varies the spelling of special instructions. These optional creation fields are outside this tracking change and require vendor validation before enabling label creation. No existing queue/retry/packing/label behavior was redesigned.
