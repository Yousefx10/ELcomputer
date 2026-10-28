# Owner-only Merchant API Key entry on the existing VPS

**READY FOR OWNER ENTRY. Key not stored by Codex. Inquiry remains disabled.**
Prepared28October2026 after the owner clarified that the key is accessible in
Paymob Dashboard but has not been saved on the VPS.

Credential reference after entry:

```text
/etc/storefront/paymob-merchant-api-key
```

This uses the existing root-owned `/etc/storefront` directory, mode0700. The new
file will be root:root0600. It is separate from `runtime.env`; there is no existing
runtime setting that automatically loads this file. No application restart,
service/unit edit, provider authentication, inquiry or payment is performed.

## Run on your Mac, in your own Terminal

Do not enter the key in chat or as part of a shell command. The reviewed launcher
opens SSH and asks for the value only after terminal echo is disabled.

```sh
python3 -B /Users/imac/Documents/ELcomputer/paymob-inquiry-recovery-20261028/key-setup/enter-merchant-key-over-ssh.py --enter
```

1. Keep your existing Paymob Dashboard open to the API Key row.
2. Run the command above in your local Terminal, not in this chat.
3. Wait for `Paste Merchant API Key (hidden):`, then paste the API Key and press Enter.
4. At `Paste it again to confirm (hidden):`, paste it again and press Enter.
5. Neither entry displays characters. On success, the program reports only the
   path, ownership/permissions and unchanged-runtime status. It closes SSH.

It refuses Secret/Public-key prefixes, empty/whitespace-containing input,
nonmatching confirmation and any existing destination. It never overwrites a key.
The key is not passed through command arguments, environment variables, shell
history, a deployment archive or a helper file. Only the new private credential
file receives the value. A constant-time private readback verifies stored bytes;
those bytes are not printed or logged.

## Verify metadata only

```sh
python3 -B /Users/imac/Documents/ELcomputer/paymob-inquiry-recovery-20261028/key-setup/enter-merchant-key-over-ssh.py --check
```

Expected after successful entry: file exists/nonempty, uid0/gid0, mode0600,
parent0700, `runtime_unchanged: true`, `merchant_inquiry_enabled: false`,
provider calls0/application restarts0. This check does not read the key contents
or prove Paymob authentication. If entry stops or a file already exists, use this
metadata check and report only its safe status/error code; do not delete or
replace an existing credential blindly.

## Exact SSH transport and reviewed files

The launcher uses the existing pinned SSH identity and known-host file, connects
as root to the existing VPS, and checks its machine identity before entry.
The transport, shown for review, is:

```sh
ssh -tt -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o HostKeyAlgorithms=ssh-ed25519 -o UserKnownHostsFile=/Users/imac/Documents/ELcomputer/actual-vps-reinstall-preparation-20261020/fresh-known-hosts -i /Users/imac/.ssh/elcomputer_wordpress_migration root@168.231.104.25
```

You do not need to run that bare SSH command separately. The launcher adds the
reviewed Python program in memory and attaches the interactive terminal. No
helper script is installed on the VPS. Host verification is never disabled.

Local reviewed files, all outside the application source/Git:

- `../paymob-inquiry-recovery-20261028/key-setup/remote_entry.py`: hidden entry,
  root/machine/runtime checks, exclusive atomic publication and restrictive modes.
- `../paymob-inquiry-recovery-20261028/key-setup/enter-merchant-key-over-ssh.py`:
  pinned SSH launcher; `--enter` requires your interactive Terminal.
- `../paymob-inquiry-recovery-20261028/key-setup/setup-plan.json`: target binding,
  expected unchanged runtime hash and helper hash. Contains no API Key.

Ten focused local checks PASS, including real terminal no-echo/restoration,
wrong input/mismatch, mode/owner, overwrite/symlink/racing-file refusal and safe
error output. An initial Darwin-only test harness was corrected before PASS;
no real credential or production file was involved. The exact launcher also
passed a metadata-only SSH check: correct target/parent, file absent, runtime
unchanged. No application test suite, build or deployment was repeated.

After entry, send only the path above as the secure reference. The file remains
unbound to the application. **Merchant Inquiry authentication/querying and any
runtime integration require the owner's separate approval.** No inquiry approval
or deployment seal is issued by this storage procedure.

No changes to LIVE Secret/Public/HMAC keys, callbacks, CARD/Manual50/signup,
MON-01, original shared emergency budget1 or PDC PAUSE. Inquiry qualification
remains held until credential entry and separate authorization. Pay Again stays
held. Once inquiry is qualified, the owner requests COD preparation first and
homepage Add to Cart next; neither starts during credential setup. Customer
notification email delivery remains a separate required task. All deferred tests
remain open.
