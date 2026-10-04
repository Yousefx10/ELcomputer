# Brand landing pages

Each public brand has `/brand/{English slug}` and `/ar/brand/{same slug}`. Existing names, logos, relationships and SEO fields remain authoritative. Names and authored hero/story/media copy keep their saved language; UI labels are localized and authored text uses automatic direction. No translations or sample brand content are populated.

## Content model

`brands.brand_page` is an additive JSONB document. Empty `{}` produces a clean heading, optional logo and products. Version 1 contains:

- `hero`: desktop/mobile image URLs, headline, supporting text, optional CTA label/link, start/center/end alignment and overlay strength.
- `background`: optional wallpaper URL and six-digit color. Editorial and product surfaces inherit the site's light/dark theme for readability.
- `story`: title, safe Markdown content and supporting copy.
- `rows`: up to 30 ordered rows. Every row and child has a stable ID. `layout` is `one` or `two`, with at most one or two media items respectively. Array order is display order.
- Media items: `id`, `type` (`image`/`video`), `url`, optional `poster`, `alt`, `caption` and image `link`.

Whole-document updates are atomic, so reordering cannot leave partially saved child records. Database checks bound document size and row count. The server validates types, IDs, lengths and media/link URLs; public readers construct an allowlisted document and ignore unknown keys. No upload metadata or internal fields belong in this public content.

## Editing

Open Dashboard → Catalog → Brands. Create a brand or edit an existing one. Its current English slug stays fixed, including after a name change. New brands use the existing English-name slug rules.

Expand Hero, Background or Story as needed. Images and posters use the existing Media Library/upload field and brand upload permissions. Pick a mobile hero only when a different crop is needed. White hero text has a minimum 55% dark overlay; staff can increase it to 85%.

Add content rows, select one or two media items, then choose images or videos. Move rows with the up/down buttons. Removing a row/item or replacing a source asks for confirmation. The published view skips absent sections and incomplete media. Save the brand once to commit all changes. “View saved brand page” opens its actual public page.

Video sources are HTTPS MP4/WebM, YouTube or Vimeo. Provider URLs become controlled embed URLs; arbitrary iframe/HTML markup is rejected. Video uploads are not added to the image-only Media Library. Captions are editorial text, not closed-caption tracks.

## Storefront and performance

The hero is image-first with responsive cropping and optional mobile source, a visible heading and readable copy. Story uses an asymmetric editorial layout. Media rows use restrained framing, preserve aspect ratio and stack below 700px. Missing fields hide cleanly.

Provider videos with posters show a keyboard-accessible load button before requesting the embed.

Hero images have dimensions and high fetch priority. Non-hero images and provider frames load lazily; direct videos use controls, `playsinline`, `preload="none"` and optional posters. No autoplay or new animation is added. Existing infrastructure has no image transformation service; staff should select appropriately compressed images.

Products follow the editorial content. The public storefront product projection filters the fixed brand ID and publication status. It uses existing product cards, prices/stock/option/cart behavior and the shared grid, with 12 products per page. Category, availability and existing sorting modes are supported. Filter/page links retain the brand slug and scroll to products.

## SEO and AI

The shared SEO helpers prefer saved brand SEO fields, then brand name/story/hero/logo. EN/AR/x-default alternates use identical English slugs. Base landing pages index; product filter/page variants use `noindex,follow` and the base brand canonical. Existing brand-only search URLs remain functional with `noindex,follow` and the landing canonical, so they do not compete.

Sitemap and llms discovery use `/brand/{slug}` for every valid public brand; old brand-filter sitemap entries are removed. Product/category/CMS/help identities are preserved. `brand` is reserved from new CMS paths, with a collision check before release.

The existing `/ai/brands/{slug}.md` and `/ar/ai/brands/{slug}.md` endpoints remain. The shared explicit/negotiated renderer includes allowlisted hero/story/caption text and up to 25 published products, including brands with no products. Media URLs, stable IDs, admin fields and Media Library metadata are omitted. HTTP Link, Vary, cache, robots/content-signal and private-route rules reuse the deployed architecture.

## Permissions and acceptance

The existing brand RLS is preserved. Authenticated create/update APIs require `brands.add` / `brands.edit`, retain existing slugs server-side and record existing admin activity logs. Public reads use the anonymous Supabase client, not service-role access. Existing delete and upload permissions remain.

See `brand-pages-audit.md` and `brand-pages-report.md` for validation and deployment evidence. Local authenticated editor acceptance uses isolated auth/data through the real API. A real staff production save and third-party video playback must be distinguished from those fixtures.
