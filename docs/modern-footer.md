# Modern Footer replacement — 2026-10-21

The reference layout replaces Modern Footer only. Classic's template and CSS
are byte-identical to the starting checkout `89743fa`. The existing selector,
Classic content, legacy Modern fields and shared footer menus remain preserved.
No payment, PDC, checkout, signup, Auth, SEO or inventory behavior is changed.

## Dashboard controls and persistence

Open **Settings → Footer content** (`/dashboard/settings?tab=footer`) and select
Modern. Use the existing **Save Footer Settings** action. The editor supplies:

- Optional light/dark footer logos through the existing public Media Library.
  Empty overrides use the store's existing theme-aware branding.
- EN/AR description and social heading; social platform, accessible name, URL,
  visibility, ordering, addition and removal.
- Two independent navigation headings and link lists. Links support EN/AR labels,
  destinations, optional EN/AR badges, ordering, visibility, addition and removal.
- Newsletter heading, description, placeholder, button text and display state.
  No approved subscription backend exists: choose Hidden or Visible/disabled.
  The disabled form accepts no addresses, sends no request and reports no success.
- Support hours, contact text and validated telephone, email or website link.
- App heading/description, uploaded badges, platform, URL, visibility and ordering.
  Apps without enabled entries, valid URLs and configured badges stay hidden.
- Payment heading, uploaded logos, names, method association, visibility and order.
  The existing available-payment-method helper also gates every logo. Footer
  editing never writes payment enablement or gateway settings.
- EN/AR copyright, optional current year, legal links and section visibility.

Blank Arabic fields fall back to English and vice versa. UI defaults are localized.
No store identity, deployment domain, account or project reference is embedded in
the new application logic. No sample links, apps, payment logos or facts are seeded.

Migration **88**, `20261021190000_modern_footer_configuration.sql`, adds only
nullable `site_settings.footer_modern_config` JSONB and a bounded version check.
It performs no data rewrite and changes no grants, RLS, provider or Auth contract.
Existing Settings view/edit RLS governs saves. The existing recursive settings
media-reference trigger and deletion scan cover every nested image URL.
VPS public images continue using the existing `footer` upload section. Private
files and Supabase Storage remain separate.

NULL configuration inherits the existing store logo, old Modern description,
footer menus, contact and copyright. The first menu group fills column one;
remaining groups populate column two without changing the original menus.
Editing creates Modern presentation settings in the existing settings row.
Thereafter Modern's menu content is independent, preserving Classic's saved menus.
Empty configured arrays deliberately stay empty. Legacy Modern fields remain stored
for review; the retired promotion/community/banner layout is no longer rendered.

Navigation is bounded to 30 entries per column; legal links to 20, social profiles
to 12, app links to 2 and payment logos to 12. Text fields are bounded to 500 characters,
names to 80 and URLs to 2,048. Client saves reject normalized payloads over 60,000 bytes;
the database independently limits its JSONB text to 65,536 bytes. Relative paths and
HTTP(S) links are validated. Executable schemes, credentials, protocol-relative URLs,
control characters, backslashes and fragment-only placeholders are rejected.

## Reference comparison and verification

The flat muted upper band, four desktop columns, divided utility strip and
horizontal copyright/legal row follow the supplied desktop reference. At 900px,
the upper grid becomes two columns and each utility section spans a full row,
matching the tablet reference. Below 640px it becomes one column. Logical spacing
and borders reverse for RTL. Disabled/unavailable optional services intentionally
leave no fictional content. The screenshots' browser-preview frame is excluded.

Local evidence uses the actual Settings page, save functions and Footer components
against a disposable native PostgreSQL 17.11/PostgREST instance. Auth claims and
business content are explicitly synthetic. The shared media field is represented
by a URL-selection adapter; this does not recertify hosted uploads or real staff Auth.
The actual secret-free Nuxt production output also renders and hydrates EN/AR pages
against an isolated read-only backend proxy. No provider traffic is allowed.

`scripts/modern-footer-browser.mjs` accepts local tool paths through
`EMAIL_REVIEW_PG_BIN`, `EMAIL_REVIEW_PG_DRIVER`, `CATALOG_REVIEW_POSTGREST_BIN`,
`FOOTER_REVIEW_PLAYWRIGHT`, optional `FOOTER_REVIEW_CHROME` and
`FOOTER_REVIEW_ARTIFACTS`. PostgreSQL libraries may require the platform's loader
path. Use the existing Node 22.23.1/npm 10.9.8 toolchain and a built `.output`.
These are local review inputs; no production runtime variable is added.

Final test counts and protected evidence are recorded in the
[validation receipt](modern-footer-validation.md).

## Production status and next release boundary

**PREPARATION PASS. Final deployment approval is pending.**

The owner approved preparation of a separate 87→88 release. The
[sealed plan and exact approval/deployment procedure](modern-footer-release.md)
are ready. Production remains on `d2d7a8029b473e4a`/schema 87; no migration,
activation, restart, provider request or production configuration edit has run.
The new binding retains all 428 current immutable client assets and verified fresh
recovery backups. Historical operators and seals remain unchanged.

The minimal next owner instruction is the final digest approval in that release
procedure. Do not run a completed operator or the retired PM2 scripts. The earlier
local `.output` remains validation evidence; deployment uses only the new sealed,
asset-retaining candidate. All purchase/provider/signup gates stay off.

PDC remains awaiting schema/support clarification. Both consumed diagnostic
approvals remain consumed. Preserve mandatory WordPress customer migration,
controlled provider acceptance, verified stock/delivery and later purchasing gates.
UI Improvement 2 has not started. No Git push is authorized or performed.

After an eventual successful deployment, the owner browser checks are:

1. Open `/` and `/ar` at desktop, tablet and phone widths in Light/Dark/System.
   Check the footer, RTL, internal links and absence of horizontal scrolling.
2. Open Settings → Footer content. Edit a reversible description, link order or
   visibility, save, refresh and confirm persistence. Restore the intended content.
   Optional services remain hidden/disabled unless genuinely configured.
3. Switch Classic/Modern and save/refresh each. Confirm Classic's original content
   and layout. Return to the preferred style. Keep payment/provider settings off.
4. Confirm existing product images and Dashboard access work; checkout/signup remain
   blocked. Do not create payments, bookings, orders or provider diagnostics.

These are pending post-deployment checks. The current production still serves the
accepted older footer; do not use it to accept the replacement yet.
