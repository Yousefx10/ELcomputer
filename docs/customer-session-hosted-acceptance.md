# Test Customer B — exact owner creation steps

Status: **PREPARED. ACCOUNT NOT CREATED. HOSTED ACCEPTANCE PENDING.**

Account A: `info@elcomputer.net`.
Account B: `yousef_espetan@yahoo.com` — selected by the owner.
The fresh read-only check found B's email unused. Public signup is disabled.
Customer-profile RLS is enabled. Its SELECT/INSERT/UPDATE policies use `auth.uid() = id`.
The enabled Auth insert trigger creates `customer_profiles.id = auth.users.id`.
Only that customer-profile trigger is present on Auth user insertion; it does not
create an application admin record. Actual B ownership/sign-in remains unverified
until the account exists and the owner signs in.

Codex2's latest handoff records the separately approved PDC inbound-routing
change. It preserves session release `58e3083f4aa6a1f8` and closed outbound gates.
Do not replay either deployment or its consumed ingress approvals.
No application code, Caddy, credential or configuration change is needed here.

## Exact creation approval

```text
APPROVE CREATE TEST CUSTOMER B yousef_espetan@yahoo.com
```

Scope: one ordinary Auth identity and its own default customer profile.
The owner enters the password directly in the secure Supabase Dashboard.
Auto-confirm **this user's email only**, based on the owner's ownership statement.
No email is sent. No Account A, admin membership, global Auth setting, order,
payment, shipping, inventory or commerce/provider gate changes are included.
This is a human-operated Dashboard action, not a Codex execution command.

## Supabase Dashboard steps

1. Open [this production project's Auth users](https://supabase.com/dashboard/project/amighioggheqddyypgcl/auth/users).
2. Choose **Add user → Create new user**. Use the create form, not an invitation.
3. Enter `yousef_espetan@yahoo.com`. Choose a strong unique password directly in that form.
   Keep the password and session tokens outside chat and Codex artifacts.
4. Enable **Auto Confirm User** for this one account. Leave global signup and
   global email-confirmation settings untouched.
5. Check the email and click **Create user** once. If the result is ambiguous,
   inspect the users list for that email before another attempt.
6. Sign in through [the existing storefront login](https://elcomputer.net/login),
   using B's email/password. Use email/password login for this test.

The Auth trigger should create B's own profile with normal defaults. Do not create
or edit `admin_users`, team members, custom role metadata or RLS policies.
Tell Codex only **“B created and signed in”**; no password or token is needed.
Codex can then check the exact Auth UUID/profile link, confirmed permanent user,
active/empty customer defaults and absence of admin membership read-only.
That check must precede claiming successful hosted customer acceptance.

Supabase's [admin creation API](https://supabase.com/docs/reference/javascript/auth-admin-createuser)
supports per-user email confirmation. Its [SDK source](https://github.com/supabase/supabase-js/blob/master/packages/core/auth-js/src/GoTrueAdminApi.ts)
distinguishes creation without a confirmation email from sending an invitation.

## Manual A→B acceptance — same browser profile

Use the same browser profile throughout, with two storefront tabs. Reload old
tabs first. Do not use separate incognito contexts for A and B. Keep A's existing
profile, addresses, orders and cart unchanged. Never submit an order or payment.

| Step | Owner action | Expected result |
| --- | --- | --- |
| Baseline A | Sign in as A; open Profile in both tabs. Note A's existing address and cart without editing them. | Both tabs show A's own data. |
| Switch to B | Sign out in tab 2 and sign in as B there. Inspect tab 1 before refreshing. | A's private data clears. Tab 1 shows B or a login screen; it never retains A's address or order/payment details. |
| Refresh | Refresh both tabs and reopen Profile and My Orders. | B's own profile appears; addresses/history start empty. A's orders and recovery messages never appear. |
| Cart, when accessible | Add one existing storefront item to B's local cart using normal controls, then refresh. Switch back to A without changing A's cart; return to B. | B retains its item; A's original cart remains unchanged. Neither account receives the other's basket or pending recovery. |
| Anonymous | Sign out and inspect Cart when accessible; sign in as B again. | Anonymous browsing shows neither account's private basket. B regains only B's basket. |
| Late responses | Optionally slow the browser network while opening Profile; switch accounts, then restore normal network. | A delayed A response never fills B's profile/address or changes the displayed customer. |
| Checkout/recovery, when accessible | Inspect existing state only under B, then A and B again, including a second tab and refresh. | No previous customer's address, coupon, quote, order, payment or recovery panel appears. Do not create a command or payment to manufacture test state. |

Current direct checks: `/login` returns200; `/cart` and `/checkout` return403.
Those existing guards remain. If a normal route/control is held, record **HELD**
and stop that case. Do not alter gates or work around the guard. Cart/Checkout
acceptance cannot be marked PASS until their approved browser path is available.
An empty cart alone also cannot prove positive basket separation. Recovery cases
without existing eligible state remain NOT EXERCISED; do not create a real order.

Report each case as PASS, FAIL, HELD or NOT EXERCISED. Report any leak immediately
without pasting personal addresses, tokens or payment details into chat.
Only after recorded acceptance should public registration/purchasing readiness
continue; this packet does not activate either feature.

Private fresh preparation evidence:
`../test-customer-b-preparation-20261024/read-only-preparation.json` and
`creation-plan.json`. No identity or email was created by this preparation.

The earlier generic preparation and completed evidence follow unchanged.

# Hosted customer session acceptance — prepared

Status: **DEPLOYMENT PASS. AUTHENTICATED A→B ACCEPTANCE PENDING.**

The consolidated release `58e3083f4aa6a1f8` is deployed, schema 91.
Its exact approval is consumed. Do not repeat the guarded deployment.
See the [deployment receipt](customer-session-consolidated-release.md).

## Existing identities

A read-only Auth/customer/admin join found exactly one Auth identity.
Account A, `info@elcomputer.net`, exists and is email-confirmed.
There is no second customer identity or existing Test Customer B.
No identity, profile, password or authentication email was created or changed.
Private evidence: `../customer-session-consolidated-20261024/hosted-account-discovery.json`.
No connected signed-in browser sessions are currently available to Codex.

## Smallest next owner action

Choose an owner-controlled email for **Test Customer B**, distinct from Account A.
Supply that email and approve creating one ordinary Supabase Auth customer.
No exact identity can be approved until its email is chosen.

The owner sets B's password directly in the secure Supabase Auth interface.
No password or session token is requested, generated or pasted into chat.
The creation step sends no authentication email and leaves public signup disabled.
The existing customer-profile defaults/trigger may create B's normal profile.
Leave addresses, wallet, orders and payment history empty. Grant no admin role,
permissions, controlled-purchase entitlement, stock or provider configuration.
Do not use the application's admin-user creation flow for a customer identity.
After approved creation, verify Auth/profile ownership and absence from `admin_users`
read-only before any browser acceptance. Do not delete the test identity afterward
without separate instruction.

This is a preparation plan; no creation command, invitation or Auth write ran.
An email invitation would require separate send approval and callback qualification.
The existing SSR browser uses PKCE; the SDK's admin invitation uses a different
callback flow. This packet therefore uses secure owner-set credentials.

## Hosted checks already completed

- Eight public HTTP checks and 37 served asset hashes pass.
- EN desktop/light and AR mobile/dark login pages hydrate without page exceptions.
- Anonymous payment-result rendering stays unable to confirm payment, removes
  untrusted success/transaction query fields and displays no private order link.
- Anonymous payment status, account order and admin access return401.
- Public checkout/shipping/capabilities remain held403 by the existing ingress.
- Direct `/cart` and `/checkout` loads remain403. Account profile redirects to login.
  The payment-result route remains accessible for its existing callback/result role.

All browser mutations and external provider transports were blocked. No hosted
customer data was written. Initial smoke-harness expectations for guarded routes
were corrected; their attempts are retained. Completed HTTP/assets/login checks
were reused. No application correction or redeployment was needed.

## Account A→B acceptance after access is ready

The owner signs in through secure browser sessions. Reload existing tabs first
so they use the deployed client. Do not copy or export Auth tokens.

Use two tabs in the same browser context to verify A sign-out, B sign-in and
A→B→A transitions. Check profile/address clearing, per-account cart ownership,
anonymous cart handling, late responses and recovery-marker isolation. Use only
approved sessions and existing owned order/payment information. Test B starts
empty; it must never display A's address, products, order or payment recovery.
No order, quote, coupon, payment intention or shipment is created by this plan.

Public purchasing, signup, payments and PDC stay closed. Direct Cart/Checkout
access remains held; verify the approved customer navigation path before claiming
hosted coverage. If additional access is necessary, prepare its narrow approval
separately. Creating B does not authorize Caddy or runtime changes.

The completed local 83 security, 15 browser and 3 release-guard tests, typecheck,
build, fresh consolidated tests and exact-archive qualification remain valid.
They do not substitute for this pending hosted account-switching acceptance.
