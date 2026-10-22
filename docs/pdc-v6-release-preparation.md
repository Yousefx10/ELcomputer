# PDC V6 release preparation receipt — 2026-10-22

**READY for separate owner review. PDC has NOT deployed.**
Production remains Premium finishing `ea0dcc850b3a7d35`, schema89.

Prepared release: `881aadcfd4942ef8`; application `82ec667`.
Final approval seal:

```text
303c68aa71eac6ccccfcac07ea95c53b7d79190d47655e8e908fb379d6f21dac
```

The complete correction includes `productID` / `productName` support and migration90
restoring only EXECUTE on the existing lookup/refresh RPCs to `service_role`.
The original migration65 accidentally revoked these earlier grants. Native tests
and the preserved production schema confirm the independent access defect.
No function definition, owner, RLS, browser grant or business data is changed.
The final plan explicitly proposes89→90; the Premium deployment preserved89.

- Focused offline matrix:176 pass, zero failures/cancellations/skips. Native SQL
  covers permissions, exact schema/data preservation, interrupted-commit rollback,
  one successful commit and rejection of replay. Nine owned remote fault cases pass.
- Dashboard fixtures:499 assertions/48 screenshots, EN/AR, RTL/LTR,
  desktop/mobile, Light/Dark/System, no errors or external requests.
- Exact extracted archive:21 HTTP checks through native PostgreSQL/PostgREST,
  synthetic Auth and provider fixtures. The same archive passed after the RPC fix.
  Fixture Auth/setup failures and the pre90 access failure remain preserved.
- Typecheck and production build PASS. No rebuild for the SQL-only extension.
  Archive SHA256: `881aadcfd4942ef8897ea8a01c9404ee757df1173455f7cd418715bd2281538f`.
- Inventory:1873; retained client assets:825.
  Verified encrypted preparation backups/full readback remain retained. Apply must
  obtain fresh execution backups. The final read-only production check PASS.
- Saved Product ID40 is High Value(elc); General36 is distinct. Configuration,
  382 city aliases and32 status mappings remain unchanged. Caches remain empty.
- All current data/Auth/security/settings/media, Classic/Premium source and both
  footer styles remain protected. Checkout/signup/Paymob/PDC/COD/automation remain held.
- Zero phase2 production writes, provider calls, bookings, labels, callbacks,
  credential rotation or production staging. No PDC execution intent exists.

The [compatibility audit](pdc-v6-compatibility.md) records unresolved optional
booking-field names, production status mappings/timezone and status pagination.
The earlier HTTP500 remains unexplained. [Webhook cutover and token rotation](pdc-webhook-cutover-plan.md)
are prepared only; public callback access remains403 and no provider contact ran.
Hosted PDP account/native-share/authoring acceptance remains pending separately.
Historical full-suite failures remain documented; no whole-suite-green claim.

Review the [complete89→90 operator procedure](pdc-v6-rpc-release.md) and private
`pdc-v6-compatibility-20261022/OWNER-RELEASE-REVIEW.md`. The earlier application-only
candidate stays preserved and incomplete; never deploy it as the complete fix.

Approval required by the owner's Phase2 instruction:

```text
APPROVE PDC V6 COMPATIBILITY AND RPC ACCESS DEPLOY
303c68aa71eac6ccccfcac07ea95c53b7d79190d47655e8e908fb379d6f21dac
```

Do not execute without that separate final approval. Never retry a consumed plan,
replay90 or automatically restore the database. Application recovery preserves90
and newer data. No automatic retry/rollback or Git push command ran in this task.

Shared Git observation: cached `origin/main` advanced to `bf9ebd3` with an
`update by push` reflog entry at18:32:21 Asia/Riyadh. This task issued no push
command; the actor/cause was not established. Source/artifact hashes still match.
Do not describe the earlier task commits as unpushed based on the old handoff.

Private final receipt SHA256: `8bef8cc0ab5dead189f4f10a37b7214ae63ae53beb6e756da0eed2a942b4d360`.
One next owner action: review and approve the separately sealed PDC89→90 release.
