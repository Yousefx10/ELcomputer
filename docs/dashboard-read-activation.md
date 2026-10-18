# Dashboard read ingress activation preparation

The latest owner-reported production CHECK PASS supplies the accepted source,
candidate, manifest, deployment, route counts and complete shadow result.
It does not authorize staging, activation, reload or browser sessions.
Use PROJECT_STATE.md for the current deployment-specific evidence and next action.

The locally prepared [activation operators](dashboard-read-operators.md) consume
the owner-reported evidence hashes. Their sealed source does not grant execution
authority. Fresh root/database receipts and a separately reviewed, time-bound
authorization remain mandatory before APPLY; rollback has its own authorization.

## Evidence gate before sealing an activation operator

`prepare_dashboard_read_activation.py` is an evidence-only operator. It has no
APPLY/rollback mode, command runner, HTTP/SQL transport or cleanup/retry action.
Its separately hash-bound PREPARATION.json contains operational workspace paths,
expected CHECK receipt fields, frozen CHECK/bootstrap hashes and its own program
hash. No deployment hostname, account or application release belongs in its logic.

After separately approved inert staging and owner-console execution, it:

1. Requires a new canonical root:root0700 workspace, root:root0600 binding/program,
   exact full hashes and an exclusive attempt marker.
2. Authenticates the existing CHECK manifest and every frozen member before
   importing only the reviewed rendering/header/PID helpers. Rejects unexpected
   module paths, mismatched receipt flags/types, source or candidate identities.
3. Authenticates the saved complete configuration dump and recovery metadata.
   Proves the approved renderer reproduces the exact checked candidate, including
   strict auxiliary classification, both frontend guards and the unchanged policy.
   It never invokes CHECK.main or repeats target Nginx syntax/runtime probes.
4. Reads only the listed current configuration files and security metadata.
   Requires accepted hashes, sizes, UID/modes and the main's saved symlink,
   target/stat/GID/xattrs; records peer GIDs and fingerprints without guessing.
   Reads the configured existing PID file without creating it. Rechecks all
   evidence, configuration fingerprints and PID after collection.
5. Writes private activation evidence and a sanitized hashes/counts result into
   the new workspace. Existing CHECK evidence is not rewritten. Configuration,
   candidate, xattrs, environment and credentials are never exported.

The evidence gate does not freshly verify the Nginx loaded index, runtime,
schema/catalog, hosted signup or commerce. Its result expressly reports those
limits and `apply_ready=false`. The final activation operator is withheld until
these private identities and the fresh entry controls can be bound and reviewed.
Do not call this gate another CHECK PASS or authorization to activate.

## Final APPLY contract

The deployment-specific procedure must bind the exact CHECK candidate and private
receipt/recovery/index/evidence hashes, complete peer/security snapshot, approved
policy, accepted frozen deployment and a new operator manifest. No placeholders
or automatic rebasing may enter an executable APPLY command.

Fresh entry must verify the previously approved read-only schema/catalog/settings
contract, public signup restrictions and business state. Hash/target/timestamp
bindings and the permitted execution window must be explicit. Old observations
are not fresh evidence; legitimate settings changes require review, not restoration.

Immediately before replacement, revalidate the existing runtime/release pointer,
process/PID, unit/env/start receipt/inventories, disabled commerce, full loaded
configuration set and every hash/metadata/symlink/xattr. Reproduce the exact checked
candidate from the current accepted bytes. Validate a complete private shadow
with the actual Nginx build/prefix and exact clone index, then repeat drift guards.

Reuse the reviewed atomic helper only under a newly reviewed operator: exclusive
sibling staging, original UID/GID/mode/xattrs, file fsync, final comparison, atomic
replacement of the resolved target and directory fsync. Preserve the logical
symlink, source/recovery evidence and private durable attempt milestones.
[Python's replace contract](https://docs.python.org/3/library/os.html#os.replace)
requires a successful same-filesystem rename for atomic replacement.

After installation, validate the complete installed Nginx configuration/index,
unchanged peers and security/runtime controls. Only then attempt exactly one
explicitly authorized reload of the bound Nginx unit. No Nuxt restart, release
switch, environment, SQL/Auth/RLS, business or media operation belongs here.

Reload acknowledgement alone does not establish new-worker acceptance. Require
unchanged master/runtime identity, observed new-worker acceptance and bounded
fresh-connection probes. Nginx can continue serving its old configuration when
reload initialization fails; see [reload behavior](https://nginx.org/en/docs/control.html).
Any failure or ambiguity stops without retry, reload repetition, rollback or cleanup.

`nginx -T` tests syntax and opens referenced resources while dumping configuration.
All output must remain root-private. See the [command-line contract](https://nginx.org/en/docs/switches.html).
Do not describe the workflow as zero filesystem writes.

## Separate rollback and browser gates

Rollback requires its own new reviewed operator/manifest and explicit approval,
exact currently installed candidate, successful APPLY receipt/recovery evidence,
unchanged peers/security/runtime and full restored shadow validation. Restore only
the accepted post-ADM preimage; validate the complete installed configuration and
reload once. Existing owner login remains, with the older known read-API gaps.
Application/database/environment restoration is excluded. Ambiguous activation
requires separate diagnosis before any rollback command is prepared or executed.

After activation, separately approve existing-owner Auth/login-audit/refresh/logout
side effects. Install independent browser guards before navigation, including
main-domain and direct Supabase business/RPC/chat/document writes. Record only
sanitized results; no tokens, credentials, HAR, tracing or session export.

Use the deployment checklist for EN/AR, navigation/session, all approved modules,
resource permissions, held routes and disabled commerce. Reachability, missing
resource404s and authenticated successful workflows are different outcomes.
No production negative-test accounts or permission changes are implied. Keep the
Procurement application candidate behind its separate release and acceptance gates.
