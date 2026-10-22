# Original WordPress PDC contract — 2026-10-23

**Original integration FOUND. Historical successful shipping evidence YES.**
The first controlled Nuxt shipment does not require webhook activation.
The [acceptance plan](provider-controlled-acceptance.md) separates actual blockers
from questions needed only for later automation.

## Original sources and historical proof

The custom integration is an active, global **Code Snippets entry34**, named
`ElComputer PDC Courier — Test`. Its header identifies the production WooCommerce
integration. It is stored in `wp_snippets.code`, rather than a separate PDC plugin.
No semantic version is declared. Its exact source SHA256 is
`06da3aa4ba6e9d0f79bfde93b7aa1561b444a9a56765239c83a0f2b3dcc18409`.
Authenticated current/archive SQL evidence and the original WPvivid database
contain identical source. The related account template is
`plugins/elcomputer-my-account/templates/my-account.php`.

Static inspection covered the actual PHP functions, settings, order metadata,
shipping-zone evidence and available label-path inventory. No PHP, WordPress,
plugin, SQL dump, cron, email/SMS or historical transaction was executed.
The private historical website was not activated or contacted.

**CONFIRMED BY HISTORICAL RECORDS:** the primary `wp_postmeta` projection contains
131 AWBs,131 references and702 normalized events.112 orders have a generated
`ELC-<order>-<timestamp>` reference, matching created-event AWB and matching polling
updates.115 orders have matching polling evidence. HPOS mirror rows are excluded
from these counts. Event sources are120 `created`,520 `sync`,42 `live sync` and20
`historical import`; counts of events are not counts of bookings.

This establishes preserved successful booking/tracking history beyond implemented
code. It is not an independently retained provider HTTP transcript or proof of
today's account entitlement. Original raw booking/status responses and label PDFs
were not found in the retained selected evidence. Imported references alone were
not counted as proof of plugin-created shipments. Customer and shipment identifiers
remain private.

**DOCUMENTED BY PDC:** both original PDFs and their duplicate copies were verified:
Courier Integration Test V4,10 pages, SHA256
`8f2f5ae3047fb72ef8aebe495a2f48e1501b27b4c2df951c40cf6638e05fb186`;
Webhook Integration,6 pages, SHA256
`9386ff876642717be5514856c8b46056afdd444a0a0ac4995b539e76cd9d5c0d`.
All pages were reconciled. Their test examples do not establish every production
response detail. Saved Product40 and current production GetProducts acceptance
remain closed, accepted milestones.

## PHP, PDF and Nuxt comparison

| Operation | Original PHP / PDF evidence | Nuxt and controlled-test disposition |
| --- | --- | --- |
| Authentication | `elc_pdc_api_request`: AccessToken/CompanyID, JSON, configurable base URL, default POST. PDF p2 specifies the two headers. | Existing encrypted settings and mode-pinned HTTPS transport retained. No cookies. Redirect refusal and bounded bodies are stronger than PHP. |
| Booking | `elc_pdc_create_shipment`; POST SaveShipmentEx, one shipment, allMustValid true, hasAWBs false. PDF pp2–5 agrees. | Same documented method/envelope. Saved allMustValid is true. Omit AWB and let PDC generate it. Never send example serial/session/user/client values or blanket extraParams overrides. |
| Pickup | PHP sends fromCityID/fromAddress/fromPhone/**fromContactPerson**. PDF p3 agrees. | Local correction replaces fromContactName with fromContactPerson. Pickup data must be current owner-approved data, not copied hardcoded fallback values. |
| Recipient | Shipping name/address with billing fallbacks, billing phone, saved/re-resolved city. | Saved authorized order fields and exact city mapping used. No arbitrary browser courier ID or silent destination inference. |
| Service versus type | PHP product_id comes from settings; normal shipmentTypeID is1. PDF pp3–4 lists type1 General,3 Reverse,5 Exchange. | Product40 is High Value(elc); type1 is General shipment. These are distinct. Reverse and exchange remain outside this acceptance. |
| Parcel and contents | PHP hardcodes1kg/one piece and sends contents. PDF p3 defines physical weight, pieces and contents. | Existing settings weight and item quantity sum retained. First test is explicitly one item/one parcel with measured weight confirmed against the saved value. Local correction sends contents instead of placing it in specialInstuctions. Multi-item parcel overrides are later product work. |
| COD and declared value | PHP uses COD order total for cash, zero for prepaid, and incorrectly equates declaredValue to COD. PDF defines these separately. | COD remains the server ledger balance, zero for the first paid-card shipment. Local correction declares saved net merchandise value: subtotal minus discount, excluding shipping/payment fees. Owner must approve this exact value; no legacy prepaid-zero assumption is copied. |
| Optional inspection/instructions | PDF consistently names allowToOpenShipment. Its table spells specialInstructions; its example spells specialInstuctions. PHP normal booking omits both. | Local correction uses allowToOpenShipment. No invented delivery instructions or ambiguous spelling is sent. This is sufficient for the first test without a support question. |
| References and duplicates | PHP generates a new timestamped reference per invocation and only checks for a saved AWB. Deferred sends can retry before an AWB exists. | Preserve stronger Nuxt barrier: deterministic ORD-<order UUID>, persisted job and unique dispatch record before POST, locked claims/tokens/account binding. Never copy PHP retry behavior. |
| Success/errors | PHP accepts first successResponses entry, array or flat AWB, without exact reference verification. PDF p5 specifies generalResponse, successResponses, badResponses and echoed ref. | Keep stricter batch/one-row success, exact ref, one valid AWB. Rejections are classified; normal booking conservatively remains uncertain rather than reusing the reference. Ambiguous results never rebook. No permissive legacy aliases are added without authentic response evidence. |
| Labels | No ExportPDF implementation or stored PDF was found in the original integration. PDF pp5–6 specifies POST, templateID1 and awBs array. | Existing ExportPDF is correct. Only the persisted AWB is requested. Private VPS directories/files, bounded PDF signature, hash/size and authenticated downloads remain. Standard template1 is documented; it is not a support blocker. Physical label acceptance is still required. |
| Cities and prices | PHP embeds382 supplied CityIDs; resolver repairs invalid/Other destinations. Prices belong to WooCommerce zones, not PDC city lists. | Current382 aliases and unique pickup mapping remain. Caches are empty. One separately authorized GetCities and bounded cache preparation are needed; reuse accepted products without another GetProducts call. Owner supplies actual coverage/prices. City existence never proves service coverage or rates. |
| Polling | `elc_pdc_sync_one_order`, `elc_pdc_sync_open_shipments` and missing-order recovery POST date/AWB/reference filters. PDF pp6–9 documents POST, awBs/reFs strings, AWB/Ref/Status/Reason and a1–2 minute indexing delay. | Existing Refresh/recovery uses exact original REF/AWB. Single-shipment manual polling can operate while webhook stays403. No broad history scan, automatic rebooking or invented status fields is needed. |
| Status spelling/pagination | PHP tries several wrappers/cases, substitutes timestamps and broadly maps order states. Stored normalized events do not prove the original raw wrapper. PDF calls results paginated but gives no pagination protocol; date/type details are incomplete. | Keep bounded known envelopes and partial-result rejection. Missing IDs/dates may remain absent; unknown labels remain neutral. Stop if no unique exact match or unsupported format appears. Full pagination/timezone/status automation is a later gate, not a reason to delay one bounded observation. |
| Webhook | `elc_pdc_webhook`: dedicated X-Webhook-Secret, legacy WP route, AWB-first/fallback reference matching and WooCommerce status changes. Webhook PDF requires HTTPS POST, secret, exact REF and AWB+StatusID idempotency. | Current exact REF+AWB, timing-safe secret, bounded body/deadline, atomic shipping-only persistence and ordering are stronger. Public ingress stays403. Full mapping/retries/registration acceptance is later. Do not copy legacy order-state or financial side effects. |
| Recovery | PHP retains missing AWBs but can resubmit deferred bookings with a new reference before an acknowledgement. | Keep durable uncertainty and original-REF reconciliation. Known AWBs permit PDF retrieval only. Missing/ambiguous recovery is a stop condition, never evidence that booking did not occur. |

The normal-shipment correction is local, tested and prepared for separate release
authorization. Existing Dashboard booking, PDF download and Refresh are sufficient
for the one-item paid-order test after normal stock, delivery, packing and access
prerequisites. No new shipping architecture or schema is required.

Reverse payloads in historical SQL also contain older optional field spellings.
Reverse is disabled and excluded from the first test; its separate contract
correction is not added to this release. Historical migrations stay unchanged.

## Support questions that remain

No unanswered optional-field, template or webhook question currently blocks the
documented first shipment contract. Owner confirmation of actual carrier charges,
coverage and parcel details is still essential. Ask PDC if account/city access
fails, an actual response cannot be safely matched, or original-REF recovery is
ambiguous. Capture sanitized evidence first; do not guess a fix or repeat booking.

Before automated/public tracking, confirm pagination, actual status mapping
(including97), timezone/DST, repeated-status semantics, webhook retry schedule and
destination registration. The PDF specifies retry triggers and acknowledgement
requirements, but does not specify retry timing/retention.

Private custody: parent `pdc-paymob-acceptance-readiness-20261023/` contains source
provenance/crosschecks, a redacted static PHP copy and sanitized historical counts.
Original source/settings remain in authenticated encrypted recovery evidence.
