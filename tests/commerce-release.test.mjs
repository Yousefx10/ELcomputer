import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {resolve} from 'node:path'
import {readFile} from 'node:fs/promises'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {argumentsFor,canonical} from '../scripts/commerce-release/operator.mjs'
import {hash,migrations,applyMigrations,checkDatabase} from '../scripts/commerce-release/database.mjs'
import {createEmailNativeDatabase,emailNativeAvailable} from './helpers/emailNativeDatabase.mjs'
import {createProductSaveFixture} from './helpers/productSaveFixture.mjs'
const run=promisify(execFile),repo=resolve('.')
test('release CLI has no implicit apply, generic migration push or ambiguous approval',()=>{
  for(const args of [[],['apply'],['apply','plan'],['apply','plan','--yes','a'.repeat(64)],['prepare','a'],['prepare','a','b','extra']])assert.throws(()=>argumentsFor(args))
  assert.equal(argumentsFor(['prepare','a','b']).mode,'prepare')
  assert.equal(argumentsFor(['apply','plan','--approved','a'.repeat(64)]).approval,'a'.repeat(64))
})
test('approval digest matches Python and binds ordered nested plan values',async()=>{
  const value={z:[{t:2,a:'Arabic العربية'}],a:{b:true,a:'value'}}
  const python='import hashlib,json,sys;print(hashlib.sha256(json.dumps(json.loads(sys.argv[1]),sort_keys=True,separators=(",",":"),ensure_ascii=False).encode()).hexdigest())'
  assert.equal((await run('python3',['-c',python,JSON.stringify(value)])).stdout.trim(),hash(canonical(value)))
})
test('release retains exact 1-82 migration bytes and includes only the three requested changes',async()=>{
  const release=await migrations(repo)
  assert.equal(release.history.length,82);assert.equal(release.pending.length,3)
  assert.deepEqual(release.pending.map(m=>m.version),['20261020120000','20261020160000','20261020200000'])
  assert.ok(release.pending.every(m=>hash(m.text)===m.sha256))
})
test('production release source contains explicit preservation and no Caddy restart or automatic recovery',async()=>{
  const local=await readFile('scripts/commerce-release/operator.mjs','utf8'),remote=await readFile('scripts/commerce-release/remote.py','utf8')
  assert.ok(local.includes("'database-before.dump.enc'")||local.includes("'/database-before.dump.enc'"))
  assert.ok(local.includes('execution-intent.json'));assert.ok(local.includes('git')&&local.includes('status'))
  assert.equal(/db push|migration repair|rejectUnauthorized:\s*false|StrictHostKeyChecking=no/.test(local),false)
  assert.equal(/\['systemctl','(?:restart|reload|stop)','caddy/.test(remote),false)
  assert.ok(remote.includes('activation-intent.json'));assert.ok(remote.includes('current.commerce-'))
})

test('native non-superuser migration owner: populated82 ->85, rollback and unchanged original records', {skip:!emailNativeAvailable,timeout:90000},async t=>{
  const db=await createEmailNativeDatabase({stopBefore:'20261020120000'}),release=await migrations(repo)
  let client
  try{
    const f=await createProductSaveFixture({database:db});await f.save(f.body())
    await db.query("update public.site_settings set payment_cash_enabled=true where key='default'")
    const order=(await db.query("insert into public.customer_orders(first_name,phone,street_address,city,governorate,payment_method,subtotal_amount,total_amount,amount_paid) values('Owned legacy buyer','01012345678','Owned street','Owned city','Cairo','cash',100,100,12.34) returning id")).rows[0].id
    await db.query("update public.site_settings set payment_cash_enabled=false where key='default'")
    const company=(await db.query("insert into public.commerce_shipping_companies(name,client_shipping_price) values('Owned legacy delivery',27) returning id")).rows[0].id
    await db.exec('create schema supabase_migrations authorization postgres;create table supabase_migrations.schema_migrations(version text primary key,statements text[],name text);alter table supabase_migrations.schema_migrations owner to postgres')
    for(const m of release.history)await db.query('insert into supabase_migrations.schema_migrations values($1,$2,$3)',[m.version,[],m.name])
    // Only the application's schemas/objects change fixture ownership. Hosted
    // managed schemas/Auth are not impersonated or claimed to be certified.
    for(const schema of ['public','private','catalog_private']){
      for(const r of (await db.query("select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname=$1 and c.relkind='r'",[schema])).rows)await db.exec('alter table '+schema+'."'+r.relname+'" owner to postgres')
      for(const r of (await db.query("select p.oid::regprocedure::text signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname=$1",[schema])).rows)await db.exec('alter function '+r.signature+' owner to postgres')
      await db.exec('alter schema '+schema+' owner to postgres')
    }
    await db.exec('grant usage on schema auth,storage to postgres;grant select on all tables in schema auth,storage to postgres')
    client=await db.connect('postgres')
    const state=()=>checkDatabase(client,release)
    const existing=await db.query('select * from public.customer_orders where id=$1',[order])
    await t.test('the real migration connection lacks superuser authority',async()=>{
      assert.equal((await client.query('select rolsuper from pg_roles where rolname=current_user')).rows[0].rolsuper,false)
      assert.equal((await state()).history.length,82)
    })
    await t.test('late source mismatch rolls back83/84 and history as well as85',async()=>{
      const broken={...release,pending:release.pending.map((m,i)=>i===2?{...m,text:m.text+'\n-- drift'}:m)}
      await assert.rejects(()=>applyMigrations(client,broken),/Migration source changed/)
      assert.equal((await state()).history.length,82)
      assert.equal((await db.query("select exists(select 1 from information_schema.columns where table_name='customer_orders' and column_name='shipping_fee_amount') value")).rows[0].value,false)
    })
    await t.test('failure after all SQL but before commit preserves the entire old schema/data',async()=>{
      await assert.rejects(()=>applyMigrations(client,release,{beforeCommit:()=>{throw Error('Owned injected interruption')}}),/Owned injected/)
      assert.equal((await state()).history.length,82)
      assert.deepEqual((await db.query('select * from public.customer_orders where id=$1',[order])).rows,existing.rows)
    })
    await t.test('one transaction applies exactly83/84/85 and retains every old column value',async()=>{
      const result=await applyMigrations(client,release)
      assert.equal(result.history.length,85);assert.ok(result.preserved_tables>100)
      const row=(await db.query('select * from public.customer_orders where id=$1',[order])).rows[0]
      for(const [key,value]of Object.entries(existing.rows[0]))assert.deepEqual(row[key],value)
      assert.equal(row.shipping_fee_amount,'0.00');assert.equal(row.amount_paid,'12.34')
      const carrier=(await db.query('select * from public.commerce_shipping_companies where id=$1',[company])).rows[0]
      assert.equal(carrier.client_shipping_price,'27.00');assert.equal(carrier.checkout_enabled,false);assert.deepEqual(carrier.checkout_governorates,[])
      for(const table of ['order_cod_collections','order_cod_reconciliations'])assert.equal((await db.query('select pg_get_userbyid(relowner) owner from pg_class where oid=$1::regclass',['public.'+table])).rows[0].owner,'postgres')
    })
    await t.test('a second execution cannot reapply committed migrations or produce business rows',async()=>{
      await assert.rejects(()=>applyMigrations(client,release),/history changed/)
      assert.equal((await db.query('select count(*)::int n from public.order_cod_collections')).rows[0].n,0)
      assert.equal((await db.query('select count(*)::int n from public.order_cod_reconciliations')).rows[0].n,0)
    })
  }finally{await client?.end();await db.close()}
})
