import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { productionProfile, productionBinding, productionProfileDigest, productionProjectRef, storageBucketsFor, productionHelper, prepareProductionBaseline, productionApiOperationAllowed } from '../scripts/install/production-profile.mjs'
import { validateTarget, validateOwner, ensure } from '../scripts/install/contracts.mjs'
import { buckets, verifyBuckets } from '../scripts/install/verify.mjs'
import { verifyDataApi } from '../scripts/install/platform.mjs'
import { fixturePolicy } from './helpers/reservationPolicy.mjs'
import { policyDigest } from '../scripts/lib/targetPolicy.mjs'
import { installerNativeAvailable, installerSourceCopy, createInstallerPlatform } from './helpers/installerPlatform.mjs'

const target = () => {
  const policy=fixturePolicy()
  policy.reservations.project_refs.push('zsqhuwgoasrexdnamlks')
  policy.review.reservations_sha256=policyDigest(policy.reservations)
  return {format:1,profile:'supabase-direct',installation_id:randomUUID(),project_ref:productionProjectRef,
    api_url:productionProfile.api_url,site_origin:productionProfile.site_origin,
    database:{host:productionProfile.database_host,port:5432,name:'postgres',user:'postgres',ca_file:'/private/tmp/owned-ca.pem'},
    excluded_project_refs:['zsqhuwgoasrexdnamlks'],production_profile:productionBinding(),
    reservation_policy:{file:'/private/tmp/owned-policy.json',sha256:policyDigest(policy),policy}}
}
const protectedError=error=>error.code==='protected_target'
test('production opt-in binds only the exact project/origin/direct endpoint and preserves default denials',()=>{
  assert.ok(validateTarget(target()))
  for(const mutate of [t=>delete t.production_profile,t=>t.production_profile.sha256='0'.repeat(64),t=>t.production_profile.id='other',t=>t.production_profile.extra=true,
    t=>t.project_ref='zsqhuwgoasrexdnamlks',t=>t.project_ref='abcdefghijklmnopqrst',t=>t.site_origin='https://new.elcomputer.net',t=>t.site_origin='https://old.elcomputer.net',
    t=>t.site_origin='https://www.elcomputer.net',t=>t.site_origin='https://other.example.invalid',t=>t.api_url+='/',t=>t.database.host='other.example.invalid',
    t=>t.database.port=6543,t=>t.profile='owned-laboratory',t=>t.laboratory={},t=>t.excluded_project_refs=[],t=>delete t.reservation_policy]){
    const value=target();mutate(value);assert.throws(()=>validateTarget(value),protectedError)
  }
  const blocked=target();blocked.excluded_project_refs.push(productionProjectRef);assert.throws(()=>validateTarget(blocked),protectedError)
  const reserved=target();reserved.reservation_policy.policy.reservations.project_refs.push(productionProjectRef)
  reserved.reservation_policy.policy.review.reservations_sha256=policyDigest(reserved.reservation_policy.policy.reservations)
  reserved.reservation_policy.sha256=policyDigest(reserved.reservation_policy.policy)
  assert.throws(()=>validateTarget(reserved))
})

test('unused compatibility buckets retain certified definitions and historical manifests',async()=>{
  const original=await readFile(new URL('../supabase/bootstrap/clean-v1/storage.json',import.meta.url),'utf8')
  const adjusted=storageBucketsFor(target(),buckets)
  assert.equal(adjusted.length,6);assert.ok(adjusted.every(b=>b.public===false))
  for(const bucket of buckets)assert.deepEqual(adjusted.find(b=>b.id===bucket.id),bucket.id==='order-packing-videos'?{...bucket,file_size_limit:50_000_000}:bucket)
  assert.equal(buckets.find(b=>b.id==='order-packing-videos').file_size_limit,524288000)
  assert.strictEqual(storageBucketsFor(undefined,buckets),buckets)
  assert.equal(await readFile(new URL('../supabase/bootstrap/clean-v1/storage.json',import.meta.url),'utf8'),original)
  assert.equal(productionBinding().sha256,productionProfileDigest)
  // Authoritative DB and API limits must agree. Reject the legacy 500 MiB value.
  const rows=adjusted.map(b=>({...b,name:b.id})),platform={target:target(),client:{storage:{listBuckets:async()=>({data:rows,error:null})}},db:{query:async sql=>({rows:sql.includes('count(*)')?[{n:0}]:rows})}}
  assert.equal((await verifyBuckets(platform,{complete:true})).length,6)
  rows.find(b=>b.id==='order-packing-videos').file_size_limit=524288000
  await assert.rejects(()=>verifyBuckets(platform,{complete:true}),error=>error.code==='target_changed')
})

test('metadata-only production profile denies every Storage object route, including service-key writes',()=>{
  const t=target()
  for(const path of ['/storage/v1/bucket','/storage/v1/bucket/admin-documents']){
    assert.equal(productionApiOperationAllowed(t,path,'GET',false),true)
    assert.equal(productionApiOperationAllowed(t,path,'HEAD',true),true)
  }
  assert.equal(productionApiOperationAllowed(t,'/storage/v1/bucket','POST',true),true)
  assert.equal(productionApiOperationAllowed(t,'/storage/v1/bucket','POST',false),false)
  assert.equal(productionApiOperationAllowed(t,'/auth/v1/admin/users','POST',true),true)
  assert.equal(productionApiOperationAllowed(t,'/auth/v1/admin/users','POST',false),false)
  for(const path of ['/storage/v1/object/order-packing-videos/file.webm','/storage/v1/object/upload/sign/admin-documents/file.pdf',
    '/storage/v1/object/upload/sign','/storage/v1/object/upload/resumable','/storage/v1/object/list/admin-documents',
    '/storage/v1/object/copy','/storage/v1/object/move','/storage/v1/s3/bucket/key','/storage/v1/bucket/admin-documents/empty']){
    for(const method of ['GET','HEAD','POST','PUT','PATCH','DELETE'])
      assert.equal(productionApiOperationAllowed(t,path,method,true),false,path+' '+method)
  }
  assert.equal(productionApiOperationAllowed(t,'/rest/v1/products','POST',true),false)
  assert.equal(productionApiOperationAllowed(t,'/auth/v1/token','POST',true),false)
  assert.equal(productionProfile.file_backend,'vps-only')
  assert.equal(productionProfile.storage_mode,'empty-compatibility-buckets-only')
  assert.equal(productionProfile.production_application_activation,false)
  assert.equal(productionApiOperationAllowed(undefined,'/storage/v1/object/other/file','POST',true),true)
})

test('metadata uses server key; public key has its own bounded read-only authentication check',async()=>{
  const keys={service_role_key:'sb_secret_private_canary',anon_key:'sb_publishable_public_canary'},requests=[]
  await verifyDataApi(async(url,options)=>{
    requests.push({url,options});assert.ok(!options.method||options.method==='GET')
    if(url.endsWith('/rest/v1/')){assert.equal(options.headers.apikey,keys.service_role_key);return new Response('{}')}
    assert.equal(options.headers.apikey,keys.anon_key);return Response.json({code:'PGRST205'},{status:404})
  },'https://owned.example.invalid',keys)
  assert.equal(requests.length,2)
  for(const response of [Response.json({code:'PGRST301'},{status:401}),Response.json({message:'bad gateway'},{status:404}),new Response('bad',{status:503}),Response.json([],{status:200})]){
    await assert.rejects(()=>verifyDataApi(async url=>url.endsWith('/rest/v1/')?new Response('{}'):response,'https://owned.example.invalid',keys),error=>error.code==='platform_unavailable')
  }
  await assert.rejects(()=>verifyDataApi(async()=>new Response('',{status:401}),'https://owned.example.invalid',keys),error=>error.code==='platform_unavailable')
  assert.throws(()=>validateOwner({email:'',password:''}))
})

test('release82 metadata-only native installation, owner and resume without Storage object access',{skip:!installerNativeAvailable,timeout:600000},async t=>{
  const source=await installerSourceCopy({release82:true})
  let lab
  try{
    lab=await createInstallerPlatform()
    // Reproduce the live project's exact dashboard helper using only the owned
    // cluster administrator. Application installation still runs non-superuser.
    await lab.root.query('create schema extensions authorization postgres;alter role postgres superuser;set role postgres')
    try{await lab.root.query(await readFile(new URL('./fixtures/supabase-auto-rls.sql',import.meta.url),'utf8'))}
    finally{await lab.root.query('reset role;alter role postgres nosuperuser')}
    const workflow=await import(pathToFileURL(join(source.directory,'scripts/install/workflow.mjs')))
    const {connectPlatform}=await import(pathToFileURL(join(source.directory,'scripts/install/platform.mjs')))
    // Production routing validation is tested above. This native fixture always
    // connects to its independently created loopback services, never the real project.
    // A schema/Storage profile test does not authorize replacing production TLS/DNS.
    const effective=target()
    await lab.root.query('begin;alter event trigger ensure_rls disable')
    try{await assert.rejects(()=>productionHelper(lab.root,effective))}finally{await lab.root.query('rollback')}
    // A baseline abort must also restore the helper's original namespace.
    await lab.db.query('begin')
    try{
      await prepareProductionBaseline(lab.db,effective)
      assert.equal((await productionHelper(lab.db,effective)).location,'extensions')
    }finally{await lab.db.query('rollback')}
    assert.equal((await productionHelper(lab.db,effective)).location,'public')
    const factory=async(_target,credentials=lab.credentials,options)=>{
      const p=await connectPlatform(lab.target,credentials,options)
      p.target=effective
      p.identity.production_helper=(await productionHelper(p.db,effective)).identity
      // Apply the production transport policy to the owned TLS endpoints.
      const transport=p.transport
      p.transport=(input,request={})=>{
        const path=new URL(typeof input==='string'?input:input.url).pathname.replace('/projects/'+lab.target.project_ref,'')
        ensure(productionApiOperationAllowed(effective,path,request.method||'GET',options?.mutating===true),'file_operations_disabled')
        return transport(input,request)
      }
      const client=key=>createClient(lab.target.api_url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:p.transport}})
      p.client=client(credentials.service_role_key);p.anon=client(credentials.anon_key)
      return p
    }
    const bound=target();bound.reservation_policy.file=join(lab.directory,'exclusions.json')
    bound.installation_id=lab.target.installation_id
    await writeFile(bound.reservation_policy.file,JSON.stringify(bound.reservation_policy.policy),{mode:0o600})
    // Use the existing engine with the exact production manifest and owned services.
    // Its authority is explicit in evidence; no production URL is contacted.
    const directory=join(lab.directory,'production-profile-install')
    const planned=await workflow.planInstallation({target:bound,credentials:lab.credentials,directory,platformFactory:factory})
    const plan=JSON.parse(await readFile(join(directory,'plan.json')))
    assert.equal(plan.engine,3);assert.equal(plan.source.release.last_migration,82)
    const args={plan,directory,credentials:lab.credentials,owner:lab.owner,confirm:planned.confirmation}
    await assert.rejects(()=>workflow.executeInstallation({command:'apply',...args,owner:null,platformFactory:factory}),error=>error.code==='invalid_input')
    assert.equal((await lab.db.query('select count(*)::int n from storage.buckets')).rows[0].n,0)
    let interrupted=false
    const interrupt=async(...options)=>{const p=await factory(...options),cli=p.cli.bind(p);p.cli=async(...cliArgs)=>{await cli(...cliArgs);if(!interrupted&&cliArgs[2]?.followOn?.length===11){interrupted=true;throw Error('Owned migration82 acknowledgement loss')}};return p}
    let interruption
    try{await workflow.executeInstallation({command:'apply',...args,platformFactory:interrupt})}catch(error){interruption=error}
    assert.ok(interruption)
    assert.equal(interrupted,true,'Reached migration82 acknowledgement loss: '+interruption?.code+' '+interruption?.message)
    const result=await workflow.executeInstallation({command:'resume',...args,platformFactory:factory})
    assert.equal(result.last_migration,82);assert.equal(result.owner_created,true)
    assert.equal((await workflow.readOnlyInstallation({command:'verify',...args,platformFactory:factory})).ok,true)
    const before=await readFile(join(directory,'receipt.json'),'utf8')
    await workflow.executeInstallation({command:'resume',...args,platformFactory:factory})
    assert.equal(await readFile(join(directory,'receipt.json'),'utf8'),before)
    const receipt=JSON.parse(before);assert.deepEqual(receipt.production_profile,productionBinding())
    assert.equal((await lab.db.query('select count(*)::int n from supabase_migrations.schema_migrations')).rows[0].n,82)
    assert.equal((await lab.db.query("select file_size_limit::text n from storage.buckets where id='order-packing-videos'")).rows[0].n,'50000000')
    assert.equal(lab.requests.filter(r=>r.method==='POST'&&r.path==='/auth/v1/admin/users').length,1)
    assert.equal((await productionHelper(lab.db,effective)).location,'extensions')
    // Even a mutating installation with its service key cannot send file bytes
    // or mint signed-upload tokens. Empty buckets remain compatibility only.
    const p=await factory(undefined,lab.credentials,{mutating:true})
    try{
      for(const bucket of buckets){
        assert.ok((await p.client.storage.from(bucket.id).upload('denied.bin',Buffer.from('must never leave the process'),{contentType:'application/octet-stream'})).error)
      }
      assert.ok((await p.client.storage.from('order-packing-videos').createSignedUploadUrl('denied.webm')).error)
      assert.ok((await p.client.storage.from('admin-documents').download('denied.pdf')).error)
      assert.equal((await p.client.storage.getBucket('admin-documents')).data.file_size_limit,26214400)
      assert.equal((await lab.db.query('select count(*)::int n from storage.objects')).rows[0].n,0)
      assert.equal(lab.requests.filter(r=>r.path.startsWith('/storage/v1/')&&!r.path.startsWith('/storage/v1/bucket')).length,0)
    }finally{await p.close()}
  }finally{await lab?.close();await source.close()}
})
