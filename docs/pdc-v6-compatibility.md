# PDC V6 compatibility correction — 2026-10-22

GetProducts now accepts the support-confirmed `productID` / `productName` fields.
The fixture is the exact two-service JSON supplied in the owner's handoff:
General (36) and High Value(elc) (40). This supersedes the previous lack of a
verified GetProducts row contract. It does not explain the earlier HTTP500.

`normalizePdcLookup(response, 'GetProducts')` retains `id`/`ID`, `name`/`Name`,
nullish alias precedence, positive int32 IDs, unique services, bounded nonempty
names, envelope/row limits and partial-pagination rejection. IDs reject booleans,
arrays, objects and nondecimal string coercions. Invalid provider rows produce
one confidential502 response. Product aliases are not accepted as city aliases.
The Dashboard caller supplies the endpoint explicitly. No settings default,
selection, city mapping, commerce control or credential changes in the parser.
A separate narrowly scoped migration90 restores two existing server RPC grants.

The local schema analyzer uses the same fields and reports independent row,
normalization, company-echo and saved-selection stages. Unsupported echo types
cannot become normalization failures. Echo absence proves neither ownership nor
authentication. Existing consumed diagnostics/bundles and their evidence remain
unchanged; do not rerun them. The old investigation script describes its historical
parser and is not the current compatibility replay entry point.

## Read-only configuration evidence

After the PDP deployment, an authenticated read-only transaction confirmed:

- Saved Product ID40 matches High Value(elc). General36 remains a distinct option.
- Pickup city remains configured;382 existing city aliases and32 status mappings remain.
- Both lookup caches are empty. No live sync has been authorized or performed.
- Provider, auto-labels, reverse pickup and COD are false.
- Access Token and independent webhook-secret presence flags are true.
- Jobs, webhook events and durable dispatches are zero. Label template is1.

Private before/after configuration and city-map fingerprints bind preservation.
No private pickup, merchant, credential or customer values appear in this report.

## Confirmed server RPC access defect

Exact-archive HTTP replay exposed403/42501 before the provider transport.
The preserved production schema snapshot independently confirms owner-only ACLs
on `shipping_claim_pdc_lookup()` and `shipping_claim_pdc_refresh(uuid)`.
Migration65's `shipping_claim_%` sweep revoked their original service-role grants
without restoring them in its explicit allowlist. Earlier direct SQL/H3 fixtures
ran as the database owner and did not exercise this PostgREST role boundary.

New migration90 restores EXECUTE only on those two existing RPCs to `service_role`.
Function bodies, owners, search paths, service-role claim checks, throttling,
Dashboard permissions, table grants, RLS and browser denials remain unchanged.
A native fixture verifies the defect before90, exact two-ACL correction, unchanged
schema/data otherwise, runtime service-role checks and browser rejection.
The same byte-identical archive then passes21 checks through real native
PostgreSQL/PostgREST and actual built HTTP handlers. No production grant ran.

The earlier application-only candidate is retained and cannot provide a complete
PDC release on schema89. A separate reviewed89→90 grant-and-application release
must bind this migration and its exact preservation tests before owner approval.
The first replay's unstable synthetic Auth token and initial RPC-access failures
remain preserved as qualified evidence; no production guard was bypassed.

## Focused endpoint review

The supplied Courier Integration Test V4 PDF was read in full, SHA256
`8f2f5ae3047fb72ef8aebe495a2f48e1501b27b4c2df951c40cf6638e05fb186`.
The Webhook Integration PDF was read in full, SHA256
`9386ff876642717be5514856c8b46056afdd444a0a0ac4995b539e76cd9d5c0d`.
Duplicate copies match their recorded pins. These documents describe the test
API; the owner's new support evidence confirms production GetProducts only.

| Area | Code and evidence | Disposition |
| --- | --- | --- |
| GetProducts | GET; exact production V6 URL; AccessToken/CompanyID; no Cookie/body. Support confirms two product fields and services. | Confirmed correction implemented; live acceptance remains unexercised. |
| GetCities | GET; PDF pp7–8 defines numeric `id` / string `name`, used for pickup/destination. | Existing aliases retained. No guessed city fields or live request. Current production rows/completeness remain unverified. |
| SaveShipmentEx | POST; one shipment, `allMustValid`, `hasAWBs:false`, stable unique `toRef`; PDF pp2–5. `verifyReverseResult` checks general/row success, exact REF, one valid AWB. | Required transport/result contract agrees with PDF. Optional `fromContactName` / `allowToOpenPackage` differ from documented `fromContactPerson` / `allowToOpenShipment`. These existing outbound/reverse payload fields require production-provider clarification before booking acceptance; no speculative payload rewrite. |
| Instructions | PDF table says `specialInstructions`; its example says `specialInstuctions`, matching existing code. | Provider ambiguity remains. Confirm exact optional field behavior. |
| Shipment identifiers | Product ID and pickup/destination cities come from saved configuration/cache and exact mappings; AWB/reference are unique and account identity is pinned. | Existing protection retained. A shipping service is not a shipment-type ID: type1 General /3 Reverse /5 Exchange is a separate field. |
| GetShipmentsStatus | POST with comma-separated-string `awBs` / `reFs`; PDF pp6–7. Existing exact REF+AWB matching, bounded results, optional ID/time and name-only observations. | PDF omits a concrete response envelope, pagination controls, optional StatusID/date types and timezone. No new schema or pagination strategy invented. REF-only recovery remains blocked on absent/ambiguous results; never assume absence permits rebooking. |
| ExportPDF | POST `{templateID, awBs:[awb]}`; PDF pp5–6; binary `application/pdf`. | Existing5MiB bound and `%PDF-` check retained. Template1 agrees with documented standard; real merchant label/printing acceptance remains pending. |
| Authentication | HTTPS fixed mode-specific host; two credential headers; JSON Accept/Content-Type; redirects refused; bounded deadlines. | No session cookies or browser login required. Production/test hosts remain explicit; no account-specific application default. |
| Duplicate/uncertain booking | SQL locks and unique dispatch/order/REF/AWB; durable lease/token, account/config snapshot; timeout/lost acknowledgement becomes uncertain. | Offline native races/replays exercise one create. Recovery uses original REF; PDF retry advice never overrides this durable guard. PDF retries never repeat booking. |
| Tracking | Exact REF association then AWB verification; atomic event/current-state transaction; AWB+StatusID idempotency and event-time ordering. | Unknown statuses stay neutral. Status97 and PDF illustrative IDs conflict with supplied mapping; production mapping/timezone/repeated-status semantics still require provider confirmation. |
| Labels | Private configured VPS root outside app/uploads,0700 directories/0600 files, exclusive no-follow writes, hash/size readback and staff RBAC downloads. | No public Storage or new provider label request. Native fixtures cover traversal, symlinks, corruption and retry recovery. |
| Reverse | Explicit staff approval, type3 only, stable ASREV reference, separate claim jobs/history, exact account/config guards and explicit recovery. | No automatic reverse pickup, cancellation or fake refund. Optional payload discrepancies also apply here. |
| COD/finance | Explicit COD flag, eligible selected courier, coverage/packing checks, server money/city snapshot; verified paid cards collect zero. | Shipment events do not settle payments, post accounting or move inventory. Reverse receipt and finance remain separately authorized operations. |

Pagination guards recognize the existing documented-by-implementation outer fields
`hasMore`, `nextPage`, `totalCount`. The PDF does not define nested/custom metadata.
No claim of complete general pagination support or current live API acceptance.

## Validation and release boundary

The compatibility suite includes real H3 Dashboard handlers over disposable SQL:
test/sync, permissions, operator holds, throttling, two service choices, missing
saved selections, invalid rows/cities, atomic caches and revision conflicts.
The offline integration matrix covers lookup/transport, webhook, native booking
races and uncertainty, private PDFs, reverse safeguards and SMS separation.
The browser harness uses actual Vue shipping components and synthetic identities.
Its response fixtures use the same normalized support-confirmed JSON. It verifies
both options, preservation of an absent saved choice, explicit selection/save,
masked inputs, EN/AR, RTL, Light/Dark/System and compact mobile behavior.

See the release preparation receipt for final counts, build/typecheck and hashes.
Local fixtures are not hosted merchant acceptance. The PDC application release
requires its own final owner approval. No live lookup, booking, label, callback,
credential rotation, checkout/signup/provider/COD activation or Git push is authorized.
