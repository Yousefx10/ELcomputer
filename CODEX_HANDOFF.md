# PDC dormant deployment attempt — blocked, 2026-10-05

- Authorized candidate: `96f8bc316326db059cb68bfc951fc235607f10b9`, the reviewed 33-file implementation, clean before validation. No application feature or mapping guess was added.
- Node 22.23.3: 323 full-suite passes/one existing optional skip, 42 focused PDC passes; typecheck/build/diff check passed. Required `deploy:check` stopped because `.deploy.env` is missing. No saved deployment configuration or local SSH identity/configuration was found; the SSH agent has no identities. Restore approved configuration/access before rerunning the guarded release.
- Read-only linked database: 57 previous migrations align; only `20261005120000_pdc_customer_tracking.sql` is pending. Reviewed SHA-256: `6a84752937b1d6e9da1410fdd1d609e2ca8c2312dd2acde310a9f9574552c94f`. No migration was applied while application release was blocked.
- Current read-only PDC configuration: intended URL/company/product match, provider and auto-labels off, credentials unconfigured, 382 city mappings/32 statuses, zero jobs/events. No configuration write, upload, PM2 restart, PDC call/shipment, webhook registration or secret sharing occurred. Runtime live-call state and actual production version/logs were not inspected without SSH.
- This attempt did not deploy PDC tracking. Production authenticated UI/provider/Broadcast acceptance remains pending. Existing documented backups were not reverified; no new backup or rollback was needed. See the 16-point deployment attempt in `docs/pdc-tracking-report.md` and evidence in `/tmp/elcomputer-pdc-deploy-20261005/`.
- Deployment remains authorized by the user; external activation remains forbidden. Stop at this access/preflight blocker, preserve configuration and ambiguities, and do not start another feature.

# PDC customer shipment tracking — local only, 2026-10-05

- Existing PDC settings, 382 city aliases, 32 status mappings, jobs, creation/labels and webhook history were audited and reused. All five supplied files/all sheets were read. Read-only configured database checks match the supplied production URL/company/product; PDC and auto-labels remain disabled.
- Repaired the existing `/api/webhooks/pdc`: secret-first bounded JSON handling, REF + saved AWB association, atomic history/current-state persistence, AWB + StatusID idempotency, safe retry/rollback and out-of-order handling. Unknown events remain neutral/private. Courier callbacks no longer change broad order/payment/fulfillment state.
- Dashboard keeps encrypted credentials and operational configuration, adding explicit mode/URL/timezone, read-only city/product sync and status mapping/alias editing. Existing order PDC card gains private raw history and throttled GetShipmentsStatus reconciliation. Creation requires an exact echoed reference before saving an AWB; existing worker/label/packing behavior remains.
- My Account combines actual placement/payment/packing and courier history, with separate order/payment/shipment state, translated exception reasons, private owner-authorized Realtime refresh and local manual refresh. No new tracking page/subsystem or other feature.
- UNAPPLIED migration: `supabase/migrations/20261005120000_pdc_customer_tracking.sql`. No production migration/deployment, real PDC call/shipment or external webhook registration. Planned URL: `https://new.elcomputer.net/api/webhooks/pdc`.
- Validation on Node 22.23.3: 323 full-suite passes/1 existing optional native skip, 42 focused PDC passes, typecheck/build/diff check; 15 local built-server HTTP checks; final public output scan 113 files/1 configured private-value type/zero matches. Existing timeout-only test mock needs the documented optional keep-alive preload on Node 22; payment code is unchanged.
- Browser: 491 assertions/44 screenshots, actual Vue account/settings components under isolated fixtures; EN/AR, RTL, desktop/mobile, Light/Dark/System, no-shipment/delivery/exception/unknown/snapshot/duplicate/out-of-order states, associated dashboard labels, masked secrets and sync/mapping actions. No browser errors or external calls. Actual authenticated production/provider/Broadcast and native concurrent PDC sessions remain unverified.
- Review `docs/pdc-tracking-audit.md`, `docs/pdc-shipping.md`, `docs/pdc-tracking-report.md` and the draft `docs/pdc-status-mapping-review.csv`. ID 97 has duplicate meanings, PDF example IDs conflict with the sheet, and provider timezone/response/pagination/repeated-status identity require confirmation before activation. Preserve legacy aliases/history. STOP before release or PDC registration; do not begin Returns/Warranty/SMS/ETA/Pickup.

# Paymob foundation — dormant production deployment, 2026-10-04

- Authorized dormant release completed at `https://new.elcomputer.net`; deployed clean commit `15dac85fa1ed7a5fb7a1797d4321583f5be42798` (reviewed foundation plus security fixes). All 691 output files/symlinks match the guarded build. This supersedes the historical local-only deployment status below; merchant activation remains blocked.
- Applied only `20261004120000_paymob_foundation.sql` through linked Supabase migrations; all 57 local/remote versions match. Reviewed additive RLS/grants/constraints/guards are included. Both private ledgers are empty; existing commerce and payment-setting fingerprints are unchanged before migration, after migration and after public verification.
- Paymob remains disabled: no enablement override or credentials in PM2/running configuration/server dotenv; deployed defaults are off/TEST with empty credentials, and live mode is hard-blocked. Cash remains enabled. Bank Transfer/InstaPay/PayPal remain disabled. The saved Card flag remains true as before, but gateway capabilities return Card unavailable and express methods empty; customer availability is Cash only.
- Required checks passed: 287/287 tests (including disposable native PostgreSQL checks), typecheck, build, diff check and deployment preflight. Existing guarded build/upload/backup/scoped restart/internal/public health workflow succeeded; only `new-elcomputer` restarted (32 → 33), and its error log is unchanged.
- Production checks passed: 129 HTTP assertions across 27 requests; 334 browser assertions across 46 screens, EN/AR × 1440/390px × Light/Dark. Homepage/product, real cart persistence, checkout/account/order/dashboard login protection, result page and Live Chat launcher/open/close were checked. No browser errors, active Pixel, provider requests or commerce writes were detected.
- Public secret scans: 115 deployed public files against three private runtime value types, HTML/SSR/API checks, and 1,640 browser network response scans against the locally configured private value: zero matches. No Paymob credentials were configured or exposed.
- Routes verified: webhook POST returns safe, no-store `503` while disabled; invalid/malformed requests leave ledgers/orders/inventory unchanged. EN/AR `/checkout/payment-result` returns 200. Capabilities returns 200 with Card unavailable; anonymous initiation/status return 401. No valid transaction/callback was sent.
- NOT VERIFIED: signed-in production Cash order creation, account/order interiors, dashboard operations, chat messaging, real Pixel/3DS/provider callback delivery or merchant acceptance. No production customer/staff session was supplied; isolated regressions and login guards do not establish authenticated acceptance.
- No new production errors. Known warnings: Supabase Docker catalog-cache warning (migration parity/schema/data checks passed), existing build warnings, and one startup health connection retry followed by success. Backup: `/home/newelcomputer/htdocs/new.elcomputer.net/.output-deploy-backup-20261004-191649-41436`; entry/server hashes match the previous release. Rollback was not required; retain the additive ledger migration if reverting application output.
- PAYMOB CODE DEPLOYED: YES; PAYMOB DATABASE MIGRATION APPLIED: YES; PAYMOB ENABLED FOR CUSTOMERS: NO; PAYMOB CREDENTIALS CONFIGURED: NO; PAYMOB DASHBOARD CHANGED: NO; REAL PAYMOB TRANSACTION TESTED: NO; LIVE PAYMOB ENABLED: NO.
- Remaining merchant acceptance and evidence paths are in `docs/paymob-report.md`. Old WooCommerce callbacks remain untouched. STOP: no merchant activation, credentials, dashboard changes, live-gate changes or additional functionality in this task.

# Paymob security review — historical local review, 2026-10-04

- Verdict: SAFE TO PROCEED TO STAGING REVIEW; production release/activation remains blocked. See the review section in `docs/paymob-report.md` for findings, severity, evidence and acceptance limits.
- Fixed normalized Card gate bypass, webhook buffering before size checks, historical Card edit/refund regression, query-only result-page stale state and SDK timeout retry cleanup. No new payment feature or provider activation.
- The unapplied migration still isolates TEST successes from commerce payment/fulfillment. Actual full TEST commerce acceptance requires a later staging-only policy restricted to an isolated database; no production override was added.
- Validation: 287 full-suite tests and 41 focused Paymob tests passed, including opt-in native PostgreSQL races using independent sessions/observed lock barriers; typecheck/build/diff check passed. Browser: 373 assertions with mocked Pixel, including changed-query/stale-response behavior; local HTTP: 16 checks. Public bundle/HTML/payload/API scans found no private-secret exposure.
- Native tests create/destroy their own disposable local cluster; no database URL is accepted. No production migration, deployment, settings/dashboard change or real Paymob API/payment occurred. REAL PAYMOB TRANSACTION TESTED: NO; LIVE PAYMOB ENABLED: NO; PRODUCTION DEPLOYED: NO.

# Paymob foundation — local only, 2026-10-04

- First foundation phase implemented; no external Paymob transaction, live processing, production migration/deployment or merchant dashboard change. Default gateway off; live initiation is hard-blocked.
- Read `docs/paymob-audit.md`, `docs/paymob.md` and the 20-point `docs/paymob-report.md`. Existing customer auth, transactional checkout/cart UUID/stock/serialized guarantees, settings fee trigger, manual workflows and locale/theme shell are reused.
- Modern server Intention API/provider boundary, private attempts/transactions, exact documented HMAC, ownership/amount/currency/integration/mode checks, replay protection, bounded status refresh, pinned secure Pixel mount and separate result page are implemented. Test success cannot mark a commerce order paid or fulfill it. Dormant live settlement is tested only in isolated fixtures.
- Raw merchant card fields, local card validation and fictitious saved-card previews are removed. `/checkout` entry moves to `checkout/index.vue` for independent payment/result/summary sibling routing. Manual proof upload remains incomplete; Apple Pay/Google Pay/wallets are configurable registry entries but unavailable.
- Unapplied additive migration: `supabase/migrations/20261004120000_paymob_foundation.sql`; private RLS/service-role RPCs, unpaid/test card fulfillment guards and reset-list awareness. No historical order rewrite or production secrets change.
- Public settings read-only observation: Cash and Card flags are enabled, but existing Card is not a processor; Bank Transfer/InstaPay/PayPal disabled and transfer instructions empty. New Card also requires valid explicit gateway config.
- Validation: 272 repository tests, 26 Paymob tests, typecheck/build/diff check passed. Automated local Chrome: 370 assertions, EN/AR × 1440/390px × Light/Dark plus System change, mocked Pixel only, no Paymob network/payment. Final local HTTP: 16 route checks; public bundle secret scan: 115 files, one configured private secret type, zero matches. Real provider/3DS/callback delivery, wallet capability and authenticated production commerce acceptance remain NOT VERIFIED.
- Future webhook: `https://new.elcomputer.net/api/payments/paymob/webhook`; customer redirect: `https://new.elcomputer.net/checkout/payment-result` (Arabic intentions use `/ar`). Merchant must update old WooCommerce URLs manually after later review/deployment and staging acceptance. STOP after this phase.

# Brand landing pages — deployed, 2026-10-03

- Dedicated `/brand/{English slug}` and `/ar/brand/{same slug}` SSR pages preserve the storefront shell and existing product cards. Optional hero/mobile hero, wallpaper/color, safe Markdown story and stable one-/two-media rows extend the existing brands editor and Media Library.
- Bounded public `brands.brand_page` JSONB saves atomically under existing add/edit permissions; existing slugs stay fixed. Controlled video URLs/embeds, optional provider posters, lazy non-hero assets and published-only paginated products are included.
- Homepage Shop by Brand uses landing URLs. Legacy brand-only search filters are noindex with landing canonicals; sitemap/llms discovery and existing brand Markdown endpoints share the new identity. Category/commerce/ERP/chat infrastructure is unchanged.
- 246 tests, typecheck, build and diff check pass. Migration `20261003160000_brand_landing_pages.sql` is applied; all 56 versions match. Guarded deployment passed with one scoped restart; all 680 output files match, and error logs did not grow. See `docs/brand-pages.md`, `docs/brand-pages-audit.md` and `docs/brand-pages-report.md`.
- Final public production acceptance passed 655 assertions over 72 screens at all nine widths in EN/AR and Light/Dark. All 26 brand APIs, 182 sitemap URLs (52 brand landing URLs), canonical/hreflang/AI/private-route guards, real brand-card/cart persistence and checkout protection passed. Existing database fingerprints/counts and slugs are unchanged.
- Complete/partial pages passed 935 fixture assertions; the actual editor + authenticated API save/reload and 16 dashboard screens use isolated fixtures. No real brand content is fabricated; staff production save and third-party playback are not claimed.

# Navigation and Arabic categories — deployed, 2026-10-03

The existing storefront header, department popover and mobile search row are preserved. Orders remain visible with 44px icon targets; theme/language controls are compact. NPS has readable phone/tablet grids, unchanged 0–10 data and submission logic, and readable dark-mode contrast.

- `categories.name_ar` is optional and staff-authored. The shared helper falls back to English. The editor provides both names and a localized SEO preview; existing slugs remain fixed on edits. URLs remain `/search?category=<English slug>` and `/ar/search?category=<same slug>`.
- Additive migration `20261003140000_category_arabic_name.sql` is applied; all 55 migration versions match. Existing category/product hashes and business counts are unchanged. No production translations or feedback records were fabricated.
- 240 tests, typecheck, build, diff check and guarded deployment passed. See `docs/navigation-localization-audit.md` and `docs/navigation-localization-report.md` for files, scope, browser evidence and release identity.
- Production acceptance passed 1,027 browser assertions across 108 screens at all nine requested widths, EN/AR and Light/Dark, with no detected errors or page overflow. Final bundle hashes, PM2 health, unchanged database fingerprints, SEO/AI discovery, cart persistence and checkout protection passed. Translated/long labels and editor saves are verified with isolated component fixtures; a live authenticated staff save, signed-in customer account acceptance and a valid live NPS record creation are not claimed.

# Codex handoff — ERP ownership cleanup, 2026-10-03

Local implementation only. The user explicitly required stopping before deployment. No production migration or deployment was performed.

- Audit: `docs/erp-ownership-audit.md`. Final 22-point report: `docs/erp-ownership-report.md`. API capability matrix and operating rules: `docs/daftra-erp.md`.
- ERP mode, saved credentials, revision-specific connection test and activation are separate. Dashboard headers name the active provider. Saving/testing never changes ownership; outages never reopen built-in ERP.
- Database and API guards protect local ERP mutations. Platform checkout, orders, packing, chat, shipping/PDC and product content remain available. External returns and serialized accounting require manual Daftra completion.
- Checkout queues durable work without remote requests. Leases, bounded retries and durable POST intents protect remote creation. Stock imports update private caches and mappings, preserving built-in quantities/costs/history. Stock transaction evidence controls reservation release.
- Unapplied migration: `supabase/migrations/20261003120000_erp_ownership.sql`. Release the application and migration together only after user review. No live ERP scheduler is installed; the authenticated internal worker endpoint is prepared.
- Validation: 234 tests passed; typecheck, build and diff check passed. Actual settings/badge components passed mocked Chrome checks in English/Arabic, mobile and dark mode. PostgreSQL tests used isolated PGlite, including populated migration preservation; live PostgREST schema-cache and Daftra account behavior still need staging review.
- Local evidence: `/tmp/elcomputer-erp-audit/`. Do not treat these local changes as deployed.

# Codex handoff — AI-readiness HTTP follow-up, 2026-10-01

**Status: DEPLOYED / PRODUCTION ACCEPTANCE PASSED.** Scope is only Link headers, Accept negotiation and Content Signals; guarded deployment is authorized after fresh gates. No migration, Nginx/firewall/external Cloudflare, private-data, commerce or protocol change is needed. See `docs/ai-readiness.md` and evidence under `/tmp/elcomputer-ai-followup/`.

- Existing `usePageSeo` relationships feed `server/plugins/aiDiscovery.js` after successful HTML SSR. Publication/noindex and locale decisions are shared with the head. Existing Link values are preserved; no extra HTML canonical is advertised.
- `server/middleware/aiNegotiation.js` uses pure route/Accept helpers and `servePublicAiResource`. Explicit and negotiated Markdown have the same readers, projections, guards, pricing/availability, escaping and canonical data. GET/HEAD only; normal browser/wildcard Accept stays HTML. Candidate routes vary on Accept; product Markdown no-store, stable Markdown max-age=60. Extra query names are rejected using own-property and raw URL query-name validation; H3 sanitization cannot silently discard disallowed names. Private/asset/API routes are outside negotiation.
- Robots adds documented Content-signal directives using existing AI search/training settings. Wildcard search=yes preserves normal search; ai-input/training follow runtime policy, and specific AI search is scoped. Existing Google-Extended/training behavior and all private Disallows/sitemap remain. No content-use extension, scanner special case or external configuration is added.
- Fresh final application gates passed: **204/204 tests**, including **30 focused AI/SEO tests**; Nuxt typecheck/build and git diff --check passed. The current production build passed **97 fixture HTTP requests / 16 exact negotiated-explicit matches**, **56 real-catalog HTTP requests / 11 exact matches**, and **32 SSR pages / 142 localized sitemap URLs / 426 alternates**. Policy opt-outs, GET/HEAD, strict raw query-name rejection, generic failure responses, private/draft/noindex exclusions and HTML/Markdown cache separation were verified. Public-output scan: **108 files / one configured server-secret type / zero matches**. Guarded deployment preflight and release passed. Existing initial-release evidence below is historical. Finish only this follow-up and stop; no MCP/OAuth/agentic-commerce expansion.

- Application SHA `78cde2845f6c559e2ad26311f5bf561986ec3988` is deployed to `https://new.elcomputer.net` through the guarded workflow. Backup: `/home/newelcomputer/htdocs/new.elcomputer.net/.output-deploy-backup-20261001-154522-22111`. Only PM2 `new-elcomputer` was restarted, once; expected site cwd, `.output/server/index.mjs` and port 3001 are verified. Four deployed bundle hashes equal the local release output. No migration or external configuration change was made.
- Fresh production acceptance passed **56 actual-catalog HTTP requests / 11 exact negotiated-explicit matches**, **32 SSR pages / 142 localized sitemap URLs / 426 alternates**, and **16 EN/AR Light/Dark desktop/mobile home/product screens**. Link/Content-Type/Vary/cache/Content Signals, product prices/review counts, private exclusions and SEO canonical/hreflang/schema passed. Normal browsing receives HTML. Live Chat status/open-close and anonymous checkout/dashboard protections passed. There were zero browser exceptions, console errors/warnings, hydration warnings or horizontal overflow, and zero new server error lines. The guarded build public-output scan passed again: **108 files / one configured server-secret type / zero matches**. Read-only before/after business counts and catalog/CMS/settings fingerprints are unchanged.
- Production has no published Help articles or preorder/Coming Soon examples; those branches remain fixture-verified. External Cloudflare enforcement and third-party scanner re-scan are not claimed. The three targeted scanner failures should now be resolved by the verified public responses; actual scanner adoption/scoring remains external. No authenticated customer transaction, support/chat-message or media submission was performed. This focused follow-up is complete; STOP and do not begin another feature.

---

# Codex handoff — initial public AI readiness, 2026-10-01

Historical initial release. The follow-up entry above supersedes its omitted negotiation/Content Signals and prior stop instruction.

**Current AI status: DEPLOYED / PRODUCTION ACCEPTANCE PASSED.** Application SHA `2e5d8f9e362f7ffcd49dcd490607ab5a6a9e3185` was released through the guarded deployment script to `https://new.elcomputer.net`, PM2 `new-elcomputer`, fixed site cwd/entry and port 3001. Backup: `/home/newelcomputer/htdocs/new.elcomputer.net/.output-deploy-backup-20261001-105644-19040`. This task is explicitly authorized through production deployment and acceptance. No migration is needed. Read `docs/ai-readiness.md` and the top section of `PROJECT_STATE.md`.

- Reuse native SEO/discovery/canonical/locale utilities. New pure `app/utils/aiReadiness.js`, public anon renderer `server/utils/publicAi.js`, and thin `/llms.txt`, `/ai/[...resource]`, `/ar/ai/[...resource]` GET routes. Existing usePageSeo adds only Markdown alternate/describedby links; AI is reserved from future CMS paths.
- Store/product/category/brand/CMS/help Markdown uses explicit public projections, current publication guards and fixed canonical links. No private paths, IDs, costs, credentials, review identities/bodies or storage URLs are serialized. Preorders and review aggregates reuse existing public APIs via global Nitro fetch without visitor headers/context. Products are no-store; stable bodies/discovery use 60 seconds. Errors are generic, no-store and fail closed.
- Separate runtime crawler preferences default to allow search/assistants and training. No dashboard policy settings or DB columns were added. Google-Extended is independent of Googlebot; its grounding/training scope and user-fetch limitations are documented. Cloudflare/Content Signals are documentation only, with no external configuration claim.
- Fresh final gates: 200 tests (12 AI, 14 SEO), typecheck/build, diff check and preflight passed; public secret scan 108 files / one secret type / zero matches. Actual fixture HTTP: 27 routes plus policy/failure/HTML checks. Actual configured-catalog preview: 44 Markdown/discovery HTTP resources and 32 SSR pages / exact 142 localized sitemap URLs. Final actual-catalog Markdown and production evidence belongs in `/tmp/elcomputer-ai/`, not historical SEO release artifacts.
- All 53 migrations match remotely. Read-only before-release fingerprints preserve 91 products, 91 variants, 8 orders, 12 order items, 3 profiles. No new production records/settings/uploads are necessary. Existing staff Chrome authentication can verify dashboard rendering without another sign-in request.
- **Fresh release:** npm run deploy rebuilt without local app secrets, uploaded .output only and restarted only new-elcomputer. PM2 is online with one scoped restart, expected cwd/entry/port, verified backup and matching local/deployed sitemap/robots/llms/Nitro hashes. Post-build public secret scan: 108 files, one configured server-secret type, zero matches.
- **Fresh production acceptance:** 44 AI HTTP resources/current prices/review counts/all guide targets; 32 SSR pages; exact 142 localized sitemap URLs/426 alternates; 40 storefront EN/AR Light/Dark desktop/mobile screens; four signed-in dashboard settings/SEO/pages screens. Live Chat status/open-close and anonymous checkout/dashboard protection passed. No browser exceptions, console errors/warnings, hydration warnings or overflow. Business/catalog/CMS/settings counts/fingerprints are unchanged. Authenticated SSR produced four preexisting-type SDK session-user warnings (486 preceded release), with no application exceptions. Production Nginx adds an equivalent second nosniff token; the HTTP harness accepts proxy-combined headers without changing the application or proxy.
- **Limits and stop:** Published Help/preorder/Coming Soon examples are absent in production and remain fixture-verified only. Cloudflare account configuration and actual external AI crawler adoption are not verified; voluntary robots is not enforcement. No fresh customer login/order/payment/chat-message or media upload submission was performed. No AI settings panel, migration, chatbot, model integration, generated content, navigation or commerce change was added. AI readiness is complete; STOP and do not begin another feature.

---

# Codex handoff — earlier public SEO release, 2026-10-01

Historical SEO-only release record. The current AI-readiness entry above supersedes the statements about absent AI files/policy and the prior stop instruction.

**Current SEO status: DEPLOYED / PRODUCTION ACCEPTANCE PASSED.** Application SHA `e4fb685f4441326f7999a1954b5710928531789c` was already committed/pushed when the user explicitly authorized this SEO-only release. `npm run deploy` released it to `https://new.elcomputer.net`, PM2 `new-elcomputer`, fixed site path and port 3001. Backup: `/home/newelcomputer/htdocs/new.elcomputer.net/.output-deploy-backup-20261001-043139-15337`. This handoff update is documentation only; no new application feature or AI work belongs to this release.

- Read `docs/seo.md` and the current SEO section in `PROJECT_STATE.md` first. Architecture: native SSR `usePageSeo`, pure `app/utils/seo.js`, compatible optional-field reads, existing singleton/editor/media controls, public discovery and dynamic XML/robots routes.
- `20261001120000_public_seo.sql` is applied to linked Supabase project `zsqhuwgoasrexdnamlks`; all 53 local/remote migration versions match. The dry run listed only that additive migration. Existing RLS/security and business/catalog/CMS/settings fingerprints were preserved. Final counts remain 91 products, 91 variants, 8 orders, 12 items and 3 profiles. Optional Docker catalog-cache refresh failed after installation; successful ledger/column checks confirmed the remote state.
- English remains default/unprefixed; Arabic remains `/ar`/RTL. Both have clean canonicals and reciprocal en/ar/x-default links when indexable. Stored English catalog/SEO/CMS text remains English. EN/AR key sets match at 3,212.
- Meaningful populated category/brand pages reuse `/search?category=` / `?brand=`. Arbitrary search/sort/filter combinations and pagination are noindex. Private routes have generic metadata without customer identifiers, no public schema/alternates, and noindex headers including auth redirects. Existing access controls are unchanged.
- Product schema reuses public review aggregates, actual prices/SKU/brand, active variants and existing preorder availability. Coming Soon and unavailable preorder have no offer. Home Organization/WebSite omit invented contact details. Real-route breadcrumbs and safely escaped JSON-LD are included.
- Sitemap reads current public records with anon/RLS, publication filters and cap-aware pagination. Discovery caches for 60 seconds; large catalogs use 5,000-identity chunks. Dynamic chunk filenames are handled by `[page].get.js` with validated `1.xml` filenames; partial extension segment routing was verified and corrected. Robots references the shared public origin; no AI policy exists.
- **Fresh release gates:** 188/188 tests, Nuxt typecheck/build, `git diff --check` and deployment preflight passed on the deployed application state. Guarded deployment rebuilt without local app secrets and uploaded `.output` only. After that build, 108 public files scanned against the configured server-secret type had zero matches. No application edits were needed during release; the final Git changes are release documentation.
- **Production SEO:** 32 real SSR pages passed. Home/AR language, direction, canonicals, reciprocal en/ar/x-default, Organization/WebSite, actual Product/Breadcrumb/price/review data, category/brand/CMS and private/404 metadata were checked. Sitemap equals 71 current public identities / 142 localized URLs with 426 alternates. Chunk 1 and invalid chunk 2, robots production origin/no AI rules, private response headers and protected redirects passed. Remote sitemap/robots chunk hashes equal local deployed output.
- **Authenticated staff:** Four global SEO fields saved/reloaded; media library select/remove passed; original values restored to null. A controlled CMS page verified title/description/image/noindex save/reload, SSR, cleared fallback and noindex sitemap exclusion after discovery-cache expiry. Controlled records were deleted and original catalog/CMS/settings fingerprints preserved. Four authenticated EN Light desktop / AR Dark mobile SEO/settings/pages screens passed. No new catalog rows, orders, payments, messages or upload files were created.
- **Regression:** 64 production storefront screens passed EN/AR × Light/Dark × desktop/mobile across home, product, search, CMS, cart, login and help, with zero overflow, browser exceptions, console errors/warnings or hydration warnings. A real stocked product added to cart and survived reload; no order/payment was submitted. Live Chat status/open/close and anonymous checkout/dashboard protection passed. PM2 is online with the expected cwd/entry/port and one release restart. Signed-in SSR added only existing SDK session-user warnings; 465 identical warnings predated release. Do not report an unchanged error log for authenticated acceptance.
- Current release evidence is in `/tmp/elcomputer-seo-release/`, including deployment/migration/gate logs, production SSR/browser JSON, global/CMS acceptance JSON, screenshots, database fingerprints and sanitized server-log evidence. `/tmp/elcomputer-seo/` contains historical local fixture checks. Read production review paths in `docs/seo.md`.
- **Limits:** Fresh media upload, customer password/OAuth and signed-in checkout/payment/chat-message submission were not exercised by this SEO release. Library permissions and upload architecture are preserved. SEO/catalog content is still not translated into Arabic; crawler indexing/rich-result outcomes remain external.
- Future AI-readiness work may reuse the shared metadata/canonical/locale/discovery/sitemap/schema helpers. No future feature is implemented or authorized by this SEO task. Stop here.

# Codex handoff — customer authentication page, 2026-09-30

**Current auth phase status: DEPLOYED.** Migration `20260930120000_auth_page_appearance.sql` is applied to Supabase project `zsqhuwgoasrexdnamlks`; all 52 migration versions match. Application commit `23b083f` (auth implementation `41aee51`) was deployed through `npm run deploy` to PM2 `new-elcomputer` at `https://new.elcomputer.net`. Final VPS backup: `/home/newelcomputer/htdocs/new.elcomputer.net/.output-deploy-backup-20260930-140828-9990`. Guarded postflight and public endpoint checks passed.

- Read `docs/authentication-page.md` for the additive migration, media/settings reuse, fixed app redirects, provider setup and manual acceptance. Both Google and Facebook are disabled in the production Supabase Auth settings as of release. The login page reads provider availability and hides unavailable buttons; Facebook also requires `auth_facebook_enabled` in store settings.
- The Supabase Auth Site URL was last documented as `http://localhost:3000` and has not been rechecked. Confirm Site URL and Redirect URLs in the Supabase dashboard before relying on email confirmation, password reset or OAuth. Configure provider credentials separately and verify real email, OAuth, disabled-account, profile, reset and dashboard upload/save flows with isolated identities.
- Fresh gates: 174 tests, Nuxt typecheck/build, `git diff --check`, guarded preflight and postflight passed. Migration list has full parity. Seven anonymous live Chrome layouts passed with real branding and no overflow or browser issues. Anonymous checks do not verify authenticated workflows.

---

## Previous release — Sun/moon toggle, 2026-09-29

**Current status: DEPLOYED.** The user authorized this VPS release. Final application commit `6b6d8f2d2ce5d07733454240c8ab641f6c69f161` includes toggle commit `ff4029d` and localization base `c139700`. PM2 `new-elcomputer` serves `https://new.elcomputer.net`; backup: `/home/newelcomputer/htdocs/new.elcomputer.net/.output-deploy-backup-20260929-163821-3434`.

- `UiPreferences.vue` replaces the theme dropdown with an accessible native button. Light shows a sun, Dark a moon; clicking persists the opposite theme through existing cookies. Both icons use CSS visibility to preserve prepaint/System hydration behavior. The language dropdown says English in both locales. The site default can still be System; clicking creates a manual Light/Dark override.
- Catalogs contain 3,131 matching EN/AR keys. Scope remains interface only; stored catalog/customer/review/chat/CMS values are unchanged.
- Only the three-column `20260928130000_ui_appearance.sql` migration was applied to Supabase project `zsqhuwgoasrexdnamlks`. All 51 migrations match. Direct checks preserved the existing singleton settings fingerprint and counts (products 91, variants 91, orders 8, items 12, profiles 3); new defaults are System and null logos.
- Fresh validation after the final source fix: 172 tests, Nuxt typecheck/build and whitespace check passed. Local Chrome passed 30 control/rendering/persistence checks across English/Arabic, Light/Dark, 1440/390px and storefront/search/dashboard fixtures with no exceptions, console errors or hydration warnings. No synthetic production identities/orders/uploads were created. Authenticated settings/upload acceptance remains pending.
- The guarded script rebuilt without local app secrets, scanned its output, packaged only `.output`, and restarted only `new-elcomputer`; preflight/postflight and public health passed. PM2 is online at the expected cwd/entry. Nine public routes returned 200; **22/22 live Chrome checks passed** with no overflow, exceptions, console errors or hydration warnings. The local preview and final live smoke stopped producing the i18n base-URL warning after `app/app.vue` dropped its redundant `useLocaleHead({ seo: false })` call; explicit lang/dir remains. One warning line arrived during the release transition; the PM2 error log stayed unchanged during the final smoke. Evidence: `/tmp/elcomputer-theme-release/`. The earlier 208-screen/36-interaction evidence below belongs to the original dropdown implementation; it is historical, not the fresh toggle result. Original temporary artifacts were cleared before this follow-up.

---

# Codex handoff — English/Arabic UI and appearance, 2026-09-28

**Historical status before the 2026-09-29 release authorization:** local implementation only. The original request prohibited deployment, catalog/customer/CMS translation and another feature. The release entry above records the newer deployment authorization.

- Architecture: `@nuxtjs/i18n` 10.6.0 and `@nuxtjs/color-mode` 4.0.1 in `nuxt.config.ts`; catalogs in `i18n/locales/{en,ar}.json` contain 3,130 matching semantic keys. English remains default/unprefixed, Arabic uses `/ar`, and browser-language detection is disabled. Use direct semantic keys for new UI and the explicit `useUiLocale` adapter only for application metadata/enums/errors; never run it on stored content.
- Routing: `useUiRoute` strips locale prefixes for existing comparisons; `useUiNavigation` localizes destinations; standard `NuxtLinkLocale` handles links. Customer/dashboard middleware retains its existing security decisions after prefix normalization. `00-locale-preference.global.js` honors only explicit manual Arabic choice. Native shared preference controls preserve route/query/hash and application state.
- Persistence/SSR: `elcomputer-locale` stores language choice; `elcomputer-theme-choice` stores manual theme, and `elcomputer-color-mode` supplies the standard prepaint bootstrap. Manual choice wins over `site_theme_default`; System follows live OS changes. HTML lang/dir follow locale. Theme images use CSS visibility, and the existing client-only homepage loader waits for hydration before appearing.
- Styling: `appearance.css` holds shared Light/Dark colors and appropriate RTL icon rules. Existing styles use logical properties and tokens; RTL carousels account for scroll direction. Email/phone/card/number entry remains readable. Product imagery, logos and play icons are unchanged by direction.
- Branding: Settings → Store details → Appearance and branding. Existing `DashboardMediaUploadField`, `DashboardMediaLibrary`, `useAdminUploads` and settings section save flow provide select/upload/remove/preview. Light and Dark previews use their respective backgrounds. `BrandLogo` handles theme switching, legacy/bundled fallback and failed loads across header/footer/dashboard.
- Migration: `supabase/migrations/20260928130000_ui_appearance.sql` adds three settings columns only. **UNAPPLIED REMOTELY.** No production DB/Auth/uploads/VPS mutation belongs to this phase. Apply and accept on an isolated database only in an authorized future release/acceptance task.
- Content: product/title/description/specification/feature/category/brand/model/SKU data, customer/review/chat/ticket/order-note content and saved CMS/marketing copy remain unchanged. Only UI and stable status labels are localized. `ar-EG-u-nu-latn` preserves EGP and Latin digits. Packing documents localize labels and escape stored content.
- Final gates after the latest application edits: **172 repository tests and 14 focused localization/theme/account checks passed**; Nuxt typecheck/build and `git diff --check` passed. Locale tests verify 3,130 matching keys, compilation, parameters and static Vue/adapter references; the literal-copy audit leaves intentional identifiers/examples. The public-output scan checked 102 text assets against the configured server-only secret: **zero exposures**. Nonfatal build warnings concern Tailwind sourcemaps and previous preorder BigInt code targeting ES2019.
- Final browser evidence: **208/208 screens and 36/36 preference/branding interactions passed**, with zero overflow, JavaScript exceptions, console errors or hydration warnings. Widths: 1440/1024/768/390; locales: EN/AR; themes: Light/Dark. Readiness checks ensure protected account/checkout/dashboard and Help Center fixtures render their actual components. Interactions verify language/theme reload persistence, prepaint behavior, live System changes, retained route/query/hash/cart/session, RTL sidebar/price dragging, logo fallbacks, media select/upload/remove/save payloads, dark contrast and localized errors. Final-validation fixes include sidebar leaf links, the product-card formatter, mobile header clipping and chat/cart feedback.
- Evidence: `/tmp/elcomputer-localization/matrix-complete.log`, `visual/results.json`, `interactions.json`, `tests-complete.log`, `final-focused-tests.log`, `typecheck-complete.log`, `build-complete.log`, `audit-final.log`, `translation-audit.json`, `secret-scan.json` and screenshots. The final reference audit checked 3,183 literal calls and 3,193 adapter references with zero missing keys. The preview uses current Chrome, anonymous catalog reads and intercepted privileged writes. These fixtures do **not** establish real authenticated backend persistence while the migration is unapplied. VPS upload files are absent locally; logo checks use image fixtures. Older browsers remain unverified.
- Read `docs/ui-localization.md` for implementation details, the full audit/report, content boundaries, fallbacks and Arabic wording review targets. Review specialized ERP/finance terms with Arabic-speaking staff. Stop after this phase.

---

# Codex handoff — Pre-order deployed, 2026-09-28

- User authorized Supabase and VPS deployment. Migration `supabase/migrations/20260928100000_preorders.sql` is applied to project `zsqhuwgoasrexdnamlks`; deployed application SHA is `d94e758bdcae03cba7a910cf6f85043638a262a3`. PM2 `new-elcomputer` serves `https://new.elcomputer.net`. Backup: `/home/newelcomputer/htdocs/new.elcomputer.net/.output-deploy-backup-20260928-103405-77367`. Existing product/order/inventory counts and checksums were preserved. Release review fixed SQL NULL validation for missing deposit/payment/snapshot values and fulfillment state.
- Preorder purchases use `commerce_create_preorder`; normal checkout remains the renamed legacy transaction behind a selling-mode guard. Preorder inventory is an allocation only, counted under product row locks; physical stock/serialized units are assigned only by `commerce_release_preorder` after full verified payment and stock arrival. New preorders are held from packing and PDC until release. Daftra export remains deferred even after release because the current connector has no preorder payment-ledger reconciliation.
- Checkout forbids mixed carts and preorder coupons. Bank transfer/InstaPay orders remain payment pending until staff verify actual funds and record a referenced receipt through the order dialog. `amount_paid` and the private `preorder_payments` ledger preserve truth; the required deposit is not treated as received. The configured payment fee is due initially. Real gateway callbacks can later post verified receipts and drive `amount_paid` through a dedicated server workflow; never mark a gateway charge successful from the current card/PayPal UI.
- Staff controls are in both product add/edit and the order detail dialog. Customer product/cart/checkout/history/detail/summary surfaces show preorder terms and snapshot amounts. Existing Order Again was not modified. `source=preorder_checkout` distinguishes the existing order analytics event.
- Validation: 164 tests, Nuxt typecheck, guarded build/deploy, diff check, and pre/post VPS checks passed. Direct Supabase checks confirmed migration history, ledger RLS, browser RPC denial, all 91 products remaining `normal`, all 8 orders retaining normal state, and zero payment receipts. Live public pages and chat status returned 200; new routes correctly returned 400/404 for invalid/non-preorder products and 401 for unauthenticated writes. Chrome passed normal product at four widths, add-to-cart/mobile cart, and dashboard login redirect with no overflow, JavaScript exceptions, or resource errors. No new VPS error-log entries appeared; the quote-handler checksum matched the release.
- Local cart fixtures previously covered a 25% deposit at 390/768/1024/1440px, plus full payment without a date, mixed-cart warning, and normal item at 390px. Authenticated preorder checkout/account/dashboard walkthroughs and a live campaign still need isolated test data or staff acceptance. No synthetic production catalog rows or orders were created.
- Bank transfer and InstaPay are currently disabled with no instructions. Staff must configure and enable an offline payment method before accepting preorders, then deliberately configure the intended product. The owner reset allowlist and database scope include the new ledger. The optional Supabase Docker catalog-cache refresh failed after successful migration; direct queries confirmed the remote result.

# Codex handoff — Product color variants deployed

Date: 2026-09-27. State: **DEPLOYED TO PRODUCTION.** No schema change.

- User chose colors as variants under one product. The public product page now shows photo-backed color tiles when active variants have distinct `color_name` values; it falls back to valid `color_hex` swatches and marks sold-out choices. Selection uses the existing variant image gallery, stock limits, and cart rules. An unrelated base product image is hidden after choosing another color. Non-color options remain in the generic option layout, with variant thumbnails when present and no internal code shown to shoppers.
- Staff configure this at `/dashboard/products/edit/[id]`: Product Variants → Color Name / optional Color, save, then Extra Images → assign pictures to each saved variant. The first assigned image is the tile preview; add an image for every color. No current production product has multiple active variants (91 products, 91 variants), so staff configuration is required to make the new selector appear. All currently published products use the serialized variant model.
- Validation: 158/158 tests, typecheck, deployment build, `git diff --check`, and guarded pre/post VPS checks passed. Live home, two product pages, and chat status returned HTTP 200. Chrome at 390 and 1440 pixels found no overflow or browser exceptions on existing products. A real multi-color visual check remains pending staff data. Backup: `/home/newelcomputer/htdocs/new.elcomputer.net/.output-deploy-backup-20260927-143919-66608`.

---

# Codex handoff — Product specification library deployed

Date: 2026-09-27. State: **DEPLOYED TO PRODUCTION.**

- Production rollout: the linked Supabase dry run listed only `20260927120000_product_specification_library.sql`; it applied successfully to project `zsqhuwgoasrexdnamlks` and the remote ledger now matches. Product/specification/category counts stayed 91/8/8; the new tables contain 31 definitions, 33 category suggestions, and zero features. Anonymous definition read passed and anonymous category-template read was denied. The CLI could not refresh its optional Docker catalog cache, but the remote ledger and table reads succeeded.
- VPS: `npm run deploy:check` passed before and after guarded `npm run deploy`. The script uploaded `.output` only to `/home/newelcomputer/htdocs/new.elcomputer.net`, restarted only PM2 app `new-elcomputer`, and retained backup `/home/newelcomputer/htdocs/new.elcomputer.net/.output-deploy-backup-20260927-142341-65646`. Live home, two product pages, and chat status returned HTTP 200. Chrome at 390 and 1440 pixels showed no horizontal overflow or browser exceptions; an unauthenticated product-edit route redirected to `/dashboard/login`.

- Scope: public `/products/[slug]`, dashboard `/dashboard/products/edit/[id]`, additive product specification/feature schema, and the existing reset allowlist required by those three new tables. Prior deployed product page functionality remains the baseline; this phase adds canonical specification entry, optional category suggestions and highlights, optional feature bullets, and safe long-description formatting.
- Migration: `supabase/migrations/20260927120000_product_specification_library.sql`. It creates `specification_definitions`, `category_specification_templates`, `product_features`; extends `product_specifications` with nullable `definition_id` and `is_highlight`; seeds 31 canonical names and optional templates for matching mouse/keyboard/laptop/phone category slugs; adds grants/RLS; and extends Products/Full reset scopes. It leaves all existing product, specification, and description values untouched.
- Admin workflow: save a product, open its edit page, click a category suggestion or search canonical names/aliases, enter a value, and optionally flag it as a highlight. Legacy rows can be edited or linked gradually. The shared name creation flow requires confirmation, checks close/exact duplicates, and can add a category suggestion. Staff can manage suggestion order/default highlights, paste and review up to 30 obvious specification lines, and manage short feature bullets. New category slugs and preferred suggestions require staff configuration; the seeded templates are a starting point.
- Public workflow: complete structured specs appear in stored order with canonical names and group headings; a 2–8 card Highlights section reuses marked spec values. Features are separate selling points. Description lines render as escaped text blocks, with obvious labels, bullets, and headings presented for reading only. Empty optional sections are hidden. Lightbox thumbnails supplement the existing keyboard/focus/scroll-lock gallery. Reviews, recommendations, variants, stock and cart retain their existing sources and rules.
- Validation: focused specification, product detail and reset tests passed; full repository tests passed (157/157); Nuxt typecheck, production build, and `git diff --check` passed. Local Chrome against existing catalog pages at 390/768/1024/1440 showed no horizontal overflow, runtime exceptions, or hydration errors. Mobile lightbox open/Escape, focus restoration and body scroll lock passed. The current catalog has no linked canonical values or features; an authenticated editor and complete mouse/keyboard/laptop feature set still need staff review. Some existing sample image URLs are broken, so the gallery showed the intended no-image state.
- Exact review routes: `/dashboard/products/edit/[id]` for a staff-owned mouse, keyboard, laptop, and simple accessory; `/products/jedel-cp102-mouse-optical-sensor-3600-dpi-7-buttons-braided-cable-silent-click` for description-only and mobile purchase layout; `/products/test2-a6ea86f0` for legacy specs; and a populated product with several images, variants, reviews, and newly marked highlights once staging data is available. Test 390/768/1024/1440 widths.

---

# Codex handoff — Public product detail refresh deployed

Date: 2026-09-27. State: **DEPLOYED TO PRODUCTION.**

- Scope is the public `/products/[slug]` page and specification presentation, plus existing specification editor ordering. No checkout, account, shipping, payment, SEO, RLS, or database schema changes.
- Product page now has a responsive thumbnail and main-image gallery, keyboard-accessible lightbox, real review summary, savings shown only when `old_price > price`, preserved serialized variant and cart handling, ordered specs, and up to four related products using existing product cards.
- The existing dashboard editor still adds, edits, and removes specification rows; it now reads and writes `sort_order` and supports moving rows up/down. Existing data needs no migration. Product managers can add structured rows manually in the editor when a product has none; descriptions are not converted.
- Validation: focused product-detail tests passed; full `node --test tests/*.test.mjs` passed (152/152); `npm run typecheck` passed; `npm run build` passed; `git diff --check` passed. Local Chrome checks at 390/768/1024/1440 passed horizontal-overflow and console-exception checks. A mobile gallery layout issue was corrected and rechecked. Lightbox controls/focus/scroll lock, review jump, and a local in-stock cart add passed.
- Deployment: guarded `npm run deploy` succeeded with SSH user `newelcomputer`, locked path `/home/newelcomputer/htdocs/new.elcomputer.net`, and PM2 app `new-elcomputer`. Backup retained: `/home/newelcomputer/htdocs/new.elcomputer.net/.output-deploy-backup-20260926-211147-60600`. `npm run deploy:check` passed before and after. Live home, sample product, in-stock product, and `/api/chat/status` returned HTTP 200. Live Chrome at 390 and 1440 pixels showed the new page with no horizontal overflow or JavaScript exceptions; Nuxt emitted nonblocking duplicate prefetch timer warnings. No database migration or data write was part of this deployment.
- Manually review a representative product with multiple variants and variant galleries, a product with one image, a product with long spec values, and a product with real reviews on mobile and desktop. A local in-stock serialized product with one default option passed cart add. Live multiple-option switching, long spec values, and a populated rating state were unavailable in the sample catalog and remain manual review targets.

---

# Codex handoff — Live Chat Phase 15

Date: 2026-09-23. State: **PHASE 15 COMPLETE IN PRODUCTION. Live Chat V1 is deployed and enabled.**

## Completed in Phase 15

- Re-verified production Supabase project `ElcomputerDEMO` (`zsqhuwgoasrexdnamlks`), the linked migration ledger, locked VPS user/path, single PM2 application `new-elcomputer`, public hostname `new.elcomputer.net`, pre-deploy health, server backup behavior, and automatic rollback path.
- Ran a linked dry run and confirmed exactly the 11 reviewed Live Chat migrations from `20260920150000` through `20260922100000`. Applied only those migrations; the temporary Phase 14 staging baseline was never used in production. A fresh linked listing shows all 11 local/remote versions matched.
- Captured production data baselines before migration and verified them afterward: `customer_profiles` 3, `customer_orders` 7, `products` 91, and `support_tickets` 0. All four counts remained unchanged.
- Enabled production anonymous Auth through a targeted Management API patch while retaining the 30-per-hour anonymous sign-in limit. A real anonymous sign-in passed, created no customer profile, and was deleted.
- Deployed the production build with the guarded release script. It built without local application secrets, scanned the output, packaged only `.output`, touched only the locked site and PM2 process, and retained rollback backup `/home/newelcomputer/htdocs/new.elcomputer.net/.output-deploy-backup-20260923-035645-36920`.
- Kept chat disabled through migration and deployment verification. After all health/security checks passed, enabled it through the authenticated settings API and its atomic audit transaction. The short-lived operator held only `settings.view` and `settings.edit`, was deleted after activation, and left one permanent `chat.settings.updated` actor snapshot showing `is_enabled` changed.

## Final production state

- Public application: `https://new.elcomputer.net` is healthy. The PM2 runtime Supabase hostname was verified without exposing values and resolves to the exact production ref `zsqhuwgoasrexdnamlks`.
- Live Chat: enabled. Public availability is currently offline because no eligible support agent has a current online lease. Offline intake remains enabled in conversation mode with either email or mobile accepted, a four-second customer cooldown, and private attachments.
- Database: all eight private chat tables exist. The singleton setting is enabled; every chat data table is empty. No probe identity, temporary admin, conversation, message, event, read state, attachment, availability lease, or rate-limit row remains.
- Auth: anonymous sign-in is enabled with rate limit 30. The existing Auth site URL remains `http://localhost:3000`; Phase 15 changed only anonymous-user settings. Review reset/invite/OAuth redirect configuration separately before relying on those flows.
- Storage and authorization: `chat-attachments` is private. Anonymous and authenticated browser roles were denied direct reads from all chat tables, and an authenticated guest was denied an unrelated private topic.

## Validation evidence

- `node --test tests/*.test.mjs`: **141 passed, 0 failed**.
- `npm run typecheck`: passed.
- Production build inside `npm run deploy`: passed; only existing non-blocking sourcemap warnings appeared.
- `npm run deploy:check`: passed before and after deployment.
- Supabase dry run: exactly 11 intended migrations. Apply: successful. Post-apply linked ledger: all 11 matched.
- Hosted database checks: existing business counts unchanged; service-role schema/settings checks passed; chat data tables empty; private bucket passed; anonymous/authenticated direct-table denial passed; unrelated private-topic denial passed.
- Production HTTP checks: home 200; public chat status 200 and enabled/offline; dashboard Live Chat redirected to login; unauthenticated customer, staff, and settings endpoints returned 401 with private no-store, authorization-varying, no-sniff responses.
- Final state checks: temporary Auth/admin identities absent; one permanent activation audit retained; PM2 application and internal health endpoint passed.

## Files changed in Phase 15

- `PROJECT_STATE.md` and `CODEX_HANDOFF.md` record the production release and evidence.
- No application, server, package, deployment-script, or migration source file changed in Phase 15.

## Security and operational notes

- Production data was not deleted, policies were not weakened, and no destructive migration ran. The deployment did not touch another site, service, Nginx configuration, global PM2 state, or shared server configuration.
- Phase 14 remains the full hosted multi-role acceptance record. Phase 15 intentionally used non-destructive probes and created no production customer conversation.
- Support staff must keep the Live Chat dashboard visible and select Online for a renewable 90-second lease before public status becomes live. Offline messages can be accepted now and should be monitored in the dashboard.
- Continue normal monitoring for real traffic, quotas, proxy-derived network identities, rate-limit tuning, physical devices, and assistive technology. Fixed-window boundary bursts and the absence of malware scanning remain known V1 limits.

## Handoff

There is no Phase 16 in the master specification. Development phases 1–15 are complete. Routine operations are to monitor the production queue and logs, have authorized staff manage availability and settings through the dashboard, and use the retained release backup if a rollback is required.

---

# Previous handoff — Live Chat Phase 14

Date: 2026-09-23. State: **PHASE 14 COMPLETE IN ISOLATED STAGING — awaiting separate explicit approval for Phase 15. Production was not migrated or deployed.**

## Completed in Phase 14

- Created isolated Supabase project `ELcomputer-Phase14-Staging` (`guaaupeegyvmsfaytfso`) in `ap-southeast-2`. Preview branches were unavailable on the current Free plan, so the staging target is a separate project with no production data.
- Used a temporary Supabase work directory and project link. Imported the checked-in schema baseline as a temporary staging-only migration, then applied the complete repository migration chain. Staging now has 46 matching versions: one temporary baseline plus all 45 repository migrations, including the 11 Live Chat migrations from `20260920150000` through `20260922100000`.
- Enabled anonymous Auth only on staging through the Supabase Management API and confirmed a real anonymous sign-in. Staging chat itself is restored to disabled/offline with a four-second cooldown after acceptance.
- Added guarded runner `scripts/live-chat-staging-acceptance.mjs`. It refuses project ref `zsqhuwgoasrexdnamlks`, requires the staging ref to match both the Supabase URL and an explicit confirmation variable, and accepts only a localhost application URL. The runner seeds generated test identities/orders, exercises hosted Auth/API/Storage/Realtime/database behavior, writes non-secret evidence to `/tmp`, and leaves chat disabled.
- Completed all 17 acceptance groups with Guest A/B, Customer A/B, Support Agent A/B, Admin owner, and an authenticated outsider. Coverage includes guest/auth chat, account linking, unread/read state, single-winner claim, transfer with a concurrently open thread, order ownership, public/internal files, internal-note isolation, chat-to-ticket conversion, offline mode, business hours, admin audit, direct cooldown bypass, two tabs, reconnect, duplicate retry, send/close concurrency, closed-chat behavior, and customer/guest/staff cross-access denial.
- Ran real private Broadcast subscriptions. The owning customer and staff subscribed and received the correct scoped signals; Customer B could not subscribe to Customer A's topic; the public topic did not receive the internal note. An earlier repeated run had one transient staff-topic timeout and recovered through bounded reconnect. The final run completed with all permanent messages present.
- Ran browser acceptance against the staging-configured production build in Chrome. Desktop 1440×900 and mobile 390×844/2× passed viewport containment, mobile modal/body locking, focus movement and Escape restoration, reduced motion, labelled accessibility-tree semantics, loaded staff queue, Realtime **live** state, and horizontal-overflow checks. The final capture recorded no JavaScript exception, error log, or local HTTP 5xx. Physical device and screen-reader hardware were not available; the browser viewport, keyboard, reduced-motion, and accessibility-tree checks are the retained evidence.
- Verified representative query plans using 3,000 temporary conversations. Waiting, assigned-to-me, unassigned, and offline views used the intended four indexes and completed in 0.046–0.070 ms on staging. The temporary plan rows were deleted and statistics refreshed in the same staging check.
- Added the detailed evidence checklist at `docs/live-chat-staging-acceptance.md`. Updated `PROJECT_STATE.md` with the architecture, eight tables, private Realtime strategy, RLS/grants, route groups, components, settings, quota behavior, support context, and ticket integration.

## Files changed in Phase 14

- `scripts/live-chat-staging-acceptance.mjs` — new guarded hosted-service acceptance runner.
- `docs/live-chat-staging-acceptance.md` — new completed staging checklist and evidence summary.
- `PROJECT_STATE.md` and `CODEX_HANDOFF.md` — Phase 14 state and handoff.
- No application, server, package, or checked-in migration file changed in Phase 14. The baseline migration existed only in the temporary staging work directory.

## Migration and security evidence

- Staging migration history: 46 local/remote matches, with 11 Live Chat migrations. `chat_settings`, `chat_conversations`, and `chat_messages` exist; the private `chat-attachments` bucket exists.
- All eight Live Chat tables have RLS enabled. `anon` and `authenticated` have zero direct select/insert/update/delete privilege on them. The only browser-executable `chat_*` routine is `chat_can_receive_topic(text)` for signed-in private Broadcast authorization.
- The bucket is `public=false` and no broad `storage.objects` policy names it. Hosted route tests reject Customer B, unauthenticated, public-URL, bad-signature, and internal-note file access.
- Supabase security advisors reported only the two intentional chat warnings: the authenticated SECURITY DEFINER topic predicate and anonymous signed-in access through the scoped Realtime policy. Hosted cross-topic and guest-isolation tests passed.
- The repository remains linked to `zsqhuwgoasrexdnamlks`. A read-only query confirmed its latest migration remains `20260920140000`; both `chat_settings` and `chat_conversations` are absent. No production database write, anonymous Auth change, VPS action, PM2 restart, or public deployment occurred.

## Validation

- Guarded staging runner: **17 groups passed**, exit 0.
- Browser staging acceptance: desktop customer, mobile customer, desktop staff, and mobile staff passed; private Realtime reached **live**; console/server error count was zero.
- Representative staging plans: all four bounded inbox shapes used their intended indexes.
- `node --test tests/*.test.mjs`: **141 passed, 0 failed**.
- `npm run typecheck`: passed.
- `npm run build`: passed against the staging environment. Only the existing non-blocking sourcemap warnings appeared.
- `git diff --check`: passed after the final documentation update. No lint script exists.

## Staging state and limits

- Staging anonymous Auth remains enabled so the guest flow can be rechecked. Live Chat is disabled, forced offline, and set back to a four-second customer cooldown. The project contains generated `example.test` acceptance records and no production data or credentials.
- The staging project is on the Free plan and was used for functional/concurrency acceptance, not sustained load capacity. Fixed-window boundary bursts, provider quotas under production traffic, real reverse-proxy address selection, and traffic-based threshold tuning still require operational monitoring after any approved release.
- Browser emulation verified the mobile viewport and accessibility tree. A physical-device and assistive-technology lab was not available in this environment.

## Exact next action — Phase 15 only after explicit approval

Do not migrate or deploy production without the user's separate explicit Phase 15 approval. After approval, first re-verify the exact production Supabase ref, migration dry run, VPS target, backup path, and rollback plan; apply only the 11 reviewed Live Chat migrations, configure production anonymous Auth deliberately, deploy the scoped application build, keep chat disabled until post-deploy health/security checks pass, then enable it through the audited setting. Do not reuse the temporary staging baseline migration on production.

---

# Previous handoff — Live Chat Phase 13

Date: 2026-09-22. State: **PHASE 13 COMPLETE LOCALLY.**

## Completed in Phase 13

- Audited the actual Live Chat database, server routes, private Realtime topics, attachment flow, rate limits, customer client, and staff inbox against the master specification. The review covered authorization/RLS, service-key isolation, internal notes, attachment access, XSS, duplicate messages, reconnect, assignment races, read state, audit history, bounded queries, subscriptions, indexes, error handling, mobile behavior, and accessibility evidence from Phase 12. No confirmed critical issue remains locally.
- Added local additive migration `supabase/migrations/20260922100000_live_chat_audit_hardening.sql`. Pending attachment completion now locks and reauthorizes the current conversation/message actor after upload, closing the race with close, transfer, deactivation, and guest association. Completed attachments remain idempotently retryable. The migration is local only.
- Added a service-only network limiter that recognizes an exact committed customer/guest message retry before consuming network counters. Both ordinary sends and atomic conversation-plus-message starts pass their verified conversation or creation key, submission key, actor, and body to that boundary. Conflicting or new requests still consume the existing limits.
- Reduced committed Realtime fanout. Message-only conversation updates no longer produce a second three-topic signal set; public messages now emit exactly one inbox, staff, and customer signal, while internal notes remain staff-only. Added inbox indexes for the common status, assigned, unassigned, and offline queue shapes.
- Added private no-store, authorization-varying, no-sniff headers to protected chat JSON responses. Revoked browser execution from the remaining chat settings and reset trigger helpers. No staging, remote migration, anonymous Auth change, or deployment was performed.

## Audit classification

- **CRITICAL:** none confirmed.
- **IMPORTANT, fixed:** attachment completion authorization race; network quota consumption on exact committed HTTP retries; duplicate Broadcast fanout on every public message.
- **MINOR, fixed:** absent explicit private cache headers on chat JSON routes; default execute privilege on two trigger helpers; missing direct indexes for four common bounded inbox views.
- **VERIFIED OK locally:** scoped customer/guest/staff authorization, private tables/topics/storage, internal-note isolation, text-only rendering, capped request bodies and result sets, row-locked workflow writes, stale revisions, idempotency, monotonic read state, audit snapshots, reconnect reconciliation, fixed-size context loading, and limited subscriptions.

## Files changed in Phase 13

- Migration: `supabase/migrations/20260922100000_live_chat_audit_hardening.sql` (**new; local only**). All eleven Live Chat migrations remain unapplied remotely.
- Server: `server/utils/liveChat.js`, `server/utils/liveChatRateLimit.js`, customer conversation-start and message POST routes, and admin chat settings GET/PUT routes.
- Tests: `tests/live-chat-rate-limits.test.mjs` and `tests/live-chat-transactions.test.mjs`.
- Documentation: `PROJECT_STATE.md` and `CODEX_HANDOFF.md`.

## Checks and verified behavior

- `node --test tests/*.test.mjs`: **141 passed, 0 failed**. `npm run typecheck`: passed. `npm run build`: passed. `git diff --check`: passed. No lint script exists.
- Focused PGlite tests prove that a pending customer file cannot complete after close, a pending staff file cannot complete after transfer, a completed file remains retryable, exact committed message/start retries consume no network counter, new messages do, browser roles cannot call the new RPC or trigger helpers, public messages emit exactly three scoped signals, and the four queue indexes exist.
- The built storefront and `/api/chat/status` returned HTTP 200. `/dashboard/live-chat` returned the expected HTTP 302 login redirect. Unauthenticated customer inbox, staff inbox, and settings routes returned HTTP 401 with `Cache-Control: private, no-store`, `Vary: Authorization`, and `X-Content-Type-Options: nosniff`.

## Unverified areas and remaining work

- **NOT VERIFIED / REQUIRES MANUAL TESTING:** Applying the eleven migrations to real Supabase; remote RLS, grants, PostgREST RPC exposure, private Broadcast, private Storage, authenticated customer/guest/staff HTTP and browser flows, simultaneous database sessions, real query plans with representative chat volume, sustained traffic and Realtime quota, reverse-proxy address selection, anonymous Auth and CAPTCHA policy, reconnect across network loss, devices, and assistive technology.
- Fixed-window rate counters can allow extra traffic around a boundary. Contact substring search is capped and validated but still needs a staging query plan at representative volume. Thresholds, proxy trust, Auth limits, and CAPTCHA remain operational settings that require staging evidence.
- Phase 13 completes the local audit checkpoint. Live Chat V1 is not ready for production until Phase 14 staging migration and manual acceptance pass, followed by separate explicit approval for Phase 15.

## Exact next action — Phase 14, only after “Continue with Phase 14”

Verify the exact isolated staging Supabase project, apply only the eleven intended Live Chat migrations there, configure guest Auth only for staging, and run the master specification's multi-role security, concurrency, Realtime, attachment, reconnect, device, accessibility, query-plan, and quota acceptance checks. Record evidence and update both state files. Stop before Phase 15; do not migrate production or deploy without the user's separate explicit approval.

---

# Previous handoff — Live Chat Phase 12

Date: 2026-09-21. State: **PHASE 12 COMPLETE LOCALLY — awaiting explicit instruction for Phase 13. No remote change.**

## Completed in Phase 12

- Polished the customer launcher and panel for responsive viewport changes, mobile software keyboards, safe areas, touch targets, browser Back, Escape, modal focus containment, focus restoration, reduced motion, visible keyboard focus, linked contact guidance, semantic loading/error/empty states, unread announcements, and clear full timestamps. Existing cooldown typing, minimized unread badge, incremental history, and non-forcing autoscroll behavior remain intact.
- Reshaped the staff inbox so the transcript stays primary: filters and customer context are collapsible, context becomes a third column only on wide screens, the mobile work area follows the viewport, Inbox/Escape navigation moves focus deliberately, and the composer names the customer and chat reference. Semantic live logs, explicit loading/empty states, timezone-aware timestamps, and visible focus states were added.
- Added a staff **New messages** control and polite announcement. Reconciliation keeps the scroll position when an agent reads older history; the control returns to the bottom and then marks visible incoming messages read. No Phase 13 audit, migration, Auth setting, staging action, or deployment was performed.

## Files changed in Phase 12

- Application: `app/components/live-chat/Launcher.vue`, `app/pages/dashboard/live-chat.vue`, and `app/utils/liveChat.js`.
- Tests: `tests/live-chat-customer-ui.test.mjs`. Documentation: `PROJECT_STATE.md`, `CODEX_HANDOFF.md`.
- Database migrations: none. All ten existing Live Chat migrations remain local only.

## Checks and verified behavior

- `node --test tests/*.test.mjs`: **135 passed, 0 failed**. `npm run typecheck`: passed. `npm run build`: passed. `git diff --check`: passed. No lint script exists.
- The new deterministic utility test verifies full local date/time text, timezone-aware labels, and invalid timestamp fallback. The built storefront and `/api/chat/status` returned HTTP 200; unauthenticated `/dashboard/live-chat` returned the expected HTTP 302 login redirect.
- **NOT VERIFIED:** Authenticated browser interaction, actual mobile keyboard and safe-area behavior, mobile browser/PWA Back behavior, screen-reader or voice-control output, high zoom, visual states with long/live conversations, and remote Realtime announcements. Those checks need enabled chat and isolated staging in Phase 14.

## Known issues and decisions

- The customer dialog is modal only at the mobile breakpoint. Desktop remains a compact nonmodal support panel, with Escape and launcher focus restoration.
- Timestamps use the viewer's local timezone and expose a full timezone-aware title. The saved UTC value remains in each `datetime` attribute.
- Source-level semantics, typechecking, and builds cannot establish assistive-technology or device acceptance. Phase 14 must include real mobile browsers, keyboard-only use, zoom, and screen-reader checks before chat is enabled.

## Exact next action — Phase 13, only after “Continue with Phase 13”

Re-read the Phase 13 security, concurrency, and performance requirements in the master specification and this handoff. Audit the actual implementation end to end, fix only confirmed issues within that phase, run the full local validation suite, update both state files, and stop before Phase 14. Do not apply migrations, enable anonymous Auth, stage, or deploy.

---

# Previous handoff — Live Chat Phase 11

Date: 2026-09-21. State: **PHASE 11 COMPLETE LOCALLY — awaiting explicit instruction for Phase 12. No remote change.**

## Completed in Phase 11

- Added local migration `supabase/migrations/20260921160000_live_chat_rate_limits.sql`. It keeps the existing database cooldown, 12 messages/minute, five conversations/hour, 12 attachment reservations/minute, three typing signals/ten seconds, and idempotency enforcement, then adds durable service-only network scopes for conversation, message, repeated content, attachment, and customer typing abuse. All ten chat migrations remain unapplied remotely.
- Added server network subjects for customer write routes. The direct address is used unless a configured or loopback reverse proxy supplies the forwarded address. IPv6 is grouped by `/64`; raw addresses and message text are replaced with service-secret HMACs before persistence. Unavailable addresses fall back to the verified actor, and browser roles cannot call the network counter RPC.
- Strengthened repeated-message detection across an actor's chats with case/whitespace normalization, a 15-second immediate check, and a three-repeat allowance over ten minutes. Network/content checks cover guest-session rotation for messages of at least 12 characters. Rate and cooldown errors now return `Retry-After`; the customer composer pauses only Send, permits continued typing, shows short countdowns, and uses concise text for longer waits. No Phase 12 responsive/accessibility work, remote migration, Auth setting change, staging action, or deployment was performed.

## Effective thresholds

- Actor: saved cooldown; 12 customer/guest messages/minute; five conversations/hour; 12 attachment reservations/minute; three typing signals/ten seconds; immediate duplicate pause; fourth normalized repeat/ten minutes blocked.
- Network: 20 conversation requests/hour and 60/day; 60 message requests/minute and 500/hour; sixth matching normalized content/ten minutes blocked; 30 attachment attempts/minute and 120/hour; 30 customer typing requests/minute and 300/hour.
- Existing maximum message, JSON body, attachment size/type/count, multipart, and idempotency checks remain active. Staff messages are not put behind customer network budgets.

## Files changed in Phase 11

- Migration: `supabase/migrations/20260921160000_live_chat_rate_limits.sql` (**new; local only**).
- Server: `server/utils/liveChatRateLimit.js` and `server/utils/liveChatRateLimitIdentity.js` (**new**); customer conversation/message/typing routes, attachment upload handling, shared chat errors, and typing relay updated.
- Application: customer launcher and `app/utils/liveChat.js` updated for server retry delays.
- Tests: `tests/live-chat-rate-limits.test.mjs` (**new**), transaction and customer UI tests updated. Documentation: `PROJECT_STATE.md`, `CODEX_HANDOFF.md`.

## Checks and verified behavior

- `node --test tests/*.test.mjs`: **134 passed, 0 failed**. `npm run typecheck`: passed. `npm run build`: passed. `git diff --check`: passed. No lint script exists.
- PGlite verifies network limits across rotated identities, independent counter scopes, normalized repeated-content handling, retry hints, existing actor limits, and service-only execution. Pure tests verify IPv4/IPv6 normalization, `/64` grouping, proxy recognition, HMAC subjects, and customer wait-state helpers. The four affected built customer POST routes return HTTP 401 without Auth.
- **NOT VERIFIED:** Real proxy headers and client IPs, remote Supabase migration/grants, authenticated 429 responses, counter contention and cleanup on live PostgreSQL, multiple app nodes, load/false-positive behavior, IPv6 carrier/NAT patterns, anonymous-Auth provider limits, or CAPTCHA. Ten chat migrations remain local; chat settings stay off and anonymous Auth stays disabled remotely.

## Known issues and decisions

- The network budgets are deliberately higher than actor limits so ordinary shared networks have room while rotating anonymous sessions remain bounded. They use fixed database windows, so traffic around a window boundary can temporarily exceed a nominal rate. Phase 13 should measure and audit that behavior under concurrency before staging.
- Forwarded addresses are trusted only with `NUXT_TRUST_PROXY=true` or from a loopback peer. Staging must confirm the real proxy hop. If the address is unavailable, actor fallback preserves ordinary limits but does not stop a new anonymous identity from changing that fallback.
- This layer reduces routine abuse; it does not claim complete bot prevention. Anonymous sign-up itself happens at Supabase Auth and still depends on that service's limits and any configured CAPTCHA. Threshold tuning, CAPTCHA policy, distributed-source behavior, and load tests require staging evidence.

## Exact next action — Phase 12, only after “Continue with Phase 12”

Re-read the Phase 12 responsive, accessibility, and polish requirements in the master specification and this handoff. Implement only customer and staff Live Chat usability polish across supported viewport, keyboard, focus, motion, loading, empty, error, and announcement states; validate locally, update both state files, and stop before Phase 13. Do not begin the security/concurrency/performance audit, staging, remote migrations, anonymous Auth changes, or deployment as incidental work.

---

# Previous handoff — Live Chat Phase 10

Date: 2026-09-21. State: **PHASE 10 COMPLETE LOCALLY — awaiting explicit instruction for Phase 11. No remote change.**

## Completed in Phase 10

- Added local migration `supabase/migrations/20260921150000_live_chat_settings.sql`. It adds a service-only availability diagnostic, a locked/stale-safe settings transaction with an atomic permanent admin audit row, enforced ticket-conversion settings, and atomic conversation-or-linked-ticket offline intake. Manual online still requires a current eligible agent lease. All nine chat migrations remain unapplied remotely.
- Added a grouped Live Chat section to the existing dashboard settings page. It manages enablement, override, timezone and weekly hours, customer text/contact rules, cooldown and message length, attachment policy, transfer/reopen/conversion switches, and offline conversation versus linked-ticket intake. The page shows the evaluated availability reason and recent settings audit rows and supports `settings.view` and `settings.edit` separately.
- Applied saved workflow settings to public status polling, offline first-message results, and staff transfer/reopen/ticket actions. Offline ticket mode preserves the chat as the guest's authenticated transcript/file channel and creates one linked system ticket using the verified relationships and real captured contact. No Phase 11 rate-limit expansion, remote migration, Auth setting change, staging action, or deployment was performed.

## Files changed in Phase 10

- Migration: `supabase/migrations/20260921150000_live_chat_settings.sql` (**new; local only**).
- Server: `server/api/admin-chat/settings.get.js` and `.put.js`, `server/utils/liveChatSettings.js`, `server/utils/liveChatSettingsValidation.js` (**new**); public status/intake, staff conversation settings, and chat error mapping updated.
- Application: `app/components/dashboard/LiveChatSettings.vue` (**new**); dashboard settings navigation/page, staff Live Chat actions, and customer launcher status/offline confirmation updated.
- Tests: `tests/live-chat-settings.test.mjs` (**new**). Documentation: `PROJECT_STATE.md`, `CODEX_HANDOFF.md`.

## Checks and verified behavior

- `node --test tests/*.test.mjs`: **128 passed, 0 failed**. `npm run typecheck`: passed. `npm run build`: passed. `git diff --check`: passed. No lint script exists.
- PGlite verifies deterministic availability reasons, timezone hours, eligible-agent/manual override behavior, settings permissions and stale locking, strict payloads, atomic audit snapshots, both offline modes, mobile-only guest tickets, idempotent retry, conversion constraints, and service-only execution. Pure validation rejects overlapping hours and conflicting offline settings. The built settings GET and PUT routes return HTTP 401 without Auth.
- **NOT VERIFIED:** Real Supabase migration/grants, authenticated browser settings, live timezone and daylight-saving boundaries, remote lease/status refresh, remote ticket intake, private Realtime refresh, device rendering, or accessibility. Nine chat migrations remain local; chat settings stay off and anonymous Auth stays disabled remotely.

## Known issues and decisions

- Manual online is an override of business hours, not agent presence: at least one active staff member with support view/reply access must still hold a current online lease. Disabled and manual-offline states always win.
- Offline ticket mode retains the chat and first message, then links one system-created support ticket in the same transaction. This preserves the guest's only authenticated conversation channel and the canonical transcript/attachments. A retry cannot create a second ticket or change the original intake outcome.
- The existing four-second default cooldown is editable and already enforced in the database. Phase 11 should extend broader rate limiting and anti-spam without moving those protections into the UI alone. Automatic assignment and sound settings are not exposed because neither behavior is implemented. Durable unread state remains core behavior, and no retention policy exists. The existing default timezone remains `Africa/Cairo` until an administrator changes it.

## Exact next action — Phase 11, only after “Continue with Phase 11”

Re-read the Phase 11 rate-limiting and anti-spam requirements in the master specification and this handoff. Implement only the remaining abuse controls around the existing database cooldown, actor limits, bounded payloads, and guest identity model; validate locally, update both state files, and stop before Phase 12. Do not begin responsive/accessibility polish, the Phase 13 security/concurrency/performance audit, staging, remote migrations, anonymous Auth changes, or deployment as incidental work.

---

# Previous handoff — Live Chat Phase 9

Date: 2026-09-21. State: **PHASE 9 COMPLETE LOCALLY — awaiting explicit instruction for Phase 10. No remote change.**

## Completed in Phase 9

- Added local additive migration `supabase/migrations/20260921140000_live_chat_ticket_conversion.sql`. Its service-only, row-locked conversion function verifies reply/management authority and expected revision, creates one existing support ticket, preserves verified customer/order and real email/mobile contact, links the chat once, assigns the chat assignee or converting manager when unassigned, and writes actor-attributed audit rows on both records. Mobile-only guest tickets are supported without invented email addresses. All eight chat migrations remain unapplied remotely.
- Kept the transcript and chat files in their canonical chat records and private bucket. Converted tickets expose an authorized source-chat relation and staff deep link instead of copying the transcript or attachments into uncontrolled support records. The ticket has no synthetic opening message. Conversion does not close the chat, and the copied order relationship is locked against later chat-side changes.
- Added the staff **Create support ticket** action, conflict handling, linked-ticket state, source-chat display in staff/account ticket views, exact-chat deep linking, email/mobile ticket search and display, and readable ticket audit actors. No Phase 10 settings/business-hours/offline work, remote migration, Auth setting change, staging action, or deployment was performed.

## Files changed in Phase 9

- Migration: `supabase/migrations/20260921140000_live_chat_ticket_conversion.sql` (**new; local only**).
- Server: new staff conversion route; chat event projection/error mapping; ticket source-chat loader; staff/customer ticket detail responses; ticket contact search and projections.
- Application: staff Live Chat conversion and source-ticket UI, source-chat panels in staff/customer tickets, post-conversion order controls, and ticket audit descriptions.
- Tests: `tests/live-chat-ticket-conversion.test.mjs` (**new**). Documentation: `PROJECT_STATE.md`, `CODEX_HANDOFF.md`.

## Checks and verified behavior

- `node --test tests/*.test.mjs`: **123 passed, 0 failed**. `npm run typecheck`: passed. `npm run build`: passed. `git diff --check`: passed. No lint script exists.
- PGlite verifies customer/order/contact relationships, mobile-only guest tickets, preserved transcript/files, one-ticket retries, stale revisions, assignment/permission boundaries, service-only RPC access, actor snapshots, both audit trails, and immutable copied order links. The built conversion and affected ticket-detail routes return HTTP 401 without Auth.
- **NOT VERIFIED:** Real Supabase migration/grants, authenticated browser conversion, source-chat file downloads, live Realtime reconciliation, concurrent live-Postgres conversion, responsive layout, or guest follow-up procedures. Eight chat migrations remain local; chat settings stay off and anonymous Auth stays disabled.

## Known issues and decisions

- The chat is the sole transcript/file record; the ticket points to it. Deleting or resetting chat data would remove that context, so staging must test the existing reset manifest and retention expectations before production.
- Conversion leaves the chat status unchanged. This preserves a guest's only authenticated conversation channel because guest tickets have no customer-account access. Staff should keep guest follow-up in Live Chat or use the captured contact channel until later product behavior is explicitly approved.
- A converted ticket has no duplicated opening message or category by default. Staff can reply or add notes through the existing ticket workflow, and account customers can see the source relationship. The order copied at conversion is thereafter managed on the ticket.

## Exact next action — Phase 10, only after “Continue with Phase 10”

Re-read the Phase 10 dashboard-settings, business-hours, offline-behavior, and audit requirements in the master specification and this handoff. Implement only those settings on the existing singleton and availability model, validate locally, update both state files, and stop before Phase 11. Do not expand anti-spam/rate limiting, begin responsive/accessibility polish or the security audit, apply migrations remotely, enable anonymous Auth, or deploy as an incidental step.

---

# Codex handoff — Live Chat Phase 8

Date: 2026-09-21. State: **PHASE 8 COMPLETE LOCALLY — awaiting explicit instruction for Phase 9. No remote change.**

## Completed in Phase 8

- Added local additive migration `supabase/migrations/20260921130000_live_chat_attachments.sql`. It adds hashed reserved/ready attachment records, service-only reservation/completion RPCs, row-locked per-message counts, saved-policy enforcement, attachment attempt limiting, retry conflict checks, and private ID-only Realtime signals. Internal-note attachments signal staff only. All seven chat migrations remain unapplied remotely.
- Added bounded multipart parsing with a streaming request cap, matching MIME/extension/file-signature checks for JPEG/PNG/WebP/PDF, configured size/count enforcement, generated private paths, upload rollback, and one-hour stale reservation cleanup. Authorized download routes recheck conversation ownership and internal visibility, verify stored size/hash, force downloads, and expose no public URL.
- Added configured multi-file selection, upload feedback, transcript file controls, and private downloads to the customer launcher and staff inbox. Attachments remain related to their permanent message; failed files do not erase the saved message. No Phase 9 ticket conversion, remote migration, Auth setting change, staging action, or deployment was performed.

## Files changed in Phase 8

- Migration: `supabase/migrations/20260921130000_live_chat_attachments.sql` (**new; local only**).
- Server: `server/utils/liveChat.js`, `server/utils/chatAttachmentValidation.js` and `server/utils/liveChatAttachments.js` (**new**); customer/staff attachment upload and download routes; chat detail/message/status projections.
- Application: `app/components/live-chat/Launcher.vue`, `app/pages/dashboard/live-chat.vue`, `app/composables/useLiveChatClient.js`, `app/composables/useSupportClient.js`.
- Tests: `tests/live-chat-transactions.test.mjs`, `tests/live-chat-attachments.test.mjs` (**new**). Documentation: `PROJECT_STATE.md`, `CODEX_HANDOFF.md`.

## Checks and verified behavior

- `node --test tests/*.test.mjs`: **120 passed, 0 failed**. `npm run typecheck`: passed. `npm run build`: passed. `git diff --check`: passed. No lint script exists.
- PGlite verifies ownership, active assignment, internal-note isolation, settings, row-locked count, idempotent reservation, hash conflicts, closed-chat rejection, staff/public Realtime topics, service-role execution, and browser-role RPC denial. Pure tests verify multipart parsing and reject mismatched MIME, extension, signature, and size. All four built-server attachment routes return HTTP 401 without Auth.
- **NOT VERIFIED:** Real private Supabase Storage behavior and bucket metadata, authenticated uploads/downloads, production proxy body limits, concurrent object retries, Realtime delivery, device file selection, or layout on actual devices. Malware scanning is not included. Seven chat migrations remain local; chat settings stay off and anonymous Auth stays disabled.

## Known issues and decisions

- V1 accepts only JPEG, PNG, WebP, and PDF and always forces downloads as opaque content. Type, extension, magic bytes, configured size, count, ownership, and SHA-256 integrity are checked. These checks do not replace enterprise malware scanning.
- A message commits before its selected files upload. A later file failure is reported as partial success and never duplicates or removes the message. Normal failures roll back the private object/reservation. A hard process crash can leave a hidden incomplete reservation/object; a later upload cleans incomplete entries older than one hour.
- Attachment completion signals are private and contain only conversation, message, and attachment IDs. Attachments do not create a second unread message. The saved parent message remains the unread unit, and an open thread refreshes when the completion signal arrives.

## Exact next action — Phase 9, only after “Continue with Phase 9”

Re-read the Phase 9 chat-to-ticket requirements in the master specification and this handoff. Add only safe conversion into the existing ticket architecture, preserving customer/order/chat/attachment relationships and audit actor; validate locally, update both state files, and stop before Phase 10. Do not apply migrations remotely, enable anonymous Auth, or deploy as an incidental step.

---

# Previous handoff — Live Chat Phase 7

Date: 2026-09-21. State: **PHASE 7 COMPLETE LOCALLY — awaiting explicit instruction for Phase 8. No remote change.**

## Completed in Phase 7

- Added local additive migration `supabase/migrations/20260921120000_live_chat_customer_orders.sql`. Its service-only, row-locked RPCs link or unlink only orders belonging to the conversation's verified account and explicitly associate a guest conversation with an account only when both Auth sessions are verified. Mutations require the expected revision, preserve the transcript, and write `order_linked`, `order_unlinked`, or `identified` audit events. All six chat migrations remain unapplied remotely.
- Added bounded staff context for account profile, recent/open/related order, related product names, support tickets, and previous chats. Guest context uses only the guest Auth ID. Captured chat contact is visibly separate from account profile data. Added exact owned-order reference lookup, inbox filters by account ID and order UUID/reference, customer and staff order controls, order audit descriptions, and a customer prompt to move a guest chat after login. No typed email/mobile matching is used.
- No Phase 8 attachments, Phase 9 ticket conversion, remote migration, Auth setting change, staging action, or deployment was performed.

## Files changed in Phase 7

- Migration: `supabase/migrations/20260921120000_live_chat_customer_orders.sql` (**new; local only**).
- Server: `server/utils/liveChat.js`, `server/utils/liveChatContext.js` (**new**); order, context, and identify routes under `server/api/chat` and `server/api/admin-chat`.
- Application: `app/components/live-chat/Launcher.vue`, `app/pages/dashboard/live-chat.vue`, `app/utils/liveChat.js`.
- Tests: `tests/live-chat-transactions.test.mjs`. Documentation: `PROJECT_STATE.md`, `CODEX_HANDOFF.md`.

## Checks and verified behavior

- `node --test tests/*.test.mjs`: **116 passed, 0 failed**. `npm run typecheck`: passed. `npm run build`: passed. `git diff --check`: passed. No lint script exists.
- PGlite verifies customer B and guest cannot link customer A's order, unauthorized staff cannot link, stale revisions cannot overwrite an order, link/unlink events retain prior/new order IDs, service-role RPC execution works, and a guest chat moves only with the correct guest and customer identities when the account has no other open chat. Browser roles cannot execute either new RPC. All five new built-server routes return HTTP 401 without Auth.
- **NOT VERIFIED:** Authenticated HTTP/browser paths, real Supabase migration and grants, live order-reference search, Realtime subscription revocation after guest transfer, cross-device identity transfer, or the visual layout on actual devices. Six chat migrations remain local; chat settings stay off and anonymous Auth stays disabled.

## Known issues and decisions

- Existing account and open guest conversations are not merged. The transfer reports a conflict until the account's open conversation is closed. Closed guest conversations can be associated afterward. Guest history is offered one conversation at a time from the existing 20-row customer history response.
- Order list defaults to the latest 20 owned orders; exact reference search finds an older order. Staff context caps recent/open orders, tickets, and previous chats at eight each and related products at 20. The staff activity view shows short order IDs from durable audit values; no order fields are duplicated in chat.
- The existing staff context panel is compact and text-heavy on narrow screens; Phase 12 remains the designated responsive/accessibility polish. Staging must verify the permission boundary, current order statuses, order lookup, account transfer, and live channel behavior before rollout.

## Exact next action — Phase 8, only after “Continue with Phase 8”

Re-read the Phase 8 attachment and storage requirements in the master specification and this handoff. Add only private, validated chat attachments on the existing identities and transcript model; validate locally, update both state files, and stop before Phase 9. Do not apply migrations remotely, enable anonymous Auth, or deploy as an incidental step.

---

# Previous handoff — Live Chat Phase 6

Date: 2026-09-21. State: **PHASE 6 COMPLETE LOCALLY — awaiting explicit instruction for Phase 7. No remote change.**

## Completed in Phase 6

- Added local additive migration `supabase/migrations/20260921110000_live_chat_read_presence.sql`. Its service-only functions provide authorized incoming-message read markers, bounded unread summaries, reply-agent availability leases, and shared typing rate limits. All five chat migrations remain unapplied remotely.
- Added scoped customer/staff read routes, staff availability routes, and customer/staff typing routes. List/detail APIs now include each verified actor's unread summary. Typing is relayed by the server to private Realtime channels through REST; browser roles received no Broadcast write policy.
- Added durable unread badges and visible-bottom read behavior to the customer panel and staff inbox. The inbox also shows the waiting-conversation count across views. Existing guest sessions may restore their badge after refresh without anonymous sign-in; a new visitor still opens no guest client or Realtime channel on page load. Staff choose online/away/offline, and online leases renew only while the support page is visible.
- Added expiring, throttled typing indicators and improved customer cursor catch-up after reconnect. No Phase 7 order/customer integration, remote migration, Auth setting change, staging action, or deployment was performed.

## Files changed in Phase 6

- Migration: `supabase/migrations/20260921110000_live_chat_read_presence.sql` (**new; local only**).
- Server: `server/utils/liveChat.js`, `server/utils/liveChatTyping.js` (**new**); list/detail/read/typing routes under `server/api/chat/conversations` and `server/api/admin-chat/conversations`; `server/api/admin-chat/availability.get.js` and `.post.js` (**new**).
- Application: `app/components/live-chat/Launcher.vue`, `app/pages/dashboard/live-chat.vue`, `app/composables/useLiveChatClient.js`.
- Tests: `tests/live-chat-transactions.test.mjs`. Documentation: `PROJECT_STATE.md`, `CODEX_HANDOFF.md`.

## Checks and verified behavior

- `node --test tests/*.test.mjs`: **114 passed, 0 failed**. `npm run typecheck`: passed. `npm run build`: passed. `git diff --check`: passed. The locally built server returned HTTP 401 for unauthenticated customer/staff read and typing POST routes and staff availability. No lint script exists.
- New PGlite tests verify that customer B cannot mark customer A's chat read, customer markers reject own messages and internal notes, two-tab stale markers cannot move backward, unread counts include only incoming visible messages, availability requires reply access and expires without heartbeat, and typing requests hit a shared rate limit without storing typing state. Existing browser-role RPC denial remains green.
- **NOT VERIFIED:** Supabase REST Broadcast/private-channel behavior, authenticated HTTP and browser flows, real multi-tab/read races, device behavior, live websocket reconnect, or production quota impact. The five chat migrations are local only; chat settings remain off and anonymous Auth remains disabled.

## Known issues and decisions

- The staff inbox displays unread counts for the current 50-row page; it does not yet offer a global unread filter or total. Signed-in and returning guest customers can restore a badge after refresh; a guest without a stored session cannot have saved unread chat. Other open tabs reconcile when they regain focus or receive another message signal.
- Agent availability uses a 90-second lease renewed every 45 seconds while the support page is visible. If the page closes or sleeps, the lease expires; it is not a permanent presence record. Status UI and private typing relay still need isolated staging verification.
- Typing travels through a scoped server route and short shared rate counter. No keystrokes or permanent typing rows are stored. The server uses Supabase's documented `channel.httpSend()` REST transport, available in the installed client version, so it does not open a new server WebSocket for each signal. See [Supabase Broadcast documentation](https://supabase.com/docs/guides/realtime/broadcast).

## Exact next action — Phase 7, only after “Continue with Phase 7”

Re-read the Phase 7 customer/order integration requirements in the master specification and this handoff. Add only verified customer context and safe owned-order linking on the existing chat identities and audit model; validate locally, update both state files, and stop before Phase 8. Do not apply migrations remotely, enable anonymous Auth, or deploy as an incidental step.

---

# Previous handoff — Live Chat Phase 5

Date: 2026-09-21. State: **PHASE 5 COMPLETE LOCALLY — awaiting explicit instruction for Phase 6. No remote change.**

## Completed in Phase 5

- Added local additive migration `supabase/migrations/20260921100000_live_chat_assignment_audit.sql`. It adds manager assignment of waiting conversations to eligible agents, preserves row-lock/revision conflict handling, rejects inactive or reply-ineligible targets, and captures immutable actor and assignee name snapshots in workflow events. It is not applied remotely.
- Fixed the transition RPC's service-role execution by making it a restricted `SECURITY DEFINER` function with an empty search path. The staff API continues to derive the actor from verified Supabase Auth, and browser roles still cannot execute the RPC. The event snapshot trigger covers assignment, transfer, closure, and public reply records.
- Added `assign` to the staff transition API and inbox for `support.manage` plus `support.reply`. Extended the activity API to cursor-page saved audit events, returning only safe event fields and saved names. The inbox loads older activity and shows who acted, source/destination for transfers, and when each action occurred. Existing ID-only signals refresh another agent's viewed conversation.
- No Phase 6 read markers, presence/availability writer, typing, remote migration, Auth setting change, staging action, or deployment was performed.

## Files changed in Phase 5

- Migration: `supabase/migrations/20260921100000_live_chat_assignment_audit.sql` (**new; local only**).
- Server: `server/api/admin-chat/conversations/[id]/transition.post.js`, `server/api/admin-chat/conversations/[id]/events.get.js`, `server/utils/liveChat.js`.
- Application: `app/pages/dashboard/live-chat.vue`, `app/utils/liveChat.js`.
- Tests: `tests/live-chat-transactions.test.mjs`, `tests/live-chat-customer-ui.test.mjs`.
- Documentation: `PROJECT_STATE.md`, `CODEX_HANDOFF.md`.

## Checks and verified behavior

- `node --test tests/*.test.mjs`: **111 passed, 0 failed**. `npm run typecheck`: passed. `npm run build`: passed. `git diff --check`: passed. No lint script exists.
- New PGlite tests verify a manager assigns one eligible agent while a stale second claim loses; a viewer and reply-only staff cannot assign; an ineligible target and disabled transfer fail; service-role assignment, transfer, public reply, and closure work; and saved audit names survive later staff renaming and deletion. A 66-event history test verifies stable keyset paging when timestamps tie. Existing browser-role RPC denial remains green.
- **NOT VERIFIED:** Real Supabase migration/grants, authenticated staff HTTP/browser paths, actual concurrent agent sessions and private Realtime delivery, PostgREST cursor filtering, or mobile/accessibility behavior. All four chat migrations remain local and chat settings stay off.

## Known issues and decisions

- Older audit rows are backfilled from staff records present when the migration runs. If a staff account was already deleted, its former display name cannot be reconstructed; all new events save a name snapshot before later rename or deletion.
- Assignment remains manual. Automatic routing is a later settings/routing decision; Phase 5 adds manager assignment to the existing claim and transfer flow. `support.manage` alone does not grant a chat transition without `support.reply`, matching the existing RPC and inbox permissions.
- The current staff client re-fetches state from ID-only signals. Staging should exercise Agent A/Agent B/Admin competing claims, manager assignment, transfer while another agent views the chat, event paging, and permissions before any rollout.

## Exact next action — Phase 6, only after “Continue with Phase 6”

Re-read the Phase 6 read/unread, presence, typing, and reconnect requirements in the master specification and this handoff. Implement only those capabilities on the existing chat identities, private topics, and durable sequence cursors; validate locally, update both state files, and stop before Phase 7. Do not apply migrations remotely, enable anonymous Auth, or deploy as an incidental step.

---

# Previous handoff — Live Chat Phase 4

Date: 2026-09-21. State: **PHASE 4 COMPLETE LOCALLY — awaiting explicit instruction for Phase 5. No remote change.**

## Completed in Phase 4

- Integrated a native `/dashboard/live-chat` inbox into Customer Support navigation, using existing `support.view`, `support.reply`, and `support.manage` checks. Added six queue views, server paging and filters, selected transcript with older-message paging, internal-note composer, captured contact context, and a bounded activity list.
- Wired claim, transfer, close, and reopen controls to the existing row-locked RPC with expected revisions. On a 409 conflict, the UI shows the server message and refreshes the selected conversation and queue. Only the current assignee can reply. Staff send retries reuse the submission key while the draft stays unchanged.
- Subscribed the mounted inbox to one private ID-only topic and the selected conversation to one staff-only topic. Reconciliation fetches authorized APIs on signal, subscribe, focus, and network return; no body-bearing staff-wide payload or every-thread channel was added. Navigation changes and unmount remove subscriptions.
- No Phase 5 routing/audit expansion, remote migrations, Auth setting change, staging action, or deployment was performed.

## Files changed in Phase 4

- Application: `app/pages/dashboard/live-chat.vue` (**new**), `app/pages/dashboard/support/index.vue`, `app/utils/dashboardNavigation.js`, `app/utils/adminPermissions.js`.
- Server: `server/api/admin-chat/conversations/index.get.js`, `server/api/admin-chat/conversations/[id]/events.get.js` (**new**).
- Tests: `tests/dashboard-navigation.test.mjs`. Documentation: `PROJECT_STATE.md`, `CODEX_HANDOFF.md`.

## Checks and verified behavior

- `node --test tests/*.test.mjs`: **107 passed, 0 failed**. `npm run typecheck`: passed. `npm run build`: passed. `git diff --check`: passed. No lint script exists.
- The locally built server returned HTTP 401 for unauthenticated staff inbox and activity routes, and HTTP 302 for the protected dashboard page. The new route's permission requirement and support submenu passed the navigation test.
- **NOT VERIFIED:** Real authenticated staff UI, private Realtime delivery/reconnect, multi-agent browser race feedback, device layout/accessibility, or linked-project policies. All three chat migrations are local/unapplied; chat settings remain off and anonymous Auth remains disabled. Current PGlite tests verify the underlying workflow transactions and internal-note signals, not the complete browser path.

## Known issues and decisions

- Contact, reference, linked order ID, and agent filters use bounded server queries. Durable unread filters and read markers belong to the later read/unread phase. This UI shows only captured contact and an order ID; deeper customer/order/ticket context stays in its later phase.
- The activity list shows the latest 30 event labels and actor identities. The full audit rows remain in `chat_events`; deeper audit/assignment management is Phase 5. No event JSON values or message bodies are returned by the activity route.
- Realtime errors show a reconnecting state; API refetch on return/subscription provides catch-up. A live Supabase staging test remains necessary before enabling chat. With no agent availability lease writer, customer intake remains offline when chat is eventually enabled until a later phase supplies leases.

## Exact next action — Phase 5, only after “Continue with Phase 5”

Re-read the Phase 5 assignment, transfer, and audit requirements in the master specification and this handoff. Build only the remaining Phase 5 routing/assignment and historical audit capabilities on the existing transaction foundation, validate locally, update both state files, and stop before Phase 6. Do not apply migrations remotely, change anonymous Auth settings, or deploy as an incidental step.

---

# Previous handoff — Live Chat Phase 3

Date: 2026-09-21. State: **PHASE 3 COMPLETE LOCALLY — awaiting explicit instruction for Phase 4. No remote change.**

## Completed in Phase 3

- Added local additive migration `supabase/migrations/20260920170000_live_chat_customer_intake.sql`: shared availability function, saved live/offline intake trigger, atomic first-conversation/message RPC, and narrow definer privileges for chat Auth-schema checks. It is not applied remotely. Phase 1 and 2 chat migrations also remain local.
- Added public `/api/chat/status`, scoped `/api/chat/me`, and optional atomic first-message handling in the create route. Availability remains false without an authorized agent's current online lease; settings default disabled.
- Added a client-only Live Support launcher and responsive customer panel to the storefront's default layout. Guests use a separately persisted Supabase Auth client and sign in anonymously only when they submit. Signed-in customers reuse existing Auth and contact data. The panel supports guest details, a conditional missing-mobile field, offline messaging, owned resume/history, cursor paging, idempotent sends, cooldown display, private conversation subscription, API reconciliation, and a session-local reply badge. It renders plain text, not message HTML.
- No staff inbox UI, anonymous Auth remote setting change, remote migration, staging action, or deployment was performed.

## Files changed in Phase 3

- Migration: `supabase/migrations/20260920170000_live_chat_customer_intake.sql` (**new; local only**).
- Server: `server/api/chat/status.get.js`, `server/api/chat/me.get.js` (**new**), `server/api/chat/conversations/index.post.js`.
- Application: `app/components/live-chat/Launcher.vue`, `app/composables/useLiveChatClient.js`, `app/utils/liveChat.js` (**new**), `app/layouts/default.vue`; `package.json` and `package-lock.json` now declare the direct `@supabase/supabase-js` dependency.
- Tests: `tests/live-chat-customer-ui.test.mjs` (**new**), `tests/live-chat-transactions.test.mjs`.
- Documentation: `PROJECT_STATE.md`, `CODEX_HANDOFF.md`. `AGENTS.md` unchanged.

## Checks and verified behavior

- `node --test tests/*.test.mjs`: **107 passed, 0 failed**. New tests cover offline/online intake based on agent lease and override, atomic first-message failure/retry, a service-role write without direct Auth-schema access, message reconciliation deduplication/order, contact requirements, and cooldown calculations.
- `npm run typecheck`: passed. `npm run build`: passed. `git diff --check`: passed. The locally built storefront returned HTTP 200, while unauthenticated `/api/chat/me` and `/api/chat/conversations` returned HTTP 401. No lint script exists.
- **VERIFIED locally:** The third migration loads in PGlite and produces offline intake with no eligible lease. A failed first message rolls back the conversation, while retrying saved keys returns the same rows. The service-role path works while its `auth` schema grant remains absent. The customer component and routes compile. Browser code does not instantiate a guest Auth client or a Realtime channel on initial page load.
- **NOT VERIFIED:** Real anonymous Auth, authenticated customer/guest HTTP requests, actual private Realtime subscription and reconnect, browser/mobile rendering, software keyboard, full assistive-technology behavior, live Storage/RLS state, and actual linked-project business-hours behavior. No remote migration or deployment occurred.

## Known issues and decisions

- Chat settings default off, and anonymous Auth is disabled in the linked project. The launcher will stay hidden against current production state. Do not enable Auth or apply migrations outside the later staged phase. Guest sign-in may also require project CAPTCHA configuration; test in isolated staging.
- No agent availability lease writer exists yet, so enabled chat will honestly present an offline message until a later staff/availability phase supplies online leases. `chat_live_available()` enforces current lease plus hours/override; Phase 4 staff UI should show the state clearly.
- Customer Realtime signals contain IDs only; the panel re-fetches through scoped APIs. Realtime membership/delivery and the session-local reply badge need browser testing. Durable read/unread markers, typing/presence, guest-to-account linking, order context, attachments, ticket conversion, settings UI, and full responsive/accessibility review remain later phases.
- The panel never links a guest conversation to a permanent account based on contact text. When the main Auth identity changes, it reloads that actor's scoped history. Guest sessions remain isolated under their own storage key.

## Exact next action — Phase 4, only after “Continue with Phase 4”

Re-read the Phase 4 support/admin requirements and current handoff. Build the staff Live Chat inbox in the existing dashboard using `support.view`, `support.reply`, and `support.manage`; show a paged waiting/active/closed queue, scoped transcript and internal notes, customer contact context without unrelated order data, and claim/transfer/close/reopen actions with expected revisions and clear conflict feedback. Reconcile inbox and the viewed conversation from private ID-only signals without subscribing every staff browser to all message bodies. Validate locally, update state/handoff, and stop before Phase 5. Do not deploy or apply chat migrations remotely in Phase 4.

---

# Previous handoff — Live Chat Phase 2

Date: 2026-09-20. State: **PHASE 2 COMPLETE LOCALLY — awaiting explicit instruction for Phase 3. No remote change.**

## Completed in Phase 2

- Added local additive migration `supabase/migrations/20260920160000_live_chat_transactions.sql`. It creates service-only create/resume, send, limit, and staff-transition functions; row-lock/revision concurrency checks; durable workflow events; and private, committed ID-only Broadcast signals. The Phase 1 migration remains local too.
- Added `server/utils/liveChat.js` and customer/guest `server/api/chat` plus staff `server/api/admin-chat` routes. Actors are verified through Supabase Auth and existing customer/admin records. APIs scope projections and cursor-paged message reads, cap request bodies, validate contacts and UUIDs, and leave service credentials on the server.
- Added focused transaction tests and a local Realtime stub; adjusted the Phase 1 topic test to distinguish database-generated signals from its manually inserted test row. No UI, anonymous Auth setting change, remote migration, or deployment was made.

## Files changed in Phase 2

- Migration: `supabase/migrations/20260920160000_live_chat_transactions.sql` (**new; not remotely applied**).
- Server: `server/utils/liveChat.js` (**new**); ten route files under `server/api/chat/conversations` and `server/api/admin-chat/conversations` (**new**).
- Tests: `tests/live-chat-transactions.test.mjs` (**new**), `tests/live-chat-foundation.test.mjs`, `tests/helpers/resetDatabase.mjs`.
- Documentation: `PROJECT_STATE.md`, `CODEX_HANDOFF.md`. `AGENTS.md` unchanged.

## Checks and verified behavior

- `node --test tests/*.test.mjs`: **102 passed, 0 failed**. Transaction tests cover identity/order checks even on resume, open-chat and key retries, cooldown, twelve-message minute limit, staff permission/assignment, stale claim, transfer, close/reopen, public versus internal Broadcast signals, and browser-role RPC denial.
- `npm run typecheck`: passed. `npm run build`: passed. `git diff --check`: passed. No lint script exists. The locally built Nitro server returned HTTP 401 for unauthenticated customer/staff list and detail routes.
- **VERIFIED locally:** PGlite loads both chat migrations. Scoped database writes are atomic in isolated tests; no internal-note customer signal or body-bearing Broadcast payload is generated. Customer/staff route imports compile and the unauthenticated boundary responds correctly.
- **NOT VERIFIED:** Real Supabase Realtime channels/`realtime.send`, remote grants/policies/Auth shape, live authenticated/anonymous HTTP flows, true parallel database connections, cross-node behavior, production proxy IP identity, or any customer UI. PGlite stubs Auth and Realtime. No migration was remotely applied.

## Known issues and decisions

- Anonymous Auth remains disabled; Phase 3's guest client cannot work against the linked project yet. Enable it only after a staging policy/API audit and a deliberate setting change. Guest contact values are unverified and confer no order access.
- Shared actor limits are five new conversations/hour and twelve customer/guest messages/minute, plus the saved configurable cooldown and a 15-second identical-body check. New anonymous sessions can change actor ID and bypass these actor-only counters. Do not claim complete guest abuse protection; add trusted proxy/network controls and load testing before production.
- Settings remain disabled by default. Availability/business hours and offline intake are later work. Client Realtime subscriptions/reconciliation do not exist yet. The Phase 2 trigger uses private `realtime.send`; verify the linked project's function and private channel policies in isolated staging before rollout. No attachments are accepted through chat APIs yet.
- `chat_events` captures current create/claim/transfer/close/reopen and public staff reply operations. Later phases will add controlled identity, order, and ticket events. Internal notes remain staff-only in APIs and signals.

## Exact next action — Phase 3, only after “Continue with Phase 3”

Re-read the Phase 3 and customer UX portions of the master specification. Build the floating customer launcher and responsive panel using the new scoped APIs; create a separate anonymous guest Supabase client/session only on chat start; support contact intake, signed-in prefill, safe resume/history, offline intake messaging, customer message composer cooldown, and API-based transcript reconciliation. Do not build the staff inbox UI or start a remote migration/deployment in Phase 3. Validate the customer flows locally, update state/handoff, and stop before Phase 4.

---

# Previous handoff — Live Chat Phase 1

Date: 2026-09-20. State: **PHASE 1 COMPLETE LOCALLY — awaiting explicit instruction for Phase 2. No remote change.**

## Completed in Phase 1

- Created additive local migration `supabase/migrations/20260920150000_live_chat_foundation.sql`: eight private chat tables, defaults/constraints/indexes, private chat Storage bucket metadata, customer/guest identity compatibility, conversation/message guards, private Realtime topic read authorization, and system reset integration. The migration has not been pushed or applied outside isolated PGlite tests.
- Hardened the existing customer boundary: `server/utils/customerRequest.js` requires an active permanent profile, and `app/middleware/customer-auth.ts` rejects missing/inactive/anonymous profiles. The migration skips customer profile creation for anonymous Auth users and denies their browser profile writes. Anonymous sign-ins remain disabled locally and remotely unchanged.
- Updated reset allowlists and private-file cleanup. Added focused security/schema tests and expanded reset tests. No chat API, claim/send RPC, Broadcast trigger, UI, remote Supabase setting, or VPS deployment was added.
- Static authenticated-role audit found the customer-profile path above; existing order and order-message reads are owner scoped, support ticket tables/RPCs deny browser roles, and admin operations use active staff permissions. The public `site_settings` table was not reused for private chat controls. This audit does not replace a live Supabase policy check.

## Files changed

- Migration: `supabase/migrations/20260920150000_live_chat_foundation.sql` (**new; not remotely applied**).
- Application/server: `app/middleware/customer-auth.ts`, `server/utils/customerRequest.js`, `server/utils/systemReset.js`, `server/utils/systemResetScopes.js`.
- Tests: `tests/live-chat-foundation.test.mjs` (**new**), `tests/helpers/resetDatabase.mjs`, `tests/system-reset-database.test.mjs`, `tests/system-reset.test.mjs`.
- Documentation: `PROJECT_STATE.md`, `CODEX_HANDOFF.md`. `AGENTS.md` was unchanged.

## Checks and verified behavior

- `node --test tests/*.test.mjs`: **96 passed, 0 failed**. New tests cover private-table denial, anonymous profile forgery, private topic access by customer/guest/staff, disabled staff, owned order/ticket linkage, open-conversation uniqueness, sender/visibility/idempotency constraints, private bucket metadata, and reset preservation/cleanup.
- `npm run typecheck`: passed. `npm run build`: passed with existing non-blocking sourcemap warnings. `git diff --check`: passed. No lint script is configured.
- **VERIFIED locally:** The migration loads in the isolated PGlite database and leaves chat disabled. Customer/guest identity and RLS rules, direct browser-role denial, reset allowlist/manifest, and database constraints behave as tested. The customer account middleware and server helper compile and build.
- **NOT VERIFIED:** Actual Supabase Realtime channel joins/policies, remote Auth setting or `auth.users` shape, live private Storage policies, guest sign-in, authenticated browser flows, quota, true concurrent agent claims, cooldown/rate-limit enforcement, and any chat UI/API. PGlite stubs Auth/Realtime infrastructure; staging must verify the real services. Existing support Storage manual acceptance is also still outstanding.

## Known issues and decisions

- Enabling anonymous Auth is project-wide because anonymous users receive the `authenticated` role. It remains disabled. Inspect actual remote grants/policies and Auth configuration before enabling it in a disposable staging project. The migration expects `auth.users.is_anonymous` and `realtime.messages`/`realtime.topic()`, matching current Supabase documentation; verify the target project before application.
- Private Realtime authorization is checked on join/token refresh, and other remote permissive policies could broaden access. The Phase 1 policy alone cannot establish current remote isolation. No customer-sensitive bodies should be broadcast in Phase 2.
- The database schema prepares cooldown, rates, audit, reads, and assignment, but their transactional operations are not yet implemented. The provisional business timezone is `Africa/Cairo` and hours are Sunday–Thursday 09:00–18:00; confirm before staging. The chat setting defaults to off.

## Exact next action — Phase 2, only after “Continue with Phase 2”

Re-read Phase 2 requirements and the current repository/handoff. Build actor authentication for permanent customer, separate anonymous guest, and authorized staff; create scoped chat APIs and service-only transaction RPCs for create/resume, send, claim/transfer/close; enforce 4-second default cooldown and shared abuse limits; emit only committed private Broadcast signals; write focused ownership, idempotency, race, and reconnect-oriented tests. Do not begin customer launcher or inbox UI, enable anonymous Auth remotely, apply this migration remotely, or deploy. Run the suite/typecheck/build/diff checks, update state/handoff, and stop before Phase 3.

---

# Previous handoff — Live Chat Phase 0

Date: 2026-09-20. State: **PHASE 0 COMPLETE — inspection and architecture only. Awaiting explicit instruction to continue with Phase 1.**

## Phase 0 result

- Read the complete 1,256-line Live Chat master specification and inspected Nuxt configuration, layouts, customer and staff auth, profile/order schema, ticket/Help Center/Messages/CRM flows, settings, Storage, Realtime usage, RLS, server routes, tests, reset integration, `AGENTS.md`, and prior project/handoff state. `git status --porcelain` was empty before this documentation update.
- The proposed architecture, reuse map, database tables, private Realtime topics, authorization model, guest identity, assignment/read models, cooldown and abuse limits, attachments, ticket/order integration, availability, quota considerations, risks, decisions, and final phases are recorded at the top of `PROJECT_STATE.md`.
- No chat feature code, SQL migration, external setting, remote database action, or deployment was created/performed. The only Phase 0 files changed are `PROJECT_STATE.md` and `CODEX_HANDOFF.md`.
- Validation: repository inspection, official Supabase documentation review, and `git diff --check` passed. No test, typecheck, or build run was needed for a documentation-only phase. Existing test results later in this file describe earlier releases, not Phase 0 validation.
- **Verified:** existing ticket and order systems, support permission keys, service-role API pattern, private ticket bucket, public `site_settings` rows, no existing chat Realtime subscriptions, anonymous Auth disabled in local config, and email-required customer-profile trigger.
- **Not verified:** current remote Auth/Realtime settings, Storage policies, Supabase plan/quota, manual authenticated flows, proposed anonymous-Auth compatibility, new RLS policies, and any Live Chat behavior.
- **Known decision:** anonymous Auth is the preferred guest identity for private Realtime. Enabling it is project-wide and requires a full `authenticated` policy/API audit and explicit review before staging or production changes. Confirm operating timezone/hours, offline default, and retention before their staging rollout. The proposal defaults chat disabled, manual assignment, offline conversations, and a 4-second customer send delay.

## Exact next action — Phase 1, only after the user says “Continue with Phase 1”

1. Re-read the Phase 1 and security requirements in the attached master specification; inspect current `git status`, this handoff, and the Live Chat section of `PROJECT_STATE.md`.
2. Audit existing authenticated-role RLS/grants and customer APIs for anonymous-user exposure. Draft local additive migrations for the proposed chat schema, validated default settings, RLS and private topic authorization, guest profile-trigger compatibility, indexes and reset integration. Do not enable anonymous sign-ins remotely or apply any migration to production.
3. Add focused isolated database tests for defaults, grants/RLS, topic membership, identity boundaries, constraints, assignment concurrency foundations, and reset behavior. Run relevant tests, Nuxt typecheck/build if application code changes, and `git diff --check`. Update state/handoff with exact results and stop before Phase 2.

---

# Previous handoff — Help Center and customer support

Date: 2026-09-20. State: **linked Supabase migrations and VPS application deployed; manual acceptance still required**.

## Work completed

The interrupted run had already connected public, customer, and admin screens to the new APIs and validated the migration in PGlite. It had confirmed another customer's ticket/order is rejected, draft articles are hidden, and direct public access to ticket tables/functions is denied. The full-suite integration failure was the fail-closed system reset allowlist. That allowlist and private-file cleanup were already patched, with targeted reset tests passing, when work resumed.

After resuming, I reviewed the complete feature, added integration tests for content/full reset and negative authorization cases, denied private-file downloads by disabled customers, restricted assignment to reply-capable staff, corrected staff-facing ticket status labels, made the date-to filter include the whole chosen day, stopped Help Center listings from fetching article bodies, and clarified the article load-error state. No remote database write or VPS deployment occurred.

In the current staging-readiness pass, I removed raw database error text from the shared customer/admin authentication responses, added customer unread-reply tracking and a staff needs-attention count, showed existing payment/shipment state in ticket details, and enabled the standard Nuxt typecheck. The existing feature was not redesigned. No remote database write or VPS deployment occurred.

## Files changed in this staging-readiness pass

- App: `app/components/account/Navigation.vue`, `app/middleware/customer-auth.ts`, `app/pages/account/support/index.vue`, `app/pages/account/support/[id].vue`, `app/pages/dashboard/support/index.vue`, `app/pages/dashboard/support/[id].vue`.
- Server: `server/api/admin-support/tickets/index.get.js`, `server/api/admin-support/tickets/[id].get.js`, `server/api/support/tickets/index.get.js`, `server/api/support/tickets/[id]/read.patch.js`, `server/api/support/unread.get.js`, `server/utils/adminRequest.js`, `server/utils/customerRequest.js`, `server/utils/requestDatabaseError.js`, `server/utils/supportTickets.js`.
- Database/tests/config/docs: `supabase/migrations/20260920120000_support_unread_replies.sql`, `tests/help-support-database.test.mjs`, `tests/request-database-error.test.mjs`, `package.json`, `package-lock.json`, `nuxt.config.ts`, `PROJECT_STATE.md`, `CODEX_HANDOFF.md`.

## Changed files

### Application

- `app/components/account/Navigation.vue`
- `app/middleware/customer-auth.ts`
- `app/components/layout/Footer.vue`
- `app/components/layout/TopBar.vue`
- `app/components/support/Conversation.vue`
- `app/composables/useSupportClient.js`
- `app/pages/account/support/index.vue`
- `app/pages/account/support/[id].vue`
- `app/pages/dashboard/help.vue`
- `app/pages/dashboard/support/index.vue`
- `app/pages/dashboard/support/[id].vue`
- `app/pages/help/index.vue`
- `app/pages/help/[category]/[slug].vue`
- `app/utils/adminPermissions.js`
- `app/utils/dashboardNavigation.js`
- `app/utils/support.js`

### Server

- `server/api/admin-help/categories/index.get.js`
- `server/api/admin-help/categories/index.post.js`
- `server/api/admin-help/categories/[id].patch.js`
- `server/api/admin-help/articles/index.get.js`
- `server/api/admin-help/articles/index.post.js`
- `server/api/admin-help/articles/[id].patch.js`
- `server/api/admin-help/articles/[id].delete.js`
- `server/api/admin-support/assignees.get.js`
- `server/api/admin-support/tickets/index.get.js`
- `server/api/admin-support/tickets/[id].get.js`
- `server/api/admin-support/tickets/[id].patch.js`
- `server/api/admin-support/tickets/[id]/messages.post.js`
- `server/api/admin-support/tickets/[id]/attachments.post.js`
- `server/api/help/index.get.js`
- `server/api/help/[category]/[slug].get.js`
- `server/api/support/orders.get.js`
- `server/api/support/unread.get.js`
- `server/api/support/attachments/[id].get.js`
- `server/api/support/tickets/index.get.js`
- `server/api/support/tickets/index.post.js`
- `server/api/support/tickets/[id].get.js`
- `server/api/support/tickets/[id].patch.js`
- `server/api/support/tickets/[id]/read.patch.js`
- `server/api/support/tickets/[id]/messages.post.js`
- `server/api/support/tickets/[id]/attachments.post.js`
- `server/utils/helpCenter.js`
- `server/utils/adminRequest.js`
- `server/utils/customerRequest.js`
- `server/utils/requestDatabaseError.js`
- `server/utils/sitePages.js`
- `server/utils/supportTickets.js`
- `server/utils/systemReset.js`
- `server/utils/systemResetScopes.js`

### Database, tests, and documentation

- `supabase/migrations/20260919120000_help_center_support.sql`
- `supabase/migrations/20260920120000_support_unread_replies.sql`
- `nuxt.config.ts`
- `package.json`
- `package-lock.json`
- `tests/help-support-database.test.mjs`
- `tests/request-database-error.test.mjs`
- `tests/site-pages.test.mjs`
- `tests/system-reset-database.test.mjs`
- `tests/system-reset.test.mjs`
- `PROJECT_STATE.md`
- `CODEX_HANDOFF.md`

## Database migration

`20260919120000_help_center_support.sql` creates the Help Center and support tables, indexes, constraints, private Storage bucket, service-role-only ticket RPCs, RLS policies, initial categories, audit triggers, and reset integration. `20260920120000_support_unread_replies.sql` adds customer read timestamps, an unread index, and service-role-only unread count functions. Both execute in the PGlite test helper against the full schema/migration chain. On 2026-09-20, `supabase db push --linked` applied both to linked project `zsqhuwgoasrexdnamlks`; `supabase migration list --linked` then confirmed matching local/remote versions. The CLI's Docker catalog-cache warning was non-fatal.

## VPS deployment

On 2026-09-20, `npm run deploy:check` confirmed the exact `newelcomputer` user, `/home/newelcomputer/htdocs/new.elcomputer.net` directory, and `new-elcomputer` PM2 process. All 77 tests and `npm run typecheck` passed before `npm run deploy` built a production release without local secrets and deployed only `.output`. The existing PM2 process restarted and passed the script's internal and public health checks. A transient connection refusal during the first internal health retry cleared on the next check. Public `/`, `/help`, and `/api/help` returned HTTP 200; unauthenticated `/api/support/tickets` returned HTTP 401. The previous output is retained at `/home/newelcomputer/htdocs/new.elcomputer.net/.output-deploy-backup-20260919-232824-9073`. No other site or shared service was restarted.

## Checks and limits

- `node --test tests/*.test.mjs`: 77 tests passed, 0 failed. New tests cover unread isolation/internal-note behavior and safe account lookup errors.
- `npm run typecheck`: passed after adding only `typescript`, `vue-tsc`, and `@types/node`. A narrow type annotation in the existing customer middleware and a Node import in Nuxt config resolved prior setup errors without changing runtime behavior.
- `npm run build`: passed after final code changes (non-blocking existing sourcemap warnings only).
- Local built-server smoke before the remote push: private customer, staff, and attachment routes returned 401 without a session. `/api/help` returned 503 against the then-unmigrated linked database; that result is no longer current. No authenticated browser session was available.
- `git diff --check`: passed after final code changes.
- Lint: no script or lint configuration in `package.json`.
- PGlite migration and focused reset/security tests: passing. This is not a live Supabase Storage or browser test.

## Security review and remaining risks

Ticket/order ownership is enforced in server queries and ticket RPCs; IDOR attempts against other customers' tickets/orders are tested. Customer thread reads exclude internal notes, and attachment downloads check the owning ticket and note visibility. Active staff permissions are checked server-side. All new tables have RLS; direct ticket grants and direct RPC execute rights are denied to browser roles. Public Help Center reads require published articles and active categories. Service-role use is server-only. Text, UUIDs, article slugs, file size/type/signatures, and database states have validation; Markdown goes through the existing HTML-escaping renderer. Idempotency keys limit duplicate tickets/messages.

Customer unread counts are computed only for the authenticated customer. Browser roles cannot query private ticket tables or execute the unread functions, and the read endpoint first verifies ticket ownership and updates only customer-visible staff messages in that ticket. Staff needs-attention counts require `support.view` and use new/open or waiting-for-support tickets; internal notes do not change that state or customer unread state. Shared authentication failures return generic 500 responses while keeping diagnostic database text in server logs.

Residual risks: actual remote Storage policies/configuration differ from the PGlite stub until inspected; multipart parsing buffers chunked uploads before the 5 MiB post-parse check, so the VPS reverse proxy needs a request-body limit. V1 indicators refresh on page load, not by live polling or email. No rate limiting, malware scanning, or automated browser E2E suite exists. The migrations and application are deployed, but live Storage behavior and authenticated UI flows remain unverified. No lint configuration exists.

## Exact manual acceptance checks after deployment

1. Both migrations are already applied to the linked Supabase project. Confirm all six tables, RPC grants, RLS policies, unread index/functions, and the private `support-attachments` bucket in that project. Confirm no existing broad `storage.objects` policy grants direct access to that bucket. Use a staging/project clone for destructive reset tests.
2. In staging, create a published and a draft article. As an anonymous visitor, search and open the published article; confirm the draft and archived article are absent from the page **and** direct API/database reads. Check Markdown links and hostile HTML render safely.
3. Sign in as Customer A and Customer B. Create a ticket for A, optionally linked to A's order. Try B's order ID during A's creation, then try B's session against A's list/detail/reply/status/attachment URLs. All cross-customer attempts must fail without returning ticket data.
4. As staff with `support.view` only, read but do not reply/manage. Test `support.reply` and `support.manage` separately, including a disabled admin account. Add an internal note and file; confirm the customer API and browser never reveal either. Test assignment only to eligible staff. Confirm new/customer-replied tickets increase the staff needs-attention count, and a public staff reply removes that ticket from the attention queue.
5. Upload and download each allowed file type; reject a >5 MiB file, a mismatched MIME/signature, another ticket's file, a disabled customer's file, and a direct public Storage URL. Check network responses and server logs for stack traces or leaked credentials.
6. With two customer accounts, verify that a public staff reply adds a New reply badge only to the owning customer's ticket and account navigation. Opening the conversation clears only the visible replies; an internal note creates no badge. Try one customer's token against another customer's unread/read URLs. Confirm direct RPC access is denied to browser roles.
7. Close and reopen a ticket within seven days, then test the expired-window behavior. Verify ticket event history, status labels, search filters, date range, payment status, and shipment/preparation context from existing order records. Verify desktop/mobile layouts, keyboard focus, and browser console/network errors.
8. In a **disposable staging database only**, exercise content reset (articles/categories deleted, tickets preserved) and full reset (support rows and captured private objects removed, unrelated buckets and new uploads untouched). Never use production reset as a smoke test.
9. Confirm `npm ci`, `npm run typecheck`, tests, and build pass in staging CI. The scoped VPS deployment is already live; retain the backup until authenticated checks pass.

Recommended next action: complete live database/Storage inspection and authenticated manual security acceptance. No additional feature work is needed before those checks.

## Customer account redesign — deployed in the current release

This redesign is deployed to `new.elcomputer.net`. It preserves the site's blue storefront branding and the existing Help Center/ticket backend. A single `app/layouts/account.vue` owns the account identity, navigation, logout, and responsive frame. `app/components/account/Navigation.vue` uses real Overview, Orders, Messages, Support, Wallet, and Profile routes. Orders has real filters, paginated order cards, product snapshots, and a detail route. `app/components/account/OrderCard.vue`, `OrderProgress.vue`, and `app/utils/accountOrders.js` share status, payment, date, and money presentation. The progress component deliberately shows only placed/current state because no per-status history exists.

Changed account files: `app/pages/account/index.vue`, `messages.vue`, `support/index.vue`, `support/[id].vue`, `orders/index.vue`, `orders/[id].vue`, `wallet.vue`, `profile.vue`, `app/layouts/account.vue`, `app/components/account/Navigation.vue`, `OrderCard.vue`, `OrderProgress.vue`, `app/utils/accountOrders.js`, storefront order links in `app/pages/index.vue` and `app/components/layout/NavBar.vue`, `server/api/account/orders/[id].get.js`, `server/api/support/orders.get.js`, and `tests/account-orders.test.mjs`. The separate profile guard adds `supabase/migrations/20260920130000_guard_customer_profile_fields.sql` and `tests/customer-profile-guard.test.mjs`.

The order detail endpoint verifies the bearer token and active customer, validates the order ID, filters by both ID and `user_id`, and only then reads related items and selected courier fields. Existing customer order/item RLS remains unchanged. The support order picker can include an older order only after an ownership-scoped lookup. There are no fake tracking links, invoices, refund buttons, wallet transactions, or delivery dates.

Earlier validation on 2026-09-20: 81 repository tests, `npm run typecheck`, `npm run build`, and `git diff --check` passed. The original local Nuxt dev worker returned HTTP 500 with `worker exited with code 0` on both `/` and `/account`; its exact exit cause is unproven. Stopping only that process and starting a fresh dev server restored `/` to HTTP 200, unauthenticated account pages to login redirects, and the private order API to HTTP 401. A separate local run of the built production server returned the same expected statuses. No lint script exists. Authenticated desktop/mobile visual checks, browser console review, live customer order/payment/shipment verification, profile editing, and support-ticket flows remain manual because no customer test session was available.

Profile security: existing `customer_profiles` RLS allowed a customer to update `wallet_balance` and `is_active` on their own row. Migration `20260920130000_guard_customer_profile_fields.sql` now rejects those changes for `authenticated`/`anon` roles, including forged inserts, while preserving trusted service-role writes and safe customer profile edits. Isolated PGlite role tests passed. A linked dry run showed exactly this one pending migration; `supabase db push --linked --yes` applied it, and `supabase migration list --linked` showed matching local/remote version `20260920130000` on project `zsqhuwgoasrexdnamlks`. The Docker cache warning after push did not prevent application. The migration changes the live database, not the VPS app. The profile table still grants owners broad access to other fields such as email and timestamps, so a complete column-permission hardening review and live authenticated profile/disabled-account acceptance remain before deploying the UI.

Account loading follow-up (deployed): The `useSupabaseUser()` value is JWT claims (`sub`), not a Supabase User object (`id`). This caused Overview's “Loading your orders…” to persist because its loader returned while `loading` remained true. The account overview, orders, wallet, profile, layout, support conversation identity, and login profile lookup normalize the ID through `app/utils/accountSession.js`; the route guard checks verified claims. Requests have finite timeouts, and failed reads no longer present misleading empty orders or zero balances. Session normalization/fallback/timeout tests pass. Wallet history is absent because the schema records only the current balance, not credits and debits; the customer-facing text was simplified. Authenticated browser acceptance is still required.

### Customer-account Classic/Modern release — 2026-09-20

Admin `/dashboard/settings?tab=account-dashboard` now controls `site_settings.account_dashboard_style`. Migration `20260920140000_customer_account_appearance.sql` defaults to Modern and allows only Classic/Modern. Classic retains the preceding account interior; Modern follows the reference's information hierarchy with grouped navigation, purchase history, wallet balance, profile details, messages, and support. Unsupported features were omitted, and the store header was not changed. The public `/api/storefront/account-appearance` endpoint is uncached. Files added: `app/composables/useAccountAppearance.js`, `server/api/storefront/account-appearance.get.js`, the migration, and `tests/account-dashboard-theme.test.mjs`. Files changed: `app/layouts/account.vue`, `app/components/account/Navigation.vue`, `app/pages/account/index.vue`, `app/pages/dashboard/settings.vue`, and `app/utils/dashboardSettings.js`.

All 88 tests, Nuxt typecheck, production build, and diff check passed. The linked dry run listed only `20260920140000`; it was applied once, and `supabase migration list --linked` confirmed local/remote parity. The built local API and live public API returned `modern`. `npm run deploy:check` confirmed exact user, site directory, PM2 process, and health before and after `npm run deploy`. Deployment restarted only `new-elcomputer`, retained backup `/home/newelcomputer/htdocs/new.elcomputer.net/.output-deploy-backup-20260920-172753-15422`, and passed internal/public health. Afterward public `/` and the appearance API returned 200; anonymous account pages redirected to login. PM2 was online in fork mode with the expected cwd/entry, and its error log had not changed since restart. Signed-in customer pages, mobile appearance, browser console/network, and an actual admin Classic→Modern save remain unverified; test these before treating visual acceptance as complete.

## Live Chat delivery and workspace update — deployed 2026-09-27

- Added a visible-thread HTTP reconciliation every 2.5 seconds for customer and staff views while retaining private Realtime as the immediate signal path. The staff inbox also catches up every 10 seconds.
- Reopening the customer launcher now reuses the loaded conversation. Initial loading appears only while the chat identity is first resolved.
- Renamed customer “History” to “Past chats.” It lists earlier Live Chat conversations.
- Collapsed the customer order tools behind a compact order row.
- Bounded the staff chat workspace to the viewport so the transcript scrolls and the reply composer remains visible.
- Desktop staff now opens the first available conversation automatically.
- Replaced the long staff context column with Customer, Orders, and Activity tabs plus a closeable details panel on smaller screens.
- Added exact server counts for Waiting, Assigned to me, Active, Unassigned, Closed, and Offline messages.
- Changed files: `app/components/live-chat/Launcher.vue`, `app/pages/dashboard/live-chat.vue`, `server/api/admin-chat/conversations/index.get.js`, `PROJECT_STATE.md`, and `CODEX_HANDOFF.md`.
- No schema, migration, permission, or Realtime policy change was needed.

Validation: all 158 tests passed; Nuxt typecheck, production build, and `git diff --check` passed. Local built-server smoke returned 200 for home/chat status and 401 for the unauthenticated staff inbox. The locked deployment preflight and production deployment passed. Live home/chat status return 200, anonymous staff inbox access returns 401, and the post-deployment PM2 health check passes. Retained backup: `/home/newelcomputer/htdocs/new.elcomputer.net/.output-deploy-backup-20260927-162405-68087`.

Manual follow-up: use one customer browser and one authorized staff browser to measure message arrival in both directions, confirm the composer remains visible at common laptop sizes, and review the details tabs with a customer who has orders and prior chats.

## Live Chat customer flow and follow-up — deployed 2026-09-27

The customer flow is now immediate. Authenticated users use their saved profile contact and identity, while guests still follow the configured contact rule. Starting with a first message requires no order and creates no support ticket, including during offline intake. Order tools are optional, collapsed, and responsive.

Closed chats collect a resolved yes/no answer and a one-to-five rating. The service-only feedback RPC locks the conversation and saves feedback once. `resolved = false` or a rating at or below two creates one linked follow-up ticket; retries return the first result. Customer/contact, linked order, assigned agent, source-chat reference, and the original Live Chat transcript are preserved.

Admins can enable Request a Call in Live Chat settings. It defaults off. When enabled, the server prefers the signed-in profile mobile, then collects only a missing mobile. A conversation stores one idempotent callback request. The staff inbox has a counted Callbacks view and shows pending callback details with complete/cancel actions guarded by existing support permissions and assignment rules.

The client panel includes the compact order section, callback action, and closed-chat feedback. The dashboard retains its fixed workspace, visible composer, counted queue views, and tabbed details. The Live Chat header no longer navigates to Support Tickets.

Migration `20260927180000_live_chat_resolution_callbacks.sql` is applied to Supabase project `zsqhuwgoasrexdnamlks`, and migration parity is confirmed. The migration also converts any legacy ticket-style offline setting to conversation intake and constrains it there. Tickets can still be created manually by staff or automatically from negative feedback.

Validation and release:

- `node --test tests/*.test.mjs`: 161 passed, 0 failed.
- `npx nuxt typecheck`: passed.
- `npm run build`: passed; only the existing non-blocking sourcemap warnings appeared.
- `git diff --check`: passed.
- Linked migration dry run listed only `20260927180000`; push completed, and local/remote migration versions match.
- `npm run deploy:check` and `npm run deploy` passed. Only `new-elcomputer` restarted.
- Live `/` and `/api/chat/status` returned 200. The status response reports conversation intake and Request a Call disabled by default. Unauthenticated staff access returned 401.
- Retained backup: `/home/newelcomputer/htdocs/new.elcomputer.net/.output-deploy-backup-20260927-172752-69341`.

Manual browser acceptance remains for signed-in and guest starts, phone and desktop order layout, closure feedback, one real negative follow-up ticket, callback enablement, and callback handling by assigned staff.
