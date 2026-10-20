import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createEmailNativeDatabase, emailNativeAvailable } from './helpers/emailNativeDatabase.mjs'
import { createProductSaveFixture } from './helpers/productSaveFixture.mjs'
import { snapshot } from '../scripts/commerce-release/database.mjs'

test('populated85 to87 is transactional, non-superuser and preserves existing data/disabled controls', {skip:!emailNativeAvailable}, async()=>{
  const db=await createEmailNativeDatabase({stopBefore:'20261021010000'})
  let owner
  try{
    const f=await createProductSaveFixture({database:db});await f.save(f.body())
    await db.query('update public.site_settings set payment_cash_enabled=true')
    await db.query("insert into public.customer_orders(id,first_name,phone,street_address,city,governorate,payment_method,subtotal_amount,total_amount,amount_paid) values($1,'Historical buyer','01012345678','Owned address','Owned city','Cairo','cash',100,100,0)",[randomUUID()])
    await db.query('update public.site_settings set payment_cash_enabled=false')
    for(const schema of ['public','private','catalog_private']){
      for(const r of (await db.query("select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname=$1 and c.relkind='r'",[schema])).rows)await db.exec('alter table '+schema+'."'+r.relname+'" owner to postgres')
      for(const r of (await db.query("select p.oid::regprocedure::text signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname=$1",[schema])).rows)await db.exec('alter function '+r.signature+' owner to postgres')
      await db.exec('alter schema '+schema+' owner to postgres')
    }
    await db.exec('grant usage on schema auth,storage to postgres;grant select on all tables in schema auth,storage to postgres')
    owner=await db.connect('postgres')
    assert.equal((await owner.query('select rolsuper from pg_roles where rolname=current_user')).rows[0].rolsuper,false)
    const before=await snapshot(owner),sources=await Promise.all(['20261021010000_live_card_checkout.sql','20261021020000_safe_pdc_dispatch.sql'].map(file=>readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8')))
    const apply=async()=>{await owner.query('begin');for(const sql of sources)await owner.query(sql.replace(/^begin;\s*$/im,'').replace(/^commit;\s*$/im,''))}
    await apply();await assert.rejects(()=>owner.query("select 'isolated late migration failure'::integer"));await owner.query('rollback')
    assert.equal((await owner.query("select to_regclass('private.pdc_dispatches') value")).rows[0].value,null)
    assert.deepEqual(await snapshot(owner),before)
    await apply();await owner.query('commit')
    const after=await snapshot(owner)
    for(const old of before){
      const columns=old.columns.map(n=>'"'+n.replaceAll('"','""')+'"').join(',')
      const rows=(await owner.query(`select count(*)::int count,encode(sha256(convert_to(coalesce(jsonb_agg(row_data order by row_data::text collate "C")::text,'[]'),'UTF8')),'hex') sha256 from (select to_jsonb(t) row_data from (select ${columns} from "${old.schema}"."${old.name}") t) rows`)).rows[0]
      assert.deepEqual(rows,{count:old.count,sha256:old.sha256},old.schema+'.'+old.name)
    }
    assert.equal(after.length,before.length+1)
    assert.equal((await owner.query('select count(*)::int n from private.pdc_dispatches')).rows[0].n,0)
    await owner.query('select catalog_private.reset_assert_coverage()')
  }finally{await owner?.end();await db.close()}
})
