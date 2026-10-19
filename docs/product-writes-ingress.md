# Products write repair — local review, 2026-10-19

Status: **implemented and validated locally; NOT deployed**.
The repair restores admission to existing authenticated Products commands.
It does not authorize production execution or resolve the original unknown batch.

## Responsible layers

| Operation | Actual path and responsible controls | Finding |
| --- | --- | --- |
| Create Draft | add.vue → useProductSave → POST /api/admin-products → products.add → catalog_save_product | Accepted ADM-01 method map rejects POST before Nuxt. |
| Edit details, options, visibility | edit/[id].vue → useProductSave → PATCH /api/admin-products/:id → products.edit → catalog_save_product | Accepted method map rejects PATCH before Nuxt. Publication uses the same revision-checked save. |
| Publish / Move to Draft / category / brand batch | Products listing → useProductBulk → POST /api/admin-products/bulk → products.edit → catalog_bulk_products | Accepted method map rejects POST. Existing production log evidence contains two exact-path 405s. |
| Core save receipt | GET /api/admin-products?request_id=UUID → catalog_product_save_status | Already admitted; authenticated, current permissions and actor-owned result. |
| Bulk receipt | GET /api/admin-products/bulk?request_id=UUID → catalog_product_bulk_status | Already admitted; exact query validation, products.edit and actor-owned result. |
| Editor snapshot | GET /api/admin-products/:id | Already admitted; products.edit, coherent product/options/revision snapshot. |
| Specifications, features, conditional gallery row saves and legacy deletion | Existing Supabase browser client → PostgREST/RLS | These do not traverse these Nuxt write routes. No production failure at these layers is established; no grants/RLS changes are justified. File upload is deferred. |

Both write RPCs already serialize request UUIDs, bind actor and normalized command,
recheck active effective Products permissions, enforce revision checks and retain
durable receipts. Core product/options/audit/receipt writes are transactional.
Bulk terminal partial results are durable; receipt failure rolls back the batch.
No stock receipt, cost, ERP ownership or commercial setting is changed here.
Direct browser access to the service-only write RPCs/private receipts stays denied.

The previously deployed client turns bulk 405 into an unknown result. The sealed
application candidate fixes that denial/recovery UX; it cannot admit a blocked
POST. This task supplies the missing ingress repair rather than another error-only
change. No application, API, SQL, locale or dependency correction was required.

Evidence: the earlier sanitized production log read records bulk POST 405 at
08:51:51 and 08:51:54 UTC on October 19. It does not retain upstream status, actor
or command UUID. Attribution to a specific owner dispatch remains unestablished.
Create/PATCH denial is established by accepted configuration and actual local
Nginx reproduction, not by a newly captured owner request. No production request,
SSH session, SQL connection or personal browser access occurred in this task.

## Exact minimal ingress change

`scripts/nginx/product_writes.py` upgrades a SHA-pinned **accepted READS-v1**
preimage. It is separate from the historical ADM-01 renderer and operators.
The deployment binding supplies origin, canonical alias, variable prefix,
loopback upstream and complete source SHA. No deployment identity is hardcoded.

Only these method/path pairs are added to the existing canonical-host/raw-URI map:

| Method | Exact path | Existing authority |
| --- | --- | --- |
| POST | /api/admin-products | active Products view + add |
| PATCH | /api/admin-products/UUID | active Products view + edit |
| POST | /api/admin-products/bulk | active Products view + edit |

UUID uses the existing anchored hexadecimal 8-4-4-4-12 pattern. Added map regexes
are quoted so Nginx parses UUID quantifiers correctly. No query string, encoding,
duplicate slash, dot segment, trailing slash, case variant, alias-host write,
arbitrary suffix or wildcard admin write is admitted. Wrong methods remain denied.
The matching three existing locations gain only their named write method and
`proxy_next_upstream off`. No automatic upstream retry/fallback is introduced.

Everything else remains byte-identical: all 70 allowed GET patterns and their
methods, ten held routes, login audit exception, headers, no-store/cache controls,
upstream, TLS, other servers, public/media/SEO routing and customer denials.
An independent reversal test reconstructs every original configuration byte.
Nginx admission does not authenticate anyone: Nuxt verifies the bearer with Auth,
looks up the current active administrator and checks named permissions; SQL checks
them again under lock. There is no owner ID, token-presence bypass or broad POST.

`scripts/nginx/prepare_product_writes.py` takes an authorized **local** snapshot
and reviewed binding, then creates an exclusive 0700 review directory containing
0600 preimage, candidate, unified diff, binding and hash-bound REVIEW.json.
It cannot connect, apply, stage, back up, run Nginx or reload a service.
Wrong hashes, changed expected guards/maps, repeated application and existing
output directories fail closed. It never edits a prior package or receipt.

Example for a separately authorized local snapshot (not a deployment command):

```sh
python3 scripts/nginx/prepare_product_writes.py \
  --source /approved/local/accepted-read-policy.conf \
  --binding /approved/local/DEPLOYMENT-BINDING.json \
  --output /approved/local/new-products-review
```

## Original batch and acknowledgements

The owner reports one selected product and no retry. Product/request/actor IDs
are still unavailable here. The two nearby log entries cannot establish duplicate
submission or identify the original command. Its completion stays **UNVERIFIED**.

Preserve its tab-local actor-scoped command, operation, references and revisions.
Use only the existing authenticated **Check result** GET for its retained UUID,
through a separately authorized owner-controlled session/test arrangement.
Do not export tokens, cookies or session storage or query all private receipts.
An exact matching terminal receipt can reconcile it; null, malformed, denied or
failed recovery cannot authorize retry, replacement, clearing or inferred failure.
No lookup was performed without identifiers. No original command was recreated.

The sealed candidate keeps known 405/401/403 batches paused, including after reload.
Opening ingress does not reset those entries. An unresolved batch can therefore
continue to hold bulk controls in that tab. This requires evidence-based
reconciliation; bypassing the hold by discarding data or changing tabs is not the
repair. New legitimate commands are tested independently with synthetic products.
No recovery path sends POST automatically; uncertainty is not mutation failure.

## Local validation

Node22.23.1 and the existing local Nginx1.30.6, PostgreSQL17.11 and PostgREST16.4
tools were used. All database changes were confined to owned disposable clusters.

- New ingress renderer/package/routing suite: **9 tests PASS**, two independent
  business bindings. All registered reads/holds, all other actual admin write
  handlers, raw path/query/method/host denials and customer restrictions checked.
- New integrated Nginx → actual H3 handlers → native PostgreSQL: **8 tests PASS**.
  Reproduces pre-repair 405 before handlers; validates Draft creation, edit,
  publication, bulk Draft, exact acknowledgements, stale revisions, duplicate
  requests, forbidden actors, actor-owned GET recovery and no recovery writes.
  Real commits with dropped responses yield 502 through Nginx; receipts recover
  them without retrying the mutation. No duplicate audit/product/receipt occurs.
- Existing focused save validation/API/database/concurrency/PostgREST and bulk
  command/recovery suites: **113 PASS, 2 optional tests SKIPPED, 0 failures**.
  The two existing non-superuser-owner tests need the unavailable Supautils library;
  no ownership, grants or migrations are changed. Prior PASS evidence is retained.
  Recovery covers 405/401/403, timeouts, malformed/missing receipts, actor changes,
  persistent reload state and duplicate-submit suppression.
- Existing READS-v1 suite: **12 PASS**; all 263 source bindings still match.
- Existing create/edit browser regression: **185 assertions / 36 screenshots PASS**,
  EN/AR/RTL, responsive/themes, duplicate submission, conflicts and dropped responses.
  Zero unexpected errors/external requests. Fresh temporary Chrome context only.
- Secret-free Nuxt typecheck and build: **PASS**. Existing duplicate ERP import,
  sourcemap and chunk warnings remain. No application input changed.

Early local iterations exposed UUID-regex quoting, an independent reversal test's
HEAD assumption and shared harness compatibility; corrected before the final runs.
Their diagnostic logs remain preserved. No final focused test fails.
Hosted Auth is synthetic in fixtures; local passing tests do not certify live
owner/RBAC acceptance or prove zero browser-induced production writes.

Evidence directory:
`/Users/imac/Documents/ELcomputer/products-write-repair-20261019-9ni51nze/`.
`fixture-review` is explicitly synthetic and must never be installed in production.

## Next release and approval boundary

The existing sealed application is unchanged: commit
`3d5fe61c1109190c2ac3df12fb858987bc103aa5`, archive **5,277,655 bytes**, SHA-256
`7bfe6316a1f544d84b37366f447cdfdd7b11bd11d3473df632930c5ad6618846`.
All 597 application inputs and their committed provenance are reverified.
It carries the already reviewed Procurement projection/lockfile corrections;
those are unchanged, and Procurement's production acceptance remains separate.
No new archive is needed for this operational tooling-only commit. The local
verification build is not a replacement sealed deployment artifact.

The proposal's deployment-specific binding is external:
`DEPLOYMENT-BINDING-PROPOSED.json` in the evidence directory. It pins the last
accepted READS candidate SHA
`c859c080dcab025c6d7e614d77864905d034e8c50d6570eef95014d6f4574bb5`.
Current protected vhost bytes were unavailable in the previous non-root preflight.
Therefore a final production candidate hash/full shadow syntax result cannot be
claimed yet. Do not replace that hash merely to accept drift. The patch and
synthetic review package are ready; production application/reload is **BLOCKED**.

The next authorized operator phase must capture/attest current protected config
and loaded peer identities, bind this exact transform and seal its candidate/diff,
then validate complete private shadow syntax with the existing security contracts.
Do this before any production staging or reload. A current preimage mismatch stops
for review. Historical first-install/ADM-01 guards must not be edited or replayed.

Subsequent separately reviewed application staging must use the existing main
systemd/current-pointer target, not generic deploy.sh's demo PM2 target. Preserve
the old immutable release, client assets, exact config, environment/unit and media;
verify backups and exact candidate health privately on Linux before switching.
Keep Restart=no, strict health checks and manual recovery. No automatic retry,
resume, rollback or cleanup. Rollback needs separate approval and may restore
only the exact reviewed application/config preimage, never schema/grants/RLS.
No migration, new Auth/API contract, environment change or commercial activation
is required. Existing failed settings-drift evidence remains an outstanding release
gate; this task does not investigate, change or rebaseline it.

ADM-01 DEPLOYED/INFRASTRUCTURE_PASS, prior zero-write DB/public110 PASS and the
five owner functional observations retain their original provenance. Formal
authenticated RBAC, restricted-role, held-route and browser-write-safety acceptance
stays DEFERRED/BLOCKED, not waived by this repair. Future authorized acceptance
needs an isolated matching target/test actors and instrumentation covering browser,
SSR Auth and database effects; it must not reuse the unsafe Chrome extension.
Uploads, VPS storage, remaining dashboard operations and ecommerce are deferred.

**ONE next owner action:** authorize the protected-config Products release
preflight to bind and seal this three-command patch alongside the existing
application candidate. Production staging, activation and reload remain separate
reviewed decisions. No push or production operation occurred here.
