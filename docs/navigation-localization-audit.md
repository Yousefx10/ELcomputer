# Storefront navigation and category localization audit — 2026-10-03

## Existing architecture

The public layout uses `LayoutTopBar`, sticky `LayoutNavBar`, `LayoutSearchBar`, and `LayoutFooter`. Preferences live in the top bar. The header has logo, search, orders, account, and cart; the second row has a scrolling link strip and a department popover. Mobile keeps that concept and moves search below the logo/actions. There is no separate mobile drawer to replace.

Category identities are shared records in `public.categories`, referenced by products. The schema has `name`, `slug`, image and optional SEO overrides. No catalog translation table or localized category name field existed. Dashboard categories save directly through Supabase with existing permission checks and RLS; there is no separate product-category CRUD API. Header content uses `/api/storefront/content` and `useSiteContent`; shop, home, product breadcrumbs and autocomplete use existing public projections.

Categories use `/search?category=<English slug>` and `/ar/search?category=<same slug>`. The requested `/category/...` examples are conceptual, not existing routes. SEO, hreflang, discovery, sitemap and AI Markdown already use this identity. Nuxt i18n uses `prefix_except_default`; `NuxtLinkLocale`, `useUiRoute`, and `setLocale` preserve route/query identity. Stored content is not passed through the UI-label translator.

Theme preferences use Nuxt color mode, system/default selection, and existing choice/color-mode cookies. The shared button toggles Light/Dark; an untouched System preference follows OS appearance. NPS uses native radio inputs for 0–10, visitor eligibility, detractor feedback, an idempotent response ID, and a 90-day cooldown. Its server endpoint and submission script are unchanged.

## Issues found

- Orders were hidden below 1200px; compact account/cart links lacked 44px targets.
- Mobile actions had large gaps, making restored orders consume unnecessary width.
- Preference borders and the 20px theme icon looked heavy; preference targets varied by width.
- Top-bar text and long department names needed explicit wrapping safeguards.
- NPS used large heading/card padding and switched to eleven columns at 640px even when its form was narrower.
- Nested NPS margins further reduced phone score targets; its inherited dark gradient impaired contrast.
- The category editor had an unlabeled source-name input, no Arabic field, and regenerated slugs from edited English names.

## Scope boundary and current state

ERP files are outside this task. The ERP handoff's deployment status was stale: the linked database lists `20261003120000` remotely, and read-only production inspection finds the current claim/finish/lease worker safeguards. This task changes no ERP source, worker setup or configuration. The only task migration is nullable `categories.name_ar`; it changes no existing values, identifiers, relationships, grants or policies.

## Verification approach

Use isolated staff-authored Arabic fixtures for translated/long names and an untranslated category for fallback. Verify actual components in Chrome at 1440, 1280, 1024, 834, 768, 430, 390, 375 and 360px, EN/AR and Light/Dark. Verify the actual category editor with isolated authentication and intercepted database mutations. Do not insert artificial production translations or feedback. NPS browser submission payloads are intercepted; the real isolated PostgreSQL schema verifies score persistence, bounds and cooldown. Record production acceptance separately from these fixtures.
