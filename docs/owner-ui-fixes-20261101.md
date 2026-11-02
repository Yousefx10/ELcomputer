# Owner mobile, branding and UX fixes — E174

1 November 2026. **ALL REQUESTED FIXES QUALIFIED LOCALLY. DEPLOYMENT HELD.**
`OD-20261101-UIUX-FIX-01 / UIUX-02` supersedes E173's wait for priorities.
The owner authorized one coordinated local implementation. Production writes,
deployment, restart, provider requests and historical metadata installation remain
unauthorized. No approval seal has been issued or consumed for this packet.

## Frozen implementation

Isolated branch `local/owner-ui-fixes-20261101`, source
`71d86c365101ea7dd185c0f0884334a4a7fc9c90`, based on deployed `7d989cd`.
Two local commits: `f7b6fd8` isolates staff safety/accessibility; `71d86c3`
completes mobile presentation, history/cart, SEO and icons with regression cases.
32 changed files; no handwritten server API, migration, package or lockfile change.
Main remains documentation continuity, not the deployed application lineage.

| Owner priority | Local result and boundary |
| --- | --- |
| Mobile homepage | Both enabled hero images contain baked text. Reused artwork supplies the illustration; mobile HTML shows its approved meaning at readable sizes. Desktop retains its existing images. A reviewed deployment configuration binds copy to the exact image/link, so Dashboard changes invalidate stale copy. Unmatched images display uncropped. No offer, coupon terms or discount mechanics were invented. |
| Mobile header/navigation | Narrow screens get an intentional category rail, visible More categories control and the existing complete Departments menu. Search/account/cart remain available. Mobile header is non-sticky, with safe-area padding and viewport-fit coverage. No global overflow hiding. |
| Mobile My Account | Bounded cards, wrapping long titles and identifiers, stable thumbnails, readable totals/status/date rows and EN/AR/RTL containment. Existing order access/reorder/payment authorization remains intact. No new historical staff viewer was implemented. |
| Favicon | Exported directly from the actual `~/Downloads/Logo.jpeg` (1280-square JPEG). Original source SHA256 `da05cc5bf05483d61bbaed7e26f8e4226d18e0daee01ee8a68600c25f81d634b`. Preserved proportions/colors/white symbol; header BrandLogo and configured logo files unchanged. |
| Google presentation | Professional EN/AR homepage titles, descriptions and matching visible SSR introduction. Existing canonical/hreflang and Organization/WebSite branding reused. Navigation, announcement and footer use data-nosnippet; cart restoration avoids false zero/empty placeholders. Owner SEO settings override defaults. No robots/indexability/redirect or product SEO rewrite. Google chooses its eventual snippets/sitelinks. |
| TESTproduct2026 | Already unpublished, unfeatured and not a top seller. One existing order reference retained. Both current and legacy paths return404; absent from the fresh488-URL sitemap. No catalog mutation or homepage redirect is needed. Do not delete its order history or promise a Google cache-removal date. |
| Maintenance/beta | Current maintenance message is disabled. The enabled Dashboard-authored BETA VERSION message remains respected; the app does not claim the working store is unavailable. Announcement text is excluded from snippets. |

Deployment-specific presentation content lives in
`config/storefront-presentation.json`. Reusable logic has no fixed store/domain
or owner authorization exception. Portability tests use a separate configured
business and origin. The promotion reproduces current artwork; checkout fees
continue to come from server-authoritative Dashboard settings, including COD10.

Favicon assets under the isolated source's `public/` directory:

- `favicon.ico` with 16/32/48/96px frames.
- `favicon-16x16.png`, `favicon-32x32.png`, `favicon-48x48.png`,
  `favicon-96x96.png`.
- `apple-touch-icon.png` (180px).
- `android-chrome-192x192.png`, `android-chrome-512x512.png`.
- `site.webmanifest`, referencing those manifest icons.

## UX-REV-01 through 05

| Finding | Qualified local correction |
| --- | --- |
|01 — wrong selected order | Request generations, order identity and dialog epochs bind every detail result and action completion. Auth is awaited before another identity check; request paths/payloads are captured for the selected order. Late reads, wrong response identities and delayed commands cannot replace another order's screen. Existing backend authorization/booking/payment contracts remain unchanged. |
|02 — carried payment evidence | Closing or switching resets amount, reference and external-verification assertion. Commands capture their own input; a pending command prevents normal close/Escape. No real payment was submitted in qualification. |
|03 — false empty cart | Honest restoring state and neutral header/count placeholders precede hydration. Existing owner/session, storage, completion-marker and acknowledgement rules remain unchanged. Reload preserves the owned basket. |
|04 — order dialog keyboard | Dialog semantics/name, focus entry after async mount, forward/reverse containment, safe Escape, focus restoration and nested-label compatibility. Active mutations cannot be interrupted through normal close controls. |
|05 — historical date/status | Existing original creation dates displayed; known Woo statuses translated accurately in EN/AR. Unknown source codes remain visible as recorded evidence. No historical totals, identities, ownership, refunds or data were changed. |

The native WebKit matrix exposed an existing product-rail ResizeObserver
notification loop, also reproduced in the baseline. Deferring its control update
to the next animation frame removed it; qualified current passes have zero browser
exceptions. No general component or Dashboard redesign was performed.

## Qualification

- Both Chromium and installed WebKit: 320/360/375/390/414/768/1280/1440px,
  EN/AR, RTL/LTR and light/dark. Component rectangles are checked, not just page
  overflow. Both mobile banner messages, category scrolling/menu and current
  locale metadata were exercised. 918 public-page assertions; zero exceptions.
- Actual account layout/cards/history with private synthetic identities: 260
  assertions. Long unbroken titles, identifiers, dates, statuses and access links
  remain contained. Actual staff/history components: 290 assertions, including
  late detail/command responses, cleared payment evidence, focus entry/return,
  keyboard containment, busy Escape and narrow-dialog bounds. Zero real writes.
- 63 focused presentation/history/privacy/cart/SEO/checkout/address tests PASS;
  24 navbar identity/hydration/ownership regression tests PASS. No failures/skips.
- 144 existing label/PDF browser assertions PASS, preserving download bytes,
  geometry, identity and stale-response handling. Genuine provider PDF/physical
  printing remains pending the existing approved real-AWB acceptance.
- 25 owned-cart restoration assertions across 8 Chromium/WebKit EN/AR cases PASS.
  No account/order was created; carts exist only in isolated browser storage.
- Typecheck/build PASS with Node 22.23.1. Existing duplicate ERP auto-import warning
  remains unchanged; no ERP work was opened. 13 release guards and 3 fresh-baseline
  database/security guard tests PASS, including one-use/restart failure handling.
- Archived package readback: 4,820 inventory entries; all 3,812 current/retained
  asset URLs return matching hashes, plus 9 icon/manifest paths and cache headers.
  All 3,697 immutable prior client assets retained; latest-build pointer is current.
  Compiled serving registry only extended for verified retained files using the
  existing guarded utility; original entries preserved and MIME types verified.
- 33 local prior→candidate→prior route/status/canonical checks PASS. Original
  deployment-specific Caddy redirects remain unchanged. Database/runtime backups
  encrypted and fully authenticated/read back; 17 runtime/config files preserved.

Private evidence: `../owner-ui-fixes-20261101/` and
`../owner-ui-fixes-release-20261101/`. Before/after public screenshots and account
stress fixtures are local qualification, not owner physical-iPhone acceptance.
Catalog imagery in isolated fixtures uses placeholders; hero artwork/header logo
use the reviewed public assets. No real customer data is included in screenshots.

## Current production and exact deployment hold

Fresh 15:07:51 UTC host observation still confirms
`1fd7ef6909869361 / schema107`, app PID 140566/Caddy PID 26652 and all 17 protected file
hashes unchanged. CARD/COD, Email, bounded tracking and MON remain active. No
production staging, deployment, restart, migration, settings/credential mutation,
provider request, manual email, charge, booking or Auth SMTP action occurred.

An older shipping validator bound 8 Auth accounts. Existing encrypted backups
prove those eight security identities unchanged, with one ordinary active customer
added and no new administrator. Schema/security shape is unchanged. This release
uses a fresh exact 9-account binding; original historical guards/receipts were not
modified. Raw Auth comparison was bounded in memory; no plaintext file/customer
identity was published. No account was created or linked by this work.

**The release guard stopped before sealing on `MONITOR_WARNING_DRIFT`.**
The 15:05 UTC normal MON report has the five original warnings plus a new
`OVERDUE_PAYMENT_UNVERIFIED`, zero critical alerts. Read-only inspection confirms
one additional production CARD order is `pending_payment / pending`; there are
9 live orders. Its reference is retained in private `new-order-readonly.json`.
Do not infer failure, abandonment, payment success or verified collection. No
provider investigation, retry, payment marking, warning clearing or warning-baseline
acceptance was performed. No deployment approval or expiry exists while held.

## Smallest later deployment

Same schema107, app-only archive
`f4318b3a40d13c36915ada5642f2729d1df16ed1e4be631dd0ea602a85888ec6`.
One prospective app restart and one bounded pause/resume of each existing Email/
tracking timer. Zero migrations, SQL/business/settings/runtime/Caddy/Google change;
no worker/provider invocation. Keep live capture/queues, emergency budgets and all
orders. The local rollback is qualified; a production rollback requires a fresh
observed-state approval and preserves current data/settings. No automatic retry or
rollback is available. The source/archive can be reused after a fresh guarded
preflight; do not mint an approval from the stopped attempt.

All 43 original worktrees plus this isolated 44th and all 35 deferred IDs/evidence
remain preserved. Metadata candidate `9b4107c` stays local and undeployed. Search
Console/Google display, genuine historical-owner/PDF acceptance and other deferred
checks remain distinct. Paymob Pixel/Pay Again await the provider response;
detailed PDC commercial reconciliation/ERP remains last.

**ONE next action:** owner reviews the new pending CARD order in Dashboard and
decides its payment follow-up. Then a fresh warning-aware UI preflight can be
qualified for a separate exact deployment approval. No payment/provider action is
authorized by this document.

Google guidance: [snippets and data-nosnippet](https://developers.google.com/search/docs/appearance/snippet),
[site-name branding](https://developers.google.com/search/docs/appearance/site-names),
[favicon discovery](https://developers.google.com/search/docs/appearance/favicon-in-search).
