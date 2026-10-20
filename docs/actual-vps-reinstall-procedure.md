# Actual single-VPS reinstall: owner procedure

**20 October health follow-up:** the owner reports restoration and activation
completed. Run the corrected health command in section 7 once. Earlier install
steps are historical procedure; do not repeat them for the stalled check.

**Readiness: GO, with the owner's explicit waiver of the Ubuntu VM rehearsal.**
The first Linux execution will happen on the ONE existing VPS. No VM is required.
This is readiness for a later approved execution; nothing is erased or deployed
in this preparation task. Stop before Hostinger's destructive **Change OS** action.

Target: **srv1259611 / VPS 1259611 / 168.231.104.25**. Restore ELcomputer at
`https://elcomputer.net`, with www redirecting to the apex. Keep all auxiliary
domains offline. Use **Plain OS → Ubuntu 24.04 LTS, x86_64**.

Do not use the same-template **Reinstall** button: it reinstalls the previous
OS/panel combination. Use the Plain OS selection to replace CloudPanel.
[Hostinger's current OS procedure](https://www.hostinger.com/support/4965922-how-to-change-the-operating-system-of-your-vps-at-hostinger/)
distinguishes those actions and confirms that erasure removes VPS data/snapshots.
No provider backup or snapshot is credited as our recovery copy.

## What is verified

Evidence is outside the VPS and Git:
`/Users/imac/Documents/ELcomputer/actual-vps-reinstall-preparation-20261020/`.
The encryption key remains outside that directory, under
`/Users/imac/Documents/ELcomputer/production-backup-credentials/`.

- Owner explicitly confirmed current hPanel OS selection **and** Browser Terminal/
  recovery access. The existing Chrome tab identifies VPS1259611. Chrome blocks
  scripted DOM access; its browser security setting was preserved. Panel access
  confirmation is owner-attested, not a claim of automated button inspection.
- Independent pinned SSH confirms the actual server is running: uptime over
  61 hours, main service active, PID12065, zero service restarts. The earlier
  incorrect **Stopped** display does not establish shutdown. No power action ran.
- All 20 original encrypted components / **31,813,290,811 bytes** authenticate and
  retain their exact hashes. Nine original restoration receipts also hash-match.
- Fresh independent hashes cover **101,234 main-home files, 17,632 older Nuxt-home
  files and 203,012 archive-home files**, excluding active logs as before. There
  are **zero changed/deleted entries or read errors** against the preserved homes.
- All **2,607 media files / 406,760,308 bytes** match their fresh VPS paths and
  hashes: 2,505 original product images plus 102 other uploads (86 products,
  16 settings). The recovered original runtime environment still matches live.
- A fresh consistent read-only Supabase backup restores **all173 fingerprints,
  13 security metadata categories, 82 migration identities and60 effective
  permission checks** in an isolated, socket-only, network-denied database.
  All **560 original product IDs** remain; no additional products or missing IDs.
  One Auth user/identity and the owner's password are preserved. Offline password
  verification passes. New Auth session/refresh-token changes were captured.
- Fresh WordPress exports restore all **466/465 tables** and all **518 user IDs,
  email/password-hash identities each**, including the newer live order history.
  No WordPress application or import was run. Original archives/mappings remain.
- Thirteen deployment/account files, including three SSH private keys and existing
  Supabase/owner/CA/connection inputs, were independently restored and hash-matched
  from a new encrypted archive. Neither private keys nor secret values enter Git,
  public kit files, reports or the VPS transfer kit.
- Exact accepted **1,634 legacy paths**, 559 product-query IDs and held mappings
  remain in reviewed deployment data. The fresh kit uses that same projection.
- The current candidate contains all **597 application inputs** from the latest
  checkout, including Products save/bulk recovery and Procurement fixes. Its
  reviewed source is `3d5fe61c1109190c2ac3df12fb858987bc103aa5`, archive SHA-256
  `7bfe6316a1f544d84b37366f447cdfdd7b11bd11d3473df632930c5ad6618846`.
  This is not the older live Release82 application artifact. No rebuild or npm
  dependency resolution is needed on the VPS.

Receipts: `BACKUP-REVERIFICATION.json`, three `*-REFRESH.json`,
`MEDIA-ENV-REFRESH.json`, `database-current/DATABASE-RESULT.json`,
`ISOLATED-DATABASE-RESTORE-v3.json`, `ISOLATED-WORDPRESS-RESTORE.json`,
`DEPLOYMENT-CREDENTIALS.json`, `HOSTINGER-ACCESS.json`, `VPS-LIVENESS.json`,
`KIT-SEAL.json` and final `SOURCE-CUSTODY-FINAL.json`.

## Package and accepted first-execution risks

The public `operator-kit/` contains the exact Node22.23.1 and Caddy2.11.7 Linux
x86_64 vendor archives, sealed Nuxt output/dependencies, Caddy routing, units,
media hashes and restore/check scripts. Both vendor hashes match their official
release pins. No production npm install, Nuxt build, schema installer, SQL client,
WordPress importer, Auth bootstrap or worker scheduler is part of this package.

Linux Node's ELF architecture and actual dynamic library requirements were read
without executing the binary. Required libraries are the normal glibc loader,
libc, libm, libdl, libpthread, libstdc++ and libgcc_s. Its highest referenced glibc
version is2.28. Ubuntu24.04 supplies a suitable base; APT explicitly installs
`ca-certificates curl xz-utils ufw libstdc++6 libgcc-s1 openssl` and dependencies.
Initial console bootstrap installs `python3 openssh-server` if absent.
Use Ubuntu's Python3.12+. The pinned vendor Node extraction and executable modes
now pass locally, including a private root umask.
[Node's pinned platform requirements](https://github.com/nodejs/node/blob/v22.23.1/BUILDING.md)
identify Linux x64/glibc as supported. This is dependency evidence, not Linux
execution acceptance.

The installer and sealed-release extraction now set directory modes explicitly.
This corrects a prepared-package defect where root's umask077 could make app or
Caddy directories unreadable to their service users. Six focused automation
tests pass, including restrictive-umask service readability, archive safety,
independent host fingerprint matching and real Caddy portability.

Accepted risks for the actual VPS:

1. **Untested native startup:** Ubuntu systemd namespace hardening, Python3.12,
   UFW behavior, filesystem hard links, actual Linux Nuxt/Caddy execution and reboot
   persistence will be tested there for the first time. Owner waived a VM gate.
2. **External dependencies:** signed Ubuntu APT mirrors, DNS, outbound internet and
   ACME issuance must work. New certificates are issued; old TLS keys are discarded.
3. **Single-host recovery:** erasure has no verified instant snapshot rollback.
   Recovery may require rebuilding this same VPS again from the off-VPS copies.
4. **Manual application acceptance:** synthetic/local Auth and HTTP checks do not
   establish real hosted owner CRUD or permissions. Complete the checklist below.
5. **Recovery custody:** backups/key/client credentials are available on this iMac.
   Keep it powered, connected and available throughout the maintenance window.

These are recorded risks, not a renewed VM requirement. Reserve **four hours**;
expected outage remains **90–180 minutes**, potentially longer after startup,
network or certificate failures. Supabase stays intact throughout.

## 1. Before the destructive boundary

On the iMac, in Terminal:

```sh
PREP=/Users/imac/Documents/ELcomputer/actual-vps-reinstall-preparation-20261020
python3 "$PREP/owner-restore.py" "$PREP/OWNER-BINDING.json" verify
cat "$PREP/KIT-SEAL.json"
```

Expected: `OFFLINE INPUTS PASS`. The binding pins the kit, media, runtime env,
existing VPS IP, SSH client identity and **previous machine ID**. The key stays on
the iMac. `SOURCE-CUSTODY-FINAL.json` preserves this task's final unpushed source.
Do not push Git or select an older application package as a shortcut.

Independent reviewed SHA-256 anchors:

| File | SHA-256 |
| --- | --- |
| `operator-kit/SHA256.json` | `c279385caac547b180efd71db98ec02179cc21bffb78d51a2eafe5eec051e533` |
| `OWNER-BINDING.json` | `a6bd34ddd6b3e4910dbba66ada48646ef7ee31a284c7c0c07fdad0dc7887eba0` |
| `owner-restore.py` | `a3c7a8441820112d05942b96d864810df55e8066721edb7142fd7ec60137d7d3` |

Keep Dashboard uploads/edits and WordPress administration idle until restoration
finishes. The current media/configuration watermark is in the refresh receipts.
If any source upload, configuration, credential or WordPress business record
changes after that watermark, capture and verify the delta before erasure.
The hosted Supabase project itself will not be erased by the VPS operation.

**Exact first Hostinger panel action:** open **VPS → Manage srv1259611
(168.231.104.25) → OS & Panel → Operating System → Plain OS**. Select
**Ubuntu24.04 LTS, x86_64**. Confirm target/version. **STOP before Change OS.**

That is the stopping point for this preparation task. Do not click Stop, Restart,
Reinstall, Change OS or another confirmation action based on the stale indicator.
The following sections apply only after separately approved destructive execution.

## 2. Approved erasure and secure initial access

After explicit execution approval, click **Change OS** for the selected Plain
Ubuntu24.04 template and complete Hostinger's confirmation. Keep the same VPS,
region and existing IP. If that exact OS or IP cannot be retained, stop and review
the change; do not choose another image or change DNS automatically.

When Hostinger reports completion, open its **Browser Terminal**. Confirm root
access and run these fresh-server commands there:

```sh
id -u
cat /etc/os-release
uname -m
apt-get update
apt-get install -y python3 openssh-server ca-certificates
python3 --version
```

Expected: UID0, Ubuntu24.04, x86_64, Python3.12+. Keep console access open.
The new root password stays in the owner's password manager, never chat/Git/env.

On the iMac, display the prepared **public-key-only** initial access script:

```sh
cat "$PREP/INITIAL-ACCESS.sh"
```

Paste its contents into the fresh Browser Terminal. It guards against the old
installation, installs only the existing client **public** key under root's
private `.ssh`, and prints the NEW server ED25519 fingerprint. No client private
key or backup encryption key is sent to the VPS.

Back on the iMac, replace the following single value with that console fingerprint:

```sh
python3 "$PREP/owner-restore.py" "$PREP/OWNER-BINDING.json" pin \
  --console-fingerprint 'SHA256:NEW_FINGERPRINT_FROM_BROWSER_TERMINAL'
```

The helper accepts only an exact console/scanned-key match, rejects the previous
host fingerprint and writes an exclusive separate known-hosts file. It does not
disable SSH checking or edit the old known-hosts records. The new fingerprint is
necessarily obtained after reinstall; it must never be guessed in advance.

## 3. Transfer and verify the public kit

```sh
python3 "$PREP/owner-restore.py" "$PREP/OWNER-BINDING.json" transfer
```

Every target operation first verifies root/Ubuntu24.04/x86_64 and rejects the
previous machine ID. Transfer creates exclusive `/root/reinstall-kit`, sends only
public kit files and independently checks the reviewed manifest hash and every
member before execution. A failed or repeated exclusive step stops for review.

Once this key-authenticated SSH operation succeeds, disable password logins from
the still-open **fresh Browser Terminal**:

```sh
cat > /etc/ssh/sshd_config.d/00-storefront-key-only.conf <<'SSH'
PubkeyAuthentication yes
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
SSH
/usr/sbin/sshd -t
/usr/sbin/sshd -T | awk '/^(pubkeyauthentication|passwordauthentication|kbdinteractiveauthentication|permitrootlogin) /'
```

Expected: public key `yes`, password and keyboard-interactive `no`, root key-only
(`without-password`/`prohibit-password`). If effective values differ, keep the
console open and resolve them before reloading. On success:

```sh
systemctl reload ssh
```

The next operator step proves key access again. Do not close recovery access until
it succeeds. No SSH hardening command belongs on the old installation in this task.

## 4. Install runtime, Caddy and persistence units

```sh
python3 "$PREP/owner-restore.py" "$PREP/OWNER-BINDING.json" install
```

The installer rejects an existing installation, verifies all pinned input bytes,
installs APT libraries, unprivileged app/Caddy users, Node/Caddy and reviewed units,
validates Caddy/unit syntax, and configures UFW for SSH22 and TCP80/443. Node3000
binds loopback. Services remain stopped. Do not install CloudPanel, Nginx, PHP,
MySQL or PM2. Provider firewall must also permit22/80/443.

## 5. Restore media and existing Supabase configuration

```sh
python3 "$PREP/owner-restore.py" "$PREP/OWNER-BINDING.json" media
python3 "$PREP/owner-restore.py" "$PREP/OWNER-BINDING.json" environment
```

The helper authenticates each envelope on the iMac, then pipes plaintext through
the newly pinned SSH session. **2,607 public images** are restored with exact
paths/hashes to `/srv/storefront/shared/uploads`, owned by the application user.
Existing trees, symlinks, traversal, private paths and mismatched bytes are rejected.
Neither backup key nor whole home archive is uploaded.

Environment intake verifies its hash, exact allowed names, target URL, loopback
port, durable uploads root and disabled provider flags. It creates root-owned
`/etc/storefront/runtime.env`0600 and a non-secret recovery receipt. Both original
application encryption keys and the existing Supabase project/key values remain
exact. Do not print/source the env file or generate replacement encryption keys.

Existing Supabase project **amighioggheqddyypgcl** remains hosted and unchanged:
all560 original products, Auth UUIDs, RLS, schema82, relationships, six private
buckets and2,505 media-path metadata rows persist. No schema setup, migration,
WordPress import, Auth initialization or database restore is performed.

## 6. Deploy Nuxt and obtain fresh HTTPS

```sh
python3 "$PREP/owner-restore.py" "$PREP/OWNER-BINDING.json" deploy
```

The exact sealed Products candidate is checked/extracted into an exclusive
immutable release, the pointer switches once, and Nuxt starts. Bounded read-only
readiness checks precede Caddy startup. Caddy requests fresh apex/www certificates;
normal certificate renewal and systemd reboot startup use `/var/lib/caddy`.

Caddy forwards administrator methods to existing Auth/RBAC/RLS. It preserves the
1,634 legacy URL mappings and query-ID/held behavior, uses Nuxt's scoped image
handler and keeps customer commerce/workers/providers/reset routes closed.
All auxiliary domains remain without site blocks/certificates. Do not change DNS.

## 7. Health, persistence and owner acceptance

For the stalled-check correction, use the current repository helper below.
The sealed preparation helper and VPS kit remain unchanged. This helper verifies
the original kit, then streams the corrected checker over pinned SSH.

```sh
python3 -u /Users/imac/Documents/ELcomputer/ELcomputer/scripts/clean-reinstall/owner-restore.py "$PREP/OWNER-BINDING.json" health
```

Run this once for the interrupted health check. It does not install, restart or
redeploy anything. Target identity and sealed-kit checks each have a 30-second
SSH deadline. HTTP verification has a 900-second total budget, with a 30-second
absolute deadline per request, including DNS, TLS and body delivery. The health
SSH child is capped at 915 seconds; SSH keepalives detect a dead connection.
Progress is flushed at stage boundaries and every 100 checks or five seconds
between requests. A stalled request fails within its deadline; there are no retries.

Each attempt creates a private, unique local receipt under
`$PREP/health-results/`, updating its phase and progress. A final PASS requires all
expected counts, the checker's final PASS and SSH exit zero. Timeout, interruption,
missing output or nonzero exit produce FAIL; the receipt preserves any remote
result separately. A buffered PASS alone never establishes success.

The original command had no SSH execution deadline, no configured keepalive,
no intermediate output and no saved result. A remote Python exit does not itself
guarantee that the SSH transport has exited or closed its channels. No old child
remains to identify the original stall's exact phase or transport cause. Bounded
read-only SSH probes now exit normally; no full production health run was repeated
to diagnose it. The corrected runner avoids waiting for pipe EOF, closes unused
stdin, and terminates its own child process group on timeout or interruption.

Expected: trusted HTTPS and PASS for EN/AR pages, **2,607 image hashes**, all
**5,504 main/www legacy redirect cases**, held503s, private-file404s, disabled
commerce403s and missing-token admin401s. These POST/PATCH probes have no token
and must stop before any business write. A200 placeholder image is not sufficient;
the media SHA/length checks must match.

In the fresh Browser Terminal, verify:

```sh
systemctl is-active storefront caddy
systemctl is-enabled storefront caddy
ss -lntp
ufw status
```

Require Node only on127.0.0.1:3000; external22/80/443 only. Test one approved reboot
of this same VPS during the maintenance window, then repeat the checks and full
health command. This actual-VPS test replaces the waived VM rehearsal.

Owner checklist, using only an owner-authored acceptance product:

- Log in with the existing Dashboard owner account; verify EN/AR/RTL/themes.
- Create a Draft, read it back, edit required details and save each section.
- Reload and confirm saved values, gallery and specifications.
- Publish that new product, verify storefront delivery, then return it to Draft.
- Upload a valid owner-chosen image to the VPS; save and copy its URL/hash.
- Verify that exact image after the approved service restart/reboot.
- Delete only the newly created acceptance product if it has no history; confirm
  disappearance. Preserve referenced/history-protected records and all560 originals.
- Check unauthorized/disabled/view-only users cannot create, edit, bulk-update or
  upload outside their permissions. Never grant extra permissions to pass a check.
- Keep signup, checkout, all five payment methods and provider workers disabled.
  Preserve the original unresolved owner bulk command/tab; do not retry or clear it.

Owner acceptance writes occur only after the separately approved deployment.
Do not invent store content or delete an original product as a CRUD test.

## Practical failure recovery

- **SSH/pinning failure:** retain old/new key evidence. Use the confirmed Hostinger
  Browser Terminal, inspect the actual fresh key/account/IP, and fix access there.
  Never use `StrictHostKeyChecking=no`, accept a guessed key or click power buttons
  because of the earlier Stopped display.
- **APT/install failure:** preserve `/var/lib/clean-storefront-install` and private
  output. Use Browser Terminal to check DNS/network/time/disk and correct the exact
  cause. The exclusive installer is not an automatic resume script. Review the
  partial state before repair or another approved reinstall of this same VPS.
- **Media/env failure:** preserve partial files and the source envelopes. Recheck
  key availability, hashes, disk and ownership. Never overwrite a partial tree or
  replace original keys automatically. Recreate a clean destination only after
  reviewing what was restored; do not delete backups or the hosted database.
- **Nuxt/systemd failure:** save a private0600 journal, inspect unit/paths/Node and
  mode/ownership first. Compare the kit manifest. No npm force install, migration,
  password reset or old Release82 substitution is authorized as a repair shortcut.
- **TLS failure:** verify unchanged A/CNAME/AAAA, provider/UFW80/443, clock and
  outbound ACME/DNS access. Resolve the cause before another attempt; do not reset
  Caddy certificate storage repeatedly or expose an auxiliary site.
- **Public acceptance failure:** preserve the routing file. The kit includes a
  reviewed `maintenance.Caddyfile` serving503/Retry-After for the main hosts. After
  choosing that recovery action, validate it, preserve the full Caddyfile, install
  maintenance configuration and restart Caddy once. Keep the app and data intact.
- **Rebuild required:** reinstall this ONE VPS again only with explicit approval;
  repeat the pinned-host, install, media/env and exact artifact steps from external
  copies. There is no instant pre-erasure machine rollback. Supabase stays intact.
  WordPress and its customer/password/order archives remain offline, unexecuted.

Never paste env files, credentials, database rows or raw private journals into a
report/chat. Record phase, sanitized error and hash/receipt instead. Failure does
not authorize an automatic retry, cleanup, rollback or another destructive reset.

**Current stopping point:** restoration and activation are owner-reported complete.
One corrected health run is pending. This health correction does not perform a
reinstall, restart, redeploy, reboot or manual owner acceptance.
