# Public AI readiness

AI readiness exposes the store's existing **public, authoritative content** in a compact discovery guide and readable Markdown. It adds no chatbot, model calls, generated content or private-data access. Existing HTML, canonical URLs, hreflang, JSON-LD, authentication and RLS remain authoritative.

## Discovery and rendering

`GET /llms.txt` returns UTF-8 `text/markdown`. It enriches the **same filtered records and 60-second discovery cache used by the sitemap**; there is no second catalog crawler. Its bounded sections contain at most eight product examples and twenty entries per other group. Optional links point to the complete public HTML sitemap and Arabic overview. Empty groups are omitted. Required discovery failures return 503 with `no-store`, rather than an incomplete authoritative guide.

Explicit, reusable Markdown endpoints remain available alongside opt-in content negotiation on supported public HTML URLs:

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

Indexable HTML carries one `rel="describedby"` link to the guide and, when supported, one `rel="alternate" type="text/markdown"` link. Successful public HTML also advertises the same relationships in HTTP `Link` headers. `usePageSeo` supplies the final publication/noindex-aware relationships to a Nitro response hook; no second content query or canonical rule is introduced. Missing, unpublished, private and noindex HTML has no AI discovery header. Public reviews can advertise the guide without claiming a nonexistent Markdown alternate. Existing Link values are retained; no additional HTML canonical header is added.

Explicit and negotiated Markdown responses retain canonical/describedby HTTP relationships, `nosniff`, and `X-Robots-Tag: noindex,follow` to keep HTML as the search representation. Existing canonical/meta/schema and locale relations are preserved.

### Accept negotiation and caching

For GET/HEAD on supported homepage, product, single populated category/brand, CMS and Help URLs, `Accept: text/markdown` invokes **the same `servePublicAiResource` reader and renderer** as the explicit route. There is no redirect, internal request forwarding, second serializer or duplicated business logic. Normal browser requests, absent Accept and generic wildcards retain HTML. Explicit media qualities are respected; equal explicit HTML/Markdown qualities prefer HTML. Explicit Markdown can win an equal generic wildcard. HEAD returns the corresponding headers without a response body.

Both representations carry `Vary: Accept` on candidate routes, including failed negotiated requests. Product Markdown stays no-store; stable public Markdown retains max-age=60. HTML retains its existing cookies/cache behavior. Nginx may additionally append Accept-Encoding; multiple Vary tokens are valid. The application does not alter Nginx or configure an external CDN. Any future cache must honor Vary and no-store. Verification alternates HTML → Markdown → HTML on the same URLs, comparing each negotiated body with the explicit renderer.

Only clean resource URLs and the exact single `category` or `brand` identity are supported. Additional query parameters, including tracking, pagination or unexpected names, return generic 400/no-store for Markdown requests. Combined filters/arbitrary searches have no negotiation capability. Private/account/cart/checkout/auth/support/API/upload/asset routes never negotiate Markdown. Fresh publication/active/noindex guards still yield 404, and failed discovery yields generic 503/no-store. English and Arabic resolve through the existing locale helpers; cookies, user agents, scanner identity and request Host never determine the Markdown facts or canonical origin.

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

Set a value to `false` to emit `Disallow: /` for its group. No environment changes were necessary for the default release. Normal wildcard crawling restrictions and sitemap rules remain unchanged; the Content Signals extension is additive. Allowed specific AI groups repeat private restrictions because specific groups do not inherit the wildcard rules. Cart/checkout/auth/support paths are additionally excluded from AI groups. Other bots, including mixed-purpose Meta/Common Crawl agents, retain the existing wildcard policy rather than receiving an invented classification.

**Robots is a voluntary preference, not a firewall or authorization mechanism.** Providers describe user-triggered fetchers differently; ChatGPT-User and Perplexity-User may fetch on a user's request despite robots preferences. A training opt-out is not a universal guarantee about every model or historical use.

Google-Extended controls Google AI training **and some Gemini/Vertex grounding**. It is not Googlebot and does not change normal Google Search inclusion/ranking. Because its functions are coupled by Google, this application's training-group setting also affects that grounding use. It cannot independently allow those two Google-Extended purposes.

An optional dashboard policy panel was omitted: persistent settings would need new database columns. Deployment-time settings fit the existing runtime configuration and require **no migration**. No ordinary administrator is presented with a technical bot firewall.

## Cloudflare and Content Signals

The repository contains no authorized Cloudflare AI integration. Release HTTP responses identify Nginx; that alone cannot prove whether a Cloudflare account or proxy exists. External account configuration is **not verified and was not changed**.

If Cloudflare is used later, optionally enable AI Crawl Control monitoring and review crawler traffic/robots violations first. Apply selected enforcement rules only after reviewing search, assistant and training effects. Cloudflare-managed robots can prepend its own training policy; check the final public `/robots.txt` for conflicts with this application's defaults. Enforcement rules are separate from voluntary robots text and may block user fetchers too.

### Content Signals

The follow-up emits the documented `Content-signal` robots directive, reusing the two existing settings. With default policy:

```text
User-agent: *
Content-signal: search=yes, ai-input=yes, ai-train=yes
```

`ai-input` follows AI search/assistant policy; `ai-train` follows training policy. Wildcard `search=yes` preserves ordinary search permission because this provider's search category includes normal indexing. Within existing specific AI groups, `search` follows AI search policy too. Their Allow/Disallow behavior remains unchanged; Googlebot remains wildcard, Google-Extended remains in its existing training group. This is a use preference, not enforcement or universal crawler support. Experimental content-use extensions are omitted.

Cloudflare account configuration remains unverified/unchanged. If managed robots is enabled later, inspect the **final public robots.txt** for prepended signals/rules and conflicts. No external enforcement is claimed. See the [provider documentation](https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/) for semantics. The llms v2 document remains a proposal, not proof that every AI service consumes the guide.

### Intentionally unsupported protocols

No MCP/WebMCP, Agent Skills/ARD, API Catalog, OAuth/OIDC discovery, Protected Resource, auth.md, DNS-AID, Web Bot Auth, x402/MPP/UCP/ACP, chatbot or model integration is advertised. These require actual supported services, authorization or transaction architecture and belong to a separate future task. Passing a scanner is not a reason to publish false capability documents.

## Sources checked for this implementation

- [llms.txt v2 proposal](https://llmstxt.org/): compact Markdown guide and alternate/describedby relationships.
- [OpenAI crawler documentation](https://developers.openai.com/api/docs/bots): independent search/training bots and user-fetch limitations.
- [Anthropic crawler documentation](https://privacy.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler): search, user and training purposes.
- [Perplexity crawlers](https://docs.perplexity.ai/docs/resources/perplexity-crawlers): search indexing and user fetches.
- [Google common crawlers / Google-Extended](https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers): AI purposes independent of Googlebot.
- [Cloudflare AI Crawl Control](https://developers.cloudflare.com/ai-crawl-control/), [robots monitoring](https://developers.cloudflare.com/ai-crawl-control/features/track-robots-txt/) and [managed robots / Content Signals](https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/).

## Follow-up verification

Fresh final application gates passed: **204/204 tests**, including **30 focused AI/SEO tests**; Nuxt typecheck/build and git diff --check passed. The current production build passed **97 fixture HTTP requests / 16 exact negotiated-explicit matches**, **56 real-catalog HTTP requests / 11 exact matches**, and **32 SSR pages / 142 localized sitemap URLs / 426 alternates**. Policy opt-outs, GET/HEAD, strict raw query-name rejection, generic failure responses, private/draft/noindex exclusions and HTML/Markdown cache separation were verified. Public-output scan: **108 files / one configured server-secret type / zero matches**. Guarded deployment preflight and release passed. Temporary artifacts are under `/tmp/elcomputer-ai-followup/`. Final production evidence is recorded here and at the top of PROJECT_STATE.md and CODEX_HANDOFF.md. The initial release evidence below is historical.

Application SHA `78cde2845f6c559e2ad26311f5bf561986ec3988` is deployed to `https://new.elcomputer.net` through the guarded workflow. Backup: `/home/newelcomputer/htdocs/new.elcomputer.net/.output-deploy-backup-20261001-154522-22111`. Only PM2 `new-elcomputer` was restarted, once; expected site cwd, `.output/server/index.mjs` and port 3001 are verified. Four deployed bundle hashes equal the local release output. No migration or external configuration change was made.

Fresh production acceptance passed **56 actual-catalog HTTP requests / 11 exact negotiated-explicit matches**, **32 SSR pages / 142 localized sitemap URLs / 426 alternates**, and **16 EN/AR Light/Dark desktop/mobile home/product screens**. Link/Content-Type/Vary/cache/Content Signals, product prices/review counts, private exclusions and SEO canonical/hreflang/schema passed. Normal browsing receives HTML. Live Chat status/open-close and anonymous checkout/dashboard protections passed. There were zero browser exceptions, console errors/warnings, hydration warnings or horizontal overflow, and zero new server error lines. The guarded build public-output scan passed again: **108 files / one configured server-secret type / zero matches**. Read-only before/after business counts and catalog/CMS/settings fingerprints are unchanged.

Production has no published Help articles or preorder/Coming Soon examples; those branches remain fixture-verified. External Cloudflare enforcement and third-party scanner re-scan are not claimed. The three targeted scanner failures should now be resolved by the verified public responses; actual scanner adoption/scoring remains external. No authenticated customer transaction, support/chat-message or media submission was performed. This focused follow-up is complete; STOP and do not begin another feature.

## Initial release verification and review

Focused tests cover bounded discovery, public projections, sentinels for private data, draft/noindex/active guards, Markdown escaping, minimal products, availability, locale paths, independent policies, Googlebot preservation and unchanged SEO output. Released application SHA `2e5d8f9e362f7ffcd49dcd490607ab5a6a9e3185`; backup `/home/newelcomputer/htdocs/new.elcomputer.net/.output-deploy-backup-20261001-105644-19040`. Fresh final checks passed 200 tests, typecheck/build/diff, 27 fixture HTTP cases and 44 real-catalog HTTP resources locally. Production passed 44 AI HTTP resources, 32 SSR pages, 40 storefront screens and four authenticated dashboard screens. Sitemap matches 142 localized URLs/426 alternates; Live Chat status/open-close and protected redirects passed. Public-output secret scan passed on both local and guarded release builds (108 files, one secret type, zero matches). No new application exceptions were found; authenticated SSR emitted the existing SDK session-user warning. Nginx adds its existing nosniff header alongside the app header; equivalent combined tokens were verified. Database counts and catalog/CMS/settings fingerprints are unchanged. Detailed evidence is under `/tmp/elcomputer-ai/` and in `PROJECT_STATE.md` / `CODEX_HANDOFF.md`.

Review `/llms.txt`, `/robots.txt`, `/sitemap.xml`, a real product and its `/ai/products/{slug}.md` and `/ar/ai/products/{slug}.md`, `/ai/categories/mouse.md`, `/ai/brands/jedel.md`, `/ai/pages/shipping-policy/index.md`, and `/ai/help/index.md`. Production has no published Help articles at release; article rendering is checked with isolated read-only fixtures. Dashboard SEO/settings/pages and human Live Chat retain their existing controls. No authenticated customer order/payment/chat-message submission is required or claimed by this task.
