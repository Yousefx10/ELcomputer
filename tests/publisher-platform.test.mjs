import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, writeFile, readdir, cp, rename, chmod, lstat, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { createServer } from 'node:net'
import { createPublicationFixture } from './helpers/publicationPlatform.mjs'
import { installerNativeAvailable } from './helpers/installerPlatform.mjs'

test('publication protocol with actual Node 22/Nuxt/PM2/Auth/Storage; Linux and SSH ingress are fixtures', {skip:!installerNativeAvailable,timeout:600000},async t=>{
  const f=await createPublicationFixture()
  try{
    await t.test('fresh publication, completed receipt, live owner setup, scoped PM2 and safe second run',async()=>{
      const site=await f.site('happy'),result=await site.apply();assert.equal(result.complete,true);assert.equal(result.health.owner_setup,true)
      assert.equal((await site.verify()).complete,true)
      const remoteFile=join(site.target.site.app_path,'.elcomputer-publication/receipt.json'),original=await readFile(remoteFile,'utf8')
      await writeFile(remoteFile,JSON.stringify({...JSON.parse(original),inventory_sha256:'0'.repeat(64)}),{mode:0o600})
      await assert.rejects(()=>site.verify(),error=>error.code==='checkpoint_changed');await writeFile(remoteFile,original,{mode:0o600})
      await assert.rejects(()=>site.apply(),error=>error.code==='already_complete')
      const state=JSON.parse(await readFile(join(site.target.site.app_path,'.elcomputer-publication/state.json')))
      assert.equal(state.complete,true);assert.equal(state.process_intent,true);assert.ok(state.pid>0)
      const dump=await readFile(join(site.target.site.pm2_home,'dump.pm2'),'utf8'),runtime=JSON.parse(await readFile(site.runtimeFile)),receipt=await readFile(join(site.publishDir,'receipt.json'),'utf8')
      for(const secret of[f.lab.credentials.service_role_key,runtime.env.NUXT_CREDENTIALS_ENCRYPTION_KEY,runtime.env.NUXT_SHIPPING_CREDENTIALS_ENCRYPTION_KEY,f.lab.owner.password]){assert.ok(!dump.includes(secret));assert.ok(!receipt.includes(secret))}
      assert.equal((await lstat(join(site.target.site.app_path,'.elcomputer-publication/runtime.json'))).mode&0o777,0o600)
      assert.equal((await lstat(join(site.target.site.pm2_home,'dump.pm2'))).mode&0o777,0o600)
      assert.equal((await f.lab.db.query('select count(*)::int n from public.products')).rows[0].n,0)
      assert.equal((await f.lab.db.query('select count(*)::int n from public.categories')).rows[0].n,0)
      assert.equal((await f.lab.db.query('select count(*)::int n from public.customer_orders')).rows[0].n,0)
    })
    await t.test('wrong confirmation and altered private runtime stop before remote mutation',async()=>{
      const site=await f.site('guards')
      await assert.rejects(()=>f.workflow.executePublication({command:'apply',...site.execute,confirm:'wrong'}),error=>error.code==='confirmation_required')
      const runtime=JSON.parse(await readFile(site.runtimeFile));runtime.env.NUXT_SHIPPING_LIVE_REQUESTS_ENABLED='true';await writeFile(site.runtimeFile,JSON.stringify(runtime),{mode:0o600})
      await assert.rejects(()=>site.apply(),error=>error.code==='runtime_changed')
      await assert.rejects(()=>readFile(join(site.target.site.app_path,'.elcomputer-publication/state.json')),error=>error.code==='ENOENT')
    })
    for(const stage of['transfer','artifact','runtime','staging','activation','process','health','receipt'])await t.test('exact recovery after lost '+stage+' acknowledgement',async()=>{
      const site=await f.site('lost-'+stage);let interrupted=false
      const remoteFactory=async(...args)=>{const remote=await site.execute.remoteFactory(...args),call=remote.call.bind(remote);return{...remote,async call(action,payload){const result=await call(action,payload);if(action===stage&&!interrupted){interrupted=true;throw Error('Owned lost '+stage+' acknowledgement')}return result}}}
      await assert.rejects(()=>f.workflow.executePublication({command:'apply',...site.execute,remoteFactory}),/Owned lost/)
      assert.equal(interrupted,true)
      const resumed=await site.resume();assert.equal(resumed.complete,true);assert.equal((await site.verify()).complete,true)
      assert.equal((await f.lab.db.query('select count(*)::int n from auth.users')).rows[0].n,1,'No owner recreation')
    })
    await t.test('local receipt pointer interruption resumes through the protected plan',async()=>{
      const site=await f.site('receipt-pointer');await site.apply()
      await writeFile(join(site.publishDir,'receipt.json'),'{}',{mode:0o600})
      assert.equal((await site.resume()).complete,true)
      assert.equal(JSON.parse(await readFile(join(site.publishDir,'receipt.json'))).status,'complete')
    })
    await t.test('occupied port, existing output and concurrent target claims reject before activation',async()=>{
      const site=await f.site('occupied'),server=createServer()
      await new Promise(resolve=>server.listen(site.target.site.port,'127.0.0.1',resolve))
      try{await assert.rejects(()=>site.apply(),error=>error.code==='occupied_target')}finally{await new Promise(resolve=>server.close(resolve))}
      const remote=await site.execute.remoteFactory();await remote.call('claim',{plan:site.plan})
      try{const second=await site.execute.remoteFactory();try{await assert.rejects(()=>second.call('claim',{plan:site.plan,resume:true}),error=>error.code==='lock_busy')}finally{await second.close()}}finally{await remote.close()}
      await assert.rejects(()=>site.apply(),error=>error.code==='occupied_target')
      await assert.rejects(()=>readFile(join(site.target.site.app_path,'.output/server/index.mjs')),error=>error.code==='ENOENT')
    })
    await t.test('partial transfer and extraction preserve evidence and reconcile the exact archive',async()=>{
      const site=await f.site('partial');let interrupted=false
      const remoteFactory=async(...args)=>{const remote=await site.execute.remoteFactory(...args),call=remote.call.bind(remote);return{...remote,async call(action,payload){if(action==='artifact'&&!interrupted){interrupted=true;const state=join(site.target.site.app_path,'.elcomputer-publication');await remote.session.mark('extracting',{extraction_intent:true});await (await import('node:fs/promises')).mkdir(join(state,'extracted'),{mode:0o700});await writeFile(join(state,'extracted','interrupted'),'owned evidence',{mode:0o600});await writeFile(join(state,'release.tar.gz'),'partial bytes',{mode:0o600});throw Error('Owned partial extraction')}return call(action,payload)}}}
      await assert.rejects(()=>f.workflow.executePublication({command:'apply',...site.execute,remoteFactory}),/Owned partial/)
      assert.equal((await site.resume()).complete,true)
      const names=await readdir(join(site.target.site.app_path,'.elcomputer-publication'));assert.ok(names.some(name=>name.startsWith('interrupted-extraction-')))
    })
    await t.test('startup failure stops only the new process and exact resume recovers',async()=>{
      const site=await f.site('startup-failure');let interrupted=false
      const remoteFactory=async(...args)=>{const remote=await site.execute.remoteFactory(...args),call=remote.call.bind(remote);return{...remote,async call(action,payload){if(action==='health'&&!interrupted){interrupted=true;throw Error('Owned startup health failure')}return call(action,payload)}}}
      await assert.rejects(()=>f.workflow.executePublication({command:'apply',...site.execute,remoteFactory}),/Owned startup/)
      const remote=await site.execute.remoteFactory();await remote.call('claim',{plan:site.plan,resume:true});try{const processes=await remote.session.processes();assert.equal(processes.length,1);assert.equal(processes[0].pm2_env.status,'stopped')}finally{await remote.close()}
      assert.equal((await site.resume()).complete,true)
    })
    await t.test('database drift during activation cannot receive a completed publication receipt',async()=>{
      const site=await f.site('database-drift');let brand
      const remoteFactory=async(...args)=>{const remote=await site.execute.remoteFactory(...args),call=remote.call.bind(remote);return{...remote,async call(action,payload){const result=await call(action,payload);if(action==='health')brand=(await f.lab.db.query("insert into public.brands(name,slug) values('Owned fixture','owned-fixture') returning id")).rows[0].id;return result}}}
      try{await assert.rejects(()=>f.workflow.executePublication({command:'apply',...site.execute,remoteFactory}));assert.notEqual(JSON.parse(await readFile(join(site.publishDir,'receipt.json'))).status,'complete')}
      finally{if(brand)await f.lab.db.query('delete from public.brands where id=$1',[brand])}
      assert.equal((await site.resume()).complete,true)
    })
    await t.test('verified uploaded media remains outside output across a controlled replacement',async()=>{
      const site=await f.site('uploads');await site.apply()
      const file=join(site.target.site.uploads_path,'fixture-only.png'),bytes=Buffer.from('owned disposable media fixture')
      await writeFile(file,bytes,{mode:0o600})
      const url='http://127.0.0.1:'+site.target.site.port+'/uploads/fixture-only.png'
      assert.deepEqual(Buffer.from(await (await fetch(url)).arrayBuffer()),bytes)
      const release=join(site.target.site.app_path,'.releases',site.target.release_sha256),backup=release+'-fixture-backup'
      await rename(release,backup);await cp(backup,release,{recursive:true,verbatimSymlinks:true})
      assert.deepEqual(await readFile(file),bytes);assert.deepEqual(Buffer.from(await (await fetch(url)).arrayBuffer()),bytes);assert.equal((await site.verify()).complete,true)
    })
  }finally{await f.close()}
})
