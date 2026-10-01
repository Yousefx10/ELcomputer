# Public SEO

Released and verified on 2026-10-01 at `https://new.elcomputer.net`. Application SHA: `e4fb685f4441326f7999a1954b5710928531789c`. The existing implementation was already committed/pushed; this task applied its authorized migration and released it without new application features.

Rollback output: `/home/newelcomputer/htdocs/new.elcomputer.net/.output-deploy-backup-20261001-043139-15337`. Use the established scoped rollback instructions in `docs/DEPLOYMENT.md`; no rollback was needed. PM2 `new-elcomputer` remains on port 3001 at the locked site path.

## Audit

Previously, public pages mostly supplied titles. CMS pages also supplied descriptions and robots metadata. There was no canonical, Open Graph, Twitter card, JSON-LD, or sitemap system. The static robots file allowed everything. Existing catalog and CMS tables had no dedicated SEO overrides.

## Architecture

- `app/utils/seo.js` supplies safe text/excerpts, title composition, canonical URLs, locale links, indexing policies, structured data, public discovery, XML and robots output. It has no browser dependency.
- `app/composables/usePageSeo.js` uses native Nuxt `useHead`. Important metadata is present in SSR HTML. Pages reuse their fetched content, category/brand lists and existing review aggregates.
- `app/app.vue` supplies fail-closed defaults and generic private titles. Existing language/direction handling remains authoritative.
- `server/middleware/seoIndexing.js` sets private `X-Robots-Tag` headers, including redirects. Authentication and existing RLS remain the access controls.
- `server/utils/publicSeo.js` queries public records with the anon client, explicit projections and publication filters. It handles database row caps and caches discovery for 60 seconds. Failed discovery returns 503 rather than an incomplete successful sitemap.
- No SEO dependency, analytics integration, separate media uploader, catalog translation or AI feature was added.

## Migration and settings

`supabase/migrations/20261001120000_public_seo.sql` is additive and applied to linked Supabase project `zsqhuwgoasrexdnamlks`. All 53 migration versions match. The release dry run listed only this migration. An optional local Docker catalog-cache warning was followed by successful remote ledger and column checks.

| Existing table | Added optional fields |
| --- | --- |
| `site_settings` | `seo_site_title`, `seo_default_description`, `seo_social_image_url`, `seo_site_url` |
| `products`, `categories`, `brands` | `seo_title`, `seo_description`, `seo_image_url` |
| `site_pages` | Same three overrides plus `seo_noindex`, default false |

Existing rows, catalog/CMS text and RLS policies are preserved. Overrides are nullable. Existing public reads still tolerate unapplied columns and use automatic values. Production editor persistence is verified against the installed migration.

Dashboard → Settings → **Search engines** (`/dashboard/settings?tab=seo`) uses the existing singleton settings, section-specific saves and dirty-state tracking. Organization name reuses **Store details → Store name**. The global sharing image uses the existing library/upload component and permission checks.

One resolver supplies the public origin everywhere: valid `site_settings.seo_site_url`, otherwise `NUXT_PUBLIC_SITE_URL`, otherwise the existing public deployment origin defined once in the shared helper. A saved URL must be an HTTP(S) origin without credentials, a path, query or fragment. Request Host headers never set canonicals.

## Editor controls and fallbacks

Products, categories, brands and CMS pages have optional title, description and sharing-image fields. A shared editor displays automatic title/description previews. Length recommendations do not block normal saves; server input limits protect against excessively large payloads. Existing uploads/library selection/removal are reused. CMS sharing uploads use a `site_pages` section with `pages.edit` permission. Library selection retains the existing `settings.view` requirement; section edit permissions govern uploads.

| Page | Title | Description | Sharing image |
| --- | --- | --- | --- |
| Home | Global SEO title → existing homepage title → store name | Global default → short interface fallback | Global sharing image |
| Product | SEO override → product title, with store suffix | Override → short description → long-description excerpt → global default → interface fallback | Override → main image → global sharing image |
| Category/brand | Override → actual name, with store suffix | Override → global default → named catalog fallback | Override → existing category image/brand logo → global sharing image |
| CMS | Override → saved page title | Override → safe saved-content excerpt → global default → interface fallback | Override → global sharing image |
| Help article | Actual article title | Summary → safe content excerpt → global default | Global sharing image |

Store suffixes are deduplicated. Titles have a sensible display limit; descriptions use a word-aware excerpt. Descriptions remove HTML/Markdown formatting while preserving product dimensions and identifier punctuation. Stored catalog/customer/CMS content is not translated or rewritten.

CMS **Hide this page from search results** supplies noindex and excludes that page from sitemap discovery. Published pages remain accessible; this switch is not a privacy control.

## Canonical, locale and indexing rules

English remains unprefixed and default. Arabic keeps `/ar` and RTL. Indexable pages have a self-referencing canonical and reciprocal `en`, `ar`, and English `x-default` alternatives. Social locales match the existing `en-US` and `ar-EG` configuration. Saved SEO/catalog/CMS text remains in its supplied language on Arabic routes; only automatic interface text is localized.

| Route | Indexing/canonical policy |
| --- | --- |
| `/`, `/ar` | Index; clean locale homepage URL |
| Published `/products/:slug` | Index; remove tracking, variant and other query parameters |
| `/search?category=:slug` or `?brand=:slug` | Index only a valid, populated single landing filter; preserve that identity |
| Search terms, sorting, prices, stock filters or combined category/brand filters | Noindex; consolidate to the single meaningful filter where available, otherwise `/search` |
| Category/brand pagination | Noindex after page 1; preserve the page number rather than claiming different page contents are page 1 |
| `/reviews` pagination | First page indexable; later pages noindex with their page number |
| Published CMS | Index unless staff selects noindex; clean saved route |
| Help index/article | Index published articles in active categories; Help Center searches/filters noindex |
| Cart, checkout, login/signup mode, account, dashboard, internal/support routes | Noindex, no public schema or hreflang; generic titles and root canonicals exclude personal identifiers |
| Missing/unpublished product, CMS or help article | Proper 404 and noindex |

Robots blocks internal API/media, account and dashboard paths, including Arabic counterparts. Cart, checkout and authentication HTML remain crawlable so crawlers can read noindex. Noindex is not an authentication mechanism. There are no AI-specific crawler rules.

## Sitemap and structured data

- `/sitemap.xml` uses current published products, populated categories/brands, published indexable CMS pages, active/published help content, home, Help Center and reviews.
- Both EN/AR URLs and reciprocal XML alternatives are included. No unpublished, personal, private or arbitrary filter combinations are emitted.
- Larger catalogs receive a sitemap index and `/sitemap-pages/:page.xml` files. Chunks contain at most 5,000 route identities / 10,000 localized URLs. URL/path validation and conservative chunks keep XML sizes bounded. XML text is escaped.
- `/robots.txt` references the same configured public origin's sitemap. Discovery/robots caches may take up to 60 seconds to reflect changes; existing storefront settings caching also still applies.
- Home emits `Organization` and `WebSite` with store name, origin and configured light/legacy logo. Placeholder footer addresses/phones and invented social profiles are never used.
- Products emit actual name, product image, description, SKU, brand, price and EGP currency when present. A global sharing image is not misrepresented as a product image.
- Stock follows current product rules. Serialized availability uses active variants; no variant prices or identifiers are invented. Normal stockless products are OutOfStock, or BackOrder when the store genuinely accepts those orders.
- Coming Soon has no purchasable offer. PreOrder offers require the existing authoritative availability RPC to return available. Closed/sold-out/unavailable preorders have no offer. Commerce behavior is unchanged.
- Ratings use the existing public-review API's actual count and aggregate. Failed/unavailable aggregates are omitted. No customer identities, review bodies, fake ratings or item condition are added.
- Breadcrumbs use real home/category/product, CMS and Help routes. JSON-LD escapes script terminators and stored fields do not execute as HTML.

## Validation

Fresh release results are recorded in `PROJECT_STATE.md` and `CODEX_HANDOFF.md`. Evidence is under `/tmp/elcomputer-seo-release/`. The deployed application passed 188 tests, typecheck, build, whitespace check and deployment preflight. Guarded deployment rebuilt with an empty dotenv file; the final public-output scan checked 108 files with zero configured server-secret matches.

Live verification passed 32 SSR routes; the sitemap exactly matches 71 published/public route identities, 142 EN/AR URLs and 426 reciprocal alternate links. Chunk 1 matches the sitemap, invalid chunk 2 returns 404, robots references the production sitemap without AI-specific rules, and private headers/authentication redirects passed. Deployed sitemap/robots server-file hashes match the local deployment output.

The 64 storefront browser screens and four authenticated dashboard screens passed without overflow, exceptions, application console errors/warnings or hydration warnings. They cover EN/AR, Light/Dark and desktop/mobile. Staff tests saved/reloaded all four global fields, selected/removed existing media, and restored the original null values. A controlled published noindex CMS page verified optional title/description/image persistence, SSR, cleared title/content fallback, and exclusion from a fresh sitemap after the discovery cache expired. The controlled page was deleted and existing settings/catalog/CMS fingerprints and business counts remained unchanged.

PM2 is online at its fixed cwd/entry/port. Signed-in SSR emits an existing Supabase SDK session-user warning; 465 matching warnings were already in the pre-release log. No new application exceptions appeared. A real stocked product added to cart and survived reload; checkout still required authentication. Actual fresh file upload, customer password/OAuth, signed-in order/payment submission and chat messages were not performed. Live Chat status and launcher open/close were checked without sending messages.

The browser fixture uses local, read-only Supabase responses. Analytics requests are fulfilled locally in the browser to prevent unrelated fixture writes; analytics code is unchanged. Fixture/browser results do not establish authenticated production editor saves or media upload acceptance.

## Manual review

Review the released site at `https://new.elcomputer.net`. Earlier local preview results and scripts under `/tmp/elcomputer-seo/` are historical evidence; rebuilding `.output` means an older local preview process should be restarted before reuse.

The following are real public catalog/CMS paths for production review; none was created as SEO sample catalog data. Use the production origin above.

| Review | Path |
| --- | --- |
| English homepage | `/` |
| Arabic homepage | `/ar` |
| Product with description/image | `/products/elite-mousepads-900-400-4-mm-waterproof-decorated-white` |
| Same product with Arabic interface | `/ar/products/elite-mousepads-900-400-4-mm-waterproof-decorated-white` |
| Product missing main image | `/products/elite-mousepads-900-400-4-mm-waterproof-decorated-black` |
| Product with real reviews | `/products/testmouse-eef7f25e` |
| Category | `/search?category=mouse` and `/ar/search?category=mouse` |
| CMS page | `/shipping-policy` and `/ar/shipping-policy` |
| Sitemap and robots | `/sitemap.xml`, `/robots.txt`, `/sitemap-pages/1.xml` |
| Global SEO controls | `/dashboard/settings?tab=seo` |
| Optional product controls | Dashboard → Products → Add/Edit → Search engines |
| Category/brand controls | Dashboard → Catalog → Categories/Brands → Search engines |
| CMS controls | `/dashboard/pages` → Search engines / Hide from search results |

Authenticated production optional-field save/reload, existing library select/remove, cleared fallback and CMS noindex sitemap exclusion passed. Fresh upload remains untested. Original global SEO values were restored to null; no test-specific website address or metadata was left configured. Discovery may take up to 60 seconds to reflect later changes.

Minimal fixtures additionally cover a product without description, image, brand, SKU or reviews; Coming Soon; open preorder; noindex CMS; missing/unpublished records; EN/AR and private redirects.

## Limits and future handoff

The application controls metadata, not search-engine indexing decisions or rich-result eligibility. Products lacking required merchant images/other data may not qualify for rich results. Catalog and saved SEO content still lack Arabic translations; search engines may consolidate substantially identical catalog pages.

Future AI readiness may reuse the pure canonical/metadata helpers, locale mapping, public discovery, sitemap and structured data. No `llms.txt`, AI policy, crawler integrations, chatbot or AI content implementation is included here.

## Changed files

- `CODEX_HANDOFF.md`
- `PROJECT_STATE.md`
- `app/app.vue`
- `app/components/dashboard/catalog/BrandsTab.vue`
- `app/components/dashboard/catalog/CategoriesTab.vue`
- `app/composables/useSiteContent.js`
- `app/error.vue`
- `app/pages/[...pagePath].vue`
- `app/pages/dashboard/pages.vue`
- `app/pages/dashboard/products/add.vue`
- `app/pages/dashboard/products/edit/[id].vue`
- `app/pages/dashboard/settings.vue`
- `app/pages/help/[category]/[slug].vue`
- `app/pages/help/index.vue`
- `app/pages/index.vue`
- `app/pages/products/[slug].vue`
- `app/pages/reviews.vue`
- `app/pages/search.vue`
- `app/utils/dashboardSettings.js`
- `app/utils/uiMessageKeys.json`
- `i18n/locales/ar.json`
- `i18n/locales/en.json`
- `nuxt.config.ts`
- `public/robots.txt`
- `server/api/admin-pages/index.get.js`
- `server/utils/adminProducts.js`
- `server/utils/sitePages.js`
- `server/utils/uploads.js`
- `app/components/dashboard/SeoFields.vue`
- `app/composables/usePageSeo.js`
- `app/utils/seo.js`
- `app/utils/seoQuery.js`
- `docs/seo.md`
- `server/middleware/seoIndexing.js`
- `server/routes/robots.txt.get.js`
- `server/routes/sitemap-pages/[page].get.js`
- `server/routes/sitemap.xml.get.js`
- `server/utils/publicSeo.js`
- `server/utils/seoFields.js`
- `supabase/migrations/20261001120000_public_seo.sql`
- `tests/seo.test.mjs`
