# Historical linked product options

The schema111 presentation store already links standalone products. This work
extends `catalog_private.product_presentations.content` with optional `family`
metadata. It adds no family table and does not repurpose related/accessory links.
Internal `product_variants.option_values` and all checkout paths remain unchanged.

A family has a stable UUID, one to six authored dimensions, and two to32 existing
product members. Members retain canonical URLs, IDs, SKUs, prices, media and stock.
The same descriptor is synchronized atomically across members by the existing
Products presentation RPC. Removing a member preserves the remaining family;
a group with fewer than two members dissolves. This is presentation metadata,
not a shared product, inventory pool or purchasable SKU.

The existing Products view/edit authority, service-mediated API, private RLS,
revision conflicts, request receipts, audit and in-memory draft recovery remain.
All graph changes use the existing advisory lock. Family changes advance affected
members' presentation revisions; unrelated videos/accessories are preserved.
Duplicate members/combinations, invalid/missing targets, cross-brand/category
links and overlapping groups are rejected. Semantic membership also requires
explicit staff confirmation. Staff must edit an existing member to add products
to that group; unrelated groups cannot be merged through the selector.

Modern PDP links navigate to real products. The active member is marked with
`aria-current=page`. Internal SKU options have their own heading when both exist.
Dimension choices retain the other current attributes; a complete-combination
list exposes real alternatives when several dimensions change together. No
Cartesian combinations are created. Hidden products never appear publicly.
EN/AR, RTL, themes, touch targets and ordinary link keyboard access are supported.
Swatches use authored hex values or a standard CSS color matching an explicit
color name. Unknown finishes use text. No default archived white hex is copied.

## Historical evidence

The protected current WordPress archive remains unchanged and is parsed only as
MySQL data with authenticated decryption. No WordPress/PHP/SQL or plugin executes.
WPCode record8565, “switch Color”, creates `_cv5_links`: ordered product IDs,
`color_name`, title, URL and image, synchronized to every listed product. Its
`active` flag identifies the current product; it is not an activation toggle.
The source-code SHA256 is
`5401a7b972a51c8df32749a659695351c4c6ad7fb527dbd4314ba29feeb531d6`.

The frozen source has626 products and73 true child variations. Its type taxonomy
identifies556simple,55variable,1external and no grouped products;14 lack a type
assignment. Child variants remain internal. `_upsell_ids` on444products,
`_crosssell_ids` on466, bought-together/bundle metadata, and generic category
relatedness do not establish families and are excluded.

109nonempty CV5 records form37components. Only reciprocal, identical ordered
membership and labels qualify. Exact existing legacy query/slug mappings plus
nonconflicting SKUs identify560current products;66source identities are unmapped.
18groups/45products/76directed choices qualify automatically.19CV5 components
are held:18contain unpublished members; conflicts, missing IDs, duplicate option
labels (including case-only values) and one cross-brand/category case overlap.
Five missing CV5 targets are5909,6028,6930,7143,7192. No source identity/SKU or link
metadata has conflicting duplicate rows.

One older `_color_links` record and WPC Linked Variations post8445 are separate
review entries. The WPC record references7187/7277 and attribute ID1, which is
SWITCH, despite the post title “Keyboards Colors”. It overlaps other CV5 groups;
no automatic union or title-based color inference is justified. Both entries are
held. Explicit repeated model metadata yields no additional review candidates.
These counts describe review entries, not39disjoint verified families.

The deployment-specific map is
`deployments/elcomputer/product-families-20261104.json`. Generic application logic
contains no store identity or source/target product IDs. Exact source spellings
remain; no descriptions, model combinations or physical color values are invented.

## Production boundary

Local evidence is not a live migration. Proposed schema112 is one additive
function-only migration, followed in the same guarded transaction by18existing
presentation commands. They create45presentation rows,18receipts and18audits.
There are zero product/variant/URL/SKU/price/stock/order/history writes. The
original WooCommerce catalog import is never called. Deterministic command IDs
provide exact idempotent receipt recovery; a consumed release operator is never
replayed, including after uncertainty.

The release requires fresh exact approval, live source/schema/asset/runtime/
financial/MON checks, encrypted backup readback and preserved worktrees. It permits
one app cutover/restart and one bounded pause/resume for MON/Email/PDC. Runtime,
Caddy, providers, charges and payment activation are outside scope. Preserve scoped
Pixel/Apple, CARD/COD/EGP10, inactive InstaPay, pending uncertainty and paused work.
On drift or uncertainty, retain receipts and stop; no automatic rollback or replay.
Postflight must verify the receipt, exact metadata, assets, public links and next
natural MON report before claiming deployment. Owner acceptance remains separate.
