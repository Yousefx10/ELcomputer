import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createCleanBaselineLab } from '../tests/helpers/cleanBaselineLab.mjs'
import { sourceCommit, inventoryHash, backupHash, baselineDirectory, migrationInventory, catalog, assertCatalogEquivalent, permissions, cleanSeeds, managedHooks, freshGuard, bucketManifest, hash, json, writeArtifacts, applyCandidate, assertPermissionMatrix, verifyCleanData } from './lib/cleanBaseline.mjs'

// Owned local laboratory compiler only. No connection/target arguments exist.
if (process.argv.slice(2).some(arg => arg !== '--write')) throw Error('Only --write is supported; remote targets are forbidden.')
const inventory = await migrationInventory()
const lab = await createCleanBaselineLab()
try {
  assert.deepEqual(lab.executed,inventory.map(e=>e.filename),'Every covered migration must execute in the source reconstruction.')
  const schema = await catalog(lab.source)
  const acl = await permissions(lab.source, schema)
  const seeds = await cleanSeeds(lab.source)
  const artifacts = {
    'schema.sql': freshGuard + await lab.dump() + await managedHooks(lab.source,schema),
    'permissions.sql': acl.sql, 'clean-seeds.sql': seeds.sql,
    'expected-schema.json': json(schema), 'permissions-manifest.json': json(acl.matrix),
    'seed-manifest.json': json(seeds.manifest), 'storage.json': json(await bucketManifest(lab.source)),
    'covered-migrations.json': json(inventory)
  }
  const manifest = { format: 1, baseline: 'clean-v1', source_commit: sourceCommit, migration_inventory_sha256: inventoryHash, source_schema_sha256: backupHash, checkpoint: inventory.at(-1).version, covered_versions: 70, cli_version: '2.109.1', database_profile: 'PostgreSQL 17; actual Supautils policy delegation; modern no-default-table-grants', managed_platform_proof: 'Native contract fixtures; hosted/full-stack acceptance remains pending', status: 'local-foundation; requires Milestone 2 before merchant installation', artifacts: Object.fromEntries(Object.entries(artifacts).map(([name,content]) => [name,hash(content)])), known_dependencies: ['Nullable unconfigured PDC singleton in migration 71','Portable Claims origin and neutral application fallbacks','Trusted owner bootstrap and journal','Guarded remote installer and publication','Separately authorized hosted Auth/Storage/Realtime acceptance'] }
  if (process.argv.includes('--write')) await writeArtifacts({ ...artifacts, 'manifest.json': json(manifest) })
  else for (const [name,content] of Object.entries({ ...artifacts, 'manifest.json': json(manifest) })) assert.equal(await readFile(new URL(name,baselineDirectory),'utf8'), content, 'Non-reproducible artifact: '+name)
  await applyCandidate(lab.candidate)
  const differences=assertCatalogEquivalent(await catalog(lab.candidate), schema)
  await assertPermissionMatrix(lab.candidate, acl.matrix)
  const clean = await verifyCleanData(lab.candidate)
  console.log(json({ result: 'pass', source_commit: sourceCommit, covered_versions: 70, artifact_hashes: manifest.artifacts, object_counts: Object.fromEntries(Object.entries(schema).map(([key,value]) => [key,value.length])), reviewed_constraint_normalization: differences, reviewed_acl_differences: acl.matrix.differences.length, populated_initial_tables: Object.entries(clean.counts).filter(([,n]) => n>0), hosted_acceptance: 'pending' }))
} finally { await lab.close() }
