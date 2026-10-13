import test from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { dirname, join } from 'node:path'
import { mkdtemp, realpath, chmod, writeFile, rm, lstat } from 'node:fs/promises'
const run=promisify(execFile),env={PATH:dirname(process.execPath)+':/usr/bin:/bin',LANG:'C'}
async function cli(args,extra={}){try{await run(process.execPath,['scripts/elcomputer-setup.mjs',...args],{env:{...env,...extra}});assert.fail('Rejected command succeeded')}catch(error){assert.equal(error.code,1);return error.stdout}}
test('guided CLI rejects force, unknown, duplicate and misplaced confirmation options before file access',async()=>{
  for(const args of[['reset'],['apply','--workspace','/missing','--force','yes'],['check','--workspace','/missing','--confirm-database','wrong'],['plan','--manifest','/missing','--out','/missing','--out','/other'],['apply','--workspace']])assert.equal(JSON.parse(await cli(args)).code,'invalid_input')
})
test('guided CLI rejects ambient credentials without displaying their values',async()=>{
  const secret='CONTROLLED-DISPOSABLE-SECRET-CANARY'
  const output=await cli(['check','--workspace','/missing'],{SUPABASE_SERVICE_ROLE_KEY:secret})
  assert.equal(JSON.parse(output).code,'ambient_credentials');assert.ok(!output.includes(secret))
})
test('a missing mandatory additional policy prevents workspace creation and target/credential access',async()=>{
  const root=await realpath(await mkdtemp('/tmp/elcomputer-guided-cli-'));await chmod(root,0o700)
  try{
    const manifest={format:1,database_target_file:join(root,'never-read-database.json'),publication_target_file:join(root,'never-read-vps.json'),legacy_registry_file:join(root,'never-read-registry.json'),reservation_policy_file:join(root,'missing-policy.json'),credentials_file:join(root,'never-read-credentials.json'),owner_file:join(root,'never-read-owner.json'),key_record_directory:join(root,'keys'),locale:'en'}
    const file=join(root,'manifest.json'),out=join(root,'workspace');await writeFile(file,JSON.stringify(manifest),{mode:0o600})
    assert.equal(JSON.parse(await cli(['plan','--manifest',file,'--out',out])).code,'unsafe_file')
    await assert.rejects(()=>lstat(out),error=>error.code==='ENOENT')
  }finally{await rm(root,{recursive:true,force:true})}
})
