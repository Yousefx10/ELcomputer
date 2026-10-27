# Schema95 asset recovery approval review — E65

2026-10-27 Riyadh. **READY for new exact approval; no recovery execution yet.**
[Original deployment STOP](schema95-deployment-stop-receipt.md): schema95 already
installed safely; the previous application remains current. Signup is OPEN and
purchasing OFF. No SQL95 replay, Auth test or provider transaction is needed.

## Exact approval

```text
APPROVE SCHEMA95 ASSET RECOVERY 60b1fee08340d437a88dcb66093cdd18aa0b8544ae6d16c067a2cf505168d48f
```

Private sealed plan: `../schema95-asset-recovery-20261026/plan.json`.
New operator: `scripts/schema95-asset-activation/operator.mjs`.
Recovery evidence expires **2026-10-27 05:46:05 Riyadh** (02:46:05 UTC).
Fresh preflight must still pass; an expired, changed or consumed plan cannot run.
The earlier unapproved211a review is superseded, preserved and not executable.

This approval permits one asset-only Caddy correction, at most one SIGUSR1 to
reload the existing Caddy process, a separate loopback app/static candidate, and
one activation/main restart of the already staged unchanged95 application.
It authorizes **zero migrations, SQL/data/settings/runtime/Auth writes, payments,
PDC calls, public purchasing activation, Git push, retry or automatic rollback**.
The application archive, SQL, Manual50 draft and original failed evidence stay intact.

| Bound input | SHA256 / value |
|---|---|
| Recovery seal | `60b1fee08340d437a88dcb66093cdd18aa0b8544ae6d16c067a2cf505168d48f` |
| Application archive | `81becf54218a8e144137f2bdce7df1eed6bcc07745924c0167fcd7435aae37ff` |
| Candidate/current after activation | `81becf54218a8e14` / schema95 |
| Caddy before | `90d9181a396ef69c46f2df1f69ca3991ac6eb2bb601fc6cb3aeb08cb7418511f` |
| Caddy proposed | `4cf2829e60d71316991c8c29a12e382508bdaea31bc083caa58d964d15902d87` |
| Original95 staged provenance | a510 approval/staging receipt, retained unchanged |
| Installed Caddy | `v2.11.7 h1:yj0Y4fYZGPkSvibBJ1sTWE33xC0fxztVyXEW5iIdUT4=`; CanReload=no, original run/config/adapter confirmed |

## Minimal correction

Insert one GET/HEAD-only `/_nuxt/*` handler **after existing private/API holds** and
before the fallback proxy. It serves generated public bytes from the current
release, then the retained95 public directory if a file is absent. Both file servers
have explicit roots. No browsing, new API permission or private-file route is added.
All generated public entries are checked to exclude symlinks. The actual Caddy
identity can read the staged public files; verified HTTPS loopback asset reads pass.

Hashed assets remain immutable. Build/latest metadata keeps short caching and
follows the current release. Retaining95 as fallback lets an approved old-app
rollback continue serving both browser versions. Keep that retained directory until
a later reviewed release supersedes its retention; never prune it casually.

The exact-version adapter comparison removes only the new static handler and then
matches the original full configuration, including HTTPS redirect, callbacks,
commerce holds, history and private access. Existing HTTP/HTTPS listeners each get
the same single source handler. [Caddy file-server behavior](https://caddyserver.com/docs/caddyfile/directives/file_server)
and [SIGUSR1 conditions](https://caddyserver.com/docs/command-line) were checked
against the installed version/process. No Caddy upgrade is proposed.

## Qualification and recovery

- Unchanged application archive and migration hashes verified; no rebuild.
- Exact Caddy2.11.7 official macOS binary checksum verified for local qualification.
  Full local policy/asset cases pass: three retained and three current JS bodies,
  rollback fallback, missing/hidden/private denial, held purchases, unchanged login
  and callback/receipt routing to a loopback stub. Latest-metadata caching also passes.
  This establishes routing preservation, not new Auth/Paymob acceptance.
- New22 scope/seal guards and10 Python/actual-adapter guards PASS; zero skipped.
  The actual candidate adapter listens only on127.0.0.1; admin, automatic TLS and
  configuration persistence are disabled. Candidate XDG state is isolated from the
  live Caddy user/config. This check caught a draft binding issue before approval;
  its unapproved plan remains preserved. No candidate started during preparation.
- Earlier local-fixture failures are retained. One early HTTP fixture followed the
  existing canonical redirect and read public production assets; it did not submit
  Auth, payment, callbacks or writes. The accepted final fixture rejects redirects,
  stays on loopback, and omits the HTTP redirect only in its disposable HTTP adapter.
  The actual proposed production redirect is byte-identical to the original.
- Reuse the fresh fully read-back encrypted execution database/runtime backups from
  the consumed deployment. Authenticated decryption and exact ciphertext/plaintext
  hashes are reverified. Runtime/Caddy bytes still match; the current95 schema and
  original data are verified. The backup is before95 plus the exact SQL/committed
  receipt needed to reconstruct95; it is not claimed to be a new95 full restore.
  This recovery performs no database writes or restores.
- Sourceb37, all145 current protected projections, Auth security/history/ledger,
  current/staged inventories, accepted CAPTCHA/runtime, media/private-file hashes,
  Caddy binary/process and both branches/135 frozen paths are sealed. Schema96 and
  all32 deferred rows stay untouched. No Git integration or push.

## Execution and rollback

After this exact approval, the new one-shot operator runs mandatory fresh guards,
creates its own exclusive intent/stage and validates the proposed Caddy config.
It does not invoke the consumed operator. It starts a new loopback-only app/asset
candidate, verifies held capabilities and old/new file bytes, then stops both units.
The staged95 files and original a510 provenance are not rewritten.

With current schema95/data still verified, atomically install only the proposed
Caddy file and send one SIGUSR1 to the pinned existing process. A new-only asset
verified directly over loopback HTTPS proves the route loaded. No second signal
or automatic reload retry is permitted. The old app remains current at this point.
Then switch to the staged81 release and restart the main application once. Verify
new and retained HTTP assets, unchanged Auth/runtime/Caddy process/media/private
files, exact95/data preservation, signup OPEN and purchasing OFF; record completion.

Any failure stops with evidence and consumes this new approval. If the edge fails
before the switch, keep the old app and review the original Caddy restoration under
separate approval. If the edge works but app activation fails, prefer a separately
approved old-app switch while retaining the working asset fallback. Keep additive95;
no down-migration or automatic dump restore. A database restore needs independent
review/reconciliation of all subsequent customer activity. New payments remain
closed throughout, with signed callbacks and protected owned receipts preserved.

## Next after recovery PASS

Prepare one owner-operated genuine new-customer normal storefront purchase, binding
an eligible published product/model, real address, Manual50 delivery, exact total,
CARD-only policy, unrecorded-stock option, fixed durable command and one charge
budget. No PDC call or shipment. Preserve the server QA-address rejection. No payment
starts without separate approval and owner action. After that passes, request the
separate public-purchasing activation with monitoring, kill switch and the existing
manual cancellation/reimbursement process. No deferred feature becomes a launch gate.
