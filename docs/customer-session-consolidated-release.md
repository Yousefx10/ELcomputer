# Consolidated customer-session deployment PASS — 24 October 2026

The exact approved release `58e3083f4aa6a1f8` is deployed, schema 91.
Approval `0971019ee41acefef4435d2fec2c262444bcdb7c3965111ca70f356ed069181e` is consumed; do not rerun it.
One `storefront` restart changed PID 31273 → 32102.
Private candidate qualification, fresh encrypted execution backups/full readback
and protected database/schema/security/runtime/media/incident checks passed.
Caddy and credentials are unchanged. PDC User-Agent/status-date fixes remain.
All purchasing/signup/provider gates stay closed; no PDC request or payment ran.

Hosted public smoke passed: 8 HTTP checks, 37 asset hashes, 3 browser checks and
4 protected-route observations. Account A exists; no second Auth identity exists.
[Hosted acceptance and Test B requirements](customer-session-hosted-acceptance.md)
are prepared. B creation and authenticated A→B acceptance remain pending approval
and secure sessions. No identity or authentication email was created or sent.

Private authoritative receipt:
`../customer-session-consolidated-20261024/DEPLOYMENT-RECEIPT.json`.
The sealed approval packet below is retained unchanged as historical evidence.

# Consolidated customer-session release — 24 October 2026

Status: **CONSOLIDATED RELEASE READY. NOT DEPLOYED.**

The previous session archive `9418a11903830ae5` predates the deployed PDC client
corrections. It lacks the generic User-Agent and required status-date helper.
Its old approval seal `07ff07e5fba22b8b6b4d58f40e80249aefa8f8c3dbbf894f45cd1c121c024860`
is obsolete for the current target. Do not deploy or approve it again.

## Fresh target and archive

| Binding | Qualified value |
| --- | --- |
| Target | `https://elcomputer.net`, systemd service `storefront` |
| Actual current production | `/srv/storefront/releases/2573cdf1504bf559` |
| Current PDC deployment seal | `ac7685b6c05dc01f0b887a448c21ecea321b78419fc440330cdbd37a0a2b6786` — consumed |
| New consolidated release | `58e3083f4aa6a1f8` |
| New archive SHA256 | `58e3083f4aa6a1f80cd4f18a89f9b13438c46376f4c5b7ed1f773e90140d4cdc` |
| New archive bytes | 13648309 |
| Inventory SHA256 | `37bb6cb44c692a9b181863cab872254a00c169e7ceb26ded74b643a9951a80fb` |
| New approval seal | `0971019ee41acefef4435d2fec2c262444bcdb7c3965111ca70f356ed069181e` |
| Schema / migrations / business writes | 91 / 0 / 0 |

The signed production inventory, running process and current archive were verified
read-only before preparation and again before sealing. The new plan uses release
`2573cdf1504bf559` as its baseline and separately reviewed rollback target.
It never treats the earlier `0ea60833a5071f27` baseline as current production.

Private plan, archive, extracted inventory, patch proof, fresh backups and tests:
`../customer-session-consolidated-20261024/`.
Authoritative files: `plan.json`, `application.tar.gz`, `qualification.json` and
`consolidation-proof.json`. Previous packages, receipts and source work are retained.

## Consolidation and PDC preservation

The candidate starts with the already qualified session-isolation artifact.
Exactly one runtime file changes relative to that artifact:
`server/chunks/nitro/nitro.mjs`.

The eight exact PDC edits already deployed in `2573cdf1504bf559` are applied to
that server bundle. Unique anchors and reverse-patch verification reject unrelated
changes. Reversing them restores every original session-bundle byte.
All other 2388 inventory entries, including the complete session client, stay identical.
All 1325 production retained assets are present; no serving-registry repair is needed.

Ten compiled PDC definitions are byte-identical to the verified deployed artifact.
They include shared `User-Agent: Storefront-PDC/1.0`, required date validation,
shipment-lifetime filters, normal tracking, original-reference recovery and reverse
status operations. All five PDC HTTP operations pass with a mocked fetcher;
missing dates and uncertain failures retain their fail-closed/no-retry behavior.
No PDC endpoint was contacted.

The 653 original session source inputs and the four deployed PDC overlay source
hashes are bound separately. Source provenance is composite; it is not a claim
that the entire dirty workspace or a new Git commit was built. The only workspace
application differences since session qualification are those four reviewed PDC
files, and their hashes match the deployed PDC plan. No unrelated source edits,
owner work or incident records are overwritten or newly published.

My Account/Cart/Checkout state isolation, scoped carts and markers, stale-response
guards, request timeouts and original-account command recovery remain intact.
Paymob callback and ownership/RLS/transaction behavior are unchanged by this patch.

## Focused validation and reuse

- 16 fresh focused tests pass, with zero failures/skips: six header/date checks and
  ten compiled-artifact/consolidated-guard checks.
- New guards reject wrong approval, consumed invocation and both historical
  deployment scopes before target access.
- Fresh exact-archive qualification passes 9 HTTP/browser result groups,
  16 browser checks, 12 screenshots and 1429 asset URL byte checks.
- EN/AR, RTL, Light/Dark/System and 1280/390px layouts pass without page exceptions.
  Two synthetic Auth accounts use the actual compiled application; old account
  order/address state clears across tabs. Unknown legacy carts stay unassigned.
- The completed 83 security, 15 source-browser and 3 session-release guard tests,
  plus the passed clean typecheck/build, are reused after hash/binding verification.
  The deployed PDC release's 33 native checks are reused against the same source
  and byte-identical compiled PDC definitions. No full build or broad audit repeats.
- Fresh encrypted database/runtime backups pass authenticated decryption and full
  readback. A fresh read-only comparison preserves schema 91, all 140 protected
  business/security projections, Auth security, current runtime/Caddy, media,
  private incident files and all existing commerce/provider restrictions.
  Analytics and volatile Auth activity retain the established comparison rules;
  this does not establish global write history.

All new browser/Auth/REST and provider transports are local synthetic fixtures.
Telemetry writes are suppressed in the qualification harness. No hosted customer
write, real charge, shipping request or public activation occurs during preparation.
Hosted account/cart/checkout acceptance remains the next step after deployment.

## Exact guarded approval

```text
APPROVE CONSOLIDATED CUSTOMER SESSION DEPLOY 0971019ee41acefef4435d2fec2c262444bcdb7c3965111ca70f356ed069181e
```

This authorizes only one guarded application deployment of this archive:

1. Repeat the fresh read-only source/tool/archive/target/schema/data/Auth checks.
2. Take and fully verify new encrypted execution backups.
3. Stage and qualify the exact application privately on the target Linux runtime.
4. Switch the application symlink and restart only `storefront` once.
5. Verify health, held gates and protected data/files/security state.

There is no Caddy edit/reload, runtime or credential change, SQL migration,
public registration/purchasing/coupon activation, payment initiation, PDC request,
Git push or incident mutation. The paid EGP2 order and signed late-callback ingress
remain protected. Any changed binding stops execution. No automatic retry or rollback.

Read-only preflight:

```sh
/Users/imac/Documents/ELcomputer/procurement-postgrest-correction-20261018/tools/node-v22.23.1-darwin-x64/bin/node scripts/customer-session-consolidated-release/operator.mjs check /Users/imac/Documents/ELcomputer/customer-session-consolidated-20261024
```

The guarded `apply` mode is reserved for this exact new owner approval; it was not run.
Rollback requires separate review/approval and retains schema/newer data and shared
files. Its application target is the current PDC-corrected release
`/srv/storefront/releases/2573cdf1504bf559`, never the older pre-PDC application.

After approved deployment, reload existing customer tabs and proceed to hosted
account/cart/checkout isolation acceptance with approved customer sessions and
commerce/provider gates held. Retained asset URLs cannot replace already running
old JavaScript. Public purchasing and real payment acceptance require their own
later approval. The separate PDC dynamic shipment test remains pending; no order,
shipment, cancellation or diagnostic case is created by this release.
