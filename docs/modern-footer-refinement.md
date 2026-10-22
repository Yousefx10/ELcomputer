# Modern Footer design refinement — 2026-10-22

**Local presentation PASS. Application-only release preparation is in progress.**

Current production remains `d1b10bb664e15a67`/schema 88. The completed 87→88
operator and its consumed approval are unchanged and cannot be reused.

## Presentation

The main layout groups branding, usable navigation and newsletter content.
It reserves space only for populated groups. Two navigation columns share one
group, so missing links never leave an empty column or orphan heading.

Logo bounds increase from 190×44 to 292×104 pixels on desktop and 280×96 on
mobile, retaining aspect ratio. A store-name fallback has deliberate display
typography. Existing Light/Dark assets remain authoritative; images are not
recolored or cropped. Description line breaks remain visible.

Tablet gives branding a full-width row. Mobile keeps the navigation groups
side by side, with branding and newsletter spanning the available width.
Short configurations collapse to compact rows. Long labels wrap within columns.

The unavailable newsletter has a contained form, subdued controls and an explicit
status. Its fieldset stays disabled; no subscription backend or collection is added.
Support, app badges and approved-method logos retain their configurable grouping.
A single utility section shares a compact lower bar with copyright/legal content.
Multiple utility sections retain separate dividers and reflow on smaller screens.

## Preserved contracts

Only `ModernFooter.vue` and its dedicated stylesheet change application behavior.
Classic's template and stylesheet remain unchanged. The settings model, Dashboard
editor, URL validation, section ordering/toggles, EN/AR data, media references,
SSR year handling and payment-availability filtering remain unchanged.

No migration, stored content update, theme-logo replacement, gate change or provider
request is part of this refinement. Current owner-configured JSON must remain intact.

## Local validation

- Five existing footer tests pass, including Classic preservation, Settings RLS,
  additive compatibility, media references, URL rejection and payment gating.
- Node 22.23.1 typecheck and empty-dotenv production build pass.
- Browser review passes 483 checks and captures 101 screenshots. It includes actual
  Dashboard saves/reloads/permissions on disposable native PostgreSQL/PostgREST,
  EN/AR, 1440/900/390px, Light/Dark, sparse/partial/brand-hidden/support-only/long-copy
  cases and the current saved public content with downloaded theme logos.
- Real Nuxt output renders/hydrates the saved-content preview with actual icons,
  both locales and three sizes. No page/hydration warning or external traffic occurs.
- Auth and media selection in the Dashboard fixture remain explicit local adapters.
  No authenticated hosted settings save/upload or Classic/Modern switch is claimed.

Protected evidence is outside Git in parent `modern-footer-refinement-20261022/`.
Actual saved content and assets remain private review inputs, never application
defaults or committed business data. `FOOTER_REVIEW_CONTENT` optionally supplies
the public content response plus sibling `logo-light.png`/`logo-dark.png` files to
the local browser harness. No production runtime input is added.

## Release and owner checks

Prepare a new sealed application-only release through the established Caddy/systemd
phases. Bind schema 88, fresh protected-state hashes, verified recovery backups,
the exact candidate and current client assets. Do not call a migration executor.
Final reviewed digest approval must precede production activation. Once approved,
deploy this refinement immediately, before unrelated work.

After deployment, check `/` and `/ar` at desktop, tablet and mobile widths in
Light/Dark/System. Check logo scale, navigation balance, newsletter status, compact
support/legal grouping, RTL, focus, images and overflow. Then verify one reversible
footer edit saves/reloads, restore it, and check both styles. Keep every commerce
gate disabled. Record hosted owner acceptance separately from local fixture proof.
