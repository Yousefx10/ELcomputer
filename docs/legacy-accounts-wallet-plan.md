# Old WordPress accounts, wallet balances and Google sign-in: plan

14 November 2026. Task IDs: `LEGACY-LOGIN-01`, `LEGACY-WALLET-01`, `AUTH-GOOGLE-01`.
Status: investigated and planned. Nothing has changed in production.

Owner's request: "in the old wordpress site, users had money inside 'wallet' plugin,
i want to migrate their old balance to current nuxt project ... give it back to same
accounts ... even they didn't login for new nuxt projct ... so old users can login with
same credentials and use their money balance ... i want to enable the google login."

## What the old site had

Source: the approved primary SQL snapshot
`actual-vps-reinstall-preparation-20261020/elcomputer-wordpress-current.sql.enc`. It was read
offline, and its plaintext digest matched the receipt. The wallet plugin's key came from the
encrypted home backup. Nothing was executed and no website was contacted. Order dates in this
snapshot end 16 October 2026. The last wallet activity is 19 September 2026.

**Accounts**
- 518 WordPress users: 516 customers and 2 administrators.
- All 518 passwords use WordPress 6.8's format `$wp$2y$10$…`. That is bcrypt over
  `base64(HMAC-SHA384(password, key "wp-sha384"))`. Supabase cannot read this format directly.
- All 516 customers were imported on 25 October into `customer_history_private.customers`,
  keyed by WordPress user ID. 513 are approved for claiming; 3 are held.

**Google sign-in**
- The site used Nextend Social Login 3.1.25 with Google only.
- 163 customers have a Google link stored in `wp_social_users`, with the Google account ID.
  That ID is the same value Supabase stores as the Google `sub`.
- 113 of them signed up through Google. Their WordPress password was random, so they
  never knew it. The other 50 linked Google to a password account later.

**Wallet**
- The plugin was FS WooCommerce Wallet (database version 294).
- `wp_fswcwallet` holds one row per wallet, 16 rows in total. Balances are AES-256-CBC
  encrypted by the plugin; they were decrypted offline in memory.
- `wp_fswcwallet_transaction` has 32 entries (27 credits, 5 debits) from 1 March to 19 September 2026.
- `wp_fswcwallet_requests` has 2 entries, both rejected. There were no withdrawals.
- The WebToffee gift-card wallet (`wp_wt_gc_wallet`) is empty.
- Settings: partial payments on, refunds to wallet on, top-ups on (maximum 1,000 EGP).
  Withdrawals, transfers and cashback were off.

**Balances to carry over**

| | Customers | EGP |
|---|---:|---:|
| Positive balances | 13 | 1,069 |
| 1–99 EGP | 6 | |
| 100–249 EGP | 7 | |
| Largest / smallest | | 200 / 10 |

- Every one of the 13 balances equals its transaction log exactly, and all are whole pounds.
- All 13 are imported, claim-approved customers. 8 of them have a Google link.
- Three wallets are not carried over:
  - an administrator's test wallet (test partial payments, empty balance);
  - a customer whose 100 EGP was set to 0 by an admin edit;
  - one wallet that was never used.

The 13 WordPress user IDs and amounts are kept only in the private workspace below,
encrypted with the project backup key.

## What the Nuxt store has today

- **Sign-in:** email and password only. Signup is on, with email confirmation and Turnstile.
  `app/pages/login.vue` already shows "Continue with Google" when the Supabase
  Google provider is on. No release is needed for the button.
- **Old customers:** the login page tells them old passwords were not transferred. They can sign
  up with the same email, then connect previous orders (`customer_history_claim`, which needs a
  confirmed email).
- **Wallet:** `customer_profiles.wallet_balance` is shown on Account > Wallet and in Dashboard
  Customers. Customers cannot change it (protected-field trigger). There is no ledger, no
  activity list and no way to spend it.
- **PAY-BAL-01:** a locally qualified balance ledger with accounts, immutable entries, reservations,
  staff adjustments and full-balance checkout. It was never installed. It was built
  for schema 110 (`payment-launch-20261102/source`, `20261102210000_customer_account_balance.sql`).
  Its migration says "No legacy credits/backfill"; this plan changes that by request.

## The plan

### 1. Google sign-in (AUTH-GOOGLE-01): settings only, owner steps

1. **Google Cloud.** Reuse the old site's Google project if you still have it, or create one.
   - Set the OAuth consent screen to External and In production.
   - Use only the basic `openid`, `email` and `profile` scopes; they need no Google review.
   - Add elcomputer.net as the app domain, with the privacy page URL.
2. **OAuth client.** Create a Web client.
   - JavaScript origin: `https://elcomputer.net`.
   - Redirect URI: the Supabase project's `/auth/v1/callback` URL.
3. **Supabase Authentication > Providers > Google.** Turn it on and paste the client ID and
   secret yourself. Claude never handles the secret.
4. **Supabase URL configuration.** Site URL `https://elcomputer.net`. Allow `https://elcomputer.net/**`,
   which covers `/login?oauth=callback` and `/ar/login`.
5. **Check.** Sign in with Google on a phone and a desktop, in English and Arabic.

Supabase links a Google sign-in to an existing account with the same confirmed email, so old
customers land in their own account. Google can go first: the account step below handles
both orders. Facebook stays off.

### 2. Old accounts and passwords (LEGACY-LOGIN-01)

**Accounts for every approved old customer.** A single-use operator, following the
release pattern, creates one account for each of the 513 approved customers that has no
account yet. It uses the Supabase Admin API (never direct `auth.users` writes):

- the WordPress email, marked confirmed; no password; no email sent; no marketing consent;
- the `customer_profiles` row, using the archived name;
- the link to the history row (`auth_user_id`), so old orders show at once.

If an account with that email already exists, it is linked instead and no password is stored.
The 3 held customers and the 2 administrators are left out. Creating the accounts makes
"Forgot password" work for old customers, and lets their balance land before they ever sign in.

**Old password works on first sign-in.** Old password hashes go into a private table, keyed by
`(source_id, legacy_id)`. No role can read the table; only service functions can use it.

1. The login page tries Supabase first. Only on "invalid credentials" does it call a new
   `POST /api/auth/legacy-sign-in`.
2. The server computes the HMAC-SHA384 pre-hash. Postgres compares it with pgcrypto's `crypt()`,
   so the plaintext never reaches the database and the hash never leaves it.
3. This works only while the account has no password of its own. Once a customer sets one, by
   reset or by this step, the old hash is deleted.
4. On a match, the server sets that password through the Admin API and deletes the hash. It then
   returns a one-time sign-in token from `generateLink`, which the page exchanges with
   `verifyOtp`. One captcha is enough.
5. From then on the same email and password work through normal Supabase sign-in.

Rules:
- Unknown email and wrong password give the same error as Supabase.
- Five failures lock that old account for 15 minutes. Each IP address also has a rate limit.
- Turnstile is checked on the server if its secret is configured.
- If Supabase's password rules reject an old password, the customer gets the reset email instead.
- Hashes not used by a set date are deleted (recommended: 6 months). Reset by email still works after.
- Hashes never appear in logs, receipts or Git.

**Google matching.** The private table also keeps each customer's stored Google ID. If a Google
sign-in's `sub` matches an old customer whose email differs, the server reports it for staff
review rather than merging accounts on its own. This should be rare.

**Copy changes.** The returning-customer note becomes, for example: "Customers from our previous
website: sign in with your old email and password, or Google." Arabic gets the same.

### 3. Wallet balances (LEGACY-WALLET-01)

**W1: ledger, opening balances, visibility.** Bring PAY-BAL-01's ledger forward to schema 146+.
- Add one opening credit per old customer, kind `store_credit`.
- Each credit has the reference `WP-WALLET-<WordPress user ID>`; the existing unique index makes
  it post only once.
- Credits are posted by the account operator, so balances appear even before customers sign in.
- `customer_profiles.wallet_balance` becomes a mirror kept by the ledger, so existing pages
  keep working.
- Account > Wallet shows the activity list, which replaces "not available yet".
- The Dashboard customer panel shows the balance and its entries. Staff with `payments.balance`
  can credit or debit with a required reason, and every change is audited.

**W2: spend the balance at checkout.** The balances are small (10–200 EGP), so full-balance
checkout alone would rarely help. The old site allowed partial payments. Plan:

- A "Use wallet balance" switch applies min(balance, total). The rest is paid by card,
  Apple Pay or cash on delivery.
- Coupons apply first; the wallet pays part of what is left. It is a payment, not a discount.
- **Card and Apple Pay:** the amount is reserved when the checkout session opens. It is debited
  when payment succeeds, and released on failure, expiry or retirement.
- **Cash on delivery:** the amount is debited when the order is placed and returned if the order
  is cancelled. The courier collects only the rest.
- **Full cover:** if the wallet covers the whole total, the order is paid with no provider step.
- **Refunds:** the wallet part goes back to the wallet; card refunds stay as today.
- **Display:** order pages, emails and the Dashboard show "Paid from wallet".

W2 touches checkout, Paymob amounts, the PDC cash amount and Daftra invoice payments. It
needs its own review, local qualification and approval, and must stop for any provider change.

### Order of work

| Step | What | Production approval needed |
|---|---|---|
| 0 | Read-only checks: old emails that already have accounts, pgcrypto present, Supabase password rules, redirect list | None (reads only) |
| 1 | AUTH-GOOGLE-01 settings and live check | Owner does the Google and Supabase steps |
| 2 | Migration release: private legacy table, ledger (W1), service functions, sign-in endpoint, login and wallet page changes | Owner names the migration |
| 3 | Data operator: encrypted dry-run, then load hashes, Google IDs and the 13 opening balances; create or link accounts; post credits | Separate owner approval for the data change |
| 4 | Owner test with a real old account you control; then tell customers if you wish | An announcement email needs its own approval |
| 5 | W2 wallet at checkout | Separate release and approval |

### Decisions for the owner

1. **Create accounts for all 513 old customers now** (recommended), or only when each one first
   signs in. Creating now makes balances, history and password reset work immediately.
2. **Mark their emails as confirmed.** Recommended: Google linking and password reset need it.
   WordPress did not verify emails, so this trusts the old registration, as the old site did.
3. **Wallet at checkout: partial payments** (recommended) or full balance only.
4. **When to delete unused old passwords:** 6 months recommended.
5. **Wallet rules on the new site:** no expiry (as before); refunds to the wallet allowed; top-ups
   off for now. Top-ups mean taking customer money and need payment terms.
6. **Google project:** reuse the old one, or create a new one.

### Checks before anything goes live

- Password check against WordPress's own test vectors and one owner-controlled old account.
  Check both the exact and trimmed input, as WordPress handles it.
- The pgcrypto `$2y$` → `$2a$` comparison, rehearsed on local PostgreSQL 17.
- Same error and timing for unknown email, wrong password, locked account and held customer.
- Supabase's automatic Google linking to a pre-created, confirmed, passwordless account,
  tested with a throwaway account before the 513 are created.
- After a password reset or a successful old sign-in, the old password path is closed.
- Accounts that existed before: no password change, history and balance linked once.
- Running the operator twice changes nothing; a failure mid-batch keeps its receipts.
- Ledger: the 13 credits total 1,069 EGP; customers cannot write or read others' entries.
- EN/AR, RTL, light/dark and phone layouts for login, wallet and the Dashboard panel.
- W2: reservation, debit, release and cancellation in every payment path; no double spend under
  concurrent checkouts.

## Private evidence

`/Users/imac/Documents/ELcomputer/legacy-wallet-login-review-20261114/` (mode 700, not in Git):
- the offline readers;
- aggregate results with no personal values;
- the wallet plugin's source;
- `legacy-wallet-balances.private.json.enc`, the WordPress user IDs and amounts;
- the plugin's key file, re-encrypted.

All encrypted files use the project backup key. `wp-config.php` was extracted encrypted, then
deleted unread; it was not needed. Decrypted values were never written to disk.
