import assert from 'node:assert/strict'
import {readFile,readdir} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {resolve} from 'node:path'
import {hash,json,verifyBundle} from './cleanBaseline.mjs'
import {normal79Files,release79ManifestHash,isApplicationInput} from './release79Certification.mjs'

export const release82Id='release-82-v1'
export const release82ManifestHash='f6a9d75166154f5c1c2bd91b306f7a61157857d5a5b41d6442f95fafa047eeae'
export const normal82Files=[...normal79Files,'20261014220000_packing_scan_authorization.sql','20261014230000_salary_payment_commands.sql','20261015000000_checkout_commands.sql']
export const release82Stages=normal82Files.slice(1).map((_,i)=>'migration'+(i+72))
const root=fileURLToPath(new URL('../../',import.meta.url)),directory=new URL('../../supabase/bootstrap/release-82-v1/',import.meta.url),historicalDirectory=new URL('../../supabase/bootstrap/release-79-v1/',import.meta.url)
export async function loadRelease82({sourceNames=null}={}){
 const raw=await readFile(new URL('manifest.json',directory));assert.equal(hash(raw),release82ManifestHash,'Unreviewed release certificate')
 const m=JSON.parse(raw);assert.equal(m.format,1);assert.equal(m.version,release82Id);assert.equal(m.last_migration,82)
 const historicalRaw=await readFile(new URL('manifest.json',historicalDirectory));assert.equal(hash(historicalRaw),release79ManifestHash);assert.equal(m.predecessor_certificate_sha256,release79ManifestHash)
 const previous=JSON.parse(historicalRaw),{inventory}=await verifyBundle()
 assert.deepEqual(m.migrations.slice(0,70).map(({ordinal,...r})=>r),inventory)
 assert.deepEqual(m.migrations.slice(0,79),previous.migrations);assert.deepEqual(m.history.slice(0,79),previous.history)
 assert.deepEqual(m.migrations.slice(70).map(r=>r.filename),normal82Files)
 assert.equal(hash(await readFile(new URL('../../supabase/bootstrap/clean-v1/manifest.json',import.meta.url))),m.baseline_manifest_sha256)
 assert.equal(hash(await readFile(new URL('../../supabase/bootstrap/portability-v1/manifest.json',import.meta.url))),m.portability_manifest_sha256)
 assert.deepEqual((await readdir(new URL('../../supabase/migrations/',import.meta.url))).filter(n=>n.endsWith('.sql')).sort(),m.migrations.map(r=>r.filename))
 for(const row of m.migrations)assert.equal(hash(await readFile(resolve(root,'supabase/migrations',row.filename))),row.sha256)
 for(const [name,h]of Object.entries(previous.artifacts)){assert.match(name,/^schema-7[1-9]\.json$/);assert.equal(hash(await readFile(new URL(name,historicalDirectory))),h);assert.equal(m.schema_stages[name.slice(7,-5)],h)}
 assert.deepEqual(Object.keys(m.artifacts).sort(),['schema-80.json','schema-81.json','schema-82.json'])
 for(const [name,h]of Object.entries(m.artifacts)){assert.equal(hash(await readFile(new URL(name,directory))),h);assert.equal(m.schema_stages[name.slice(7,-5)],h)}
 if(sourceNames){assert.deepEqual(sourceNames.filter(isApplicationInput).sort(),Object.keys(m.application_inputs).sort());for(const [name,h]of Object.entries(m.application_inputs))assert.equal(hash(await readFile(resolve(root,name))),h)}
 return m
}
export const release82Descriptor=m=>({id:release82Id,certificate_sha256:release82ManifestHash,application_checkpoint:m.application_checkpoint,application_inputs_sha256:hash(json(m.application_inputs)),normal_migrations:m.migrations.slice(70).map(({version,filename,sha256})=>({version,filename,sha256})),last_migration:82})
export function assertRelease82Source(source){
 assert.equal(source?.release?.id,release82Id);assert.equal(source.release.certificate_sha256,release82ManifestHash);assert.equal(source.release.last_migration,82)
 assert.deepEqual(source.release.normal_migrations?.map(r=>r.filename),normal82Files)
}
export async function release82Artifact(m,name){
 assert.match(name,/^schema-(7[1-9]|8[0-2])\.json$/)
 const raw=await readFile(new URL(name,Number(name.slice(7,-5))<=79?historicalDirectory:directory));assert.equal(hash(raw),m.schema_stages[name.slice(7,-5)]);return JSON.parse(raw)
}
