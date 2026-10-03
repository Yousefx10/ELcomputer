# ERP audit — 2026-10-03

This audit was recorded before implementation. No production changes are authorized.

## Previous architecture and conflicts

- `site_settings.erp_mode` stores the provider, but navigation and middleware also require a successful connection. A failed test reopens local ERP screens.
- Settings display a generic connection badge above the mode choice. The credential summary and stored test result can disagree. A test records success even when its response says otherwise; saving credentials leaves old test timestamps.
- Procurement, sales, warehouse, treasury and employee screens call Supabase directly. Their existing RPCs/RLS check staff access, not ERP ownership. Product APIs can update local inventory; serialized return APIs can restock in external mode.
- Checkout calls the existing atomic local order transaction, then immediately starts a Daftra worker. The database queue depends on connection health, so outages can omit new jobs. No Daftra scheduler exists. The PDC worker provides a reusable authenticated worker-endpoint pattern.
- Queue claiming has no stale lease recovery, provider mode check or per-order serialization. Manual retry can reset a processing/completed job. Entity searches inspect only page one. An invoice read failure is swallowed. Ambiguous remote creation has no reconciliation gate.
- Product export seeds opening stock without a warehouse. Inventory import updates serialized projections directly, which their guards reject. Missing numeric fields become zero; duplicate SKU mappings are silently selected. Local reads can hit PostgREST response caps.
- Invoice export sends an absolute website discount as a percentage. Product taxes can be inherited implicitly. Cancellation/refund, preorder payment fees and warehouse/serial mapping are incomplete.
- Mode switching is one update and an activity entry, without explicit review/confirmation, atomic transition audit or migration runs. Activity history trims to 50 entries per actor.

## Ownership matrix

| Area | Classification | Built-in | Daftra active |
| --- | --- | --- | --- |
| Storefront, CMS/help, images, descriptions, category/brand, SEO, publication | A: platform always | Local | Local |
| Selling price | A | Existing parent-product policy | Same policy; no remote overwrite |
| Website identities, checkout, orders/messages | A | Local order committed first | Local order committed first; asynchronous export |
| Packing/scans/videos, support/Live Chat, shipping/PDC | A | Local | Local |
| Admin access/permissions, analytics, documents | A | Local | Local |
| Suppliers, procurement/purchase invoices | B/C | Local ERP | Daftra; local writes blocked |
| Manual sales/invoices | B/C | Local ERP | Daftra; local writes blocked |
| Warehouses, inventory balances/cost/movements, transfers | B/C | Local ERP | Daftra; retained local ledger frozen |
| Serialized ERP receipts/transfers/returns | B/C | Local ERP | Manual external actions until mapped API workflows are implemented |
| Physical item lookup and packing assignment | A/D | Existing item registry | Platform custody only; no local ERP stock posting |
| Treasury, receipts, supplier/salary payments, employees/HR | B/C | Local ERP | Daftra; local writes blocked |
| CRM website contacts/activities/warranty requests | A/D | Local | Local; supplier edits blocked |
| Customer return requests | D | Existing local return posting | Record request; manual Daftra financial/inventory completion |
| Preorders/payments | D | Existing allocation/release | Local request/payment ledger; ERP export/release requires manual reconciliation |

## Documentation review

Reviewed the official [authorization guide](https://docs.daftara.dev/933385m0), [client listing](https://docs.daftara.dev/15115261e0), [client creation](https://docs.daftara.dev/15115262e0), [product listing](https://docs.daftara.dev/15115316e0), [product creation](https://docs.daftara.dev/15115317e0), [invoice listing](https://docs.daftara.dev/15115241e0), [invoice creation](https://docs.daftara.dev/15115242e0), [draft changes](https://docs.daftara.dev/38758418e0), and [warehouse listing](https://docs.daftara.dev/15115366e0), including their published OpenAPI specifications.

Existing `/api2/clients.json`, `/products.json`, `/invoices.json`, `/invoices/:id.json`, `/invoices/update_draft/:id/0.json` and `/stores.json` are documented. No endpoint above is marked deprecated. Individual endpoint specifications mark the API-key header deprecated, while the authorization guide still documents it; retain encrypted API-key compatibility and report OAuth migration separately. The stored optional client ID currently has no effect on API-key requests.

Opening stock requires inventory tracking and an active `store_id`; do not seed it during website order export. Invoice `discount` is a percentage; `discount_amount` is the absolute amount. Draft flags require numeric/boolean normalization. Tax, warehouse and serial rules must be explicit before issuance.

## Planned supported domains

| Domain / endpoint | Direction | Mapping | Pagination | Retry / idempotency | Limitation |
| --- | --- | --- | --- | --- | --- |
| GET `/products.json` | Daftra → ELcomputer inventory cache and SKU mappings | Existing entity link, otherwise one unique exact SKU | `page`, bounded `limit`, `pagination.page_count`; incomplete scans fail | Shared leased job; upsert cache by local UUID; reject conflicts | Aggregate stock does not supply the physical QR registry; never invent units or warehouse balances |
| GET/POST `/clients.json` | ELcomputer → Daftra for new website orders | Customer UUID link; unique exact normalized email | Scan all search pages before create | Serialize worker; ambiguous create requires reconciliation before another POST | No documented atomic idempotency key or email uniqueness guarantee |
| GET `/products.json` for invoice items | Existing Daftra → local mapping | Variant UUID or product UUID; exact unique SKU | Scan all matches | Persist links; missing/ambiguous item requires manual setup | Automatic item creation/opening-stock migration excluded |
| GET/POST `/invoices.json`, GET `/invoices/:id.json` | ELcomputer → Daftra new website order | Order UUID link; exact website `po_number` | Scan all filtered pages | Persist create intent; ambiguous POST pauses for reconciliation; reread mapped invoice before issue | No documented atomic create key; fees/preorders/cancellation/refund remain manual |
| GET `/invoices/update_draft/:id/0.json` | ELcomputer → Daftra, confirmed order issuance | Existing invoice ID; verify current remote draft state | Single resource | Disable HTTP automatic retries; fresh read on job retry | Closed periods, refunds and account permissions can prohibit issuance |
| GET `/stores.json` | Daftra → overview only | External store ID; no guessed local warehouse equivalence | Dashboard uses bounded page/limit | Read only | Permission-scoped results; warehouse creation/migration excluded |

The switching review supports only SKU mapping and stock/cost cache refresh. Historical sales, purchases, treasury, HR, warehouse balances, serialized receipts and reverse import are manual. API availability alone does not establish safe accounting migration.

## Documentation follow-up during implementation

The official [processed stock transaction endpoint](https://docs.daftara.dev/15115361e0) confirms `order_id`, product ID, invoice source 2, stock-out type 2 and processed status 4. It excludes pending transactions and is warehouse-permission scoped. Reservation release now requires that evidence before a later product-balance fetch. An issued flag or timestamp alone is insufficient.

Reviewed the published specifications for purchase invoices, suppliers, treasuries, expenses, staff, credit notes and refund receipts. Documented API paths exist; the repository lacks validated accounting mappings and safe migration workflows for them. They remain excluded from automatic migration.
