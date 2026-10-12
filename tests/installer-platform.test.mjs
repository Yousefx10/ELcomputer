import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, writeFile, readdir, chmod } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { installerSourceCopy, createInstallerPlatform, installerNativeAvailable } from './helpers/installerPlatform.mjs'
import { writeAtomic } from '../scripts/install/files.mjs'

test('guarded installer on actual TLS PostgreSQL, Supautils, Auth, Storage and PostgREST', {skip:!installerNativeAvailable,timeout:600000},async t=>{
  const source=await installerSourceCopy()
  const workflow=await import(pathToFileURL(join(source.directory,'scripts/install/workflow.mjs')))
  const {connectPlatform}=await import(pathToFileURL(join(source.directory,'scripts/install/platform.mjs')))
  const fixtures=[]
  async function fresh(){
    for(const previous of fixtures.splice(0))await previous.close()
    const lab=await createInstallerPlatform();fixtures.push(lab)
    const directory=join(lab.directory,'installation'),args=['--plan',join(directory,'plan.json'),'--credentials-file',lab.credentialsFile]
    const planned=await source.cli(['plan','--target',lab.targetFile,'--out',directory,'--credentials-file',lab.credentialsFile])
    assert.equal(planned.code,0,JSON.stringify(planned.result))
    const plan=JSON.parse(await readFile(join(directory,'plan.json')))
    const invoke=(command,extra=[])=>source.cli([command,...args,...extra])
    const options={plan,directory,credentials:lab.credentials,owner:lab.owner,confirm:planned.result.confirmation}
    return {lab,directory,plan,invoke,options,apply:()=>invoke('apply',['--confirm',options.confirm,'--owner-file',lab.ownerFile]),resume:()=>invoke('resume',['--confirm',options.confirm,'--owner-file',lab.ownerFile])}
  }
  const faultFactory=transform=>async(...args)=>{const platform=await connectPlatform(...args);transform(platform);return platform}
  const evidence=async(f,name)=>{if(process.env.INSTALLER_REVIEW_EVIDENCE)await writeAtomic(process.env.INSTALLER_REVIEW_EVIDENCE,name+'-receipt.json',JSON.parse(await readFile(join(f.directory,'receipt.json'))))}
  const uncertain=error=>['stage_uncertain','bootstrap_uncertain'].includes(error.code)
  try{
    await t.test('all five commands, exact history, six private buckets, owner access and sealed second run',async()=>{
      const f=await fresh(),{lab}=f
      const before=(await lab.db.query("select count(*)::int n from pg_class where relnamespace='public'::regnamespace")).rows[0].n
      assert.equal(before,0);assert.equal((await f.invoke('check')).code,0)
      lab.loseResponse('POST','/auth/v1/admin/users')
      const applied=await f.apply();assert.equal(applied.code,0,JSON.stringify(applied.result));assert.equal(applied.result.bootstrap_sealed,true)
      assert.equal((await f.invoke('verify')).code,0)
      await evidence(f,'complete')
      assert.equal((await f.resume()).code,0)
      assert.equal((await f.apply()).result.code,'installation_complete')
      assert.equal((await lab.db.query('select count(*)::int n from supabase_migrations.schema_migrations')).rows[0].n,71)
      assert.equal((await lab.db.query('select count(*)::int n from storage.buckets where not public')).rows[0].n,6)
      assert.equal((await lab.db.query('select count(*)::int n from storage.objects')).rows[0].n,0)
      for(const table of ['products','categories','brands','customer_orders','chat_conversations','support_tickets'])assert.equal((await lab.db.query('select count(*)::int n from public.'+table)).rows[0].n,0)
      assert.equal(lab.requests.filter(r=>r.method==='POST'&&r.path==='/auth/v1/admin/users').length,1)
      const p=await connectPlatform(lab.target,lab.credentials)
      try{
        const client=createClient(lab.target.api_url,lab.credentials.anon_key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:p.transport}})
        const signed=await client.auth.signInWithPassword({email:lab.owner.email,password:lab.owner.password});assert.equal(signed.error,null)
        const owners=await client.from('admin_users').select('id,role,is_active');assert.equal(owners.error,null);assert.equal(owners.data.length,1);assert.equal(owners.data[0].role,'owner')
        const anonymous=await p.anon.from('admin_users').select('id');assert.ok(anonymous.error||anonymous.data.length===0)
        const privateRpc=await client.rpc('installation_link_owner');assert.ok(privateRpc.error)
        const outsiderEmail='outsider@'+lab.target.project_ref+'.example.invalid'
        const outsider=await p.client.auth.admin.createUser({email:outsiderEmail,password:lab.owner.password,email_confirm:true});assert.equal(outsider.error,null)
        const other=createClient(lab.target.api_url,lab.credentials.anon_key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:p.transport}})
        assert.equal((await other.auth.signInWithPassword({email:outsiderEmail,password:lab.owner.password})).error,null)
        const forbidden=await other.from('admin_users').select('id');assert.ok(forbidden.error||forbidden.data.length===0)
        assert.ok((await other.rpc('installation_link_owner')).error)
        assert.equal((await p.client.auth.admin.deleteUser(outsider.data.user.id)).error,null)
        const denied=await client.storage.from('admin-documents').upload('owned-denied.txt',Buffer.from('denied direct browser write'),{contentType:'text/plain'});assert.ok(denied.error)
        const uploaded=await p.client.storage.from('admin-documents').upload('owned-proof.txt',Buffer.from('owned disposable storage proof'),{contentType:'text/plain'});assert.equal(uploaded.error,null)
        const listed=await p.client.storage.from('admin-documents').list();assert.equal(listed.error,null);assert.equal(listed.data.length,1)
        const removed=await p.client.storage.from('admin-documents').remove(['owned-proof.txt']);assert.equal(removed.error,null)
      }finally{await p.close()}
      assert.equal((await f.invoke('verify')).code,0)
      for(const name of (await readdir(f.directory)).filter(n=>n.endsWith('.json'))){const text=await readFile(join(f.directory,name),'utf8');for(const secret of [lab.credentials.database_password,lab.credentials.anon_key,lab.credentials.service_role_key,lab.owner.email,lab.owner.password])assert.ok(!text.includes(secret),'Secret absent from '+name)}
      const writes=lab.requests.filter(r=>r.method==='POST'&&r.path==='/auth/v1/admin/users').length
      await lab.db.query('update public.admin_users set is_active=false')
      assert.equal((await f.resume()).result.code,'owner_unavailable');assert.equal((await lab.db.query('select phase from private.installation_bootstrap')).rows[0].phase,'complete')
      assert.equal(lab.requests.filter(r=>r.method==='POST'&&r.path==='/auth/v1/admin/users').length,writes)
    })
    await t.test('mismatched credentials, TLS, confirmation, linked source and occupied targets stop before writes',async()=>{
      const f=await fresh(),{lab}=f
      assert.equal((await f.invoke('apply',['--confirm','wrong','--owner-file',lab.ownerFile])).result.code,'confirmation_required')
      assert.equal((await source.cli(['check','--plan',join(f.directory,'plan.json'),'--credentials-file',lab.credentialsFile],{env:{SUPABASE_ACCESS_TOKEN:'AMBIENT-SECRET-CANARY'}})).result.code,'ambient_credentials')
      const wrong=join(lab.directory,'wrong.json');await writeFile(wrong,JSON.stringify({...lab.credentials,project_ref:'xxxxxxxxxxxxxxxxxxxx'}),{mode:0o600})
      assert.equal((await source.cli(['apply','--plan',join(f.directory,'plan.json'),'--credentials-file',wrong,'--confirm',f.options.confirm,'--owner-file',lab.ownerFile])).result.code,'target_changed')
      await writeFile(wrong,JSON.stringify({...lab.credentials,database_password:'WRONG-DATABASE-CANARY'}),{mode:0o600})
      assert.equal((await source.cli(['check','--plan',join(f.directory,'plan.json'),'--credentials-file',wrong])).result.code,'platform_unavailable')
      const parts=lab.credentials.service_role_key.split('.');parts[2]='x'.repeat(parts[2].length)
      await writeFile(wrong,JSON.stringify({...lab.credentials,service_role_key:parts.join('.')}),{mode:0o600})
      assert.equal((await source.cli(['check','--plan',join(f.directory,'plan.json'),'--credentials-file',wrong])).result.code,'platform_unavailable')
      const tlsTarget=join(lab.directory,'untrusted.json');await writeFile(tlsTarget,JSON.stringify({...lab.target,database:{...lab.target.database,ca_file:join(lab.directory,'server.pem')}}),{mode:0o600})
      assert.equal((await source.cli(['plan','--target',tlsTarget,'--out',join(lab.directory,'untrusted-plan'),'--credentials-file',lab.credentialsFile])).result.code,'platform_unavailable')
      await chmod(lab.ownerFile,0o644);assert.equal((await f.apply()).result.code,'unsafe_file');await chmod(lab.ownerFile,0o600)
      const linked=join(source.directory,'supabase/.temp');const {mkdir,rm}=await import('node:fs/promises');await mkdir(linked,{recursive:true});await writeFile(join(linked,'project-ref'),'UNREVIEWED-LINK')
      assert.equal((await f.invoke('check')).result.code,'source_changed');await rm(linked,{recursive:true,force:true})
      await lab.db.query('create table public.unexpected(id int)')
      assert.equal((await f.apply()).result.code,'target_occupied')
      assert.equal((await lab.db.query("select to_regnamespace('supabase_migrations') n")).rows[0].n,null)
      assert.equal(lab.requests.filter(r=>r.method==='POST').length,0)
    })
    await t.test('separate workspaces and installation IDs cannot bypass database session locks',async()=>{
      const f=await fresh(),held=await connectPlatform(f.lab.target,f.lab.credentials,{mutating:true})
      try{assert.equal((await f.apply()).result.code,'lock_busy');assert.equal((await f.invoke('check')).result.code,'lock_busy')}finally{await held.close()}
      assert.equal((await f.apply()).code,0)
      await evidence(f,'independent')
      const other={...f.lab.target,installation_id:randomUUID()},file=join(f.lab.directory,'other-target.json');await writeFile(file,JSON.stringify(other),{mode:0o600})
      assert.equal((await source.cli(['plan','--target',file,'--out',join(f.lab.directory,'second-install'),'--credentials-file',f.lab.credentialsFile])).result.code,'target_occupied')
    })
    for(const fault of ['baseline_rollback','baseline_commit_ack','partial_history','migration71_ack','bucket_ack','owner_link'])await t.test('exact resume after '+fault,async()=>{
      const f=await fresh();let fired=false
      const factory=faultFactory(p=>{
        const query=p.db.query.bind(p.db),cli=p.cli.bind(p),createBucket=p.client.storage.createBucket.bind(p.client.storage)
        p.db.query=async(...args)=>{
          const sql=String(args[0])
          if(!fired&&fault==='baseline_rollback'&&sql.includes('-- Explicit per-object permissions.')){fired=true;throw Error('owned interrupted transaction')}
          if(!fired&&fault==='owner_link'&&sql.includes('private.installation_link_owner')){fired=true;throw Error('owned interrupted promotion')}
          const result=await query(...args)
          if(!fired&&fault==='baseline_commit_ack'&&sql==='COMMIT'){fired=true;throw Error('owned lost commit acknowledgement')}
          return result
        }
        p.cli=async(workspace,inventory,options)=>{
          if(!fired&&fault==='partial_history'&&options.repairVersions){fired=true;await cli(workspace,inventory,{...options,repairVersions:options.repairVersions.slice(0,5)});throw Error('owned interrupted history')}
          await cli(workspace,inventory,options)
          if(!fired&&fault==='migration71_ack'&&!options.repairVersions){fired=true;throw Error('owned lost migration acknowledgement')}
        }
        p.client.storage.createBucket=async(...args)=>{const result=await createBucket(...args);if(!fired&&fault==='bucket_ack'){fired=true;throw Error('owned lost bucket acknowledgement')}return result}
      })
      await assert.rejects(()=>workflow.executeInstallation({command:'apply',...f.options,platformFactory:factory}),fault==='partial_history'||fault==='migration71_ack'||fault==='bucket_ack'?/owned/:uncertain)
      assert.equal(fired,true,'fault reached')
      const resumed=await f.resume();assert.equal(resumed.code,0,JSON.stringify(resumed.result));assert.equal((await f.invoke('verify')).code,0)
      await evidence(f,fault.replaceAll('_','-'))
      assert.equal((await f.lab.db.query('select count(*)::int n from supabase_migrations.schema_migrations')).rows[0].n,71)
      assert.equal(f.lab.requests.filter(r=>r.method==='POST'&&r.path==='/auth/v1/admin/users').length,1)
    })
    await t.test('lost bucket HTTP response reconciles without duplicate resources',async()=>{
      const f=await fresh();f.lab.loseResponse('POST','/storage/v1/bucket');assert.equal((await f.apply()).code,0)
      assert.equal(f.lab.requests.filter(r=>r.method==='POST'&&r.path==='/storage/v1/bucket').length,6)
    })
    await t.test('an Auth intent with no matching identity never repeats creation',async()=>{
      const f=await fresh();let attempts=0
      const factory=faultFactory(p=>{p.client.auth.admin.createUser=async()=>{attempts++;throw Error('owned interruption before HTTP')}})
      await assert.rejects(()=>workflow.executeInstallation({command:'apply',...f.options,platformFactory:factory}),uncertain)
      assert.equal(attempts,1);assert.equal((await f.resume()).result.code,'bootstrap_uncertain')
      assert.equal((await f.lab.db.query('select phase from private.installation_bootstrap')).rows[0].phase,'auth_started')
      assert.equal(f.lab.requests.filter(r=>r.method==='POST'&&r.path==='/auth/v1/admin/users').length,0)
    })
    await t.test('migration 71 schema without its ledger identity never gets repaired',async()=>{
      const f=await fresh();const factory=faultFactory(p=>{const cli=p.cli.bind(p);p.cli=async(...args)=>{await cli(...args);if(!args[2].repairVersions)throw Error('owned interruption')}})
      await assert.rejects(()=>workflow.executeInstallation({command:'apply',...f.options,platformFactory:factory}),/owned/)
      await f.lab.db.query("delete from supabase_migrations.schema_migrations where version='20261012160000'")
      assert.equal((await f.resume()).result.code,'history_uncertain')
      assert.equal((await f.lab.db.query('select count(*)::int n from supabase_migrations.schema_migrations')).rows[0].n,70)
      assert.equal(f.lab.requests.filter(r=>r.method==='POST').length,0)
    })
  }finally{for(const lab of fixtures.reverse())await lab.close();await source.close()}
})
