# Exact dashboard ingress operators

This is an operational tool, separate from application releases and migrations.
All deployment paths, identities and accepted hashes belong in the reviewed
`BINDING.json`; reusable Python/JavaScript contains no business/domain identity.
Use PROJECT_STATE.md for the latest owner milestone and execution authorization.

## Source and package boundaries

- `root_dashboard_read_activate.py` authenticates the entire private package
  before importing source. Its manifest fixes exactly one mode: verify, apply or
  rollback. Isolated Python and a closed module set prevent incidental imports.
- `dashboard_activation.py` reuses the unchanged CHECK parser/renderer, complete
  shadow helper, runtime inventory checks and atomic replacement helper. It never
  invokes historical CHECK/APPLY/preparation entry points.
- `bootstrap_dashboard_activation.py` is derived from reviewed CHECK intake:
  complete archive verification in memory, flat root0600 regular members, no
  traversal/links/duplicates, exclusive writes and isolated entry. Staging UID/GID
  are explicit deployment inputs, never an implicit root transfer.
- `activation_database_state.mjs` runs locally as an unprivileged user. It wraps
  the existing exact-hash vetted verifier without editing it, adds coherent scoped
  read-only fingerprints and never transports database credentials to the VPS.

The three mode-specific archives have distinct manifests. The verify manifest
cannot activate even though it contains the reviewed shared machinery. APPLY and
rollback packages require an additional root0600 AUTHORIZATION.json with an exact
owner-approved hash. No executable placeholder authorization or activation shell
command is emitted while actual receipts are missing.

## Existing private evidence

Authenticate CHECK manifest, all members, bootstrap and exact receipt/source/
candidate/metadata/index hashes. Authenticate the preserved preparation program,
input binding, PREPARATION-PASS receipt and APPLY-EVIDENCE binding. Compare actual
private evidence file fingerprints against that binding. Prove the frozen renderer
reproduces exactly the saved candidate; never regenerate a production candidate
locally or change the registry. Preserve non-API structure and strict terminal404
auxiliary policy, approved GETs/holds/HEAD/audit/login/customer restrictions.

The preparation receipt has deterministic serialization and no variable timestamp.
Its expected hash may be derived from the sealed program and complete owner-reported
fields. Such a derived value is an expected comparison, not a newly observed root
file hash. The future root gate must compare actual bytes before accepting it.

## Small additional read-only gates

The preparation binding does not contain actual Nginx unit/drop-in/executable/build
identities or full running-process/worker records. A new mode-bound verify workspace
reads those facts, checks original Nuxt/runtime inventories and environment/unit/
receipt hashes, and authenticates the complete fresh loaded configuration inventory.
It freezes actual tool/unit/module/certificate/security metadata privately. Existing
source/configuration/PID evidence must still match; no automatic baseline repair.

Linux process identity includes boot ID, PID/start ticks, executable, UID/GID,
command and cgroup. Match service MainPID to the configured existing PID file and
the preparation's master PID. Match running Nginx executable bytes to the configured
binary. Require one reviewed Nginx ExecStart and one reload command, no pending unit
daemon reload, original app PID/release/Node/listener, and no additional service
action. Unsupported service contracts stop for private review, never adaptation.

The verify gate creates READONLY-STATE.private.json and private command logs only.
It invokes Nginx -V/-T, systemctl show and ss; it does not reload or replace. Nginx
syntax/dump commands open referenced resources, so this is not a zero-filesystem-
write promise. Public EN/AR/storefront/login GETs record existing security headers
without signing in. Existing root evidence remains read-only. This is fresh
activation intake, not a repeated historical CHECK or evidence-preparation run.

Separately approve the local database gate against its full source/binding hashes.
It pins the existing verifier, transitive code/package inputs, certified baselines,
settings preimage and local Node. The existing strict-TLS/default-read-only approach
checks exact migration/schema/RLS/grants, catalog/revisions/variants/settings,
publication receipts, installation identity, empty inventory/orders/Storage and
disabled commerce/hosted signup. No sign-in, provider or file-storage API is called.

The supplement uses one REPEATABLE READ READ ONLY transaction, rechecks the certified
schema and products/variants/settings against the vetted receipt, and fingerprints
full admin_users (including permissions), customer_profiles, warehouses, inventory,
orders and order items. It returns hashes/counts, not private rows. The same gate
supports a separately approved post-operation comparison to the exact prior receipt.
Each output directory/attempt is exclusive; failures preserve private diagnostics.

## Fresh approval contract

After the actual gates return, seal a new AUTHORIZATION.json containing:

- Exact action-specific operator manifest, candidate/preimage/private-evidence hashes.
- Exact ROOT-STATE and DATABASE-STATE receipt hashes; a 64-hex operation nonce.
- Owner-reviewed scoped business fingerprint and `execution_authorized=true`.
- Explicit UTC start/expiry, at most 15 minutes apart; `nginx_reloads_max=1`.
- For rollback, exact successful APPLY receipt and APPLY manifest hashes.

Database proof must be at most five minutes old at entry, swap barrier and reload
barrier, with no future timestamps. APPLY's reviewed root state must be at most
15 minutes old. Rollback uses the original immutable service/build baseline plus
the successful APPLY runtime/installed state, checked freshly against live state;
an older baseline never substitutes for the fresh live checks or database receipt.
Expiration stops the attempt; it never regenerates approval or resumes itself.
All sealed sources, bindings and supplied controls are rehashed at barriers.

## APPLY and separate rollback

Require exact 23-file security fingerprints, canonical logical/resolved symlinks,
UID/GID/mode/xattrs and all peer bytes. Obtain full fresh Nginx inventory; prove
source/candidate policy and validate ALL private clones against the actual build
and prefix. No snippet-only syntax test is accepted. Preserve source, target and
recovery metadata privately. Repeat evidence/runtime/commerce/include/file/freshness
guards at the atomic helper's final barrier.

Replace only the resolved main target, preserving its logical symlink and security
metadata. The reviewed atomic helper uses exclusive sibling staging, fsync, one
os.replace and directory fsync. No retry, restore, rollback or deletion is called.
Validate the complete installed index, peers, main metadata, runtime and controls
before arming the single authorized systemctl reload of the bound Nginx unit.

Record reload attempted and acknowledged separately. After one bounded observation
interval require the same master, binary, service, app/runtime and existing PID
file; every active worker must belong to a new generation with the same count and
security identity. Fresh public connections must prove expected API/auth/hold,
headers, media/redirect/login/customer/commerce and terminal backend behavior.
Acknowledgement alone is insufficient: Nginx can retain its old workers/config
when reinitialization fails ([official reload behavior](https://nginx.org/en/docs/control.html)).
The dump/syntax resource-opening behavior is documented in
[Nginx switches](https://nginx.org/en/docs/switches.html).

Rollback additionally requires the exact APPLY receipt and installed main snapshot,
separate fresh database proof/approval, unchanged peers/security/runtime, and a new
private attempt. Restore only the exact accepted post-ADM source, validate the
complete restored tree/install and reload at most once. Expected older API gaps
must return; owner login stays admitted. It cannot recover an ambiguous APPLY.

Results say INFRASTRUCTURE_PASS with full_acceptance=false. Separate scoped database
post-comparison and guarded authenticated browser acceptance remain mandatory. An
infrastructure receipt never certifies those unperformed checks. No application,
release pointer, SQL/Auth/RLS, business/provider/media or Procurement change belongs
to these operators.

Any mismatch/timeout/uncertainty stops and retains all files. Durable milestones
distinguish attempted/acknowledged replacement/reload; failures never claim guessed
zero changes. A new approval is required after diagnosis, never an automatic replay.

## Local verification limits

Focused tests reuse existing parser/renderer/shadow fixtures. Both available native
Nginx versions validate complete disposable trees, actual atomic APPLY/restoration,
exact held routes/HEAD/audit and the terminal backend with a FastCGI canary. Service
reload, worker generations and database connections are simulated. Linux /proc
records are disposable fixtures and macOS xattrs use an explicit per-inode model.
No Linux root/service/xattr execution or production success is claimed. No Nuxt
build, application archive rebuild, broad dashboard audit or old CHECK is needed.
