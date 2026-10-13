# Guided installation local validation — 2026-10-13

Development base: `894532999252211f25eda3251a365f1804c42f9c`.
Scope: one guided operator coordinator, an additional-only shared policy,
receipt-pointer reconciliation and narrow neutral-branding corrections.
No production/hosted project/VPS connection, domain transition, provider
activation, real System Reset or Phase 4 implementation occurred.

## Accepted results

| Check | Result | Evidence boundary |
| --- | --- | --- |
| Full regression | **918 passed, 0 failed/skipped/cancelled** | Complete existing corpus plus policy and two-brand coordinator tests; native dependencies configured |
| Final focused security/recovery | **26 passed, 0 failed/skipped** | Original installer/publisher contracts, additional policy, two complete native guided flows and receipt reconciliation |
| Additional CLI checks | **3 passed, 0 failed/skipped** | Force/unknown/duplicate options, ambient-secret rejection and missing-policy rejection before workspace creation |
| Existing production helpers | **42 passes included in full regression** | Disposable mocks only; no live deploy/check |
| Typecheck | Pass | Node 22.23.1 in the isolated secret-free build source; existing empty-key/duplicate ERP import warnings |
| Production build/package | Pass; **1,040 inventory entries** | Actual Nuxt production output, full modes/file/link hashes, secret scan; legacy media omitted |
| Guided actual Nuxt/owner browser | **70 assertions / 9 screenshots** | Actual coordinator, SQL/Auth/Storage/Nuxt/PM2, final verification before browser traffic, new-owner login and non-owner denial |
| Publisher actual Nuxt browser | **68 assertions / 9 screenshots** | Same actual services; independent component compatibility |
| Neutral content browser | **245 assertions / 32 screenshots** | Actual Vue/content-reader fixtures, absent/error/configured content, broken and dark-only logos, neutral EN/AR headings |
| Existing Setup browser | **1,171 assertions / 146 screenshots** | Existing Vue/H3/SQL fixtures; Phase 1/2, EN/AR/RTL/mobile/themes |
| Existing PDC browser | **495 assertions / 48 screenshots** | Existing component/API/Auth fixtures |
| Browser errors/external requests | **0 / 0** | All five browser runs; this is not OS-wide hosted egress certification |

The full run and three additional CLI cases cover **921 passing tests** in
total. The 26-case focused run repeats relevant security/recovery coverage;
it is not added again to that total.

Two discarded setup runs exposed missing PostgREST libpq search configuration
and an extensionless Supautils path incompatible with the baseline fixtures'
file-stat prerequisite. The accepted full rerun supplies the actual `.dylib`
file and prepared PG library directory. The failed full/contract logs are
preserved; the overwritten initial native-loader run is recorded in the
discarded-setup summary only. None is acceptance. A policy-review type check was also tightened after an
initial contract test caught a null label being coerced into text.

## Actual component integration

Two independently owned disposable platforms model different brand domains,
installation/project identities, owners, credentials, key custody, machine/
SSH identities and isolated app process names/homes/ports. Actual services are
authenticated TLS/SCRAM PostgreSQL 17.11, Supautils v3.4.4, PostgREST 16.4,
Auth 2.184.0, Storage 1.28.0, Node 22.23.1, compiled Nuxt and PM2 6.0.14.

Each flow proves no application schema, Auth identity or bucket before the
package/preflight boundary; one actual owner creation; 71 exact history entries;
six private buckets; zero products/categories/brands/orders/non-owner profiles/
Storage objects; OFF controls; successful app health and original receipts.
Each store's IDs, credentials/keys and modelled server/process identities differ.
The site user is the actual macOS test account, not two real Linux users.

One journey intentionally loses acknowledgements after package, preflight,
database planning/apply, runtime creation, publication planning/apply and final
verification. Resume reconciles original authority without creating another
owner or native migration job. Tests also reject policy/configuration drift,
self-rehashed coordinator-plan edits, wrong live preflight identity, missing
confirmations, competing leases and completed apply. Parent receipt corruption
is repaired from its journal; missing component pointers require the exact
original confirmation and are restored by the original engine after live checks.
No coordinator-generated component receipt exists.

Secret checks cover plans, journals, receipts, HTML and PM2 dumps. Runtime and
independent encryption-key records remain protected outside Git/output.
Fresh packaging omits the old wordmark, promotional hero and favicon. EN/AR,
RTL, mobile and theme checks preserve configured logos/banners and the existing
Quick Setup settings/progress experience. No owner acknowledgement is fabricated.

## Reproduction and retained evidence

The protected local evidence directory is
`/Users/imac/Documents/ELcomputer/quick-setup-guided-installation-review-20261013`.
It retains accepted/failed-setup logs with explicit status, source preservation
hashes, build metadata and checksums. A post-commit clean package records the
exact delivery commit separately. Disposed fixture identities are not reusable
installation authority.

Use the native dependencies documented in the M3/M4 runbooks. On this macOS
toolchain `SUPAUTILS_REVIEW_LIBRARY` must name the actual `supautils.dylib` file,
and `DYLD_LIBRARY_PATH` must include the prepared SSL-capable PostgreSQL 17.11
library directory for PostgREST. Supply Email/Paymob PG binary/driver variables,
the PostgREST binary and the newly compiled `PUBLICATION_REVIEW_OUTPUT`.
The public coordinator has no fixture or override flag.

```sh
NODE_OPTIONS=--import=./tests/helpers/keepTestProcessAlive.mjs \
  node --test --test-concurrency=3 tests/*.test.mjs
node --test tests/guided-cli.test.mjs tests/target-policy.test.mjs tests/guided-installation.test.mjs
GUIDED_REVIEW=true node scripts/publication-browser.mjs
node scripts/neutral-storefront-browser.mjs
node scripts/setup-browser.mjs
node scripts/pdc-tracking-browser.mjs
```

These are test commands, not hosted execution instructions. The coordinator
journey, protected manifest, confirmations and recovery are documented in
[guided-installation.md](guided-installation.md).

## Acceptance still pending

Linux/site-user/path profile, SSH transport, DNS, Nginx, systemd and HTTPS ingress
success are injected fixtures on macOS. Actual Ubuntu publication/ownership/
user isolation, externally effective IP denial, SSH interruption and reboot
resurrection remain unperformed. Hosted supported opaque/public/private keys,
managed capabilities/ACLs/RLS, Auth/Storage/Realtime operations and API reachability
remain unaccepted. Independently controlled backups/restores, durable media
through reboot and monitored host-wide egress also need separately authorized
real acceptance. No commerce/provider transaction or public launch is certified.

Legacy hardcoded exclusions remain intact. The preliminary production inventory
and its 26 records remain independently unapproved and cannot prove target
safety. Any future removal of legacy exclusions or authorization of a previously
blocked real target requires independently reviewed coverage/provenance and
explicit approval. Feature development is ready to freeze for review; operational
Phase 3 acceptance remains pending. No further feature or phase starts here.
