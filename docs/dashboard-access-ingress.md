# Dashboard access during a browse-only launch

ADM-01 is a reusable ingress correction. See `PROJECT_STATE.md` for current
deployment status, verified acceptance and outstanding checks.

The separately prepared [dashboard read policy](dashboard-read-ingress.md)
upgrades the accepted configuration locally. It has not been activated.

The existing browse-only Nginx policy denies dashboard documents before Nuxt.
It also denies dashboard data APIs and the existing login-audit POST.
The login page, session handling and RBAC already exist.

The smallest correction changes ingress only. It does not rebuild the app,
restart its runtime, create an owner, migrate a schema or change Auth/RLS.

## Reachability and authorization

| Path | Methods | Existing authorization |
| --- | --- | --- |
| `/dashboard`, `/dashboard/...`, `/ar/dashboard`, `/ar/dashboard/...` | GET, HEAD | Existing active-admin middleware and route RBAC; login stays anonymous |
| `/api/admin-erp/state` | GET, HEAD | Verified bearer user and active admin |
| `/api/admin-dashboard/summary` | GET, HEAD | Verified active admin; permission-filtered counts |
| `/api/admin-products/list` | GET, HEAD | Active admin and `products.view` |
| `/api/admin-products/filter-options` | GET, HEAD | Active admin and `products.view` |
| `/api/admin-inventory/items` | GET, HEAD | Active admin and `products.view`; existing bounded list |
| `/api/admin-inventory/options` | GET, HEAD | Active admin and `products.view`; existing product/warehouse options |
| `/api/admin-products/<UUID>` | GET, HEAD | Active admin and `products.edit`; existing snapshot RPC |
| `/api/storefront/dashboard-appearance` | GET, HEAD | Existing public projection: dashboard layout only |
| `/api/_nuxt_icon/lucide.json` | GET, HEAD | Existing local icon handler |
| `/api/admin-logs` | POST, exact canonical host/path only | Existing `requireAdminRequest`; audit author comes from verified admin |

Nginx reachability does not authorize a user. A bearer-shaped string is not
proof of identity. `requireAdminRequest` verifies the token through Supabase,
loads the active admin record, then checks each endpoint's existing permission.
Direct Supabase reads retain their existing RLS and grants.

The audit endpoint retains its existing body contract. An active admin can
record their own administrative audit entries; the edge does not parse JSON
or restrict the body to a login action. It does not expose other write APIs.
The existing audit service may trim older eligible audit entries under its
50-entry retention contract. Login acceptance is not literally zero writes:
Auth creates/refreshes/revokes sessions and the application records login audits.

## Narrow Nginx transformation

`scripts/nginx/dashboard_access.py` is a pure renderer. Its caller supplies the
reviewed deployment binding and keeps full configuration bytes root-private.

- Replace both server-level method guards with scoped HTTP maps.
- Permit only GET/HEAD and exact canonical-host `POST /api/admin-logs`.
- Remove only `dashboard` from the private-page deny expression.
- Add explicit dashboard locations and eight exact read API locations.
- Keep the `^~ /api/` default denial. Put the strict UUID regex inside it.
- Preserve existing regex security locations with ordinary dashboard prefixes.
- Reject duplicate/conflicting routes, unexpected routing and cache policies.
- Copy the approved loopback root proxy controls, including ACLs.
- Keep proxy caching/storing off and set private, no-store response headers.
- Preserve effective inherited security headers before adding a local header.
- Preserve every other source span, server name, TLS directive and SEO map.

The initial audit proposal omitted the two Inventory dependencies. Focused
browser tests identified their 403 responses. Both existing GET handlers were
inspected and tested before adding these exact exceptions. Inventory detail and
mutation APIs remain denied. No permission or application handler changed.

Server-level returns execute before location processing. Adding locations alone
cannot override the old guards. A top-level UUID regex also cannot override the
existing `^~ /api/` prefix. The isolated Nginx tests exercise both interactions.
See the official [location matching](https://nginx.org/en/docs/http/ngx_http_core_module.html#location),
[rewrite processing](https://nginx.org/en/docs/http/ngx_http_rewrite_module.html)
and [header inheritance](https://nginx.org/en/docs/http/ngx_http_headers_module.html#add_header)
documentation.

The canonical alias retains existing redirects. Its mutation requests remain
405. The sole POST exception rejects queries, trailing slashes, encoded aliases
and doubled slashes. Other APIs, customer login/signup, account, cart, checkout,
payment and provider endpoints retain their existing denials.
Unreviewed original server-name aliases gain no direct dashboard/API access.

Classify `$request_method` independently of Host and URI. The audit exception
matches the complete canonical-host/method/raw-path tuple with case-sensitive
anchors. Compatibility tests use Nginx 1.28.0 and 1.30.6. The suspected Host
delimiter bypass was not reproduced: the older version normalizes Host case
and returns 405; the newer version rejects that Host with 400. Method checks
remain independent of either behavior. Case variants of the audit POST remain
405, rather than reaching a location-level denial. The first local candidate
was superseded before staging or execution; no production exposure occurred.

This restores inspection surfaces. It does not enable every dashboard action.
Some existing dashboard forms write directly to Supabase under owner RLS;
closing edge API mutations does not make the whole dashboard read-only.
Do not click Save, receive inventory or change settings during access acceptance.
Guarded browser acceptance must deny table/RPC business writes independently.

## Configuration and portability

There are no new application environment variables or Auth origins.
Continue using the existing public site/Supabase environment configuration and
site settings. Password sign-in uses the configured Supabase Auth service.
Customer OAuth, confirmation and recovery origins remain a separate workstream.

The renderer binding contains exactly:

| Input | Requirement |
| --- | --- |
| `format` | `1` |
| `site_origin` | Exact HTTPS origin; no credentials, query, path or wildcard |
| `canonical_alias` | One explicit alternate hostname |
| `variable_prefix` | Unique safe Nginx variable namespace per deployment |
| `source_sha256` | Exact reviewed current configuration hash |
| `runtime_upstream` | Explicit loopback HTTP port; no public listener |

For example, independent stores may use `https://shop.example.test` and
`https://store.other.test`, with different aliases, upstream ports and variable
namespaces. The reusable renderer contains no deployment domain, brand, owner
ID, Supabase project reference or filesystem path.

The operational package separately binds the configuration path, complete
loaded-file hashes, runtime/user/PID, installed inventory, environment hash,
existing start receipt and service unit. Store-specific values belong there.
Changing any binding requires a new reviewed plan/package; never edit a sealed
bundle in place. No production credential belongs in the package.

## Verification and deployment boundary

Run the focused source/API tests:

```sh
node --test tests/dashboard-access.test.mjs tests/dashboard-navigation.test.mjs \
  tests/auth-page.test.mjs tests/dashboard-summary-documents.test.mjs
```

Set `DASHBOARD_REVIEW_NGINX` to an isolated local Nginx executable to run the real
Nginx matrix in `tests/dashboard_access_test.py`. Without it, those integration
cases explicitly skip; a skip is not deployment acceptance.

The HTTP tests execute the existing H3 guards/handlers and real application SQL
in PGlite. Hosted Auth verification and Supabase transport are explicit fixtures.
The isolated schema lacks managed-platform default table grants; the direct
customer read test preserves its 42501 denial. It does not certify hosted owner
RLS by adding test-only grants. Production owner authentication remains pending.

The separate preparation directory records real Chrome checks against unchanged
compiled Release 82 behind isolated HTTPS Nginx. Auth/REST transport there is a
local fixture. Secure cookies remain enabled; test certificates are confined to
that browser/process. No local result proves the real owner's credentials work.

Before an approved production replacement, require the exact live source hash,
all loaded peer configuration hashes, current runtime identity/health, installed
file inventory, disabled signup/payment settings and full private shadow syntax.
Stop on any drift or failure. Keep the complete preimage, resolved symlink and
security metadata root-private. Apply only the reviewed main configuration,
validate installed syntax, then reload Nginx once. Never restart Nuxt.

Afterward, verify owner login, authorized data, EN/AR, refresh, navigation and
logout. Verify anonymous/invalid/inactive/non-admin/restricted access, private
cache headers, customer/checkout denials, representative public pages/images,
SEO/canonical behavior and unchanged business data. Reuse the completed full
catalog/SEO acceptance; do not repeat that launch audit.

Rollback is a separate approved infrastructure action. Restore only the exact
saved configuration after checking the current candidate hash, peer hashes,
symlink and security metadata, then validate syntax and reload once. No database
restore, automatic retry, automatic rollback or cleanup is permitted.
