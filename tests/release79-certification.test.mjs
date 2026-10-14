import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,writeFile,unlink} from 'node:fs/promises'
import {join} from 'node:path'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {pathToFileURL} from 'node:url'
import {loadRelease79,release79ManifestHash,release79Artifact} from '../scripts/lib/release79Certification.mjs'
import {hash} from '../scripts/lib/cleanBaseline.mjs'
import {installerSourceCopy} from './helpers/installerPlatform.mjs'
const run=promisify(execFile)
test('release79 certificate preserves all prior SQL and certificate bytes and complete security catalogs',async()=>{
 // Validate the historical certificate in its exact supported SQL range.
 // The current candidate deliberately includes uncertified migration80.
 const f=await installerSourceCopy({release79:true})
 try{
 const historical=await import(pathToFileURL(join(f.directory,'scripts/lib/release79Certification.mjs')))
 const m=await historical.loadRelease79();assert.equal(hash(await readFile('supabase/bootstrap/release-79-v1/manifest.json')),release79ManifestHash)
 for(const row of m.migrations){const previous=await run('git',['show',m.application_checkpoint+':supabase/migrations/'+row.filename],{encoding:'buffer',maxBuffer:4*1024*1024});assert.equal(hash(previous.stdout),row.sha256,row.filename)}
 for(const directory of['clean-v1','portability-v1']){
  const files=(await run('git',['ls-tree','-r','--name-only',m.application_checkpoint,'supabase/bootstrap/'+directory])).stdout.trim().split('\n')
  for(const file of files){const previous=await run('git',['show',m.application_checkpoint+':'+file],{encoding:'buffer',maxBuffer:8*1024*1024});assert.equal(hash(await readFile(file)),hash(previous.stdout),file)}
 }
 const final=await release79Artifact(m,'schema-79.json')
 assert.equal(final.private.catalog_private.relations.filter(r=>r.kind==='r').length,6)
 assert.ok(final.privileges.triggers.some(r=>r.name==='zz_reset_compatibility_manifest'))
 assert.ok(final.privileges.storage_policies.some(r=>r.policyname==='after_sales_evidence_server_boundary'))
 }finally{await f.close()}
})
test('migration80 remains outside release79 authority and the current source fails certification closed',async()=>{
 await assert.rejects(loadRelease79,e=>e.code==='ERR_ASSERTION')
 const m=JSON.parse(await readFile('supabase/bootstrap/release-79-v1/manifest.json'))
 assert.equal(m.last_migration,79)
 assert.equal(m.migrations.length,79)
})
test('certified source rejects certificate, application and unknown-migration drift',async()=>{
 const f=await installerSourceCopy({release79:true})
 const commit=()=>run('git',['-c','user.name=Installer Fixture','-c','user.email=fixture@example.invalid','commit','-qam','Owned drift fixture'],{cwd:f.directory,env:f.env})
 try{
  const {frozenSource}=await import(pathToFileURL(join(f.directory,'scripts/install/contracts.mjs')))
  assert.equal((await frozenSource()).release.last_migration,79)
  for(const name of['supabase/bootstrap/release-79-v1/manifest.json','app/pages/index.vue']){
   const file=join(f.directory,name),before=await readFile(file);await writeFile(file,Buffer.concat([before,Buffer.from('\nOwned drift\n')]));await commit()
   await assert.rejects(frozenSource,e=>e.code==='source_changed');await writeFile(file,before);await commit()
  }
  const file=join(f.directory,'supabase/migrations/20261015000000_owned_unknown.sql');await writeFile(file,'select 1;\n');await run('git',['add',file],{cwd:f.directory,env:f.env});await commit()
  await assert.rejects(frozenSource,e=>e.code==='source_changed');await unlink(file);await commit()
  assert.equal((await frozenSource()).release.certificate_sha256,release79ManifestHash)
 }finally{await f.close()}
})
