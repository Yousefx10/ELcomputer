# Superseded after the PDC deployment

Do not deploy artifact `9418a11903830ae5` or reuse its old approval seal.
It lacks the PDC corrections now deployed in `2573cdf1504bf559`.
Use the [fresh consolidated approval packet](customer-session-consolidated-release.md).
The original packet is retained below as historical evidence.

# Customer session isolation — guarded deployment approval

Status: **SEALED, READY FOR OWNER REVIEW. NOT DEPLOYED.**

This is one combined application-only release. It includes the accepted profile
correction, isolated carts, private-page session boundaries and Checkout recovery.
There is no remaining local implementation blocker. Hosted acceptance follows
separate deployment approval; public commerce remains closed.

## Exact binding

| Item | Qualified value |
| --- | --- |
| Target | `https://elcomputer.net`; Caddy/systemd service `storefront` |
| Current release | `/srv/storefront/releases/0ea60833a5071f27` |
| Candidate release | `9418a11903830ae5` |
| Application archive SHA256 | `9418a11903830ae5e30506180843084aeb8719060865e65f0c3d029fcbca7318` |
| Application archive bytes | `13647877` |
| Inventory SHA256 | `924fef9af0ce2a9a6bcd2ab2ac18877113b586627d90300ffaaf4d9507ee8f6e` |
| Application source manifest SHA256 | `de63a7d46729efa40157772ddb9d78575c2bbf05a1ff5ad10f7ad7a0a08e72c6` |
| Approval seal | `07ff07e5fba22b8b6b4d58f40e80249aefa8f8c3dbbf894f45cd1c121c024860` |
| Schema / SQL changes |91 / zero migrations and zero business-data writes |
| Source provenance | Workspace Git HEAD `18ee1ca5b008a543d3340b7449e2e883197f957c` plus the exact working-tree application manifest; no new Git commit |

The manifest binds 653 application inputs. All 372 server files equal the
verified deployed source `ae2f6df9d059a07b7aa24aa67f10a315d3bb721e`. Payment/callback, ownership/RLS entry points
and shipping handlers are unchanged. The existing PDC lookup change stays in the
workspace; the candidate retains its deployed version. Both hashes are recorded
privately in `excluded-workspace-bindings.json`.

The archive, plan, source/workspace manifests, output inventory, qualification,
backups and independent verification are in:
`../customer-session-isolation-20261024/`.
The sole sealed plan is `plan.json`; the archive is `application.tar.gz`.
Superseded packages under `unsealed-pack-*` are non-deployable.

## Qualification

- 83 security tests, 15 source-browser tests and 3 deployment guard tests pass,
  with zero failures/skips in these final focused runs.
- Clean npm10.9.8 install, Nuxt typecheck and production build pass on Node22.23.1.
- The extracted exact archive passes 9 HTTP/browser result groups, 16 browser
  checks and 1429 asset URL byte checks, including all 1325 retained client assets.
- Twelve screenshots cover EN/AR, RTL, 1280/390px and Light/Dark/System.
  No browser page exception occurred.
- Auth/REST browser services and PostgreSQL concurrency fixtures are synthetic and
  local. Telemetry writes are blocked/suppressed by the qualification harness.
  No hosted customer write, provider transaction or PDC request occurred.
- Fresh encrypted database and runtime backups pass authenticated decryption and
  full readback. The read-only pre-seal comparison preserves 140 business/security
  projections, schema/RLS/grants/functions, Auth security, media/private files,
  current processes/runtime, disabled signup and all existing commerce gates.
  Existing comparison rules permit analytics and volatile Auth activity timestamps.
  This is scoped preservation evidence, not a claim about global write history.

The additional historical retained-asset suite reports 4 pass and one optional
fixture skip; the actual candidate's complete serving/byte checks pass above.
Target Linux private-candidate qualification runs before the application switch
only after deployment approval. Hosted multi-customer/provider acceptance is not
claimed by this local milestone.

## Approval scope

After the exact approval below, the guarded operator may:

1. Repeat read-only source/archive/tool/target/schema/data/Auth preservation checks.
2. Take and fully verify fresh encrypted execution backups.
3. Stage only this application archive and qualify it privately on the target.
4. Switch the application symlink and restart only `storefront` once.
5. Verify service health, held gates, preserved files and database/security state.

It must preserve Caddy configuration/process, runtime and credential bytes,
schema 91, the paid EGP2 order and late signed Paymob ingress. The uncertain PDC
job/dispatch, original reference and all incident files remain untouched.

This approval does not authorize registration, purchasing/coupon activation,
payment initiation, real charges, shipping calls/configuration, PDC work, Git
pushes or another release. There is no automatic retry or rollback. A STOP or
changed binding requires inspection and a fresh reviewed plan.

The previous application release remains available at `/srv/storefront/releases/0ea60833a5071f27`.
Any rollback needs separate review and approval, preserves schema/newer data and
must not change shared files or the existing incident records.

## Exact owner approval

```text
APPROVE CUSTOMER SESSION ISOLATION DEPLOY 07ff07e5fba22b8b6b4d58f40e80249aefa8f8c3dbbf894f45cd1c121c024860
```

The operator's read-only preflight is:

```sh
/Users/imac/Documents/ELcomputer/procurement-postgrest-correction-20261018/tools/node-v22.23.1-darwin-x64/bin/node scripts/customer-session-release/operator.mjs check /Users/imac/Documents/ELcomputer/customer-session-isolation-20261024
```

The guarded `apply` mode is reserved for that exact owner approval. It was not run.
After deployment, reload existing customer tabs, accept owner account/profile
loading and navigation, and confirm purchasing remains held. Retained assets keep
old client URLs working; already executing old JavaScript still needs a reload.
The next separate milestone is owner-approved manual fulfillment, then physical
stock readiness and controlled multi-customer purchases.
