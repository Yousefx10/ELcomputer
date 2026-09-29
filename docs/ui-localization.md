# UI localization and appearance

Date: 2026-09-28. Scope: application interface only. **Local implementation; not deployed.**

## Architecture and audit

The project had no i18n or color mode library. Classic/Modern account layouts and Standard/Detailed dashboard layouts were presentation preferences, with no Light/Dark mechanism. Settings use the existing `public.site_settings` singleton (`key = default`) and the storefront content endpoint. Its typed columns included one `site_logo_url`; it had no theme or separate logo fields. The existing upload field, media library, authenticated upload API, and section-specific settings saves are reused.

The audit identified locale prefixes in auth/permission checks, client-only homepage loading, system-theme SSR rendering, and shared settings defaults as the main hydration/routing risks.

## Languages and routes

- Standard `@nuxtjs/i18n` 10.6.0, with Vue I18n in composition mode.
- `i18n/locales/en.json` and `i18n/locales/ar.json`; exactly `en` and `ar`.
- English is the default. Browser/geography detection is disabled.
- Existing English routes remain unprefixed. Arabic uses `/ar`, including product, custom CMS, account, auth, and dashboard routes.
- `UiPreferences` uses the module's `setLocale`, preserving the route, query, and hash. `elcomputer-locale` remembers manual choice for one year.
- Shared route/navigation adapters normalize prefixes for existing comparisons, permissions and redirects. API/upload/image paths and external links retain their destinations.
- `<html lang>` and `dir` follow the active locale. Existing static document titles are localized; stored product/CMS titles remain stored content.

### Adding interface copy

Use a semantic locale key in both JSON catalogs and `$t('cart.title')` or the existing domain namespace. Use parameters for values. Do not build translated database values or embed Arabic in business logic.

`useUiLocale` is a boundary adapter for existing English application metadata, fixed enums and API errors. Its explicit string/pattern maps point to the same locale catalogs. It does not replace the Nuxt i18n system. Use it only for interface labels/messages, never arbitrary content. Pattern captures containing names or identifiers remain unchanged. New copy should use direct semantic keys rather than extending legacy pattern matching unnecessarily.

Arabic falls back to English. Development warnings and tests check locale parity, interpolation parameters, message compilation, valid key paths, static Vue references, and adapter references. `uiText` guards unknown optional keys; unknown server errors use a localized retry message.

## Content boundaries

Localized: storefront navigation/search/product controls, purchase disclosures, cart/checkout, auth/account, order/payment status labels, help/support/review controls, Live Chat controls and application activity labels, dashboard navigation/settings/forms/tables/actions/validation/notifications, and packing-document labels.

Unchanged: product titles/descriptions, specification names and values, feature/highlight content, categories/brands/models/SKUs, catalog image content, names/addresses, reviews, chat/support messages, order notes, CMS articles/pages, saved announcements, custom links and stored marketing copy. Default application links and fallback headings are localized at their render boundary. Product data gets no translation columns, backfill or machine translation.

Dates/times and monetary formatting use `en-US` or `ar-EG-u-nu-latn`: Arabic labels with readable Latin digits. EGP and stored numeric values are preserved. Technical units and identifiers such as USB-C, SKU, QR, PDF, CRM, model numbers and example URLs remain recognizable.

## RTL

The existing styles use logical spacing, borders, positioning and start/end alignment. Search price-slider positions and pointer input follow locale direction. The dashboard sidebar’s scoped global selector targets the sidebar, with a compiler regression check preventing transforms from reaching the HTML document. Directional arrows receive one shared RTL mirror rule; logos, product imagery and play controls are unchanged. Carousels account for RTL scroll direction. Email, telephone, card and numeric entry retain LTR direction where useful. Native controls, dialogs, focus states and existing keyboard interactions remain available.

## Theme and persistence

`@nuxtjs/color-mode` 4.0.1 owns the shared Light/Dark/System mechanism for the storefront and dashboard. System is the default and responds to OS changes.

- `elcomputer-theme-choice`: manual choice; one year, root path, SameSite Lax.
- `elcomputer-color-mode`: effective preference consumed by the standard prepaint bootstrap.
- The root app resolves manual choice before the configured site default during SSR. Its watcher follows default-setting updates when there is no manual override.
- Logos use CSS visibility, avoiding a server/client branch based on an unknown System value.
- Semantic colors live in `app/assets/css/appearance.css`: navy canvas, layered surfaces, readable text, restrained brand blue, borders and status colors. Dashboard statistic cards use readable dark surfaces and primary text rather than mixed light gradients. Storefront link/outline text uses the separate brand-text token for readable dark contrast. Existing Tailwind and scoped shell styles use these shared colors.
- Homepage product data remains client-only; its loader appears after hydration so SSR and the initial client tree agree.

## Branding and migration

Settings → Store details → Appearance and branding provides site default theme and Light/Dark logo controls, previewed on their respective backgrounds. Each logo can be selected from the existing media library, uploaded through the existing authenticated API, or removed.

The additive migration is `supabase/migrations/20260928130000_ui_appearance.sql`:

| Existing table column | Purpose |
| --- | --- |
| `site_logo_light_url` | Optional light logo |
| `site_logo_dark_url` | Optional dark logo |
| `site_theme_default` | `system`, `light`, or `dark`; default `system` |

No new settings/media table, storage system, catalog columns, enum changes, or destructive migration. **The migration has not been applied remotely.**

Light falls back to the existing site logo and then the bundled logo. Dark falls back to Light. Failed image loads fall back to Light and then the bundled logo. Header, footer and dashboard share `BrandLogo`; theme changes select the appropriate asset live. Existing paper/packing branding retains its existing configured logo.

## Verification

All results below were obtained after the final application edits. `PROJECT_STATE.md` and `CODEX_HANDOFF.md` record the same final state.

| Final check | Result |
| --- | --- |
| `node --test tests/*.test.mjs` | 172 passed, 0 failed |
| Focused localization/theme/account checks | 14 passed, 0 failed |
| `npm run typecheck` | Passed |
| `npm run build` | Passed |
| `git diff --check` | Passed |
| EN/AR translation audit | 3,130 keys each; 3,183 literal calls and 3,193 adapter references checked, 0 missing; safe English fallback |
| Browser matrix | 208/208 passed; 0 overflow, exceptions, console errors or hydration warnings |
| Preference/branding/RTL interactions | 36/36 passed; 0 exceptions, console errors or hydration warnings |
| Public-output secret scan | 102 text assets checked; 0 exposures of the configured server-only secret |

Git remains on `main` at `64767bb3dbffa8ef0e3ac5512427c8a6794ae1b4`. The phase is uncommitted: 131 modified tracked files and 20 new files. No server business/security file was modified. Existing build warnings concern Tailwind sourcemaps and the prior preorder BigInt code targeting ES2019; the verified browser is current Chrome. Older-browser compatibility is not established by this matrix.

Browser checks run against a local production preview. Public catalog reads are anonymous. Customer/admin screens use browser-only fixtures; database and API writes are intercepted. These checks establish rendered interface behavior, not real authenticated backend acceptance. No production Auth identity, order, catalog/settings row or uploaded asset is created for this phase.

Required matrix: 1440/1024/768/390 pixels × English/Arabic × Light/Dark × home, search, product, cart, checkout, login, signup, account, help, chat, dashboard overview/products/settings. Separate checks cover persistence, query/hash/cart/session retention while switching, System OS changes, logo fallbacks, media controls, and localized error screens.

The final harness verifies component readiness, protected account/checkout fixtures and Help Center content, captures console errors and hydration warnings, and checks both viewport edges. The interaction run also verifies manual Light/Dark before first paint, live System changes, RTL sidebar opening/closing, RTL price-pointer mapping, localized status/filter/cart/chat labels, missing/failed dark-logo fallback, library selection/removal/upload/save payloads, native dialog Escape, and dark statistic/product-action contrast of at least 4.5:1. The static-copy audit leaves intentional technical names, identifiers and examples; tested screens show no raw translation keys. Stored content remains untranslated, including configured chat welcome/offline text.

Final-validation application fixes restored sidebar leaf links, corrected a product-card formatter exception, preserved the sidebar-only RTL transform, improved dark link/action contrast, and localized transient feedback and mobile header behavior. Harness readiness/fixture corrections were handled separately.

Evidence is retained under `/tmp/elcomputer-localization/`: `matrix-complete.log`, `visual/results.json`, `interactions.json`, `tests-complete.log`, `final-focused-tests.log`, `typecheck-complete.log`, `build-complete.log`, `audit-final.log`, `translation-audit.json`, `secret-scan.json`, and the current screenshots. These temporary artifacts are not committed.

Existing sample upload URLs may show the application's blank fallback in a local preview because VPS files are not present locally. Brand checks therefore use explicit local image fixtures. Authenticated logo persistence, real uploads, and end-to-end customer/backend acceptance remain pending on an isolated database with the migration applied.

## Manual review routes

Review each in English and with `/ar` prefixed, in Light and Dark:

| Screen | Route / action |
| --- | --- |
| Home | `/` and `/ar` |
| Search / filters | `/search?q=USB-C&status=instock`; drag the price thumbs |
| Product | `/products/jedel-cp102-mouse-optical-sensor-3600-dpi-7-buttons-braided-cable-silent-click` |
| Cart / checkout | `/cart`, `/checkout` with an existing normal item |
| Login / signup | `/login`; select Create Account for signup |
| Customer account | `/account`, `/account/orders/[id]`, `/account/support/[id]` with authorized test records |
| Help / chat | `/help`; open the shared Chat launcher |
| Dashboard | `/dashboard`, `/dashboard/products` |
| Appearance / branding | `/dashboard/settings?tab=general` → Appearance and branding |
| Specialized Arabic wording | `/dashboard/commerce?tab=procurement`, `/dashboard/orders/confirm`, `/dashboard/live-chat` |

At 390px, open/close the dashboard sidebar and check the Arabic edge. In Appearance and branding, select/upload/remove both logos, verify their preview backgrounds, and test System plus manual overrides. Real save/upload acceptance needs an isolated backend with the unapplied migration; browser fixtures do not establish backend persistence.

## Completion report

1. **Existing architecture:** Nuxt 4, Supabase, singleton settings, one configured logo, reusable media/settings controls; no previous language/color-mode system.
2. **i18n choice:** standard Nuxt i18n with composition-mode Vue I18n.
3. **Catalogs:** shared English/Arabic JSON files with 3,130 matching semantic domain keys.
4. **Translated areas:** storefront and dashboard interface, validation/messages/statuses, support/chat/account/auth and print labels.
5. **Exclusions:** all stored catalog, customer, review, message, order-note and CMS content.
6. **Arabic RTL:** HTML direction, logical CSS, directional icons, carousels, forms and shared layouts.
7. **Language control:** accessible public/dashboard selectors, persisted manual choice, route/state retention.
8. **URLs:** English preserved; Arabic `/ar/...`; normalized auth and permission comparisons.
9. **Theme:** one Light/Dark/System mechanism with shared semantic colors.
10. **SSR/persistence:** cookie-backed choice, standard prepaint bootstrap, live OS changes; corrected client-only loader hydration.
11. **Logos:** separate optional Light/Dark assets, appropriate previews and safe fallbacks.
12. **Reuse:** existing singleton, settings save flow, media component/library and authenticated upload API.
13. **Schema:** three additive settings columns; local migration only.
14. **Fallback:** English for missing Arabic, guarded optional keys, generic localized unknown errors, catalog consistency gates.
15. **Build gates:** 172 repository tests and 14 focused checks passed; Nuxt typecheck/build and whitespace checks passed; public-output scan found zero secret exposures.
16. **Visual checks:** 208 matrix screens and 36 preference/branding/RTL interactions passed without overflow, exceptions, console errors or hydration warnings; fixtures are distinguished from backend acceptance.
17. **Wording review:** ask Arabic-speaking store staff to review specialized ERP/accounting, serialized inventory, procurement, callbacks, payment-proof and preorder terms. Initial wording is Modern Standard Arabic.
18. **Remaining English:** intentional technical identifiers, examples and stored content. Unrecognized future enum/error labels require a catalog mapping; framework startup failures before i18n initialization may use Nuxt's emergency UI.
19. **Future work:** isolated authenticated acceptance, approved migration/release, and staff wording review. Product/CMS content localization would be a separate authorized phase with an explicit content model.

This phase stops here. No deployment or additional client feature is authorized by this request.
