# Public AI readiness

AI readiness exposes the store's existing **public, authoritative content** in a compact discovery guide and readable Markdown. It adds no chatbot, model calls, generated content or private-data access. Existing HTML, canonical URLs, hreflang, JSON-LD, authentication and RLS remain authoritative.

## Discovery and rendering

`GET /llms.txt` returns UTF-8 `text/markdown`. It enriches the **same filtered records and 60-second discovery cache used by the sitemap**; there is no second catalog crawler. Its bounded sections contain at most eight product examples and twenty entries per other group. Optional links point to the complete public HTML sitemap and Arabic overview. Empty groups are omitted. Required discovery failures return 503 with `no-store`, rather than an incomplete authoritative guide.

Explicit, reusable Markdown endpoints avoid changing HTML responses based on `Accept`, user agents or cookies:

| Public content | Markdown URL |
| --- | --- |
| Store overview | `/ai/index.md` |
| Product | `/ai/products/{slug}.md` |
| Populated category | `/ai/categories/{slug}.md` |
| Populated brand | `/ai/brands/{slug}.md` |
| Published CMS page, including nested paths | `/ai/pages/{path}/index.md` |
| Help overview | `/ai/help/index.md` |
| Published article in an active category | `/ai/help/{category}/{slug}.md` |

Arabic counterparts prefix these paths with `/ar`. The AI namespace is reserved from future CMS paths. Arbitrary resources and malformed/private paths return 404; query parameters return 400. No general-purpose table or file export is provided. `llms-full.txt` is deliberately omitted: agents use targeted, current product requests instead of downloading a stale full catalog.

Indexable HTML carries one `rel="describedby"` link to the guide and, when supported, one `rel="alternate" type="text/markdown"` link. Markdown responses include HTTP canonical/describedby relationships, `nosniff`, and `X-Robots-Tag: noindex,follow` to keep HTML as the search representation. Existing canonical/meta/schema and locale relations are preserved. No experimental content-negotiation or Content Signals headers are shipped.

Product rendering selects customer-visible parent price in EGP, SKU, brand, descriptions, visible specifications, features and availability from existing public product data. Reviews retain only the public aggregate and count from the existing public review API; response items, bodies and identities are discarded. Direct anonymous review-table reads are denied in production and are not introduced. Optional review failures omit the aggregate. Availability follows existing storefront stock/active-variant and backorder rules; Coming Soon is not purchasable. Preorder checks the existing authoritative public availability API and fails safely if that check fails. It never exports the RPC's order/allocation details. Existing commerce and SEO schema logic are unchanged.

## Freshness and privacy

- Product Markdown is `no-store`: price, inventory and preorder windows are read on each request.
- The guide, overview and stable CMS/help/catalog responses use `public, max-age=60`, consistent with SEO discovery. Cached discovery links may lag publication changes by up to 60 seconds. Detailed CMS/help/product requests recheck publication/noindex/active state; client caches of stable bodies can also lag by that TTL.
- Readers use the existing anonymous Supabase client and explicit public projections. The preorder helper reuses the existing guarded public API. No new privileged query, grant, table or policy is introduced.
- Account, cart, checkout, dashboard, order, support, chat, internal APIs, uploads and private documents are outside the route allowlist. Draft/noindex CMS and inactive/draft Help content are excluded. Internal IDs used for joins are not rendered.
- Customer identities, contacts, addresses, orders, messages, internal notes, employee/admin data, costs, ERP fields and API keys are not selected or serialized. Authored URLs/images, including storage/attachment URLs, are removed from Markdown; generated links use only validated canonical public paths. Stored text is escaped as data.
- Public authored content remains public authored content: these renderers cannot discover or remove arbitrary sensitive prose that a staff member deliberately publishes. Publishing review remains the existing administrative responsibility. Existing public HTML may retain links omitted from this conservative Markdown view.

English uses unprefixed URLs and Arabic uses `/ar`, reusing the canonical/locale helpers. Locale means **interface locale**, not a claim that catalog, reviews or CMS text was translated. Saved content retains its authored language. No translation keys or catalog/CMS content are changed.

## Crawler preferences

Defaults preserve existing public access: **search/assistants allowed; training allowed**. Two private Nuxt runtime settings can express independent robots preferences:

| Runtime environment variable | Default | Scope |
| --- | --- | --- |
| `NUXT_AI_SEARCH_ALLOWED` | `true` | OAI-SearchBot, ChatGPT-User, Claude-SearchBot, Claude-User, PerplexityBot, Perplexity-User |
| `NUXT_AI_TRAINING_ALLOWED` | `true` | GPTBot, ClaudeBot, Google-Extended |

Set a value to `false` to emit `Disallow: /` for its group. No environment changes were necessary for the default release. Normal `User-agent: *` and sitemap rules remain unchanged. Allowed specific AI groups repeat private restrictions because specific groups do not inherit the wildcard rules. Cart/checkout/auth/support paths are additionally excluded from AI groups. Other bots, including mixed-purpose Meta/Common Crawl agents, retain the existing wildcard policy rather than receiving an invented classification.

**Robots is a voluntary preference, not a firewall or authorization mechanism.** Providers describe user-triggered fetchers differently; ChatGPT-User and Perplexity-User may fetch on a user's request despite robots preferences. A training opt-out is not a universal guarantee about every model or historical use.

Google-Extended controls Google AI training **and some Gemini/Vertex grounding**. It is not Googlebot and does not change normal Google Search inclusion/ranking. Because its functions are coupled by Google, this application's training-group setting also affects that grounding use. It cannot independently allow those two Google-Extended purposes.

An optional dashboard policy panel was omitted: persistent settings would need new database columns. Deployment-time settings fit the existing runtime configuration and require **no migration**. No ordinary administrator is presented with a technical bot firewall.

## Cloudflare and Content Signals

The repository contains no authorized Cloudflare AI integration. Release HTTP responses identify Nginx; that alone cannot prove whether a Cloudflare account or proxy exists. External account configuration is **not verified and was not changed**.

If Cloudflare is used later, optionally enable AI Crawl Control monitoring and review crawler traffic/robots violations first. Apply selected enforcement rules only after reviewing search, assistant and training effects. Cloudflare-managed robots can prepend its own training policy; check the final public `/robots.txt` for conflicts with this application's defaults. Enforcement rules are separate from voluntary robots text and may block user fetchers too.

Cloudflare's emerging Content Signals vocabulary (`search`, `ai-input`, `ai-train`) is provider-specific policy signalling. This task documents it without blindly shipping headers/directives or claiming universal recognition. The llms v2 document is a proposal, not proof that every AI service discovers or consumes the guide.

## Sources checked for this implementation

- [llms.txt v2 proposal](https://llmstxt.org/): compact Markdown guide and alternate/describedby relationships.
- [OpenAI crawler documentation](https://developers.openai.com/api/docs/bots): independent search/training bots and user-fetch limitations.
- [Anthropic crawler documentation](https://privacy.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler): search, user and training purposes.
- [Perplexity crawlers](https://docs.perplexity.ai/docs/resources/perplexity-crawlers): search indexing and user fetches.
- [Google common crawlers / Google-Extended](https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers): AI purposes independent of Googlebot.
- [Cloudflare AI Crawl Control](https://developers.cloudflare.com/ai-crawl-control/), [robots monitoring](https://developers.cloudflare.com/ai-crawl-control/features/track-robots-txt/) and [managed robots / Content Signals](https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/).

## Verification and review

Focused tests cover bounded discovery, public projections, sentinels for private data, draft/noindex/active guards, Markdown escaping, minimal products, availability, locale paths, independent policies, Googlebot preservation and unchanged SEO output. Released application SHA `2e5d8f9e362f7ffcd49dcd490607ab5a6a9e3185`; backup `/home/newelcomputer/htdocs/new.elcomputer.net/.output-deploy-backup-20261001-105644-19040`. Fresh final checks passed 200 tests, typecheck/build/diff, 27 fixture HTTP cases and 44 real-catalog HTTP resources locally. Production passed 44 AI HTTP resources, 32 SSR pages, 40 storefront screens and four authenticated dashboard screens. Sitemap matches 142 localized URLs/426 alternates; Live Chat status/open-close and protected redirects passed. Public-output secret scan passed on both local and guarded release builds (108 files, one secret type, zero matches). No new application exceptions were found; authenticated SSR emitted the existing SDK session-user warning. Nginx adds its existing nosniff header alongside the app header; equivalent combined tokens were verified. Database counts and catalog/CMS/settings fingerprints are unchanged. Detailed evidence is under `/tmp/elcomputer-ai/` and in `PROJECT_STATE.md` / `CODEX_HANDOFF.md`.

Review `/llms.txt`, `/robots.txt`, `/sitemap.xml`, a real product and its `/ai/products/{slug}.md` and `/ar/ai/products/{slug}.md`, `/ai/categories/mouse.md`, `/ai/brands/jedel.md`, `/ai/pages/shipping-policy/index.md`, and `/ai/help/index.md`. Production has no published Help articles at release; article rendering is checked with isolated read-only fixtures. Dashboard SEO/settings/pages and human Live Chat retain their existing controls. No authenticated customer order/payment/chat-message submission is required or claimed by this task.
