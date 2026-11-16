# Dashboard redesign plan, part 2 (DASH-R7) — 15 November 2026

The owner asked for a complete redesign of the Dashboard: look, UX, logic and missing features.
This plan checks what the first plan ([DASHBOARD_REFRESH_PLAN_2026-11-09.md](DASHBOARD_REFRESH_PLAN_2026-11-09.md))
delivered, lists what is left, and proposes the next releases. Each release needs the owner's OK.

Live now: release70 `7577f4da61249bbe`, commit `e9454cd`, schema 154 (E409 and E410 were Daftra fixes). DASH-R7A (Payments and alerts, option A) is live as E408;
"Check with Paymob" waits for a legacy Paymob API key on the server.

## 1. What is done (live)

| Area | Release |
|---|---|
| Truthful screens, permissions, safe Settings saves | DASH-R1, R2 (E364–E368) |
| Menu by job (Home, Orders, Products, Customers, Marketing, Store content, ERP, Documents, Settings); Classic layout retired | DASH-R3 (E370) |
| Shared kit: option cards, switches, panels, one corner scale | DASH-R4 (E372–E376) |
| Home, order panel, product editor tabs, Duplicate, Settings split | DASH-R5 (E377) |
| Orders, Products list, Customers, CRM, Support, Live chat, Catalog, Reports, Email/SMS | DASH-R6 (E378–E389) |
| Daftra and built-in ERP pages, Documents, Pages, Help, Store content sections, Coupons | DASH-R6 (E390–E395) |
| Import / Export, Meta tracking, Serialized items and Scan item | DASH-R6 (E400–E402) |
| Confirm Orders rebuilt (one screen, Check per item, Finish books PDC) | E358 |
| Reports status filter and rings, Home month ring, 24-hour feedback | E405 |
| Menu redesign (group opens its first page), Settings menu on every Settings page, seamless page changes, Quick Setup rebuilt | E406, E407 |

## 2. What is not done

### 2.1 Screens still in the old style (large shadow cards, 24 px titles, captions)

- **Settings pages:** Store details (long, uneven two-column grid, white logo shows white on white), Payment methods,
  Order flow, Bill design, After-sales policies, Shipping and delivery, Live Chat settings, Team (admin users),
  ERP connection, Activity log, Reset system.
- **Payments page and Payment monitoring** (see section 4).
- **Product editor** (`products/edit/[id]`) and **Add product**: about 7,900 px tall, many save buttons.
- **Returns and claims** (Returns tab and the after-sales Center, Detail and Communication settings).
- **CRM Calls and tickets** tab and **Scan item** details.
- **Dashboard login** page.

### 2.2 Logic and UX problems found

| ID | Problem | Effect |
|---|---|---|
| DASH-PAYMON-01 | The payment monitor shows 8 warnings (6 terminal, 1 overdue, 1 checkout) that never clear | A real payment problem looks the same as old noise |
| DASH-CUST-DEL-01 | Deleting a customer with orders or wallet entries shows a raw database error | Confusing error, no guidance |
| DASH-DIRECT-SERIAL-01 | Edit orders Confirm skips item scanning, so serialized units are not linked to the order | Warranty lookup by label misses those orders (only when serialized items are used) |
| DASH-LOGO-01 | Store details previews a white logo on white | The logo looks missing |
| DASH-ERRORS-01 | Some admin endpoints still return raw database text; Arabic falls back to "Request failed" | Unclear errors |
| DASH-DARK-01 | Dark mode remaps Tailwind grey, slate and blue scales globally | Odd contrast on old screens |
| RESET-COVERAGE-01 | System reset refuses new tables it does not know (test `quick-setup-progress` fails the same way live) | Reset blocked |

### 2.3 Missing features

| ID | Feature |
|---|---|
| DASH-ALERTS-01 | One alerts center in the top bar: payments, courier problems, Daftra sync failures, new tickets |
| DASH-SEARCH-01 | Global search in the top bar: orders, customers, products |
| DASH-CUSTOMER-01 | One customer page: orders, wallet, tickets, chats, notes |
| DASH-TIMELINE-01 | Order timeline: status changes, SMS and emails sent, courier events, staff actions |
| DASH-CARTS-01 | Abandoned carts list (the rate exists; the list does not) |
| DASH-EXPORT-01 | Orders export (CSV) with the same filters as the list |
| PREORDER-CARD-01-REMIND | Reminders to pay the rest of a pre-order deposit |
| PROD-06 | Products grid or list view |
| DOC-01 | Documents storage usage |
| DASH-CONTENT-IMG-01 | Images in Pages and Help articles |
| DASH-INBOX-01 | One support inbox (CRM tickets merged with support tickets) |

## 3. Releases (proposed order)

Each release is app only unless it says otherwise. Each keeps EN/AR, RTL, light/dark/system and phone width.

1. **DASH-R7A Payments and alerts.** Payment monitoring rebuilt as a work list with actions (section 4), the
   alerts center (DASH-ALERTS-01). One migration for "reviewed" records.
2. **DASH-R7B Settings pages.** The eleven Settings pages in 2.1 on the kit: one column per job, save row,
   no captions; Store details split into Store, Logo and colors, Stock; logo previews on a checkered background.
3. **DASH-R7C Product editor.** One page with a sticky section list, one save row, Add product on the same
   layout; Scan item and Serialized details on the kit.
4. **DASH-R7D Orders follow-ups.** Order timeline (DASH-TIMELINE-01), Returns and claims on the kit, orders export,
   friendly refusal for customer delete (DASH-CUST-DEL-01), optional scan of serialized items in Edit orders.
5. **DASH-R7E Customers.** One customer page (DASH-CUSTOMER-01), one support inbox (DASH-INBOX-01), abandoned carts.
6. **DASH-R7F Search and polish.** Global search, products grid/list, Documents storage, images in Pages and Help,
   login page, plain error messages (DASH-ERRORS-01), dark-mode cleanup (DASH-DARK-01).

## 4. Payment monitoring: ideas

**Today.** A chip on every page says "Needs review 8" and links to Orders. The panel on Orders and Payments
lists codes such as "Terminal payment unverified" with no amount, customer, age or action. Nothing can be marked
as reviewed, so the count never falls. Payments also mixes the attempts table, three stat cards, the methods list
and the retry switch on one page.

**Proposal.**
- **Place:** Orders > Payments keeps one page with three tabs: *Needs attention*, *All payments*, *Methods and rules*
  (methods list, retry switch, link to Payment methods settings).
- **Needs attention:** one row per case in plain words, for example "Card payment started, Paymob never confirmed",
  with amount, method, customer, order link and age. Actions:
  - *Check with Paymob* — the existing read-only inquiry; it settles the case when Paymob answers.
  - *Mark reviewed* — with a short reason (customer left, test, duplicate); recorded with the staff name; the case
    leaves the count. Reopens if new evidence arrives.
  - *Open order*.
- **Severity:** Critical only when money may be taken without an order, or an order may be paid twice. A checkout the
  customer left becomes "Abandoned" after 24 hours, not a warning.
- **Top bar:** the chip becomes part of the alerts center (DASH-ALERTS-01) and shows only open cases; nothing shows
  when all is clear.
- **All payments:** the attempts table with filters (method, state, date) and search by order number.
- **Health line:** "Last check 2 min ago" as small text on the page, not a headline.

**Owner choices.**
- A) The proposal above (one migration for reviewed records).
- B) Lighter: keep the page, add plain words, amounts, ages and *Mark reviewed*; no alerts center yet.

## 5. Checks done on 15 November

**Edit orders Confirm compared with Confirm Orders (packing).**
- Same: the order becomes Ready to deliver with the packed time; the same database triggers run (Daftra export on
  every status change; customer SMS rules are placed, paid, processing and cancelled, so neither path sends an SMS
  at Ready to deliver); PDC is booked through the same staff booking code, so the courier SMS and label follow the
  same way; the bill PDF and its one-time email come from the Daftra sync, which both paths start (Confirm Orders
  shows the bill in the courier panel, Edit orders in its Bill panel, which can also email it again).
- Different on purpose: no item scanning, no packing video and no optional customer message; the parcel weight
  comes from Order flow instead of the packer's entry.
- Gap: serialized units are not marked sold or linked to the order (DASH-DIRECT-SERIAL-01).

**Daftra's own PDF bill (DAFTRA-PDF-01).** Read-only recheck on the server, one existing invoice:
- `invoice_pdf_url` (`/invoices/view/{id}.pdf?hash=`) redirects to Daftra's client portal page, with or without the
  API key.
- `/api2/invoices/{id}.pdf` redirects to an error page; `/api2/invoices/{id}/pdf` is 404.
- `/v2/api/entity/invoice/{id}/pdf` returns JSON: invoice data plus Daftra's layout as HTML templates, not a file.
- Conclusion: Daftra does not hand its PDF to the API, so the website cannot attach Daftra's file. Options: keep the
  website's bill (now); or render Daftra's own layout HTML into a PDF on the server (needs a headless browser on the
  VPS); or send customers to Daftra's client portal (needs a Daftra login).
- Evidence (no secrets, no invoice content): `daftra-pdf-recheck-20261115/` outside the repo.
