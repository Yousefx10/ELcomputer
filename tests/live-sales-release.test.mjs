import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {execFile,spawn} from 'node:child_process'
import {randomBytes} from 'node:crypto'
import {promisify} from 'node:util'
import {argumentsFor,digest,stable,approvalState,validateAssets,decryptTo,remoteCommand} from '../scripts/live-sales-release/operator.mjs'
import {migrations,hash,applyMigrations,checkDatabase,snapshot} from '../scripts/live-sales-release/database.mjs'
import {json as certificateJson} from '../scripts/lib/cleanBaseline.mjs'
import {createEmailNativeDatabase,emailNativeAvailable} from './helpers/emailNativeDatabase.mjs'
import {createProductSaveFixture} from './helpers/productSaveFixture.mjs'
const run=promisify(execFile),repo=resolve('.')
test('large sealed plans travel over structured stdin, preserving literal values',async()=>{
  const plan={seal:'a'.repeat(64),large:'x'.repeat(300000),literal:'$(touch /must-not-run)'}
  const source='import json,sys; p=json.loads(sys.argv[2]); assert len(p["large"])==300000 and p["literal"]=="$(touch /must-not-run)"; assert sys.argv[3:]==["--approved",p["seal"]]; print("PASS")'
  assert.ok(remoteCommand().length<1024)
  const child=spawn('/bin/sh',['-c',remoteCommand()],{env:{PATH:process.env.PATH},stdio:['pipe','pipe','pipe'],timeout:10000}),chunks=[]
  child.stdout.on('data',chunk=>chunks.push(chunk));child.stderr.resume();const done=new Promise(resolve=>child.on('close',resolve));child.stdin.end(JSON.stringify({source,plan,mode:'inspect'}))
  assert.equal(await done,0);assert.equal(Buffer.concat(chunks).toString().trim(),'PASS')
})
test('authenticated backup readback drains before an archive reader exits early',async()=>{
  const work=await mkdtemp(join(tmpdir(),'live-sales-backup-'))
  try{
    const key=work+'/key',envelope=repo+'/docs/operations/backup-envelope.mjs'
    await writeFile(key,randomBytes(32),{mode:0o600})
    const bytes=randomBytes(1024*1024),child=spawn(process.execPath,[envelope,'encrypt',key,work+'/fixture.enc'],{env:{...process.env,NODE_OPTIONS:''},timeout:10000})
    child.stdout.resume();child.stderr.resume();const done=new Promise(resolve=>child.on('close',resolve));child.stdin.end(bytes)
    assert.equal(await done,0)
    const result=await decryptTo({backup:{envelope,key}},work,'fixture','python3',['-c','import sys; print(len(sys.stdin.buffer.read(1)))'])
    assert.equal(result.toString().trim(),'1')
    const original=await readFile(work+'/fixture.enc');original[30]^=1;await writeFile(work+'/fixture.enc',original)
    await assert.rejects(()=>decryptTo({backup:{envelope,key}},work,'fixture','python3',['-c','print("must not accept corrupted backup")'],undefined,'tampered'))
  }finally{await rm(work,{recursive:true,force:true})}
})
test('new operator refuses implicit execution and requires a complete exact approval',()=>{
  for(const args of [[],['apply'],['apply','plan'],['apply','plan','--yes','a'.repeat(64)],['apply','plan','--approved','short'],['prepare','spec','dir','extra']])assert.throws(()=>argumentsFor(args))
  assert.equal(argumentsFor(['check','plan']).mode,'check')
  assert.equal(argumentsFor(['apply','plan','--approved','a'.repeat(64)]).approval,'a'.repeat(64))
})
test('approval allows only telemetry activity; its schema and all business fingerprints stay bound',()=>{
  const data={protected_tables:[{schema:'public',name:'store_analytics_events',columns:['id'],count:1,sha256:'old'},{schema:'public',name:'products',columns:['id'],count:1,sha256:'same'}]}
  const changed=structuredClone(data);changed.protected_tables[0].count++;changed.protected_tables[0].sha256='new'
  assert.deepEqual(approvalState(changed),approvalState(data))
  changed.protected_tables[0].columns.push('unexpected');assert.notDeepEqual(approvalState(changed),approvalState(data))
  const business=structuredClone(data);business.protected_tables[1].sha256='changed';assert.notDeepEqual(approvalState(business),approvalState(data))
})
test('new release binds 85 unchanged predecessors and only86/87, separately from old operator',async()=>{
  const release=await migrations(repo)
  assert.equal(release.history.length,85);assert.deepEqual(release.pending.map(m=>m.version),['20261021010000','20261021020000'])
  assert.ok(release.pending.every(m=>hash(m.text)===m.sha256))
  const python='import json,hashlib,sys; print(hashlib.sha256(json.dumps(json.loads(sys.argv[1]),sort_keys=True,separators=(",",":"),ensure_ascii=False).encode()).hexdigest())'
  const binding={nested:{target:'fixture',approved:false},migrations:release.pending.map(m=>m.sha256)}
  assert.equal((await run('python3',['-c',python,JSON.stringify(binding)])).stdout.trim(),digest(binding))
  assert.notEqual(digest({...binding,nested:{...binding.nested,target:'other'}}),digest(binding))
  assert.deepEqual(stable({observed_utc:'one',free_bytes:1,nuxt:{MainPID:'2'},media:'a'}),stable({observed_utc:'two',free_bytes:2,nuxt:{MainPID:'2'},media:'a'}))
  assert.notDeepEqual(stable({nuxt:{MainPID:'2'}}),stable({nuxt:{MainPID:'3'}}))
})
test('retained-asset extraction rejects traversal, duplicate, link and mutable-pointer entries',async()=>{
  const work=await mkdtemp(join(tmpdir(),'live-sales-assets-'))
  try{
    const script='import tarfile,io,sys; p=sys.argv[1]; name=sys.argv[2]; mode=sys.argv[3]; t=tarfile.open(p,"w:gz"); m=tarfile.TarInfo(name); m.size=3;\nif mode=="link": m.type=tarfile.SYMTYPE; m.linkname="../../outside"; m.size=0\nt.addfile(m,io.BytesIO(b"abc") if m.isfile() else None)\nif mode=="duplicate":t.addfile(m,io.BytesIO(b"abc"))\nt.close()'
    for(const [i,name,mode,allowed]of [[0,'_nuxt/asset.js','file',true],[1,'_nuxt/../../escape','file',false],[2,'_nuxt/asset','link',false],[3,'_nuxt/asset','duplicate',false],[4,'_nuxt/builds/latest.json','file',false]]){
      const file=join(work,i+'.tar.gz');await run('python3',['-c',script,file,name,mode])
      if(allowed)await validateAssets(file);else await assert.rejects(()=>validateAssets(file))
    }
  }finally{await rm(work,{recursive:true,force:true})}
})
test('read-only remote modes cannot select a mutation without the sealed approval',async()=>{
  const result=await run('python3',['-c',`import importlib.util
s=importlib.util.spec_from_file_location('r','scripts/live-sales-release/remote.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
calls=[]
m.paths=lambda p: (_ for _ in ()).throw(RuntimeError('mutation reached'))
import sys
sys.argv=['remote','prepare','{}']
try:m.main()
except KeyError:print('rejected before target access')`])
  assert.equal(result.stdout.trim(),'rejected before target access')
})
test('actual85->87 executor: non-superuser, late rollback, row preservation and no second run',{skip:!emailNativeAvailable,timeout:120000},async t=>{
  const db=await createEmailNativeDatabase({stopBefore:'20261021010000'}),release=await migrations(repo);let owner
  try{
    const fixture=await createProductSaveFixture({database:db});await fixture.save(fixture.body())
    await db.exec('create schema supabase_migrations authorization postgres;create table supabase_migrations.schema_migrations(version text primary key,statements text[],name text);alter table supabase_migrations.schema_migrations owner to postgres')
    // The real production certificate is checked by separate source guards. This
    // disposable history records the fixture's actual complete migration bytes.
    const fixtureHistory=[]
    for(const m of release.history){const text=await readFile(repo+'/supabase/migrations/'+m.version+'_'+m.name+'.sql','utf8');await db.query('insert into supabase_migrations.schema_migrations values($1,$2,$3)',[m.version,[text],m.name]);fixtureHistory.push({...m,statements_sha256:hash(certificateJson([text]))})}
    const localRelease={...release,certificate_history:fixtureHistory.slice(0,82)}
    for(const schema of ['public','private','catalog_private']){
      for(const r of (await db.query("select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname=$1 and c.relkind='r'",[schema])).rows)await db.exec('alter table '+schema+'."'+r.relname+'" owner to postgres')
      for(const r of (await db.query("select p.oid::regprocedure::text signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname=$1",[schema])).rows)await db.exec('alter function '+r.signature+' owner to postgres')
      await db.exec('alter schema '+schema+' owner to postgres')
    }
    await db.exec('grant usage on schema auth,storage to postgres;grant select on all tables in schema auth,storage to postgres')
    owner=await db.connect('postgres');assert.equal((await owner.query('select rolsuper from pg_roles where rolname=current_user')).rows[0].rolsuper,false)
    const before=await snapshot(owner)
    await t.test('certificate/history corruption fails before applying',async()=>{
      await assert.rejects(()=>checkDatabase(owner,{...localRelease,certificate_history:release.certificate_history}),/Historical statement drift/)
    })
    await t.test('late failure rolls back complete schema and history',async()=>{
      await assert.rejects(()=>applyMigrations(owner,localRelease,{beforeCommit:()=>{throw Error('injected late failure')}}),/injected late failure/)
      assert.deepEqual(await snapshot(owner),before);assert.equal((await checkDatabase(owner,localRelease)).history.length,85)
    })
    await t.test('disabled settings are required',async()=>{
      await db.exec('update public.site_settings set payment_card_enabled=true')
      await assert.rejects(()=>applyMigrations(owner,localRelease),/Activation is unapproved/)
      await db.exec('update public.site_settings set payment_card_enabled=false')
    })
    await t.test('one transaction preserves every old projected row and service ACLs',async()=>{
      const applied=await applyMigrations(owner,localRelease);assert.equal(applied.history.length,87);assert.equal(applied.preserved_tables,before.length)
      assert.equal((await checkDatabase(owner,localRelease,{after:true})).history.length,87)
    })
    await t.test('second execution cannot mutate a committed release',async()=>{
      await assert.rejects(()=>applyMigrations(owner,localRelease),/history changed/)
    })
  }finally{await owner?.end();await db.close()}
})
