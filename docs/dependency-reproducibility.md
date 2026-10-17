# Reproducible application builds

The application-only Procurement candidate is validated with Node **22.23.1**
and its bundled npm **10.9.8**. Use this exact pair for this release review.
No new application setting or package-manager flag is required.

```sh
node --version  # v22.23.1
npm --version   # 10.9.8
npm ci --no-audit --no-fund
npm run typecheck
npm run build
```

Run installation in a clean, isolated source checkout without an existing
`node_modules` directory. Keep dependency lifecycle scripts enabled. Build with
an empty dotenv and an explicit environment; never copy deployment credentials
into the build source or output. Existing runtime configuration supplies each
business's site URL, backend and public key. Private keys stay in its existing
protected runtime environment.

## Lockfile correction

npm 10.9.8 rejected the previous lock during `npm ci` ideal-tree validation.
`@nuxtjs/i18n@10.6.0` contains `@nuxt/kit@4.5.2`, whose `unctx@3.0.1` declares
optional peer `rolldown ^1.1.5`. Existing root Rolldown 1.1.3 cannot satisfy it.
Root Vite 8.1.0 requires Rolldown `~1.1.2`, so upgrading that existing root package
would change another dependency contract.

Using each npm version's actual Arborist resolver, npm 10.9.8 requires 17 missing
lock entries; npm 11.13.0 accepts the original tree unchanged. The original
lockfile's generating npm version is not established. This is a reproducible
optional-peer resolution difference, not evidence that the missing package is
a new direct application dependency.

The repair adds only npm 10-generated closure entries: nested Rolldown 1.2.14,
its nested `@oxc-project/types` 0.154.0 and 15 optional native binding entries.
Every existing package record, version, integrity and platform constraint stays
identical. In particular, preserve the existing Linux `libc` metadata that the
npm 10 lock writer would otherwise remove. `package.json` is unchanged.

Both independent clean installs use lifecycle scripts and produce identical
installed dependency inventories. The repaired lock produces an unchanged npm
10 ideal tree and stays byte-identical after `npm ci`. No force, legacy-peer,
manager-switch or broad dependency-upgrade workaround is permitted.

## Release authority and platform limits

This is a separately identified application correction on schema 82. Original
Release 82 application certificates remain immutable. A current corrected source
must fail their unchanged-application guard; do not regenerate certificates or
weaken that guard to certify this candidate. Validate historical source guards
against the preserved certified source, and bind the corrected candidate to its
own commit, application input manifest, output inventory and archive hash.

A macOS build is not hosted Linux acceptance. The existing output inventory
rejects native executable/library payloads and escaping links; the deployment
must still run the exact sealed candidate privately under the target Node runtime
before switching the existing service. Preserve the prior hashed client assets
for open clients and the exact old release for separately reviewed rollback.
No fresh-install installer or migration operation belongs to this application
release. See [Procurement validation](procurement-product-options.md).

For this candidate, supply verified retained immutable client assets before the
stock Nuxt build, so Nitro includes them in its static manifest. Keep the current
mutable build pointer. Normalize generated output permissions without changing
bytes, then apply the existing strict inventory checks. These are local packaging
steps; they introduce no runtime configuration or application behavior changes.

The recorded broad run is not entirely green: 1,002 pass, one original-certificate
context failure, 12 cancelled mock timeout cases and 38 optional native skips.
Original guards pass against their original source and reject the correction;
the unchanged transport cases pass with an active local test handle. Unavailable
managed-platform cases and actual hosted acceptance remain explicitly unverified.
