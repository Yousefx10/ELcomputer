> DEPLOYED: `ea0dcc850b3a7d35`, schema89 unchanged. This plan is consumed.
> [Deployment receipt](premium-product-finishing-deployment-receipt.md).
> Approval/preparation instructions below are historical; never rerun them.

# Premium PDP finishing release

Prepared release: `ea0dcc850b3a7d35`. Final approval seal:

```text
e44076ad264a45e8985c72de0d8c56a8936c6c7265dac1a3763fe63c9027e2fd
```

The extracted archive passes 425 checks/193 screenshots. All 725 retained assets,
verified encrypted backups and independent archive readback pass.
[Full qualification and baseline disposition](premium-product-finishing-validation.md).
The owner must approve before production staging or activation.

Reply with exactly:

```text
APPROVE PREMIUM PDP FINISHING DEPLOY
e44076ad264a45e8985c72de0d8c56a8936c6c7265dac1a3763fe63c9027e2fd
```

The reviewed plan is in parent
`premium-pdp-finishing-20261022/prepared-d01649a/plan.json`.
The private `OWNER-RELEASE-REVIEW.md` contains exact check/apply commands.
The final preparation receipt records the last read-only check.


Application commit: `d01649a`. Schema89 remains unchanged. No SQL writes,
provider transactions, Caddy changes or commerce activation are included.
Production is still the accepted `cda41a7a13e0b61d` until final approval.

## Independent approval path

Use only `scripts/premium-product-finishing-release/operator.mjs` for this
milestone. Historical footer/PDP deployment operators and seals are consumed.
The new remote staging namespace is separate from every consumed executor.

1. `prepare SPEC NEW_DIRECTORY` verifies the currently accepted application,
   fresh read-only schema/data/runtime state, public holds and source qualification.
   It creates verified encrypted database/runtime backups, a clean build, retained
   client assets, a normalized inventory and independently extracted readback.
   Its format0 candidate is deliberately undeployable.
2. Review the extracted archive using the dedicated browser harness. Bind its
   complete SHA256, application commit, test reports, typecheck/build and regression
   disposition in the exact-artifact qualification file.
3. `seal CANDIDATE QUALIFICATION` checks the exact archive qualification and
   production preservation again, then creates the final format4 approval plan.
4. `check PLAN` verifies local inputs, artifact/readback, authenticated backup
   decryption, single-use status and current production state. It is read-only.
5. The owner approves the complete final64-character seal. Only then may
   `apply PLAN --approved EXACT_SEAL` execute once. It records an execution intent
   before preflight, obtains fresh verified backups, stages the archive, qualifies
   a private candidate with the owner's current Premium/Classic selection, checks
   protected data again and switches the application symlink through systemd.
   Caddy and runtime configuration remain unchanged. Public/DB/Auth/media checks
   follow activation. Any failure records STOP; no retry or rollback runs.

Every current business/Auth/security projection is bound. Fresh owner-authored
Settings and metadata are preserved; the old Classic/empty-content assumptions
are not reused. Only the established two analytics tables and Auth activity
timestamps may advance. Analytics counts cannot shrink. Schema, RLS/ACL, Auth
identity and metadata, products, stock, media, secrets and all disabled gates stay
protected. Owner writes after sealing require review if they invalidate the plan.

Rollback retains the previous accepted application, its verified inventory and
fresh encrypted backups. Any recovery requires a separate reviewed application-only
procedure; preserve schema89 and newer data. Do not restore the database merely
to undo a presentation change. No automatic recovery or generic Git deployment.

## Owner browser acceptance

- Confirm Premium remains selected. Check a genuine product in EN and AR.
- As a guest, favorite/unfavorite and reload. Signup must remain unnecessary.
- With an existing account, save and reload. Sign out and verify guest separation.
- Share on mobile; copy on desktop. Check the localized canonical product URL.
- In Product Editor → Specifications, add only confirmed package contents and
  factual tags. Save/reopen, edit quantity, reorder and remove an item deliberately.
  Use genuine Draft content for editing checks; never publish dummy accessories.
- On an appropriately authored public product, expand package contents with
  keyboard and touch. A product without confirmed contents/tags must hide them.
- Open Need help. Check Help Center, configured email/phone and signed-in support
  tickets. No live-agent promise, guest signup requirement or provider activation.
- Review desktop/tablet/mobile, RTL/LTR and Light/Dark/System. Check gallery,
  variants, existing specs, prices and unavailable purchasing. Confirm both footers.
- If reviewing Classic, switch/save explicitly, refresh and compare; then restore
  the preferred style. This is an owner action, never an automatic release change.

Hosted account/RBAC and actual mail/phone/native-share behavior need owner
acceptance. Local synthetic Auth/browser checks are recorded separately.
Stop after deployment verification and wait for acceptance. PDC and WordPress
remain deferred.
