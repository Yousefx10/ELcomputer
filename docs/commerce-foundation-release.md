# Commerce foundation release — 2026-10-20

**GO for one owner approval. Prepared, not deployed.**

This release combines COD checkout, configured delivery, private packing videos
and normal COD cash collection. Public purchasing and all providers stay off.
Use the existing Caddy → loopback Nuxt → systemd deployment. No installer,
OS replacement, routing change, certificate regeneration or architecture change.

## Frozen candidate

| Binding | Reviewed value |
| --- | --- |
| Application source | `862b1e3c4fd842a4a42dc8b86712bbe249e13883` |
| Included features | `31b295c`, `1e58bd6`, `862b1e3` |
| New release | `82214df492a57126` |
| Archive SHA-256 | `82214df492a57126182d03e48e643baaf6913f2279db39ec39fde48cab93e8fa` |
| Archive size / inventory | 5,958,807 bytes / 1,269 entries |
| Application inputs | 606 frozen source hashes |
| Approval plan SHA-256 | `779a17d27a8d34e15488173e67eca0cfd7e03e661f21a769c5f303b37d4e7557` |
| Private plan | `/Users/imac/Documents/ELcomputer/commerce-foundation-release-20261020/prepared/plan-approved.json` |

The application archive predates this operational documentation commit. Only
release tools, isolated tests and documentation are added by that commit; the
application input hashes and all migration bytes remain identical. The original
Release82 certificate remains unchanged and is not a certificate for this candidate.

Earlier `plan.json` and `plan-final.json` are superseded. Their commands are invalid.
The approved plan binds the artifact, migration hashes, helpers, credentials-file
hashes, pinned SSH key/known-hosts, TLS CA, machine, service and recovery pointers.
It contains no secret values and stays outside Git.

## Read-only production baseline

| Surface | Observed before approval |
| --- | --- |
| VPS / service | `168.231.104.25`, `/srv/storefront`, `storefront.service`, loopback 3000 |
| Current release | `/srv/storefront/releases/7bfe6316a1f544d8` |
| Current application commit | `3d5fe61c1109190c2ac3df12fb858987bc103aa5` |
| Runtime | Node22.23.1; active Nuxt and Caddy; no restart during preparation |
| Database | Explicit production `amighioggheqddyypgcl`; TLS hostname and CA verified |
| Migration history | Exactly82, matching all historical versions/names/source files |
| Existing records | 561 products; one Auth user; zero customer orders/packing videos |
| Existing files | 2,613 public VPS files; four existing Storage metadata objects |
| Commerce controls | All five payment methods false; built-in ERP; signup disabled |
| Runtime provider controls | Paymob and both shipping-live flags false |
| HTTP | `/` and `/dashboard/login`200; unauthenticated admin-products401; `/login`, `/checkout`, `/api/checkout`403 |

The original 560 imported products, owner-created product, current Auth and every
existing media/Storage record must survive. The four existing Storage metadata objects
are retained; this release creates no Supabase Storage objects.

The ambient Supabase CLI link and legacy pooler pgpass point at staging. The
release never consults them. Existing `npm run deploy` and the saved release skill
describe the retired PM2 target and must not execute this release. The restoration
kit's install/activation commands also do not implement an application update.

## Exact database delta

Apply these three unchanged files, in order, using the explicit production
connection. Do not issue a generic linked migration push.

| Migration | SHA-256 |
| --- | --- |
| `20261020120000_cod_shipping_checkout.sql` (83) | `7f7dce470bd29b25b2aec5b5cbaaefe06c43efb6a7d6c0b8f49a451bb9eaa36b` |
| `20261020160000_private_vps_packing_videos.sql` (84) | `9057b0a8cdf7fbcefa386db51abe2b19341dbf9d1db3e9e1d70d0fb220748c21` |
| `20261020200000_normal_cod_collections.sql` (85) | `691a93c3c8ca9a8cdcf403ce1da6313a223f91570748a2bb2e5512282490ade3` |

83 adds disabled delivery configuration and authoritative fee/stock validation.
84 adds private VPS evidence metadata and service-only packing commands; direct
video writes are revoked. 85 adds immutable collection/reconciliation ledgers,
treasury links, retained command tombstones and financial audit protections.
Existing permissions, order totals, legacy cash and inventory are not backfilled.

The executor applies 83–85 and their migration-history records in one transaction,
removing only each file's outer BEGIN/COMMIT. It takes the existing reset exclusion
lock, SHARE-locks application tables briefly, fingerprints their original columns,
and compares every original row before commit. Auth users/identities and Storage
buckets/objects are compared read-only, without broader managed-schema grants.
New ledgers must be empty; browser grants and service-only routines are verified.
Any source, ownership, grant, row or history mismatch rolls the transaction back.
An ambiguous commit stops execution; it never retries SQL automatically.

## Private video runtime

The release adds only these runtime environment keys:

| Input | Reviewed production value |
| --- | --- |
| `NUXT_PACKING_VIDEOS_DIR` | `/srv/storefront/shared/private/packing-videos` |
| `NUXT_PACKING_VIDEO_PROBE_PATH` | `/opt/commerce-tools/ffprobe-8.0.3-6136812ea6d4/ffprobe` |

All original environment bytes/keys are retained. The private parent and video
directory are new, owned by `storefront`, mode 0700; the application stores 0600
files. The base unit remains unchanged. A single `commerce-packing.conf` drop-in
adds this private directory to `ReadWritePaths`; sandbox protections remain active.
Private videos never enter public images, the release tree or Caddy file serving.

The pinned [official FFmpeg8.0.3 source](https://ffmpeg.org/download.html) was
authenticated locally against release signer
`FCF986EA15E6E293A5644F10B4322F04D67658D8`.
Source SHA-256: `6136812ea6d4e68bdba27e33c2a94382711cdf4f8602ffef056ff792bd6f9818`.
The configuration in `scripts/commerce-release/decoder.json` enables only required
video formats and the file protocol, with networking and autodetection disabled.
The older distro ffmpeg package is not installed.

After approval, install compiler dependencies using the frozen apt simulation:
**0 upgraded, 46 newly installed, 0 removed, 3 not upgraded.** Existing-package
upgrades/removals or any dependency-plan drift stop execution. Package-triggered
service restarts are suppressed. Build the verified source as unprivileged
`nobody`, install the isolated binary and verify its version and synthetic video
decoding. The compiler/configure/make and SSH operations have explicit deadlines.
No package install or Linux decoder build has occurred during preparation.

## One guarded execution, after owner approval

Approval covers a short maintenance window with Dashboard edits paused, fresh
encrypted backup, compiler dependencies, the private directory/environment/drop-in,
these three migrations and **one Nuxt service restart**. Caddy stays running with
the identical configuration. Public sales, signup, providers and real orders stay
disabled. No shipping, financial posting, original inventory mutation or push.

From the owner's existing iMac workspace, the exact action is:

```sh
/Users/imac/Documents/ELcomputer/procurement-postgrest-correction-20261018/tools/node-v22.23.1-darwin-x64/bin/node \
  /Users/imac/Documents/ELcomputer/ELcomputer/scripts/commerce-release/operator.mjs apply \
  /Users/imac/Documents/ELcomputer/commerce-foundation-release-20261020/prepared/plan-approved.json \
  --approved 779a17d27a8d34e15488173e67eca0cfd7e03e661f21a769c5f303b37d4e7557
```

The action checks a clean committed tree, frozen inputs, strict SSH host identity,
live process/config bindings, database82 and disabled controls. An exclusive
execution-intent receipt prevents a second run. The deployment sequence is:

1. Stream a fresh read-only database dump into the existing authenticated encrypted
   envelope, then fully verify it. No plaintext database dump or backup key goes
   to the VPS. Backup failure stops before production changes.
2. Save the live baseline; stage the bound archive through the retained strict
   extractor, preserving old releases and immutable client chunks.
3. Provision the approved decoder/private runtime. Preserve the original 0600
   environment in the private remote evidence directory. Reload systemd metadata
   only; the existing Nuxt process remains running.
4. Run the candidate privately on 3100 with the same service user/sandbox. Verify
   authorization rejection, private file write/fsync/read/remove and decoder
   execution using synthetic evidence only. Stop the candidate before SQL.
5. Apply and verify 83–85 in one transaction. Only then select the new release and
   restart `storefront.service` once.
6. Verify the new process cwd, loopback authorization response, unchanged Caddy
   PID/config, all public media hashes, public disabled-route status, 85 history,
   ledger/RPC ACLs and unchanged customer-order count. Write PASS only afterward.

Each phase prints progress; a heartbeat appears every 15 seconds. HTTP, SSH, build,
database statements and lock waits are bounded. A STOP receipt preserves the phase
and prohibits automatic retry/rollback. No broad historical health script runs.

Private evidence: local `commerce-foundation-release-20261020/prepared/` and remote
`/var/lib/commerce-releases/82214df492a57126/`. Successful execution must produce
`completed.json`; it does not exist yet. Local backup encryption keys remain
in their existing private owner location.

## Recovery and acceptance limits

Retain old release `7bfe6316a1f544d8`, its VERIFIED/output inventory, the original
environment, the unchanged base unit/Caddy configuration, encrypted database backup,
new output, plan and all phase receipts. Never delete these on failure.

Before activation, failure leaves the old release selected; completed SQL may
already be 85. After activation intent, failure may leave the new release selected.
Inspect receipts and current process/symlink/schema before any recovery. A failed
or disconnected apply is **not** permission to rerun it.

Recovery is manual and separately approved. Restoring old output/environment and
removing the added drop-in may recover browse/Dashboard access, subject to schema85
compatibility checks. Old packing code is incompatible with migration84, so hold
packing and checkout during such recovery. Do not reverse migrations, restore an
entire database, erase ledgers or automatically restart repeatedly. Installed
compiler tools and the isolated decoder do not require emergency removal.

## Validation and next work

- 69 focused COD/checkout/private-packing checks PASS, no skips.
- 10 release/migration checks PASS, including populated82→85 with a non-superuser
  migration owner, late failure rollback, preserved old cash and second-run refusal.
- Five remote release guard checks PASS, including failed activation retention.
- The pinned restricted decoder passed all 25 packing tests again; these overlap
  the 69 above and are not 25 additional feature cases.
- Five existing strict extractor checks PASS; one optional Caddy binary check
  skipped because no local `CADDY_BIN` is configured. Caddy is unchanged.
- Clean npm10.9.8 install, Node22.23.1 typecheck, production build and diff check
  PASS. Lockfile unchanged; known duplicate ERP/Tailwind warnings remain.
- Sealed-plan read-only check returned `GO_FOR_OWNER_APPROVAL`, production writes 0.

Evidence uses disposable PostgreSQL, actual files/decoder and fixture Auth/API
transport. The private Linux candidate/sandbox, hosted authenticated Dashboard,
browser camera and end-to-end order acceptance remain pending. Those limits do
not authorize public activation. Linux candidate failure stops before SQL.

After this foundation release, investigate the four owner-reported customer/admin
access errors, then prioritize existing Paymob and PDC integrations. Historical
WordPress identity/order/address migration is a required launch workstream; retain
identity reuse/duplicate prevention and existing Auth. Verified inventory, configured
coverage/fees, confirmed customer access and named fulfillment/treasury operators
remain required business inputs. Keep public checkout off through owner-controlled
acceptance. UI improvements come later.
