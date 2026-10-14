import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,writeFile,mkdir,cp,readdir} from 'node:fs/promises'
import {join} from 'node:path'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {pathToFileURL} from 'node:url'
import {installerSourceCopy,createInstallerPlatform,installerNativeAvailable,installerEnvironment} from './helpers/installerPlatform.mjs'
import {loadRelease82,release82Artifact,normal82Files} from '../scripts/lib/release82Certification.mjs'
import {releaseApplicationCatalog} from '../scripts/lib/release79Certification.mjs'
import {hash,json} from '../scripts/lib/cleanBaseline.mjs'
const run=promisify(execFile)
test('genuine unchanged release79 upgrades only by normal80–82 pushes; historical receipts/seal/history stay immutable',{skip:!installerNativeAvailable,timeout:300000},async t=>{
 let source,lab,current
 try{
  source=await installerSourceCopy({release79:true});lab=await createInstallerPlatform({siteOrigin:'https://upgrade82.example.invalid'})
  const directory=join(lab.directory,'historical-installation'),plan=await source.cli(['plan','--target',lab.targetFile,'--out',directory,'--credentials-file',lab.credentialsFile]);assert.equal(plan.code,0,JSON.stringify(plan.result))
  const installed=await source.cli(['apply','--plan',join(directory,'plan.json'),'--credentials-file',lab.credentialsFile,'--owner-file',lab.ownerFile,'--confirm',plan.result.confirmation]);assert.equal(installed.code,0,JSON.stringify(installed.result))
  assert.equal((await source.cli(['verify','--plan',join(directory,'plan.json'),'--credentials-file',lab.credentialsFile])).code,0)
  const receipt=JSON.parse(await readFile(join(directory,'receipt.json')));assert.equal(receipt.format,2);assert.equal(receipt.last_migration,79)
  const history=(await lab.db.query('select version,name,statements from supabase_migrations.schema_migrations order by version')).rows,seal=(await lab.db.query('select to_jsonb(t) value from private.installation_bootstrap t')).rows[0].value
  const originals={};for(const name of (await readdir(directory)).filter(n=>n.endsWith('.json')))originals[name]=hash(await readFile(join(directory,name)))
  const manifest=await loadRelease82(),staging=join(lab.directory,'upgrade'),migrations=join(staging,'supabase/migrations');await mkdir(migrations,{recursive:true,mode:0o700});await cp(join(source.directory,'supabase/migrations'),migrations,{recursive:true});await writeFile(join(staging,'supabase/config.toml'),'project_id = "owned-upgrade82"\n',{mode:0o600})
  const pass=join(staging,'database.pgpass'),escape=v=>String(v).replaceAll('\\','\\\\').replaceAll(':','\\:');await writeFile(pass,['127.0.0.1',lab.target.database.port,'postgres','postgres',lab.credentials.database_password].map(escape).join(':')+'\n',{mode:0o600})
  const url=new URL('postgresql://postgres@127.0.0.1:'+lab.target.database.port+'/postgres');url.searchParams.set('sslmode','verify-full');url.searchParams.set('sslrootcert',lab.target.database.ca_file)
  for(const [i,name]of normal82Files.slice(9).entries())await t.test('normal migration'+(i+80)+' commits once with exact catalog and no baseline adoption',async()=>{
   await cp('supabase/migrations/'+name,join(migrations,name))
   await run('node_modules/@supabase/cli-darwin-x64/bin/supabase',['--workdir',staging,'--agent','no','db','push','--yes','--db-url',url.href],{cwd:process.cwd(),env:{...installerEnvironment,PGPASSFILE:pass},maxBuffer:2*1024*1024,timeout:90000})
   const rows=(await lab.db.query('select version,name,statements from supabase_migrations.schema_migrations order by version')).rows
   assert.equal(rows.length,i+80);assert.deepEqual(rows.slice(0,79),history)
   for(const row of rows){const expected=manifest.history.find(r=>r.version===row.version);assert.equal(row.name,expected.name);assert.equal(hash(json(row.statements)),expected.statements_sha256)}
   assert.deepEqual(await releaseApplicationCatalog(lab.db),await release82Artifact(manifest,'schema-'+(i+80)+'.json'))
   assert.deepEqual((await lab.db.query('select to_jsonb(t) value from private.installation_bootstrap t')).rows[0].value,seal)
  })
  for(const [name,h]of Object.entries(originals))assert.equal(hash(await readFile(join(directory,name))),h)
  assert.equal((await lab.db.query('select count(*)::int n from auth.users')).rows[0].n,1)
  assert.equal(lab.requests.filter(r=>r.method==='POST'&&r.path==='/auth/v1/admin/users').length,1)
  current=await installerSourceCopy({release82:true})
  const refused=await current.cli(['plan','--target',lab.targetFile,'--out',join(lab.directory,'forbidden-fresh-adoption'),'--credentials-file',lab.credentialsFile]);assert.notEqual(refused.code,0);assert.equal(refused.result.code,'target_occupied')
  assert.equal((await lab.db.query('select count(*)::int n from supabase_migrations.schema_migrations')).rows[0].n,82)
  // A saved79 receipt is evidence of79, never a fabricated fresh82 receipt.
  assert.equal(JSON.parse(await readFile(join(directory,'receipt.json'))).last_migration,79)
 }finally{await current?.close();await lab?.close();await source?.close()}
})
