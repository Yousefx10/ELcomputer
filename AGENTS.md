# Project copy

- Keep user-facing paragraphs short and natural.
- Prefer one direct sentence, usually under 12 words.
- Avoid filler, promotional language, and AI-style explanations.
- Apply this to storefront, dashboard, login, and signup screens.

# Product Manager and Dashboard UI

- Preserve the current Dashboard design identity and existing components.
- Reuse typography, colors, spacing, tables and forms. Keep layouts compact.
- Avoid flashy gradients, oversized cards, excessive rounding, decorative icons
  and unnecessary animations. Do not replace existing screens with generic layouts.
- Use concise, natural labels and errors. Never invent product descriptions,
  specifications, media or business facts.
- Preserve EN/AR, RTL, Light/Dark/System and responsive behavior.
- Product save reliability work permits only necessary saving, error and conflict
  controls; a wider redesign needs its own authorization.
- Follow [Product save safety](docs/product-save-safety.md) for the transaction,
  revision, retry, audit, inventory and confidentiality contracts.
- Follow [Media safety](docs/media-safety.md) for scoped public-image access,
  reference guards, deletion recovery and content validation. Extend reference
  coverage when adding media-bearing tables; keep private Storage separate.
- Follow [Product editor safety](docs/product-editor-safety.md) for draft defaults,
  dirty-state navigation, independent section saves and in-memory draft retention.
  Keep creation Draft-first; never weaken required fields or claim one transaction
  across product details, gallery and specifications.
- Follow [Product listing](docs/product-listing.md) for bounded server search,
  named Products permissions, confidential projections, available-stock meaning
  and URL/editor return continuity. Preserve compact desktop/mobile rows and
  distinguish failed requests from empty catalogs. Never add catalog demo data.
- Follow [Product bulk operations](docs/product-bulk-operations.md) for current-page
  selection, sparse commands, confirmation, revision checks and receipt recovery.
  Keep assignment explicit; never infer clearing or select all matching products.
  Retain unresolved batch commands and report partial results accurately.
- Follow [Catalog transfer](docs/catalog-transfer.md) for versioned merchandising
  exports, exact matching and private bounded preview. Preview never applies changes.
  Preserve omitted versus cleared values and confidential inventory/ERP boundaries.
  Task 6B requires separate authorization, transactional revalidation and receipts.
