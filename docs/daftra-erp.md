# ERP ownership and Daftra integration

The active provider is `site_settings.erp_mode`. Connection health never selects ownership.

This implementation is local and awaits review. The ERP ownership migration has not been applied to production.

## Independent states

| Concept | Values | Meaning |
| --- | --- | --- |
| Active ERP | Built-in ERP / Daftra ERP | Who owns ERP operations now |
| Daftra credentials | Not configured / Credentials saved | Whether server credentials exist |
| Daftra test | Not tested / Daftra test successful / Daftra connection failed | Test result for the current credential revision |
| Daftra activation | Inactive / Connected but not active / Active ERP provider | Whether Daftra owns operations |

Saving credentials invalidates the old test. Neither saving nor testing activates Daftra.

An outage leaves Daftra active. Local ERP writes remain blocked.

Dashboard headers always identify the active ERP. Connection results have their own label.

## Configuration and security

Use Dashboard → Settings → ERP connection for credentials. Stored secrets remain encrypted and server-only.

`CREDENTIALS_ENCRYPTION_KEY` must already contain at least 32 random characters. Never copy production secrets into reports, source, logs or examples.

Existing server-only `DAFTRA_*` environment settings remain a compatibility fallback. The optional stored client ID is not used by API-key authentication.

Account URLs require official HTTPS hosts. Requests reject redirects, have a 15-second timeout, and disable automatic HTTP retries. Remote error bodies are replaced with safe messages.

The official [authorization guide](https://docs.daftara.dev/933385m0) documents API-key authentication. Individual endpoint specifications mark that header deprecated. OAuth migration remains separate work.

## Ownership

ELcomputer always owns storefront content, selling prices, website identities, checkout, orders, messages, packing, support, shipping, analytics and admin access.

Built-in mode retains existing purchasing, sales, inventory, warehouse, treasury and employee workflows.

Daftra mode freezes local ERP mutations through database triggers and guarded RPCs. Supplier editing, purchasing, local invoicing, warehouse editing/transfers, stock/cost posting, treasury and ERP HR are hidden or blocked. Direct PostgREST calls are also guarded.

Physical QR lookup and packing remain local. External checkout assigns existing units as platform custody without updating retained ERP balances or costing.

External returns record `manual_required` requests. They do not restock units, issue refunds, or claim external accounting completed. Preorder payments remain local workflow records; external ERP allocation/release requires manual reconciliation.

## Switching

Activation requires a successful test for the saved credential revision.

**Switch only** changes ownership and retains history. It queues no historical export.

**Switch and synchronize** first creates a review. This phase supports only Daftra → ELcomputer SKU mappings and stock/cost cache refresh. The review names unsupported domains, direction, local candidate count, action and warnings. Confirmation creates one durable run and job.

Reviews expire after 30 minutes and are tied to the actor and settings version. Changed settings require a fresh review. An active worker lease prevents switching or credential changes mid-job.

**Switch back without import** restores retained built-in balances. External business changes and physical custody require reconciliation before relying on those balances. No reverse import occurs.

Mode, actor, time, previous provider, choice and run reference are recorded atomically in the existing activity log. Routine log trimming preserves mode transition records.

## Supported synchronization domains

All endpoint paths below are relative to the account's `/api2` base. Lists follow documented `page`, `limit` and `pagination.page_count`; synchronization scans every page, uses limit 100, pauses 150 ms between pages, and refuses missing, changing or over-100-page pagination.

| Domain and official endpoint | Direction | Identifiers and mapping | Pagination | Retry and idempotency | Limitation |
| --- | --- | --- | --- | --- | --- |
| [Products](https://docs.daftara.dev/15115316e0): GET `/products.json` | Daftra → ELcomputer stock/cost cache | Persisted local UUID ↔ remote product ID; otherwise one exact unique SKU | Complete paginated scan | Validate whole scan first; batches of 100; timestamped upserts; mapping conflicts stop writes | Integer units only; aggregate stock cannot create physical QR units or establish local warehouse balances |
| [Clients](https://docs.daftara.dev/15115261e0), [creation](https://docs.daftara.dev/15115262e0): GET/POST `/clients.json` | ELcomputer → Daftra for new web orders | Customer UUID link; otherwise unique exact normalized email | Complete search before POST | Shared lease and durable creation intent; uncertain POST requires reconciliation | No documented create idempotency key or email uniqueness guarantee; no historical customer migration |
| [Invoice search](https://docs.daftara.dev/15115241e0), [creation](https://docs.daftara.dev/15115242e0): GET/POST `/invoices.json`, GET `/invoices/:id.json` | ELcomputer → Daftra | Order UUID link and exact `po_number`; verify client, currency and total | Complete filtered search; single-resource read | Durable POST intent; link reuse; failed mapped reads never create replacements | No documented atomic create key; refunds/cancellations/preorders are manual |
| [Draft issuance](https://docs.daftara.dev/38758418e0): GET `/invoices/update_draft/:id/0.json` | ELcomputer → Daftra | Confirmed website-created invoice ID | Single resource | Re-read draft state on retry; no transport retries | Automatic issuance is limited to standard items; serialized orders require warehouse/serial review; account rules can reject issuance |
| [Processed stock transactions](https://docs.daftara.dev/15115361e0): GET `/stock_transactions.json` | Daftra → ELcomputer reservation evidence | Product ID, invoice `order_id`, source 2, stock-out type 2, processed status 4 | Complete per-product filtered scan | Read only; reservations clear only after verified posting and a later product-balance fetch | Permission-scoped active warehouses; missing evidence retains reservations and needs reconciliation |
| [Stores](https://docs.daftara.dev/15115366e0): GET `/stores.json` | Daftra → dashboard overview | External store ID only | Bounded dashboard page | Read only | No guessed local warehouse mapping or warehouse migration |

Missing item mappings require manual product setup in Daftra. [Product creation](https://docs.daftara.dev/15115317e0) exists, but opening stock needs inventory tracking and a valid store. This integration does not create products or seed stock automatically.

Invoices start as drafts. Website discounts use documented absolute `discount_amount`; line taxes are explicitly disabled to prevent inherited product taxes. Payment fees use a separate non-stock line. Payment posting and refund accounting are manual. A mismatched remote total prevents issuance.

## Unsupported automatic migration

API availability alone does not establish safe migration. No automatic migration is implemented for existing customers, historical sales/purchases, warehouse balances, serialized receipts, treasury, HR, refunds or reverse imports.

Official documentation includes [purchase invoices](https://docs.daftara.dev/15115351e0), [suppliers](https://docs.daftara.dev/15115266e0), [treasuries](https://docs.daftara.dev/15115371e0), [expenses](https://docs.daftara.dev/40881055e0), [staff](https://docs.daftara.dev/40961109e0), [credit notes](https://docs.daftara.dev/15115252e0) and [refund receipts](https://docs.daftara.dev/15115257e0). Account-specific mappings and accounting workflows remain unimplemented. These domains stay manual rather than using guessed fields or flows.

## Queue and stock cache

Checkout commits its local order, reservations and one deduplicated order-status job atomically. It makes no Daftra request. Failed connection tests do not suppress jobs or cancel orders.

One provider lease serializes remote creation. Jobs stop remote requests after 25 minutes; leases expire after 30 minutes. A stale lease recovers interrupted jobs. Retry delays grow from 60 seconds to one hour, with the existing attempt cap. Manual reconciliation errors stop automatic retries.

Worker requests are sequential and start at least 250 ms apart. Each claimed job reloads credentials, and every remote request verifies its lease.

An uncertain remote POST cannot be repeated blindly. Searches and stored references may reconcile the record; ambiguous results require manual inspection. A draft found without confirmed website creation is not automatically issued.

Manual retry applies only to failed jobs. Order and inventory job permissions are checked separately.

Manual stock refresh queues a job. Repeated requests reuse pending work and enforce a five-minute cooldown. Last successful refresh, current status and errors remain visible during remote outages.

`erp_inventory_cache` stores remote quantity/cost privately. `storefront_products` and `storefront_product_variants` expose the public quantity projection through base-table RLS. Availability deducts pending website reservations and caps serialized quantity by existing physical units.

Original product/variant quantities, costs, warehouse balances and inventory movements remain retained built-in history. Descriptions, images, publication and parent selling prices remain local. SEO and public AI readers use the same storefront quantity projection.

## Prepared scheduler mechanism

`POST /api/internal/erp/process` reuses the existing internal-worker authentication pattern. It requires server-only `ERP_WORKER_SECRET` of at least 32 random characters in `x-erp-worker-secret`.

The optional body is `{ "limit": 3, "inventory": true }`. Limit is capped at five jobs; inventory work is deduplicated. Built-in mode pauses processing.

No live scheduler has been installed. After review and deployment, configure an authenticated scheduler against this endpoint, such as a five-minute cadence. Keep the secret in the scheduler's secret store. Manual processing remains available before scheduling.

## Review and release limits

Apply `20261003120000_erp_ownership.sql` together with the application after approval. Applying only the frontend would reference views and RPCs missing from the old database.

Existing invoice-linked orders preserve Daftra ownership. Unlinked historical orders remain built-in; uncertain old queue entries require review.

Before activation, verify exact SKU mappings, permissions, physical registry coverage and the account's default store. New serialized receipts cannot automatically populate the local QR registry in this phase.

Local tests use isolated PostgreSQL and mocked Daftra. Browser checks use the actual Vue settings/badge components with mocked responses. No live Daftra mutations or production migrations were run.
