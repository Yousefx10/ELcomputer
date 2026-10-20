# Local Paymob/PDC validation — 2026-10-21

No production, provider, credential or public-activation operation ran.
Started clean at `e648135`; prior unpushed work is preserved.
Later read-only release preparation adds18 passing operator/remote guard checks
and a new retained-assets build. See its [receipt](live-sales-release-preparation.md).
These are separate from the implementation counts below.

| Validation | Result |
| --- | --- |
| Combined 19-file checkout/Paymob/PDC/COD/packing/reverse/Quick Setup/reset suite | **271 PASS, 0 FAIL, 1 SKIP**; 272 tests including parents. |
| Final PDC HTTP/native/filesystem suite after additional mismatch/HTTP cases | **13 PASS**, zero failures/skips; overlaps the combined run. |
| Final populated85→87 upgrade and PDC suite after the retained-AWB index | **13 PASS**, zero failures/skips; overlaps the runs above. |
| Nuxt typecheck | PASS, Node22.23.1, empty dotenv/explicit clean environment. |
| Production build | PASS, same runtime/environment; output inventory1075 entries passes existing portable-file/secret-pattern checks. |
| Git whitespace and shipping Storage-upload search | PASS; no normal/reverse label object upload/download remains. |

Private logs: `/Users/imac/Documents/ELcomputer/paymob-pdc-live-readiness-20261021/`.
`final-tests.log`, `pdc-http-final.log`, `pdc-release-final.log`,
`typecheck-final.log`, `build-final.log`, `candidate.json`,
`application-inputs.json` and `output-inventory.json` retain exact evidence.
The one skipped pre-existing opt-in test requires the separate complete native
Auth/Storage/PostgREST/TLS platform. Disposable native PostgreSQL17.11 tests did
run, including real concurrent connections and non-superuser migration ownership.
No hosted or complete-platform acceptance is inferred from these tests.

The combined run used native EMAIL_REVIEW and PAYMOB_REVIEW PG binary/driver
inputs, plus `NODE_OPTIONS=--import=./tests/helpers/keepTestProcessAlive.mjs`.
It selected these files with `node --test --test-concurrency=3`:

```text
tests/live-card-native.test.mjs
tests/pdc-live-native.test.mjs
tests/live-sales-upgrade.test.mjs
tests/paymob.test.mjs
tests/paymob-security.test.mjs
tests/paymob-concurrency.test.mjs
tests/pdc-tracking.test.mjs
tests/pdc-tracking-database.test.mjs
tests/pdc-sms.test.mjs
tests/reverse-logistics.test.mjs
tests/reverse-logistics-api.test.mjs
tests/private-packing-videos.test.mjs
tests/cod-checkout-native.test.mjs
tests/cod-collections-native.test.mjs
tests/cod-collections-validation.test.mjs
tests/checkout-command-native.test.mjs
tests/quick-setup.test.mjs
tests/quick-setup-progress.test.mjs
tests/system-reset-compatibility.test.mjs
```

The final PDC test adds an actual authorized compiled HTTP booking handler using
mocked provider transport, exact one-booking replay, wrong/missing/duplicate REF
recovery rejection, a provider REF mismatch and retained barrier after job loss.
Other cases exercise configured COD/card eligibility, received/packed stock,
changed permission/settings, no auto booking, authorized private PDFs, tampering,
permissions/symlink/path/size/type rejection and no Storage calls.
Live card tests exercise trusted delivery/fees, confirmed identity, strict stock,
one intention under concurrent calls, invalid HMAC/signed wrong amount, failure
then success/replays while outbound gates are off, and no cash/booking side effect.
Native85→87 checks preserve every old table's original projection and prove late
failure rolls back all changes under a non-superuser migration owner.

Necessary test corrections preserve coverage: the native COD fixture now chooses
the same Cairo business date as its existing SQL contract rather than UTC around
midnight; its historical85 test reads the financial projection independently of
new87 shipping columns. The legacy concurrency test now expects no shipping job
before packing/selected-courier eligibility. Its paid-transition/transaction race
checks remain. The card schema-probe mock and Quick Setup status expectations
were extended for the new contracts. Reverse HTTP tests use real private files
and assert zero Storage object upload/download calls.

Build warnings remain: intentionally blank build-time Supabase public values,
existing duplicated `getErpSettings` auto-import and existing CSS/source-map/tool
warnings. None is a failed build. Merchant Pixel/3DS, real callbacks/booking/PDF
formats, production sandbox and owner browser acceptance remain separate gates.

The [release plan](live-sales-release.md) records migration/input/inventory hashes
and pending target-bound sealing, encrypted backups and retained target assets.
The [readiness guide](live-sales-readiness.md) records exact business/provider
settings, controlled purchase steps and the required WordPress migration workstream.
