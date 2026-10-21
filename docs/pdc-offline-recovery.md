# PDC offline WordPress recovery — 2026-10-21

**OFFLINE RECOVERY PASS. No production change occurred during recovery.**
The owner subsequently saved PDC personally. The
[masked production verification](pdc-connection-paymob-preparation.md) confirms saved
credentials/account IDs with provider gates still off. Connection remains blocked.

Historical PDC account and pickup settings were recovered from three agreeing
sources: the two verified encrypted WordPress exports and the original WPvivid
database. This recovers historical configuration, not current account validity,
parcel measurements, provider registration or permission to book a shipment.
No exact private business values or credentials are included in this document.

## Evidence and confidence

| Field | Result and evidence | Confidence |
| --- | --- | --- |
| Pickup City ID | Dedicated `elc_pdc_settings.from_city_id`; identical in all three sources; explicit store-side shipment binding; unique match in both 382-city maps with matching English name | High historical |
| Pickup Contact | Dedicated `from_name`; three sources agree; code binds it to `fromContactPerson` | High historical |
| Pickup Phone | Dedicated `from_phone`; three sources agree and current format passes, but it also equals the legacy code fallback | Owner confirmation required |
| Pickup Address | Dedicated `from_address`; three sources agree; differs from general WooCommerce store address | High historical; confirm collection location |
| Company ID / Product ID | Three matching dedicated settings; request code reads them | High historical; live product/account acceptance unverified |
| API URL / mode | Matching production URL and non-test setting; API request code reads that configuration | High historical |
| Access Token | **FOUND**, matches all three sources; authenticated encrypted owner copy | High recovery; current validity unverified |
| Webhook Secret | **FOUND**, matches all three sources; at least 32 characters, distinct from Access Token; same header contract as Nuxt | Technically compatible; current registration unverified |
| Weight / normal shipment / validation flags | Historical request-code constants recovered privately | Candidates; not current parcel facts |
| PDF template / saved labels | **NOT FOUND** in inspected PDC settings/code/order metadata; no ExportPDF call or archived upload PDF identified | Unresolved; do not assume the current default is correct |
| Customer delivery prices / coverage | Four historical PDC checkout rates; settings match all three sources; zone/area definitions match both later exports | High historical; owner approves current prices |

No dedicated PDC setting conflicts between the three sources. The two address
records describe different purposes: preserve both for owner review. Customer
billing/shipping addresses and destination-city metadata were excluded as pickup
sources. The legacy city records contain an English name only; an absent Arabic
label is not a naming conflict with the Nuxt mapping.

Historical weight/flags and WooCommerce customer rates must not silently become
current parcel settings, carrier costs or owner-approved customer fees. Preserve
the current disabled automation even if the legacy `auto_send` setting differs.

## Verified sources and inspection boundary

Fresh exports under
`/Users/imac/Documents/ELcomputer/actual-vps-reinstall-preparation-20261020/`:

| Source | Encrypted SHA256 |
| --- | --- |
| `elcomputer-wordpress-current.sql.enc` | `4c62f42b156e40cc45ccdf7ba43ef682ea7ab234362ecb53963f7e9a8ec7aefd` |
| `elcomputerold-wordpress-current.sql.enc` | `2d415414ec29907d5f88d86205bd7370b33eed148cffc611687eedf75e7abcdb` |

Both authenticated and matched their accepted plaintext/ciphertext pins. The
data-only parser observed 466/465 table schemas; it executed no SQL or PHP.
Dedicated settings are in `wp_options.elc_pdc_settings`. The active PDC code is
stored in `wp_snippets` and is unchanged from the original package.

Original parts remain under
`/Users/imac/Downloads/Backup elcomputer.net 15 oct/`. All 22 outer SHA256 pins match
the completed migration's accepted `backup-verification.json`. Inspection covered
the original database, themes, plugins, content/core code and three protected
configuration files: 43,826 relevant code/config files, read as data without
extraction or execution. PDC operational settings came from the database, not
from credentials in `wp-config.php` or customer addresses. The plugin template
`plugins/elcomputer-my-account/templates/my-account.php` also references PDC.

Historical order metadata includes 131 AWB rows, 131 REF rows and 134 event arrays
(702 decoded events). This establishes preserved PDC history; it does not prove
today's provider registration. Original upload-path metadata contains no PDF.
The larger encrypted application homes referenced by the backup reports were
located and preserved; they were not re-extracted or claimed as newly restored.

An initial local scanner bound stopped on a 2.3 GB nested archive; its source hash
was unchanged. Bounded seekable archive reads then completed without extracting
a plaintext archive or loosening source validation. This was an offline reader
correction, not a production deployment retry.

## Protected owner report and encrypted credential access

Private recovery directory, outside Git:
`/Users/imac/Documents/ELcomputer/pdc-offline-recovery-20261021/`.

- `OWNER-RECOVERY-REPORT.md`: exact business values, provenance, differences,
  historical rates, outstanding confirmations and personal setup instructions.
- `OWNER-BUSINESS-DETAILS.json`: the same structured private business evidence.
- `owner-recovered-credentials.json.enc`: only the recovered token/secret and
  provenance, encrypted with the existing separately stored recovery key.
- `owner-secret-copy.py`: owner-run helper to authenticate and copy one selected
  credential directly to the clipboard without echoing it. Only its `--check`
  mode was exercised; no credential was copied or entered by the agent.

Directory mode 0700 and all file modes 0600/owner identities pass. All four new
envelopes authenticate. The 22 plaintext output files passed an exact recovered-
secret scan; there is no plaintext credential report or secret in Git/logs/chat.
Original unencrypted backup packages were not changed or relabeled encrypted.

`RECOVERY-RECEIPT.json` binds the final evidence. SHA256:
`5ee0d8029fba71ee81486df207daecc408a4e8900cf26f36f86aefd4dd11fa90`.
No original preservation/migration artifacts were overwritten.

## Webhook reuse and registration

The legacy code defines `/wp-json/elcomputer-pdc/v1/webhook` and checks
`X-Webhook-Secret` against its dedicated saved secret. It does not substitute the
Access Token or read the secret from a query parameter.

The current Nuxt implementation is
**`POST https://elcomputer.net/api/webhooks/pdc`**, with JSON and the independent
**`X-Webhook-Secret`** header. Existing signature comparison, enabled-provider and
transactional tracking safeguards remain unchanged.

The recovered secret is technically reusable with that contract; application
migration alone does not require rotation. Offline files cannot establish the
currently registered provider URL/secret or their present validity. No automatic
reuse, rotation, production copy or provider registration occurred.

PDC must point to the new Nuxt path before callbacks can reach this implementation.
The owner can use an existing self-service registration control if their account
provides one; otherwise PDC assistance is required for that cutover. This does not
prevent staging the recovered account/pickup settings tonight. The last verified
Nuxt receiver remained held 403; reachability was not retested or changed here.
Do not cut over to an unreachable receiver or bypass secret validation.

## Recovery handover action — subsequently completed by the owner

The recovery handover instructed the owner to privately open `OWNER-RECOVERY-REPORT.md`, confirm the current pickup phone/address,
and stage the confirmed PDC values through **Quick Setup → Shipping & ERP →
Shipping configuration → Open shipping settings → PDC API**. Use the personal
secret-copy instructions there; never paste recovered data into chat.

Keep provider enablement, automatic booking, reverse pickup and COD eligibility
off. Mark the PDF template, actual parcel weight and current customer prices as
pending wherever not confirmed; do not invent values to force readiness. No Test/
Sync, callback cutover, order, charge or shipment is authorized by recovery.

No production connection/write, Dashboard save, deployment/restart, Auth or
inventory change, provider request, WordPress/PHP/SQL execution, cron, email/SMS,
website restoration or Git push occurred. Production remains the owner-accepted
release d2d7a8029b473e4a/schema87 from the previous receipt, not a new live inspection.

Roadmap: existing Paymob live configuration; separately approved controlled
payment/shipment acceptance; required WordPress customer identity/old-login,
private profiles, addresses and historical-order migration before unrestricted
signup; then the first approved public purchase. Preserve Auth UUIDs, avoid
duplicate identities and prevent historical imports from triggering commerce.
