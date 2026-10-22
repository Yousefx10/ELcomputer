# PDC V6 compatibility deployment receipt — 2026-10-22

**DEPLOY PASS.** Production release `881aadcfd4942ef8`, application
`82ec667c03cbea1e350ddef92eaaddf3335aafed`, schema90. The approved plan is consumed.

The owner approved exact seal:

```text
303c68aa71eac6ccccfcac07ea95c53b7d79190d47655e8e908fb379d6f21dac
```

The mandatory fresh read-only check passed. Apply ran once, created verified
fresh encrypted database/runtime backups, staged the existing qualified archive,
passed private candidates against89 and90, committed migration90, and activated
the application. No rebuild, provider request or automatic retry/rollback ran.

## Verified production result

- Migration90 restores only EXECUTE on `shipping_claim_pdc_lookup()` and
  `shipping_claim_pdc_refresh(uuid)` to `service_role`. Browser roles remain denied.
  Function bodies/owners/search paths, RLS and every other schema/ACL object match.
- One migration committed; zero business-data writes. All 138 protected
  table projections, Auth identity/security, credentials and saved controls pass.
- Saved Product ID40 remains High Value(elc). All382 city aliases and both empty
  lookup caches are preserved. Provider/auto-label/reverse/COD remain false.
- Premium remains selected. All storefront, Product Editor, Classic/Premium and
  footer source hashes match the deployed Premium finishing baseline.
- Caddy/systemd/runtime configuration and private media match. Public media:
  2627 files/411264665 bytes. All 825 old client assets remain.
- Public health/safety routes pass. Anonymous live browser smoke passes
  107 checks/8 screenshots across EN/AR, RTL/LTR,
  desktop/mobile and Light/Dark, with zero runtime/hydration errors. Desktop EN and
  mobile AR screenshots were inspected. Analytics POST requests were blocked;
  chat-status403 remains the existing hold.
- Independent post-browser read-only verification passes runtime, exact schema90
  history, two intended ACL changes, effective role permissions, preserved data,
  settings/Auth, media and public holds. Encrypted backups pass authenticated
  decryption and full readback.

Checkout, signup, Paymob/PDC outbound, COD/auto-label/reverse activation and the
public callback remain held. `/api/webhooks/pdc` remains403. No GetProducts,
GetCities, booking, provider label, callback, credential rotation or provider
contact ran. Local compatibility evidence is not live provider acceptance.
Hosted account/native-share/Product Editor acceptance remains owner-only.
Optional booking fields, status mappings/timezone and status pagination remain
provider-confirmation items in the [compatibility audit](pdc-v6-compatibility.md).
The earlier HTTP500 remains unexplained.

## Custody and recovery

Private evidence: parent `pdc-v6-compatibility-20261022/`. It includes owner approval,
`approved-read-only-check.log`, `approved-deployment.log`, single-use intent,
execution backup/readback, migration commit intent/receipt, private candidate
receipts, activation/completion, live browser report and independent verification.
`FINAL-DEPLOYMENT-RECEIPT.json` SHA256:
`cbde6a779241fb58941ff9b2890bb74acd0d39df53e5ed8e156c02f7b326c05a`.

Previous accepted release `ea0dcc850b3a7d35`, its verified archive and all
PDP/finishing artifacts remain retained. Recovery requires a separate reviewed
application-only plan preserving schema90 and newer data. Never rerun this consumed
plan, replay migration90, restore the DB to reverse this parser change, or invoke
historical PM2/Git deployment operators. No automatic recovery or Git push command.

Both handoffs and README record this result. Next owner action: separately scope
one controlled GetProducts acceptance request. Existing consumed diagnostics must
remain preserved; no live request, gate change or destination cutover is implied.
