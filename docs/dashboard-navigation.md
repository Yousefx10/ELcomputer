# Dashboard navigation

The dashboard has 12 groups and 46 submenu destinations. Existing forms,
tables and charts are reused. Both saved navigation layouts are supported.
Choose **Settings → Dashboard layout → Detailed** for the sidebar.
The compact sidebar opens one group at a time. Click your name to show Logout.
The account actions close on Escape, outside clicks, or navigation.

| Group | Destinations |
| --- | --- |
| Dashboard | Summary, order summary, stock overview, sales analysis, customer feedback |
| Orders | All orders, recent orders, confirm and pack |
| Products | All products, published, drafts, add product |
| Catalog | Categories, brands, product reviews |
| CRM | Contacts, tickets, calls and history |
| Purchases & sales | Purchase invoices, sales invoices, returns |
| Inventory | Warehouses, serialized items, scan item |
| Shipping | Shipping companies |
| People | Employees, admin users, store customers |
| Treasury | Transactions, supplier payments, customer receipts, salary payments |
| Documents | Existing file and folder browser |
| Settings | Overview and 13 editors |

Settings opens to searchable cards grouped by Store, Homepage,
Navigation & footer, and Administration. Each editor has a direct URL.
Section changes keep unsaved field values while the Settings page remains
mounted, including visits to the media library. Existing save buttons still
save their own fields. Read-only users cannot edit the general settings fields.

Navigation definitions live in `app/utils/dashboardNavigation.js`.
Settings descriptions and section mappings live in `app/utils/dashboardSettings.js`.
Existing commerce URLs remain valid after moving Inventory and Shipping into
their own groups. Permission keys, database tables and APIs are unchanged.

## Checks

- `node --test tests/dashboard-navigation.test.mjs`
- `npm run build`
- Browser checks for submenu destinations, filtering and browser Back.
- Settings search, draft preservation and section-specific save payloads.
- Sidebar search, mobile dismissal and both navigation layouts.
- Read-only fields, hidden menus and protected direct links.

Browser checks used temporary account and data fixtures. Save requests were
intercepted in the browser; no remote records were changed.

## Daftra mode

Daftra mode adds one ERP group with four destinations.

It hides local purchasing, invoicing, warehousing, treasury, and employees.

CRM, tickets, warranty work, timelines, and status remain available.

Orders, packing, returns, shipping, and serialized items also remain.

Direct links to hidden ERP pages redirect to Daftra equivalents.
