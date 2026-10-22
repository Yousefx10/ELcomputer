# Modern Footer design refinement — 2026-10-22

**Deployed PASS: `40ebcf1f6d50a143`, schema 88 unchanged.**

The owner approved the exact refinement seal. Application `3b98164` is active;
retained `d1b10bb664e15a67` remains intact. Completed operators and consumed
approvals are unchanged and cannot be reused.

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
Mobile payment logos distribute into balanced rows based on the visible count.

## Preserved contracts

Only `ModernFooter.vue` and its dedicated stylesheet change application behavior.
Classic's template and stylesheet remain unchanged. The settings model, Dashboard
editor, URL validation, section ordering/toggles, EN/AR data, media references,
SSR year handling and payment-availability filtering remain unchanged.

No migration, stored content update, theme-logo replacement, gate change or provider
request is part of this refinement. Current owner-configured JSON must remain intact. Read-only verification found
Cash/Card/InstaPay availability enabled, Bank/PayPal disabled. These saved values
remain exact. They do not open the held checkout/signup routes or disabled live
Paymob/PDC transports. The new app-only release binds actual availability values
instead of changing them to the previous migration release's off-only baseline.

## Local validation

- Five existing footer tests pass, including Classic preservation, Settings RLS,
  additive compatibility, media references, URL rejection and payment gating.
- Node 22.23.1 typecheck and empty-dotenv production build pass.
- Exact-artifact browser review passes 533 checks and captures 107 screenshots. It includes actual
  Dashboard saves/reloads/permissions on disposable native PostgreSQL/PostgREST,
  EN/AR, 1440/900/390px, Light/Dark/System, sparse/partial/brand-hidden/support-only/long-copy
  cases and the current saved public content with downloaded theme logos.
- Real Nuxt output renders/hydrates the saved-content preview with actual icons,
  both locales and three sizes. Live OS theme changes also switch the theme logo.
  No page/hydration warning or external traffic occurs.
- Auth and media selection in the Dashboard fixture remain explicit local adapters.
  No authenticated hosted settings save/upload or Classic/Modern switch is claimed.

Protected evidence is outside Git in parent `modern-footer-refinement-20261022/`.
Actual saved content and assets remain private review inputs, never application
defaults or committed business data. `FOOTER_REVIEW_CONTENT` optionally supplies
the public content response plus sibling `logo-light.png`/`logo-dark.png` files to
the local browser harness. An optional sibling `review-assets.json` maps configured
image paths to private local copies and MIME types. Only owned fixture data changes
when these availability values are exercised. No production runtime input is added.

## Release and owner checks

The [sealed application-only release](modern-footer-refinement-release.md) passed
through the established Caddy/systemd phases after exact owner approval. Release
`40ebcf1f6d50a143` preserves schema88, protected data, settings, all media, runtime
configuration and client assets. No migration or SQL write ran. One controlled
storefront restart followed the private candidate's success. Public browser review
passes 318 checks/18 screenshots across both locales, three widths and all themes.
No page/hydration errors or overflow occurred; analytics writes were blocked.
The existing chat-status 403 remains. The plan is consumed; never repeat apply/check.

After deployment, check `/` and `/ar` at desktop, tablet and mobile widths in
Light/Dark/System. Check logo scale, navigation balance, newsletter status, compact
support/legal grouping, RTL, focus, images and overflow. Then verify one reversible
footer edit saves/reloads, restore it, and check both styles. Keep every commerce
gate disabled. Record hosted owner acceptance separately from local fixture proof.
