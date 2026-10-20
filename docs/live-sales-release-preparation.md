# Paymob/PDC disabled release preparation — 2026-10-21

Historical record. The later corrected approval completed the
[disabled production release](live-sales-release-receipt.md). Neither the original
command below nor its corrected successor may be rerun.

**PREPARATION PASS. Deployment requires separate owner approval.**
Historical preparation record: the owner later approved one exact attempt.
It [stopped during preflight](live-sales-release-blocked-receipt.md) before any
production mutation. Do not rerun the command below or reuse that approval.
No production mutation, migration, restart, provider call, credential entry,
WordPress import, public activation or Git push was performed by this operator.
The completed82→85 operator and both accounts' existing work are unchanged.

## Exact prepared release

| Binding | Value |
| --- | --- |
| Application source | `21f54e49f7da3a1f39e3802ec8e366f499fcb286` |
| Proposed release | `d2d7a8029b473e4a` |
| Archive SHA256 | `d2d7a8029b473e4ae82d562abc0c8534e14e9f12a44c4daaff9f4a57f4ffd382` |
| Archive bytes / output entries | 6,630,641 / 1,367 |
| Immutable client assets retained | 331; all individually compared after the build |
| Output inventory digest | `c32591d17593dede7d6e4c74c3b56ba4b21485a91656831501b6501e7974e25c` |
| Exact approval seal | `8cc87fe1dab33c4f7308cdf8f533322108386ee8d581b39222174387dfae5b5a` |
| Database delta | Only86, then87, with their unchanged source/history bytes |

All609 application input hashes match the completed local implementation.
No application behavior, dependency, existing migration or provider was rebuilt.
The separate release operator implements the existing reviewed deployment plan.
Its plan binds the target machine, strict SSH identity/known-hosts, verified TLS
database, service/runtime, migration files, tools, protected input hashes,
artifact, inventory, retained assets and encrypted recovery evidence.

Private evidence root:
`/Users/imac/Documents/ELcomputer/paymob-pdc-release-preparation-20261021/`.
Use only `prepared-final/plan-reviewed.json`; earlier directories and `plan.json`
are retained diagnostics, not executable release plans. The JSON seal hashes canonical content excluding
the `seal` field; it is not the pretty-printed file's byte hash.

## Current verified production boundary

Pinned SSH confirms `/srv/storefront/releases/82214df492a57126` remains selected.
Nuxt PID22422 and Caddy PID23477 remain active/running with zero restarts.
Caddy SHA256 remains
`504191ccdc985084cf9aa0bba4fc36b7cf2bcae7405af95abce469d56bd81558`.
Runtime environment, unit/drop-ins, decoder, existing output and private packing
remain unchanged. All2,613 public media files / 410,096,992 bytes match.
The candidate release, execution directory and shipping-document path are absent
on the VPS; nothing was staged there.

Read-only PostgreSQL checks confirm85 exact identities and stored sources,
134 application/Auth/Storage table fingerprints,561 products, one Auth user and
identity, four Storage objects, and zero orders, payment attempts, packing videos,
normal shipping jobs or reverse jobs. All five payment methods and PDC/auto-label/
reverse flags remain off. Public signup is disabled; email confirmation required.
Fourteen public GET checks pass, including storefront/login/Auth boundaries,
disabled checkout/signup, held provider callbacks and inaccessible private paths.
Callback403 is a held boundary, not proof of provider reachability.

The final preparation's before/after table fingerprints match. Earlier observations
record normal activity in only the two storefront analytics tables. Approval
checks allow their row activity while binding both schemas and all other tables
exactly. The migration transaction still locks and compares every original row
in all134 tables, including analytics; managed Auth/Storage remain read-only.
Business changes since approval also fail the pre-commit gate.

## Encrypted backup and recovery

The read-only PostgreSQL17.11 dump authenticates through AES-256-GCM and passes
both `pg_restore --list` and full archive-to-SQL readback into `/dev/null`.
This is archive verification, not a restore rehearsal or hosted recovery test.
Encrypted database bytes:8,725,359; SHA256
`e17b4445a459774d2f5af7e2f9845ae687479844197242e7c83de43263a2fd60`.

Eight original runtime/unit/drop-in/Caddy/extractor/output-metadata files are
separately encrypted. Full authenticated decryption checks every archived byte
against the independently collected remote hashes. Encrypted bytes:94,347;
SHA256 `2d0f1618b7c1be213a171065539f1b8ad49b934d26b5db8bf91f145ae1a2009a`.
No plaintext database/runtime archive is retained locally. No backup key or
plaintext recovery archive goes to the VPS. Original remote releases and prior
release recovery directories remain intact. Approved execution takes another
fresh encrypted database/runtime backup before its first production mutation.

The first local archive-list reader exited before consuming its input, closing
the decryption pipe. Authentication itself passed. The corrected reader fully
drains bounded plaintext into memory before starting the archive reader; no
plaintext file is created. The authenticated initial dump was reused only after
business/schema comparison and complete renewed verification. Both stopped
preparation directories, diagnostics and receipts remain preserved. No production
apply, deployment retry or recovery ran.

The first sealed check also found the178,197-byte remote command exceeded the
host's argument limit. Source and the complete sealed plan now travel through
structured SSH stdin. A300,000-character fixture verifies exact literal transport.
The reviewed plan binds that corrected operator and supersedes the initial seal.
These corrections change local release tooling only; all remote calls were reads.

## Validation and limits

- New operator suite:13 PASS, zero failures/skips, including native non-superuser
  85→87, late rollback, history corruption, disabled controls, row preservation,
  service/private ACLs, repeat refusal, tamper detection, early-reader recovery
  and large-plan transport.
- Remote guard suite:5 PASS, covering approval before target access, literal
  environment parsing, two-store path portability, drift and failed activation
  retention without Caddy restart, rollback or automatic retry.
- Clean Node22.23.1/npm10.9.8 install and empty-dotenv production build PASS;
  lockfile unchanged. Existing portable inventory/secret checks and independent
  strict archive extraction/readback PASS. Whitespace checks PASS.
- The implementation's271 passing tests/one opt-in skip and typecheck remain
  prior evidence; application inputs are identical. They were not rerun here.

The exact sealed candidate has not run on Linux or exercised the production
systemd sandbox. Those are mandatory candidate gates during an approved execution,
before SQL or service selection. Authenticated Dashboard/Quick Setup smoke,
merchant Pixel/3DS/callbacks, live charges, PDC booking/PDF/tracking and recovery
remain untested. Earlier six-page owner acceptance remains closed.

## One separately approved execution

Owner approval must identify the seal above and pause Dashboard edits for the
maintenance window. The operator rechecks current bindings and refuses a changed
tool, artifact, target, business state, gate, migration or backup. Then it records
an exclusive intent and performs the existing reviewed sequence: fresh backup;
private stage; document path/two runtime keys/narrow drop-in; candidate/sandbox
probe; one86→87 transaction; atomic application selection; one Nuxt restart;
public/database/media verification. Caddy remains identical. A failure stops at
its recorded phase without automatic retry or recovery.

Only after that separate approval, the exact command is:

```sh
/Users/imac/Documents/ELcomputer/procurement-postgrest-correction-20261018/tools/node-v22.23.1-darwin-x64/bin/node \
  /Users/imac/Documents/ELcomputer/ELcomputer/scripts/live-sales-release/operator.mjs apply \
  /Users/imac/Documents/ELcomputer/paymob-pdc-release-preparation-20261021/prepared-final/plan-reviewed.json \
  --approved 8cc87fe1dab33c4f7308cdf8f533322108386ee8d581b39222174387dfae5b5a
```

No execution intent, remote stage or completed deployment receipt exists now.
The final corrected read-only check returned `READY_FOR_OWNER_APPROVAL` for
the exact reviewed seal, with `production_writes: 0`, hosted candidate
`NOT_EXERCISED` and deployment `NOT_AUTHORIZED`. Its private evidence is
`final-reviewed-check.log`; a preparation PASS never substitutes for deployment.
Keep the rollback restrictions in [the release plan](live-sales-release.md):
schema85 shipping code cannot resume business writes on schema87. Preserve the
old release/environment and use separately reviewed forward recovery; do not
reverse migrations, restore the whole database or erase dispatch barriers.

After deployment, inspect Products, Orders, Shipping and masked Quick Setup with
the existing authorized session, without saving/enabling providers. Configure
existing credentials privately only after that smoke passes. The
[WordPress customer migration](wordpress-customer-migration.md) remains required
before unrestricted signup. Physical saleable stock, real delivery charges and
coverage, parcel settings, confirmed customer login and reachable callbacks
remain separate prerequisites before any approved controlled purchase.
