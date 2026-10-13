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
