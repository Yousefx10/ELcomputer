# Dashboard refresh: findings and phased plan

9 November 2026. **Plan for owner review.** Phase 1 (DASH-R1) is implemented locally and
uncommitted (E364). Nothing is deployed or pushed.

The owner asked for a deep look at the Dashboard and its backend, then a plan in
phases. Work starts one phase at a time, only after the owner approves it.

## Evidence and limits

- Code: `../product-modern-20261107/source`, branch `product-modern`, commit `03c27dd`.
  This matches live release `cbeb3ce78dea6484`, schema 142.
- Live Dashboard: viewed read-only in Chrome as the owner account, in Daftra mode.
  Only page loads. Nothing was saved, sent or deleted.
- Dark mode was checked by adding the `dark` class in the open page. It was not saved.
- Phone width was checked in a 390 px same-origin frame. The window could not be resized.
- No database queries were run. Access was declined in this session. RLS facts come
  from the migrations and `supabase/bootstrap/clean-v1/schema.sql`.
- Only the owner account exists. Restricted roles were checked in code, not live.
- Permission-gap details are in the git-ignored `logs/DASHBOARD_REFRESH_PRIVATE_2026-11-09.md`.

## 1. Summary

1. The menu has 21 top-level entries and 55 destinations. Settings adds 26 more cards.
2. Many screens show things that cannot work in the live setup. Examples: "Out of stock
   644" of 644 products, "No available stock" on every product, Bank transfer switched
   on but not offered at checkout, and PayPal.
3. The same job often lives in two or three places: tickets, returns, customers,
   payment methods, parcel weight and order counts.
4. No image URL inputs remain in the code. Every image field uploads. The stored path
   printed under each image is what still looks like a URL field.
5. Pages reach data three ways: server APIs, browser writes to tables, and browser RPC
   calls. Permissions, audit and errors differ by path. Seven permission gaps were found.
6. The look is inconsistent. Pastel gradient cards, five card styles, four corner sizes,
   double page titles on six pages, and two complete navigation layouts.
7. Pages are long. The product editor is about eight screens with 17 save buttons.
   Settings is one 4,693-line file. Returns, CRM and Admin users open collapsed.
8. 34 admin endpoints send raw database messages. In Arabic, any unmapped error becomes
   "Request failed".

## 2. Findings by area

### 2.1 Menu, pages and gating

Current menu in Daftra mode, as the owner sees it. Defined in
`app/utils/dashboardNavigation.js`. Route guards are in `app/utils/adminPermissions.js`
(`getDashboardRouteRequirement`) and `app/middleware/dashboard-auth.global.js`.

| Menu, in order | Pages | Purpose | Permission | Daftra mode |
|---|---|---|---|---|
| Meta tracking | 1 | Pixel, Conversions API, consent | `settings.view`, edit `settings.edit` | Shown |
| Payments | 1 | Payment attempts, method readiness, retry rule, transfer review | `payments.view` and sub-keys | Shown |
| Dashboard | Overview, Orders overview, Stock overview, Sales reports, Customer feedback | Summaries and reports | none, `dashboard.orders`, `products.view`/`categories.view`, `dashboard.analysis` | Stock overview hidden |
| Orders | All orders, Recent orders, Confirm Orders | Order list, packing, courier booking | `dashboard.orders` | Shown |
| Products | All, Published, Drafts, Import / Export, Add product | Catalog editing | `products.view`, `products.add`, `products.edit` | Shown |
| Catalog | Categories, Brands, Product reviews | Taxonomy and reviews | `categories.view`, `brands.view`, **none** | Shown |
| CRM | Contacts, Support tickets, Activity history | Supplier and customer accounts, calls | **none** | Shown |
| Purchasing | Purchase invoices | Built-in procurement | **none** | Hidden |
| Sales | Sales invoices, Returns | Built-in invoices, returns | **none** | Renamed "Returns" |
| Inventory | Warehouses, Serialized items, Scan item | Unit registry and QR | **none** on the route, APIs need `products.view` | Warehouses hidden |
| Daftra ERP | Overview, Invoices, Stock and costs, Sync queue, Product links | Daftra data and sync | `dashboard.analysis`, `products.edit` | Daftra only |
| Shipping | Shipping companies | PDC connection, companies, delivery prices | **none** on the route, PDC API needs `settings.edit` | Shown |
| People | Employees, Admin users, Store customers | HR and accounts | `hr.view`, `users.view` | Employees hidden |
| Finance | 4 treasury views | Built-in treasury | `treasury.view` | Hidden |
| Documents | 1 | Private files, packing videos | `documents.view` | Shown |
| Pages | 1 | Custom store pages | `pages.view` | Shown |
| Help Center | 1 | Help articles | `help.view` | Shown |
| After-Sales Claims | 1 | Warranty and return claims, reverse pickup | `claims.view` and 12 sub-keys | Shown |
| Customer Support | Tickets, Live Chat | Customer tickets and chat | `support.view` | Shown |
| Email | 6 | Brevo settings, templates, sends, history, consent | `email.*` | Shown |
| SMS | 4, plus a Marketing tab | Provider, templates, sends, history | `sms.*` | Shown |
| Quick Setup | 1 | Launch checklist | owner role | Shown |
| Settings | Store settings and 6 more | Store, homepage, footer, admin settings | `settings.view`, `settings.coupons`, owner role | Shown |

Direct links to hidden built-in pages redirect to `/dashboard/erp?blocked=built_in`.
That works. In Daftra mode the ERP overview showed 2 failed sync jobs on 9 November.

Navigation problems:

- Meta tracking and Payments sit above Dashboard. They were added as one-line entries
  (`dashboardNavigation.js:64-65`) and have no Arabic labels.
- Daily work, store content and configuration share one long list. Pages, Help Center,
  Documents, Email, SMS and Quick Setup sit beside Orders.
- Store content lives inside Settings: hero banners, offers, banner ads, announcements,
  header and footer links, login page images.
- DASH-01 is still open. Settings shows a group with seven children plus a card grid.
- Two layouts exist: Classic (`standard`) and Modern (`detailed`). The page header and
  in-page tabs (`PageIntro`, `SecondaryNav`) render only in Classic. Every layout fix
  must be done twice.
- "Recent orders" repeats the date chips on the Orders page.

### 2.2 Screens that do not match the live setup

Live setup: Daftra mode, stock tracking off, card, Apple Pay and cash, PDC courier.

| Screen | What it shows | Why it is wrong | Evidence |
|---|---|---|---|
| Overview | Out of stock 644 | Counts `stock_quantity = 0` on every product, drafts included, in any mode | `server/api/admin-dashboard/summary.get.js:68` |
| Overview | Sales growth +95300.0% | No floor when last month is near zero | `SummaryOverview.vue:129-132` |
| Products list | "No available stock" on every row, stock filter | Tracking is off and Daftra owns stock | live |
| Product editor | Individually tracked stock 0, Item IDs and QR codes | Same | live |
| Product editor | "Stock and item IDs are created through Procurement" | Procurement is hidden in Daftra mode | live |
| Product editor | Preferred supplier, locked Primary warehouse | Daftra owns suppliers and warehouses | live |
| Payment methods | Bank transfer switched on | Checkout offers card and cash only. `/api/payments/capabilities` says `manualTransfer.available: false` | live |
| Payment methods | PayPal card, and a warning naming PayPal | No PayPal provider exists | `settings.vue:2586-2592` |
| Payments | Google Pay and wallets "qualification pending" | Reads like a to-do list | live |
| Order flow | "Staff confirm and book from the order page." | Booking moved to Confirm Orders in E358 | `en.json` `orderFlow.mode_reviewHelp` |
| Order flow | "Book PDC right away." | Provider name in reusable copy | `en.json` `orderFlow.mode_autoHelp` |
| CRM Contacts | "Suppliers used for procurement" | Procurement is hidden. CRM shows 0 customers; the store has 22 | live |
| Serialized items | 50 units of a test product | Tracking is off. They look like test data | live |
| Reset system | Owner reset tool | Blocked by RESET-COVERAGE-01 | handoff |
| Quick Setup | Launch checklist at 62% | The store is already live | live |
| SMS provider | Activation notes with internal text, campaign path, outbound IP | Developer data in a business screen | `sms.vue:167` |
| Meta tracking | Graph API version, test event code, test customer | Developer fields beside the main switch | live |

### 2.3 The same job in several places

| Job | Places today | Proposal |
|---|---|---|
| Tickets | Customer Support > Tickets, CRM > Support tickets | One support inbox (owner decision) |
| Returns | Returns, After-Sales Claims, Settings > After-sales policies | One "Returns and claims" area; policies stay in Settings |
| Customers | People > Store customers, CRM > Contacts > Customers | One Customers area |
| Payment methods | Settings > Payment methods, Payments page methods and transfer settings | One Settings > Payments; the Payments page shows activity only |
| Parcel weight | Order flow `parcel_weight_kg`, used by Confirm Orders. Shipping `default_weight_kg`, used by courier settings and reverse pickup | One value |
| Order counts | Overview cards, Overview chart, Orders overview, Orders page cards | One summary on Home |
| Import / Export | Menu item, plus two links on the product list | Menu item only |
| Admin users | `/dashboard/users`, `/dashboard/hr?tab=users`, a dead Settings tab rule | Settings > Team |

### 2.4 Image fields and URL inputs

- Every `<input>` and `<textarea>` in `app/pages` and `app/components` was scanned.
  No image URL input remains. Bill logo and category image were the last ones.
- All image fields use `DashboardMediaUploadField` with upload and library. This covers
  product images and gallery, categories, brands, brand pages, SEO images, light and dark
  logos, hero banners for desktop and phone, offers, banner ads, login images, footer
  logos, app badges, payment logos and the bill logo.
- What still looks like a URL field: `MediaUploadField.vue:64-66` prints the stored path,
  such as `/uploads/products/…webp`, under every image. Show the file name, size and
  dimensions instead.
- The bill logo label key is still `bill.logoUrl`. Its text already says "Logo".
- Pages and Help articles use Markdown with links only (`app/utils/markdown.js`). They
  cannot show images. Adding images there is a new feature.
- URL fields that should stay: brand page video links, link destinations, catalog import
  image columns. Provider endpoints should move to an Advanced area.
- If you still see an image URL box anywhere, tell me the screen. The code shows none.

### 2.5 Old code and controls

- Unused components: `components/dashboard/SideBar.vue`, `FileWorkspaceOverview.vue`,
  `products/addProducts.vue`, `products/editProducts.vue`.
- Redirect-only pages: `users.vue`, `products/brands.vue`, `products/categories.vue`.
- A route rule for a Settings tab `users`. It is not dead: it guards the old link's
  redirect to People > Admin users, so it stays (corrected during Phase 1).
- Permission "Legacy campaign access" (`sms.campaign.send`).
- The payment monitor panel sits on top of every page for order staff. It always says
  "Needs review" because of the 8 known unverified warnings. On a phone it fills the
  first screen.
- The header clock re-renders every second (`layouts/dashboard.vue`).
- Arabic labels are found by looking up the English text in a 200 KB table plus regex
  patterns at run time (`useUiLocale.js`). Missing entries stay English.
- Store and provider names in reusable code: `alt="ELcomputer"` in the Classic header,
  the after-sales option value `elcomputer` for "store pays shipping", and 38 UI strings
  that say "PDC" where the courier name from settings belongs.

### 2.6 Copy and errors

- 34 admin endpoints return raw database messages. 36 places in Vue show
  `error.message` as is.
- In Arabic, any message without a mapping becomes "Request failed. Please try again."
- Captions that read as generated text. Examples:
  - "Upload the main product image stored on the server host."
  - "Payment attempts are separate from customer orders."
  - "Unqualified methods remain unavailable to customers."
  - "Up to 25 products. Selection clears when the list changes."
  - "Available stock, visibility and selling mode all apply."
  - "Physical item registry. Manage ERP stock in Daftra."
  - "Email alerts are optional and currently off."
- Mixed names for one thing: "CARD" and "Card", "Daftra ERP" and "ERP connection",
  "People" and "Users", "Store settings" and "Settings".

### 2.7 Layout, density, phone, Arabic and themes

- Six pages show their own title under the top-bar title: Meta tracking, Payments, SMS,
  Email, After-Sales Claims and Quick Setup.
- Payments and Meta tracking use raw form styling. In dark mode their borders turn bright.
- Five card styles: gradient stat cards (`StatCard.vue:43-47`), white shadow panels,
  grey accordion panels, plain bordered boxes and a blue "Needs attention" block.
- Corner sizes in use: `rounded-lg` 732 times, `rounded-xl` 320, `rounded-2xl` 294,
  `rounded-md` 63.
- Returns, CRM and Admin users open with their sections collapsed. Settings opens the
  chosen section expanded (corrected on 9 November during Phase 1).
- Product editor: about 7,900 px tall on desktop, 9 sections, 17 save buttons. The main
  Save sits in the middle. SEO, gallery, specifications and presentation below it save
  separately.
- Settings > Store details is about 3,450 px tall at phone width.
- The Orders list has no work queues: to confirm, ready, with courier, problems.
- Phone at 390 px: no sideways scrolling on Orders or Settings. The header crowds the ERP
  badge, language, theme and store link, so the title shrinks to "All …".
- Arabic layout mirrors correctly. "Meta tracking" and "Payments" stay English in the menu.
- Dark mode remaps Tailwind's grey, slate and blue scales globally (`appearance.css`).
  It mostly works. Raw borders and some badges do not adapt.

### 2.8 Backend

Three data paths:

1. **Server API.** `/api/admin-*` with `requireAdminRequest` and the service role. Used by
   orders, packing, shipping, ERP, products, payments, email, SMS, support, chat,
   documents, pages, help, claims, users and marketing.
2. **Browser writes to tables under RLS.** Settings (`site_settings`, banners, offers,
   links, coupons, announcements), categories, brands in part, CRM accounts, procurement,
   sales, returns, warehouses, shipping companies, employees, treasury, product gallery
   and specifications.
3. **Browser RPC calls.** Sales charts, procurement, sales and returns creation, treasury.

What this causes:

- Settings saves have no revision check. Two people saving one section overwrite each
  other without warning (`settings.vue:3617-3700`).
- Settings validation exists only in the browser.
- Path 2 writes its activity log from the browser through `POST /api/admin-logs`.
- Permission coverage differs by path. See 2.9.

Where the Dashboard talks to each integration:

| Integration | Dashboard screens | Server code | Background job |
|---|---|---|---|
| Paymob card and Apple Pay | Payments, Payment methods, Orders | `api/payments/*`, `api/admin-payment-checkouts/*` | Payment monitor, every 5 minutes |
| Daftra | Daftra ERP, ERP connection, product links, bills | `api/admin-erp/*`, `api/admin-bills`, `utils/daftra*.js` | `storefront-erp` |
| PDC | Confirm Orders, Shipping, Order flow, claims pickup | `api/admin-shipping/*`, `api/admin-orders/packing/*`, `utils/pdc*.js`, `api/webhooks/pdc` (off) | `storefront-pdc-tracking`, hourly |
| SMS | SMS pages, courier name in Shipping | `api/admin-sms/*`, `utils/sms` | `storefront-sms`, plus instant sends |
| Meta | Meta tracking | `api/admin-marketing/*`, `api/marketing/*`, `/feeds/meta-catalog.csv` | `storefront-meta-process`, `storefront-meta-retention` |
| Brevo email | Email pages | `api/admin-email/*`, `api/webhooks/brevo` | `storefront-customer-email` |

### 2.9 Permissions

What works: named permission keys with dependencies, the `requireAdminRequest` guard,
RLS helpers `has_admin_permission` and `is_active_admin`, route middleware and ERP
ownership redirects. Quick Setup and Reset use the owner role. That is a role rule, not a
special case for one person, so it stays.

Gaps, with details in the private file:

- Product reviews have no permission key. Any staff account can delete them.
- User management has no manage key. "Users access" can grant other permissions.
- Courier companies and delivery prices can be changed by any staff account.
- CRM contacts can be read and changed by any staff account.
- Returns, warehouses and procurement can be written by any staff account.
- The activity log for browser writes is posted by the browser.
- Raw database messages reach the browser.

Only the owner account exists today, so none of this is open now. It matters as soon as
a second staff account is added.

## 3. Proposed menu and page arrangement

Rules: daily work first, one place per job, store content apart from settings, ERP mode
changes only the ERP group, and every old URL keeps working through a redirect.

| Menu | Pages | Replaces |
|---|---|---|
| Home | Overview, Reports | Overview, Orders overview, Sales reports, Customer feedback |
| Orders | Orders, Confirm Orders, Payments, Returns and claims | All and Recent orders, Confirm Orders, Payments, Returns, After-Sales Claims |
| Products | Products, Categories, Brands, Reviews, Import / Export | Products, Catalog |
| Customers | Customers, Support inbox, Activity history | Store customers, CRM, Customer Support |
| Marketing | Meta tracking, Coupons, Email and SMS consent | Meta tracking, Coupons, consent tabs |
| Store content | Homepage, Pages, Help Center, Header and footer, Page layouts, Search engines, Media library | Content parts of Settings, Pages, Help Center |
| Daftra ERP | Overview, Invoices, Stock and costs, Sync queue, Product links | Unchanged |
| Documents | Files | Unchanged |
| Settings | Store details, Payments, Shipping and delivery, Email, SMS, Bills, After-sales policies, Team, ERP connection, Activity log, Advanced | Settings, Shipping, Email and SMS setup, People, Quick Setup |

Built-in ERP mode shows "Built-in ERP" in place of Daftra ERP: Purchasing, Sales invoices,
Inventory, Finance and Employees. That is 9 top-level entries instead of 21.

Page arrangement:

- **Home:** at most four tiles (to confirm, ready to ship, problems, today's sales). Then the
  work queue, the sales chart, store activity and a small live-visitors tile (DASH-02).
- **Orders:** queue tabs with counts (To confirm, Ready, With courier, Problems, All). One
  filter row. A compact table. An order opens in a panel with its own URL.
- **Products:** status tabs instead of three menu items. The editor gets a header (title,
  status, View in store) and tabs: Details, Options and prices, Images, Specifications,
  SEO, Presentation. Each tab keeps its own save, as the safety contracts require.
  In Daftra mode, stock, supplier and warehouse show as read-only lines.
- **Settings:** opens its home directly (DASH-01). Section list on the left on desktop,
  the form on the right. Sections open expanded with their own save bar.
- **Shipping and delivery:** courier connection, companies and delivery prices, order
  flow, one parcel weight. Provider endpoints sit under Advanced.
- **Payment monitor:** a small status chip in the top bar for order staff. The full panel
  lives on Orders and Payments only.

## 4. Design direction

Keep the current identity: the Modern shell with left sidebar and top bar, the system
font, slate text, the blue brand colour from `appearance.css`, 13 px navigation, compact
tables, logical RTL classes and Light/Dark/System.

Change:

- Flat tiles: white surface, 1 px border, no gradients, colour only for status.
- One corner scale: 8 px for controls, 12 px for panels.
- One page header: the top-bar title plus page actions. No second title, no caption.
- Sections open by default. Accordions only for optional advanced parts.
- Help text only where a mistake costs money or data.
- One status badge map shared by orders, payments, courier and sync.
- Phone: the title first. ERP badge, language and theme move into the account menu.
- Dark mode uses the surface and border variables instead of remapping Tailwind scales.
- Courier, payment and ERP names come from settings, not from hard-coded copy.
- Retire the Classic layout once you confirm nobody uses it.

A small shared kit built from existing components and tokens, with no new UI library:
page actions, section with save bar, data table (table on desktop, rows on phone),
filter bar, stat tile, status badge, empty state, error state with Retry, confirm dialog.

### Owner direction, 10 November 2026: modern and very easy (DASH-UX-01)

The owner wants the Dashboard to feel modern and very easy, not just tidy. Their example:
payment methods as cards with each method's name and logo, grey when off, coloured and
marked active when clicked, in place of plain checkboxes. This is a direction with
examples, not a fixed design. It applies across the rebuild:

- Choices become clickable option cards or clear switches, not bare checkboxes and
  selects. Candidates: payment methods, order flow modes, couriers, page layouts,
  consent mode, product selling mode and publish state.
- Off is grey and quiet. On is coloured and clearly marked, with the item's real logo
  where one exists (payment logos are already uploaded for the footer).
- One tap does one thing. Saving stays explicit wherever money, customers or stock change.
- Menus and pages are rearranged (Phase 3) and the screens redesigned (Phase 4), not
  only consolidated. The identity may change where it makes the work easier.
- Kept: EN/AR, RTL, Light/Dark/System, phone width, real logos only, no invented
  content, no flashy gradients, and accessible controls (keyboard, focus, screen readers).

It must not look AI-made (owner, 10 November). Simple and creative, not the template
look every generated dashboard shares. To avoid:

- Rows of identical cards, each with a coloured icon square, a big number and a caption.
- Pastel gradients, glow, glass effects, purple-blue themes, sparkles or emoji.
- A caption under every heading, and phrases like "Manage your … with ease" or
  "at a glance". A label names the thing; a sentence appears only when it prevents a mistake.
- An icon on every row and button. Icons only where they speed recognition.
- The same layout on every page. Each screen is shaped by its job: a queue, a form,
  a table or a single switch.

To aim for: clear type hierarchy, one accent colour, the store's real data and logos,
generous but even spacing, and small details made for this store's daily work.
Every new screen is checked against this list before it is shown to the owner.

## 5. Phases

Each phase is a separate release with its own approval. The release follows section 4 of
`docs/HANDOFF_2026-11-09.md`, is tested in Daftra mode and leaves
`/api/payments/capabilities` unchanged. After each phase the roadmap,
`PROJECT_STATE.md` and `CODEX_HANDOFF.md` are updated together.

Proposed task IDs, to record in the roadmap once approved: DASH-R1 to DASH-R6.

### Phase 1 (DASH-R1): Truthful screens. App only.

Fix what exists first. Small changes, high value.

- Hide or mark options that cannot work, using existing state: ERP mode, stock tracking,
  payment capability and provider readiness. No store-specific checks.
  - Payment methods: show each method's real checkout state. Hide PayPal until a provider
    exists. Show manual methods as unavailable while manual transfer is not installed.
  - Stock off or Daftra mode: hide the out-of-stock tile, stock column and filter, tracked
    stock, item IDs and the Procurement link. Supplier and warehouse become read-only.
    The product save contract keeps its required warehouse value.
  - Overview: count out of stock only when tracking is on. Show "New" when last month
    had no sales.
- Correct copy: Order flow text, provider names, the captions in 2.6 and Arabic labels
  for the menu, Payments and Meta tracking.
- Remove double titles on six pages. Restyle Payments and Meta tracking with existing
  components.
- Replace the stored path under images with file name, size and dimensions.
- Move the payment monitor to Orders and Payments; add the top-bar chip.
- Remove dead components and the per-second clock.
- Map raw database messages to short messages at the server. Log details server-side.

Not included: changing any stored setting. The Bank transfer switch stays as stored until
you say otherwise.

- **Integrations:** none called. Reads ERP state and payment capability only.
- **Risks:** hiding a control someone uses. Missing Arabic keys. Accidentally changing the
  capabilities response, which the release check compares.
- **Tests:** navigation and mode tests (built-in and Daftra, tracking on and off, three
  roles). Component tests for each changed screen. Browser matrix EN/AR, light/dark,
  1440 and 390 px. Full suite compared with the live commit: no new failures.
- **Rollback:** point `current` at the previous release and restart.

### Phase 2 (DASH-R2): Permissions and safe saves. One migration plus app.

Status, 10 November 2026: live as release31 1674220b1764fbe3, schema 143 (E368). PDC tariff drafts
stay under Edit settings; governorate prices use the new shipping keys.


- Add permission keys for reviews, CRM, returns, courier and delivery prices, inventory
  pages and user management. Map them from today's access so nobody loses access.
- Switch those RLS policies from `is_active_admin()` to `has_admin_permission(...)`.
- User management: a manage key, grants limited to keys the actor holds, and no self-edit
  of permissions for non-owners.
- Move Settings saves to a server endpoint with a revision check, server validation and a
  server audit entry. Check the Caddy allowlist for the new route first.
- **Integrations:** none called. The delivery price table feeds checkout quotes, so the
  read path must not change.
- **Risks:** staff lockout, an RLS mistake, a broken checkout quote, the operator's ADDED
  and CHANGED function lists, the Caddy route allowlist.
- **Tests:** native PostgreSQL RLS matrix per role. HTTP 401/403 matrix. Checkout quote
  rehearsal on the live database in Daftra mode, always rolled back. Concurrent Settings
  save conflict test.
- **Rollback:** previous app release plus a prepared script that restores the old
  policies. New columns and keys are additive and stay.

### Phase 3 (DASH-R3): Menu and page arrangement. App, with small API filters.

Status, 10 November 2026: live as release32 bad6633ec37f9522 (E370). One parcel weight moved
to its own step (DASH-WEIGHT-01) because it needs a migration.


- The new menu from section 3, including DASH-01.
- Merge duplicates where the change is navigation: one Payments settings page, Returns and
  claims, Customers, Team under Settings.
- One parcel weight. Confirm Orders, automatic booking and reverse pickup read the same
  value. This may need a small migration; if so it joins Phase 2.
- Order queue tabs, using a status filter on `api/admin-orders`.
- A redirect map for every old URL. Decide on the Classic layout.
- **Integrations:** PDC reads the parcel weight. No calls.
- **Risks:** bookmarks, staff habits, permission gating per item, both ERP modes.
- **Tests:** every old URL redirects. Menu per mode and permission set. Browser matrix.
- **Rollback:** previous app release.

### Phase 4 (DASH-R4): Redesign. App only.

Status, 10 November 2026: the owner approved the first design (payment methods as option cards).
Batch 1 is live as release33 495f68f018109851 (E372). Batch 2 is live as
release34 99bc694136bc545c (E374).


- The shared kit. Gradients out. One corner and spacing scale.
- Option cards and switches in place of checkboxes and selects (DASH-UX-01), starting
  with payment methods. Each card shows real on/off and checkout state.
- Payments, Meta tracking, SMS, Email, After-Sales Claims and Quick Setup on shared parts.
- Phone header. Dark mode through variables.
- **Integrations:** none.
- **Risks:** visual regressions and scope creep. Work page by page.
- **Tests:** before and after screenshots per page (EN/AR, light/dark, 1440 and 390 px).
  Keyboard and focus checks for dialogs and menus.
- **Rollback:** previous app release.

### Phase 5 (DASH-R5): The heavy screens. App only.

Status, 11 November 2026: live as release36 292983ee33961707 (E377), with the owner's Duplicate
product button. The Settings script now sits unchanged in one composable; splitting it by area is
a possible follow-up.


- Product editor in tabs, keeping `docs/product-save-safety.md`,
  `docs/product-editor-safety.md` and `docs/media-safety.md` intact.
- Settings split into one component per section. The 4,693-line file goes away.
- Home rebuilt with DASH-02. Orders with the panel.
- **Integrations:** Daftra product links shown in the editor. No calls.
- **Risks:** product save regressions, unsaved-change guards, load time.
- **Tests:** existing editor, listing, bulk and media suites, plus new ones. Per-section
  Settings saves. Compare with the live commit.
- **Rollback:** previous app release.

### Phase 6 (DASH-R6): New features. Each approved on its own.

Candidates already on the list: the MKT-META-PURCHASE-01 setting,
PREORDER-CARD-01-REMIND, a staff viewer for historical orders, PROD-06 grid and list,
DOC-01 storage usage, images in Pages and Help, and one support inbox.

## 6. Decisions for you

1. Which phase should I start? I recommend Phase 1, then Phase 2.
2. Retire the Classic Dashboard layout? Answered 10 November: yes (DASH-R3).
3. Merge CRM tickets into one support inbox? Answered 10 November: group them under
   Customers now, merge later.
4. One "Returns and claims" area? Answered 10 November: one entry under Orders with two tabs.
5. Methods that cannot work: hide them, or show them off with a reason?
6. Bank transfer is on in Settings but not offered at checkout. Turn it off? This changes
   a production setting, so it needs your words.
7. Move Quick Setup under Settings > Advanced? Answered 10 November: yes.
8. Are Serialized items and Scan item used in Daftra mode? What about the 50 test units?
9. Do you still see an image URL box anywhere? If so, which screen?

## Appendix: main evidence

- Menu: `app/utils/dashboardNavigation.js:63-158`. Settings cards:
  `app/utils/dashboardSettings.js`.
- Route rules: `app/utils/adminPermissions.js` (`getDashboardRouteRequirement`).
- ERP redirects: `app/utils/erpState.js:29-43`.
- Layouts: `app/layouts/dashboard.vue`, `app/components/layout/dashboard/SideBar.vue`,
  `app/components/dashboard/PageIntro.vue`.
- Settings: `app/pages/dashboard/settings.vue` (payment cards 2586, open sections 2593,
  save 3617).
- Stat cards: `app/components/dashboard/StatCard.vue:43-47`.
- Overview numbers: `server/api/admin-dashboard/summary.get.js:68`,
  `app/components/dashboard/SummaryOverview.vue:129`.
- Image field: `app/components/dashboard/MediaUploadField.vue:64-66`.
- Labels: `app/composables/useUiLocale.js`, `app/utils/uiMessageKeys.json`.
- Parcel weight: `server/api/admin-orders/[id].get.js:187`,
  `server/utils/pdcOrderShipping.js:50`, `server/utils/pdcSettings.js:27`.
- Activity log from the browser: `server/api/admin-logs/index.post.js`.
