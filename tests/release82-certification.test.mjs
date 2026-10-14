import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,writeFile,unlink,mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {pathToFileURL} from 'node:url'
import {loadRelease82,release82Artifact,release82ManifestHash} from '../scripts/lib/release82Certification.mjs'
import {hash} from '../scripts/lib/cleanBaseline.mjs'
import {installerSourceCopy} from './helpers/installerPlatform.mjs'
const run=promisify(execFile),baseline='084058e127f7964bf2ab2953f595f9abb9f1f521'
test('release82 independently binds unchanged historical SQL/certificates and all corrected application inputs',async()=>{
 const m=await loadRelease82();assert.equal(m.migrations.length,82);assert.equal(m.last_migration,82);assert.equal(m.application_checkpoint,baseline);assert.equal(Object.keys(m.application_inputs).length,597)
 const names=(await run('git',['ls-tree','-r','--name-only',baseline,'supabase/bootstrap','supabase/migrations'])).stdout.trim().split('\n')
 for(const name of names){const previous=await run('git',['show',baseline+':'+name],{encoding:'buffer',maxBuffer:8*1024*1024});assert.equal(hash(await readFile(name)),hash(previous.stdout),name)}
 const final=await release82Artifact(m,'schema-82.json')
 assert.ok(final.private.private.relations.some(r=>r.name==='salary_payment_commands'&&r.rls))
 for(const name of ['checkout_quotes','checkout_commands'])assert.ok(final.private.private.relations.some(r=>r.name===name&&r.rls))
 assert.ok(final.public.functions.some(r=>JSON.stringify(r).includes('validate_order_packing_scan')&&JSON.stringify(r).includes('SECURITY DEFINER')))
 assert.equal(hash(await readFile('supabase/bootstrap/release-82-v1/manifest.json')),release82ManifestHash)
})
test('release82 source rejects dirty/linked checkouts, committed drift and reduction to uncertified71 authority',async()=>{
 const f=await installerSourceCopy({release82:true})
 const commit=async()=>{await run('git',['add','-A'],{cwd:f.directory,env:f.env});await run('git',['-c','user.name=Installer Fixture','-c','user.email=fixture@example.invalid','commit','-qm','Owned drift fixture'],{cwd:f.directory,env:f.env})}
 try{
  const {frozenSource}=await import(pathToFileURL(join(f.directory,'scripts/install/contracts.mjs')))
  const original=await frozenSource();assert.equal(original.release.last_migration,82)
  for(const name of ['supabase/bootstrap/release-82-v1/manifest.json','supabase/bootstrap/release-79-v1/manifest.json','app/pages/index.vue','supabase/migrations/20261015000000_checkout_commands.sql']){
   const file=join(f.directory,name),before=await readFile(file);await writeFile(file,Buffer.concat([before,Buffer.from('\nOwned drift\n')]))
   await assert.rejects(frozenSource,e=>e.code==='source_changed');await commit();await assert.rejects(frozenSource,e=>e.code==='source_changed')
   await writeFile(file,before);await commit()
  }
  const unknown=join(f.directory,'supabase/migrations/20261016000000_owned_unknown.sql');await writeFile(unknown,'select 1;\n');await commit();await assert.rejects(frozenSource,e=>e.code==='source_changed');await unlink(unknown);await commit()
  const removed=[]
  for(const row of (await loadRelease82()).migrations.slice(71)){
   const file=join(f.directory,'supabase/migrations',row.filename);removed.push([file,await readFile(file)]);await unlink(file)
  }
  await commit();await assert.rejects(frozenSource,e=>e.code==='source_changed','Reducing to71 must not accept the current82 application')
  for(const [file,bytes]of removed)await writeFile(file,bytes)
  await commit()
  const link=join(f.directory,'supabase/.temp');await mkdir(link);await writeFile(join(link,'project-ref'),'owned-fixture-only');await assert.rejects(frozenSource,e=>e.code==='source_changed');await unlink(join(link,'project-ref'))
  assert.equal((await frozenSource()).release.certificate_sha256,release82ManifestHash)
 }finally{await f.close()}
})
