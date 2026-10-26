# Reviewed local commits and remaining exclusions — 2026-10-26

Owner explicitly authorized local review/staging/commits. No push, merge, rebase,
reset, history rewrite, worktree deletion or production deployment is authorized.

Opening inventory covered15 worktrees,12 branches and161 modified/untracked files;
no staged changes existed. Every visible Git change was inventoried and hashed.
[Per-file disposition](git-local-commit-file-review-20261026.csv) records all161
opening paths, not only a sample. Source and documentation review found no private
keys, real JWT/live gateway keys, unmasked customer emails or private incident
payloads in the staged set. Synthetic fixture strings are not production secrets.
Generated/ignored assets were not staged.

Reviewed groups:

1. `main`:3b7070d preserves the two pre-existing isolated Auth confirmation/redirect
 fixtures. Their bytes are unchanged; syntax checked only. No hosted Auth, signup,
 recovery, CAPTCHA, owner-payment or email test was repeated.
2. `local/location-reference-20261026`:a9a5c6f adds25 reviewed source/data/test files,
 including default-off96, provider-neutral selectors/server checks, controlled
 reference maintenance and source-provenance JSON. Native8 location +7 default-
 transaction regression,4 browser scenarios, typecheck and build passed locally.
3. Current safe documentation/README/roadmap/receipts/deferred register and this
 review are committed on main, then mirrored into the new full96 source branch.
 Separate documentation commit hashes are reported at completion. No branch merge.

Remaining exclusions are deliberate preservation, not discarded work:

| Frozen worktree | Opening files left untouched | Reason |
|---|---:|---|
| beta-launch-preparation-20261024/source | 40 | Preserve sealed/consumed/historical context and its HEAD; no replay, integration or cleanup. |
| customer-signup-acceptance-preparation-20261026/source | 20 | Preserve sealed/consumed/historical context and its HEAD; no replay, integration or cleanup. |
| modern-footer-release-preparation-20261021/failure-replay | 4 | Preserve sealed/consumed/historical context and its HEAD; no replay, integration or cleanup. |
| public-signup-preparation-20261026/source | 11 | Preserve sealed/consumed/historical context and its HEAD; no replay, integration or cleanup. |
| public-signup-turnstile-preparation-20261026/source | 12 | Preserve sealed/consumed/historical context and its HEAD; no replay, integration or cleanup. |
| signup-commerce-next-20261026/source | 17 | Preserve sealed/consumed/historical context and its HEAD; no replay, integration or cleanup. |
| turnstile-runtime-preparation-20261026/source | 13 | Preserve sealed/consumed/historical context and its HEAD; no replay, integration or cleanup. |
| turnstile-runtime-recovery-fix-20261026/source | 18 | Preserve sealed/consumed/historical context and its HEAD; no replay, integration or cleanup. |

These135 original paths include40 older Beta source/tests/docs,4 failure-replay
fixtures and91 other historical/duplicate continuity paths. Some are already
represented in later commits; their original bytes/heads still remain. No older
helper or unique failed-replay fixture was silently copied into the active feature.
The detached c3775e8 context and both accounts' commits are preserved. The per-file
CSV is authoritative for each exclusion; no claim that every old worktree is clean.

External/ignored exclusions: the three original XLSX files, retained raw GetCities
and incident snapshots, credentials/runtime/SSH material, private review inventories,
original/derived build archives, screenshots, logs, node_modules/.nuxt/.output and
any temporary browser/database files. Originals remain in their owner folder;
private qualification artifacts remain in the dedicated work directory. The
reviewed136KB reference JSON is intentional source data, not a build artifact.

Original95 source b37be43 and its archive/migration/config draft checksums remain
exact. New16th worktree/new13th branch is additive and isolated. The96 package
needs its own future sealed release/approval; it was not swapped into95. Main
remains a91-migration continuity checkout, never the deployment source.

Current public signup OPEN is preserved; purchasing and PDC remain held. Return
next to the original95 guarded deployment/recovery qualification and one scoped
new-customer real payment, with no unapproved operation or repeated successful test.
