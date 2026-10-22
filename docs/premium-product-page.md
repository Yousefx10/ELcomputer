# Premium Product Page milestone

Status: architecture/audit and local implementation in progress. Production remains
`40ebcf1f6d50a143`, schema88. No production mutation or new release is authorized yet.
The owner has accepted the deployed Modern Footer; both footers remain untouched.

## Presentation architecture

The existing product route retains one authoritative data request, stock/option
state, quantity limits, preorder checks, cart callback, engagement and SEO pipeline.
Its original template becomes `product/Classic.vue`, without markup changes.
Both presentations consume the route's provided context. Premium has independent
layout and gallery presentation, with no duplicate commerce implementation.

The global selector lives in Dashboard → Settings → Product page. Exactly Classic
and Premium are supported. Classic is the database/application fallback and stays
selected until the owner explicitly changes it. A fresh, public, read-only appearance
endpoint avoids stale SSR style selection; hydration consumes its server payload.

Premium uses a 44/33/23 desktop composition: media, product information, purchase
panel. Tablet uses media/information with a repositioned purchase panel. Mobile
puts product media first, followed by information and purchase status. No duplicate
purchase actions or fixed control may cover the footer, chat or gallery dialog.

## Existing data and missing capabilities

| Capability | Authority/control |
| --- | --- |
| Titles, SKU, descriptions, selling modes | Existing atomic Product Editor save |
| Highlights and technical data | Existing specification library, highlight flags and ordering |
| Product features | Existing product_features; never generated copy |
| Images and color assignments | Existing variant-owned product_images and VPS Media Library |
| Image sequence | Existing sort_order; expose its missing compact editor control |
| Variations and availability | Existing active variant definitions and storefront stock projections |
| Price and savings | Product price/old_price; checkout currently uses product price, not variant price |
| Warranty | Existing product warranty fields |
| Reviews | Existing real-review API/component |
| Related suggestions | Existing category/brand relationships; never imply compatibility |
| Explicit compatibility/curated relationships | Missing; add bounded authored metadata, validate product IDs and publication |
| Product videos | Missing; existing videos are private packing evidence and must stay private |
| Optional sections and policy references | Bounded global Premium presentation configuration; no invented policies |

Only justified missing metadata is additive. Do not duplicate product, price,
inventory, specification, warranty or image records. Product presentation saves
remain separate from the existing core/gallery/specification transactions, with
revision checks, retained drafts and explicit recovery after uncertain responses.

Public product videos require separate validated VPS assets and metadata. Private
packing paths, routes, permissions and files are excluded. New public media must
not bypass image validation or create an unrestricted file server. No external
placeholder service, autoplay, provider embed or Supabase Storage migration.

## Purchase safety

Current Caddy holds checkout/signup independently of saved method availability.
Cash/Card/InstaPay availability is true; Bank/PayPal false. Preserve those values.
Paymob/PDC outbound gates and PDC enable/automatic/reverse settings remain off.

Premium must show the honest held purchase state. A deployment-bound public
presentation gate defaults closed and cannot activate checkout or providers.
Authorized future deployments may configure it only with their existing approved
commerce policy. Classic's current interactions remain unchanged. Both styles
use the same cart callback and server-authoritative product pricing/eligibility.

## Validation and release boundary

Capture Classic baselines before extraction. Compare exact markup, SEO, product
requests, interactions and browser appearance. Use current public catalog records
for representative screenshots; never create production examples to fill gaps.
Missing real variants/video/media scenarios use explicitly isolated fixtures and
remain separate from hosted owner acceptance.

Validate both styles, settings permissions/persistence, native SQL contracts,
gallery keyboard/focus/swipe behavior, stock/cart integrity, SEO, EN/AR,
1440/tablet/small/large mobile widths and Light/Dark/System. Record baseline suite
failures separately. Complete typecheck, clean production build and release guards.

Prepare a new independently sealed Caddy/systemd release. Historical operators,
completed seals and original migrations stay unchanged. Additive schema work
requires final reviewed release approval before production SQL or activation.
Retain verified backups, original files/runtime, rollback inputs and disabled gates.
No Git push. Update README and both handoffs; stop after this milestone's acceptance.

The four owner PDP reference screenshots were not attached with the brief.
Their visual comparison remains pending; the code/catalog audit continues.
Primary reference pages reviewed without copying content or commercial claims:
[MAXESPORT](https://maxesport.gg/fr/products/logitech-g-pro-x-superlight-2-8k-wireless-noir),
[MaxGaming](https://www.maxgaming.com/en/pc-accessories/game-controllers/gamepads),
[Walmart](https://www.walmart.com/ip/113794167).

## Completed local validation

The retained Classic template and original route script are hash-pinned. The shared
script still owns fetching, price, stock, variants, preorder, cart, Auth and SEO.
Premium consolidates repeated authored specification groups, recognizes explicit
box-content labels/groups, and displays an authored model when present. It never
infers specifications, compatibility or variations from product names.

Built-app browser validation passes 264 checks with no runtime/hydration errors,
HTTP failures or external requests. It covers seven genuine published catalog
records, EN/AR, 1440/1024/768/390/320 widths, Light/Dark, OS-following System mode,
Classic/Premium SSR and SEO parity, keyboard/modal/swipe behavior, current variants,
Dashboard persistence/validation, current RLS, video upload/probe/save/playback,
actor changes and responsive editors. Auth is synthetic in this owned PostgreSQL/
PostgREST fixture. It is not hosted owner/RBAC or real-provider acceptance.

The production catalog contains **561 products: 225 published and 336 Draft**.
This was verified through strict-TLS, read-only PostgreSQL on schema88. The earlier
225 count described the anonymous published catalog, not all products. There are
629 total variants, 577 active; 239 active variants belong to the published scope.
Seven exact public profiles contain 45 gallery rows and 95 specifications. Forty-four
unique real image files were downloaded for the isolated review. No production
catalog record, stock value, publication state or file was changed.

No genuinely image-less or positive-stock public product was found in that audit.
Missing media, rich highlights/features/box contents, coming-soon and inactive
preorder scenarios are explicitly owned fixtures. Permitted quantity/cart behavior
uses an existing owned legacy stock fixture and a separate loopback-only runtime
with its presentation gate enabled. Its stock limit and original product price
reach the shared cart. Production commerce remains disabled.

The final production build and typecheck pass. Native tests verify service-only
writes, publication/Draft boundaries, revision conflicts, exact retry receipts,
file validation/immutability/ranges, global reset coordination, product-deletion
tombstones, and non-superuser migration rollback/data preservation. The new remote
phase fault matrix rejects missing approval, wrong scope, corrupt output and
uncommitted migration evidence; failed activation retains evidence without retry.
See [validation qualification](premium-product-validation.md) for full-suite results.

## Operational and compatibility details

Migration89 adds two Settings columns and three private metadata tables. It does
not rewrite existing data. Two existing functions receive exact bounded extensions:
image deletion scans the new authored metadata; reset coverage recognizes only the
three new tables. All inherited locks, ACLs and unknown-table guards are retained.
The release guard compares all other existing schema objects byte-for-byte.

Product presentation/asset rows cascade with product deletion. Minimal command
receipts remain, cannot recreate a deleted product, and retain no media/content
body. Product-video files remain immutable and retained; product deletion removes
public serving authority. Image Media/Full reset does not delete the separate
`product_videos` directory. No video garbage collector or deletion action is added.

`NUXT_PUBLIC_PURCHASING_ENABLED` is a presentation input, default `false`. It must
remain absent or `false` for this deployment. It neither replaces nor opens Caddy,
checkout, signup, Paymob or PDC authority. Saved Cash/Card/InstaPay availability
remains true; Bank/PayPal false. PDC enable/auto/reverse and live requests stay off.
The existing VPS uploads root and `NUXT_PACKING_VIDEO_PROBE_PATH` are reused.

New authenticated routes require current Products edit permission and independent
SQL authorization. The presentation GET/PUT uses `/api/admin-products/:id/presentation`;
video PUT uses `/api/admin-products/:id/videos/:assetId`. Public presentation GETs
live under `/api/storefront`; published videos use `/uploads/product_videos/…`.
All metadata responses avoid caching. Public video revalidation checks current
publication and saved assignment. This production Caddy proxy needs no change.
Retired, sealed Nginx route inventories remain unchanged; other deployments must
review these exact new paths/methods against their own restrictive ingress policy.

The global selector is independent from per-product content editing. Product
Editor → Product presentation saves videos and explicit relationships separately.
Existing Specifications controls manage highlights and attributes. Existing image
rows now expose Display order. Existing core/gallery/spec transactions, revision,
retry, publication and inventory contracts remain independent.
