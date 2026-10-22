# Premium product page validation

Local evidence: parent `premium-pdp-20261022/`. Production is still the accepted
Modern Footer release `40ebcf1f6d50a143`, schema88, until new final approval.

## Evidence boundaries

| Check | Result and boundary |
| --- | --- |
| Original Classic template and shared route script | Exact hash preservation |
| Built-app browser matrix | 266 checks; zero runtime/hydration/HTTP errors; no external requests |
| Themes/locales/layouts | EN/AR, RTL/LTR, Light/Dark/System, desktop/tablet/320–390 mobile |
| SEO | Same title, canonical, hreflang and JSON-LD in both styles |
| Dashboard settings | Actual SFC, persistence, refresh, isolated section save, unsafe-link rejection, current native RLS |
| Product presentation editor | Actual SFC/composable and built APIs; relationship/video save and reload, actor-state clearing |
| Product video | Real owned MP4 probe/upload/stream/fullscreen; no autoplay; native API range/integrity/publication tests |
| Purchase controls | Production hold stays closed; isolated permitted fixture respects stock and shared price/cart |
| Migration89 | Native non-superuser, exact old-row/schema preservation, late rollback, no second application |
| Footers | No footer component/CSS changes; five focused footer tests pass |
| Production catalog | Read-only SQL: 561 total, 225 published, 336 Draft; no changes |
| Hosted authenticated/browser writes | Owner acceptance after approved deployment; not claimed from synthetic Auth |
| Real Paymob/PDC/checkout/signup | Disabled; no provider transaction or activation |

Typecheck and the clean Node22 production build pass. The focused suite passes 39 tests with no skips or cancellations, including
Classic/data authority, presentation/SQL/API, footer and release guards. Private
logs and the final qualification bind their exact counts and source inputs.

## Full regression qualification

The original footer result remains 996 pass, 8 fail, 2 cancelled, 83 optional skips.
Its [eight-failure review](modern-footer-release.md#eight-failures-and-two-cancelled-tests)
is retained. No historical assertion, release seal or route registry is weakened.

A fresh native-enabled baseline at detached commit `69952dd` runs all 140 original
files: **1,242 pass, 11 fail, 2 cancelled, 41 skips**, 1,296 tests. The extra native
contexts explain why this differs from the older runner's eight failures.

The PDP full run executes 144 files: **1,254 pass, 15 fail, 2 cancelled, 41 skips**,
1,312 tests. Eleven failures and both cancellations reproduce in the clean baseline.
Three additional failures are the completed footer release executors correctly
refusing migration89. Their original bytes/seals remain intact. The remaining
10,000-product fixture timed out during concurrent seeding; its unchanged isolated
rerun passes 11 tests with one optional skip. No new functional blocker remains.
The final focused run also includes the added remote-phase wrapper test.

| Context | Qualification |
| --- | --- |
| Completed 82→85 / 85→87 / Release82 contexts | Refuse later migrations/source, as in baseline |
| Completed 87→88 and schema88-only footer contexts | Newly refuse89; new 88→89 operator is independently tested |
| Dashboard actor fixture | Same pre-existing duplicate `readBody` adapter declaration |
| Retired Nginx registry | Baseline already has stale payment review hash; PDP adds an explicitly reviewed read route. Active Caddy remains unchanged |
| Daftra COD history | Same baseline guard rejects directly marking unreceipted COD paid |
| Preorder courier fixture | Same baseline expectation predates current courier/packing eligibility |
| Procurement projection fixture | Same exact82 schema assumption rejects88/89 |
| Email transport | Same two asynchronous mock cancellations; no real request |
| Large catalog seed | Concurrent 10-second statement timeout; isolated original test passes |

The full suite is not green. Passing local/native/mocked checks do not establish
hosted owner acceptance, real payment/shipping behavior or global write history.

## Visual reference comparison

The four owner PDP screenshots were not attached. The original brief and public
primary pages supplied composition references. MAXESPORT and MaxGaming were also
viewed in Chrome; Walmart's browser page presented a robot check, so its public
page structure was reviewed without bypassing it. No claim of exact screenshot
matching is made.

| Reference | Applied design decision |
| --- | --- |
| [MAXESPORT mouse](https://maxesport.gg/fr/products/logitech-g-pro-x-superlight-2-8k-wireless-noir) | Large undimmed product image, visible options and disciplined information rhythm |
| [MaxGaming controller](https://www.maxgaming.com/en/gamepads/flydigi-vader-4-pro) | Strong thumbnail navigation, compact specifications and grouped product controls |
| [Walmart chair](https://www.walmart.com/ip/113794167) | Distinct purchase region and progressive detail sections; unsupported commercial claims omitted |
| Existing ELcomputer Classic | Original markup/data authority retained; no forced Premium selection |

Premium uses existing storefront colors, type and component identity. A 1280px
content area balances roughly 44/33/23 media/information/purchase regions. Tablet
moves the purchase panel below two columns. Mobile hides redundant quick specs
while keeping the complete specification section. Missing content does not create
empty option/highlight/policy blocks. Product photos retain their original colors.
