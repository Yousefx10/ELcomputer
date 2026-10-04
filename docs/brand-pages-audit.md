# Brand landing pages — audit, 2026-10-03

The current brand table has public identities, English slugs, optional logos and SEO fields. Product `brand_id` relationships already exist. Public read and authenticated `brands.add` / `brands.edit` RLS govern brands. The existing catalog tab lists, creates and edits brands; the legacy dashboard route redirects into that tab. Before this change, editing a name regenerated its slug.

There is no dedicated public brand page. Homepage brand logos, autocomplete and product brand links use `/search?brand=<slug>`. Search supports price/category/brand/availability filters, sorting and 12-product pagination. The storefront product view supplies safe pricing/stock projections, and the existing product card owns cart/option selection behavior.

Custom pages store safe Markdown with publication and text-direction controls. There is no generic block/media-row model to reuse. Existing product specification rows use keyboard-accessible up/down reorder buttons. Brand content therefore uses a single additive JSONB document on the existing brand record, with stable row/media IDs and array order. A single save commits the entire brand document atomically under current brand permissions.

The Media Library and host upload endpoint support images, an 8 MB limit and section permissions. They do not provide public video uploads, focal positions or responsive image transformations. The editor reuses the image fields/library for hero, mobile hero, wallpaper, row images and video posters. Videos use a controlled URL model: HTTPS MP4/WebM or validated YouTube/Vimeo IDs. Private packing video infrastructure is unrelated and remains untouched.

SEO discovery previously included indexable brand filter URLs. The landing route becomes the single brand canonical; old brand-only filters remain functional with `noindex,follow` and the landing canonical. Sitemap/llms discovery moves to the new routes, with the same English slugs. Existing `/ai/brands/{slug}.md` endpoints and shared negotiated renderer remain in place. Category URL identities and unrelated SEO behavior stay intact. The reserved CMS root adds `brand`; a live read checks existing pages for collisions before release.

Locale routing remains Nuxt i18n's existing EN and `/ar` pattern. Brand names and authored copy are retained, with `dir="auto"` for story/hero copy; editor labels and product controls have real EN/AR UI translations. No brand content is automatically translated.

The repository was clean on base `842a15dcd4247e214b9db32d168daca9fb11b659`. The earlier ERP stop note is historical: the previous task verified its migration and deployed worker markers. This task does not alter ERP sources. Only the additive brand migration and this application's guarded release are in scope.
