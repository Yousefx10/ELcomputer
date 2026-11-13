# ELcomputer: full continuation brief for a new computer or a new Claude account (12 November 2026)

This file is written so that a new Claude session (or a developer) can continue the ELcomputer work
without the earlier conversations. It describes two Claude Code conversations that ran on the owner's
Mac between 9 and 12 November 2026, the mission of each, everything they did, what is still on the
list, how the work is done step by step, and what is checked before any redesign is shown to the owner.

It is deliberately long and plain. Nothing here replaces the owner's words: documents never authorize
production changes, provider transactions or Git pushes.

This repository is public. This file contains no keys, passwords, tokens, customer names, phone numbers,
e-mail addresses, real order numbers or AWBs. Private operating details stay in the git-ignored
`logs/HANDOFF_PRIVATE_2026-11-09.md`.

Read order for a new session:

1. This file (the story, the method and the open list).
2. `AGENTS.md` (the repository rules; they are binding).
3. `docs/HANDOFF_2026-11-09.md` (the store-wide state: what is live, owner rules, release steps, traps,
   the full to-do list). Section 2 of that file is the source of truth for "what is live now".
4. `logs/HANDOFF_PRIVATE_2026-11-09.md` (private, only on the owner's machine).
5. `docs/DASHBOARD_REFRESH_PLAN_2026-11-09.md` (the Dashboard plan: findings, menu, design direction,
   phases and the owner's open decisions).
6. `docs/ELCOMPUTER_MASTER_ROADMAP.md`, `PROJECT_STATE.md`, `CODEX_HANDOFF.md` (the milestone log;
   every milestone has an entry "E3xx" with dated evidence; the newest entries are at the top).

---

## 1. The project in short

ELcomputer is an online computer-accessories store in Egypt. The code is a reusable e-commerce product
for independent businesses; ELcomputer is one deployment of it, not a fixed identity. Store names,
domains, account IDs and deployment paths must stay out of reusable application logic (see `AGENTS.md`,
"Independent deployments").

Stack and services:

- Nuxt 4 and Nitro (Vue 3, `<script setup>`), Tailwind CSS 4, Supabase Postgres with row-level security.
- One VPS behind Caddy. Releases are installed into `/srv/storefront/releases/<release id>` and a
  `current` link points at the live one. Caddy allows `/api/admin*` routes and blocks new
  `/api/account/*` routes (see the handoff traps).
- ERP mode: Daftra (external ERP), stock tracking off.
- Payments: Paymob card and Apple Pay (hosted), cash on delivery. A payment monitor runs on the server
  every few minutes ("natural monitor pass").
- Courier: PDC, shown to customers as "Fast Shipping".
- SMS: a Vodafone Egypt provider; e-mail: Brevo.
- Marketing: Meta Pixel and Conversions API on; Google tag not installed.
- Languages: English and Arabic (RTL). Themes: Light, Dark, System.

Live state (13 November 2026, after E392):

| Item | Value |
|---|---|
| Live app release | `907ed4a41353d537` (release52, E392); release53 `f4c6d1fcd3130d5f` built and prepared, not applied |
| Source commit | `5cd327b` live, `2f968e7` = release53 (local only, see section 2) |
| Database schema | 145 (latest migration `20261112100000_direct_order_status`, from E387) |
| Previous release for rollback | `83c9ec8a89976b6e` (release51, built-in ERP pages) |
| Docs branch | `claude/handoffs-20261108` (see `git log` for the newest docs commit) |

Always re-check this before acting: the handoff's section 2 and the newest roadmap entry may have moved on
if another session continued.

---

## 2. Where everything lives (and what must be copied to a new computer)

Everything is under `/Users/imac/Documents/ELcomputer` on the owner's Mac (about 170 GB, many
historical workspaces). Scripts use absolute paths that start with `/Users/imac/Documents/ELcomputer`.
On a new computer, the easiest path is to recreate the same folder path (same user name, or a symbolic
link), otherwise many release and test scripts must be edited.

The important folders:

| Path | What it is |
|---|---|
| `ELcomputer/` | This docs repository. Branch `claude/handoffs-20261108`. Remote: the project's public GitHub repository. The application code in this checkout is old; never build or deploy app code from here. |
| `ELcomputer/logs/` | Git-ignored. Private handoff, private Dashboard audit notes, and the release operator's shared helpers (`logs/p0-merchant-risk-retry-20261105/ops/common.mjs` and neighbours) used for SSH and database access. Must be copied by hand. |
| `product-modern-20261107/source` | **The live application code.** Branch `product-modern`. Its Git "origin" is another local folder (`../checkout-modern-20261107/source`), **not GitHub**. All commits since early November exist only on this Mac (and as built releases on the VPS). |
| `product-modern-20261107/releaseN` | One workspace per release (release30 to release49 for the Dashboard work; earlier numbers for older work). Each holds the generated scripts (`build.mjs`, `package.mjs`, `qualify.mjs`, `operator.mjs`, `remote.py`, `canonical.py`), the copied source, the artifact and the operator's packet and outputs. |
| `product-modern-20261107/release-tools` | Release generators: `make-releaseN.py` and `build-releaseN.sh`, one pair per release. |
| `product-modern-20261107/work-e363`, `work-e385`, `parity` | Worktrees used by the other session (hero, courier aliases, Daftra parity). |
| `procurement-postgrest-correction-20261018/tools/node-v22.23.1-darwin-x64/bin/node` | The Node.js used for every build, test and operator run. |
| `homepage-direct-cart-20261028/browser-tools/node_modules/playwright/index.mjs` | Playwright used by the Dashboard browser tests (Chrome channel). |
| `production-backup-tools/postgresql-17.11/bin` | Native PostgreSQL binaries for the native database tests. |
| `pdc-tracking-20261031/source/node_modules/pg/lib/index.js` | The `pg` driver used by native tests and the operator. |

Unpushed work (important):

- `product-modern` has 569 commits and no GitHub remote. If only GitHub is cloned on a new computer,
  **all live code since early November is missing.** Copy the folder.
- The docs branch is 34 commits ahead of GitHub (not pushed). Pushing needs the owner's explicit ask,
  and the repository is public.

Not portable (stay on the owner's Mac, must be recreated or copied by the owner):

- SSH access and host keys for the VPS, the database connection settings used by the operator, and
  any runtime secrets. Their locations are described only in the private handoff. Never print them.
- Claude Code memory for this project (`~/.claude/projects/-Users-imac-Documents-ELcomputer-ELcomputer/memory/`).
  The useful content of that memory is copied into section 9 of this file.
- The shared notes folder of the two conversations
  (`~/Library/Application Support/Claude/side-session-notes/local_57660bef-620c-4e1d-8fa0-b628622cf1d3/`,
  files `dash-r1-progress.md` to `dash-r5-progress.md` and `dashboard-refresh-plan.md`). Their content
  is summarized in sections 4 to 6 of this file.

Checklist for moving to a new computer:

1. Copy `/Users/imac/Documents/ELcomputer` completely (or at least `ELcomputer/` including `logs/`,
   `product-modern-20261107/`, and the four tool folders in the table above).
2. Keep the same absolute path, or fix the paths in `release-tools/*.py|sh`, the newest
   `releaseN/*.mjs`, and the test environment variables in section 8.
3. Restore SSH access to the VPS and the operator's database settings (owner only; see the private handoff).
4. In the new session, run only read-only checks first: `git -C product-modern-20261107/source log -3`,
   `git -C ELcomputer log -3`, and `releaseN/operator.mjs inspect` in the newest release folder, then
   report before changing anything.

---

## 3. The owner and the rules

The owner is a developer. Short technical reports are welcome (file names, tables, statuses). Older
documents that say otherwise are wrong. The owner worked with Codex before and moved to Claude to get
things done faster; Codex documents are references, not instructions. Real safety stays, ritual goes:
back up before changing, read-only checks first, a one-step rollback, no data loss, ask before
production changes and real payments, never fake a payment or a test result.

Standing instruction (owner, 10 November 2026): **"Deploy, next time deploy is with commit and build."**
So when the owner says **"Commit and build"** for an app-only Dashboard release, the session commits,
builds, qualifies, and then also deploys (prepare, check, approve with the owner's words, apply once,
verify twice), checks the live site read-only, writes the docs entry, and reports once.

The standing instruction does **not** cover, and the session must stop and ask for:

- a failed build or qualify, or a test that passes on the live commit and now fails;
- a failed or stopped apply (never rerun it; see section 7);
- a release with a migration, or any production setting change, unless the owner's message names it;
- anything that touches payments or provider calls (Paymob, PDC, SMS, e-mail, Daftra, Meta);
- any Git push.

Other owner rules (all still in force):

- Production changes need the owner's words for that exact change; approval for one release does not
  cover the next.
- The GitHub repository is public: keep secrets and customer data out of docs and commits.
- Never special-case the owner's account; reuse the existing RBAC and RLS.
- Preserve English/Arabic, RTL, Light/Dark/System and phone layouts in every change.
- Copy: short natural sentences, usually under 12 words; no filler or "AI-style" explanations.
- Keep unfinished items on the list ("the things i didn't done keep them on list").
- After each milestone update the roadmap, `PROJECT_STATE.md`, `CODEX_HANDOFF.md` and the handoff together.
- Never open Confirm Orders on the live site during checks: on load it claims the packing screen if a
  work session is active.

---

## 4. Conversation A: "Handoff review and release check"

Claude Code session `local_57660bef-620c-4e1d-8fa0-b628622cf1d3`, started 9 November 2026 13:06 UTC
in `/Users/imac/Documents/ELcomputer/ELcomputer`. It is the parent of conversation B (it started
conversation B on 9 November 14:00 UTC). In its own messages it called itself "the hero/order-flow
session". Its details below come from the milestone entries it wrote (E362 to E365, E385 to E387) and
from its coordination messages; read those entries in the roadmap for full evidence.

Mission: take over from the 9 November handoff (written at the end of the earlier order-flow work,
milestones E342 to E361), check the live release and Git state, and continue the store work outside
the Dashboard redesign: storefront fixes, courier and ERP flows, and owner requests that come up.

What it did, in order:

- **Handoff review and release check (9 Nov).** Read the handoff, checked the live release and Git
  state read-only, then took owner requests.
- **E362 (9 Nov, release27):** phone search fixed at the top without iOS zoom, cash mark in checkout,
  six category pictures uploaded.
- **E363 (9 Nov, release28):** hero banner back to its earlier sizes without the grey space; iPhone and
  iPad no longer zoom into a focused field.
- **Started conversation B (9 Nov 14:00 UTC)** with the task of auditing the whole Dashboard and
  proposing a phased refresh plan.
- **E365 (9–10 Nov, release29):** phones show the whole hero banner at its own shape; the hero rotates
  only while on screen. Its build reused the folder name `release29` and deleted an unreleased DASH-R1
  build from conversation B, which is why every generator now refuses to run if its folder exists.
- **E385 (11 Nov, release45 `20d55e2ba493c8e1`, schema 144):** PDC courier booking failed for about
  half of the checkout cities because checkout saves the reviewed governorate name ("Behira") while
  the PDC city table uses PDC's own names ("Al Behaira"). Fixed with a migration so courier rules use
  the reviewed aliases (`private.pdc_city_destination`), and courier refusals now show plain reasons
  instead of one generic message.
- **E386 (12 Nov, no release):** Daftra catalog linked: 118 merges by code or name, four owner-chosen
  links, 71 published products created in Daftra one at a time through the Dashboard, each linked.
  Also a manual PDC airway bill attached, Daftra payment methods set, card bills paid and e-mailed.
- **E387 (12 Nov, release46 `aa1bb58ef23d1f76`, schema 145):** the owner's "Edit orders" key on the
  Orders page: with it on, an opened order shows Confirm, Cancel order and Return, without a packing
  session. New permission `dashboard.orders.direct`, a new Returned status, an audit table and a
  guarded database function. Direct Confirm also books PDC.
- **Coordination with conversation B:** before each of its releases it sent a "hold" message
  (reserving the next release number and listing the files it would touch), and after going live it
  sent the release id, commit, schema and the exact instructions for the next release (predecessor,
  base commit, previous artifact, which scripts to copy, which schema checks to lift). Conversation B
  paused releases and edits during each hold.

Items it left open (all also in the handoff's section 7): DAFTRA-CANCEL-01 (a cancelled cash order's
Daftra invoice must be cancelled or credited by hand), four published options to decide in Daftra,
MKT-META-PURCHASE-01 (when a cash order counts as a Purchase; next task in the handoff), PDC-WEBHOOK-01,
SEC-ROTATE-01, ORDER-MODIFY-01, MKT-GOOGLE-01, MKT-META-02-PAGE, the Meta catalog checks, smaller
choices (10-minute card window, phone banners, SMS wording), PAY-WALLET-01, PREORDER-CARD-01-REMIND,
RESET-COVERAGE-01 and OWNER-DB-REVIEW-01.

---

## 5. Conversation B: "Dashboard deep audit and phased refresh plan"

Claude Code session `local_985e0dc3-90d5-4806-b985-a70770917130`, started 9 November 2026 14:00 UTC
from conversation A, working directory `/Users/imac/Documents/ELcomputer/ELcomputer`, application work
in `/Users/imac/Documents/ELcomputer/product-modern-20261107/source`.

Mission: audit the whole staff Dashboard (screens, menus, permissions, backend), propose a phased plan,
and then, phase by phase and on the owner's words, rebuild and redesign it so it is truthful, safe,
modern and very easy, without looking AI-made, while keeping English/Arabic, RTL, Light/Dark/System,
phones, accessibility and every safety contract.

### 5.1 Audit and plan (9 November)

Findings (full list in the plan file): 21 top-level menu entries and 55 destinations; screens that did
not match the live setup (for example stock tiles in Daftra mode, a Bank transfer switch that checkout
does not offer); stale copy; English in Arabic; seven permission gaps (private details in
`logs/DASHBOARD_REFRESH_PRIVATE_2026-11-09.md`); 34 endpoints returning raw database messages; two
parcel weights. The plan proposed six phases, DASH-R1 to DASH-R6, a nine-entry menu and a design
direction, and listed decisions for the owner.

### 5.2 Phases done and live

Every release below is app only (no migration) unless stated, and every one was checked live after install.

| Phase | Milestone, release, commit | What changed |
|---|---|---|
| DASH-R1 Truthful screens | E364/E366, release30 `934ea9172dbc66bd`, `cf480cd` (+ hero fix) | Screens match the live setup: payment status lines, monitor chip and panel, no stock tile or column in Daftra mode. |
| DASH-R2 Permissions and safe saves | E367/E368, release31 `1674220b1764fbe3`, `83a377d`, **migration, schema 143** | Named permission keys (reviews, crm, returns, inventory, shipping, users.manage); Settings saved through `PATCH /api/admin-settings/sections/<section>` and audited; browsers can no longer write `site_settings`; 16 policies replaced by 49. Rollback needs `release31/rollback-policies.sql`. |
| DASH-R3 Menu | E369/E370, release32 `bad6633ec37f9522`, `5e41968` | Nine-entry menu (Home, Orders, Products, Customers, Marketing, Store content, Daftra ERP or Built-in ERP, Documents, Settings); Classic layout retired; order queues; every old URL still works. |
| DASH-R4 batch 1 | E371/E372, release33 `495f68f018109851`, `fd57db4` | Shared kit: OptionCard, Switch, ChoiceCards, plain StatCard; option cards for payment methods (owner approved the look: "Looks good, continue"); phone header. |
| DASH-R4 batch 2 | E373/E374, release34 `99bc694136bc545c`, `11c99b4` | Settings loading state, remaining switches, one corner scale. |
| Border fix | E375/E376, release35 `469fdd04e5a11169`, `794a182` | Bare Tailwind borders use the theme border colour in light and dark. |
| DASH-R5 Heavy screens | E377, release36 `292983ee33961707`, `b941484` | New Home (tiles, queue, chart, activity, live visitors), order side panel, product editor in six tabs (`?tab=`), Duplicate product (owner request), Settings split into 19 section components. |
| DASH-R6 Orders area | E378, release37 `5fb5499078e75009`, `888f265` | Order panel blocks, one filter row with date choice, Returns list first, claims sub-tabs, Payments attempts first. Fixed Tailwind `dark:` to follow the chosen theme instead of the computer's setting. |
| DASH-R6 Products list | E379, release38 `bba26666165965f1`, `c587818` | Status tabs, one filter row, bulk bar only when it has work, compact rows. |
| DASH-R6 Customers | E380, release39 `78638873d63c40f8`, `b780a8a` | One list card, customer side panel (contact, orders, shopping activity, actions). |
| DASH-R6 CRM | E381, release41 `625f508e06c88b49`, `3ade67a` | Contact type tabs with counts, search and Add in one row, form on request, details side panel; calls and tickets with plain tiles. Release40 had stopped on a database timeout before staging. |
| DASH-R6 Support tickets | E382, release42 `fde349a3da8eb51e`, `6dd4217` | Status tabs with a working "Needs attention" tab, one search box, filters on request; conversation-first ticket page with Reply / Internal note; tickets API gained read-only `status=attention` and `q`. |
| DASH-R6 Live chat | E383, release43 `9ddd9768f3390daf`, `85b09e2` | Calmer inbox, availability switch, Reply / Internal note, order statuses as labels; fixed wide-screen column order (details panel was pinned to a row only). |
| DASH-R6 Catalog | E384, release44 `ae008e8a436e73a8`, `8970a8b` | Categories, Brands, Reviews: one toolbar, form on request, compact rows, rating chips, translated delete prompt. Also fixed release43's Live chat style regression (see 7.4). |
| DASH-R6 Reports | E388, release47 `1dde76e358e77635`, `f075097` | Sales reports: Today / This week / This month tiles with signed change, chart with metric tabs, hover and keyboard readout, data table, left-to-right plot in Arabic. Customer feedback: translated details, one activity grid. First release on top of conversation A's release46 (schema 145). |
| DASH-R6 Email/SMS | E389, release49 `a51c541fe9d0f883`, `748a87d` | One header row with tabs and provider status; shared token stylesheet `app/assets/css/dashboard-messaging.css`; SMS history status pills. Fixed: the SMS marketing and transactional sections never rendered (wrong component names); the owner approved showing them. Release48 had stopped before staging on a transient critical monitor pass. Also Reports polish (range select, NPS singular). |
| DASH-R6 Daftra ERP pages | E390, release50 `e1476bb8338f3917`, `a6eb7f2` | One header row with tabs, ERP settings and Refresh; global `app/assets/css/dashboard-erp.css`; Overview figures; Invoices and Stock tables (rows on phones) with Paid/Part paid/Unpaid/Draft and order links; Sync queue status tabs with counts (read-only `status` filter and counts added to `/api/admin-erp/dashboard`); Product links tabs, filter row and compact rows. Daftra calls unchanged. Checked live read-only in the owner's Chrome. |
| DASH-R6 built-in ERP pages | E391, release51 `83c9ec8a89976b6e`, `65e5a85` | Shared header row (`DashboardBuiltInErpHead`) for Purchase invoices, Sales invoices, Warehouses, Treasury and Employees; open lists, forms on request with labels; Treasury tabs; translated movement and transaction types, statuses and frequencies. Calls unchanged. Built-in mode is not active on this store, so live it still redirects to the Daftra page; checked by the local browser test. |
| DASH-R6 Documents, Pages and Help | E392, release52 `907ed4a41353d537`, `5cd327b` | Documents as a full-screen workspace (`dashboardFullBleed` page option; rail, list/grid, details pane or drawer, drop anywhere, video preview); Pages and Help tidied and translated; dark-mode `:global()` selector bug fixed in three components. Release53 `f4c6d1fcd3130d5f` (`2f968e7`, details-pane overflow fix found live) is built and prepared but waits for the owner's words. |

Owner decisions already answered (10 November): retire Classic (yes); group CRM tickets and Support
under Customers now and merge into one inbox later; one "Returns and claims" entry under Orders with
two tabs; Quick Setup under Settings > Advanced.

### 5.3 The redesign list: what remains

The page-by-page redesign (DASH-R6) follows the owner's order. Remaining, in that order:

1. **ERP pages.** Done: Daftra pages (E390) and built-in pages (E391). In Daftra mode the menu group "Daftra ERP" has: ERP overview, Invoices, Stock and
   costs, Sync queue, Product links (`/dashboard/erp?tab=...`). In built-in mode the group "Built-in
   ERP" has Purchase invoices, Sales invoices, Warehouses (`/dashboard/commerce`), All transactions,
   Supplier payments, Customer receipts, Salary payments (`/dashboard/treasury`), and Employees
   (`/dashboard/hr`). The live store is in Daftra mode, so the Daftra pages matter most; built-in pages
   must still work for other deployments. These pages touch an external provider (Daftra): redesign the
   layout only, keep every call and permission, and ask the owner before shipping anything that changes
   what is sent to Daftra.
2. **Documents, Pages and Help.** Done (E392). Documents (`/dashboard/documents`, files and packing videos),
   Store content > Pages (`/dashboard/pages`), Help Center (`/dashboard/help`).
3. **Store content sections still in Settings**: Homepage, Header and footer, Page layouts, Search
   engines, Media library. They were converted to the shared kit in DASH-R4 and split in DASH-R5, but not
   redesigned page by page.
4. **Not yet redesigned, check with the owner first:** Import / Export (`/dashboard/products/transfer`,
   governed by `docs/catalog-transfer.md` and `docs/catalog-import.md`), Serialized items and Scan item
   (owner decision 8 below), Meta tracking, Coupons, Confirm Orders (never open it live).

### 5.4 Open items and follow-ups from conversation B

- **Owner decisions still open** (plan section 6): 5) methods that cannot work: hide them or show them
  off with a reason; 6) Bank transfer is on in Settings but not offered at checkout: turn it off (a
  production setting, needs the owner's words); 8) are Serialized items and Scan item used in Daftra
  mode, and what about the 50 test units; 9) does an image URL box still appear anywhere.
- **DASH-WEIGHT-01:** two parcel weights (Order flow vs PDC default weight); waits for the owner.
- **Permission gap still open:** the `customer-users` routes let `users.view` edit and delete store
  customers. Noted, not changed.
- **Reports:** `dashboard_get_analysis_overview` hard-codes the `Africa/Cairo` time zone in reusable SQL.
- **Payment monitor:** a standing WARNING with 8 unverified-payment items and 2 orders needing staff,
  shown under Payments > Payment monitoring. These need the owner's review. A transient "Store access
  check failed" alert made one pass critical on 12 Nov 10:00 UTC.
- **Possible clean-up:** the redesigned pages use per-page scoped classes (support, catalog, live chat,
  reports) on the theme tokens. Email/SMS use one global stylesheet. A later step could move the shared
  input, button and pill classes into one global file the same way.
- **DASH-R6 features** listed in the plan (each needs its own approval): the MKT-META-PURCHASE-01
  setting, a staff viewer for historical orders, a product grid/list view, Documents storage usage,
  images in Pages and Help, and one support inbox.

---

## 6. How the work is done (the loop used for every page)

1. The owner says **"Start <page>"** (or "Continue").
2. Read the page and its components fully, and the safety documents that apply (`AGENTS.md` lists
   them: product save safety, media safety, product editor safety, product listing, bulk operations,
   catalog transfer and import).
3. Look at the live page read-only in Chrome when it helps (see 8.4 for what must never be clicked).
4. Plan the change in a few lines: keep all data loading, permissions and save/send calls; change
   layout and styling; fix real bugs found on the way; list anything that needs the owner.
5. Implement in `product-modern-20261107/source` (branch `product-modern`). New labels go into
   `i18n/locales/en.json` and `ar.json` with real Arabic.
6. Write or extend a browser test (section 8) that mounts the real component with local fixtures in
   English and Arabic, light and dark, at 390 and 1440 pixels, and checks behaviour, layout, measured
   styles and that nothing writes.
7. Run the isolated typecheck and build, then the full Dashboard test suite (section 8).
8. Look at the screenshots, fix what looks wrong, rerun.
9. Report to the owner with screenshots, what changed, what was found, what was not changed, and one
   question (usually "Commit and build?").
10. On **"Commit and build"**: commit, generate and build the release, qualify, prepare, check,
    approve with the owner's words, apply once, verify, verify again after the next monitor pass, check
    live read-only, write the docs entry and commit it, update notes and memory, suggest the next page.

---

## 7. Releases in detail

### 7.1 Folder and generator

- Each release is `product-modern-20261107/releaseN`. Check the folder does not exist first.
- Copy the newest generator pair in `release-tools/` to the new number. A generator copies the previous release's
  scripts and rewrites: the commit (`THIS` → new full commit), the predecessor release id (`PRED_OLD` →
  `PRED`), the base commit (`BASE_OLD` → `BASE_NEW`), the short `rev-parse` id, the previous artifact
  path (`/releaseN/artifact`), the internal kind names (`DASH_R6x` → next letter), and refuses to finish
  if any old target or old schema check is left. The build script runs the generator with the full
  commit from `git rev-parse <short>`, then `git archive` of that commit into `releaseN/source`, copies
  `node_modules`, then `build.mjs`, `package.mjs` and `canonical.py`.
- Release53 (`f4c6d1fcd3130d5f`, commit `2f968e7`) is built, qualified and prepared but not applied: it needs the
  owner's words (its packet's start_by is 2026-11-14 00:39:52 UTC; after that, prepare a fresh packet in a new
  folder). The next new app-only release after it: copy `make-release53.py` to `make-release54.py` (and the build
  script), `src = release53`, `dst = release54`; `THIS = '2f968e77a49e99053ebfc9a2f8df5b9c6dc14b0b'`,
  `PRED_OLD = '907ed4a41353d537'`, `BASE_OLD = '5cd327b0c51369c0a466a5b3d17541d5dfcc9f59'`; `PRED = 'f4c6d1fcd3130d5f'`,
  `BASE_NEW = '2f968e77a49e99053ebfc9a2f8df5b9c6dc14b0b'`; names `DASH_R6M` → `DASH_R6N` (leftover check adds `6m`);
  `rev-parse','2f968e7'`; previous artifact `/release52/artifact'` → `/release53/artifact'`; schema 145. This assumes
  release53 went live first; if it did not, build from release52 instead (predecessor 907ed4a41353d537).
  (release50 to release53 were made exactly this way.)
- Schema checks: the scripts check the live schema history length (`history.length`), the plan's
  `schema_before`/`schema`, the remote scope check, the install receipt and the label
  `PRESERVED_SCHEMA145`. When another session adds a migration, every one of those must be lifted to the
  new number (E388 did 143 → 145 for release47 after conversation A's release45 and release46).
- For a release with a migration, start from the latest migration operator (conversation A's
  release45/release46 scripts) and list every touched function in the operator's `ADDED`/`CHANGED`.

### 7.2 Commands (run from the release folder with the Node in section 2)

```
node qualify.mjs run first          # compiled artifact checks; must end COMPILED_RETAINED_ARTIFACT_PASS
node operator.mjs prepare           # read-only; seals the packet; prints start_by
node operator.mjs check             # read-only preflight on production
node operator.mjs approve "<owner's exact words>"
node operator.mjs apply             # single use: check, database read, stage, migrate, cutover
node operator.mjs verify            # read-only; AWAITING_NATURAL_MON right after install
node operator.mjs verify            # again after the next monitor pass: INSTALLED_NATURAL_MON_PASS
node operator.mjs inspect           # read-only: current release, stage, receipts
```

Write each output to a file in the release folder (`prepare.out`, `check.out`, `apply.out`,
`verify.out`, `verify2.out`).

### 7.3 When apply stops

`apply` is single use. **Never run it again.** Read the stop reason, run `inspect` (read-only) to confirm
production is unchanged, record the stop as a milestone entry, build the same commit into the next free
folder, and ask the owner before deploying again. This happened twice:

- release40 (CRM): the database client timed out during the read before staging; the retry was release41.
- release48 (Email/SMS): the server refused to stage with `MON_CRITICAL_STOP` because the payment
  monitor's 10:00 pass was CRITICAL ("Store access check failed"); it cleared at the next pass; the
  retry was release49. The release scripts refuse to stage while the payment monitor is CRITICAL, so
  check Dashboard > Orders > Payments > Payment monitoring (read-only) before applying.

### 7.4 Docs after each release

Add an entry `# E3xx — ...` at the top of the milestone list in `PROJECT_STATE.md`, `CODEX_HANDOFF.md`
and `docs/ELCOMPUTER_MASTER_ROADMAP.md` (same text in all three), update the "latest milestone" sentence
at the top of those files, and in `docs/HANDOFF_2026-11-09.md` update the live-release table, the source
commit row, the milestone table and the DASH-REFRESH-01 paragraph. Check `git log` first: another
session may have added the next E number. Use counts only; never real order numbers, AWBs or names.
Commit with the attribution line. Do not push.

### 7.5 Coordination with another session

If another session announces a hold (it reserves a release number and lists files), do not build or
deploy and do not edit those files until it reports the new live release id. Then verify its claims
locally (branch head, the release artifact's `new_release_id`, the next folder is free) and use its
release as the predecessor.

---

## 8. Testing in detail

### 8.1 Isolated build

The source checkout may hold uncommitted work, so typecheck and build run on a copy:

```
S=<scratch folder>; B=$S/r6build; N=<node>
rm -rf $B && mkdir -p $B/source
cd product-modern-20261107/source
{ git ls-files; git ls-files --others --exclude-standard; } | sort -u | while read f; do [ -f "$f" ] && echo "$f"; done > $B/files.txt
rsync -a --files-from=$B/files.txt ./ $B/source/ && cp -cR node_modules $B/source/node_modules && : > $B/empty.env
cd $B/source && for mode in typecheck build; do env -i HOME=$HOME PATH=$(dirname $N):/usr/bin:/bin \
  NUXT_PUBLIC_SUPABASE_URL=https://fixture.example.invalid NUXT_PUBLIC_SUPABASE_KEY=fixture-anonymous \
  NUXT_PUBLIC_SITE_URL=https://merchant.example.invalid NUXT_TELEMETRY_DISABLED=1 \
  $N node_modules/nuxt/bin/nuxt.mjs $mode --dotenv $B/empty.env > $B/$mode.log 2>&1; echo "$mode=$?"; done
```

Success: `typecheck=0`, `build=0`, no `error TS` lines.

### 8.2 Browser tests

Environment for the Dashboard browser tests:

```
COD_REVIEW_PLAYWRIGHT=/Users/imac/Documents/ELcomputer/homepage-direct-cart-20261028/browser-tools/node_modules/playwright/index.mjs
DASH_R1_CSS_DIR=$B/source/.output/public/_nuxt      # compiled Tailwind and global CSS from the isolated build
DASH_R5_SHOTS=<scratch>/r6shots                       # keep screenshots
```

Pattern (see `tests/dashboard-*-browser.test.mjs`): esbuild bundles a small helper that sets the Nuxt
auto-imports as globals (`ref`, `computed`, `useI18n`, `useUiLocale`, `useAdminAccess`,
`useSupabaseClient` or `useSupportClient` stubs, `$fetch`), compiles each `.vue` with
`@vue/compiler-sfc` (`compileScript` with `inlineTemplate`), sets `__scopeId` so scoped CSS matches,
mounts the real component with fixtures, and serves it on 127.0.0.1. Each test runs EN/AR × light/dark ×
390/1440 and asserts: rows and controls, interactions, translated text, reading order in Arabic, no
sideways scroll, measured styles (for example `getComputedStyle(button).borderTopWidth === '1px'`),
no external requests, no writes (no POST/PATCH/DELETE unless the test means it), no page errors and,
since E389, no "Failed to resolve component" warnings.

Current Dashboard tests (all passing at E392): erp 44, builtin-erp 43, content 26, catalog 25, crm 13, customers 9, home 14, kit 9,
live-chat 9, menu 9, messaging 19, option-cards 9, order-panel 14, product-editor 17, products 11,
reports 17, returns 10, settings 11, support 17, truthful-browser 17, truthful-screens 6, theme 4,
permissions 7, navigation 8. API tests used: dashboard-erp-api 1, support-tickets-api 1, help-support-database 9,
live-chat-* tests.

### 8.3 Known failures that are not regressions

These fail the same way on the live commit; success means no test that passed now fails:
dashboard-access, dashboard-reads, product-bulk case 4, catalog-transfer case 10 (the "actual PostgREST"
cases), product-save-database case 3, storefront-footer, storefront-payments (checkout cases),
sms-api (2 subtests), ui-localization (1, dynamic keys in untouched files), daftra-erp-database (cases 5
and 8: "Unrecognized tables found" and the outage checkout, checked against 748a87d at E390).
Run native PostgreSQL tests one file at a time: a second run's `pkill -f email-audit-pg` kills the first
run's database (seen at E390 as a false daftra-costs-create failure).

### 8.4 Live checks (read-only)

Use Chrome with the owner's session (the Claude in Chrome extension must be signed in to the same Claude
account as the app; the built-in browser has no Dashboard sign-in). Open pages and read DOM and computed
styles; do not click save,
send, delete, claim or anything that writes. Known traps:

- Never open Confirm Orders live (it claims the packing screen).
- On a wide screen Live chat opens the first conversation and records a read marker. Check it in a
  420 px same-origin frame instead (create an `iframe` on another Dashboard page with
  `src=/dashboard/live-chat`); resizing the Chrome window may not take effect.
- Measure real styles (borders, padding) of new controls; presence of elements is not enough (E383's
  style regression passed a presence check).
- The Dashboard animates colour changes (0.2 s): after toggling the dark class, wait before reading
  colours, or the old colour is reported.
- Payment monitor: read it under Payments; "View alerts" is a disclosure, safe to open.

---

## 9. Design checklist (what is checked before showing a design)

From the owner's direction (10 November) and the plan:

- Modern and very easy, not only tidy. Option cards and clear switches instead of bare checkboxes and
  selects where a choice matters (payment methods, order flow, couriers, layouts, consent). Off is grey
  and quiet; on is coloured and marked; real logos only.
- Must not look AI-made: no rows of identical icon-square stat cards, no pastel gradients, glow, glass,
  purple-blue themes, sparkles or emoji; no caption under every heading; no "Manage your … with ease" or
  "at a glance"; icons only where they speed recognition; each screen shaped by its job (queue, form,
  table, single switch).
- Keep the identity: Modern shell, left sidebar, top bar (the top bar shows the page title, so pages do
  not repeat it), system font, slate text, the blue brand colour, compact tables, one accent colour.
- One page header row: tabs or filters plus actions; one filter row; rare filters behind "Filters";
  "Reset" only when something is set; forms open on request; lists stay open; details in side panels.
- Flat surfaces: white surface, 1 px border, 12 px panel corners, 8 px control corners, colour only for
  status. Status pills: green good, amber attention, red bad, grey neutral.
- Copy: short natural labels; a sentence only where a mistake costs money or data; never invent
  product descriptions, specifications or business facts; no deployment names in reusable copy.
- Saving stays explicit wherever money, customers or stock change; one tap does one thing.
- English and Arabic: every new label in both locale files; check `$uiLabel` mappings (the folded
  lookup can return a lowercase key such as `statuses.urgent`; use explicit `$t` keys instead); isolate
  customer text with `<bdi>` or `dir="auto"`; numbers, signs and dates readable in Arabic
  (`Intl.NumberFormat`, `Intl.DurationFormat`, `<bdi dir="ltr">` for signed values); no hard-coded
  English in scripts (captions, units, "yesterday", "to", confirm prompts).
- RTL: use logical classes (`ms-`, `me-`, `ps-`, `start-`, `end-`); time charts read left to right
  (`dir="ltr"` on the plot) so dates follow the line; side panels open at the inline end.
- Light, Dark and System: colours from the theme tokens (`--surface`, `--surface-muted`, `--border`,
  `--text-primary`, `--text-secondary`, `--brand`, `--danger`, `--success`) or Tailwind utilities that
  `appearance.css` remaps; Tailwind `dark:` follows `html.dark` (custom variant in `main.css`).
- Phone: 390 px without sideways scroll; long names truncate; row actions move to their own line;
  panels become full screen; tabs scroll horizontally.
- Accessibility: keyboard and focus visible, `aria-pressed` on toggle tabs, `role="group"` with labels,
  focus moves into opened panels, Escape closes them, live regions for loading and errors.
- Truthful: failed requests are shown as errors with Retry, not as empty lists; counts come from the
  server; nothing claims a capability the store does not have.

Lessons that became checks (all learned the hard way):

- Scoped component styles in `@layer components` lose to Tailwind's base reset when Nuxt inlines the
  page style before `main.css`. Either declare `@layer properties, theme, base, components, utilities;`
  first in the scoped style, or put shared classes in a global stylesheet imported after Tailwind
  (as `dashboard-messaging.css` does). Unlayered scoped classes override responsive utilities such as
  `xl:hidden`, which is why the components layer is used.
- Scoped styles do not reach inside child components; shared classes used by children must be global.
- Grid items pinned only to a row (`xl:row-start-1`) are placed first and can jump to column 1;
  pin the column too (`xl:col-start-3`).
- A `<select :value>` shows its first option until the client hydrates; use `v-model`.
- Nuxt registers `app/components/dashboard/X.vue` as `DashboardX`; a short tag name renders nothing.
  The browser tests now fail on unresolved components; an app-wide scan at E389 found no others.
- Live checks must measure styles and must not trigger writes (read markers, packing claims).

---

## 10. Memory that lived only on the owner's Mac (copied here)

- Work style: the owner prefers Claude's own lighter approach; Codex documents are references only;
  plain approvals ("yes, go") are enough; keep backups, read-only checks and rollback.
- The owner is a developer; technical detail is welcome; keep reports short.
- Dashboard design direction: modern, very easy, never AI-looking (section 9).
- "Commit and build" also deploys for app-only Dashboard releases, with the limits in section 3.
- Apple Pay: hosted Apple Pay is public; if Apple Pay fails, ask what Paymob answered and whether the
  Apple Developer enrollment is done before hunting for code bugs.
- Modern checkout and Modern product page are live; checkout style switch in Dashboard > Settings.
- Release history and "next predecessor" notes per milestone are in the roadmap entries E342 to E389.
- Monitor baseline: WARNING with 8 unverified payment items is the known state since 8 November; treat a
  change in that count as new.

---

## 11. Prompt for the first message in the new session

Paste this as the first message (adjust the path if the folder moved):

> I'm continuing the ELcomputer project from another computer/Claude account. The docs repo is
> `/Users/imac/Documents/ELcomputer/ELcomputer` and the live app code is
> `/Users/imac/Documents/ELcomputer/product-modern-20261107/source` (branch `product-modern`).
> First read `docs/CONTINUATION_2026-11-12.md`, then `AGENTS.md`, `docs/HANDOFF_2026-11-09.md`,
> `logs/HANDOFF_PRIVATE_2026-11-09.md` and `docs/DASHBOARD_REFRESH_PLAN_2026-11-09.md`.
> Then check read-only: the Git state of both repos, the newest release folder and its `inspect`
> output, and whether the paths and tools in section 2 of the continuation file exist on this machine.
> Tell me what you found, what is live, and what is next on the Dashboard redesign list.
> Do not change production, commit or push until I say so. My standing rule still applies:
> when I say "Commit and build" for an app-only Dashboard release, it also deploys, with the limits
> in section 3 of the continuation file.
