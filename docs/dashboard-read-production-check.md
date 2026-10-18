# Production-bound dashboard ingress CHECK

The owner supplied a successful read-only ingress attestation. Do not repeat it.
Use the current handoff for its exact evidence and the next authorized action.

This preparation adds a **CHECK-only** procedure. Production execution and new
staging require approval. APPLY, rollback, Nginx reload and application activation
remain separate. This is not a new Dashboard design or route audit.

## Fixed policy and deployment binding

The approved [read policy](dashboard-read-ingress.md), renderer, route matrix and
sealed portable package remain unchanged. The registry still admits 70 GET
patterns and holds ten; existing seven HEAD entries/two helpers and the exact
login-audit POST retain their existing contracts. Nuxt authentication, active-admin
checks, normalized permissions, owner-only Setup, resource scopes and RLS stay.

`scripts/nginx/root_dashboard_read_check.py` contains no store, hostname, owner,
project, service name or deployment path. The reviewed deployment-specific
`DEPLOYMENT.json` remains separate in the operational evidence/package.
It binds the accepted current main hash, receipt/manifest identities, all loaded
peers, origin/alias/upstream, private runtime identities and workspace parent.
No application environment input or schema change is introduced.

The new binding derives from the frozen deployment envelope. It changes only
the main source hash and its protected row to the attested accepted hash. The
accepted file length comes from the existing root-private APPLY receipt after
its exact hash/acknowledgement checks. Peer, runtime and other values cannot be
silently rebased. Historical launch configuration bytes are never used as source.

The previous `private_config.py` and `atomic_config.py` helpers are reused
byte-for-byte. CHECK uses only capture, comparison, private writes and shadow
functions. It does not call the replacement helper or any historical entry point.

## CHECK package intake

The exact operational report binds archive, manifest, deployment, CHECK plan,
APPLY/rollback proposal, bootstrap, staging and owner-command hashes.
Only two new inert files are proposed for the existing inspection staging area:
the CHECK archive and the bootstrap. Neither file is an application candidate.
No transfer is implicit in preparing those files.

After separate approval, use the existing pinned SSH/exclusive transfer pattern:
verify local identities; require the bound remote nonroot UID, canonical staging
directory/mode 0700; create both files exclusively with mode 0600; verify size,
hash, UID and mode; then independently re-read and hash both files. Execute neither
file through SSH. On failure or ambiguity stop; do not overwrite or retry.

The separately approved short owner command creates one NEW root-owned mode
0700 workspace. It copies the bootstrap there as root/mode 0600 and checks its
full SHA before execution under isolated Python. The bootstrap opens the staged
archive without following its final symlink, enforces UID/mode/size/hash, and
validates the complete flat tar inventory and manifest **before** extraction.
Links, traversal, duplicates, unexpected entries, wrong bytes and wrong metadata
fail closed. Every root destination is exclusive mode 0600.

The bootstrap then starts only the CHECK entry point. There is no APPLY/rollback
CLI. An existing workspace or attempt marker prevents resumption/retry.
Never run the prepared owner command until both staged artifacts have verified
independent transfer receipts. A local command file is not execution authority.

## Private rendering and complete syntax gate

The CHECK procedure:

1. Verifies root workspace, manifest and every packaged source/binding hash.
   Imports occur only after verification; source/registry identities stay pinned.
2. Reads the frozen bundle and accepted APPLY receipt under root. Verifies every
   frozen file and receipt hash/acknowledgement, then derives the exact current
   deployment. It never executes the old attestation or CHECK/APPLY operator.
3. Requires the bound active application service/PID/retry policy, release link,
   process cwd/executable, loopback listener, environment/unit/start receipt and
   complete installed application/Node inventories. All commands are inspection.
4. Checks payment capability and disabled commerce flags using two bounded,
   credential-free loopback GETs. Redirects, proxies and provider/hosted Auth
   requests are excluded. This is not fresh hosted signup/data acceptance.
5. Verifies the bound entry hash and existing root-owned PID file against the
   observed Nginx master. Missing/relative/included PID directives, symlinked
   final PID files, writable metadata or PID mismatch stop for review; no guessed
   fallback creates a live PID file.
6. Captures `nginx -T` privately, validates the exact loaded index and every
   protected file hash/size/ownership/mode, and captures main symlink/xattrs.
   Compares security metadata with the preserved activation metadata.
7. Renders from those CURRENT accepted bytes using the unchanged approved
   renderer and effective HTTP/server include headers. Requires 70 reads/ten
   holds and an independent unchanged non-API directive projection.
8. Uses the existing private shadow helper to clone **every loaded configuration**.
   All configuration includes are rewritten to those clones; unreviewed include
   matches, missing exact includes and unsupported expressions fail closed.
   Other referenced resources retain their existing targets.
9. Reads the target Nginx build prefix and runs `nginx -T -p … -c …` against the
   full shadow entry. Requires its dumped configuration index to equal the full
   clone set. An isolated main-location snippet cannot satisfy this gate.
10. Rechecks the accepted live index/hashes/metadata, main symlink/xattrs, runtime,
    Nginx master/PID file and disabled commerce. Saves source, candidate, recovery
    metadata, exact diff and CHECK receipt inside the root workspace only.

Nginx syntax testing opens referenced files. It does not start a server or reload
workers. The root workspace receives configuration clones, diagnostics, candidate,
diff, recovery metadata and receipts; syntax can open existing configured
PID/log/temp/certificate resources. See the official
[command-line contract](https://nginx.org/en/docs/switches.html) and
[include behavior](https://nginx.org/en/docs/ngx_core_module.html#include).
Do not describe CHECK as zero VPS filesystem writes.

All Nginx stdout/stderr and tracebacks stay mode 0600 under the root workspace.
Only fixed status/error codes, hashes, byte counts, route/configuration counts
and mutation counters may be returned. No private configuration, paths, bodies,
environment values, credentials or tokens are exported. Failure preserves evidence
and stops without cleanup, retry, rollback or service action.

The successful owner-provided attestation supplies entry evidence. Fresh
preimage checks inside this **new candidate CHECK** are necessary drift guards;
they are not a repeated invocation of that successful historical attestation.

## Local validation and its limit

Run as a normal local user with `DASHBOARD_REVIEW_NGINX` bound to an isolated tool:

```sh
python3 -B tests/dashboard_access_test.py
python3 -B tests/dashboard_reads_test.py
python3 -B tests/dashboard_read_check_test.py
```

The new tests exercise two independent store bindings and actual local full-context
Nginx checks, including HTTP/server headers, five loaded synthetic configuration
files, peer syntax failure, unreviewed wildcard includes and unchanged source/PID
bytes. Other tests cover receipt/peer/runtime derivation, archive protections,
nonroot rejection, no mutation CLI, exclusive attempts, inventory/commerce drift,
credential-free bounded loopback reads and command allowlisting.

Neither local helpers nor synthetic service metadata prove the actual privileged
workflow. The production candidate hash and full private production syntax status
remain **NOT GENERATED / NOT RUN** until the approved owner CHECK succeeds.
Do not export the production source to overcome this boundary or invent a hash
from a local example. The operational report records precise pass counts/limits.

## Separately gated APPLY and rollback

The packaged APPLY/rollback file is a proposal, not an executable operator.
After root CHECK PASS, review its sanitized receipt and exact candidate identity.
Prepare a new operator/command bound to that manifest, preimage, candidate,
deployment, complete peer index, main symlink/security metadata and current
runtime. Retain fresh disabled signup/commerce and scoped business-state gates.
Repeat full private shadow validation and drift checks immediately before any
approved replacement; the accepted candidate bytes must match the checked hash.

APPLY would preserve the complete accepted preimage/security metadata, atomically
replace only the resolved main configuration, preserve its symlink/owner/mode/
xattrs, verify installed syntax and peers, and perform one separately approved
Nginx reload. No Nuxt restart, release switch, SQL, environment, Auth/RLS or media
action belongs to this operation. Stop on failure/ambiguity without recovery.

Rollback needs its own explicit approval, exact installed candidate/peer binding
and saved accepted preimage/security metadata. Restore only that preimage and
reload once after syntax validation. It restores the already accepted owner-login
policy and its known read-API gaps. It does not roll back the application/database.
If APPLY state is ambiguous, diagnose read-only and review a new plan first.

Neither operation is authorized or executed by a successful CHECK.

## Browser and Procurement gates

Reuse the [existing authenticated browser checklist](dashboard-read-ingress.md#procurement-release-and-browser-gates).
Guard direct Supabase and main-domain writes before owner navigation; coordinate
Auth/login-audit/refresh/logout effects separately. Verify EN/AR, Users/customer
privacy, owner-only Setup, media section loading, existing Products/editor,
approved metadata reads/ACLs, headers, aliases, navigation and disabled commerce.
Record held dependencies, failed loads and empty data separately. Keep all ten
holds and no production negative-test accounts. Do not infer populated-resource
success from anonymous 401 or fixture 404 branches.

The Procurement archive remains separate, unchanged and unstaged. Only after
eventual ingress approval/activation/acceptance should its independently gated
workflow resume with the **new accepted ingress receipt/hash**. Never reuse the
old main hash or weaken its entry guard. No application rebuild is needed here.
