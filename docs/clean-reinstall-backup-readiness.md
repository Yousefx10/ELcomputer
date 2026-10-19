# Existing VPS clean reinstall: backup readiness

Date: **20 October 2026, Asia/Riyadh**. Verdict: **BLOCKED**.

Reuse the existing VPS. No reinstall is authorized by this report.
This task covers preservation and restoration evidence only.

Evidence directory, outside Git and the VPS:
`/Users/imac/Documents/ELcomputer/clean-reinstall-backup-readiness-20261020/`.
Detailed records, SQL, configuration and customer information are encrypted.
The committed report contains counts, hashes and operational paths only.

## Current production baseline

The verified production project is `amighioggheqddyypgcl`.
Older backup tooling targets a different, historical deployment.
Its backups cannot establish current production recovery.
The accepted database capture completed at `2026-10-20T02:02:36.432000+03:00`.

| Item | Verified current state |
| --- | --- |
| Originally imported product identities | 560 present; none missing; no additional products |
| Publication | 559 published; one Draft |
| Variant definitions | 628 rows; 576 active; all 68 original variations present |
| Product gallery | 2,836 rows |
| Specifications | 3,555 rows; differences described below |
| Categories / brands | 9 / 24 |
| Supabase Auth / identities | 1 / 1 |
| Customer profiles | 1, internal owner profile; zero external customer profiles |
| Customer orders | 0 |
| Private Storage buckets / objects | 6 / 0 |
| Certified migration identities | All 82 match |
| Application schema, grants and RLS | Exact certified match |
| Foreign keys | All 255 checked; zero orphan rows; all validated |

All 560 source-to-target product IDs were checked against preserved receipts.
Every supplied product field in the original import batches was compared.
Only the subsequent publication of 559 products differs in that projection.
Every current product revision matches its original revision plus publication.
All 576 imported variant IDs and their name/code/active fields still match.
This does not imply that independently saved sections remained unchanged.

The frozen batches contain 3,582 specification rows.
Four products have different current specification sections:
`wp_11215`, `wp_11622`, `wp_11633`, `wp_11639`.
An exact label/value/order/highlight comparison finds 81 original rows unmatched and 54 current rows
unmatched, giving the net difference of 27 rows.
The change's actor, time and cause are **not established**.
These are captured section differences, not evidence that backup creation deleted data.
Both complete versions are preserved, including the current database snapshot.
Do not replace current sections with the original import.
Detailed comparisons remain encrypted in `specification-comparison.json.enc`.

The original source snapshot and all 1,065 import-plan files still match their
approved hashes. The WordPress migration was not rerun.

## Customer accounts and password preservation

These are separate datasets. Their counts must not be combined.

| Dataset | Live WordPress | Archive WordPress | Current Supabase |
| --- | ---: | ---: | ---: |
| WordPress user accounts | 518 | 518 | Not a WordPress user store |
| WordPress customer role | 516 | 513 | No corresponding imported customer identities |
| WordPress administrator role | 2 | 5 | One independently bootstrapped owner |
| WooCommerce customer lookup rows | 590 | 588 | No imported lookup table |
| Registered customer lookup rows | 502 | 500 | Not equivalent to Auth users |
| Guest customer lookup rows | 88 | 88 | Guests do not imply login accounts |
| HPOS order/refund rows | 597 | 595 | Zero customer orders |

Registered WooCommerce lookup rows have no missing WordPress user link.
The archive is older: it lacks two current order/refund rows and two lookup rows.
The fresh live database export preserves these later records.
An October 15 backup alone would lose them.

One WordPress email overlaps the Supabase owner email.
Email overlap does not prove an identity migration.
None of the 516 live WordPress customer-role accounts overlaps Supabase Auth.
The sole Supabase customer profile is marked internal.
There is no verified legacy-user-to-Auth UUID mapping or customer account import.
The Nuxt login uses Supabase `signInWithPassword`; no WordPress password bridge
was found in the application login/server code.
Historical customer passwords have not been preserved as working Nuxt logins.

All 518 password hashes in each WordPress database use `$wp$2y$`.
This is WordPress bcrypt with password prehashing.
Supabase's ordinary bcrypt import does not establish compatible verification.
Removing the WordPress prefix would not preserve password compatibility.
This follows the different input transformations described in
[WordPress Core](https://make.wordpress.org/core/2025/02/17/wordpress-6-8-will-use-bcrypt-for-password-hashing/)
and [Supabase's migration documentation](https://supabase.com/docs/guides/platform/migrating-to-supabase/auth0).
No production sign-in, password reset, Auth creation or email was attempted.

Preserve WordPress user IDs, complete password hashes, emails, role/user metadata,
billing/shipping metadata, customer lookup links, order ownership and guest data.
Both fresh SQL exports and the historical source packages retain these records.
Retain Supabase UUIDs, Auth identities, password hashes, profile links and RBAC.
The current Supabase Auth schema is included in its full database backup.

A future customer migration needs an approved password reset process or a reviewed
server-side legacy verification bridge with explicit identity mapping.
That work is separate from backup readiness and the VPS reinstall.
No automatic credential conversion or permission bypass is authorized.

## VPS files and application media

All three existing application homes were inventoried without following symlinks:
`/home/elcomputer`, `/home/elcomputerold`, `/home/newelcomputer`.
Each inventory returned zero access errors inside its respective home.
Backup streams write encrypted files on the iMac, without remote archive files.
Active log directories are excluded; their metadata remains inventoried.

The running service explicitly uses `/home/elcomputer/catalog-media/uploads`.
Its **2,505 files / 389,938,079 bytes** match every original imported image hash.
There are no additional files in that root at observation time.

The older Nuxt deployment also owns
`/home/newelcomputer/htdocs/new.elcomputer.net/storage/uploads`:
**102 files / 16,822,229 bytes**, comprising 86 product and 16 settings images.
The earlier October 17 inventory contained 12 settings images.
These four later settings uploads must be retained too.
The complete older home is backed up, including these files.

The complete home copies also preserve current WordPress uploads, archive uploads,
source backup packages, custom PHP files, private restore material, runtime
environment files, runtime encryption keys, release/custody archives and application
assets. Private material is not exposed through the public-image restoration test.
The readable main service unit and its drop-ins have a separate encrypted copy.

Current Supabase private-document, packing-video, support/chat attachment and
claims-evidence tables contain no file records; Storage contains zero objects.
Their schema, buckets, policies and database records are nevertheless preserved.
Do not substitute public image storage for these private contracts later.

Protected Nginx configuration and private TLS material remain inaccessible to the
authorized nonroot accounts. Their latest complete backup is **not verified**.
The main service unit hash is
`08fb43104582cd2692e0090b4f8223bf58ea9e54243b517cb9f13a8b70b5c674`.
Its active drop-in is `10-launch-no-retry.conf`; both are already copied.
Existing site homes alone cannot recreate all host routing and certificates.

## Existing backups and new copies

Seven older encrypted database sets passed authenticated checks of all 63
components. A separate incomplete set remains excluded.
Those sets cover older migration checkpoints 63/69, with older deployment bindings.
They are preserved, but are not credited as current production recovery.

The owner's 22 local WPvivid parts total **6,253,640,707 bytes**.
All match their previously accepted SHA-256 values.
A new authenticated encrypted copy preserves the complete set off the VPS.
The original ZIPs, discovery records and earlier restore evidence remain untouched.
Existing unencrypted historical source files were not deleted or relabeled encrypted.

New encrypted copies include:

- `database-v4/`: current Supabase custom archive, roles without database-role
  passwords, table fingerprints, full security metadata, Auth rows and schema.
- Fresh SQL exports for live and archive WordPress, including users and metadata.
- Complete application home copies, excluding active logs.
- All 22 original WordPress backup parts.
- Migration provenance, product identity receipts, import plans and source snapshots.
- The exact accepted legacy URL mapping and generated Nginx redirect maps.
- Readable service configuration and the final application/Git custody copy.

Database and home copies use authenticated AES-256-GCM, format `ELCBK01`.
The new streaming helper supports the existing envelope format.
It verifies the whole envelope before releasing decrypted bytes.
Keys reside separately in `production-backup-credentials`, mode 0600.
The backup directory is mode 0700; ciphertext files are mode 0600.
Private keys and customer records are absent from committed reports.
This is off-VPS custody on the existing iMac, not a verified second-device escrow.
Hostinger snapshot/backup availability cannot be verified through current access
and is not credited toward readiness.

## Restoration evidence

| Restoration check | Evidence |
| --- | --- |
| Supabase data | All 173 restored table counts and SHA-256 fingerprints match |
| Security/schema | All 13 metadata categories, 82 migrations and 60 permission checks match |
| Auth preservation | Exact users/identity/profile table fingerprints, including password hashes |
| Live WordPress | 466 tables; all counts match; 518 user IDs/emails/password hashes match |
| Archive WordPress | 465 tables; all counts match; 518 user IDs/emails/password hashes match |
| Original WordPress packages | 22 restored package hashes checked against accepted source hashes |
| Archive home | 203,012 files independently rehashed; zero differences |
| Older Nuxt home | 17,632 files and 41 symlinks; zero byte/path/owner/mode differences |
| Main home | 101,234 files and eight symlinks; zero byte/path/owner/mode differences |
| Restored media delivery | All 2,505 URLs / 389,938,079 bytes pass through the actual Nuxt GET handler under Node 22.23.1 |
| Legacy redirects | All 1,634 paths plus both forms of 559 query IDs pass actual local Nginx: 2,752 redirects |
| Mapping holds | 28 held paths and six held IDs retained; no chains or loops |
| Current public samples | 48 redirect HEAD checks and 16 exact image GET/hash checks pass |
| Source/Git custody | Final HEAD and all refs retained in an encrypted bundle; independent mirror restore and full custody archive verified; see SOURCE-CUSTODY.json |

Database restores use fresh, disposable Unix-socket-only clusters.
IP egress is denied. WordPress/PHP was never bootstrapped.
Production was not connected from either restore laboratory.
The MySQL rehearsal used 8.0.44 against 8.4.10 SQL exports.
It verifies these actual tables and identities, not a complete hosted PHP runtime.
One Wordfence role-count table uses MEMORY; it is not transactionally protected
by InnoDB's snapshot. Its restored row count also matched the independent baseline.
No database locks or source changes were used to freeze it.

The PostgreSQL restore required `pg_trgm` in an isolated toolchain copy.
Its source matches the official PostgreSQL 17.11 checksum.
Managed event-trigger ownership required temporary privileges inside that isolated
bootstrap, followed by restoration of the exact source role attributes.
All seven event triggers and every security metadata category then matched.
Original tools, certificates and production permissions were not changed.

Earlier read-only collector failures and failed local rehearsals remain preserved.
They are excluded from acceptance. The accepted database set is **database-v4**;
the accepted PostgreSQL result is **ISOLATED-DATABASE-RESTORE-v3.json**.
Do not rerun any historical installer, importer, publisher or failed apply/resume.

These checks do not prove hosted Auth login, managed-platform signing-key recovery,
TLS installation or a production host restore. The current Supabase project remains
external to the VPS and must be retained unchanged during any future host reinstall.

## Application source custody

Startup HEAD and live GitHub main both matched
`1be84542733db0fa146d6c6b1da179a366abcc2e`.
The worktree was clean, with one worktree and no unpushed branch work.
All prior Codex commits remain intact. The task commit is deliberately unpushed.
`SOURCE-CUSTODY.json` binds the final commit, tree and all restored Git refs.
The encrypted full custody archive includes `.git`, reflogs, loose objects and
ignored local configuration, alongside the working source. Only generated
`node_modules`, `.nuxt` and `.output` are excluded. The separate live runtime
backup preserves the deployed application output. No production build was run.
Focused envelope tamper/truncation/key/overwrite tests pass under Node 22.23.1.
The prepared root exporter also rejects nonroot execution before any file write.

## Remaining gate and one owner action

**Approve the narrowly scoped protected-configuration backup export.**

Review `PROTECTED-CONFIG-EXPORT-PLAN.json` in the evidence directory.
Its deployment-specific configuration and generic exporter are fully prepared.
They are not staged or executed on the VPS.
Configuration SHA-256: `79cd6343065f8782417ed5ed08b429da7c428c1ebaf03c61c25efec60c08b3bb`.
Exporter SHA-256: `8d4e7b6f3c34f89e06f3348cefe8c69a6a2016f0b8bc9603ac57ce5b6fcee4f1`.
The approval requirement comes from the actual protected-file access failures:
`/etc/nginx` and `/etc/ssl/private` return `PermissionError` to authorized accounts.
Existing nonroot access does not authorize root execution or changing permissions.

The proposed owner-run action reads the listed Nginx/TLS/service/cron/SSH/database/
PHP/firewall configuration and named historical root receipts.
It creates only exclusive backup directories, public recipient material,
ciphertext and receipts. It does not execute Nginx, connect to a database, reload
services, change DNS, deploy, reinstall or alter source configuration.
Recipient encryption was tested against the actual VPS OpenSSL using a harmless
in-memory fixture. The private recipient key remains on the iMac.

After approval and owner execution, retrieve the ciphertext through the existing
pinned nonroot connection. Authenticate it locally and verify all required paths
and external certificate/include dependencies before reconsidering readiness.
Stop on error or unexpected scope; never automatically rerun the exporter.
No root command or reset is authorized by this report.

Immediately before a separately approved reset, compare the live files, database
state and backup watermark again. Preserve intervening changes in a fresh verified
copy. An earlier snapshot cannot cover changes made after its recorded cutoff.
The later single-site architecture remains a separate task.
