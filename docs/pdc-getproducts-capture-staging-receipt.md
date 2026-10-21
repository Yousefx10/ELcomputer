# PDC bounded capture — approved helper staging, 2026-10-21

**STAGING PASS. Owner attempt consumed; encrypted archive verification PASS.**

The subsequent owner GET returned HTTP200 / RESPONSE_SCHEMA_REJECTED.
[Analysis and complete Codex 1 handoff](pdc-getproducts-capture-analysis.md) are complete.
Never rerun pre/once. The original staging evidence below remains unchanged.

The owner approved the [final sealed capture](pdc-getproducts-capture-preparation.md)
and reserved both console commands for personal execution. Staging completed at
13:42:42 UTC. Neither `pre` nor `once` was executed by the agent.
The previous failed GetProducts attempt remains consumed and untouched.

## Approved artifacts and independent staging evidence

- Final plan only: protected local `plan-reviewed-final.json`.
- Approval seal:
  `a453c1c120966eba492ebd0e394cae56f4562d744ca0d0271644e446a79f899a`.
- Helper SHA256:
  `f3b098765c075a279ed39001293ee518587cefecea37b83623fc9518dcfacb8b`.
- All final plan artifact hashes, bundled source/dependency hashes and PDF pins
  matched. The approved eighty local safety cases remain preparation evidence;
  this staging did not execute the diagnostic on native production Linux.
- Three separate pinned-SSH sessions passed absent-target preflight, exclusive
  no-follow upload and independent full-byte/hash/ownership/mode readback.
- `/root/pdc-capture` was absent before upload. Its verified contents are only
  `run.py`, root:root0600, in a root:root0700 directory. No checkpoint, consumed
  marker, result or private evidence key was staged.
- Machine/release binding, accepted root600 runtime-file hash and sealed app-unit
  hashes matched. Application and Caddy remained active with unchanged PIDs and
  zero automatic restarts across staging. Release remains `d2d7a8029b473e4a`;
  schema87 remains the accepted baseline, without a new SQL observation.
- No provider request, service operation, deployment, migration, configuration,
  Dashboard, Auth, inventory, media or other production-data write occurred.
  Only the approved helper directory/file were created on the VPS.

Private staging evidence is outside Git, directory0700/files0600:

`/Users/imac/Documents/ELcomputer/pdc-approved-capture-staging-20261021/`

`STAGING-RECEIPT.json` SHA256:
`a82ce8d6c987337ec48a38fbf0f6178d554e67adf94c35749bf43300a2bc85b4`.

The diagnostic private key remains only in the protected local preparation
directory. No provider credential was decrypted or displayed during staging.

## Recorded owner action — consumed

**Already executed. Do not run these commands again.** The owner used these
separate Hostinger root-console commands after pausing Shipping settings edits.

```sh
python3 -I -S -B /root/pdc-capture/run.py pre
```

Expected: `PDC_CAPTURE_PREFLIGHT PASS`. This makes no PDC request and verifies
the saved/running disabled gates immediately before execution.
Only after that PASS, within fifteen minutes:

```sh
python3 -I -S -B /root/pdc-capture/run.py once --approved
```

Return only the fixed status/classification/PASS-BLOCKED lines. Stop on any
BLOCKED, interruption, missing output or uncertainty. Never repeat either command,
use Test/Sync or proceed to GetCities. A captured500 may report successful evidence
capture while GetProducts itself remains BLOCKED.

The agent subsequently inspected fixed receipts and independently archived and
authenticated the encrypted result without another provider call. The exact schema
failure remains UNKNOWN and connection remains BLOCKED. Archive verification passed;
the helper remains preserved pending review. No retirement was performed.

All payment, shipping, signup and checkout gates remain required off. No shipments,
labels, webhooks or other transactions are authorized. Paymob restart acceptance
stays closed. After diagnosis, prioritize controlled provider acceptance and the
required WordPress identity/old-login/private-profile/address/historical-order
migration. Preserve Auth UUIDs, avoid duplicates and imported commerce effects.
