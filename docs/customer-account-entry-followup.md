# Account entry follow-up — 2026-10-21

**Owner acceptance BLOCKED. Narrow correction prepared; not deployed.**
The owner reports `Unavailable` at `/account` after the first Caddy correction.
This does not establish a failure or success for the four direct section tests.

## Confirmed cause

Fresh read-only checks at 21:27 UTC on 20 October (21 October in Riyadh) confirm
the deployed Caddy hash remains `a19befc25ede29546b5670c0d4a8075e4180c8e310f7e72bd2d0536dc287a169`.
Caddy PID 23064 is active/running with zero restarts. Nuxt PID 22422 and release
`82214df492a57126` are unchanged. No production change or retry was performed.

The first policy explicitly left `/account` held. That omitted the normal entry
linked by My Account and the account layout. Public `/account` and `/account/`
return Caddy 403/plain `Unavailable`; the application was never reached. This is
not an empty customer record or a new application exception.

The three approved customer sections still return anonymous 302 to their login
paths, and the four reported list APIs return application 401 without a token.
Customer `/login` remains deliberately held 403. Owner acceptance must use the
existing session, signing in through `/dashboard/login` when necessary.
Authenticated section acceptance has not been supplied or manufactured.

Direct loopback GET/HEAD for `/account`, `/account/`, `/ar/account`, `/ar/account/`
all return the existing application302 to the appropriate login path. The page
already uses `customer-auth`; its layout and profile/own-order reads already exist.
Read-only counts confirm the one current Auth user already has an active customer
profile. No identity, profile, Auth/RBAC/RLS grant or application code was changed.

## Exact additional correction

Add this alternative to the existing method/path matcher:

```text
(GET or HEAD) and ^/(ar/)?account/?$
```

Exactly one Caddy matcher line changes. All other configuration bytes remain.
No additional API exception is needed: the overview uses existing authenticated
Supabase profile/own-order reads. The existing profile fallback and RLS contracts
are unchanged; no browser-write-safety certification is implied.

Checkout, signup/login, payments/providers/workers, private attachments, customer
mutations and other account page families retain their current restrictions.
The page exception forwards unchanged Auth and forces private/no-store.

| Binding | SHA-256 |
| --- | --- |
| Current installed config | `a19befc25ede29546b5670c0d4a8075e4180c8e310f7e72bd2d0536dc287a169` |
| Follow-up candidate | `504191ccdc985084cf9aa0bba4fc36b7cf2bcae7405af95abce469d56bd81558` |
| Follow-up policy | `8e2a5a23734fe5d283267b385119c734b794e7cd570e4a7d288bd2615a105d8b` |
| Previously installed policy | `8b2bdcb1ed45fc3976be24a646d0d0e318d9404f5d6b68725c374313a985b997` |

Private preparation:
`/Users/imac/Documents/ELcomputer/customer-account-parent-followup-20261021/`.
It contains the exact installed source/policy, candidate/receipt/adapted config,
loopback diagnosis, profile-presence counts and guarded `release-plan.json`.
Plan SHA-256: `ac3127a4a6b6548d4e9b49cefbe193d648bb6973310661c9f535164593885bba`.
The original deployment receipts/backups remain untouched.

`prepare.py --previous-policy` prepares an update locally. It first reconstructs
the old installed block byte-for-byte, rejects drift/repeated application, and
replaces only that verified block. The expected source hash is still mandatory.
It has no connection, installation or restart capability.

Fresh validation: three customer-access preparation/actual-Caddy tests and six
existing Caddy/archive checks PASS, zero skips. Two independent store hostnames
exercise parent GET/HEAD, token forwarding/no-store, unauthorized rejection, held
methods and unknown paths. Exact production candidate adaptation and independent
one-line diff assertion PASS. One initial test wrongly assumed `/account-extra`
was held by the old dormant rule; the test was corrected to `/account/unknown`.
No production request or restart was used to resolve that local test assumption.
No Nuxt source changed; typecheck/build were not repeated.

## Approval and guarded action

The earlier owner approval covered the exact first candidate and one execution.
This adds an omitted route under a different hash. It needs approval for this
specific follow-up; the completed executor must never be rerun.

After approval, recheck source/candidate/policy hashes, pinned machine, release,
process/env/unit bindings, schema 85 and disabled checkout/signup/provider settings.
Abort on drift. Use a fresh exclusive intent/recovery directory at
`/var/lib/customer-access-releases/504191ccdc985084/`, backing up the current
`a19befc...` config. Validate the staged candidate, atomically replace Caddyfile
preserving root:root 0644, and restart only Caddy ONCE because `admin off` remains.
No Nuxt deployment, SQL change, automatic retry or automatic recovery is approved.

Verify parent GET/HEAD now reaches the existing anonymous 302 login guard with
private/no-store; primary API 401 and held route 403 responses must remain.
Then the owner tests `/account`, Messages, Support, After-Sales and Dashboard Store
Customers using the existing session. Do not enable `/login` or weaken Auth to
bypass an expired session. No order, provider transaction or attachment test.

ONE next owner action: approve this exact Caddy-only parent-page follow-up.
Existing Paymob/PDC activation work follows account acceptance; no rebuild.
