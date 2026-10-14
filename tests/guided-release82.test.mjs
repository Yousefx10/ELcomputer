import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, writeFile, cp, readdir, lstat, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createPublicationFixture } from './helpers/publicationPlatform.mjs'
import { installerNativeAvailable } from './helpers/installerPlatform.mjs'
import { fixturePolicy } from './helpers/reservationPolicy.mjs'
import { policyDigest } from '../scripts/lib/targetPolicy.mjs'

test('two migration82 guided fresh brands with actual SQL/Auth/Storage/Nuxt/PM2; Linux/SSH/ingress and site-user layout are explicit fixtures',{skip:!installerNativeAvailable,timeout:1200000},async t=>{
  const completed=[]
  for(const[brand,recovery]of[['palm',false],['lavender',true]]){
    const f=await createPublicationFixture({initialize:false,release82:true,siteOrigin:'https://'+brand+'.example.invalid'})
    try{
      const site=await f.site(brand,{guided:true}),module=await import(pathToFileURL(join(f.source.directory,'scripts/guided/workflow.mjs'))),states=await import(pathToFileURL(join(f.source.directory,'scripts/guided/state.mjs'))),contracts=await import(pathToFileURL(join(f.source.directory,'scripts/publish/contracts.mjs')))
      const root=site.root,policyFile=join(root,'additional-policy.json'),registryFile=join(root,'legacy-registry.fixture.json'),targetFile=join(root,'publication-target.json'),manifestFile=join(root,'manifest.json'),directory=join(root,'guided')
      const policy=fixturePolicy();await writeFile(policyFile,JSON.stringify(policy),{mode:0o600});await writeFile(registryFile,JSON.stringify(site.registry),{mode:0o600});await writeFile(targetFile,JSON.stringify({...site.target,release_sha256:null}),{mode:0o600})
      const manifest={format:1,database_target_file:f.lab.targetFile,publication_target_file:targetFile,legacy_registry_file:registryFile,reservation_policy_file:policyFile,credentials_file:f.lab.credentialsFile,owner_file:f.lab.ownerFile,key_record_directory:join(root,'keys'),locale:brand==='lavender'?'ar':'en'}
      await writeFile(manifestFile,JSON.stringify(manifest),{mode:0o600})
      const lost=new Set(),sequence=[],lose=stage=>{sequence.push(stage);if(recovery&&!lost.has(stage)){lost.add(stage);throw Error('Owned boundary interruption: '+stage)}}
      const overrides={publicationTarget:(target,registry)=>contracts.validateTarget(target,registry,{laboratory:true}),remoteFactory:async(...args)=>{const remote=await site.remoteFactory(...args),call=remote.call.bind(remote);return{...remote,async call(action,payload){const result=await call(action,payload);if(action==='probe')lose('preflight');if(['transfer','artifact','runtime','staging','activation','process','health','receipt'].includes(action))lose('publication-'+action);return result}}},ingressCheck:site.ingressCheck,
        buildPackage:async({directory})=>{await cp(join(f.directory,'bundle'),directory,{recursive:true,verbatimSymlinks:true});lose('package')},
        planInstallation:async options=>{const installer=await import(pathToFileURL(join(f.source.directory,'scripts/install/workflow.mjs')));const result=await installer.planInstallation(options);lose('database-plan');return result},
        executeInstallation:async options=>{const installer=await import(pathToFileURL(join(f.source.directory,'scripts/install/workflow.mjs')));const platform=await import(pathToFileURL(join(f.source.directory,'scripts/install/platform.mjs')));const result=await installer.executeInstallation({...options,platformFactory:async(...args)=>{const p=await platform.connectPlatform(...args),cli=p.cli.bind(p);p.cli=async(...args)=>{await cli(...args);if(recovery&&args[2]?.followOn?.length===11)lose('migration82-ack')};return p},progress:state=>{if(state.status==='verified'&&(state.stage==='owner'||/^migration(7[2-9]|8[0-2])$/.test(state.stage)))lose(state.stage)}});lose('database');return result},
        prepareRuntime:async options=>{const runtime=await import(pathToFileURL(join(f.source.directory,'scripts/publish/runtime.mjs')));const result=await runtime.prepareRuntime(options);lose('runtime');return result},
        planPublication:async options=>{const publisher=await import(pathToFileURL(join(f.source.directory,'scripts/publish/workflow.mjs')));const result=await publisher.planPublication(options);lose('publication-plan');return result},
        executePublication:async options=>{const publisher=await import(pathToFileURL(join(f.source.directory,'scripts/publish/workflow.mjs')));const result=await publisher.executePublication(options);lose('publication');return result},
        readOnlyPublication:async options=>{const publisher=await import(pathToFileURL(join(f.source.directory,'scripts/publish/workflow.mjs')));const result=await publisher.readOnlyPublication(options);if(options.command==='verify')lose('final-verification');return result}}
      let prepared
      await t.test(brand+': packaging/preflight precede database mutation and recover acknowledged boundaries',async()=>{
        try{prepared=await module.prepareGuided({manifestFile,directory,overrides})}catch(error){assert.match(error.message,/Owned boundary/)}
        for(let i=0;!prepared&&i<5;i++)try{prepared=await module.runGuided({command:'resume',directory,overrides})}catch(error){assert.match(error.message,/Owned boundary/)}
        assert.equal(prepared.stage,'awaiting_database_confirmation')
        assert.equal((await f.lab.db.query("select count(*)::int n from pg_tables where schemaname='public' and tablename='quick_setup_state'")).rows[0].n,0)
        assert.equal((await f.lab.db.query('select count(*)::int n from auth.users')).rows[0].n,0)
        assert.equal((await f.lab.db.query('select count(*)::int n from storage.buckets')).rows[0].n,0)
        assert.ok(sequence.indexOf('package')<sequence.indexOf('preflight')&&sequence.indexOf('preflight')<sequence.indexOf('database-plan'))
        assert.equal((await module.runGuided({command:'check',directory,overrides})).mutated,false)
      })
      await t.test(brand+': policy drift, configuration drift, missing confirmation and concurrency fail before mutation',async()=>{
        await assert.rejects(()=>module.runGuided({command:'apply',directory,overrides}),error=>error.code==='confirmation_required')
        const originalPlan=await readFile(join(directory,'plan.json'),'utf8'),changedPlan=JSON.parse(originalPlan)
        changedPlan.preflight.remote.machine_id='0'.repeat(32);const{plan_digest,...planBody}=changedPlan;changedPlan.plan_digest=policyDigest(planBody)
        await writeFile(join(directory,'plan.json'),JSON.stringify(changedPlan));await assert.rejects(()=>module.runGuided({command:'check',directory,overrides}),error=>error.code==='checkpoint_changed');await writeFile(join(directory,'plan.json'),originalPlan)
        const identityDrift={...overrides,remoteFactory:async(...args)=>{const remote=await site.remoteFactory(...args),call=remote.call.bind(remote);return{...remote,async call(action,payload){const observed=await call(action,payload);return action==='probe'?{...observed,machine_id:'0'.repeat(32)}:observed}}}}
        await assert.rejects(()=>module.runGuided({command:'apply',directory,confirmDatabase:prepared.confirmation,overrides:identityDrift}),error=>error.code==='target_changed')
        const original=await readFile(policyFile,'utf8');policy.reservations.project_refs.push(f.lab.target.project_ref);policy.review.reservations_sha256=policyDigest(policy.reservations);await writeFile(policyFile,JSON.stringify(policy))
        await assert.rejects(()=>module.runGuided({command:'apply',directory,confirmDatabase:prepared.confirmation,overrides}));await writeFile(policyFile,original)
        const raw=await readFile(targetFile,'utf8');await writeFile(targetFile,JSON.stringify({...JSON.parse(raw),site_origin:'https://wrong.example.invalid'}));await assert.rejects(()=>module.runGuided({command:'check',directory,overrides}),error=>error.code==='target_changed');await writeFile(targetFile,raw)
        const intent=JSON.parse(await readFile(join(directory,'intent.json'))),unlock=await states.lock(directory,intent)
        try{await assert.rejects(()=>module.runGuided({command:'check',directory,overrides}),error=>error.code==='lock_busy')}finally{await unlock()}
        // Even a rehashed package cannot replace the approved82 source with79.
        const bundleFile=join(directory,'package/bundle.json'),bundleBefore=await readFile(bundleFile,'utf8'),bundle=JSON.parse(bundleBefore)
        bundle.source.release.last_migration=79;const{release_sha256,...bundleBody}=bundle;bundle.release_sha256=policyDigest(bundleBody)
        await writeFile(bundleFile,JSON.stringify(bundle));await assert.rejects(()=>module.runGuided({command:'check',directory,overrides}),error=>error.code==='source_changed');await writeFile(bundleFile,bundleBefore)
        assert.equal((await f.lab.db.query('select count(*)::int n from auth.users')).rows[0].n,0)
      })
      let publication
      await t.test(brand+': one database/owner bootstrap, distinct publication confirmation, interrupted preparation recovery',async()=>{
        for(let i=0;!publication&&i<25;i++)try{publication=await module.runGuided({command:i?'resume':'apply',directory,confirmDatabase:prepared.confirmation,overrides})}catch(error){assert.match(error.message,/Owned boundary/)}
        assert.equal(publication.stage,'awaiting_publication_confirmation');assert.notEqual(publication.confirmation,prepared.confirmation)
        assert.equal((await f.lab.db.query('select count(*)::int n from auth.users')).rows[0].n,1)
        assert.equal((await f.lab.db.query('select count(*)::int n from supabase_migrations.schema_migrations')).rows[0].n,82)
        assert.equal((await f.lab.db.query('select count(*)::int n from storage.buckets where public=false')).rows[0].n,6)
        await assert.rejects(()=>module.runGuided({command:'apply',directory,confirmPublication:prepared.confirmation,overrides}),error=>error.code==='confirmation_required')
      })
      await t.test(brand+': actual publication, final acceptance and exact resume preserve original authority',async()=>{
        let result
        for(let i=0;!result&&i<15;i++)try{result=await module.runGuided({command:i?'resume':'apply',directory,confirmPublication:publication.confirmation,overrides})}catch(error){assert.match(error.message,/Owned boundary/)}
        assert.equal(result.complete,true);assert.equal(result.hosted_accepted,false);assert.equal(result.setup_url,f.lab.target.site_origin+(manifest.locale==='ar'?'/ar':'')+'/dashboard/setup')
        assert.equal((await module.runGuided({command:'verify',directory,overrides})).complete,true)
        assert.equal((await module.runGuided({command:'resume',directory,overrides})).complete,true)
        await assert.rejects(()=>module.runGuided({command:'apply',directory,overrides}),error=>error.code==='installation_complete')
        const dbReceiptBefore=await readFile(join(directory,'database/receipt.json'),'utf8'),pubReceiptBefore=await readFile(join(directory,'publication/receipt.json'),'utf8')
        await writeFile(join(directory,'receipt.json'),'{}');await assert.rejects(()=>module.runGuided({command:'verify',directory,overrides}),error=>error.code==='checkpoint_changed')
        assert.equal((await module.runGuided({command:'resume',directory,overrides})).complete,true)
        assert.equal(await readFile(join(directory,'database/receipt.json'),'utf8'),dbReceiptBefore);assert.equal(await readFile(join(directory,'publication/receipt.json'),'utf8'),pubReceiptBefore)
        const user=(await f.lab.db.query('select id from auth.users')).rows[0].id
        assert.equal(f.lab.requests.filter(r=>r.method==='POST'&&r.path==='/auth/v1/admin/users').length,1,'One actual owner creation')
        assert.equal(sequence.filter(stage=>stage==='database').length,1,'No completed database component replay')
        // Original engines, not the coordinator, restore lost receipt pointers.
        const nativeJobsBefore=(await readdir(join(directory,'database'))).filter(name=>name.startsWith('cli-')).length
        await unlink(join(directory,'database/receipt.json'))
        await assert.rejects(()=>module.runGuided({command:'resume',directory,overrides}),error=>error.code==='confirmation_required')
        assert.equal((await module.runGuided({command:'resume',directory,confirmDatabase:prepared.confirmation,overrides})).complete,true)
        assert.equal((await readdir(join(directory,'database'))).filter(name=>name.startsWith('cli-')).length,nativeJobsBefore)
        await unlink(join(directory,'publication/receipt.json'))
        await assert.rejects(()=>module.runGuided({command:'resume',directory,overrides}),error=>error.code==='confirmation_required')
        assert.equal((await module.runGuided({command:'resume',directory,confirmPublication:publication.confirmation,overrides})).complete,true)
        assert.equal(f.lab.requests.filter(r=>r.method==='POST'&&r.path==='/auth/v1/admin/users').length,1)
        for(const table of['products','categories','brands','customer_orders'])assert.equal((await f.lab.db.query('select count(*)::int n from public.'+table)).rows[0].n,0)
        assert.equal((await f.lab.db.query('select count(*)::int n from public.customer_profiles where is_internal=false')).rows[0].n,0)
        assert.equal((await f.lab.db.query('select count(*)::int n from storage.objects')).rows[0].n,0)
        for(const table of ['salary_payment_commands','checkout_quotes','checkout_commands'])assert.equal((await f.lab.db.query('select count(*)::int n from private.'+table)).rows[0].n,0)
        const certificate=JSON.parse(await readFile(join(directory,'database/receipt.json')));assert.equal(certificate.format,3);assert.equal(certificate.last_migration,82);assert.equal(certificate.later_migrations.length,12);
        const runtime=JSON.parse(await readFile(join(directory,'runtime/runtime.json'))),finalReceipt=await readFile(join(directory,'receipt.json'),'utf8')
        for(const file of(await readdir(directory)).filter(file=>file.endsWith('.json'))){const body=await readFile(join(directory,file),'utf8');for(const secret of[f.lab.owner.password,f.lab.credentials.service_role_key,runtime.env.NUXT_CREDENTIALS_ENCRYPTION_KEY,runtime.env.NUXT_SHIPPING_CREDENTIALS_ENCRYPTION_KEY])assert.ok(!body.includes(secret),file)}
        assert.equal((await lstat(join(directory,'receipt.json'))).mode&0o777,0o600)
        assert.ok(!finalReceipt.includes(f.lab.owner.email))
        assert.ok((await f.lab.db.query("select is_enabled,auto_create_labels from public.shipping_provider_settings")).rows.every(row=>!row.is_enabled&&!row.auto_create_labels))
        assert.equal(runtime.env.NUXT_SHIPPING_LIVE_REQUESTS_ENABLED,'false');assert.equal(runtime.env.NUXT_SMS_WORKER_SECRET,'')
        if(recovery)for(const boundary of['package','preflight','database-plan','database','runtime','publication-plan','publication','final-verification','owner','migration82-ack',...['transfer','artifact','runtime','staging','activation','process','health','receipt'].map(s=>'publication-'+s),...Array.from({length:11},(_,i)=>'migration'+(i+72))])assert.ok(lost.has(boundary),boundary)
        assert.equal(nativeJobsBefore,13,'One adoption, one migration71 and eleven normal migration pushes');
        completed.push({installation:f.lab.target.installation_id,project:f.lab.target.project_ref,owner:user,origin:f.lab.target.site_origin,machine:site.target.ssh.machine_id,fingerprint:site.target.ssh.host_key_sha256,pm2:site.target.site.pm2_name,port:site.target.site.port,privateKey:runtime.env.NUXT_CREDENTIALS_ENCRYPTION_KEY,shippingKey:runtime.env.NUXT_SHIPPING_CREDENTIALS_ENCRYPTION_KEY})
      })
      await t.test(brand+': exact ledger, schema and private grants reject drift without replay',async()=>{
        const ledger=(await f.lab.db.query("select statements from supabase_migrations.schema_migrations where version='20261014200000'")).rows[0].statements
        await f.lab.db.query("update supabase_migrations.schema_migrations set statements=array_append(statements,'Owned unknown statement') where version='20261014200000'")
        await assert.rejects(()=>module.runGuided({command:'verify',directory,overrides}))
        await f.lab.db.query("update supabase_migrations.schema_migrations set statements=$1 where version='20261014200000'",[ledger])
        await f.lab.db.query('create table public.owned_unknown(id int)')
        await assert.rejects(()=>module.runGuided({command:'verify',directory,overrides}))
        await f.lab.db.query('drop table public.owned_unknown')
        await f.lab.db.query('grant usage on schema catalog_private to anon')
        await assert.rejects(()=>module.runGuided({command:'verify',directory,overrides}))
        await f.lab.db.query('revoke usage on schema catalog_private from anon')
        await f.lab.db.query('grant select on private.checkout_commands to service_role')
        await assert.rejects(()=>module.runGuided({command:'verify',directory,overrides}))
        await f.lab.db.query('revoke select on private.checkout_commands from service_role')
        assert.equal((await module.runGuided({command:'verify',directory,overrides})).complete,true)
        assert.equal(f.lab.requests.filter(r=>r.method==='POST'&&r.path==='/auth/v1/admin/users').length,1)
        assert.equal((await readdir(join(directory,'database'))).filter(name=>name.startsWith('cli-')).length,13)
      })
    }finally{await f.close()}
  }
  assert.equal(completed.length,2)
  for(const key of Object.keys(completed[0]))assert.ok(completed[0][key]!==completed[1][key],'Distinct '+key)
})
