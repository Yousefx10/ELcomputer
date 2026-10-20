# Existing VPS: clean single-site deployment plan

Decision, 2026-10-20: **BLOCKED for destructive reinstall.** The recovery data
passes verification. The prepared Ubuntu installation and systemd/reboot sequence
still need a disposable Linux rehearsal. Owner console recovery and the final
backup watermark also require confirmation before erasure.

Use the ONE existing VPS. Choose **plain Ubuntu 24.04 LTS, x86_64**, without a
control panel. Install pinned Node **22.23.1**, npm **10.9.8**, Nuxt's reviewed
Node-server artifact and Caddy **2.11.7**. No second VPS is required.

This task performs preparation, local restoration/tests and narrowly scoped
production reads only. No reset, deployment, DNS change, production business write,
Nginx command/configuration change, service restart or cleanup was performed.

## Verified recovery inputs

Evidence: `/Users/imac/Documents/ELcomputer/clean-reinstall-plan-20261020/`.
Original backups: `../clean-reinstall-backup-readiness-20261020/`.
The AES key remains separately in `../production-backup-credentials/`.
These paths are outside both Git and the VPS. Reports contain no secret values
or customer rows. `BACKUP-REVERIFICATION.json` records fresh authenticated
decryption and exact ciphertext hashes for **20 components / 31,813,290,811 bytes**.
All nine referenced restore receipts still match their recorded hashes.

| Recovery area | Verified result |
| --- | --- |
| Current Supabase snapshot | All 173 table fingerprints, 13 security metadata categories, 82 migration identities and 60 effective-permission checks restored in the earlier isolated laboratory; receipt reverified here. |
| Products | All 560 original IDs; current snapshot has 559 published/one Draft, 628 definitions, 2,836 gallery and 3,555 specification rows. Preserve current metadata; four sections differ from the historical import. |
| Auth and customer records | One Supabase user/identity and internal owner profile. Offline password verification against the restored Auth hash passes. No production login or password reset was attempted. |
| WordPress | Both fresh SQL exports restore 466/465 tables and all 518 user/password-hash identities each. Original 22 backup parts and source homes remain encrypted. |
| Customer-login limitation | WordPress customers were never migrated into Supabase Auth. WordPress `$wp$2y$` hashes are not directly compatible with Supabase bcrypt. The VPS reinstall does not implement that separate migration. |
| VPS public media | Dedicated authenticated recovery archive contains all 2,505 original images plus all 102 older uploads: **2,607 files / 406,760,308 bytes**, no filename collisions. The 102 include 86 products and 16 settings files. |
| Private files and metadata | Current read-only check: six private Supabase buckets, zero Storage objects, **2,505 `catalog_private.media_paths` records**. Full DB backup preserves these rows, deletion states, relationships and bucket policy metadata. Full homes preserve private files. |
| SEO | Public, version-controlled projection retains exactly 1,634 accepted paths, 559 product-query IDs, 28 held paths and six held IDs. Original full mapping and provenance remain encrypted. |
| Runtime secrets | Original `main.env` recovered from authenticated home backup; its hash matches the independent archive manifest. New encrypted runtime environment preserves both encryption keys and matches protected production Supabase keys. |
| Recovery account material | Dedicated authenticated encrypted archive of seven protected account/connection/CA/SMTP inputs; the earlier operational archive already includes private production material too. |
| Application source | Startup HEAD `90e87e5` matched local and live remote main, with a clean worktree. Prior all-ref/source restore passes. This task's final unpushed commit receives a separate encrypted bundle and mirror check. |

The original backup report remains historical evidence. Its protected-Nginx export
gate is superseded for this new architecture by the owner's decision to discard
CloudPanel/Nginx and auxiliary sites. Do not execute the old root inspector or
protected-config exporter as part of this plan.

## What can be discarded

The old CloudPanel/Nginx routing tree, PHP/MySQL installation, PM2, old local users,
root activation receipts and old TLS keys are **not installation inputs**.
Do not restore `/etc/nginx`, a home directory wholesale, old timers or old cron jobs.
The old readable service and full application homes remain encrypted evidence.

The required main-site behavior has an explicit replacement:

| Required behavior | Replacement |
| --- | --- |
| HTTPS and certificate renewal | Caddy automatic HTTPS, durable `/var/lib/caddy`, systemd startup. Issue fresh certificates for apex and www. |
| Canonical host/protocol | www → HTTPS apex; plain HTTP apex → HTTPS apex. Legacy links on either authority go directly to their final HTTPS destination. |
| Accepted legacy SEO | Generated Caddy maps from `deployments/elcomputer/legacy-urls.json`; Unicode and encoded paths, product-ID queries, held 503s and target queries retained. |
| Nuxt pages, APIs and WebSockets | One loopback Node listener, one Caddy reverse proxy, no generic API method allowlist, no automatic upstream mutation retry. |
| Durable public images | `/srv/storefront/shared/uploads`; every URL passes through the existing scoped Nuxt image handler. Caddy exposes no filesystem root or private-file alias. |
| Private administration | Existing bearer verification, active staff checks, named permissions, transaction authorization, RLS and private Storage remain unchanged. |
| Disabled commerce | Explicit edge denial for customer login/signup/account/cart/checkout, payment routes/webhooks, customer support/chat, internal workers, ERP sync and system reset. Five payment settings remain false; hosted Auth signup remains disabled. |
| OS protection | Unprivileged separate app/Caddy users; loopback port 3000, UFW 22/80/443 only, restricted filesystem writes, bounded crash restarts, private env and journald. |
| Auxiliary domains | No site blocks or certificates; unknown HTTP hosts get 421. Unknown HTTPS names have no configured certificate. WordPress stays archived and unexecuted. |

This establishes the required main-site contract. It does not claim that every
historical CloudPanel directive has been inspected or reproduced. None is being
relied on. Persistent certificate issuance, Ubuntu hardening and reboot operation
remain Linux/owner acceptance gates.

Main and www currently resolve directly to `168.231.104.25`; www is an apex CNAME.
No apex IPv6 or CAA restriction was observed. Nameservers are external
`domaincontrol.com`; MX is Microsoft 365, not this VPS. Recheck before maintenance.
Keep the existing IP/location. An unexpected provider IP change stops this plan;
any DNS action requires its own authorization.

Caddy needs inbound TCP 80/443 and outbound DNS/HTTPS for issuance/renewal. No DNS
API secret is needed for the proposed HTTP/TLS challenges. Do not add wildcard
hosts, CDN proxy trust, domain-wide HSTS subdomain coverage or an old TLS key.
See [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https),
[proxy defaults](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy)
and [managed service behavior](https://caddyserver.com/docs/running).

## Application and authorization boundary

Use the sealed **Products bulk recovery** artifact from reviewed commit
`3d5fe61c1109190c2ac3df12fb858987bc103aa5`:

- Archive SHA-256 `7bfe6316a1f544d84b37366f447cdfdd7b11bd11d3473df632930c5ad6618846`.
- 5,277,655 bytes; 1,167 inventory entries; **all 597 application inputs match
  the latest checkout**. It includes the Procurement projection and lock fixes.
- Source: `../product-bulk-release-review-20261019-9oxru4kf/candidate/`.
- Build: clean Node 22.23.1/npm 10.9.8, no production dotenv; 135 retained immutable
  client assets. The artifact contains no native payload or escaping link.
- `package.py` rejects any changed application input or candidate hash. A later
  application change requires a new reviewed/sealed candidate.

This is a reviewed, source-matching candidate, **not the older deployed Release 82
artifact**. Its build platform is macOS. Exact execution on Ubuntu remains pending;
do not relabel historical certificates or claim Linux acceptance from these tests.
No schema or migration command belongs to installation/deployment.

Products create uses `products.add`; PATCH/bulk use `products.edit` with parent
view permission. Auth calls verify the token, active administrator and permissions
before dispatching a command. SQL independently authorizes the actor and preserves
revisions, receipts and atomicity. Image uploads retain section permissions, file
validation, bounded multipart input and exclusive durable creation. Existing
private Storage authorization is not replaced by public URLs.

Caddy forwards administrative GET/POST/PATCH and their authorization headers to
Nuxt. It does not invent an owner exception, token or database permission. Customer
and provider activation remain separate from administrator editing. No worker
secret, provider key or scheduler is introduced by the new runtime environment.

The original unresolved owner bulk command remains **UNVERIFIED**. Preserve its
browser tab/session storage. Do not replay, clear, replace or infer its outcome
from health checks. The artifact retains GET-only recovery after known denials.

## Prepared automation and actual tests

Scripts are under `scripts/clean-reinstall/`. `package.py` creates an offline kit;
`install.py` checks fresh Ubuntu, machine-id, platform and pinned input hashes
before installing accounts/binaries/units/firewall. It rejects old Nginx/CloudPanel,
existing application paths and repeated installs. It starts neither service.

`prepare-recovery.py` authenticates old archives, extracts only needed inputs,
rejects differing filename collisions and emits encrypted env/media packages.
`restore-media.py` accepts only exact manifest members, rejects private paths,
links and traversal, and never overwrites an existing upload tree.
`deploy.py` verifies the sealed archive and environment/media hashes, installs an
exclusive immutable release, switches the pointer once and starts the services.
Its bounded read-only readiness polling precedes public Caddy startup. Failures
stop and retain evidence; there is no automatic retry, resume, rollback or cleanup.

Both services enable startup after reboot and bounded `Restart=on-failure`.
This deliberately replaces the older launch-specific `Restart=no`; startup has
no workers or automatic command replay. Only shared uploads and Caddy certificate
storage are writable through the respective service filesystem restrictions.

| Check completed here | Result |
| --- | --- |
| Original encrypted components and nine restore receipts | PASS, all exact hashes/authentication |
| New environment/media envelopes | PASS; exact original keys and target bindings verified privately |
| Actual Caddy 2.11.7 + exact reviewed Nuxt, Node 22.23.1 | **8,185 HTTP checks PASS**, including all 2,607 media hashes, 5,504 redirects, held URLs, EN/AR, missing-token APIs, private paths and dormant flows |
| Real application authorization behind Caddy, synthetic Auth | **15 PASS**: authorized malformed create/PATCH/bulk reach validation (400), viewer/disabled/customer denied (403), invalid token denied (401); no backend write |
| Archive safety and Caddy configuration portability | PASS: traversal/link/private-member/hash-corruption/overwrite checks and real Caddy across two independent business domains; administrator methods/headers preserved |
| Existing Products save/bulk/recovery tests | **74 PASS, four native cases skipped**, zero failures/cancellations |
| Production read-only recovery gates | PASS: 560 products, 82 migrations, one active owner/Auth match, six private buckets/zero objects, 2,505 media-path records, five payments false, Auth `disable_signup=true` |
| Ubuntu installation/systemd parser/ownership/firewall/reboot | **UNVERIFIED; required before GO** |

Local HTTP fixtures deny non-loopback application fetches. Auth and Supabase data
are synthetic; these tests do not establish hosted login or owner write acceptance.
Initial local fixture failures (link-header normalization and Fetch Host handling)
were corrected and retained. One read-only collector referenced a nonexistent
frontend-derived setting; it aborted with SQLSTATE 42703, without mutation. The
corrected query and public Auth settings GET pass. No schema repair was attempted.

Pinned vendor archives were downloaded from official Node/Caddy releases and
verified against their release hashes. `clean-reinstall.json` records those pins.
See [Caddy releases](https://github.com/caddyserver/caddy/releases/tag/v2.11.7) and
[Node checksums](https://nodejs.org/dist/v22.23.1/SHASUMS256.txt).

## Executable sequence, after the missing gates pass

The following are future operator commands, **not current execution authority**.
Kit: `../clean-reinstall-plan-20261020/kit-final-v2/`; its independent hash receipt is
`KIT-SEAL.json`. The sealed `SHA256.json` hash is
`cde6d5123c10c19bd03fccb86eb14d58e343b3f455202eecba8e52854d5e055a`.
Verify that receipt before trusting the kit's `SHA256.json`.

1. Complete the disposable Linux rehearsal below. Export both Linux PASS receipts.
2. Verify owner access to Hostinger console/reinstall and root recovery, DNS account
   and Supabase management account. Confirm owner password recovery and MFA access.
   Confirm the verified iMac backup/key paths remain available during maintenance.
   A second device/key copy has not been verified; current custody is one iMac.
   Do not place keys inside the deployment kit.
3. Agree the maintenance window and explicitly approve reinstalling this existing
   VPS only. Freeze all editors/uploaders/WordPress writers. Refresh changed file,
   WordPress and Supabase backups read-only; authenticate and restore-check deltas.
   Stop for any new Storage object/private-file class, unexpected data drift or
   missing media. Record the final watermark; today's snapshot is not a future
   zero-data-loss guarantee. Repackage/reseal changed recovery inputs.
4. In Hostinger choose **plain Ubuntu 24.04**, same existing VPS/location. Verify
   backups first: [Hostinger documents that reinstall erases data and snapshots](https://www.hostinger.com/support/4965922-how-to-change-the-operating-system-of-your-vps-at-hostinger/).
   The old protected-config export is not a prerequisite for this replacement.
5. Verify the NEW SSH host fingerprint through the provider console. Use a separate
   strict known-hosts file; do not disable checking or overwrite the old record.
   Confirm existing public IP, SSH/22 and provider firewall/console recovery.
6. Transfer the verified public kit to `/root/reinstall-kit` over that pinned SSH
   session. On the **fresh** VPS, run:

   ```sh
   python3 /root/reinstall-kit/install.py /root/reinstall-kit \
     --fresh-machine-id "$(cat /etc/machine-id)"
   ```

7. From the iMac, authenticate/decrypt `recovery-inputs/media.tar.gz.enc` with
   `docs/operations/backup-envelope.mjs` and pipe plaintext directly through the
   pinned SSH channel to:

   ```sh
   python3 /root/reinstall-kit/restore-media.py /root/reinstall-kit
   ```

   The key stays on the iMac. Do not restore a home archive wholesale.
8. Through the same pinned channel, stream authenticated `runtime.env.enc` to:

   ```sh
   python3 /root/reinstall-kit/restore-env.py /root/reinstall-kit \
     --expected-env-sha256 SHA256_FROM_RECOVERY_INPUTS_RUNTIME_ENV_RECEIPT
   ```

   This checks the environment hash, exact allowed names, site/backend binding,
   loopback/durable paths and disabled live flags before creating the exclusive
   root-owned `/etc/storefront/runtime.env`, mode 0600. It writes the non-secret
   recovery hash receipt automatically. Preserve both application encryption keys
   exactly; never source the file as shell code. Confirm the **production** kit.
9. Start the verified application and proxy once:

   ```sh
   python3 /root/reinstall-kit/deploy.py /root/reinstall-kit --activate-new-host
   python3 /root/reinstall-kit/health.py /root/reinstall-kit \
     --origin https://elcomputer.net
   ```

   Caddy obtains fresh apex/www certificates. Confirm HTTP canonical redirects,
   valid trusted TLS on both hosts, port 3000 unavailable externally, all required
   health results and service enablement. Test an approved reboot and repeat checks.
10. Owner performs the short acceptance checklist below. Keep commerce, providers,
    customers and auxiliary domains offline. Acceptance records precede maintenance
    closure. No pending bulk command is replayed by an operator or health script.

The installation/deployment scripts do not execute `psql`, schema installers,
WordPress imports, Auth resets, provider schedulers or the old deploy scripts.
Do not restore Supabase merely because the VPS was erased: that hosted project
survives intact. SQL restoration is disaster recovery requiring separate approval.

## Disposable Linux rehearsal

No local Linux runtime is available here. Installing QEMU through Homebrew stopped
because `/usr/local/share/man/man8` is not writable; no elevation, ownership change
or permission workaround was attempted. macOS checks are not Ubuntu proof.
Installation requires Ubuntu's Python 3.12+. A separate vendor extraction probe
on local Python 3.9 stopped at its unsupported `tarfile` filter API; it did not
execute Linux binaries. That target-specific extraction remains a rehearsal gate.

Provide a **local disposable Ubuntu 24.04 x86_64 VM**, not another VPS. Transfer
only the public kit and public media stream. Never give the VM production env,
database credentials, Auth tokens or customer backups. Copy the kit to `/root/kit`.
Stream authenticated public media from the iMac through the VM's pinned SSH to:

```sh
bash /root/kit/rehearse-linux.sh --disposable-local-lab /root/kit
```

The script rejects the existing VPS IP and old installation, rebinds to an invalid
example domain/loopback HTTP, installs on fresh Ubuntu, restores the media, starts
a synthetic local backend through systemd and runs the exact candidate/health
checks. External application fetches are blocked. It tests app-user filesystem
hard links and image delivery across a service restart. Preserve
`/var/lib/clean-storefront-install/LINUX-FIRST-PASS.json`. Reboot **only that VM**,
then run the printed `lab.py ... --after-reboot` command and export
`LINUX-REBOOT-PASS.json`. Absence/failure of either receipt blocks destructive GO.

## Recovery after erasure

There is no verified provider snapshot rollback. After erasure the old machine
cannot be recovered by switching an old symlink. Keep all original encrypted
archives, source bundles, keys and reports outside the VPS throughout maintenance.

On failure, stop, retain the partial release, intent marker and private journal
evidence, and keep public maintenance closed. Do not repeatedly run installation
or deployment. Repair from the verified kit after review, or reinstall the **same**
VPS again and restore media/env from the external copies. Do not touch Supabase.
Fresh TLS and DNS/IP failures require resolving the corresponding dependency.
Do not compensate by restoring CloudPanel or exposing private files.

The kit includes `maintenance.Caddyfile`, which serves only 503 and Retry-After
for the main hosts. After separate recovery authorization, validate it, preserve
the full routing file, install that maintenance configuration and restart Caddy
once. This is an explicit operator recovery action, never an automatic rollback.

After a later successful single-site deployment has its own verified retained
release, `deploy.py KIT --rollback-release VERIFIED_ID` provides an explicit
application pointer rollback. It rechecks retained file hashes, env/media and
restarts once. It does not undo database writes, uploaded images, Auth changes or
external actions. The first new installation has no earlier accepted release.

## Owner manual acceptance, after separately approved deployment

- Sign in to Dashboard using the existing owner account.
- Create an owner-authored Draft; edit and save its sections.
- Publish that product, verify it, then return it to Draft.
- Upload an owner-chosen valid image to the VPS and save it.
- Open the same image URL after an approved service restart/reboot.
- Check EN/AR, RTL and the existing Light/Dark/System layouts.
- Confirm missing/invalid tokens and unauthorized staff cannot write APIs.
- Keep checkout/signup/providers closed; preserve the unresolved original batch.

These are intentional future owner writes. Use fresh acceptance commands and an
owner-approved product; do not reuse the unresolved batch or invent store content.

## Destructive decision and next action

**BLOCKED.** Recovery data/env/source/media are verified. Critical open gates are
the Ubuntu/systemd/reboot rehearsal and owner control-panel recovery confirmation.
A fresh final backup watermark is required at
the actual maintenance boundary. New trusted certificates must succeed before
reopening; current DNS is compatible, not a certificate issuance guarantee.

Estimated outage: **90–180 minutes**, after rehearsals and approvals; reserve
**four hours**. This is an engineering estimate, not a measured guarantee.
One VPS is offline from erasure through restore, TLS and acceptance. Provider,
network or certificate failures can extend downtime.

**ONE next owner action:** provide a disposable local Ubuntu 24.04 x86_64 VM for
the prepared rehearsal, leaving the existing VPS unchanged.
