# PDC shipment contract release — consumed, 2026-10-23

**DEPLOY PASS. This plan is consumed. Never rerun it.**
Production is `03aa6e565f5b5ad3`, schema90 unchanged. GetProducts remains accepted.
The [deployment receipt](pdc-shipment-contract-deployment-receipt.md) records
execution and preservation. The preparation evidence below remains historical.

Candidate release: `03aa6e565f5b5ad3`.
Application commit: `aa5d2f31a1d1f286a34e275d133a0c475e4f8238`.
Final approval seal:

```text
eb104358167fa5c104054652177f3134db3471bf4ce4f7eade9c650f8377b4ed
```

## Exact change and evidence

Only `server/utils/pdcShipping.js` differs from the accepted application inputs.
The normal payload uses fromContactPerson, contents and allowToOpenShipment.
Declared goods value is fixed-decimal subtotal minus discount, separately from
COD, shipping and card fees. Owner approval of that actual value remains required.
The [PHP/PDF review](pdc-wordpress-contract-review.md) records provenance and scope.

There is no migration, RLS/grant change, payment implementation change, storefront
or Dashboard redesign. Reverse payloads remain outside this normal-shipment scope.
All code/runtime/provider activation gates remain independently controlled.

- 68 focused native/offline checks pass, zero failures/cancellations/skips.
  Three contract tests cover the corrected fields, declared value and transport.
- Typecheck passes. One isolated clean-install production build passes under
  Node22.23.1/npm10.9.8. No completed PDP/GetProducts tests were repeated.
- 11 exact-archive checks pass against unmodified compiled declarations: canonical
  fields, service40/type1, goods value/COD, one booking envelope, exact REF/AWB,
  validation rejection, uncertainty, one-AWB PDF/private readback and polling.
- Two release tests, including nine remote filesystem/phase fault cases, pass.
  Old operators remain byte-identical. Wrong scopes, SQL writes, altered proofs
  and duplicate execution fail closed.
- Qualified archive has1971 entries and retains923 existing client assets.
  Every other application input, including Paymob, frontend and schema files,
  matches the accepted source.
- Fresh encrypted database/runtime backups pass authenticated decryption and
  full readback. Current target/schema/Auth/settings/data/media/runtime preservation
  passes before/after preparation. Production writes/provider calls are zero.

An initial local preparation stopped before target inspection because migration90
postdates the deployed application's source commit. The independent application
delta guard was corrected while retaining exact90-migration verification.
Its stopped directory/log remain preserved. A new directory contains the successful
preparation; no deployment attempt or automatic retry occurred.

## Execution boundary

Private reviewed plan:
parent `pdc-paymob-acceptance-readiness-20261023/prepared-aa5d2f3-2/plan.json`.
The operator is `scripts/pdc-shipment-contract-release/operator.mjs`.
Its independent format7 seal cannot reuse a consumed PDP/PDC approval.

After exact owner approval, the operator rechecked the clean source, hashes,
target and protected state. It created a consumed intent and fresh verified
encrypted execution backups, staged the qualified archive, passed one private
candidate, rechecked schema90 read-only and activated only the app. Final public
health and database preservation passed. There was no retry, rollback or SQL write.
Recovery requires a separately reviewed application-only plan preserving schema90
and newer business data. Do not use retired PM2/Git deployment scripts.

No apply, staging, candidate service, restart, provider request or activation ran
during preparation. The final read-only check is recorded privately.
The first-shipment readiness pass repeated only the mandatory read-only preflight:
`READ_ONLY_CHECK_PASS` for this same release/seal. No tests, build or release
preparation were repeated. Its private log is
`final-live-preflight-20261022T215236Z.log` in the acceptance-readiness directory.
That preservation baseline was held through activation. Business/configuration
edits now belong to the separately approved operational setup; they cannot authorize
reusing this consumed plan or restoring an older database.

This consumed seal authorized only this application release. It does not approve a city
lookup/cache write, provider enablement, callback ingress, payment, shipment,
label or public purchase. Those exact details/actions remain separately scoped in
the [controlled acceptance plan](provider-controlled-acceptance.md).
