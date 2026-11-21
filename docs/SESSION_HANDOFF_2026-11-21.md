# Session handoff — 21 November 2026

Read this first in a new conversation. It covers the session of 15–21 November 2026 (E411 to E416) and
everything still open. Older history stays in [the main handoff](HANDOFF_2026-11-09.md), the
[master roadmap](ELCOMPUTER_MASTER_ROADMAP.md), `PROJECT_STATE.md` and `CODEX_HANDOFF.md`.

This repository is **public**. Server access, keys and other private details are in
`logs/HANDOFF_PRIVATE_2026-11-09.md` (git-ignored). Never copy them into tracked files.

## 1. Live now

| Item | Value |
|---|---|
| App release | `c2a271c8f5c008f0` (release76, E416), installed 21 Nov 08:04 UTC |
| Source | `a198ba6` on `product-modern` in `../product-modern-20261107/source` (local, not pushed) |
| Database schema | 156, latest migration `20261119100000_order_cancel` (E414) |
| Rollback | point `current` at release75 `30500193bb702bdb` and restart (no database change) |
| Docs branch | `claude/handoffs-20261108` in this checkout (local, not pushed) |
| Server drop-ins added this session | `zz-shutdown.conf` (`NITRO_SHUTDOWN_TIMEOUT=5000`), `zz-google-signin.conf` (Google client ID) |
| Monitor | WARNING with the usual payment-verification exceptions; no critical alerts |

Nothing from this session is pushed. Pushing needs the owner to ask.

## 2. What this session shipped

| Entry | Release | What |
|---|---|---|
| E411 | release71 `fe19492976b6d80f` | DASH-R7B: the eleven Settings pages redesigned on the Dashboard kit |
| E412 | release72 `110af678bd4a95e2` | Bill logo fix |
| E413 | release73 `eb04b8939f536ec8` (schema 155) | Email > Templates (layout and built-in emails, EN/AR), Supabase Send Email hook route, Show Google sign-in switch |
| E414 | release74 `03177fdbf9e6de8a` (schema 156) | Cancel an order from Edit orders (ORDER-CANCEL-01) |
| OPS-RESTART-01 | server setting | Nitro waits at most 5 s on shutdown, so a release restart never overruns systemd's 30 s |
| E415 | release75 `30500193bb702bdb` | Google's own sign-in button (GOOGLE-BUTTON-01); turned on 19 Nov 14:40 UTC |
| E416 | release76 `c2a271c8f5c008f0` | Google button dark-mode fix (no white band behind Google's frame) |

### Order cancel (E414), as the owner decided

- Edit orders > Cancel opens a review. The server refreshes the PDC status first.
- Refused when: the order is closed, the courier has the parcel (use Return), the booking is not reconciled,
  or it is a guest card order (refund at Paymob first).
- Card payments go back to the store wallet. The wallet part is refunded too, once.
- Daftra: the job deletes the invoice's payments, then the invoice. A missing invoice counts as done.
- The cancel email is sent (EN/AR). The cancelled SMS is sent only when that SMS rule is on.
- PDC's API has no cancel call. Staff cancel the AWB on PDC's site; the review shows it.

### Google sign-in (E415, E416)

- Google's screen now names **elcomputer.net**, not the Supabase address.
- The login page shows Google's own button (Google Identity Services popup). Its ID token goes to
  `supabase.auth.signInWithIdToken` with a fresh nonce. Supabase still owns accounts and sessions.
- The Supabase Google provider must stay on: its client ID checks the token. The Google Cloud client is the
  same "Web application" client; `https://elcomputer.net` is in its Authorized JavaScript origins.
- Keep the Supabase callback in the client's Authorized redirect URIs. The old redirect button returns
  if Google's script fails or the client ID is removed.
- Turn off: delete `zz-google-signin.conf`, `systemctl daemon-reload`, restart (timers paused).
- The built-in browser pane never shows Google's frame. Check it in Playwright Chrome instead.

### Questions answered (no change made)

- Faint line under the phone tab bar on iPhone: Safari 26's see-through toolbar strip starts there and the
  page shows through it. A solid white strip under Safari's bar is possible but needs an iPhone check.
- Supabase custom domain (paid) and Google brand verification were offered; the owner chose the Google button.

## 3. Waiting on the owner

1. SMS > Order notifications > **Order cancelled**: turn it on (it is off).
2. Email > Templates: turn on Supabase's **Send Email hook** and paste its secret (E413).
3. **PDC-UNCERTAIN-01**: press Reconcile on the two "uncertain" bookings from 12 and 14 Nov; if PDC has no
   booking, press No booking at PDC, then book again.
4. Daftra jobs: press **Retry** on the cancelled-order job (the new code treats the missing invoice as done)
   and on the stock job.
5. Daftra test leftovers: empty the Daftra trash (draft invoice 434), then delete client 579.
6. For cancelled orders, cancel the AWB on PDC's site.
7. The owner's "normal tests" of E413, E414 and a real Google sign-in (E415/E416).
8. Optional: Google brand verification, so Google shows the store name and logo.
9. Older, still open: Paymob mobile wallets wait for an online UIG integration ID; Apple Pay needs the
   Apple merchant setup (see memory notes and the roadmap).

## 4. Next development

1. **DASH-R7C Product editor** — next in [the Dashboard plan](DASHBOARD_REDESIGN_PLAN_2026-11-15.md):
   one page with a sticky section list, one save row, Add product on the same layout, Scan item and
   Serialized details on the kit. Follow AGENTS.md and the product safety docs
   ([save](product-save-safety.md), [editor](product-editor-safety.md), [media](media-safety.md),
   [listing](product-listing.md)). Show screenshots (EN/AR, light/dark, phone/desktop) before asking for a release.
2. Then DASH-R7D (orders follow-ups), R7E (customers), R7F (search and polish), per the plan.
3. PDC-UNCERTAIN-01 follow-up: keep PDC's reply class when a booking ends uncertain.
4. RESET-COVERAGE-01: system reset must cover the newer tables and functions (`private.auth_email_hook` too).
5. DAFTRA-PDF-01: Daftra's own invoice PDF cannot be fetched by API.
6. Stale tests that fail the same way on the live commit: `paymob-security` 3, `public-signup-readiness` 10
   (its harness lacks `createPasswordRecovery`), `ui-localization` 1. Known baseline failures:
   `dashboard-access` 1, `dashboard-reads` 1, `daftra-erp-database` 2, `quick-setup-progress` 1,
   `system-reset-compatibility` 8, `system-reset-database` 12; `private-packing-videos` needs ffmpeg.
7. Unknown until the first real card cancel: whether Daftra deletes an invoice that still has a payment.
8. The wallet switch (`wallet-switch-e399`) must read `../release76` and expect schema 156 before its next use.

## 5. How releases work

App code: `../product-modern-20261107/source`. Work in a worktree branch (for example `work-dash-io`, now on
branch `google-button` at `a198ba6`); start new work from `product-modern`.

**App-only release** (copy `release-tools/make-release76.py` and `build-release76.sh` as release77:
predecessor `c2a271c8f5c008f0`, base `a198ba6`, previous artifact `release76/artifact`, schema 156):

1. `release-tools/build-release77.sh <full commit>` (generate scripts, typecheck, build, package).
2. In `release77/`: `node qualify.mjs run first` → `COMPILED_RETAINED_ARTIFACT_PASS`.
3. `node operator.mjs prepare`, `check`, `approve '<owner words>'`, `apply`, `verify` (twice: the second
   after the next natural monitor run, every 5 minutes).
4. Fast-forward `product-modern`, then update the roadmap, both handoffs, the continuation brief and the plan.

**Migration release**: the `make-release74.py` pattern (from release73's scripts). List each patched
function in CHANGED; the operator hashes every other function.

Rules:
- Never rerun `apply`. Never edit a sealed `operator.mjs` or `remote.py`.
- If a sealed verify cannot run (no install receipt), use a read-only equivalent like
  `release74/verify-equivalent.mjs`.
- Run `verify` in the background: on 21 Nov it printed its result, then did not exit for about 10 minutes.
- A server setting change: a drop-in, `daemon-reload`, the seven worker timers paused, one restart, timers
  resumed. Templates: `../product-modern-20261107/release-tools/ops/ops-restart-01.py` and `google-signin-on.py`
  (run on the server with `python3 -I -`). `ops/live-google.mjs` checks Google's button on the live login page in
  Playwright Chrome; `ops/gis-origin.mjs` checks a client ID against the site origin without touching the server.
- Caddy: never `systemctl reload`. Change the Caddyfile and the monitor's `caddy_sha256` pin together,
  then one SIGUSR1. A Caddy change after `prepare` breaks that release's verify.

Node: `/Users/imac/Documents/ELcomputer/procurement-postgrest-correction-20261018/tools/node-v22.23.1-darwin-x64/bin/node`.
Browser tests need `COD_REVIEW_PLAYWRIGHT` and a built CSS folder (for example `release76/source/.output/public/_nuxt`);
see the private notes. Running `run-suite` kills the shared test database (`pkill -f email-audit-pg`), so do not
run it while another suite runs.

## 6. Owner rules and preferences

- "Commit and build" means commit, build **and deploy** an app-only release. Still stop and ask for: a failed
  build, qualify or newly failing test; a migration or production setting change the owner did not name;
  payments or provider calls; any push.
- Each release and each production change needs the owner's words for that change.
- Anything touching Daftra, Paymob or PDC needs the owner's words.
- Read-only production scripts print only ids, statuses and counts. Never print secrets.
- Never open Confirm Orders live, run WordPress or PHP, or request `old.elcomputer.net`.
- Never special-case the owner or bypass RBAC/RLS. Never fake payments or test results.
- No keys, tokens, customer names, phones, emails, real order numbers or AWBs in tracked files.
- The owner is a developer: short technical reports are welcome.
- UI: creative but in the current theme colours; compact; no AI-looking captions or template stat cards;
  option cards instead of checkboxes; EN/AR, RTL, light/dark/system and phone widths always.
- Copy: short, natural sentences, usually under 12 words.
- Close any Chrome tabs you open. Avoid live chat on wide screens.
