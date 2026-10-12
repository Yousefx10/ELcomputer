import assert from 'node:assert/strict'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { createCleanBaselineLab } from '../tests/helpers/cleanBaselineLab.mjs'
import { applyCandidate, adoptLaboratoryHistory, migrationInventory, catalog, assertCatalogEquivalent, hash, json } from './lib/cleanBaseline.mjs'
import { privateInstallationCatalog } from './lib/installationCertification.mjs'

// Owned compiler only, separate from the immutable source-70 clean-v1 bundle.
if(process.argv.slice(2).some(arg=>arg!=='--write'))throw Error('Only --write is supported; no remote target is accepted.')
const directory=new URL('../supabase/bootstrap/portability-v1/',import.meta.url),name='20261012160000_quick_setup_installation_bootstrap.sql'
const migration=await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'),inventory=await migrationInventory(),lab=await createCleanBaselineLab()
try{
 await lab.source.exec(migration)
 await applyCandidate(lab.candidate);await adoptLaboratoryHistory(lab)
 await lab.cli(['db','push','--yes'],[...inventory.map(row=>row.filename),name])
 const publicCatalog=await catalog(lab.candidate),privateCatalog=await privateInstallationCatalog(lab.candidate)
 assertCatalogEquivalent(publicCatalog,await catalog(lab.source))
 assert.deepEqual(privateCatalog,await privateInstallationCatalog(lab.source))
 const artifacts={'expected-private-schema.json':json(privateCatalog)}
 const manifest={format:1,version:'portability-v1',base:'clean-v1',base_manifest_sha256:hash(await readFile(new URL('../supabase/bootstrap/clean-v1/manifest.json',import.meta.url))),input_commit:'4928dc7e636f8f96dda739401f29767b5e1263df',migration:{filename:name,version:name.split('_')[0],sha256:hash(migration)},expected_public_catalog_sha256:hash(json(publicCatalog)),artifacts:Object.fromEntries(Object.entries(artifacts).map(([file,content])=>[file,hash(content)])),private_runtime_access:'No schema/table/function rights for anon, authenticated or service_role',first_owner_authority:'Direct non-superuser postgres operator; no remote route',hosted_acceptance:'pending Milestone 3; Auth Admin transport contract fixtures only'}
 artifacts['manifest.json']=json(manifest)
 if(process.argv.includes('--write')){await mkdir(directory,{recursive:true});for(const[file,content]of Object.entries(artifacts))await writeFile(new URL(file,directory),content)}
 else for(const[file,content]of Object.entries(artifacts))assert.equal(await readFile(new URL(file,directory),'utf8'),content,'Follow-on artifact drift: '+file)
 console.log(json({result:'pass',manifest,public_counts:Object.fromEntries(Object.entries(publicCatalog).map(([key,rows])=>[key,rows.length]))}))
}finally{await lab.close()}
