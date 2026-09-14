# Daftra ERP integration

The website remains the ecommerce source of truth.

Every checkout saves locally before any Daftra request.

Daftra failures never cancel a successful website order.

## Configuration

Set one server-only encryption key:

```dotenv
CREDENTIALS_ENCRYPTION_KEY=
```

Use at least 32 random characters.

Open **Dashboard → Settings → ERP connection**.

Enter the account URL, API key, and optional client ID.

Secrets are encrypted before database storage.

They are never returned to the browser.

The older `DAFTRA_*` environment variables remain a fallback.

## Activation

Test the connection before selecting Daftra ERP.

The built-in ERP remains the default mode.

Activation does not export historical orders.

## Website to Daftra

New orders create or match these records:

- Client, matched by exact email.
- Product, matched by exact SKU.
- Invoice, matched by website order number.

Unconfirmed orders create draft invoices.

Processing orders issue their Daftra invoices.

Payments are not created without a verified transaction reference.

## Daftra to website

The dashboard reads these Daftra records:

- Clients.
- Products and stock balances.
- Sales invoices.
- Warehouses.

Manual stock refresh updates local quantity and cost only.

Website names, descriptions, images, and selling prices remain local.

## Reliability

Each order status creates one deduplicated sync job.

Failed jobs use delayed retries and remain visible.

Existing entity links prevent duplicate Daftra records.

Use the sync queue for manual retries.

## Dashboard ownership

These modules stay visible:

- Ecommerce orders and packing.
- Products and storefront content.
- CRM clients and tickets.
- Calls, history, and timelines.
- Warranty claims and statuses.
- Returns, shipping, and serialized items.
- Admin users and documents.

These local ERP modules hide in Daftra mode:

- Procurement and suppliers.
- Local sales invoices.
- Warehouse editing and transfers.
- Treasury entries and payments.
- Salary payments and employee records.
- Local stock overview.
