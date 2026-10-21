# Owner-only Paymob validation — 2026-10-21

**Owner reports 24 configuration/safety checks PASS; saved inputs not loaded.**

The owner subsequently ran the command and reported only `SAVED_VALUES_LOADED`
BLOCKED. Follow the [controlled restart preparation](paymob-controlled-restart.md).
Restart execution awaits separate owner approval. The preparation record below
describes the earlier read-only validation; it is not a new restart instruction.

The owner reports verified LIVE inputs saved in `/etc/storefront/runtime.env`,
owned by root, mode0600. The agent did not read that file, decrypt recovery
credentials, access production, contact providers or restart anything here.
This prepares a standalone read-only check for the Hostinger root console.

## Exact owner procedure

1. In your **iMac Terminal**, copy the prepared command block:

   ```sh
   pbcopy < "/Users/imac/Documents/ELcomputer/paymob-owner-validation-20261021/OWNER-ROOT-CONSOLE-COMMAND.txt"
   ```

2. Open the existing **Hostinger VPS root console**. Paste the entire block and
   press Enter if needed. It is one `/usr/bin/python3 -I -S -B -` command with a
   quoted here-document. It needs no installation, remote script upload or file edit.
3. Return only its named **PASS/BLOCKED** lines. Never paste runtime file contents,
   credential values or screenshots containing secrets.

The block is available locally at
`/Users/imac/Documents/ELcomputer/paymob-owner-validation-20261021/OWNER-ROOT-CONSOLE-COMMAND.txt`.
It contains operational bindings and one-way fingerprints, not credential values.
The command has not been staged or executed on the VPS by the agent.

## What the command checks

- Root console and exact deployment machine/current release binding.
- Regular, non-symlink runtime file, root ownership and mode0600; no chmod/chown.
- Canonical single-line environment syntax and no duplicate definitions, including
  unrelated variables. The file is parsed as data, never sourced or evaluated.
  Unsupported quoting, escape or multiline syntax blocks rather than being guessed.
- All six Paymob inputs present/nonempty: LIVE Secret/Public, HMAC, card ID and
  both mode variables. Accepted LIVE key formats and matching country prefixes.
- One-way equality with the protected recovered LIVE references already verified
  by the owner, including the LIVE EGP card ID. No credential or ID is displayed.
  A mismatch requires reference review; do not rotate or overwrite current values
  merely to satisfy a historical fingerprint.
- Every other runtime value unchanged from the protected pre-entry baseline.
- Saved and running Paymob initiation/live-request gates remain false; both
  shipping outbound gates remain false too. No provider is activated.
- Existing systemd fragment and the two approved packing/shipping drop-ins match
  their sealed hashes. No extra drop-in, daemon-reload requirement, PassEnvironment
  or UnsetEnvironment override. Effective EnvironmentFiles must require the exact
  root-only runtime path. The service must be active/running under its service user.
- All five stored payment-method flags false, hosted signup/anonymous signup
  disabled and email confirmation retained.
- Public EN/AR signup and checkout, plus `/api/checkout`, remain held403.
- Runtime bytes/metadata, unit hashes, service state and current release remain
  stable across the check. Saved inputs are compared privately with process inputs.

The only subprocess is read-only `systemctl show`, captured internally. Unit and
environment contents, headers, values, lengths, encodings, fingerprints, HTTP
bodies, error messages and traces are never printed. Output is fixed check names
followed by PASS or BLOCKED. No plaintext credential file or Python cache is written.

## Exact read-only network scope

The root command makes only these metadata GETs to the reviewed site/project:

| Destination | Purpose |
| --- | --- |
| Existing Supabase REST `site_settings`, default row, five payment booleans only | Verify every payment method remains off |
| Existing Supabase Auth `/auth/v1/settings` | Verify hosted signup/anonymous signup disabled and email confirmation retained |
| Existing site `/signup`, `/ar/signup` | Check public signup holds |
| Existing site `/checkout`, `/ar/checkout`, `/api/checkout` | Check public checkout holds |

Existing backend credentials are used only in request headers inside owner-run
process memory. Targets are fixed, TLS remains verified, proxies and redirects
are disabled, responses bounded and requests timed out. No retry or POST occurs.
No Paymob/PDC endpoint, payment initiation, signup attempt, order command, callback,
shipment, SQL mutation, release operator, deployment or service operation is called.

On a failed prerequisite, remaining unverified checks report BLOCKED. A failure
does not authorize automatic fixes, changes to permissions or a restart.

## Interpreting the restart check

- `DISABLED_CONFIGURATION_VALID PASS` means all required saved-state/loading,
  access and disablement guards passed at that observation.
- With that result, `SAVED_VALUES_LOADED BLOCKED` means the running process still
  differs from the saved six inputs. A later controlled service restart is needed
  to load them. This is expected after saving without restarting.
- With that result, `SAVED_VALUES_LOADED PASS` means those inputs already match;
  another restart is unnecessary for credential loading.
- If `DISABLED_CONFIGURATION_VALID` is BLOCKED, stop and return the result lines.
  Do not interpret an unperformed loaded-state check as permission to restart.

Systemd reads EnvironmentFile when starting the process. Editing the file does
not update the existing Nuxt process. A file-only edit needs no build, deployment
or daemon-reload. No restart/reload command was included in that read-only check.
The owner's reported loading difference is now handled by the separate
controlled-restart preparation; execution still awaits owner approval.

## Preparation evidence and roadmap

Private directory0700/files0600:
`/Users/imac/Documents/ELcomputer/paymob-owner-validation-20261021/`.
The private binding uses existing non-reversible fingerprints and deployment
metadata; no secret value was decrypted or read during preparation.

Twenty-seven synthetic safety cases passed, including missing/duplicate inputs,
wrong modes/IDs, altered runtime settings, systemd overrides, enabled payment/signup
gates, open public routes, changed snapshots and saved-versus-loaded differences.
These are local fixtures, not execution against Linux production or merchant APIs.

Documentation checks passed: 185 local links, diff whitespace, private-reference
exclusion, evidence hashes/permissions and matching current handoff entries.
Only task-owned documentation changed in Git.

Owner command SHA256:
`2b718a541fdb9358aeac713c05199387ce58ccf43c085124d530255ff60fbfe4`.
`PREPARATION-RECEIPT.json` SHA256:
`36add9806296b1ee5b1a6f275adfe11842d13ae81f9fd1b4f09c820c267e79df`.

Next: owner reviews and approves the prepared controlled restart.
Charging, checkout, signup, shipping automation and callbacks must remain
held. PDC GetProducts HTTP500 investigation remains on the roadmap; its previous
one-run approval is consumed and supplies no retry permission here.

Required next workstream remains WordPress customer identities/old-login,
private details/profiles, billing/shipping addresses and historical orders into
Supabase. Preserve Auth UUIDs, avoid duplicates and prevent historical financial/
commerce effects. Complete that work before unrestricted customer signup.
