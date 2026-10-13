# Task 3 local validation

Baseline: `0571768f001a58077ac0002315efe4b732c9b236`.
Evidence: `/Users/imac/Documents/ELcomputer/product-manager-task3-review-20261013`.

All data, actors, tokens, upload roots and databases are synthetic and newly owned.
No production/hosted connection, merchant file, provider activation, deployment,
real reset or certified installer change occurs.

## Coverage

`tests/product-editor.test.mjs` covers omitted publication, explicit publishing,
existing published edits, receipt replay, stale revisions, strict field feedback,
empty optional fields, a genuinely empty catalog, required warehouse/price/option
rollback, zero physical stock and Daftra content versus inventory ownership.
Independent row merges preserve other dirty rows and RLS-filtered saves fail.
Migration 74 executes under a native non-superuser owner; every public-table row
fingerprint, existing table ACL/RLS and the atomic save function are preserved.
Actual PostgREST proves public draft exclusion, explicit publication, conditional
section updates, unauthorized/revoked writes and cost confidentiality.

Existing product-save and media suites are rerun for native independent-session
conflicts/retries, rollback, Procurement, inventory/history, ERP, private RPCs,
media reference/deletion races, upload validation, SVG/path protections and scopes.

`scripts/product-editor-browser.mjs` uses the actual product forms, specification
editor, variant/warranty/preorder components, media field/library, built CSS and
Vue Router/browser history. Product commands use actual HTTP/native SQL; section
writes use actual PostgREST/RLS; media uses actual HTTP/filesystem/native SQL.
Synthetic signed Auth claims and Auth verification replace hosted Auth. Prerequisite
pages and surrounding Nuxt/ERP state are fixtures; the SEO component is real. Only fixture lookup
SELECT grants supplement the historical schema reference, matching the existing
certified permissions; application grants are not broadened.

Checks cover EN/AR, RTL, 390/768/1440 widths, Light/Dark/System, editor link/route/
history cancellation and deliberate discard, unload protection, prerequisite input
retention, Draft creation, explicit publication, independent save successes/failures,
preserved other-row drafts, stale gallery/specification values and viewer/Daftra
controls. Delayed real uploads cover main/SEO/gallery save and navigation locks;
confirmed legacy deletion covers deliberate discard. External browser requests are blocked. The existing product-save browser
also checks duplicate submit, session expiry after response loss, recovery and
revision reload/cancellation. Existing media and warranty/UI browsers are rerun.

## Results

Accepted full run: **984/984 passes**, zero failures/skips/cancellations,
`regression-accepted.log` (704,670 ms). All **63 focused product/media/editor
results** are included. All eight localization checks pass. Node22.23.1 secret-free
build/typecheck pass: `build-accepted.log` / `typecheck-accepted.log`.

Final browser results: editor **177 assertions /36 screenshots**, product-save
**185 /36**, media **204 /36**, warranty/UI **615 /96**. Total **1,181 assertions /
204 screenshots**, zero unexpected errors/external requests. Three acknowledgements
are deliberately dropped: one independent gallery update and two core saves;
those expected network aborts are separately counted. Logs: `editor-browser-accepted.log`,
`product-browser-accepted.log`, `media-browser-accepted.log`, `warranty-browser-delivery.log`.

Migration 74 SHA256: `a305188a5ac9cfb84650ebaafdedd1af3e697e7ec510fae25cab5cc3dece7aed`.
All original73 migration hashes match the baseline. All **560 compiled application
input hashes** match the frozen checkout and immutable `compiled-accepted` output.
Only the historical publisher fixture copy omits its three legacy branding assets;
original public assets are preserved. `validation-summary.json` and
`migration-preservation.json` retain machine-readable results.

Diagnostic runs remain separate and are not accepted evidence: purchase fixtures
that relied on the old implicit published default; a run without the existing
Node22 timer preload; isolated browser shell route records/async assertion waits;
the translation audit rejecting dynamically constructed keys. The first completed
984-result run passed983 and failed that key audit; it is superseded by the complete
passing run. A later pre-upload-fix run was stopped when review found the late upload
race. Published purchase fixtures now declare their intended publication explicitly;
application checkout/provider logic and certified installer artifacts are unchanged.

## Remaining acceptance boundary

Native tests and local Chrome do not certify hosted Auth/Storage, production
accounts, real ERP/provider transactions or deployment. The installer still
certifies 1–71; source72/73/74 requires separately authorized certification.
Migration 74 is development-only and used only in disposable databases here.

Stop after Task 3 commit/push for review. Do not begin Task 4.
