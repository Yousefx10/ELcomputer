# Authenticated dashboard read ingress

This is a local ADM-01 policy candidate. Production activation is separate.
It extends the accepted [initial ingress](dashboard-access-ingress.md).
Application authentication, permissions, RLS and business configuration stay unchanged.

## Policy and source review

[The registry](../scripts/nginx/dashboard_read_policy.json) classifies all 80
current administrative GET handlers. [The matrix](dashboard-read-api-coverage.csv)
records each path, methods, authorization, sensitive data, effects, dependencies,
decision, rationale and handler hash. Source discovery does not grant access.

There are **70 approved GET patterns and ten held patterns**. The latest audit's
72 candidates were proposals. Current SQL/source review adds two holds:

- Inventory item detail exposes costs and purchaser data under `products.view`.
- Import status expires jobs and pending items through `catalog_import_status`.

The registry binds handlers, imported local helpers, baseline SQL and all 82
migrations as review inputs. Coverage tests fail when those inputs change or a
GET handler lacks classification. Review changed code before updating hashes.
Do not refresh this manifest automatically to silence a failed test.

The renderer admits exact paths and anchored UUID parameters only. It admits
no arbitrary suffix, admin prefix or bearer-presence shortcut. Unknown routes
remain denied. Newly admitted routes are **GET-only**. The seven previously
accepted API HEAD entries and two public helpers keep their existing behavior.
Nitro's method-specific GET registration does not promise successful HEAD
dispatch. No proxy method rewriting or synthetic application HEAD handler is added.

GET `/api/admin-logs` requires `settings.view`. Its existing exact canonical-host
POST exception is preserved. That exception still rejects queries, encodings,
case changes, trailing slashes and alternate hosts. Its existing application
action validation, actor binding and audit retention remain unchanged.

## Authorization and usable modules

Reachability passes requests to existing bearer verification and active-admin
checks. Existing permission normalization includes parent access permissions,
such as `dashboard.view` for `dashboard.orders`. Owner access follows the existing
role contract, without owner IDs or deployment-specific exceptions.

| Module | Expected read access after approved activation | Limit |
| --- | --- | --- |
| Users/customers | `users.view`; staff/customer identity and existing summaries | No user/account mutations or new grants |
| Setup Status | Active owner only; local snapshot/configuration reads | No state PATCH, readiness completion or provider activation |
| Image Manager | Existing public-image section permissions | VPS filesystem listing; upload/delete stay closed |
| Overview/Products | Existing summary/list/filter/detail plus save/bulk receipts | Edit snapshot retains `products.edit`; receipts retain actor ownership |
| Catalog transfer | In-memory CSV/XLSX template GET | Import status/options path and all preview/export/apply POSTs stay closed |
| Inventory | Existing list/options | Item detail/scan lookup stays held |
| Orders/packing | `dashboard.orders`; existing order/session/work-session metadata | No packing actions, status changes or video capability |
| CRM/reviews | Existing coarse active-admin contract | No new granular permission is invented |
| Analytics | Existing analysis permission and local SQL reads | External ERP dashboard stays held |
| Documents | `documents.view`, folder lineage/ACLs; access inspection also needs manage/editor access | Download and activity mutations stay closed |
| Help/support/chat | Existing help/support permissions and existing resource relationships | No messages, presence, read receipts, typing or attachments |
| After-sales | Existing claims permissions and RPC projections | No evidence/private labels, actions or communications dispatch |
| Email/SMS/shipping | Existing granular permissions; configuration diagnostics and credential-presence flags | No credential disclosure, sending, sync, tests or provider calls |
| Pages | Existing pages permission and CMS metadata | No CMS changes |
| Procurement/Warehouses/HR/Treasury | Existing direct Supabase JWT/RLS contracts | Main-domain ingress cannot correct their underlying queries |

These are expected module reads, not complete authenticated browser acceptance.
Some screens automatically call denied writes or held dependencies. Guarded
inspection can succeed while those controls remain unavailable.

Gallery listing calls `listUploadedImages` against the configured VPS root.
The current handler does not read an Image Manager index table. Do not infer
missing media from an edge error or start indexing/import work here. Files
outside permitted public-image paths remain separate. Future file bytes belong
on VPS; the deferred private-media migration is not part of this correction.

Users/customer data stays behind `users.view`. Orders retain their own scope.
Some existing customer/support views intentionally include linked order metadata.
CRM/reviews retain broader active-admin access. The already accepted Inventory
list can include related customer metadata; this task does not redesign that
existing contract. Newly exposed detail adds costs/full purchaser data and is held.

Setup basis tokens are owner-only concurrency bindings for separately authorized
PATCH operations. They do not authenticate a caller or independently authorize
a write. The GET performs no provider calls or setup saves; PATCH stays closed.

## Held endpoints and future work

All methods remain denied for these paths under this candidate's read profile.

| GET path | Reason | Separate prerequisite |
| --- | --- | --- |
| `/api/admin-products/transfer/import` | Status RPC locks and updates expired jobs/items | Split nonmutating status/options semantics; preserve durable import receipts |
| `/api/admin-inventory/items/:token` | `products.view` alone returns costs/full purchaser/order data | Review confidential projections and order/customer permissions |
| `/api/admin-erp/dashboard` | Calls external ERP provider | Individually approved provider-read scope and diagnostics |
| `/api/admin-documents/files/:id/download` | Private Storage bytes; writes recent-items | VPS private-file contract and explicit activity-write design |
| `/api/admin-orders/packing/:sessionId/video` | Generates private Storage signed URL | VPS delivery preserving video authorization |
| `/api/admin-shipping/orders/:id/label` | Private Storage label bytes | VPS private-label adapter and authorization acceptance |
| `/api/admin-after-sales/claims/:id/reverse-label` | Private Storage return-label bytes | VPS private-label contract and claims logistics permissions |
| `/api/admin-after-sales/claims/evidence/:id` | Private Storage evidence bytes | VPS evidence delivery and claim ownership/permissions |
| `/api/admin-chat/attachments/:id` | Private Storage attachment bytes | VPS attachment delivery and conversation authorization |
| `/api/admin-system-reset` | Destructive-workflow preview | Separate reset inspection design and owner acceptance |

Do not admit only the no-query branch of import status. Its current path has
both options and status semantics. The whole path stays held.

## Renderer and portable configuration

`scripts/nginx/dashboard_access.py:render_reads` accepts the **current accepted
ADM-01 configuration**, its reviewed binding and effective inherited headers.
It does not render from an obsolete launch preimage or replay original APPLY.
The initial `render` entry point remains available for its historical contract.

The six deployment binding inputs remain unchanged: `format`, `site_origin`,
`canonical_alias`, `variable_prefix`, `source_sha256`, `runtime_upstream`.
No application environment variable, store identity, Supabase project, owner ID,
installation path or schema change is introduced. The caller supplies effective
HTTP-level headers through the existing inherited-header argument where needed.

The upgrade checks the source hash, accepted method maps, both server guards,
old API proxy controls, upstream, caching, inherited headers and UUID default-deny
structure. It rejects unexpected admin/customer selectors and repeat application.
Only API location spans change. Dashboard locations, redirects, TLS, SEO maps,
public media and peer sites remain unchanged. Existing security locations and
proxy ACLs remain in force.

API paths must match both normalized `$uri` selectors and raw `$request_uri`.
Encoding, doubled slash, traversal, case and suffix variants cannot widen API
reachability. The canonical alias preserves redirects; unreviewed aliases gain
no direct admin access. Mutations retain the independent server-level method
guard. [Nginx location matching](https://nginx.org/en/docs/http/ngx_http_core_module.html#location),
[rewrite processing](https://nginx.org/en/docs/http/ngx_http_rewrite_module.html)
and [maps](https://nginx.org/en/docs/http/ngx_http_map_module.html) explain the
precedence exercised by the real local integration tests.

## Local validation

Use the established isolated Nginx, PostgreSQL and PostgREST tool inputs:
`DASHBOARD_REVIEW_NGINX`, `EMAIL_REVIEW_PG_BIN`, `EMAIL_REVIEW_PG_DRIVER`,
`CATALOG_REVIEW_POSTGREST_BIN`, plus their local library search path if needed.
These are test-tool paths, not application configuration.

```sh
python3 -B tests/dashboard_access_test.py
python3 -B tests/dashboard_reads_test.py
node --test tests/dashboard-access.test.mjs tests/dashboard-reads.test.mjs \
  tests/dashboard-navigation.test.mjs tests/dashboard-summary-documents.test.mjs \
  tests/auth-page.test.mjs tests/quick-setup.test.mjs \
  tests/quick-setup-progress.test.mjs tests/media-safety.test.mjs \
  tests/media-rest.test.mjs tests/catalog-confidentiality.test.mjs
```

Missing native tools explicitly skip integration cases. Skips are not acceptance.
The preparation evidence records configured runs with actual local Nginx 1.28.0
and 1.30.6, plus two independently configured hosts/aliases/ephemeral upstreams.

The end-to-end suite runs Nginx, existing H3 handlers, Supabase query builders,
native PostgREST and real application SQL in a new disposable database. Hosted
Auth `getUser` is a fixture. Tokens, identities, files and business records are
synthetic test fixtures. No production identity is created or changed.
The schema-only scaffold supplies service SELECT grants locally; it changes no
authenticated/anonymous grants or application RLS. These tests cannot certify
hosted Auth, managed grants or real owner/staff browser access.

Tests exercise all 70 owner read branches, all missing/invalid/expired/inactive/
non-admin denials, missing module permissions, users/order confidentiality,
owner-only Setup, media sections, folder ACLs and receipt ownership. Missing
synthetic resources correctly return 404. All fixture table fingerprints remain
unchanged; external provider/Storage transport is refused. A rolled-back local
SQL test demonstrates the held import-expiry write.

## Separate production review and rollback

The portable preparation archive is not a production-bound activation bundle.
It contains no live configuration, secrets or application output. Current root
configuration bytes remain private. A production candidate hash and executable
operator require the following separate work and authorization:

1. Review and authorize the preserved read-only ingress attestation only.
   Require the accepted APPLY receipt, exact current main plus all loaded peers,
   symlink/security metadata and sanitized runtime identity. Stop on drift.
2. Prepare a **new** root-private plan binding the accepted current hash, this
   source package, registry hash and exact configuration path. Render from those
   current bytes, preserve effective inherited headers, and inspect the scoped
   diff. Validate a complete private shadow configuration with target Nginx.
   Bind exact candidate/preimage/peer hashes and runtime/disabled-commerce gates.
   Do not reuse the frozen original operator for this upgrade.
3. Obtain separate approval for the concrete ingress replacement/reload command.
   Recheck every precondition. Preserve exact preimage, resolved symlink and
   ownership/modes. Replace only the reviewed main configuration, run installed
   syntax validation and reload Nginx once. Do not restart Nuxt or change SQL.
4. Run guarded acceptance below and compare approved business/security preimages.
   On failure or ambiguity stop; no automatic retry, rollback or cleanup.

Rollback needs its own reviewed approval. Require the currently installed
candidate hash, unchanged peer identities, original symlink/security metadata
and exact saved preimage. Restore only that configuration, validate syntax and
reload once. It restores initial ADM-01 owner login and its known API gaps.
No application, database, environment or media restoration belongs to this rollback.

## Procurement release and browser gates

The sealed application candidate remains source `03ca445`, archive
`c95bac1f9793fc0cfb1febe9d07b31f78db789d2e3de6e9f93a4514b688e331c`.
This policy does not change its 597 application inputs or fix Procurement's
deployed query. Do not rebuild, transfer or start it for this task.

If the accepted ingress stays unchanged, its existing root identity gate remains
valid for the original Procurement staging plan. If ingress changes first,
review a new post-change receipt/binding before any later staging entry check.
Never weaken old hashes or label the new ingress as the old accepted preimage.
Both ingress activation and application activation remain separately reviewed.

Later browser acceptance must use the existing owner and configured origins.
No production negative-test accounts are authorized. Use disposable local role
tests for negative identities. Keep tracing, HAR, session export and private
screenshots disabled. Record only sanitized outcomes.

- Install a transport guard before navigation. Admit reviewed GETs and explicit
  audited read RPCs only; block business table/RPC writes, chat presence/read/
  typing and document activity. Edge method restrictions cannot constrain the
  owner's independent direct Supabase privileges.
- Separately approve any Auth login, refresh-token rotation, logout and exact
  login-audit effects. They are writes; ordinary read acceptance does not permit them.
- Confirm EN/AR Overview, Users/customers, owner-only Setup, gallery section/data
  loading, Products/editor/receipts, Orders/packing metadata, Documents ACLs,
  help/support/chat inspection, CRM/reviews and local configuration/analytics.
  Distinguish denied controls, missing resources, failed loads and empty data.
- Confirm AR dashboard, Warehouses and serialized Inventory list/options; keep
  held detail/scan lookup closed. After separate application activation, run the
  prepared Procurement read and its existing acceptance procedure.
- Complete Back/navigation, reload/session persistence, EN/AR and responsive
  behavior, then separately authorized rotation/logout. Preserve earlier passes.
- Check private headers, aliases/canonical redirects, public pages/media and
  unchanged signup/checkout/COD/payment denials. Verify approved catalog/revision/
  settings/receipt/Auth/RLS/stock/order/Storage invariants without rewriting them.

Stop after local preparation. The recommended next owner action is to review
the report and authorize only the preserved read-only root ingress attestation.
