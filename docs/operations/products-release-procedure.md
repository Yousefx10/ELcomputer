# Products release procedure — prepared for separate review

No command in this procedure has been executed. This preflight authorizes reads
only. Review the committed procedure and exact artifacts before granting staging
or activation authority. A generic approval cannot replace missing entry evidence.

## Bound inputs and target

Use [products-release-baseline.json](products-release-baseline.json) for immutable
application identities, the three proposed ingress permissions and the expressly
acknowledged settings projection. The protected candidate SHA is deliberately
null until authenticated owner evidence arrives. It is not a deployment seal.

| Input or target | Required identity |
| --- | --- |
| Application source | 3d5fe61c1109190c2ac3df12fb858987bc103aa5 |
| Application archive | 7bfe6316a1f544d84b37366f447cdfdd7b11bd11d3473df632930c5ad6618846; 5,277,655 bytes |
| Node / host | Node22.23.1; Linux x86_64; existing main systemd deployment |
| Existing current pointer | /home/elcomputer/main-runtime/current |
| Existing release / rollback target | releases/release-82-40b87a3a289ea999 |
| Existing archive | /home/elcomputer/main-runtime/custody/release.tar.gz; 1b92463cb61626f1322a09dd99ecc4629e83312f42f066539e3a671ee434cc48 |
| Existing unit / runtime | elcomputer-main.service; user elcomputer, UID1002; 127.0.0.1:3002 |
| Existing environment | /home/elcomputer/main-runtime/shared/main.env; hash f82b09fd29d8851b0895332e7d56f1e2202e23149216f08dcc59c3279c9ab004 |
| Candidate release name, if later authorized | releases/products-3d5fe61-7bfe6316a1f544d8; must not exist |
| Private health port, if later authorized | 127.0.0.1:3003; recheck free immediately before use |
| Protected vhost | /etc/nginx/sites-enabled/elcomputer.net.conf |
| Ingress rollback bytes | accepted READS-v1 c859c080dcab025c6d7e614d77864905d034e8c50d6570eef95014d6f4574bb5; 472,049 bytes |

These deployment-specific paths are operational bindings, not application logic.
The application archive contains `.output/` only. It carries the already-reviewed
Procurement projection and lockfile corrections; their acceptance stays separate.
No rebuild, migration, API/Auth/RBAC/RLS change, environment edit or commerce
activation is required. The ingress repair is a distinct, narrowly scoped change.

## 1. Complete this read-only entry phase

The owner runs [products-protected-inspection.command](products-protected-inspection.command)
in the existing VPS root console once. To copy its complete reviewed block on
the iMac:

```sh
pbcopy < /Users/imac/Documents/ELcomputer/ELcomputer/docs/operations/products-protected-inspection.command
```

Use reviewed revision2. If the first draft already ran, return its existing JSON
and stop for review; do not treat this correction as automatic retry authority.

The block validates the root-owned frozen bundle/manifest and accepted APPLY
receipt before importing its read-only helpers. It never invokes an operator
main, bootstrap, Operation, apply, verify or rollback entry point. It captures
`nginx -T` exclusively in memory, checks all 23 files/22 peers and exact accepted
master/worker start identities, and computes the Products candidate independently
in memory. Only hashes, counts and verification booleans leave the root process.
It explicitly reports that proposed-candidate Nginx syntax was not run.

The program does not create a file, stage code, signal a process or query a
database. `-I -B` prevents local import-path and bytecode writes. Returned BLOCKED
means STOP; preserve its JSON, with no automatic retry. No raw dump, configuration,
environment, secret, session or private receipt should be pasted back.

After receiving PASS, record its observation time, accepted receipt, current
source hash/size and proposed candidate hash/size. Check them against the sealed
definition and independently validated renderer. Bind that receipt and all input
hashes into a new production candidate review record; never edit old receipts.
Do not populate the current null SHA from a fixture or estimate.

Disk syntax alone does not prove what workers loaded. Exact equality with the
accepted APPLY runtime, including worker PID/start identity, supplies the lineage
check. Changed workers/configuration stop this strict inspection for review;
they do not authorize rebinding historical acceptance.

## 2. Separate authorization: guarded preparation and staging

This phase needs its own reviewed, candidate-bound operator. The current
read-only command and definition archive cannot apply anything. Do not replay
historical ADM-01/fresh-install operators or edit their frozen guards.

1. Refresh source/config/peer, unit/environment, pointer/old-release, certificate
   and acknowledged-settings identities; hold concurrent configuration deployment.
   Require five payments false, Auth signup disabled, checkout/signup denied,
   and the owner-approved stock flag true. No full-row wildcard rebaseline.
2. Preserve exact current configuration/security metadata and existing application
   pointer/output/client assets using the existing guarded backup contract. Verify
   retained archive hashes, ownership/access and sufficient capacity. Create no
   database backup or mutation under this application/config-only procedure.
3. For Nginx, compute the candidate **inside the protected environment**, using the
   exact sealed transform, then compare it to the owner's fingerprint. Keep source,
   candidate, complete shadow configuration and private diff protected. Validate
   exact source/peer identities and all included files. Complete private shadow
   `nginx -t` validation must pass before approving installation/reload. This step
   requires authorized private staging; it was not possible under read-only rules.
4. Exclusively stage the application archive under the proposed new release name;
   never overwrite a prior directory or current output. Verify archive SHA/size,
   bounded safe extraction and the 1,167-entry strict inventory. Keep all 135 retained
   immutable client assets; do not restore old mutable builds/latest.json.
5. Privately start the exact candidate with the existing Linux Node runtime and
   a separately reviewed process/health launcher, under UID1002 on loopback3003.
   Keep environment values private. Anonymous health requests only: EN/AR,
   immutable assets, private/no-store 401s and existing commercial denials. No
   owner login, session refresh, form submission, receipt retry or startup worker
   mutation is authorized. Stop the private process by its exact captured identity.
6. Return the final ingress candidate SHA, protected shadow-syntax receipt,
   application extraction inventory, Linux health evidence and fresh rollback
   availability for owner review. Do not switch or reload at the end of staging.

Generic `scripts/deploy.sh` targets the separate demo PM2 deployment. It must not
be used for this main systemd release. A macOS build is not Linux acceptance.

## 3. Separate authorization: activation

Authorize only the reviewed ingress SHA and existing application archive together
with fresh entry/backup/health evidence. The application pointer switch and main
unit restart are distinct from the exact Nginx replacement and one reload. Bind
each to its specific operator and checkpoint; approval of one does not imply the
other. Apply the app UX before admitting the new administrative commands.

Immediately before each action, recheck exact preimage, peers, runtime identity
and rollback availability. Preserve ownership, mode, symlink target, xattrs, unit
hardening, environment and Restart=no. Permit one atomic pointer replacement and
one existing-unit restart, then one exact vhost replacement and at most one
Nginx reload only after successful shadow validation. No restart/reload loop.

After each phase, independently attest installed identity and worker/runtime
acceptance. Bounded anonymous health checks preserve EN/AR, assets, private cache
headers, held routes, signup/checkout and payment denials. Do not perform an
authenticated product mutation under health-check authority. Formal guarded
authenticated acceptance remains a separate, still-deferred requirement.

## Manual failure and rollback contract

Failure, timeout, interrupted acknowledgement or changed input means STOP.
Preserve artifacts and current state. No automatic retry, resume, rollback,
cleanup or replacement UUID. A missing deployment acknowledgement is not proof
that a pointer/configuration action did not occur.

A separately reviewed rollback may restore only the exact retained application
pointer/output and/or accepted READS-v1 c859c080... vhost with captured security
metadata. Match the rollback scope to which activation actually completed.
Restoring an earlier pre-READS ADM-01 vhost would remove accepted reads and is not
this rollback. Do not change schema, grants, RLS, environment, business settings,
media or the original batch. One separately authorized restart/reload may be
needed; restoration is not implicit authority to repeat it.

The existing root CHECK evidence retains the c859c080... candidate privately;
the owner inspection authenticates that recovery source. The live application's
old archive/output are verified independently. Fresh install-time backup access,
new security-metadata capture and private Linux/shadow receipts remain prerequisites.

## Owner-acknowledged stock policy

`allow_out_of_stock_purchases=true` is intentional. It is the accepted value for
this focused release baseline; it is no longer classified as an unexplained
incident or a requirement to restore false. No live value, reusable default or
historical receipt/collector was edited. The old failed collector remains a valid
record of its old false-only baseline and was not retried or relabeled PASS.

The flag permits availability/backorder behavior for non-serialized legacy
products. Normal serialized products still need physical stock; publication,
preorder terms and allocation rules remain separate. It can affect storefront
availability labels/cart affordances/SEO without enabling checkout. Five payment
flags remain false; Auth signup and customer checkout/transaction ingress remain
disabled. Future commerce activation must explicitly review this business choice.

The new accepted projection is exactly the six settings booleans plus Auth signup
state in the baseline. It is not approval of an arbitrary full settings row or its
updated_at, unrelated configuration drift, or new commercial security permissions.
Original unknown-batch reconciliation remains exact, actor-owned GET only.
