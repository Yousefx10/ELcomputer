# Modern Footer refinement release — 2026-10-22

**Preparation PASS. Final owner approval is pending. No production deployment ran.**

Production remains `d1b10bb664e15a67`, application `8181953`, schema 88.
The completed [87→88 release](modern-footer-release.md) and its approval are consumed.
This separate application-only release uses the established Caddy/systemd phases.
No historical executor, certificate or guard changes.

## Reviewed candidate

| Binding | Value |
| --- | --- |
| Application commit | `3b9816472157b3f45feaa43ac087115eef730384` |
| Candidate release | `40ebcf1f6d50a143` |
| Archive SHA-256 | `40ebcf1f6d50a1433bcf11ea7980e67d20d6bb8d04fce351642da66d2b6abca7` |
| Archive size | 8,003,829 bytes |
| Inventory digest | `fdf81d9bf3c512643ad9b8e330731e459aa24d4ecff3163337040ff14960f421` |
| Independent extraction | PASS, 1,566 entries |
| Retained client assets | 528, original bytes preserved |
| Schema | 88 unchanged; zero migrations or SQL writes |
| Approval seal | `4320ada2c57d17aeb32539feb8a7f083297f0da669de221a780a61bd4d9cd10d` |

Only `app/components/layout/ModernFooter.vue` and
`app/assets/css/modern-footer.css` change runtime behavior from accepted production.
[Design details](modern-footer-refinement.md) cover the stronger branding,
content-aware grid, newsletter panel and compact utility/legal rows. Classic,
Dashboard settings/editor, content schema, backend, dependencies and locales remain
unchanged. Existing saved JSON and all legacy fallback settings remain compatible.

Current saved Cash/Card/InstaPay availability is true; Bank/PayPal is false.
The release preserves those exact values. Checkout/signup routes and live
Paymob/PDC transports remain disabled. PDC enablement, automatic labels and
reverse shipping remain false. No provider request or integration activation runs.

## Qualification and preservation

- Five existing footer tests, typecheck and production builds pass.
- Six native application-release tests and six remote-phase tests pass, no skips.
  An actual nonsuperuser PostgreSQL transaction rejects writes with `25006`.
  Populated Modern JSON is preserved; unknown history and approval drift reject.
- The exact retained-asset candidate passes 533 browser assertions and captures
  107 screenshots. Coverage includes EN/AR, 1440/900/390px, Light/Dark/System,
  missing/short/long content, actual saved public content and real theme assets.
  Real Nuxt SSR/hydration and live OS theme transitions pass. No page/hydration
  warnings or external/provider traffic occur in this local review.
- Dashboard save/reload, ordering, validation and permissions use disposable native
  PostgreSQL/PostgREST. Synthetic Auth and the media-selection adapter are explicit.
  This is not authenticated hosted Dashboard or media-upload acceptance.
- The original eight suite failures and two cancellations retain their
  [reviewed qualification](modern-footer-release.md#eight-failures-and-two-cancelled-tests).
  The new runtime diff is limited to the two presentation files above. No full-suite
  green result or live provider acceptance is claimed.
- Read-only preparation compares all 88 migration versions/source bytes, the
  accepted schema88 fingerprint, 135 original protected table projections,
  Auth security/access contracts, settings, provider queues and current media.
  All 2,627 media files/411,264,665 bytes remain exact. Existing analytics and the
  previously reviewed Auth activity timestamp exclusions remain explicit;
  between-observation comparison is not a global write-history audit.
- Runtime environment, systemd units/drop-ins, Caddy, current output and running
  process identities remain exact. All 14 public health/hold GETs and Auth signup
  settings pass. The new candidate, staging path and temporary link remain absent.

The immutable plan binds the initial 503-check/101-screenshot qualification.
The final preparation receipt additionally binds the exact-artifact 533/107 review
and its harness. No sealed application, operator or qualification input changed
during that supplemental review. The harness loads current-manifest CSS only;
retained historical styles remain available to old clients.

## Recovery inputs

Protected evidence is outside Git:
`/Users/imac/Documents/ELcomputer/modern-footer-refinement-20261022/`.
The immutable release plan is `prepared-current/plan.json`. Actual saved content,
credentials, keys and owner assets remain private review inputs.

| Encrypted backup | Bytes | SHA-256 |
| --- | ---: | --- |
| Database | 9,333,364 | `1ccc122ab972b6bb6d4ac82fd2fda46daabb580d955ca41d8e0bd73c94fb0ec4` |
| Runtime/recovery, 10 files | 2,278,038 | `aae35e0ea9c68443847087a0e5770d7d0df5d6af8d509eedc5c1ed4e6611f5cf` |

Authenticated full decryption, PostgreSQL TOC/full-parser readback and complete
runtime file-byte comparison pass. These checks verify archives, not a hosted
restore. Execution obtains another fresh encrypted recovery set before staging.
The existing release and all original client assets are retained.

Recovery requires a separately reviewed app-only plan and approval. If activation
has not occurred, leave the accepted release serving. If activation has occurred,
review switching to retained `d1b10bb664e15a67` with schema88/current data intact
and one controlled storefront restart. Verify retained output, runtime, current
state and closed gates first. Never restore an older database, reverse SQL, erase
an intent, repeat an ambiguous apply or initiate automatic rollback.

## Exact approval and deployment procedure

Pause settings/catalog/provider edits during approval and execution. Protected
drift stops this sealed release and requires review. Anonymous browsing may continue.

The owner must approve this final candidate with:

```text
APPROVE MODERN FOOTER REFINEMENT DEPLOY
4320ada2c57d17aeb32539feb8a7f083297f0da669de221a780a61bd4d9cd10d
```

From `/Users/imac/Documents/ELcomputer/ELcomputer`, first run the read-only check:

```sh
/Users/imac/Documents/ELcomputer/procurement-postgrest-correction-20261018/tools/node-v22.23.1-darwin-x64/bin/node scripts/footer-refinement-release/operator.mjs check /Users/imac/Documents/ELcomputer/modern-footer-refinement-20261022/prepared-current/plan.json
```

After exact owner approval and a passing check, execute once:

```sh
/Users/imac/Documents/ELcomputer/procurement-postgrest-correction-20261018/tools/node-v22.23.1-darwin-x64/bin/node scripts/footer-refinement-release/operator.mjs apply /Users/imac/Documents/ELcomputer/modern-footer-refinement-20261022/prepared-current/plan.json --approved 4320ada2c57d17aeb32539feb8a7f083297f0da669de221a780a61bd4d9cd10d
```

The operator requires clean Git, exact application/tool/input hashes, verified
archives, strict SSH/TLS and an unchanged live target. It consumes an exclusive
intent, repeats preflight, creates fresh encrypted backups, stages/verifies the
archive and runs safe private GETs under a temporary restricted systemd unit.
The existing release/PIDs remain unchanged until the candidate passes. The temporary
unit stops before activation. All SQL connections are read-only; no migration runs.

A fresh exact database-state proof is required immediately before activation.
Then one atomic current-link switch and one controlled storefront restart run.
No environment, systemd unit, Caddy or provider setting is edited or reloaded.
Public health/hold GETs, Auth, schema/data, all media/private files and unchanged
configuration must pass. Any STOP preserves evidence and forbids automatic retry
or rollback. Do not use retired PM2 tools or the consumed migration operators.

The agent then verifies public EN/AR responsive/theme rendering with browser
mutations blocked, verifies target/data preservation again and updates both handoffs.
Known held endpoints remain held; an unrelated chat-status denial is not a footer
hydration defect or proof of chat acceptance. Record hosted owner checks separately.
Deploy this refinement immediately after approval, before unrelated tasks.

## Owner browser checks after deployment

1. Hard-refresh `/` and `/ar` at 1440, 900 and 390 pixels.
   Check Light, Dark and System; change the OS theme while System is selected.
2. Check the larger logo, readable description and balanced navigation.
   Confirm RTL alignment, wrapped long labels and no horizontal scrolling.
3. Confirm the newsletter shows its unavailable status and cannot submit.
4. Check social links, support hours/contact, configured app badges and payment
   logos. Current mobile logos should form 4+3 rows; legal links should wrap cleanly.
5. In Dashboard → Settings → Footer, make one reversible Modern content edit.
   Save, reload, confirm the storefront, then restore and save the original.
6. Check Classic briefly, then restore the preferred footer style.
   Confirm Classic's presentation and saved content remain unchanged.

Do not enable commerce or test signup, charging, bookings or provider diagnostics.
Report any hosted save/upload/style-switch acceptance as owner-reported evidence.
