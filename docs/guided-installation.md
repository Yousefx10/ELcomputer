# Guided fresh installation

`scripts/elcomputer-setup.mjs` coordinates the existing database installer and
first-time publisher. It initializes only an explicitly prepared empty target,
then hands the owner to the existing Dashboard Quick Setup. It creates no cloud
project, VPS, DNS, TLS or provider configuration.

## Protection boundary

Effective rejection is the union of the unchanged legacy hardcoded exclusions,
the existing publisher production/reserved registry, the new additional policy,
and all existing identity, credential, occupancy and source checks. A policy
contains exclusions only. It cannot permit a target, override a rejection or
authorize removing a legacy safeguard.

Both component targets carry the exact same protected policy path, validated
snapshot and canonical JSON digest. The database engine checks it before
connection and stage checkpoints. The publisher checks it before planning,
execution and transfer stages, and rejects reserved resolved SSH addresses.
Changed, missing, unsafe or malformed policy stops the frozen run. Standalone
component `plan` commands can also bind it with `--policy FILE`; publication
`runtime` and `plan` must match the original installation's policy binding.
Earlier component workflows without an additional policy retain their guards.
The guided workflow requires the policy.

The legacy project reference, full `elcomputer.net` apex/subdomain exclusion,
site user/path, PM2 name and application-port exclusions remain in source. The
publisher's existing independently prepared production/reserved registry is
still required. Neither it nor the preliminary local inventory can be inferred
from credentials or treated as verified by this coordinator. No production
configuration is discovered automatically.

Local development uses independently controlled synthetic reservation inputs;
that is not approval of real production host identities. The preliminary
26-record production review remains unapproved. Independently verified coverage,
provenance and explicit approval are prerequisites for any future proposal to
remove legacy exclusions or authorize a previously blocked real target.

## Supported preparation

Use a reviewed clean **unlinked** checkout, exact Node **22.23.1**, pinned
Supabase CLI **2.109.1**, PostgreSQL **17** direct authenticated TLS and the
managed platform capabilities in [installation-cli.md](installation-cli.md).
The publisher supports an operator-prepared **Ubuntu 24.04 amd64** VPS and
**PM2 6.0.14**. A new unprivileged site user, canonical directories, unused
loopback application port, independently pinned ED25519 host key, machine ID,
restricted HTTPS Nginx ingress and dedicated enabled startup unit must already
exist as described in [application-publication.md](application-publication.md).
The coordinator checks these prerequisites; it does not change services.

Keep input files operator-owned mode **0600**, workspaces and key-custody
directories **0700**, canonical, without symlink escapes and outside Git.
Use secret-manager exports/private files for credentials and the owner. Never
put passwords or keys in arguments, shell history, receipts or policy metadata.
The independent encryption-key custody directory must not already exist and
must be outside the coordinator workspace. Retain it after installation.

## Additional policy

Create one protected policy in this shape. Placeholders deliberately fail
validation until filled and reviewed. Empty arrays mean deliberate absence of
**additional** exclusions only; they do not remove legacy protection or prove
complete production coverage.

```json
{
  "format": 1,
  "policy_id": "OPERATOR_GENERATED_UUID",
  "revision": 1,
  "scope": "additional_exclusions_only",
  "reservations": {
    "project_refs": [],
    "domains": [],
    "domain_suffixes": [],
    "hosts": [],
    "addresses": [],
    "ssh_fingerprints": [],
    "machine_ids": [],
    "users": [],
    "paths": [],
    "pm2_names": [],
    "ports": []
  },
  "review": {
    "operator": "ACCOUNTABLE_OPERATOR_LABEL",
    "reviewed_at": "ACTUAL_REVIEW_TIMESTAMP",
    "provenance": "NONSECRET_REVIEW_SOURCE_LABEL",
    "reservations_sha256": "CANONICAL_RESERVATIONS_DIGEST"
  }
}
```

`domains` match exact names; `domain_suffixes` match the apex and every
dot-boundary subdomain. `hosts` and `addresses` additionally protect named and
resolved endpoints. `paths` reject the named directory and descendants across
application, upload and PM2 paths. Users, PM2 names, fingerprints, machine IDs
and application ports use global exact exclusions. Supply actual aliases;
the tool cannot certify an operator inventory's completeness. Project/endpoint
and SSH host identity checks remain authoritative independently of this list.

Compute the public reservations digest after reviewing the dataset, using
`policyDigest(policy.reservations)` from `scripts/lib/targetPolicy.mjs`.
It is SHA-256 of `JSON.stringify(value, null, 2) + '\n'`. It authenticates the
reviewed file binding within its protected workspace, not the truth of its
claims. No signing authority or independent approval is fabricated by the CLI.

## One manifest and journey

Prepare the existing strict database target, credential and owner files from
the M3 runbook, and publisher target and legacy registry from the M4 runbook.
In the **publication input template only**, set `release_sha256` to `null` to
request the coordinator's reviewed package. A supplied full digest must match
the newly built package exactly. Component publication targets always contain
the final hash. Both input targets must name the same project, installation ID
and new HTTPS origin. Neither input embeds a policy; the coordinator binds the
single explicitly named policy.

```json
{
  "format": 1,
  "database_target_file": "/private/operator/database-target.json",
  "publication_target_file": "/private/operator/publication-target.json",
  "legacy_registry_file": "/private/operator/reviewed-legacy-registry.json",
  "reservation_policy_file": "/private/operator/additional-policy.json",
  "credentials_file": "/private/operator/credentials.json",
  "owner_file": "/private/operator/owner.json",
  "key_record_directory": "/private/operator/new-store-key-custody",
  "locale": "en"
}
```

Use `ar` to select the Arabic Dashboard handoff. The process has two deliberate
approval boundaries. No confirmation is generated or accepted automatically.

```sh
SETUP_NODE_BIN=/absolute/node-v22.23.1/bin

env -i PATH="$SETUP_NODE_BIN:/usr/bin:/bin" LANG=C node scripts/elcomputer-setup.mjs plan \
  --manifest /private/operator/manifest.json --out /private/operator/new-store

env -i PATH="$SETUP_NODE_BIN:/usr/bin:/bin" LANG=C node scripts/elcomputer-setup.mjs check \
  --workspace /private/operator/new-store

env -i PATH="$SETUP_NODE_BIN:/usr/bin:/bin" LANG=C node scripts/elcomputer-setup.mjs apply \
  --workspace /private/operator/new-store \
  --confirm-database 'EXACT_REF:INSTALLATION_UUID:DATABASE_PLAN_DIGEST'

env -i PATH="$SETUP_NODE_BIN:/usr/bin:/bin" LANG=C node scripts/elcomputer-setup.mjs apply \
  --workspace /private/operator/new-store \
  --confirm-publication 'EXACT_REF:DOMAIN:SSH_FINGERPRINT:PUBLICATION_PLAN_DIGEST'

env -i PATH="$SETUP_NODE_BIN:/usr/bin:/bin" LANG=C node scripts/elcomputer-setup.mjs verify \
  --workspace /private/operator/new-store
```

Equivalent npm commands are `setup:plan/check/apply/resume/verify`. Unknown,
duplicate, force/reset and mixed-command flags are rejected. Results are
bounded secret-free JSON. Review the returned confirmation and actual protected
component plan before each `apply`.

`plan` packages the actual Nuxt application without dotenv/inherited secrets,
checks complete hashes/modes/links and performs fresh VPS/SSH/ingress preflight
**before the first database mutation**. It then prepares the original M3 plan.
The coordinator plan binds its package and VPS observations to that component
plan. Preflight and artifact integrity are rechecked before database apply.

The first confirmed apply delegates baseline/history/71/Storage/first-owner
work to M3, verifies its original completed receipt and fresh database, delegates
independent encryption-key/runtime preparation to M4, then freezes the original
publication plan. It returns `awaiting_publication_confirmation`. The second
confirmed apply delegates publication to M4, verifies both components again and
records `complete`. Neither step enables providers, schedules or public ingress.

The fresh output package excludes the legacy wordmark, demo hero image and old
favicon. A neutral SVG icon, text logo fallback and EN/AR product heading remain.
Owner-configured logos and banners keep their existing layout. Failed/missing
logos never select another merchant's image; empty hero content shows no ad.
Merchant media remains outside `.output` and is never imported by installation.

## Journal, receipts and recovery

The protected coordinator workspace retains `intent.json`, `plan.json`,
append-only `journal-NNNNNN.json`, its own derived `receipt.json`, and the
original `package/`, `database/`, `runtime/` and `publication/` workspaces.
Intent binds source, original nonsecret configurations, policy and identities;
the journal records intent before each component boundary and acknowledgement
after verified completion. It records secret-file references, never their
contents or credential hashes. Original component chains/receipts remain
authoritative. The coordinator never creates a component receipt.

An outer workspace lease prevents competing coordinator commands. Existing
database, installation, native-child and remote publication leases remain
inside their original components; the coordinator does not double-acquire or
remove them. Uncertain/stale locks use the original exact-owner/PID reconciliation
rules, never force takeover.

```sh
env -i PATH="$SETUP_NODE_BIN:/usr/bin:/bin" LANG=C node scripts/elcomputer-setup.mjs resume \
  --workspace /private/operator/new-store
```

Supply the original `--confirm-database` or `--confirm-publication` when
resuming that incomplete mutating component or recovering its missing receipt
pointer. A completed component is reconciled
through its exact original plan/chain/receipt and live checks. A lost coordinator
acknowledgement does not recreate the owner, replay 71, reseed, reset or delete
Storage/output. Completed `resume` re-verifies and can regenerate only the
coordinator's derived receipt. If an original component receipt pointer is
missing, explicit confirmation delegates restoration to that original engine
after its live checks; no schema, owner, bucket, migration or checkpoint is
replayed. The coordinator never constructs the component receipt. Use `verify`
for normal read-only acceptance.

| Interruption | Safe boundary |
| --- | --- |
| Package/preflight/database plan acknowledgement | Adopt only complete matching artifacts and original planned chain; recheck live preflight |
| Database apply acknowledgement | Verify the original completed receipt; otherwise delegate exact M3 resume with its confirmation |
| Runtime preparation acknowledgement | Validate existing complete runtime and independent key record; do not generate replacement keys |
| Publication plan acknowledgement | Validate the original complete publication plan/chain against the frozen preflight |
| Publication apply acknowledgement | Verify the original completed receipt or delegate exact M4 resume with its confirmation |
| Final acceptance/coordinator receipt | Re-run live component verification; regenerate only the coordinator receipt from its chain |
| Missing completed component receipt pointer | Explicit original confirmation plus original engine resume and live verification; no resource replay |

Incomplete package/plan/key generation without complete authoritative evidence
stops for operator investigation. Invalid component receipts, missing chains, unexpected
files, changed source/manifest/policy/configuration, live competing jobs,
ambiguous native child exit or unknown target state stop without cleanup.
Preserve the entire workspace and original checkout. Do not edit hashes,
rebase a frozen installation or use a reset/history repair as a workaround.

Since publication is a first installation, there is no prior output rollback.
M4 keeps ingress restricted and stops only its matching incomplete process.
The coordinator never rolls back the database or deletes the accepted owner.

The final receipt is secret-free operator evidence. This illustrative fragment
uses invalid placeholders deliberately; it is not a fixture result or an
authoritative receipt:

```json
{
  "format": 1,
  "kind": "elcomputer-guided-installation",
  "installation_id": "INSTALLATION_UUID",
  "project_ref": "FRESH_PROJECT_REF",
  "site_origin": "https://store.example",
  "release_sha256": "RELEASE_DIGEST",
  "intent_digest": "ORIGINAL_INTENT_DIGEST",
  "checkpoint_digest": "COMPLETION_CHECKPOINT_DIGEST",
  "installation_receipt_file": "/private/operator/new-store/database/receipt.json",
  "publication_receipt_file": "/private/operator/new-store/publication/receipt.json",
  "policy_sha256": "ADDITIONAL_POLICY_DIGEST",
  "ingress_restricted": true,
  "setup_url": "https://store.example/dashboard/setup"
}
```

The actual receipt also binds the coordinator/publication receipt digests and
lists pending hosted, ingress, recovery, commerce and policy-review acceptance.
It contains no owner email/password, API keys, master keys or secret hashes.

## Completion and acceptance limits

Final verification requires the exact source/schema/security/history through
71, six private buckets, one active internal owner, zero ordinary customers,
catalog/business/history/media, neutral setup generations, provider controls and
worker schedules OFF, and matching application/runtime/host/domain identities.
Reference/help categories in the certified seed allowlist are distinct from
product categories. Required internal owner/bootstrap audit records are allowed.

Run final verification before normal Dashboard writes or storefront/browser
acceptance traffic that creates analytics. Then sign in at the returned
`setup_url`: `/dashboard/setup` or `/ar/dashboard/setup`. Use its existing
settings links for business configuration. No configuration backend, bootstrap
web wizard, provider activation, owner acknowledgement or launch evidence is
created by this coordinator. Publication remains restricted.

Local validation uses actual owned TLS PostgreSQL/Supautils/PostgREST/Auth/
Storage, compiled Nuxt and isolated PM2. Successful Linux/site-user/SSH/DNS/
Nginx/systemd/ingress conditions on macOS are injected **test fixtures**. The
public CLI exposes no fixture or validation-override option. Tests exercise two
independent disposable brand identities and lost acknowledgements at component
boundaries; this does not establish hosted or production safety.

Separately authorized real acceptance still requires hosted Supabase supported
keys, SQL/API/TLS identity, actual managed ownership/grants/RLS/Realtime/Auth/
Storage behavior; real Ubuntu user/SSH/transfer/ownership/path/process checks;
effective Nginx restriction and denial from another client; DNS/TLS/HTTPS/API
reachability; PM2 startup/reboot, durable media, independent backup/restore and
monitored egress. Actual transactions/provider activation remain separate.
Migrations 1–71, certified bundles and production deployment helpers are unchanged.

Stop after this feature for review. Phase 4 and other product work are outside
this task. Local feature completion and hosted operational acceptance are
separate decisions.
