# Task 2 local validation

Baseline: `8c5256b9708b488e3022e756e8c9f85aaf8a96ae`.
Evidence directory: `/Users/imac/Documents/ELcomputer/product-manager-task2-review-20261013`.

Acceptance uses synthetic actors/data, new temporary upload roots and disposable
PostgreSQL clusters. No hosted/production database, existing merchant files,
provider, deployment, reset or frozen installer artifact is accessed or changed.

## Security and regression coverage

`tests/media-safety.test.mjs`, `media-concurrency.test.mjs` and `media-rest.test.mjs`
cover 16 results, including actual H3 media routes, current staff authorization,
product/category/brand/page folder scopes, revoked staff, malformed/chunked
multipart requests, all five raster formats, MIME/content mismatches, SVG rejection,
size limits, generated filenames, hidden staging/exclusive publication, preserved
complete images after acknowledgement failure, filesystem symlinks/traversal and private-file
exclusion. Tiny raster fixtures are synthetic; they were generated locally with
FFmpeg/Chrome, not copied from merchant data. These tools are not runtime dependencies.

Referenced deletion is checked for product/SEO images, variant galleries,
category/brand logos, case aliases, nested brand JSON, settings, markdown, hero content and order
snapshots. Tests preserve referenced files, remove truly unused files, handle lost
completion and simultaneous deletion, reject new deleted references and preserve
product save rollback/audit/receipt behavior.

Independent native PostgreSQL sessions cover both reference/deletion race
orderings, revocation between HTTP checking and the locked SQL decision, and
rejection of incompatible isolation. Migration 73 executes under a non-superuser
owner without business-row changes or changes to existing table ACL/RLS. Actual
PostgREST verifies browser-role RPC denial, private metadata exclusion, direct
staff reference guards and preserved public catalog/cost confidentiality.

## Final results

Final Node 22.23.1 secret-free build/typecheck pass. Media browser **204 assertions /
36 screenshots**, product-save browser **185 /36** and warranty/UI **615 /96** pass,
with zero unexpected browser errors or external requests. Product save deliberately
drops two acknowledgements; those two network aborts are expected. The complete
regression suite passes **976/976**, with zero failures/skips/cancellations. All **16
focused media results** are included, alongside the existing product, inventory, ERP,
security, reset and historical installation regressions. Accepted complete run:
`regression-final-complete.log` (703,157 ms). Final build/typecheck:
`build-complete.log` / `typecheck-complete.log`; browser:
`browser-atomic.log`, `product-browser.log`, `warranty-browser.log`.

An intermediate full run was interrupted when final review identified the upload publication race; it is not
counted as final acceptance.

Original migration preservation is independently hashed against the 72-file
baseline. Migration 73 SHA256: `6ec6a9bbfc18d01e0285e0e05e5ef2ae1d4c4fa86b84a5e17edcbb477920e409`. The immutable compiled
application inputs match the checkout; SQL migration changes are tested natively.
Existing Task 1 product browser and warranty/UI browser are rerun.

`scripts/media-safety-browser.mjs` compiles the actual shared image field, library,
view toggle and details panel with built application CSS. Uploads, browsing,
previews, selection, deletion and errors use actual local HTTP/filesystem/native
SQL. It covers EN/AR, RTL, 390/768/1440 widths, Light/Dark/System, scoped selection,
SVG/content errors, referenced/unused deletion, scope changes and revoked staff.
External browser requests are blocked and unexpected browser errors fail acceptance.

Hosted Auth verification and surrounding Nuxt/Settings orchestration are fixtures.
Existing product browser similarly uses actual forms/save routes/native SQL with
unrelated controls and Auth as fixtures. Existing warranty/UI acceptance uses its
established isolated fixtures. None certifies deployed accounts, hosted Storage,
real providers or production acceptance.

Earlier failed diagnostic runs remain in the evidence directory: macOS temporary
path aliasing, missing hosted-baseline staff grants in a fixture, statistics cached
inside a transaction, checkout-fixture payment setup, browser selector/async
assertion mistakes, and a macOS environment-wrapper run that dropped the native
PostgREST library path. They are not included in accepted totals.

## Limits and follow-up boundary

- Structural content validation does not fully decode codecs or strip metadata.
  New SVG is rejected; preserved legacy SVG has restricted delivery.
- Failed/unconfirmed deletion retains its reservation and needs an explicit retry.
  There is no automatic destructive cleanup or reservation cancellation.
- Reference scans are conservative and may protect a same-path foreign-origin
  image or text mention. Names differing only in case share protection. Future
  media-bearing tables need guard/scan coverage.
- Direct OS/restore operations and the separate guarded System Reset workflow are
  outside this endpoint's deletion protocol. No such operation was run.
- The installer still certifies 1–71. Source 72/73 needs separately authorized
  installation/release certification and hosted acceptance. No frozen artifact is
  silently updated and no production migration is applied.

Stop after Task 2 commit/push for review. Do not begin Task 3.
