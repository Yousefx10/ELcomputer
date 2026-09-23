# Live Chat staging acceptance

Date: 2026-09-23  
Project: `ELcomputer-Phase14-Staging` (`guaaupeegyvmsfaytfso`)  
Result: **PASS**

This checklist applies only to the isolated Phase 14 Supabase project and the local production build at `127.0.0.1:4314`. The deployed site and its linked Supabase project were not changed.

## Staging migration

- [x] Created a separate empty Free-plan Supabase project in `ap-southeast-2`.
- [x] Imported the checked-in repository schema baseline, then applied the complete repository migration chain in a temporary staging work directory.
- [x] Confirmed 46 matching staging migration versions: one temporary baseline version, 34 earlier repository migrations, and all 11 Live Chat migrations from `20260920150000` through `20260922100000`.
- [x] Enabled anonymous Auth only in staging and completed a real anonymous sign-in probe.
- [x] Confirmed the repository remains linked to `zsqhuwgoasrexdnamlks`. That project still ends at `20260920140000`; `chat_settings` and `chat_conversations` do not exist there.
- [x] Restored staging to `is_enabled=false`, `availability_override=offline`, and the four-second customer cooldown after acceptance.

## Identities

- [x] Guest A and Guest B
- [x] Customer A and Customer B
- [x] Support Agent A and Support Agent B
- [x] Admin owner
- [x] Authenticated outsider with no dashboard record

All identities use generated `example.test` addresses and exist only in the isolated staging project.

## Functional and workflow checks

- [x] Guest chat starts with a real anonymous Auth session.
- [x] Authenticated chat starts and retains permanent messages after two-tab reads and reconnect reconciliation.
- [x] A guest conversation moves to Customer A's account and disappears from the old guest session.
- [x] A public staff reply creates customer unread state; marking the visible sequence read clears it.
- [x] Two agents claiming the same revision produce one winner and one stale conflict.
- [x] A transfer succeeds while the previous agent has the transcript open; the previous agent cannot reply afterward.
- [x] Customer A can link Customer A's order. Customer A cannot link Customer B's order.
- [x] Public PDF upload/download works through the authorized route. Bad signatures, unauthenticated downloads, Customer B downloads, and direct public Storage URLs fail.
- [x] Staff can upload an internal-note attachment. The assigned staff member can download it; the customer cannot retrieve the note or file.
- [x] Chat-to-ticket conversion preserves the customer, order, conversation, assignment, and canonical transcript relationship. A retry returns the existing ticket.
- [x] Forced offline mode and empty automatic business hours create offline intake. Full business hours plus a renewed online agent lease restore live availability.
- [x] Admin changes are stale-safe and create settings audit rows.
- [x] The configured four-second cooldown returns HTTP 429 with `Retry-After` when a direct API request tries to bypass it.
- [x] Concurrent duplicate message retries return the same saved message ID.
- [x] A customer-send/agent-close race resolves to a valid ordered outcome; every later send is rejected as closed.

## Security checks

- [x] Guest A cannot enumerate or retrieve Guest B's conversation.
- [x] Customer B cannot retrieve Customer A's conversation, messages, or attachments.
- [x] A guest cannot attach an order or forge a permanent customer identity.
- [x] An authenticated user without an active `admin_users` record cannot open the staff inbox, view customer context, or transition a chat.
- [x] Browser roles cannot select from any of the eight Live Chat tables or execute write RPCs.
- [x] All eight Live Chat tables have RLS enabled and zero direct `anon` or `authenticated` table privileges.
- [x] The only browser-executable `chat_*` function is `chat_can_receive_topic(text)` for signed-in Realtime authorization. Customer B's subscription to Customer A's private topic is rejected.
- [x] Internal notes emit a staff signal and never appear in the public topic or customer transcript.
- [x] `chat-attachments` is private and has no broad `storage.objects` policy naming the bucket.
- [x] Supabase's two chat-related security advisor warnings are intentional: the authenticated topic predicate and anonymous signed-in access to the scoped Realtime policy. Cross-topic denial was exercised through the hosted Realtime service.

## Browser and accessibility checks

- [x] Chrome desktop, 1440×900: the customer panel stays within the viewport, the launcher is 50 px high, focus moves to Close, Escape closes the panel, and focus returns to the launcher.
- [x] Chrome mobile emulation, 390×844 at 2× density: the panel fills the visual viewport, exposes `aria-modal=true`, locks body scroll, keeps visible controls at least 40 px high, and has no horizontal overflow.
- [x] Authenticated staff desktop: the inbox loads real staging conversations, Realtime reaches **live**, and the two-column layout stays within the viewport.
- [x] Authenticated staff mobile: the inbox and Filters action remain visible with no horizontal overflow.
- [x] Reduced-motion media emulation, keyboard Escape/focus restoration, and the Chrome accessibility tree passed. The tree contains the named dialog and labelled controls.
- [x] No captured JavaScript exception, error log entry, or local HTTP 5xx occurred during the final browser run.

## Performance and quota checks

- [x] With 3,000 rollback-safe representative conversations, the waiting, assigned-to-me, unassigned, and offline inbox shapes used their intended covering indexes. Each measured between 0.046 ms and 0.070 ms on staging.
- [x] A public message produced the intended scoped public/staff/inbox signals; an internal note remained staff-only.
- [x] The customer and staff clients each held only their expected selected-thread/inbox subscriptions during the test.
- [x] One hosted Realtime subscription timed out during an earlier repeated run and succeeded through bounded reconnect. The final run connected and completed without a lost permanent message.
- [x] No unexpected rate or quota response occurred in the final run. The deliberate cooldown bypass returned the expected HTTP 429.

## Commands and evidence

The guarded runner refuses the production-linked project, requires matching staging confirmation values, and only targets a local application URL. The private env file supplies `NUXT_PUBLIC_SUPABASE_URL`, `NUXT_PUBLIC_SUPABASE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` for the isolated project:

```sh
set -a
source /path/to/private-staging.env
set +a
LIVE_CHAT_STAGING_BASE_URL=http://127.0.0.1:4314 \
LIVE_CHAT_STAGING_PROJECT_REF=guaaupeegyvmsfaytfso \
LIVE_CHAT_STAGING_CONFIRM=guaaupeegyvmsfaytfso \
node scripts/live-chat-staging-acceptance.mjs
```

The final runner result was `STAGING ACCEPTANCE PASSED (17 groups)`. Repository validation also includes the full Node test suite, Nuxt typecheck, production build, and `git diff --check`.
