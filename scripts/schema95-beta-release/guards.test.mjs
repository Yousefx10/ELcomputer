import test from 'node:test'
import assert from 'node:assert/strict'
import { assertPlan, scope } from './operator.mjs'
import { digest, migrationHash } from './database.mjs'
const now = Date.now()
const valid = () => ({ format: 95, schema_version: 95, scope, migrations: ['20261026170000'], database_writes: 'one_additive_migration_only', migration_sha256: migrationHash, archive_sha256: '81becf54218a8e144137f2bdce7df1eed6bcc07745924c0167fcd7435aae37ff', release_id: '81becf54218a8e14', application_commit: 'b37be43ac6a24a663a12a5a56aaaa7e801827963', provider_requests: 0, nuxt_restarts_max: 1, automatic_retry: false, automatic_rollback: false, git_push: false, public_signup_activation: false, public_purchase_activation: false, production_payment: false, business_configuration_changes: false, backup_verified_utc: new Date(now).toISOString(), backup_proof: { database: { pg_restore_full_readback: 'PASS' }, runtime: { full_byte_readback: true } } })
const seal = p => ({ ...p, seal: digest(p) })
test('unchanged95 inactive deployment scope accepts fresh verified recovery', () => assert.doesNotThrow(() => assertPlan(seal(valid()), now)))
for (const [name, change] of [
  ['schema96 substitution', { schema_version: 96 }], ['extra migration', { migrations: ['20261026170000', '20261026230000'] }],
  ['archive substitution', { archive_sha256: '0'.repeat(64) }], ['wrong source baseline', { application_commit: '88747c8' }],
  ['purchasing activation', { public_purchase_activation: true }], ['Auth toggle', { public_signup_activation: true }],
  ['business configuration mutation', { business_configuration_changes: true }], ['live payment', { production_payment: true }],
  ['PDC/provider request', { provider_requests: 1 }], ['second restart', { nuxt_restarts_max: 2 }],
  ['automatic retry', { automatic_retry: true }], ['automatic rollback', { automatic_rollback: true }], ['Git push', { git_push: true }],
  ['expired recovery', { backup_verified_utc: new Date(now - 6 * 3600000 - 1).toISOString() }],
  ['future recovery', { backup_verified_utc: new Date(now + 1).toISOString() }],
  ['unverified backup', { backup_proof: { database: { pg_restore_full_readback: 'NO' }, runtime: { full_byte_readback: true } } }]
]) test('rejects ' + name + ' even with a matching new hash', () => assert.throws(() => assertPlan(seal({ ...valid(), ...change }), now)))
test('rejects post-seal mutation', () => { const p = seal(valid()); p.public_purchase_activation = true; assert.throws(() => assertPlan(p, now)) })
