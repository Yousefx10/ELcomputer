# Paymob controlled restart acceptance — 2026-10-21

**CONTROLLED_RESTART PASS. Approval consumed. Do not repeat the attempt.**

The owner executed the approved `pre`, `once --approved`, `post` sequence in the
Hostinger root console. All eleven expected PASS lines were reported. Independent
pinned-SSH read-only verification passed at **12:28:31 UTC**. The agent did not
perform an additional restart or rerun either completed helper phase.

| Check | Accepted result |
| --- | --- |
| Nuxt | `storefront.service` active/running; new app PID/start versus the consumed-attempt receipt; zero automatic restarts |
| Saved Paymob inputs | All six approved LIVE inputs match the running process; HMAC present; both modes live |
| Runtime custody | Root-owned regular file, mode0600; no duplicate definitions; other runtime values preserved |
| Payment and shipping | Saved/running outbound gates false; all five stored payment methods false |
| Customer access holds | Hosted signup/anonymous signup disabled, email confirmation retained; EN/AR signup/checkout and `/api/checkout` return403 |
| Health | Public storefront `/`200; loopback protected Products API401 |
| Caddy | PID/start and reviewed configuration/unit hashes unchanged |
| Systemd | Original `Restart=on-failure`, no forced-exit override; temporary runtime guard removed; original unit/drop-in loading and hashes verified |
| Release | `d2d7a8029b473e4a`, unchanged current symlink/node invocation; accepted schema87 baseline, with no new SQL schema query |
| Evidence | Root0700 helper directory, root0600 helper/receipts; exact reviewed helper hash; ATTEMPT/VERIFIED/SUCCESS receipts agree |

The read-only verifier imported the hash-verified helper as a module and called
only custody, receipt, configuration, health and snapshot readers. It never called
`main`, `once`, `post`, service stop/start/restart, daemon-reload or a release operator.
No Paymob/PDC endpoint, callback, diagnostic, transaction or configuration save ran.
Production files, data, Auth, products, media and inventory were not changed by
the verification. No credential value, length, environment contents or raw log
was printed. Paymob loading does not establish merchant payment acceptance.

## Preserved evidence

Private local directory0700/files0600, outside Git:
`/Users/imac/Documents/ELcomputer/paymob-restart-acceptance-20261021/`.

- Owner's fixed PASS output: `OWNER-REPORTED-RESULTS.txt`.
- Independent result and protected receipt copies: `READ-ONLY-VERIFICATION.json`.
- Final acceptance: `FINAL-RECEIPT.json`, SHA256
  `83d8567151d390e352a1938050255c7b727713ee96baf8406bb1b5254913da7f`.
- Read-only verification SHA256:
  `e8697a6c3fafa9776fc8d5efaeea2310a8a71cb9c45a5902fb33bcc8befa3721`.
- Retained VPS `/root/paymob-restart/SUCCESS.json` SHA256:
  `1e84dd2081abd86161fca06195afdb6b72e69ced5b70a6b07ebd39e05116132a`.

The reviewed helper remains SHA256
`e7349870a6e35d5c9dbdd477ceb8f7120232342958eab1b0434064bc3365d831`.
Earlier preparation and staging receipts remain intact. Never rerun the consumed
restart/finalization or remove their receipts to permit another attempt.

Next priority is [PDC HTTP500 local evidence review](pdc-http500-local-review.md).
PDC retries still need separate bounded approval. Keep charging, shipments,
automation, checkout and signup disabled. Controlled provider acceptance remains
separate. Mandatory WordPress customer identities/old-login compatibility, private
profiles, billing/shipping addresses and historical orders remain before unrestricted
signup. Preserve Auth UUIDs and prevent duplicates or imported commerce/financial
transactions. Real stock, fees, delivery, parcel and callback acceptance remain
prerequisites for the first public purchase.
