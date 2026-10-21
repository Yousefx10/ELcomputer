# Modern Footer validation receipt — 2026-10-21

Historical feature receipt at commit `8181953`: local PASS; production unchanged.
The later owner-approved [87→88 deployment](modern-footer-release.md) passed.
Its production/browser evidence and remaining owner content checks are separate
from this earlier local feature receipt.
See the [feature, configuration and release boundary](modern-footer.md).

Started at clean `89743faa109e44450dfa24ec84c4ca3b6d96b6e2`, two commits ahead of
cached origin/main. Both unpushed PDC commits remain preserved. No fetch or push ran.
Current README, state, shared Codex handoff, personal Notes and release procedures
were reviewed before implementation. The shared handoff/state serve both accounts.

## Feature verification at 8181953

- Five focused tests PASS. They exercise the additive migration against the real
  schema in PGlite, stored JSON round trips, bounds/version rejection, unchanged
  settings, nested media references, denied writes, URL validation, conservative
  defaults, localization/order, payment gating and exact Classic preservation.
- Browser result: 102 assertions PASS, 17 screenshots, zero browser warnings/errors and no outbound traffic. Actual Settings loads, section save,
  all bilingual fields, refresh, draft retention, add/remove/reorder/toggle,
  invalid-URL rejection and existing permissions are exercised against owned
  native PostgreSQL 17.11/PostgREST. No hosted identity/session is fabricated.
- Seventeen screenshots cover EN/AR × Light/Dark × 1440/900/390px, plus the
  three-section utility strip at all three widths and actual Nuxt SSR pages.
  Desktop uses four upper columns and horizontal utility sections. Tablet uses
  two upper columns/full-width utility rows. Mobile uses one column. No horizontal
  overflow. Logical layout reverses for RTL. Dark link contrast is verified.
- Both supplied references were visually compared with the desktop and tablet
  screenshots. The browser frame and fictional TailGrids content are excluded.
  Synthetic test images/content are confined to the disposable review fixture.
  Unavailable optional sections intentionally disappear in real configuration.
- The real production build renders EN/AR localized footers before JavaScript;
  hydration preserves links and reports no hydration warnings/errors. The test
  runtime uses a GET-only local backend proxy and blocks outbound requests.
- Node 22.23.1/npm 10.9.8 typecheck and empty-dotenv production build PASS.
  `git diff --check` PASS. No dependency or lockfile changed. Existing duplicate
  ERP auto-import and Tailwind source-map warnings remain; no new footer warning.
- Full regression: 996 PASS, 8 FAIL, 2 cancelled, 83 optional skips (1,089 tests).

The strict local output inventory passes: 616 application inputs and 1,077 output
entries. This records a local validation archive, not a production-ready package.

| Local artifact | SHA256 |
| --- | --- |
| Application input map | `02156b93019d0dc4e7f820062c0bb60cc199758ee6ac80bf08fc304ab5385e62` |
| Output inventory | `88a33ac8619f3ed9b68bcba00dc054bb3ebaa4885eb02542dccffa96bf33c15a` |
| Local output archive | `fe43965acaad5c583ae5e21ff1d4a4725ef7dc92b3d38a6665bdd993073bcbf0` |
| Migration 88 | `4ebb4fc58ccd274116ab8c5f3a254cb3e1270489cf556f61abace0cbcc2db331` |

The whole suite is not green. A separate detached worktree at the starting commit
reproduced seven failures and two cancelled transport cases: an already-superseded
82→85 membership certificate, existing Daftra/COD-history and preorder fixtures,
Dashboard handler/policy fixture assertions, two Release82 source-certificate
contexts and two asynchronous mock transport cancellations. These were not repaired
or hidden by this UI task. One additional expected historical guard refuses the new
migration 88: `tests/live-sales-release.test.mjs` still binds exactly 85→87 and passes
at the starting checkout. It and both completed operators remain unchanged.
The initial broad run also exposed a footer-fixture denial expectation; that test
was corrected and rerun successfully without changing application permissions.

The media UI uses the existing upload/library component in the application.
The isolated browser review substitutes only its selection field. It does not
claim a new hosted media-upload test, authenticated production Dashboard save,
provider acceptance or browser acceptance of an undeployed footer.

## Fresh production read-only evidence

Pinned SSH verified the accepted release/output inventory, active systemd/Caddy,
accepted Caddy configuration, protected runtime ownership/mode and false outbound
gates. All 2,613 public media files / 410,096,992 bytes still match the accepted
hash tree. Environment values and credentials were never printed or changed.

Read-only SQL verified schema 87 history identities, all five payment flags false,
PDC/automatic labels/reverse false and current row counts. Hosted Auth settings
still disable signup and require email confirmation. Public storefront EN/AR and
Dashboard login return 200, anonymous Products returns 401, checkout/signup return 403.
This is a fresh baseline observation, not deployment of the candidate.

Protected evidence, outside Git:
`/Users/imac/Documents/ELcomputer/modern-footer-review-20261021/`.
It retains runtime/database/HTTP observations and fixed safe logs. Browser artifacts
are retained in `/private/tmp/elcomputer-modern-footer-browser/`; final copies and
SHA256 evidence inventory are stored in the protected review directory.

No SQL mutation, Auth/provider/configuration save, new backup/restore, service
restart, Caddy edit, deployment, provider request, PDC retry or Git push ran against
production. The existing release and recovery artifacts remain retained. A new
87→88 plan must obtain fresh recovery and asset-retention evidence before execution.
The current local output is not a sealed production package.

ONE next owner action is the final digest approval in the [sealed release procedure](modern-footer-release.md#final-approval-and-one-execution).
Keep UI Improvement 2 held. Preserve PDC clarification, WordPress customers,
controlled provider acceptance, real stock and explicit public purchasing approval.
